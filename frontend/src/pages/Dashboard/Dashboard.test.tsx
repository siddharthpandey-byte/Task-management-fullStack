import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../api/api.helper";
import { dashboardService } from "../../api/services/dashboard.service";
import { makeAuth, makeUser, renderRoutes } from "../../test/auth.test-utils";
import type { DashboardData, DashboardTask } from "../../types/dashboard.types";
import DashboardPage from ".";

vi.mock("../../api/services/dashboard.service", () => ({
  dashboardService: { get: vi.fn() },
}));

const ada = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "member" as const,
  isActive: true,
};

const makeTask = (overrides: Partial<DashboardTask> = {}): DashboardTask => ({
  id: "t1",
  key: "WEB-1",
  number: 1,
  title: "Build login page",
  description: "",
  type: "bug",
  status: "in_progress",
  priority: "highest",
  assignee: ada,
  reporter: ada,
  project: { id: "p1", name: "Website", key: "WEB", status: "active" },
  dueDate: null,
  labels: [],
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

const DATA: DashboardData = {
  stats: { assigned: 12, inProgress: 3, overdue: 2, doneThisWeek: 5 },
  assigned: { tasks: [makeTask()], total: 12 },
  board: {
    projectCount: 2,
    columns: [
      {
        status: "todo",
        count: 7,
        tasks: [makeTask({ id: "t2", key: "WEB-2", title: "Design header", status: "todo" })],
      },
      { status: "in_progress", count: 3, tasks: [makeTask()] },
      { status: "in_review", count: 0, tasks: [] },
      { status: "done", count: 5, tasks: [] },
    ],
  },
};

const routes = [
  { path: "/dashboard", element: <DashboardPage /> },
  { path: "/tasks", element: <p>tasks page</p> },
  { path: "/browse/:taskKey", element: <p>task page</p> },
];
const auth = () => makeAuth({ user: makeUser({ id: "u1", name: "Ada Lovelace" }) });

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows live stats, my work and the board", async () => {
    vi.mocked(dashboardService.get).mockResolvedValue(DATA);
    renderRoutes(routes, "/dashboard", auth());

    const stats = await screen.findByRole("region", { name: "Task summary" });
    const tile = (label: string) => within(stats).getByText(label).closest("a")!;
    expect(await within(tile("Assigned to me")).findByText("12")).toBeInTheDocument();
    expect(within(tile("In progress")).getByText("3")).toBeInTheDocument();
    expect(within(tile("Overdue")).getByText("2")).toBeInTheDocument();
    expect(tile("Overdue")).toHaveAttribute("href", "/tasks?assignee=me&due=overdue");

    const mine = screen.getByRole("list", { name: "Open tasks assigned to you" });
    expect(within(mine).getByText("Build login page")).toBeInTheDocument();
    expect(within(mine).getByText("WEB-1").closest("a")).toHaveAttribute("href", "/browse/WEB-1");
    expect(screen.getByText("View all 12 assigned tasks")).toBeInTheDocument();

    const board = screen.getByRole("list", { name: "Board columns" });
    expect(within(board).getByText("Design header")).toBeInTheDocument();
    expect(within(board).getByText("+6 more")).toHaveAttribute("href", "/tasks?status=todo");
    expect(within(board).getByText("In Review")).toBeInTheDocument();
    expect(screen.getByText("2 active projects")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is assigned", async () => {
    vi.mocked(dashboardService.get).mockResolvedValue({
      ...DATA,
      stats: { assigned: 0, inProgress: 0, overdue: 0, doneThisWeek: 0 },
      assigned: { tasks: [], total: 0 },
    });
    renderRoutes(routes, "/dashboard", auth());
    expect(await screen.findByText("You have no assigned work")).toBeInTheDocument();
  });

  it("reports errors with a retry", async () => {
    vi.mocked(dashboardService.get)
      .mockRejectedValueOnce(new HttpError(500, "Server exploded"))
      .mockResolvedValue(DATA);
    renderRoutes(routes, "/dashboard", auth());

    expect(await screen.findByText(/Server exploded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("Build login page")).length).toBeGreaterThan(0);
    expect(dashboardService.get).toHaveBeenCalledTimes(2);
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../api/api.helper";
import { projectService } from "../../api/services/project.service";
import { taskService } from "../../api/services/task.service";
import { makeAuth, makeUser, renderRoutes } from "../../test/auth.test-utils";
import type { Person, ProjectDetail } from "../../types/project.types";
import type { BoardData, Task, TaskStatus } from "../../types/task.types";
import BoardHomePage from "../BoardHome";
import ProjectBoardPage from ".";

vi.mock("../../api/services/project.service", () => ({
  projectService: { get: vi.fn(), list: vi.fn() },
}));
vi.mock("../../api/services/task.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/services/task.service")>();
  return {
    ...actual,
    taskService: { board: vi.fn(), move: vi.fn(), list: vi.fn(), create: vi.fn() },
  };
});
vi.mock("../../api/services/user.service", () => ({
  userService: { searchActive: vi.fn().mockResolvedValue([]) },
}));

const person = (id: string, name: string, role: Person["role"] = "member"): Person => ({
  id,
  name,
  email: `${id}@example.com`,
  role,
  isActive: true,
});
const lead = person("lead-1", "Grace Hopper", "manager");
const member = person("u1", "Ada Lovelace");

const project: ProjectDetail = {
  id: "p1",
  name: "Website Revamp",
  key: "WEB",
  description: "",
  lead,
  members: [lead, member],
  status: "active",
  createdBy: "lead-1",
  archivedAt: null,
  archivedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const makeTask = (n: number, status: TaskStatus, overrides: Partial<Task> = {}): Task => ({
  id: `t${n}`,
  key: `WEB-${n}`,
  number: n,
  title: `Task number ${n}`,
  description: "",
  type: "task",
  status,
  priority: "medium",
  assignee: n === 1 ? member : null,
  reporter: lead,
  project: { id: "p1", name: "Website Revamp", key: "WEB", status: "active" },
  dueDate: null,
  labels: n === 1 ? ["auth"] : [],
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  permissions: { canEdit: true, canDelete: false },
  ...overrides,
});

// To Do: WEB-1, WEB-2 · In Progress: WEB-3 · In Review: — · Done: WEB-4
const makeBoard = (overrides: Partial<BoardData> = {}): BoardData => ({
  project: { key: "WEB", name: "Website Revamp", status: "active" },
  canEdit: true,
  columnLimit: 200,
  columns: [
    { status: "todo", total: 2, tasks: [makeTask(1, "todo"), makeTask(2, "todo")] },
    { status: "in_progress", total: 1, tasks: [makeTask(3, "in_progress")] },
    { status: "in_review", total: 0, tasks: [] },
    { status: "done", total: 1, tasks: [makeTask(4, "done")] },
  ],
  ...overrides,
});

const routes = [
  { path: "/projects/:key/board", element: <ProjectBoardPage /> },
  { path: "/projects/:key/tasks", element: <p>list view</p> },
  { path: "/board", element: <BoardHomePage /> },
  { path: "/browse/:taskKey", element: <p>task page</p> },
];

const asMember = () => makeAuth({ user: makeUser({ id: "u1", role: "member" }) });

const column = (name: string) => screen.getByRole("region", { name });
const cardKeys = (name: string) =>
  within(column(name))
    .queryAllByTestId(/^board-card-/)
    .map((el) => el.getAttribute("data-testid")!.replace("board-card-", ""));

async function openMenu(taskKey: string) {
  fireEvent.click(await screen.findByRole("button", { name: `Move ${taskKey}` }));
}

describe("ProjectBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(projectService.get).mockResolvedValue(project);
    vi.mocked(taskService.board).mockResolvedValue(makeBoard());
  });
  afterEach(() => window.localStorage.clear());

  it("shows one column per status with counts and cards in order", async () => {
    renderRoutes(routes, "/projects/WEB/board", asMember());
    await screen.findByText("Task number 1");

    expect(cardKeys("To Do")).toEqual(["WEB-1", "WEB-2"]);
    expect(cardKeys("In Progress")).toEqual(["WEB-3"]);
    expect(cardKeys("In Review")).toEqual([]);
    expect(within(column("In Review")).getByText("Drop tasks here")).toBeInTheDocument();
    expect(within(column("To Do")).getByLabelText("2 tasks")).toBeInTheDocument();

    const card = screen.getByTestId("board-card-WEB-1");
    expect(within(card).getByText("auth")).toBeInTheDocument();
    expect(within(card).getByText("Assigned to Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Board/ })).toHaveAttribute("aria-current", "page");
    // remembered for the sidebar's Board link
    expect(window.localStorage.getItem("taskflow:last-board")).toBe("WEB");
  });

  it("moves a card to another column optimistically and saves its neighbours", async () => {
    let resolve!: (task: Task) => void;
    vi.mocked(taskService.move).mockReturnValue(new Promise((r) => (resolve = r)));
    renderRoutes(routes, "/projects/WEB/board", asMember());

    await openMenu("WEB-2");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to In Progress" }));

    // shown in the new column before the server answers
    expect(cardKeys("To Do")).toEqual(["WEB-1"]);
    expect(cardKeys("In Progress")).toEqual(["WEB-2", "WEB-3"]);
    expect(within(column("In Progress")).getByLabelText("2 tasks")).toBeInTheDocument();
    expect(screen.getByTestId("board-card-WEB-2")).toHaveAttribute("aria-busy", "true");
    await waitFor(() =>
      expect(taskService.move).toHaveBeenCalledWith("WEB-2", {
        status: "in_progress",
        afterKey: null,
        beforeKey: "WEB-3",
      })
    );

    resolve(makeTask(2, "in_progress", { title: "Saved title" }));
    expect(await screen.findByText("Saved title")).toBeInTheDocument();
    expect(screen.getByTestId("board-card-WEB-2")).not.toHaveAttribute("aria-busy");
    expect(screen.getByText("WEB-2 moved to the top of In Progress.")).toBeInTheDocument();
  });

  it("reorders within a column", async () => {
    vi.mocked(taskService.move).mockResolvedValue(makeTask(1, "todo"));
    renderRoutes(routes, "/projects/WEB/board", asMember());

    await openMenu("WEB-1");
    expect(screen.queryByRole("menuitem", { name: "Move to top" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to bottom" }));

    expect(cardKeys("To Do")).toEqual(["WEB-2", "WEB-1"]);
    await waitFor(() =>
      expect(taskService.move).toHaveBeenCalledWith("WEB-1", {
        status: "todo",
        afterKey: "WEB-2",
        beforeKey: null,
      })
    );
  });

  it("puts the card back and refetches when the move fails", async () => {
    vi.mocked(taskService.move).mockRejectedValue(
      new HttpError(409, "The board changed while you were moving this task.")
    );
    renderRoutes(routes, "/projects/WEB/board", asMember());

    await openMenu("WEB-1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to Done" }));
    expect(cardKeys("Done")).toEqual(["WEB-1", "WEB-4"]);

    expect(await screen.findByText("The board was not updated")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't move WEB-1\. The board changed/)).toBeInTheDocument();
    await waitFor(() => expect(cardKeys("To Do")).toEqual(["WEB-1", "WEB-2"]));
    expect(cardKeys("Done")).toEqual(["WEB-4"]);
    await waitFor(() => expect(taskService.board).toHaveBeenCalledTimes(2));
  });

  it("is view-only for people who can't change the project's tasks", async () => {
    vi.mocked(taskService.board).mockResolvedValue(makeBoard({ canEdit: false }));
    renderRoutes(
      routes,
      "/projects/WEB/board",
      makeAuth({ user: makeUser({ id: "m9", role: "manager" }) })
    );

    expect(
      await screen.findByText(/only members of Website Revamp can move its tasks/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move WEB-1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create task" })).not.toBeInTheDocument();
    expect(screen.getByTestId("board-card-WEB-1")).toHaveAttribute("aria-roledescription", "task");
    expect(within(column("In Review")).getByText("No tasks")).toBeInTheDocument();
  });

  it("is read-only for archived projects", async () => {
    vi.mocked(projectService.get).mockResolvedValue({ ...project, status: "archived" });
    vi.mocked(taskService.board).mockResolvedValue(
      makeBoard({
        canEdit: false,
        project: { key: "WEB", name: "Website Revamp", status: "archived" },
      })
    );
    renderRoutes(routes, "/projects/WEB/board", asMember());

    expect(await screen.findByText("This project is archived")).toBeInTheDocument();
    await screen.findByText("Task number 1");
    expect(screen.queryByRole("button", { name: "Move WEB-1" })).not.toBeInTheDocument();
  });

  it("reads filters from the URL, hides the status filter and sends the rest to the API", async () => {
    renderRoutes(
      routes,
      "/projects/WEB/board?assignee=me&type=bug&status=done&q=login",
      asMember()
    );
    await waitFor(() =>
      expect(taskService.board).toHaveBeenCalledWith(
        "WEB",
        { search: "login", priority: [], type: ["bug"], assignee: "me", due: "" },
        expect.any(AbortSignal)
      )
    );
    expect(await screen.findByRole("button", { name: "Type: Bug" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Status/ })).not.toBeInTheDocument();
  });

  it("tells the user when nothing matches the filters", async () => {
    vi.mocked(taskService.board).mockResolvedValue(
      makeBoard({
        columns: (["todo", "in_progress", "in_review", "done"] as const).map((status) => ({
          status,
          total: 0,
          tasks: [],
        })),
      })
    );
    renderRoutes(routes, "/projects/WEB/board?type=story", asMember());
    expect(await screen.findByText("No tasks match your filters")).toBeInTheDocument();
  });

  it("opens the task with Enter on a focused card", async () => {
    const router = renderRoutes(routes, "/projects/WEB/board", asMember());
    const card = await screen.findByTestId("board-card-WEB-2");
    fireEvent.keyDown(card, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/browse/WEB-2"));
  });

  it("links to the full list when a column is capped", async () => {
    const board = makeBoard();
    board.columns[3] = { ...board.columns[3], total: 350 };
    vi.mocked(taskService.board).mockResolvedValue(board);
    renderRoutes(routes, "/projects/WEB/board", asMember());

    expect(await screen.findByText(/Showing 1 of 350/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all in list" })).toHaveAttribute(
      "href",
      "/projects/WEB/tasks?status=done"
    );
  });

  it("shows a 404 and forgets the remembered board for projects you can't see", async () => {
    window.localStorage.setItem("taskflow:last-board", "NOPE");
    vi.mocked(projectService.get).mockRejectedValue(new HttpError(404, "Project not found"));
    renderRoutes(routes, "/projects/NOPE/board", asMember());
    expect(await screen.findByText("Project not found")).toBeInTheDocument();
    expect(window.localStorage.getItem("taskflow:last-board")).toBeNull();
  });
});

describe("BoardHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("reopens the last board", async () => {
    window.localStorage.setItem("taskflow:last-board", "WEB");
    vi.mocked(projectService.get).mockResolvedValue(project);
    vi.mocked(taskService.board).mockResolvedValue(makeBoard());
    const router = renderRoutes(routes, "/board", asMember());
    await waitFor(() => expect(router.state.location.pathname).toBe("/projects/WEB/board"));
  });

  it("lists active projects to pick from", async () => {
    vi.mocked(projectService.list).mockResolvedValue({
      projects: [project],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    renderRoutes(routes, "/board", asMember());

    const link = await screen.findByRole("link", { name: /Website Revamp/ });
    expect(link).toHaveAttribute("href", "/projects/WEB/board");
    expect(projectService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", sort: "name", order: "asc" }),
      expect.any(AbortSignal)
    );
  });
});

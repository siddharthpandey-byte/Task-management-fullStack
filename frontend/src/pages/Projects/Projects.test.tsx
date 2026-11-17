import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../api/api.helper";
import { projectService } from "../../api/services/project.service";
import { makeAuth, makeUser, renderRoutes } from "../../test/auth.test-utils";
import type { Project, ProjectListResult } from "../../types/project.types";
import ProjectsPage from ".";

vi.mock("../../api/services/project.service", () => ({
  projectService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
}));
vi.mock("../../api/services/user.service", () => ({
  userService: { searchActive: vi.fn().mockResolvedValue([]) },
}));

const lead = {
  id: "lead-1",
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "manager" as const,
  isActive: true,
};

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Website Revamp",
  key: "WEB",
  description: "",
  lead,
  members: ["lead-1", "u2"],
  status: "active",
  createdBy: "lead-1",
  archivedAt: null,
  archivedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

const listResult = (projects: Project[]): ProjectListResult => ({
  projects,
  pagination: { page: 1, limit: 20, total: projects.length, totalPages: projects.length ? 1 : 0 },
});

const routes = [
  { path: "/projects", element: <ProjectsPage /> },
  { path: "/projects/:key/settings", element: <p>settings page</p> },
];

describe("ProjectsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists projects and hides create/archive from members", async () => {
    vi.mocked(projectService.list).mockResolvedValue(listResult([makeProject()]));
    renderRoutes(routes, "/projects", makeAuth({ user: makeUser({ role: "member" }) }));

    const row = (await screen.findByText("Website Revamp")).closest("tr")!;
    expect(within(row).getByText("WEB")).toBeInTheDocument();
    expect(within(row).getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Actions for Website Revamp" }));
    expect(screen.getByRole("menuitem", { name: "Project settings" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /archive/i })).not.toBeInTheDocument();
  });

  it("lets the lead archive after confirming", async () => {
    vi.mocked(projectService.list).mockResolvedValue(listResult([makeProject()]));
    vi.mocked(projectService.archive).mockResolvedValue({
      ...makeProject({ status: "archived" }),
      members: [lead],
    });
    renderRoutes(
      routes,
      "/projects",
      makeAuth({ user: makeUser({ id: "lead-1", role: "manager" }) })
    );

    fireEvent.click(await screen.findByRole("button", { name: "Actions for Website Revamp" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive project" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() => expect(projectService.archive).toHaveBeenCalledWith("WEB"));
    expect(await screen.findByText(/was archived/)).toBeInTheDocument();
  });

  it("shows a member-friendly empty state", async () => {
    vi.mocked(projectService.list).mockResolvedValue(listResult([]));
    renderRoutes(routes, "/projects", makeAuth({ user: makeUser({ role: "member" }) }));
    expect(await screen.findByText(/haven't been added to any projects/)).toBeInTheDocument();
  });

  it("reads filters from the URL", async () => {
    vi.mocked(projectService.list).mockResolvedValue(listResult([]));
    renderRoutes(routes, "/projects?status=archived&q=web", makeAuth({ user: makeUser() }));
    await waitFor(() =>
      expect(projectService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: "archived", search: "web", page: 1 }),
        expect.any(AbortSignal)
      )
    );
    expect(screen.getByRole("button", { name: "Archived" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("creates a project with a suggested key and maps a duplicate-key error", async () => {
    vi.mocked(projectService.list).mockResolvedValue(listResult([]));
    vi.mocked(projectService.create).mockRejectedValue(
      new HttpError(409, "Project key already exists", [
        { field: "key", message: "Project key already exists" },
      ])
    );
    renderRoutes(routes, "/projects", makeAuth({ user: makeUser({ id: "a1", role: "admin" }) }));

    fireEvent.click((await screen.findAllByRole("button", { name: "Create project" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Create project" });
    fireEvent.change(within(dialog).getByLabelText(/^Name/), {
      target: { value: "Mobile Banking App" },
    });
    expect(within(dialog).getByLabelText(/^Key/)).toHaveValue("MBA");

    fireEvent.click(within(dialog).getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(projectService.create).toHaveBeenCalledWith({
        name: "Mobile Banking App",
        key: "MBA",
        description: undefined,
        leadId: "a1",
        memberIds: [],
      })
    );
    expect(await within(dialog).findByText("Project key already exists")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Key/)).toHaveAttribute("aria-invalid", "true");
  });
});

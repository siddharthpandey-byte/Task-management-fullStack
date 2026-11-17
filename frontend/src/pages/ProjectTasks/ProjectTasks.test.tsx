import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../api/api.helper";
import { projectService } from "../../api/services/project.service";
import { taskService } from "../../api/services/task.service";
import { makeAuth, makeUser, renderRoutes } from "../../test/auth.test-utils";
import type { Person, ProjectDetail } from "../../types/project.types";
import type { Task, TaskListResult } from "../../types/task.types";
import ProjectTasksPage from ".";

vi.mock("../../api/services/project.service", () => ({
  projectService: { get: vi.fn(), list: vi.fn() },
}));
vi.mock("../../api/services/task.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/services/task.service")>();
  return {
    ...actual,
    taskService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
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

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  key: "WEB-1",
  number: 1,
  title: "Build login page",
  description: "",
  type: "task",
  status: "todo",
  priority: "high",
  assignee: member,
  reporter: lead,
  project: { id: "p1", name: "Website Revamp", key: "WEB", status: "active" },
  dueDate: null,
  labels: ["auth"],
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  permissions: { canEdit: true, canDelete: false },
  ...overrides,
});

const listResult = (tasks: Task[]): TaskListResult => ({
  tasks,
  pagination: { page: 1, limit: 25, total: tasks.length, totalPages: tasks.length ? 1 : 0 },
});

const routes = [
  { path: "/projects/:key/tasks", element: <ProjectTasksPage /> },
  { path: "/browse/:taskKey", element: <p>task page</p> },
];

const asMember = () => makeAuth({ user: makeUser({ id: "u1", role: "member" }) });

describe("ProjectTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.get).mockResolvedValue(project);
  });

  it("lists tasks and only offers the actions the server allows", async () => {
    vi.mocked(taskService.list).mockResolvedValue(listResult([makeTask()]));
    renderRoutes(routes, "/projects/WEB/tasks", asMember());

    const row = (await screen.findByText("Build login page")).closest("tr")!;
    expect(within(row).getByText("WEB-1")).toBeInTheDocument();
    expect(within(row).getByText("To Do")).toBeInTheDocument();
    expect(within(row).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(row).getByText("auth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create task" })).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Actions for WEB-1" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move to In Progress" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("reads filters from the URL and sends them to the API", async () => {
    vi.mocked(taskService.list).mockResolvedValue(listResult([]));
    renderRoutes(
      routes,
      "/projects/WEB/tasks?status=todo,in_progress&assignee=me&sort=priority",
      asMember()
    );
    await waitFor(() =>
      expect(taskService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ["todo", "in_progress"],
          assignee: "me",
          sort: "priority",
          page: 1,
        }),
        "WEB",
        expect.any(AbortSignal)
      )
    );
    expect(await screen.findByText("No tasks match your filters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status (2)" })).toBeInTheDocument();
  });

  it("filters by status from the dropdown", async () => {
    vi.mocked(taskService.list).mockResolvedValue(listResult([makeTask()]));
    renderRoutes(routes, "/projects/WEB/tasks", asMember());
    await screen.findByText("Build login page");

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Done" }));

    await waitFor(() =>
      expect(taskService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: ["done"] }),
        "WEB",
        expect.any(AbortSignal)
      )
    );
  });

  it("creates a task and maps a server field error", async () => {
    vi.mocked(taskService.list).mockResolvedValue(listResult([]));
    vi.mocked(taskService.create).mockRejectedValue(
      new HttpError(400, "Assignee must be a member of this project", [
        { field: "assigneeId", message: "Assignee must be a member of this project" },
      ])
    );
    renderRoutes(routes, "/projects/WEB/tasks", asMember());

    fireEvent.click((await screen.findAllByRole("button", { name: "Create task" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Create task" });
    fireEvent.change(within(dialog).getByLabelText(/^Summary/), {
      target: { value: "Write docs" },
    });
    fireEvent.change(within(dialog).getByLabelText("Priority"), { target: { value: "highest" } });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Assign to me" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(taskService.create).toHaveBeenCalledWith(
        "WEB",
        expect.objectContaining({
          title: "Write docs",
          priority: "highest",
          status: "todo",
          assigneeId: "u1",
          dueDate: null,
        })
      )
    );
    expect(
      await within(dialog).findByText("Assignee must be a member of this project")
    ).toBeInTheDocument();
  });

  it("is read-only for archived projects", async () => {
    vi.mocked(projectService.get).mockResolvedValue({ ...project, status: "archived" });
    vi.mocked(taskService.list).mockResolvedValue(
      listResult([makeTask({ permissions: { canEdit: false, canDelete: false } })])
    );
    renderRoutes(routes, "/projects/WEB/tasks", asMember());

    expect(await screen.findByText("This project is archived")).toBeInTheDocument();
    await screen.findByText("Build login page");
    expect(screen.queryByRole("button", { name: "Create task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for WEB-1" })).not.toBeInTheDocument();
  });

  it("shows a 404 for projects you can't see", async () => {
    vi.mocked(projectService.get).mockRejectedValue(new HttpError(404, "Project not found"));
    renderRoutes(routes, "/projects/NOPE/tasks", asMember());
    expect(await screen.findByText("Project not found")).toBeInTheDocument();
  });
});

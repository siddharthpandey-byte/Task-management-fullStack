import type { Types } from "mongoose";
import { PROJECT_STATUS, ROLES, TASK_STATUS } from "../constants.js";
import { ProjectModel, type ProjectDocument } from "../models/project.model.js";
import { TaskModel, type TaskDocument } from "../models/task.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeRegex } from "../utils/regex.js";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
} from "../validators/task.validator.js";
import {
  PERSON_FIELDS,
  READ_ONLY_MESSAGE,
  canView,
  findVisibleProject,
  idOf,
} from "./project.service.js";

export const TASK_POPULATE = [
  { path: "assignee", select: PERSON_FIELDS },
  { path: "reporter", select: PERSON_FIELDS },
  { path: "project", select: "name key status" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
export const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

// --- permissions -----------------------------------------------------------
// Admins and managers can browse every project, but only people on the project
// (and admins) work on its tasks. Archived projects are read-only for everyone.

type ProjectAccess = Pick<ProjectDocument, "lead" | "members" | "status">;

const isMember = (user: AuthUser, project: ProjectAccess) =>
  project.members.some((m) => idOf(m) === user.id);

export function canEditTasks(user: AuthUser, project: ProjectAccess): boolean {
  if (project.status === PROJECT_STATUS.ARCHIVED) return false;
  return user.role === ROLES.ADMIN || isMember(user, project);
}

// admins, the project lead, or whoever reported it (while still on the project)
export function canDeleteTask(
  user: AuthUser,
  project: ProjectAccess,
  task: Pick<TaskDocument, "reporter">
): boolean {
  if (!canEditTasks(user, project)) return false;
  if (user.role === ROLES.ADMIN || idOf(project.lead) === user.id) return true;
  return idOf(task.reporter as Types.ObjectId) === user.id;
}

export interface TaskPermissions {
  canEdit: boolean;
  canDelete: boolean;
}

const permissionsFor = (
  user: AuthUser,
  project: ProjectAccess,
  task: TaskDocument
): TaskPermissions => ({
  canEdit: canEditTasks(user, project),
  canDelete: canDeleteTask(user, project, task),
});

// what the API returns: the task plus what the caller may do with it (UI hints only;
// every write re-checks on the server)
const present = (task: TaskDocument, permissions: TaskPermissions) => ({
  ...task.toJSON(),
  permissions,
});

function assertWritable(user: AuthUser, project: ProjectDocument) {
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    throw new ApiError(409, READ_ONLY_MESSAGE);
  }
  if (!canEditTasks(user, project)) {
    throw new ApiError(
      403,
      "Only members of this project can change its tasks"
    );
  }
}

// the assignee must be on the project and still active
async function assertAssignee(project: ProjectDocument, assigneeId: string) {
  const fail = (message: string) =>
    new ApiError(400, message, [{ field: "assigneeId", message }]);

  if (!project.members.some((m) => idOf(m) === assigneeId)) {
    throw fail("Assignee must be a member of this project");
  }
  const active = await UserModel.exists({ _id: assigneeId, isActive: true });
  if (!active) throw fail("Assignee must be an active user");
}

// --- lookups ---------------------------------------------------------------

// 404 (not 403) when the user can't see the project, so task keys don't leak
export async function findVisibleTask(user: AuthUser, taskKey: string) {
  const projectKey = taskKey.slice(0, taskKey.lastIndexOf("-"));
  const project = await ProjectModel.findOne({ key: projectKey });
  if (!project || !canView(user, project)) {
    throw new ApiError(404, "Task not found");
  }
  const task = await TaskModel.findOne({ key: taskKey, project: project._id });
  if (!task) throw new ApiError(404, "Task not found");
  return { project, task };
}

export async function getTask(user: AuthUser, taskKey: string) {
  const { project, task } = await findVisibleTask(user, taskKey);
  await task.populate(TASK_POPULATE);
  return present(task, permissionsFor(user, project, task));
}

// --- list ------------------------------------------------------------------

// ids of the projects whose tasks the global list may show
export async function visibleProjectIds(
  user: AuthUser
): Promise<Types.ObjectId[]> {
  const filter: Record<string, unknown> = { status: PROJECT_STATUS.ACTIVE };
  if (user.role === ROLES.MEMBER) filter.members = user.id;
  return ProjectModel.find(filter).distinct("_id");
}

// projectKey set → one project's tasks (from /projects/:key/tasks);
// otherwise every task the user can see, optionally narrowed by `query.project`
export async function listTasks(
  user: AuthUser,
  query: ListTasksQuery,
  projectKey?: string
) {
  const { page, limit, search, status, priority, type, assignee, due } = query;
  const scopedKey = projectKey ?? query.project;

  const and: Record<string, unknown>[] = [];
  if (scopedKey) {
    const project = await findVisibleProject(user, scopedKey);
    and.push({ project: project._id });
  } else {
    and.push({ project: { $in: await visibleProjectIds(user) } });
  }

  if (status?.length) and.push({ status: { $in: status } });
  if (priority?.length) and.push({ priority: { $in: priority } });
  if (type?.length) and.push({ type: { $in: type } });

  if (assignee === "me") and.push({ assignee: user.id });
  else if (assignee === "unassigned") and.push({ assignee: null });
  else if (assignee) and.push({ assignee });

  const today = startOfTodayUtc();
  if (due === "overdue") {
    and.push({
      dueDate: { $ne: null, $lt: today },
      status: { $ne: TASK_STATUS.DONE },
    });
  } else if (due === "week") {
    and.push({
      dueDate: { $gte: today, $lt: new Date(today.getTime() + 7 * DAY_MS) },
    });
  } else if (due === "none") {
    and.push({ dueDate: null });
  }

  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    and.push({ $or: [{ title: pattern }, { key: pattern }] });
  }

  const filter = { $and: and };
  const direction = query.order === "asc" ? 1 : -1;
  const sortField =
    query.sort === "priority"
      ? "priorityRank"
      : query.sort === "key"
        ? "number"
        : query.sort;

  const [tasks, total] = await Promise.all([
    TaskModel.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ [sortField]: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(TASK_POPULATE),
    TaskModel.countDocuments(filter),
  ]);

  // one query for the access rules of every project on this page
  const projectIds = [...new Set(tasks.map((t) => idOf(t.project as never)))];
  const projects = await ProjectModel.find({ _id: { $in: projectIds } }).select(
    "lead members status"
  );
  const byId = new Map(projects.map((p) => [String(p._id), p]));

  return {
    tasks: tasks.map((task) => {
      const project = byId.get(idOf(task.project as never));
      return present(
        task,
        project
          ? permissionsFor(user, project, task)
          : { canEdit: false, canDelete: false }
      );
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// --- mutations -------------------------------------------------------------

export async function createTask(
  user: AuthUser,
  projectKey: string,
  input: CreateTaskInput
) {
  const project = await findVisibleProject(user, projectKey);
  assertWritable(user, project);
  if (input.assigneeId) await assertAssignee(project, input.assigneeId);

  // atomic increment: concurrent creates always get distinct numbers, and the
  // status condition closes the race with a concurrent archive
  const counter = await ProjectModel.findOneAndUpdate(
    { _id: project._id, status: PROJECT_STATUS.ACTIVE },
    { $inc: { taskCounter: 1 } },
    { returnDocument: "after", projection: { taskCounter: 1 } }
  );
  if (!counter) throw new ApiError(409, READ_ONLY_MESSAGE);
  const number = counter.get("taskCounter") as number;

  const status = input.status ?? TASK_STATUS.TODO;
  const task = await TaskModel.create({
    project: project._id,
    number,
    key: `${project.key}-${number}`,
    title: input.title,
    description: input.description ?? "",
    type: input.type,
    status,
    priority: input.priority,
    assignee: input.assigneeId ?? null,
    reporter: user.id,
    dueDate: input.dueDate ?? null,
    labels: input.labels ?? [],
    completedAt: status === TASK_STATUS.DONE ? new Date() : null,
  });
  await task.populate(TASK_POPULATE);
  return present(task, permissionsFor(user, project, task));
}

export async function updateTask(
  user: AuthUser,
  taskKey: string,
  input: UpdateTaskInput
) {
  const { project, task } = await findVisibleTask(user, taskKey);
  assertWritable(user, project);

  if (input.assigneeId !== undefined) {
    const current = task.assignee ? idOf(task.assignee) : null;
    // keeping the current assignee is always allowed, even if they were deactivated
    if (input.assigneeId && input.assigneeId !== current) {
      await assertAssignee(project, input.assigneeId);
    }
    task.assignee = input.assigneeId as unknown as Types.ObjectId | null;
  }

  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.type !== undefined) task.type = input.type;
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.dueDate !== undefined) task.dueDate = input.dueDate;
  if (input.labels !== undefined) task.labels = input.labels;

  if (input.status !== undefined && input.status !== task.status) {
    task.completedAt = input.status === TASK_STATUS.DONE ? new Date() : null;
    task.status = input.status;
  }

  await task.save();
  await task.populate(TASK_POPULATE);
  return present(task, permissionsFor(user, project, task));
}

export async function deleteTask(user: AuthUser, taskKey: string) {
  const { project, task } = await findVisibleTask(user, taskKey);
  assertWritable(user, project);
  if (!canDeleteTask(user, project, task)) {
    throw new ApiError(
      403,
      "Only the reporter, the project lead or an admin can delete this task"
    );
  }
  await task.deleteOne();
}

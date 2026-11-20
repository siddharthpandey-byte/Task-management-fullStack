import type { Types } from "mongoose";
import {
  PROJECT_STATUS,
  ROLES,
  TASK_STATUS,
  TASK_STATUS_VALUES,
  type TaskStatus,
} from "../constants.js";
import { ProjectModel, type ProjectDocument } from "../models/project.model.js";
import { TaskModel, type TaskDocument } from "../models/task.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeRegex } from "../utils/regex.js";
import type {
  BoardQuery,
  CreateTaskInput,
  ListTasksQuery,
  MoveTaskInput,
  UpdateTaskInput,
} from "../validators/task.validator.js";
import { byRank, rankAtEnd, rankBetween } from "./rank.service.js";
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

type TaskFilterQuery = Pick<
  ListTasksQuery,
  "search" | "status" | "priority" | "type" | "assignee" | "due"
>;

// the filter conditions shared by the task list and the board (project scope excluded)
function taskFilterConditions(
  user: AuthUser,
  query: TaskFilterQuery
): Record<string, unknown>[] {
  const { search, status, priority, type, assignee, due } = query;
  const and: Record<string, unknown>[] = [];

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
  return and;
}

// projectKey set → one project's tasks (from /projects/:key/tasks);
// otherwise every task the user can see, optionally narrowed by `query.project`
export async function listTasks(
  user: AuthUser,
  query: ListTasksQuery,
  projectKey?: string
) {
  const { page, limit } = query;
  const scopedKey = projectKey ?? query.project;

  const scope = scopedKey
    ? { project: (await findVisibleProject(user, scopedKey))._id }
    : { project: { $in: await visibleProjectIds(user) } };

  const filter = { $and: [scope, ...taskFilterConditions(user, query)] };
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

// --- board -----------------------------------------------------------------

// a column never returns more than this; the header still shows the full count
export const BOARD_COLUMN_LIMIT = 200;

// One project's tasks grouped into a column per status, each in rank order.
// Rank is compared byte-wise, so these queries must not use a collation.
export async function getBoard(
  user: AuthUser,
  projectKey: string,
  query: BoardQuery
) {
  const project = await findVisibleProject(user, projectKey);
  const conditions = taskFilterConditions(user, query);

  const columns = await Promise.all(
    TASK_STATUS_VALUES.map(async (status) => {
      const filter = {
        $and: [{ project: project._id, status }, ...conditions],
      };
      const [tasks, total] = await Promise.all([
        TaskModel.find(filter)
          .sort({ rank: 1, number: 1 })
          .limit(BOARD_COLUMN_LIMIT)
          .populate(TASK_POPULATE),
        TaskModel.countDocuments(filter),
      ]);
      return {
        status,
        total,
        tasks: tasks.map((task) =>
          present(task, permissionsFor(user, project, task))
        ),
      };
    })
  );

  return {
    project: { key: project.key, name: project.name, status: project.status },
    canEdit: canEditTasks(user, project),
    columnLimit: BOARD_COLUMN_LIMIT,
    columns,
  };
}

// --- mutations -------------------------------------------------------------

// moving into "done" stamps completedAt; moving out of it clears the stamp
function applyStatus(task: TaskDocument, status: TaskStatus) {
  if (status === task.status) return;
  task.completedAt = status === TASK_STATUS.DONE ? new Date() : null;
  task.status = status;
}

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
  const rank = await rankAtEnd(project._id);
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
    rank,
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

  if (input.status !== undefined) applyStatus(task, input.status);

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

const BOARD_CHANGED =
  "The board changed while you were moving this task. Refresh and try again.";

// Drag-and-drop: put a task into `status`, between the card above it (`afterKey`)
// and the card below it (`beforeKey`) as the client last saw them. The server works
// out the rank, so a client can never write an arbitrary rank.
export async function moveTask(
  user: AuthUser,
  taskKey: string,
  input: MoveTaskInput
) {
  const { project, task } = await findVisibleTask(user, taskKey);
  assertWritable(user, project);

  const afterKey = input.afterKey ?? null;
  const beforeKey = input.beforeKey ?? null;
  const neighbourError = (field: string, message: string) =>
    new ApiError(400, message, [{ field, message }]);

  if (afterKey === task.key || beforeKey === task.key) {
    throw neighbourError(
      afterKey === task.key ? "afterKey" : "beforeKey",
      "A task can't be placed next to itself"
    );
  }
  if (afterKey && afterKey === beforeKey) {
    throw neighbourError(
      "beforeKey",
      "The cards above and below must be different"
    );
  }

  const keys = [afterKey, beforeKey].filter((k): k is string => k !== null);
  const found = keys.length
    ? await TaskModel.find({ project: project._id, key: { $in: keys } })
        .select("_id key number status rank")
        .lean()
    : [];
  const byKey = new Map(found.map((t) => [t.key, t]));
  const after = afterKey ? byKey.get(afterKey) : null;
  const before = beforeKey ? byKey.get(beforeKey) : null;
  if (after === undefined) {
    throw neighbourError(
      "afterKey",
      "The card above isn't a task in this project"
    );
  }
  if (before === undefined) {
    throw neighbourError(
      "beforeKey",
      "The card below isn't a task in this project"
    );
  }

  // a neighbour that has since moved to another column means the client's view is stale
  if (
    (after && after.status !== input.status) ||
    (before && before.status !== input.status)
  ) {
    throw new ApiError(409, BOARD_CHANGED);
  }

  // dropped back where it already was: nothing to write
  const self = { _id: task._id, number: task.number, rank: task.rank };
  const alreadyThere =
    task.status === input.status &&
    Boolean(task.rank) &&
    (!after || (Boolean(after.rank) && byRank(after, self) < 0)) &&
    (!before || (Boolean(before.rank) && byRank(self, before) < 0));
  if (!alreadyThere) {
    const result = await rankBetween(
      project._id,
      { after: after ?? null, before: before ?? null },
      task._id
    );
    if (!result.ok) throw new ApiError(409, BOARD_CHANGED);

    task.rank = result.rank;
    applyStatus(task, input.status);
    await task.save();
  }

  await task.populate(TASK_POPULATE);
  return present(task, permissionsFor(user, project, task));
}

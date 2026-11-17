import { PROJECT_KEY_REGEX } from "../../constants/project.constant";
import {
  TASK_PAGE_SIZE,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "../../constants/task.constant";
import type { SortOrder } from "../../types/project.types";
import type {
  AssigneeFilter,
  DueFilter,
  TaskListQuery,
  TaskPriority,
  TaskSort,
  TaskStatus,
  TaskType,
} from "../../types/task.types";

const SORTS: TaskSort[] = ["updatedAt", "createdAt", "dueDate", "priority", "key", "title"];
const ORDERS: SortOrder[] = ["asc", "desc"];
const ASSIGNEES: AssigneeFilter[] = ["me", "unassigned"];
const DUES: DueFilter[] = ["overdue", "week", "none"];

export const DEFAULT_TASK_SORT: TaskSort = "updatedAt";
export const DEFAULT_TASK_ORDER: SortOrder = "desc";

export type TaskParamName =
  "q" | "status" | "priority" | "type" | "assignee" | "due" | "project" | "sort" | "order" | "page";

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

// "todo,done,bogus" → ["todo", "done"] (unknown values are dropped)
const pickMany = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
  [...new Set((value ?? "").split(","))].filter((v): v is T => allowed.includes(v as T));

export type TaskListParams = Required<Omit<TaskListQuery, "project">> & { project: string };

// URL is the source of truth for the list; anything malformed falls back to a default
export function readTaskParams(params: URLSearchParams): TaskListParams {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const project = (params.get("project") ?? "").toUpperCase();
  return {
    search: (params.get("q") ?? "").slice(0, 100),
    project: PROJECT_KEY_REGEX.test(project) ? project : "",
    status: pickMany<TaskStatus>(params.get("status"), TASK_STATUSES),
    priority: pickMany<TaskPriority>(params.get("priority"), TASK_PRIORITIES),
    type: pickMany<TaskType>(params.get("type"), TASK_TYPES),
    assignee: pick<AssigneeFilter>(params.get("assignee"), ASSIGNEES, ""),
    due: pick<DueFilter>(params.get("due"), DUES, ""),
    sort: pick(params.get("sort"), SORTS, DEFAULT_TASK_SORT),
    order: pick(params.get("order"), ORDERS, DEFAULT_TASK_ORDER),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: TASK_PAGE_SIZE,
  };
}

type ParamValue = string | number | string[] | undefined;

// writes only non-default values so URLs stay short and shareable
export function writeTaskParams(
  current: URLSearchParams,
  changes: Partial<Record<TaskParamName, ParamValue>>
): URLSearchParams {
  const next = new URLSearchParams(current);
  const defaults: Partial<Record<TaskParamName, string>> = {
    sort: DEFAULT_TASK_SORT,
    order: DEFAULT_TASK_ORDER,
    page: "1",
  };
  for (const [name, raw] of Object.entries(changes) as [TaskParamName, ParamValue][]) {
    const value = Array.isArray(raw) ? raw.join(",") : raw === undefined ? "" : String(raw);
    if (!value || value === defaults[name]) next.delete(name);
    else next.set(name, value);
  }
  return next;
}

// filters (not sort/page) the user has narrowed the list by
export function activeFilterCount(query: TaskListParams, includeProject: boolean): number {
  return [
    query.search,
    query.status.length,
    query.priority.length,
    query.type.length,
    query.assignee,
    query.due,
    includeProject && query.project,
  ].filter(Boolean).length;
}

export const CLEARED_FILTERS: Partial<Record<TaskParamName, ParamValue>> = {
  q: "",
  status: [],
  priority: [],
  type: [],
  assignee: "",
  due: "",
  project: "",
  page: 1,
};

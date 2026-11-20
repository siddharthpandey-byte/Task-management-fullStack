import type { TaskPriority, TaskStatus, TaskType } from "../constants/task.constant";
import type { Pagination, Person, ProjectStatus, SortOrder } from "./project.types";

export type { TaskPriority, TaskStatus, TaskType };

export type TaskSort = "updatedAt" | "createdAt" | "dueDate" | "priority" | "key" | "title";
export type AssigneeFilter = "me" | "unassigned" | "";
export type DueFilter = "overdue" | "week" | "none" | "";

export interface TaskProjectRef {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
}

// what the server says the caller may do (UI hints; the API re-checks every write)
export interface TaskPermissions {
  canEdit: boolean;
  canDelete: boolean;
}

// Mirrors backend Task.toJSON + permissions
export interface Task {
  id: string;
  key: string;
  number: number;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: Person | null;
  reporter: Person;
  project: TaskProjectRef;
  // ISO string at UTC midnight
  dueDate: string | null;
  labels: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: TaskPermissions;
}

export interface TaskListQuery {
  page?: number;
  limit?: number;
  search?: string;
  project?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: TaskType[];
  assignee?: AssigneeFilter;
  due?: DueFilter;
  sort?: TaskSort;
  order?: SortOrder;
}

export interface TaskListResult {
  tasks: Task[];
  pagination: Pagination;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  // "YYYY-MM-DD"
  dueDate?: string | null;
  labels?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

// --- board -------------------------------------------------------------------

// the board shows every status in rank order, so it takes only the narrowing filters
export type BoardQuery = Pick<TaskListQuery, "search" | "priority" | "type" | "assignee" | "due">;

export interface BoardColumn {
  status: TaskStatus;
  // every matching task in this status; `tasks` is capped at BoardData.columnLimit
  total: number;
  tasks: Task[];
}

// Mirrors backend taskService.getBoard
export interface BoardData {
  project: Pick<TaskProjectRef, "key" | "name" | "status">;
  // whether the caller may move cards (project member or admin, project active)
  canEdit: boolean;
  columnLimit: number;
  columns: BoardColumn[];
}

// neighbours as shown on the board: the card directly above and directly below
export interface MoveTaskInput {
  status: TaskStatus;
  afterKey?: string | null;
  beforeKey?: string | null;
}

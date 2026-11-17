import type { Task, TaskStatus } from "./task.types";

// dashboard tasks are display-only, so they come without permission hints
export type DashboardTask = Omit<Task, "permissions">;

export interface DashboardStats {
  // open tasks assigned to me
  assigned: number;
  inProgress: number;
  overdue: number;
  // completed in the last 7 days
  doneThisWeek: number;
}

export interface BoardColumn {
  status: TaskStatus;
  count: number;
  // most recently updated few
  tasks: DashboardTask[];
}

export interface DashboardData {
  stats: DashboardStats;
  assigned: { tasks: DashboardTask[]; total: number };
  board: { projectCount: number; columns: BoardColumn[] };
}

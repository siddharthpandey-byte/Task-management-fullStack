import type { LozengeAppearance } from "../components/ui/Lozenge";

// Mirrors backend constants.ts (TASK_*)
export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export const TASK_PRIORITIES = ["highest", "high", "medium", "low", "lowest"] as const;
export const TASK_TYPES = ["task", "bug", "story"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const TASK_STATUS_APPEARANCE: Record<TaskStatus, LozengeAppearance> = {
  todo: "default",
  in_progress: "inprogress",
  in_review: "new",
  done: "success",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  highest: "Highest",
  high: "High",
  medium: "Medium",
  low: "Low",
  lowest: "Lowest",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  task: "Task",
  bug: "Bug",
  story: "Story",
};

export const TASK_KEY_REGEX = /^([A-Z][A-Z0-9]{1,9})-([1-9]\d{0,8})$/;
export const TASK_LABEL_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

export const TASK_LIMITS = {
  TITLE_MAX: 255,
  DESCRIPTION_MAX: 10000,
  LABELS_MAX: 10,
  LABEL_MAX: 30,
} as const;

export const TASK_PAGE_SIZE = 25;

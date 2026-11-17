export const DB_NAME = "Task-management";

export const API_NAME = "Task-management API";
export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  MEMBER: "member",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = Object.values(ROLES) as [Role, ...Role[]];

// refresh cookie is scoped to the auth routes so it's never sent with regular API calls
export const AUTH_ROUTES_PATH = `${API_PREFIX}/auth`;
export const COOKIES = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

export const JWT_ISSUER = "taskflow-api";
export const JWT_AUDIENCE = "taskflow-web";

export const PASSWORD_RESET_TTL_MS = 15 * 60_000;
export const PASSWORD_MIN_LENGTH = 8;
// argon2 cost doesn't depend on length, but cap it so huge bodies can't be hashed
export const PASSWORD_MAX_LENGTH = 128;

export const PROJECT_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;
export type ProjectStatus =
  (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];
export const PROJECT_STATUS_VALUES = Object.values(PROJECT_STATUS) as [
  ProjectStatus,
  ...ProjectStatus[],
];

// Jira-style key: starts with a letter, 2–10 uppercase letters/digits (e.g. "WEB", "MOB2")
export const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9]{1,9}$/;
export const PROJECT_LIMITS = {
  NAME_MIN: 3,
  NAME_MAX: 80,
  DESCRIPTION_MAX: 2000,
  MEMBERS_MAX: 100,
} as const;

// --- tasks -------------------------------------------------------------------

export const TASK_STATUS = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  DONE: "done",
} as const;
export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
export const TASK_STATUS_VALUES = Object.values(TASK_STATUS) as [
  TaskStatus,
  ...TaskStatus[],
];

export const TASK_PRIORITY = {
  LOWEST: "lowest",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  HIGHEST: "highest",
} as const;
export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];
export const TASK_PRIORITY_VALUES = Object.values(TASK_PRIORITY) as [
  TaskPriority,
  ...TaskPriority[],
];
// stored alongside the priority so "sort by priority" is a real order, not alphabetical
export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  lowest: 1,
  low: 2,
  medium: 3,
  high: 4,
  highest: 5,
};

export const TASK_TYPE = {
  TASK: "task",
  BUG: "bug",
  STORY: "story",
} as const;
export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];
export const TASK_TYPE_VALUES = Object.values(TASK_TYPE) as [
  TaskType,
  ...TaskType[],
];

// e.g. "WEB-12": project key + per-project sequence number
export const TASK_KEY_REGEX = /^([A-Z][A-Z0-9]{1,9})-([1-9]\d{0,8})$/;
export const TASK_LIMITS = {
  TITLE_MAX: 255,
  DESCRIPTION_MAX: 10000,
  LABELS_MAX: 10,
  LABEL_MAX: 30,
} as const;
// lowercase letters, digits, dash/underscore/dot; no spaces (Jira-style labels)
export const TASK_LABEL_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

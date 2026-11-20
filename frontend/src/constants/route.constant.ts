export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  DASHBOARD: "/dashboard",
  ADMIN: "/admin",
  PROJECTS: "/projects",
  PROJECT_SETTINGS: "/projects/:key/settings",
  PROJECT_TASKS: "/projects/:key/tasks",
  PROJECT_BOARD: "/projects/:key/board",
  BOARD: "/board",
  TASKS: "/tasks",
  TASK_DETAIL: "/browse/:taskKey",
} as const;

export const projectSettingsPath = (key: string) => `/projects/${encodeURIComponent(key)}/settings`;
export const projectTasksPath = (key: string) => `/projects/${encodeURIComponent(key)}/tasks`;
export const taskPath = (taskKey: string) => `/browse/${encodeURIComponent(taskKey)}`;
export const projectBoardPath = (key: string) => `/projects/${encodeURIComponent(key)}/board`;

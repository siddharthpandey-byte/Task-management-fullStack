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
} as const;

export const projectSettingsPath = (key: string) => `/projects/${encodeURIComponent(key)}/settings`;

// Relative to ENV.API_BASE_URL (/api/v1)
export const API_ENDPOINTS = {
  SYSTEM: {
    INFO: "/",
    HEALTH: "/health",
  },
  AUTH: {
    SIGNUP: "/auth/signup",
    LOGIN: "/auth/login",
    REFRESH: "/auth/refresh",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
  },
  USERS: {
    LIST: "/users",
  },
  PROJECTS: {
    LIST: "/projects",
    DETAIL: (key: string) => `/projects/${encodeURIComponent(key)}`,
    ARCHIVE: (key: string) => `/projects/${encodeURIComponent(key)}/archive`,
    RESTORE: (key: string) => `/projects/${encodeURIComponent(key)}/restore`,
  },
} as const;

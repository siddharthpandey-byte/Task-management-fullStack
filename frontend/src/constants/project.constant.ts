// Mirrors backend constants.ts (PROJECT_*)
export const PROJECT_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9]{1,9}$/;
export const PROJECT_KEY_MAX = 10;

export const PROJECT_LIMITS = {
  NAME_MIN: 3,
  NAME_MAX: 80,
  DESCRIPTION_MAX: 2000,
  MEMBERS_MAX: 100,
} as const;

export const PROJECT_PAGE_SIZE = 20;

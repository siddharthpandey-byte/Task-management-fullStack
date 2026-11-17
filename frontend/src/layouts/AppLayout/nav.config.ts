import type { IconName } from "../../components/ui/Icon";
import { ROLES } from "../../constants/auth.constant";
import { ROUTES } from "../../constants/route.constant";
import type { Role } from "../../types/auth.types";

export interface NavItem {
  label: string;
  icon: IconName;
  // items without a route are shown as "coming soon"
  to?: string;
  roles?: Role[];
  description?: string;
  keywords?: string;
}

export interface NavSection {
  title: string;
  roles?: Role[];
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Planning",
    items: [
      {
        label: "Dashboard",
        icon: "dashboard",
        to: ROUTES.DASHBOARD,
        description: "Your work at a glance",
        keywords: "home overview my work summary",
      },
      {
        label: "Projects",
        icon: "folder",
        to: ROUTES.PROJECTS,
        description: "Browse and manage projects",
        keywords: "projects create archive key lead members",
      },
      {
        label: "Tasks",
        icon: "task",
        to: ROUTES.TASKS,
        description: "Work items across your projects",
        keywords: "tasks issues work items assigned to me bugs stories due",
      },
      { label: "Board", icon: "board" },
      { label: "Backlog", icon: "backlog" },
      { label: "Timeline", icon: "timeline" },
    ],
  },
  {
    title: "Administration",
    roles: [ROLES.ADMIN],
    items: [
      {
        label: "Admin console",
        icon: "shield",
        to: ROUTES.ADMIN,
        roles: [ROLES.ADMIN],
        description: "System health and settings",
        keywords: "admin system status health api settings",
      },
    ],
  },
];

type HasRole = (...roles: Role[]) => boolean;

const allowed = (hasRole: HasRole, roles?: Role[]) => !roles || hasRole(...roles);

export function getVisibleSections(hasRole: HasRole): NavSection[] {
  return NAV_SECTIONS.filter((section) => allowed(hasRole, section.roles))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowed(hasRole, item.roles)),
    }))
    .filter((section) => section.items.length > 0);
}

// destinations the quick-search can jump to
export function getSearchableItems(hasRole: HasRole): (NavItem & { to: string })[] {
  return getVisibleSections(hasRole)
    .flatMap((section) => section.items)
    .filter((item): item is NavItem & { to: string } => Boolean(item.to));
}

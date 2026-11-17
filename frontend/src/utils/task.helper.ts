import type { User } from "../types/auth.types";
import type { Project } from "../types/project.types";
import type { Task } from "../types/task.types";

// due dates are calendar days stored at UTC midnight → read the day part, never shift by timezone
export const toDayString = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10) : "";

export function todayString(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type DueState = "overdue" | "today" | "upcoming";

// done work is never overdue
export function dueState(
  task: Pick<Task, "dueDate" | "status">,
  now = new Date()
): DueState | null {
  const day = toDayString(task.dueDate);
  if (!day || task.status === "done") return null;
  const today = todayString(now);
  if (day < today) return "overdue";
  if (day === today) return "today";
  return "upcoming";
}

export function formatDueDate(iso: string | null | undefined): string {
  const day = toDayString(iso);
  if (!day) return "—";
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}

export const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
};

// "Frontend, auth  ui" → ["frontend", "auth", "ui"]
export function parseLabels(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((label) => label.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

// UI hint only — the backend enforces it: admins, or people on an active project
export function canWorkOnProject(
  user: Pick<User, "id" | "role"> | null,
  project: Pick<Project, "status" | "members">
): boolean {
  if (!user || project.status === "archived") return false;
  if (user.role === "admin") return true;
  return project.members.some((m) => (typeof m === "string" ? m : m.id) === user.id);
}

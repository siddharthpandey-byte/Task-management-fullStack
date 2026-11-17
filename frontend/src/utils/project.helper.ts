import { PROJECT_KEY_MAX } from "../constants/project.constant";
import type { User } from "../types/auth.types";
import type { Person, Project } from "../types/project.types";

// Jira-style key suggestion:
// "Mobile Banking App" -> "MBA", "Website" -> "WEB", "3D Printing" -> "DP", "x" -> ""
export function suggestProjectKey(name: string): string {
  const words = name
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    // keys must start with a letter
    .map((word) => word.replace(/^[0-9]+/, ""))
    .filter(Boolean);
  if (words.length === 0) return "";

  const initials = words.map((word) => word[0]).join("");
  const key = initials.length >= 2 ? initials : words[0].slice(0, 3);
  return key.length >= 2 ? key.slice(0, PROJECT_KEY_MAX) : "";
}

// UI hint only — the backend enforces it (admins: all; managers: projects they lead)
export function canManageProject(user: User | null, project: Pick<Project, "lead">): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "manager" && project.lead.id === user.id;
}

export const isPerson = (value: Person | string): value is Person => typeof value !== "string";

const TILE_COLORS = ["blue", "purple", "teal", "green", "orange", "magenta"] as const;
export type TileColor = (typeof TILE_COLORS)[number];

// stable color per key so a project looks the same everywhere
export function projectColor(key: string): TileColor {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

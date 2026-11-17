import { PROJECT_PAGE_SIZE } from "../../constants/project.constant";
import type {
  ProjectListQuery,
  ProjectSort,
  ProjectStatusFilter,
  SortOrder,
} from "../../types/project.types";

const STATUSES: ProjectStatusFilter[] = ["active", "archived", "all"];
const SORTS: ProjectSort[] = ["name", "key", "createdAt", "updatedAt"];
const ORDERS: SortOrder[] = ["asc", "desc"];

export const DEFAULT_SORT: ProjectSort = "updatedAt";
export const DEFAULT_ORDER: SortOrder = "desc";

const pick = <T extends string>(value: string | null, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

// URL is the source of truth for the list view; anything malformed falls back to a default
export function readListParams(params: URLSearchParams): Required<
  Omit<ProjectListQuery, "search">
> & {
  search: string;
} {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    search: (params.get("q") ?? "").slice(0, 100),
    status: pick(params.get("status"), STATUSES, "active"),
    sort: pick(params.get("sort"), SORTS, DEFAULT_SORT),
    order: pick(params.get("order"), ORDERS, DEFAULT_ORDER),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PROJECT_PAGE_SIZE,
  };
}

// writes only non-default values so URLs stay short and shareable
export function writeListParams(
  current: URLSearchParams,
  changes: Partial<Record<"q" | "status" | "sort" | "order" | "page", string | number | undefined>>
): URLSearchParams {
  const next = new URLSearchParams(current);
  const defaults: Record<string, string> = {
    q: "",
    status: "active",
    sort: DEFAULT_SORT,
    order: DEFAULT_ORDER,
    page: "1",
  };
  for (const [name, raw] of Object.entries(changes)) {
    const value = raw === undefined ? "" : String(raw);
    if (!value || value === defaults[name]) next.delete(name);
    else next.set(name, value);
  }
  return next;
}

import type { PROJECT_STATUS } from "../constants/project.constant";
import type { Role } from "./auth.types";

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];
export type ProjectStatusFilter = ProjectStatus | "all";
export type ProjectSort = "name" | "key" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

// populated user reference (backend selects only these fields)
export interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

// Mirrors backend Project.toJSON. List responses populate only `lead`.
export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  lead: Person;
  members: (Person | string)[];
  status: ProjectStatus;
  createdBy: string;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  members: Person[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProjectListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatusFilter;
  sort?: ProjectSort;
  order?: SortOrder;
}

export interface ProjectListResult {
  projects: Project[];
  pagination: Pagination;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  leadId?: string;
  memberIds?: string[];
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "key">>;

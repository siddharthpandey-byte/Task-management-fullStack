import { projectService } from "../api/services/project.service";
import type { ProjectDetail, ProjectListQuery, ProjectListResult } from "../types/project.types";
import { useRemote } from "./useRemote";

export function useProjects(query: ProjectListQuery) {
  const { page, limit, search, status, sort, order } = query;
  return useRemote<ProjectListResult>(
    (signal) => projectService.list({ page, limit, search, status, sort, order }, signal),
    [page, limit, search, status, sort, order]
  );
}

// key "" → nothing is loaded
export function useProject(key: string) {
  return useRemote<ProjectDetail>((signal) => projectService.get(key, signal), [key], key !== "");
}

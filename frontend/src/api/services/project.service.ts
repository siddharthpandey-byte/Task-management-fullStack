import type { ApiResponse } from "../../types/api.types";
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectListQuery,
  ProjectListResult,
  UpdateProjectInput,
} from "../../types/project.types";
import { API_ENDPOINTS } from "../api.endpoints";
import axiosInstance from "../axios.instance";

type ProjectPayload = ApiResponse<{ project: ProjectDetail }>;

export const projectService = {
  async list(query: ProjectListQuery, signal?: AbortSignal): Promise<ProjectListResult> {
    const { data } = await axiosInstance.get<ApiResponse<ProjectListResult>>(
      API_ENDPOINTS.PROJECTS.LIST,
      { params: query, signal }
    );
    return data.data;
  },

  async get(key: string, signal?: AbortSignal): Promise<ProjectDetail> {
    const { data } = await axiosInstance.get<ProjectPayload>(API_ENDPOINTS.PROJECTS.DETAIL(key), {
      signal,
    });
    return data.data.project;
  },

  async create(input: CreateProjectInput): Promise<ProjectDetail> {
    const { data } = await axiosInstance.post<ProjectPayload>(API_ENDPOINTS.PROJECTS.LIST, input);
    return data.data.project;
  },

  async update(key: string, input: UpdateProjectInput): Promise<ProjectDetail> {
    const { data } = await axiosInstance.patch<ProjectPayload>(
      API_ENDPOINTS.PROJECTS.DETAIL(key),
      input
    );
    return data.data.project;
  },

  async archive(key: string): Promise<ProjectDetail> {
    const { data } = await axiosInstance.post<ProjectPayload>(API_ENDPOINTS.PROJECTS.ARCHIVE(key));
    return data.data.project;
  },

  async restore(key: string): Promise<ProjectDetail> {
    const { data } = await axiosInstance.post<ProjectPayload>(API_ENDPOINTS.PROJECTS.RESTORE(key));
    return data.data.project;
  },
};

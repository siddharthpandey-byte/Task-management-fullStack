import type { ApiResponse } from "../../types/api.types";
import type {
  CreateTaskInput,
  Task,
  TaskListQuery,
  TaskListResult,
  UpdateTaskInput,
} from "../../types/task.types";
import { API_ENDPOINTS } from "../api.endpoints";
import axiosInstance from "../axios.instance";

type TaskPayload = ApiResponse<{ task: Task }>;

const csv = (list?: string[]) => (list && list.length > 0 ? list.join(",") : undefined);

// the API takes multi-value filters as "a,b"; empty values are left out entirely
export function toTaskParams(query: TaskListQuery) {
  return {
    page: query.page,
    limit: query.limit,
    search: query.search || undefined,
    project: query.project || undefined,
    status: csv(query.status),
    priority: csv(query.priority),
    type: csv(query.type),
    assignee: query.assignee || undefined,
    due: query.due || undefined,
    sort: query.sort,
    order: query.order,
  };
}

export const taskService = {
  // projectKey → one project's tasks; otherwise every task the user can see
  async list(
    query: TaskListQuery,
    projectKey?: string,
    signal?: AbortSignal
  ): Promise<TaskListResult> {
    const url = projectKey ? API_ENDPOINTS.PROJECTS.TASKS(projectKey) : API_ENDPOINTS.TASKS.LIST;
    const params = toTaskParams(projectKey ? { ...query, project: undefined } : query);
    const { data } = await axiosInstance.get<ApiResponse<TaskListResult>>(url, { params, signal });
    return data.data;
  },

  async get(taskKey: string, signal?: AbortSignal): Promise<Task> {
    const { data } = await axiosInstance.get<TaskPayload>(API_ENDPOINTS.TASKS.DETAIL(taskKey), {
      signal,
    });
    return data.data.task;
  },

  async create(projectKey: string, input: CreateTaskInput): Promise<Task> {
    const { data } = await axiosInstance.post<TaskPayload>(
      API_ENDPOINTS.PROJECTS.TASKS(projectKey),
      input
    );
    return data.data.task;
  },

  async update(taskKey: string, input: UpdateTaskInput): Promise<Task> {
    const { data } = await axiosInstance.patch<TaskPayload>(
      API_ENDPOINTS.TASKS.DETAIL(taskKey),
      input
    );
    return data.data.task;
  },

  async remove(taskKey: string): Promise<void> {
    await axiosInstance.delete(API_ENDPOINTS.TASKS.DETAIL(taskKey));
  },
};

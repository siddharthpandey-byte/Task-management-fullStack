import type { ApiResponse } from "../../types/api.types";
import type { User } from "../../types/auth.types";
import type { Pagination } from "../../types/project.types";
import { API_ENDPOINTS } from "../api.endpoints";
import axiosInstance from "../axios.instance";

interface UserListResult {
  users: User[];
  pagination: Pagination;
}

// admin/manager only on the backend
export const userService = {
  async searchActive(search: string, signal?: AbortSignal): Promise<User[]> {
    const { data } = await axiosInstance.get<ApiResponse<UserListResult>>(
      API_ENDPOINTS.USERS.LIST,
      {
        params: { search: search || undefined, isActive: true, limit: 20 },
        signal,
      }
    );
    return data.data.users;
  },
};

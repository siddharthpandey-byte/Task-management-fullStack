import type { ApiResponse } from "../../types/api.types";
import type { DashboardData } from "../../types/dashboard.types";
import { API_ENDPOINTS } from "../api.endpoints";
import axiosInstance from "../axios.instance";

export const dashboardService = {
  async get(signal?: AbortSignal): Promise<DashboardData> {
    const { data } = await axiosInstance.get<ApiResponse<DashboardData>>(API_ENDPOINTS.DASHBOARD, {
      signal,
    });
    return data.data;
  },
};

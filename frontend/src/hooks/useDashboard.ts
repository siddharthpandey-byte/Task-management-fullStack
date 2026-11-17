import { dashboardService } from "../api/services/dashboard.service";
import type { DashboardData } from "../types/dashboard.types";
import { useRemote } from "./useRemote";

export function useDashboard() {
  return useRemote<DashboardData>((signal) => dashboardService.get(signal), []);
}

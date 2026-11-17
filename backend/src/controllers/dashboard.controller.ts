import type { Request, Response } from "express";
import { getDashboard } from "../services/dashboard.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export async function dashboard(req: Request, res: Response) {
  const data = await getDashboard(req.user!);
  res.status(200).json(new ApiResponse(200, data));
}

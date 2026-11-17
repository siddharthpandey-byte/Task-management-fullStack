import type { Request, Response } from "express";
import * as taskService from "../services/task.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { projectKeyParamSchema } from "../validators/project.validator.js";
import {
  listTasksQuerySchema,
  taskKeyParamSchema,
} from "../validators/task.validator.js";

// reject malformed keys before they reach the database
function getTaskKey(req: Request): string {
  const parsed = taskKeyParamSchema.safeParse(req.params.taskKey);
  if (!parsed.success) throw new ApiError(404, "Task not found");
  return parsed.data;
}

function getProjectKey(req: Request): string {
  const parsed = projectKeyParamSchema.safeParse(req.params.key);
  if (!parsed.success) throw new ApiError(404, "Project not found");
  return parsed.data;
}

function parseListQuery(req: Request) {
  const parsed = listTasksQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, "Invalid query parameters");
  return parsed.data;
}

// GET /tasks — across every project the user can see
export async function listTasks(req: Request, res: Response) {
  const result = await taskService.listTasks(req.user!, parseListQuery(req));
  res.status(200).json(new ApiResponse(200, result));
}

// GET /projects/:key/tasks
export async function listProjectTasks(req: Request, res: Response) {
  const query = parseListQuery(req);
  const result = await taskService.listTasks(
    req.user!,
    { ...query, project: undefined },
    getProjectKey(req)
  );
  res.status(200).json(new ApiResponse(200, result));
}

// POST /projects/:key/tasks
export async function createTask(req: Request, res: Response) {
  const task = await taskService.createTask(
    req.user!,
    getProjectKey(req),
    req.body
  );
  res.status(201).json(new ApiResponse(201, { task }, "Task created"));
}

export async function getTask(req: Request, res: Response) {
  const task = await taskService.getTask(req.user!, getTaskKey(req));
  res.status(200).json(new ApiResponse(200, { task }));
}

export async function updateTask(req: Request, res: Response) {
  const task = await taskService.updateTask(
    req.user!,
    getTaskKey(req),
    req.body
  );
  res.status(200).json(new ApiResponse(200, { task }, "Task updated"));
}

export async function deleteTask(req: Request, res: Response) {
  await taskService.deleteTask(req.user!, getTaskKey(req));
  res.status(200).json(new ApiResponse(200, null, "Task deleted"));
}

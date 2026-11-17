import type { Request, Response } from "express";
import * as projectService from "../services/project.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  listProjectsQuerySchema,
  projectKeyParamSchema,
} from "../validators/project.validator.js";

// reject malformed keys before they reach the database
function getKey(req: Request): string {
  const parsed = projectKeyParamSchema.safeParse(req.params.key);
  if (!parsed.success) throw new ApiError(404, "Project not found");
  return parsed.data;
}

export async function listProjects(req: Request, res: Response) {
  const parsed = listProjectsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, "Invalid query parameters");
  const result = await projectService.listProjects(req.user!, parsed.data);
  res.status(200).json(new ApiResponse(200, result));
}

export async function createProject(req: Request, res: Response) {
  const project = await projectService.createProject(req.user!, req.body);
  res.status(201).json(new ApiResponse(201, { project }, "Project created"));
}

export async function getProject(req: Request, res: Response) {
  const project = await projectService.findVisibleProject(
    req.user!,
    getKey(req)
  );
  await projectService.populate(project);
  res.status(200).json(new ApiResponse(200, { project }));
}

export async function updateProject(req: Request, res: Response) {
  const project = await projectService.updateProject(
    req.user!,
    getKey(req),
    req.body
  );
  res.status(200).json(new ApiResponse(200, { project }, "Project updated"));
}

export async function archiveProject(req: Request, res: Response) {
  const project = await projectService.setArchived(
    req.user!,
    getKey(req),
    true
  );
  res.status(200).json(new ApiResponse(200, { project }, "Project archived"));
}

export async function restoreProject(req: Request, res: Response) {
  const project = await projectService.setArchived(
    req.user!,
    getKey(req),
    false
  );
  res.status(200).json(new ApiResponse(200, { project }, "Project restored"));
}

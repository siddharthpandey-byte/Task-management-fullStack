import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { UserModel } from "../models/user.model.js";
import { revokeAllSessions } from "../services/auth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { escapeRegex } from "../utils/regex.js";
import { listUsersQuerySchema } from "../validators/user.validator.js";

function getTargetId(req: Request): string {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw new ApiError(400, "Invalid user id");
  if (id === req.user!.id) {
    throw new ApiError(400, "You can't change your own role or status");
  }
  return id;
}

export async function listUsers(req: Request, res: Response) {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, "Invalid query parameters");
  const { page, limit, search, isActive } = parsed.data;

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: escapeRegex(search), $options: "i" } },
      { email: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }
  if (isActive !== undefined) filter.isActive = isActive;

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    UserModel.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  );
}

export async function updateUserRole(req: Request, res: Response) {
  const user = await UserModel.findByIdAndUpdate(
    getTargetId(req),
    { role: req.body.role },
    { returnDocument: "after", runValidators: true }
  );
  if (!user) throw new ApiError(404, "User not found");
  res.status(200).json(new ApiResponse(200, { user }, "Role updated"));
}

export async function updateUserStatus(req: Request, res: Response) {
  const user = await UserModel.findByIdAndUpdate(
    getTargetId(req),
    { isActive: req.body.isActive },
    { returnDocument: "after", runValidators: true }
  );
  if (!user) throw new ApiError(404, "User not found");
  if (!user.isActive) await revokeAllSessions(user._id);
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user },
        user.isActive ? "User activated" : "User deactivated"
      )
    );
}

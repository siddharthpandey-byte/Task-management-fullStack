import { z } from "zod";
import { ROLE_VALUES } from "../constants.js";

export const updateRoleSchema = z.strictObject({
  role: z.enum(ROLE_VALUES, {
    error: `Role must be one of: ${ROLE_VALUES.join(", ")}`,
  }),
});

export const updateStatusSchema = z.strictObject({
  isActive: z.boolean({ error: "isActive must be a boolean" }),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  // query strings are text, so only accept the literal "true" / "false"
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

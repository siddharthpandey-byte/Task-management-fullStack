import { z } from "zod";
import { PROJECT_KEY_REGEX, PROJECT_LIMITS } from "../constants.js";
import { limitSchema, objectId, orderSchema, pageSchema } from "./common.js";

const name = z
  .string({ error: "Project name is required" })
  .trim()
  .min(
    PROJECT_LIMITS.NAME_MIN,
    `Project name must be at least ${PROJECT_LIMITS.NAME_MIN} characters`
  )
  .max(
    PROJECT_LIMITS.NAME_MAX,
    `Project name must be at most ${PROJECT_LIMITS.NAME_MAX} characters`
  );

const key = z
  .string({ error: "Project key is required" })
  .trim()
  .toUpperCase()
  .regex(
    PROJECT_KEY_REGEX,
    "Key must be 2–10 characters: letters and numbers, starting with a letter"
  );

const description = z
  .string({ error: "Description must be text" })
  .trim()
  .max(
    PROJECT_LIMITS.DESCRIPTION_MAX,
    `Description must be at most ${PROJECT_LIMITS.DESCRIPTION_MAX} characters`
  );

const leadId = objectId("Project lead");

const memberIds = z
  .array(objectId("Member"), { error: "Members must be a list" })
  .max(
    PROJECT_LIMITS.MEMBERS_MAX,
    `A project can have at most ${PROJECT_LIMITS.MEMBERS_MAX} members`
  )
  .transform((ids) => [...new Set(ids)]);

// strictObject: status, createdBy, archivedAt etc. can never be mass-assigned
export const createProjectSchema = z.strictObject({
  name,
  key,
  description: description.optional(),
  leadId: leadId.optional(),
  memberIds: memberIds.optional(),
});

// the key is immutable, so it isn't accepted here (strict → "Unrecognized key")
export const updateProjectSchema = z
  .strictObject({
    name: name.optional(),
    description: description.optional(),
    leadId: leadId.optional(),
    memberIds: memberIds.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

export const listProjectsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sort: z.enum(["name", "key", "createdAt", "updatedAt"]).default("updatedAt"),
  order: orderSchema.default("desc"),
});

export const projectKeyParamSchema = z
  .string()
  .toUpperCase()
  .regex(PROJECT_KEY_REGEX);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

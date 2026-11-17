import { z } from "zod";
import {
  PROJECT_KEY_REGEX,
  TASK_KEY_REGEX,
  TASK_LABEL_REGEX,
  TASK_LIMITS,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  TASK_TYPE_VALUES,
} from "../constants.js";
import {
  csvEnum,
  limitSchema,
  objectId,
  orderSchema,
  pageSchema,
} from "./common.js";

const title = z
  .string({ error: "Summary is required" })
  .trim()
  .min(1, "Summary is required")
  .max(
    TASK_LIMITS.TITLE_MAX,
    `Summary must be at most ${TASK_LIMITS.TITLE_MAX} characters`
  );

const description = z
  .string({ error: "Description must be text" })
  .trim()
  .max(
    TASK_LIMITS.DESCRIPTION_MAX,
    `Description must be at most ${TASK_LIMITS.DESCRIPTION_MAX} characters`
  );

const type = z.enum(TASK_TYPE_VALUES, {
  error: `Type must be one of: ${TASK_TYPE_VALUES.join(", ")}`,
});
const status = z.enum(TASK_STATUS_VALUES, {
  error: `Status must be one of: ${TASK_STATUS_VALUES.join(", ")}`,
});
const priority = z.enum(TASK_PRIORITY_VALUES, {
  error: `Priority must be one of: ${TASK_PRIORITY_VALUES.join(", ")}`,
});

// null clears the assignee
const assigneeId = objectId("Assignee").nullable();

// a calendar day ("2026-12-31") stored as UTC midnight; null clears it
const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const dueDate = z
  .string({ error: "Due date must be a date (YYYY-MM-DD)" })
  .regex(DAY_REGEX, "Due date must be a date (YYYY-MM-DD)")
  .transform((value, ctx) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    // reject impossible days like 2026-02-30 (Date would roll them over)
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      ctx.addIssue({ code: "custom", message: "Due date is not a valid date" });
      return z.NEVER;
    }
    return date;
  })
  .nullable();

const labels = z
  .array(
    z
      .string({ error: "Labels must be text" })
      .trim()
      .toLowerCase()
      .min(1, "Labels can't be empty")
      .max(
        TASK_LIMITS.LABEL_MAX,
        `Labels must be at most ${TASK_LIMITS.LABEL_MAX} characters`
      )
      .regex(
        TASK_LABEL_REGEX,
        "Labels can contain letters, numbers, dots, dashes and underscores (no spaces)"
      ),
    { error: "Labels must be a list" }
  )
  .max(
    TASK_LIMITS.LABELS_MAX,
    `A task can have at most ${TASK_LIMITS.LABELS_MAX} labels`
  )
  .transform((list) => [...new Set(list)]);

// strictObject: project, key, number, reporter, completedAt can never be mass-assigned
export const createTaskSchema = z.strictObject({
  title,
  description: description.optional(),
  type: type.optional(),
  status: status.optional(),
  priority: priority.optional(),
  assigneeId: assigneeId.optional(),
  dueDate: dueDate.optional(),
  labels: labels.optional(),
});

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    type: type.optional(),
    status: status.optional(),
    priority: priority.optional(),
    assigneeId: assigneeId.optional(),
    dueDate: dueDate.optional(),
    labels: labels.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

export const TASK_SORTS = [
  "updatedAt",
  "createdAt",
  "dueDate",
  "priority",
  "key",
  "title",
] as const;

export const listTasksQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: z.string().trim().max(100).optional(),
  // global list only: narrow to one project
  project: z.string().trim().toUpperCase().regex(PROJECT_KEY_REGEX).optional(),
  status: csvEnum(TASK_STATUS_VALUES).optional(),
  priority: csvEnum(TASK_PRIORITY_VALUES).optional(),
  type: csvEnum(TASK_TYPE_VALUES).optional(),
  assignee: z
    .union([z.enum(["me", "unassigned"]), objectId("Assignee")])
    .optional(),
  due: z.enum(["overdue", "week", "none"]).optional(),
  sort: z.enum(TASK_SORTS).default("updatedAt"),
  order: orderSchema.default("desc"),
});

export const taskKeyParamSchema = z
  .string()
  .toUpperCase()
  .regex(TASK_KEY_REGEX);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

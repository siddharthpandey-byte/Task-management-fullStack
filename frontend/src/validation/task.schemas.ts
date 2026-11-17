import { z } from "zod";
import {
  TASK_LABEL_REGEX,
  TASK_LIMITS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "../constants/task.constant";
import type { Person } from "../types/project.types";

// Same rules as backend validators/task.validator.ts; the backend remains the authority.
const title = z
  .string()
  .trim()
  .min(1, "Summary is required")
  .max(TASK_LIMITS.TITLE_MAX, `Summary must be at most ${TASK_LIMITS.TITLE_MAX} characters`);

const description = z
  .string()
  .trim()
  .max(
    TASK_LIMITS.DESCRIPTION_MAX,
    `Description must be at most ${TASK_LIMITS.DESCRIPTION_MAX} characters`
  );

const person = z.custom<Person>(
  (value) => !!value && typeof value === "object" && typeof (value as Person).id === "string"
);

// "" = no due date; otherwise a real calendar day
const dueDate = z.string().refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date");

export const labelSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Labels can't be empty")
  .max(TASK_LIMITS.LABEL_MAX, `Labels must be at most ${TASK_LIMITS.LABEL_MAX} characters`)
  .regex(TASK_LABEL_REGEX, "Use letters, numbers, dots, dashes or underscores");

const labels = z
  .array(labelSchema)
  .max(TASK_LIMITS.LABELS_MAX, `A task can have at most ${TASK_LIMITS.LABELS_MAX} labels`);

export const taskFormSchema = z.object({
  // only used when creating from the cross-project list
  projectKey: z.string().min(1, "Choose a project"),
  title,
  description,
  type: z.enum(TASK_TYPES),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assignee: person.nullable(),
  dueDate,
  labels,
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

import type { FieldNamesMarkedBoolean } from "react-hook-form";
import { HttpError, toHttpError } from "../../api/api.helper";
import type { CreateTaskInput, Task, UpdateTaskInput } from "../../types/task.types";
import { toDayString } from "../../utils/task.helper";
import type { TaskFormValues } from "../../validation/task.schemas";

export const TASK_FORM_FIELDS = [
  "projectKey",
  "title",
  "description",
  "type",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "labels",
] as const;

// API field names → form field names ("labels.2" → "labels")
const aliasField = (field: string) => {
  if (field === "assigneeId") return "assignee";
  if (field.startsWith("labels.")) return "labels";
  return field;
};

export function toTaskFormError(error: unknown): HttpError {
  const httpError = toHttpError(error);
  return new HttpError(
    httpError.status,
    httpError.message,
    httpError.errors.map((e) => ({ ...e, field: aliasField(e.field) }))
  );
}

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    projectKey: task.project.key,
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    dueDate: toDayString(task.dueDate),
    labels: task.labels,
  };
}

export function toCreateInput(values: TaskFormValues): CreateTaskInput {
  return {
    title: values.title,
    description: values.description || undefined,
    type: values.type,
    status: values.status,
    priority: values.priority,
    assigneeId: values.assignee?.id ?? null,
    dueDate: values.dueDate || null,
    labels: values.labels,
  };
}

// PATCH only what the user actually changed
export function toUpdateInput(
  values: TaskFormValues,
  dirty: Partial<FieldNamesMarkedBoolean<TaskFormValues>>
): UpdateTaskInput {
  const full = toCreateInput(values);
  const input: UpdateTaskInput = {};
  if (dirty.title) input.title = full.title;
  if (dirty.description) input.description = values.description;
  if (dirty.type) input.type = full.type;
  if (dirty.status) input.status = full.status;
  if (dirty.priority) input.priority = full.priority;
  if (dirty.assignee) input.assigneeId = full.assigneeId;
  if (dirty.dueDate) input.dueDate = full.dueDate;
  if (dirty.labels) input.labels = full.labels;
  return input;
}

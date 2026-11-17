import { describe, expect, it } from "vitest";
import { HttpError } from "../../api/api.helper";
import { taskFormSchema } from "../../validation/task.schemas";
import { toCreateInput, toTaskFormError, toUpdateInput } from "./task.form";

const VALUES = {
  projectKey: "WEB",
  title: "Build login",
  description: "",
  type: "task" as const,
  status: "todo" as const,
  priority: "medium" as const,
  assignee: null,
  dueDate: "",
  labels: [],
};

describe("task form", () => {
  it("validates like the API", () => {
    expect(taskFormSchema.safeParse(VALUES).success).toBe(true);
    const bad = taskFormSchema.safeParse({
      ...VALUES,
      title: "  ",
      dueDate: "2026-02-30",
      labels: ["has space"],
      projectKey: "",
    });
    expect(bad.success).toBe(false);
    const fields = bad.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["title", "dueDate", "labels", "projectKey"]));
  });

  it("maps form values to the create payload", () => {
    expect(toCreateInput({ ...VALUES, dueDate: "2026-12-01" })).toEqual({
      title: "Build login",
      description: undefined,
      type: "task",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      dueDate: "2026-12-01",
      labels: [],
    });
  });

  it("sends only dirty fields on update, with null to clear", () => {
    expect(
      toUpdateInput(
        { ...VALUES, priority: "high", dueDate: "", assignee: null },
        { priority: true, dueDate: true, assignee: true }
      )
    ).toEqual({ priority: "high", dueDate: null, assigneeId: null });
  });

  it("maps API field names to form fields", () => {
    const error = toTaskFormError(
      new HttpError(400, "Bad", [
        { field: "assigneeId", message: "Assignee must be a member" },
        { field: "labels.1", message: "Bad label" },
      ])
    );
    expect(error.errors.map((e) => e.field)).toEqual(["assignee", "labels"]);
  });
});

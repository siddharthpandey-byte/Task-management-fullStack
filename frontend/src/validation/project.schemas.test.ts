import { describe, expect, it } from "vitest";
import { createProjectSchema } from "./project.schemas";

const lead = { id: "u1", name: "Ada", email: "a@x.io", role: "manager", isActive: true } as const;
const valid = { name: "Website", key: "web", description: "", lead, members: [] };

const firstError = (input: unknown) => {
  const result = createProjectSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0];
};

describe("createProjectSchema", () => {
  it("accepts valid input and uppercases the key", () => {
    const result = createProjectSchema.parse({ ...valid, name: "  Website  " });
    expect(result).toMatchObject({ name: "Website", key: "WEB" });
  });

  it.each([
    [{ name: "" }, "name", "Project name is required"],
    [{ name: "ab" }, "name", "Project name must be at least 3 characters"],
    [{ key: "" }, "key", "Project key is required"],
    [{ key: "1AB" }, "key", undefined],
    [{ key: "A" }, "key", undefined],
    [{ key: "ABCDEFGHIJK" }, "key", undefined],
    [{ lead: null }, "lead", "Choose a project lead"],
    [{ description: "x".repeat(2001) }, "description", undefined],
  ])("rejects %j", (override, field, message) => {
    const issue = firstError({ ...valid, ...override });
    expect(issue?.path).toEqual([field]);
    if (message) expect(issue?.message).toBe(message);
  });
});

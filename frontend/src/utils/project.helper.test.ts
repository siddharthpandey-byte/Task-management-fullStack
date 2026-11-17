import { describe, expect, it } from "vitest";
import { makeUser } from "../test/auth.test-utils";
import type { Person } from "../types/project.types";
import { canManageProject, projectColor, suggestProjectKey } from "./project.helper";

const person = (id: string): Person => ({
  id,
  name: "Lead",
  email: "lead@example.com",
  role: "manager",
  isActive: true,
});

describe("suggestProjectKey", () => {
  it.each([
    ["Mobile Banking App", "MBA"],
    ["Website", "WEB"],
    ["  website   revamp ", "WR"],
    ["3D Printing", "DP"],
    ["Café Ops", "CO"],
    ["a", ""],
    ["", ""],
    ["!!!", ""],
    ["one two three four five six seven eight nine ten eleven", "OTTFFSSENT"],
  ])("%j -> %j", (name, key) => {
    expect(suggestProjectKey(name)).toBe(key);
  });

  it("always produces a valid key or nothing", () => {
    for (const name of ["9 Lives", "x y", "API v2 Gateway", "Ω Project"]) {
      const key = suggestProjectKey(name);
      if (key) expect(key).toMatch(/^[A-Z][A-Z0-9]{1,9}$/);
    }
  });
});

describe("canManageProject", () => {
  const project = { lead: person("lead-1") };

  it("allows admins on any project", () => {
    expect(canManageProject(makeUser({ role: "admin" }), project)).toBe(true);
  });

  it("allows managers only on projects they lead", () => {
    expect(canManageProject(makeUser({ id: "lead-1", role: "manager" }), project)).toBe(true);
    expect(canManageProject(makeUser({ id: "other", role: "manager" }), project)).toBe(false);
  });

  it("never allows members or signed-out users", () => {
    expect(canManageProject(makeUser({ id: "lead-1", role: "member" }), project)).toBe(false);
    expect(canManageProject(null, project)).toBe(false);
  });
});

it("projectColor is stable per key", () => {
  expect(projectColor("WEB")).toBe(projectColor("WEB"));
});

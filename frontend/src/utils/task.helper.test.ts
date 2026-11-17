import { describe, expect, it } from "vitest";
import {
  canWorkOnProject,
  dueState,
  formatDueDate,
  parseLabels,
  todayString,
  toDayString,
} from "./task.helper";

const NOW = new Date(2026, 10, 17, 15, 0); // 17 Nov 2026, local time

describe("task.helper", () => {
  it("reads due dates as calendar days without timezone drift", () => {
    expect(toDayString("2026-11-17T00:00:00.000Z")).toBe("2026-11-17");
    expect(toDayString(null)).toBe("");
    expect(todayString(NOW)).toBe("2026-11-17");
    expect(formatDueDate("2026-01-05T00:00:00.000Z")).toMatch(/5/);
    expect(formatDueDate(null)).toBe("—");
  });

  it("works out the due state and never flags done work", () => {
    const at = (dueDate: string | null, status: "todo" | "done" = "todo") =>
      dueState({ dueDate, status }, NOW);
    expect(at("2026-11-16T00:00:00.000Z")).toBe("overdue");
    expect(at("2026-11-17T00:00:00.000Z")).toBe("today");
    expect(at("2026-11-18T00:00:00.000Z")).toBe("upcoming");
    expect(at("2026-11-16T00:00:00.000Z", "done")).toBeNull();
    expect(at(null)).toBeNull();
  });

  it("parses label input", () => {
    expect(parseLabels(" Frontend, auth  ui,auth ")).toEqual(["frontend", "auth", "ui"]);
    expect(parseLabels(" , ")).toEqual([]);
  });

  it("lets admins and project members work on active projects only", () => {
    const project = { status: "active" as const, members: ["u1", { id: "u2" } as never] };
    expect(canWorkOnProject({ id: "u1", role: "member" }, project)).toBe(true);
    expect(canWorkOnProject({ id: "u2", role: "member" }, project)).toBe(true);
    expect(canWorkOnProject({ id: "u3", role: "manager" }, project)).toBe(false);
    expect(canWorkOnProject({ id: "u3", role: "admin" }, project)).toBe(true);
    expect(canWorkOnProject({ id: "u1", role: "admin" }, { ...project, status: "archived" })).toBe(
      false
    );
    expect(canWorkOnProject(null, project)).toBe(false);
  });
});

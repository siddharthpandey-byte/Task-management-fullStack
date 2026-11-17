import { describe, expect, it } from "vitest";
import { activeFilterCount, readTaskParams, writeTaskParams } from "./tasks.params";

describe("task list URL params", () => {
  it("reads valid values and drops malformed ones", () => {
    const query = readTaskParams(
      new URLSearchParams(
        "q=login&status=todo,bogus,done&priority=high&type=bug&assignee=me&due=overdue&project=web&sort=priority&order=asc&page=3"
      )
    );
    expect(query).toMatchObject({
      search: "login",
      status: ["todo", "done"],
      priority: ["high"],
      type: ["bug"],
      assignee: "me",
      due: "overdue",
      project: "WEB",
      sort: "priority",
      order: "asc",
      page: 3,
    });
  });

  it("falls back to defaults", () => {
    const query = readTaskParams(
      new URLSearchParams("assignee=someone&due=later&sort=password&order=up&page=-2&project=1x")
    );
    expect(query).toMatchObject({
      assignee: "",
      due: "",
      sort: "updatedAt",
      order: "desc",
      page: 1,
      project: "",
      status: [],
    });
  });

  it("writes only non-default values", () => {
    const next = writeTaskParams(new URLSearchParams("q=old&page=4"), {
      q: "",
      status: ["todo", "in_progress"],
      sort: "updatedAt",
      page: 1,
    });
    expect(next.toString()).toBe("status=todo%2Cin_progress");
  });

  it("counts active filters", () => {
    const query = readTaskParams(new URLSearchParams("status=todo&due=week&project=WEB&sort=key"));
    expect(activeFilterCount(query, true)).toBe(3);
    expect(activeFilterCount(query, false)).toBe(2);
  });
});

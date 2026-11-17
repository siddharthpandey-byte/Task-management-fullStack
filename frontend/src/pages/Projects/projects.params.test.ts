import { describe, expect, it } from "vitest";
import { readListParams, writeListParams } from "./projects.params";

describe("project list URL params", () => {
  it("falls back to defaults for missing or malformed values", () => {
    expect(
      readListParams(new URLSearchParams("status=deleted&sort=$where&order=up&page=-3"))
    ).toMatchObject({ search: "", status: "active", sort: "updatedAt", order: "desc", page: 1 });
  });

  it("reads valid values", () => {
    expect(
      readListParams(new URLSearchParams("q=web&status=archived&sort=name&order=asc&page=2"))
    ).toMatchObject({ search: "web", status: "archived", sort: "name", order: "asc", page: 2 });
  });

  it("omits defaults when writing", () => {
    const next = writeListParams(new URLSearchParams("q=web&page=3"), {
      q: "",
      page: 1,
      status: "archived",
    });
    expect(next.toString()).toBe("status=archived");
  });
});

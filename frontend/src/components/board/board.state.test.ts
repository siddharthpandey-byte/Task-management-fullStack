import { describe, expect, it } from "vitest";
import type { BoardColumn, Task, TaskStatus } from "../../types/task.types";
import {
  columnId,
  findCard,
  moveCard,
  neighboursAt,
  placementChanged,
  replaceTask,
  statusFromColumnId,
} from "./board.state";

const task = (key: string, status: TaskStatus) => ({ key, status, title: key }) as Task;

// todo: A B C · in_progress: D · in_review: (empty) · done: E
const board = (): BoardColumn[] => [
  {
    status: "todo",
    total: 3,
    tasks: [task("A-1", "todo"), task("A-2", "todo"), task("A-3", "todo")],
  },
  { status: "in_progress", total: 1, tasks: [task("A-4", "in_progress")] },
  { status: "in_review", total: 0, tasks: [] },
  { status: "done", total: 1, tasks: [task("A-5", "done")] },
];

const keys = (columns: BoardColumn[]) =>
  Object.fromEntries(columns.map((c) => [c.status, c.tasks.map((t) => t.key)]));

describe("moveCard", () => {
  it("reorders within a column without touching totals", () => {
    const next = moveCard(board(), "A-3", "todo", 0);
    expect(keys(next).todo).toEqual(["A-3", "A-1", "A-2"]);
    expect(next[0].total).toBe(3);
    expect(neighboursAt(next, "A-3")).toEqual({
      status: "todo",
      index: 0,
      afterKey: null,
      beforeKey: "A-1",
    });
  });

  it("moves across columns, updating status and both totals", () => {
    const next = moveCard(board(), "A-2", "in_progress", 1);
    expect(keys(next).todo).toEqual(["A-1", "A-3"]);
    expect(keys(next).in_progress).toEqual(["A-4", "A-2"]);
    expect(next[0].total).toBe(2);
    expect(next[1].total).toBe(2);
    expect(next[1].tasks[1].status).toBe("in_progress");
    expect(neighboursAt(next, "A-2")).toMatchObject({ afterKey: "A-4", beforeKey: null });
  });

  it("drops into an empty column", () => {
    const next = moveCard(board(), "A-1", "in_review", 0);
    expect(keys(next).in_review).toEqual(["A-1"]);
    expect(neighboursAt(next, "A-1")).toMatchObject({ afterKey: null, beforeKey: null });
  });

  it("clamps the index and leaves the board untouched for a no-op or unknown card", () => {
    const start = board();
    expect(keys(moveCard(start, "A-1", "todo", 99)).todo).toEqual(["A-2", "A-3", "A-1"]);
    expect(moveCard(start, "A-2", "todo", 1)).toBe(start);
    expect(moveCard(start, "NOPE-1", "done", 0)).toBe(start);
  });

  it("never mutates the input", () => {
    const start = board();
    const copy = JSON.parse(JSON.stringify(start));
    moveCard(start, "A-1", "done", 0);
    expect(start).toEqual(copy);
  });
});

describe("replaceTask", () => {
  it("swaps in the server copy in place", () => {
    const updated = { ...task("A-2", "todo"), title: "Renamed" };
    const next = replaceTask(board(), updated);
    expect(next[0].tasks[1].title).toBe("Renamed");
  });

  it("moves the card if the server put it in another status", () => {
    const next = replaceTask(board(), task("A-1", "done"));
    expect(keys(next).done).toEqual(["A-5", "A-1"]);
    expect(findCard(next, "A-1")).toEqual({ status: "done", index: 1 });
  });
});

describe("helpers", () => {
  it("maps column ids to statuses and ignores card ids", () => {
    expect(statusFromColumnId(columnId("in_review"))).toBe("in_review");
    expect(statusFromColumnId("WEB-1")).toBeNull();
  });

  it("detects whether a drag actually changed the placement", () => {
    const start = neighboursAt(board(), "A-2")!;
    expect(placementChanged(start, { ...start })).toBe(false);
    expect(placementChanged(start, { ...start, afterKey: null })).toBe(true);
    expect(placementChanged(start, { ...start, status: "done" })).toBe(true);
  });
});

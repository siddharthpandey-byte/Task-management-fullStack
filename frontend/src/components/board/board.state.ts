import type { BoardColumn, Task, TaskStatus } from "../../types/task.types";

// Pure helpers for the board's local (optimistic) state. Columns are never mutated.

export interface CardPosition {
  status: TaskStatus;
  index: number;
}

export interface Placement extends CardPosition {
  // neighbours at the new position, as the move API expects them
  afterKey: string | null;
  beforeKey: string | null;
}

// droppable id for a column (cards use their task key, which never contains ":")
export const COLUMN_ID_PREFIX = "column:";
export const columnId = (status: TaskStatus) => `${COLUMN_ID_PREFIX}${status}`;
export const statusFromColumnId = (id: string): TaskStatus | null =>
  id.startsWith(COLUMN_ID_PREFIX) ? (id.slice(COLUMN_ID_PREFIX.length) as TaskStatus) : null;

export function findCard(columns: BoardColumn[], key: string): CardPosition | null {
  for (const column of columns) {
    const index = column.tasks.findIndex((task) => task.key === key);
    if (index !== -1) return { status: column.status, index };
  }
  return null;
}

export function getTask(columns: BoardColumn[], key: string): Task | undefined {
  const at = findCard(columns, key);
  return at ? columns.find((c) => c.status === at.status)?.tasks[at.index] : undefined;
}

export function neighboursAt(columns: BoardColumn[], key: string): Placement | null {
  const at = findCard(columns, key);
  if (!at) return null;
  const tasks = columns.find((c) => c.status === at.status)!.tasks;
  return {
    ...at,
    afterKey: tasks[at.index - 1]?.key ?? null,
    beforeKey: tasks[at.index + 1]?.key ?? null,
  };
}

// Moves card `key` to `toIndex` of `toStatus` (index counted after the card is taken
// out, clamped to the column). Returns the new columns, or the same array when the
// card isn't on the board or wouldn't move.
export function moveCard(
  columns: BoardColumn[],
  key: string,
  toStatus: TaskStatus,
  toIndex: number
): BoardColumn[] {
  const from = findCard(columns, key);
  if (!from) return columns;
  const fromColumn = columns.find((c) => c.status === from.status)!;
  const task = fromColumn.tasks[from.index];
  const targetLength =
    (columns.find((c) => c.status === toStatus)?.tasks.length ?? 0) -
    (from.status === toStatus ? 1 : 0);
  const index = Math.max(0, Math.min(toIndex, targetLength));
  if (from.status === toStatus && from.index === index) return columns;

  const moved: Task = from.status === toStatus ? task : { ...task, status: toStatus };
  return columns.map((column) => {
    if (column.status !== from.status && column.status !== toStatus) return column;
    let tasks = column.tasks;
    let total = column.total;
    if (column.status === from.status) {
      tasks = tasks.filter((t) => t.key !== key);
      total -= 1;
    }
    if (column.status === toStatus) {
      tasks = [...tasks.slice(0, index), moved, ...tasks.slice(index)];
      total += 1;
    }
    return { ...column, tasks, total };
  });
}

// Swaps in the server's copy of a task. If the server put it in another status
// than the board shows (shouldn't happen, but never show stale data), it moves there.
export function replaceTask(columns: BoardColumn[], task: Task): BoardColumn[] {
  const at = findCard(columns, task.key);
  if (!at) return columns;
  const placed =
    at.status === task.status
      ? columns
      : moveCard(
          columns,
          task.key,
          task.status,
          columns.find((c) => c.status === task.status)?.tasks.length ?? 0
        );
  return placed.map((column) =>
    column.status !== task.status
      ? column
      : { ...column, tasks: column.tasks.map((t) => (t.key === task.key ? task : t)) }
  );
}

// true when the card ended up somewhere other than where the drag started
export const placementChanged = (start: Placement, end: Placement) =>
  start.status !== end.status ||
  start.afterKey !== end.afterKey ||
  start.beforeKey !== end.beforeKey;

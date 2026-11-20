import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { Types } from "mongoose";
import { TaskModel } from "../models/task.model.js";

// Manual task order ("rank") is a fractional index: a base-62 string where
// "between a and b" always exists, so moving a card is a single write and no
// other task is renumbered. Ranks are project-wide (like Jira): a board column is
// just one status filtered out of that order.
//
// Ranks MUST be compared byte-wise. Never sort them under a collation
// (the task list uses a case-insensitive one) or "a" and "A" would tie.

type ProjectId = Types.ObjectId | string;

export interface RankedTask {
  _id: Types.ObjectId;
  number: number;
  rank?: string | null;
  priorityRank?: number;
}

// raised when two neighbours can't be ranked between (tied, missing or malformed)
class UnrankableError extends Error {}

// byte-wise, which is what both MongoDB (no collation) and fractional-indexing use
const compareRank = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// rank order with the task number breaking ties, matching the board's sort
export const byRank = (a: RankedTask, b: RankedTask) =>
  compareRank(a.rank ?? "", b.rank ?? "") || a.number - b.number;

function keyBetween(after: string | null, before: string | null): string {
  if (after !== null && before !== null && compareRank(after, before) >= 0) {
    throw new UnrankableError("Neighbours are tied or out of order");
  }
  try {
    return generateKeyBetween(after, before);
  } catch {
    // malformed key (e.g. hand-edited data)
    throw new UnrankableError("Neighbour rank is invalid");
  }
}

// a rank below every task in the project: new tasks go to the bottom
export async function rankAtEnd(projectId: ProjectId): Promise<string> {
  const last = await TaskModel.findOne({
    project: projectId,
    rank: { $ne: null },
  })
    .sort({ rank: -1 })
    .select("rank")
    .lean();
  try {
    return generateKeyBetween(last?.rank ?? null, null);
  } catch {
    // the highest rank is malformed: repair the project, then append
    await rebalanceProject(projectId);
    return rankAtEnd(projectId);
  }
}

export interface Neighbours {
  // the card directly above the drop position, if any
  after: RankedTask | null;
  // the card directly below the drop position, if any
  before: RankedTask | null;
}

export type RankResult =
  | { ok: true; rank: string }
  // neighbours are in the opposite order from what the client saw
  | { ok: false };

// The closest rank strictly above/below `rank` in the project, ignoring `excludeId`
// (the task being moved). Used so a card dropped at the edge of a column doesn't
// collide with a card in another column.
async function adjacentRank(
  projectId: ProjectId,
  rank: string,
  direction: "above" | "below",
  excludeId?: Types.ObjectId
): Promise<string | null> {
  const doc = await TaskModel.findOne({
    project: projectId,
    rank: direction === "above" ? { $gt: rank } : { $lt: rank },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .sort({ rank: direction === "above" ? 1 : -1 })
    .select("rank")
    .lean();
  return doc?.rank ?? null;
}

// The rank for a task dropped between `after` and `before` (either may be null).
// If a neighbour's rank is missing or malformed, or the two are tied (tasks created
// at the same instant), the project is re-ranked once and the order re-checked.
export async function rankBetween(
  projectId: ProjectId,
  { after, before }: Neighbours,
  movingId?: Types.ObjectId
): Promise<RankResult> {
  if (!after && !before) return { ok: true, rank: await rankAtEnd(projectId) };

  const attempt = async (
    afterRank: string | null,
    beforeRank: string | null
  ): Promise<RankResult> => {
    if (afterRank !== null && beforeRank !== null && afterRank > beforeRank) {
      return { ok: false };
    }
    const lower =
      afterRank ??
      (beforeRank &&
        (await adjacentRank(projectId, beforeRank, "below", movingId)));
    const upper =
      beforeRank ??
      (afterRank &&
        (await adjacentRank(projectId, afterRank, "above", movingId)));
    return { ok: true, rank: keyBetween(lower || null, upper || null) };
  };

  const needsRepair =
    (after && !after.rank) ||
    (before && !before.rank) ||
    (after?.rank && before?.rank && after.rank === before.rank);

  if (!needsRepair) {
    try {
      return await attempt(after?.rank ?? null, before?.rank ?? null);
    } catch (error) {
      if (!(error instanceof UnrankableError)) throw error;
      // malformed key somewhere: repair below
    }
  }

  const fresh = await rebalanceProject(projectId);
  const rankOf = (task: RankedTask | null) =>
    task ? (fresh.get(String(task._id)) ?? null) : null;
  try {
    return await attempt(rankOf(after), rankOf(before));
  } catch (error) {
    // still tied after a repair means the order really is the other way round
    if (error instanceof UnrankableError) return { ok: false };
    throw error;
  }
}

// Gives every task in the project a fresh, evenly spread rank, keeping the current
// order. Tasks without a rank go first, ordered by `unrankedOrder` (task number by
// default, which is how the board already shows them).
// Each write is conditional on the rank it read, so a move that lands while this
// runs is never overwritten. Safe to run repeatedly. Returns task id → new rank.
export async function rebalanceProject(
  projectId: ProjectId,
  unrankedOrder: (a: RankedTask, b: RankedTask) => number = (a, b) =>
    a.number - b.number
): Promise<Map<string, string>> {
  const tasks = await TaskModel.find({ project: projectId })
    .select("_id number rank priorityRank")
    .lean<RankedTask[]>();

  const unranked = tasks.filter((t) => !t.rank).sort(unrankedOrder);
  const ranked = tasks.filter((t) => t.rank).sort(byRank);
  const ordered = [...unranked, ...ranked];
  if (ordered.length === 0) return new Map();

  const keys = generateNKeysBetween(null, null, ordered.length);
  const result = new Map<string, string>();
  const ops = ordered.map((task, i) => {
    result.set(String(task._id), keys[i]);
    return {
      updateOne: {
        filter: { _id: task._id, rank: task.rank ?? null },
        update: { $set: { rank: keys[i] } },
        // keep updatedAt meaning "a person changed this task"
        timestamps: false,
      },
    };
  });
  await TaskModel.bulkWrite(ops, { ordered: false });
  return result;
}

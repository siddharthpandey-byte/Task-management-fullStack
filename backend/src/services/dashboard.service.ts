import { Types } from "mongoose";
import {
  TASK_STATUS,
  TASK_STATUS_VALUES,
  type TaskStatus,
} from "../constants.js";
import { TaskModel } from "../models/task.model.js";
import type { AuthUser } from "../types/express.js";
import {
  startOfTodayUtc,
  TASK_POPULATE,
  visibleProjectIds,
} from "./task.service.js";

export const DASHBOARD_ASSIGNED_LIMIT = 10;
export const DASHBOARD_BOARD_PREVIEW = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Everything on the signed-in user's dashboard in one round trip.
// Scope matches the global task list: active projects the user can see.
export async function getDashboard(user: AuthUser) {
  const projectIds = await visibleProjectIds(user);
  const me = new Types.ObjectId(user.id);
  const inScope = { project: { $in: projectIds } };
  const open = { status: { $ne: TASK_STATUS.DONE } };
  const mine = { ...inScope, assignee: me };

  const [
    assignedOpen,
    inProgress,
    overdue,
    doneThisWeek,
    assigned,
    statusCounts,
    previews,
  ] = await Promise.all([
    TaskModel.countDocuments({ ...mine, ...open }),
    TaskModel.countDocuments({ ...mine, status: TASK_STATUS.IN_PROGRESS }),
    TaskModel.countDocuments({
      ...mine,
      ...open,
      dueDate: { $ne: null, $lt: startOfTodayUtc() },
    }),
    TaskModel.countDocuments({
      ...mine,
      status: TASK_STATUS.DONE,
      completedAt: { $gte: new Date(Date.now() - WEEK_MS) },
    }),
    assignedToMe(mine),
    TaskModel.aggregate<{ _id: TaskStatus; count: number }>([
      { $match: inScope },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // a few most recently touched cards per column
    Promise.all(
      TASK_STATUS_VALUES.map((status) =>
        TaskModel.find({ ...inScope, status })
          .sort({ updatedAt: -1, _id: -1 })
          .limit(DASHBOARD_BOARD_PREVIEW)
          .populate(TASK_POPULATE)
      )
    ),
  ]);

  const countOf = new Map(statusCounts.map((row) => [row._id, row.count]));

  return {
    stats: { assigned: assignedOpen, inProgress, overdue, doneThisWeek },
    assigned: { tasks: assigned, total: assignedOpen },
    board: {
      projectCount: projectIds.length,
      columns: TASK_STATUS_VALUES.map((status, i) => ({
        status,
        count: countOf.get(status) ?? 0,
        tasks: previews[i],
      })),
    },
  };
}

// open work assigned to me: most important first, then soonest due (no due date last)
async function assignedToMe(mine: Record<string, unknown>) {
  const ranked = await TaskModel.aggregate<{ _id: Types.ObjectId }>([
    { $match: { ...mine, status: { $ne: TASK_STATUS.DONE } } },
    { $addFields: { noDue: { $cond: [{ $eq: ["$dueDate", null] }, 1, 0] } } },
    { $sort: { priorityRank: -1, noDue: 1, dueDate: 1, updatedAt: -1 } },
    { $limit: DASHBOARD_ASSIGNED_LIMIT },
    { $project: { _id: 1 } },
  ]);
  const ids = ranked.map((row) => row._id);
  const tasks = await TaskModel.find({ _id: { $in: ids } }).populate(
    TASK_POPULATE
  );
  const byId = new Map(tasks.map((task) => [String(task._id), task]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter((task) => task !== undefined);
}

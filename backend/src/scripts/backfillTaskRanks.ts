// Gives every task created before board ordering existed a rank.
// Usage: npm run migrate:task-ranks
// Safe to run repeatedly: projects whose tasks all have a rank are skipped.
// Unranked tasks are placed first (the board already shows them there), ordered by
// priority (highest first) and then by task number; ranked tasks keep their order.
import { connectDB, disconnectDB } from "../db/connect.js";
import { TaskModel } from "../models/task.model.js";
import { rebalanceProject, type RankedTask } from "../services/rank.service.js";

const byPriorityThenNumber = (a: RankedTask, b: RankedTask) =>
  (b.priorityRank ?? 0) - (a.priorityRank ?? 0) || a.number - b.number;

async function main() {
  await connectDB();
  try {
    const projectIds = await TaskModel.distinct("project", { rank: null });
    if (projectIds.length === 0) {
      console.log("Every task already has a rank. Nothing to do.");
      return;
    }
    for (const projectId of projectIds) {
      const ranks = await rebalanceProject(projectId, byPriorityThenNumber);
      console.log(
        `Ranked ${ranks.size} task(s) in project ${String(projectId)}`
      );
    }
    console.log(`Done: ${projectIds.length} project(s) updated.`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Rank backfill failed:", err);
  process.exit(1);
});

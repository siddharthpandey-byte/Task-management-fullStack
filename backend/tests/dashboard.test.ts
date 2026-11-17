import { describe, expect, it } from "vitest";
import { TaskModel } from "../src/models/task.model.js";
import { UserModel } from "../src/models/user.model.js";
import { createClient, VALID_USER } from "./helpers/client.js";
import { useTestDatabase } from "./helpers/db.js";

useTestDatabase();

async function userWithRole(
  role: "admin" | "manager" | "member",
  email: string
) {
  const client = createClient();
  const res = await client.post("/auth/signup", { ...VALID_USER, email });
  expect(res.status).toBe(201);
  if (role !== "member") await UserModel.updateOne({ email }, { role });
  return { client, id: res.body.data.user.id as string };
}

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe("GET /dashboard", () => {
  it("requires authentication", async () => {
    expect((await createClient().get("/dashboard")).status).toBe(401);
  });

  it("returns an empty dashboard for a new member", async () => {
    const { client } = await userWithRole("member", "new@example.com");
    const res = await client.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      stats: { assigned: 0, inProgress: 0, overdue: 0, doneThisWeek: 0 },
      assigned: { tasks: [], total: 0 },
      board: {
        projectCount: 0,
        columns: ["todo", "in_progress", "in_review", "done"].map((status) => ({
          status,
          count: 0,
          tasks: [],
        })),
      },
    });
  });

  it("summarises my work and the board across my projects only", async () => {
    const lead = await userWithRole("manager", "lead@example.com");
    const member = await userWithRole("member", "member@example.com");
    const outsider = await userWithRole("member", "out@example.com");
    await lead.client.post("/projects", {
      name: "Website",
      key: "WEB",
      memberIds: [member.id],
    });
    await lead.client.post("/projects", {
      name: "Mobile",
      key: "MOB",
      memberIds: [outsider.id],
    });

    const create = (key: string, body: object) =>
      lead.client.post(`/projects/${key}/tasks`, { title: "t", ...body });
    const mine = { assigneeId: member.id };
    await create("WEB", { ...mine, title: "Low no date", priority: "low" });
    await create("WEB", {
      ...mine,
      title: "High later",
      priority: "high",
      dueDate: isoDay(10),
    });
    await create("WEB", { ...mine, title: "High no date", priority: "high" });
    await create("WEB", {
      ...mine,
      title: "High soon overdue",
      priority: "high",
      dueDate: isoDay(-1),
    });
    await create("WEB", { ...mine, title: "Working", status: "in_progress" });
    await create("WEB", {
      ...mine,
      title: "Finished",
      status: "done",
      dueDate: isoDay(-5),
    });
    await create("WEB", { title: "Someone else's" });
    await create("MOB", { title: "Hidden", assigneeId: outsider.id });

    // finished long ago → not "this week"
    await create("WEB", { ...mine, title: "Old done", status: "done" });
    await TaskModel.updateOne(
      { title: "Old done" },
      { completedAt: new Date(Date.now() - 30 * 86_400_000) }
    );

    const res = await member.client.get("/dashboard");
    expect(res.status).toBe(200);
    const { stats, assigned, board } = res.body.data;

    expect(stats).toEqual({
      assigned: 5,
      inProgress: 1,
      overdue: 1,
      doneThisWeek: 1,
    });
    expect(assigned.total).toBe(5);
    // priority first, then soonest due date, undated last
    expect(assigned.tasks.map((t: { title: string }) => t.title)).toEqual([
      "High soon overdue",
      "High later",
      "High no date",
      "Working",
      "Low no date",
    ]);
    expect(assigned.tasks[0]).toMatchObject({
      key: "WEB-4",
      project: { key: "WEB" },
      assignee: { id: member.id },
    });
    expect(assigned.tasks[0].priorityRank).toBeUndefined();

    expect(board.projectCount).toBe(1);
    expect(
      Object.fromEntries(
        board.columns.map((c: { status: string; count: number }) => [
          c.status,
          c.count,
        ])
      )
    ).toEqual({ todo: 5, in_progress: 1, in_review: 0, done: 2 });
    const todo = board.columns[0];
    expect(todo.tasks).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toMatch(/Hidden|password/);
  });

  it("drops archived projects", async () => {
    const lead = await userWithRole("manager", "lead@example.com");
    await lead.client.post("/projects", { name: "Website", key: "WEB" });
    await lead.client.post("/projects/WEB/tasks", {
      title: "t",
      assigneeId: lead.id,
    });
    expect((await lead.client.get("/dashboard")).body.data.stats.assigned).toBe(
      1
    );

    await lead.client.post("/projects/WEB/archive");
    const res = await lead.client.get("/dashboard");
    expect(res.body.data.stats.assigned).toBe(0);
    expect(res.body.data.board.projectCount).toBe(0);
  });
});

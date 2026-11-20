import { describe, expect, it } from "vitest";
import { TaskModel } from "../src/models/task.model.js";
import { UserModel } from "../src/models/user.model.js";
import { rebalanceProject } from "../src/services/rank.service.js";
import { createClient, VALID_USER } from "./helpers/client.js";
import { useTestDatabase } from "./helpers/db.js";

useTestDatabase();

type Role = "admin" | "manager" | "member";
type Client = ReturnType<typeof createClient>;

async function userWithRole(role: Role, email: string) {
  const client = createClient();
  const res = await client.post("/auth/signup", { ...VALID_USER, email });
  expect(res.status).toBe(201);
  if (role !== "member") await UserModel.updateOne({ email }, { role });
  return { client, id: res.body.data.user.id as string };
}

// WEB: lead (manager) + member. An outsider member, an admin and a manager are off it.
async function setup() {
  const lead = await userWithRole("manager", "lead@example.com");
  const member = await userWithRole("member", "member@example.com");
  const outsider = await userWithRole("member", "outsider@example.com");
  const admin = await userWithRole("admin", "admin@example.com");
  const otherManager = await userWithRole("manager", "m2@example.com");
  for (const key of ["WEB", "APP"]) {
    const res = await lead.client.post("/projects", {
      name: `Project ${key}`,
      key,
      memberIds: [member.id],
    });
    expect(res.status).toBe(201);
  }
  return { lead, member, outsider, admin, otherManager };
}

async function createTasks(
  client: Client,
  count: number,
  project = "WEB",
  extra = {}
) {
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    const res = await client.post(`/projects/${project}/tasks`, {
      title: `Task ${i}`,
      ...extra,
    });
    expect(res.status).toBe(201);
    keys.push(res.body.data.task.key);
  }
  return keys;
}

async function board(client: Client, query = "") {
  const res = await client.get(`/projects/WEB/board${query}`);
  expect(res.status).toBe(200);
  return res.body.data as {
    canEdit: boolean;
    columnLimit: number;
    project: { key: string; status: string };
    columns: {
      status: string;
      total: number;
      tasks: {
        key: string;
        status: string;
        rank?: string;
        completedAt: string | null;
      }[];
    }[];
  };
}

const column = async (client: Client, status: string) =>
  (await board(client)).columns
    .find((c) => c.status === status)!
    .tasks.map((t) => t.key);

const move = (client: Client, key: string, body: object) =>
  client.post(`/tasks/${key}/move`, body);

describe("GET /projects/:key/board", () => {
  it("groups tasks into one column per status, oldest first, without exposing rank", async () => {
    const { member } = await setup();
    await createTasks(member.client, 3);
    await member.client.post("/projects/WEB/tasks", {
      title: "Doing",
      status: "in_progress",
    });
    await member.client.post("/projects/WEB/tasks", {
      title: "Shipped",
      status: "done",
    });
    await member.client.post("/projects/APP/tasks", { title: "Other project" });

    const data = await board(member.client);
    expect(data.project).toMatchObject({ key: "WEB", status: "active" });
    expect(data.canEdit).toBe(true);
    expect(data.columns.map((c) => c.status)).toEqual([
      "todo",
      "in_progress",
      "in_review",
      "done",
    ]);
    expect(data.columns.map((c) => c.total)).toEqual([3, 1, 0, 1]);
    expect(data.columns[0].tasks.map((t) => t.key)).toEqual([
      "WEB-1",
      "WEB-2",
      "WEB-3",
    ]);
    expect(data.columns[1].tasks[0]).toMatchObject({ key: "WEB-4" });
    expect(data.columns[0].tasks[0]).not.toHaveProperty("rank");
    expect(data.columns[0].tasks[0]).toHaveProperty(
      "permissions.canEdit",
      true
    );
  });

  it("applies the list filters to every column", async () => {
    const { member, lead } = await setup();
    await member.client.post("/projects/WEB/tasks", {
      title: "Fix login bug",
      type: "bug",
      assigneeId: member.id,
    });
    await member.client.post("/projects/WEB/tasks", {
      title: "Write docs",
      assigneeId: lead.id,
    });
    await member.client.post("/projects/WEB/tasks", {
      title: "Login polish",
      status: "done",
      priority: "high",
    });

    const mine = await board(member.client, "?assignee=me");
    expect(mine.columns.flatMap((c) => c.tasks.map((t) => t.key))).toEqual([
      "WEB-1",
    ]);

    const search = await board(member.client, "?search=login");
    expect(search.columns.map((c) => c.total)).toEqual([1, 0, 0, 1]);

    const bugs = await board(member.client, "?type=bug");
    expect(bugs.columns[0].tasks.map((t) => t.key)).toEqual(["WEB-1"]);

    const res = await member.client.get("/projects/WEB/board?type=epic");
    expect(res.status).toBe(400);
  });

  it("hides the board from people who can't see the project and is read-only when archived", async () => {
    const { outsider, otherManager, lead } = await setup();
    expect((await outsider.client.get("/projects/WEB/board")).status).toBe(404);
    expect((await outsider.client.get("/projects/NOPE/board")).status).toBe(
      404
    );

    // managers can browse every project but only members work on its tasks
    expect((await board(otherManager.client)).canEdit).toBe(false);

    expect((await lead.client.post("/projects/WEB/archive")).status).toBe(200);
    const archived = await board(lead.client);
    expect(archived.canEdit).toBe(false);
    expect(archived.project.status).toBe("archived");
  });

  it("requires authentication", async () => {
    expect((await createClient().get("/projects/WEB/board")).status).toBe(401);
  });
});

describe("POST /tasks/:taskKey/move", () => {
  it("reorders within a column and the order persists", async () => {
    const { member, lead } = await setup();
    await createTasks(member.client, 4);

    // WEB-4 between WEB-1 and WEB-2
    let res = await move(member.client, "WEB-4", {
      status: "todo",
      afterKey: "WEB-1",
      beforeKey: "WEB-2",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.task).toMatchObject({ key: "WEB-4", status: "todo" });
    expect(res.body.data.task).not.toHaveProperty("rank");
    expect(await column(member.client, "todo")).toEqual([
      "WEB-1",
      "WEB-4",
      "WEB-2",
      "WEB-3",
    ]);

    // to the top, then to the bottom
    res = await move(member.client, "WEB-3", {
      status: "todo",
      beforeKey: "WEB-1",
    });
    expect(res.status).toBe(200);
    res = await move(member.client, "WEB-1", {
      status: "todo",
      afterKey: "WEB-2",
      beforeKey: null,
    });
    expect(res.status).toBe(200);

    // another user sees the same order
    expect(await column(lead.client, "todo")).toEqual([
      "WEB-3",
      "WEB-4",
      "WEB-2",
      "WEB-1",
    ]);
  });

  it("moves across columns, stamping and clearing completedAt", async () => {
    const { member } = await setup();
    await createTasks(member.client, 2);

    let res = await move(member.client, "WEB-1", { status: "in_progress" });
    expect(res.status).toBe(200);
    expect(res.body.data.task).toMatchObject({
      status: "in_progress",
      completedAt: null,
    });

    res = await move(member.client, "WEB-2", { status: "done" });
    expect(res.body.data.task.completedAt).toEqual(expect.any(String));

    // into a non-empty column, above the card that is there
    res = await move(member.client, "WEB-2", {
      status: "in_progress",
      beforeKey: "WEB-1",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.task).toMatchObject({
      status: "in_progress",
      completedAt: null,
    });

    const data = await board(member.client);
    expect(data.columns.map((c) => c.tasks.map((t) => t.key))).toEqual([
      [],
      ["WEB-2", "WEB-1"],
      [],
      [],
    ]);
  });

  it("does nothing when a card is dropped back where it was", async () => {
    const { member } = await setup();
    await createTasks(member.client, 3);
    const before = await TaskModel.findOne({ key: "WEB-2" }).lean();

    const res = await move(member.client, "WEB-2", {
      status: "todo",
      afterKey: "WEB-1",
      beforeKey: "WEB-3",
    });
    expect(res.status).toBe(200);
    const after = await TaskModel.findOne({ key: "WEB-2" }).lean();
    expect(after!.rank).toBe(before!.rank);
    expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
  });

  it("keeps a task's place when its status changes from the edit form", async () => {
    const { member } = await setup();
    await createTasks(member.client, 3);
    await move(member.client, "WEB-3", { status: "todo", beforeKey: "WEB-1" });

    // PATCH status to in_progress and back: still first
    await member.client.patch("/tasks/WEB-3", { status: "in_progress" });
    await member.client.patch("/tasks/WEB-3", { status: "todo" });
    expect(await column(member.client, "todo")).toEqual([
      "WEB-3",
      "WEB-1",
      "WEB-2",
    ]);
  });

  it("does not collide with ranks of cards in other columns when dropped at an edge", async () => {
    const { member } = await setup();
    await createTasks(member.client, 3);
    await move(member.client, "WEB-2", { status: "done" });

    // WEB-3 to just below WEB-1 in todo: must land between WEB-1 and WEB-2's rank
    await move(member.client, "WEB-3", { status: "todo", afterKey: "WEB-1" });
    const ranks = await TaskModel.find({
      project: (await TaskModel.findOne({ key: "WEB-1" }))!.project,
    })
      .select("key rank")
      .lean();
    const values = ranks.map((t) => t.rank);
    expect(new Set(values).size).toBe(values.length);
  });

  it("repairs tied and missing ranks and still applies the move", async () => {
    const { member } = await setup();
    await createTasks(member.client, 3);
    // simulate two tasks created at the same instant (same rank) and a legacy task (no rank)
    const one = await TaskModel.findOne({ key: "WEB-1" }).lean();
    await TaskModel.updateOne({ key: "WEB-2" }, { rank: one!.rank });
    await TaskModel.updateOne({ key: "WEB-3" }, { $unset: { rank: 1 } });

    // legacy (unranked) tasks sort first; ties break by number
    expect(await column(member.client, "todo")).toEqual([
      "WEB-3",
      "WEB-1",
      "WEB-2",
    ]);

    const res = await move(member.client, "WEB-3", {
      status: "todo",
      afterKey: "WEB-1",
      beforeKey: "WEB-2",
    });
    expect(res.status).toBe(200);
    expect(await column(member.client, "todo")).toEqual([
      "WEB-1",
      "WEB-3",
      "WEB-2",
    ]);
    expect(await TaskModel.countDocuments({ rank: null })).toBe(0);
  });

  it("rejects stale or inconsistent neighbours with 409", async () => {
    const { member } = await setup();
    await createTasks(member.client, 3);

    // neighbours in the wrong order (someone else reordered first)
    let res = await move(member.client, "WEB-1", {
      status: "todo",
      afterKey: "WEB-3",
      beforeKey: "WEB-2",
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/board changed/i);

    // a neighbour that has since left the target column
    await move(member.client, "WEB-2", { status: "done" });
    res = await move(member.client, "WEB-1", {
      status: "todo",
      afterKey: "WEB-2",
    });
    expect(res.status).toBe(409);

    // nothing was written
    expect(await column(member.client, "todo")).toEqual(["WEB-1", "WEB-3"]);
  });

  it("validates the request body", async () => {
    const { member } = await setup();
    await createTasks(member.client, 2);
    await createTasks(member.client, 1, "APP");

    const cases: [object, number, string?][] = [
      [{}, 400],
      [{ status: "blocked" }, 400],
      [{ status: "todo", afterKey: "not a key" }, 400],
      [{ status: "todo", rank: "a0" }, 400], // ranks are never client-supplied
      [{ status: "todo", afterKey: "WEB-1" }, 400, "afterKey"], // itself
      [
        { status: "todo", afterKey: "WEB-2", beforeKey: "WEB-2" },
        400,
        "beforeKey",
      ],
      [{ status: "todo", afterKey: "APP-1" }, 400, "afterKey"], // other project
      [{ status: "todo", beforeKey: "WEB-99" }, 400, "beforeKey"], // missing
    ];
    for (const [body, status, field] of cases) {
      const res = await move(member.client, "WEB-1", body);
      expect(res.status, JSON.stringify(body)).toBe(status);
      if (field) expect(res.body.errors?.[0]?.field).toBe(field);
    }
    // keys are case-insensitive
    expect(
      (
        await move(member.client, "web-1", {
          status: "todo",
          afterKey: "web-2",
        })
      ).status
    ).toBe(200);
    expect(await column(member.client, "todo")).toEqual(["WEB-2", "WEB-1"]);
  });

  it("enforces who may move tasks", async () => {
    const { member, outsider, otherManager, admin, lead } = await setup();
    await createTasks(member.client, 1);

    expect(
      (await move(outsider.client, "WEB-1", { status: "done" })).status
    ).toBe(404);
    expect(
      (await move(otherManager.client, "WEB-1", { status: "done" })).status
    ).toBe(403);
    expect(
      (await move(createClient(), "WEB-1", { status: "done" })).status
    ).toBe(401);
    expect(
      (await move(admin.client, "WEB-1", { status: "in_review" })).status
    ).toBe(200);

    await lead.client.post("/projects/WEB/archive");
    const res = await move(member.client, "WEB-1", { status: "done" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/archived/i);
  });
});

describe("task creation and rebalancing", () => {
  it("adds new tasks to the bottom even after reordering", async () => {
    const { member } = await setup();
    await createTasks(member.client, 2);
    await move(member.client, "WEB-2", { status: "todo", beforeKey: "WEB-1" });
    await createTasks(member.client, 1);
    expect(await column(member.client, "todo")).toEqual([
      "WEB-2",
      "WEB-1",
      "WEB-3",
    ]);
  });

  it("rebalanceProject keeps ranked order and puts unranked tasks first in the given order", async () => {
    const { member } = await setup();
    await createTasks(member.client, 2);
    await createTasks(member.client, 1, "WEB", { priority: "lowest" });
    await createTasks(member.client, 1, "WEB", { priority: "highest" });
    await TaskModel.updateMany(
      { key: { $in: ["WEB-3", "WEB-4"] } },
      { $unset: { rank: 1 } }
    );
    const project = (await TaskModel.findOne({ key: "WEB-1" }))!.project;

    const byPriority = (
      a: { priorityRank?: number; number: number },
      b: typeof a
    ) => (b.priorityRank ?? 0) - (a.priorityRank ?? 0) || a.number - b.number;
    const ranks = await rebalanceProject(project, byPriority);
    expect(ranks.size).toBe(4);
    // run twice: still the same order
    await rebalanceProject(project);
    expect(await column(member.client, "todo")).toEqual([
      "WEB-4",
      "WEB-3",
      "WEB-1",
      "WEB-2",
    ]);
  });
});

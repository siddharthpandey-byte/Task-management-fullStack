import { describe, expect, it } from "vitest";
import { TaskModel } from "../src/models/task.model.js";
import { UserModel } from "../src/models/user.model.js";
import { createClient, VALID_USER } from "./helpers/client.js";
import { useTestDatabase } from "./helpers/db.js";

useTestDatabase();

type Role = "admin" | "manager" | "member";

async function userWithRole(role: Role, email: string) {
  const client = createClient();
  const res = await client.post("/auth/signup", { ...VALID_USER, email });
  expect(res.status).toBe(201);
  if (role !== "member") await UserModel.updateOne({ email }, { role });
  return { client, id: res.body.data.user.id as string };
}

// lead (manager) + one member on WEB; an outsider member and an admin off the project
async function setup() {
  const lead = await userWithRole("manager", "lead@example.com");
  const member = await userWithRole("member", "member@example.com");
  const outsider = await userWithRole("member", "outsider@example.com");
  const admin = await userWithRole("admin", "admin@example.com");
  const otherManager = await userWithRole("manager", "m2@example.com");
  const res = await lead.client.post("/projects", {
    name: "Website",
    key: "WEB",
    memberIds: [member.id],
  });
  expect(res.status).toBe(201);
  return { lead, member, outsider, admin, otherManager };
}

const TASK = { title: "Build login page" };

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe("POST /projects/:key/tasks", () => {
  it("lets a project member create tasks with sequential Jira-style keys", async () => {
    const { member, lead } = await setup();

    const first = await member.client.post("/projects/WEB/tasks", {
      ...TASK,
      description: "With remember me",
      priority: "high",
      type: "story",
      assigneeId: lead.id,
      dueDate: "2030-01-15",
      labels: ["Frontend", "frontend", "auth"],
    });
    expect(first.status).toBe(201);
    const { task } = first.body.data;
    expect(task).toMatchObject({
      key: "WEB-1",
      number: 1,
      title: "Build login page",
      status: "todo",
      priority: "high",
      type: "story",
      assignee: { id: lead.id },
      reporter: { id: member.id },
      project: { key: "WEB", name: "Website" },
      dueDate: "2030-01-15T00:00:00.000Z",
      labels: ["frontend", "auth"],
      completedAt: null,
      permissions: { canEdit: true, canDelete: true },
    });
    expect(task.priorityRank).toBeUndefined();
    expect(JSON.stringify(first.body)).not.toMatch(/password|taskCounter/i);

    const second = await lead.client.post("/projects/web/tasks", TASK);
    expect(second.body.data.task.key).toBe("WEB-2");
  });

  it("hands out unique numbers to concurrent creates", async () => {
    const { lead } = await setup();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        lead.client.post("/projects/WEB/tasks", { title: `Task ${i}` })
      )
    );
    const keys = results.map((r) => r.body.data.task.key).sort();
    expect(new Set(keys).size).toBe(8);
    expect(await TaskModel.countDocuments()).toBe(8);
  });

  it("hides projects from outsiders and blocks non-members from writing", async () => {
    const { outsider, otherManager, admin } = await setup();

    // outsiders can't even tell the project exists
    expect(
      (await outsider.client.post("/projects/WEB/tasks", TASK)).status
    ).toBe(404);
    expect((await outsider.client.get("/projects/WEB/tasks")).status).toBe(404);

    // managers can browse every project but only work on their own
    expect((await otherManager.client.get("/projects/WEB/tasks")).status).toBe(
      200
    );
    expect(
      (await otherManager.client.post("/projects/WEB/tasks", TASK)).status
    ).toBe(403);

    // admins can work anywhere
    expect((await admin.client.post("/projects/WEB/tasks", TASK)).status).toBe(
      201
    );
  });

  it("validates input and rejects mass-assignment", async () => {
    const { lead } = await setup();
    const post = (body: object) =>
      lead.client.post("/projects/WEB/tasks", body);

    const empty = await post({ title: "   " });
    expect(empty.status).toBe(400);
    expect(empty.body.errors[0].field).toBe("title");

    for (const field of [
      "key",
      "reporter",
      "project",
      "number",
      "completedAt",
    ]) {
      expect((await post({ ...TASK, [field]: "x" })).status).toBe(400);
    }

    const badPriority = await post({ ...TASK, priority: "urgent" });
    expect(badPriority.body.errors[0].field).toBe("priority");
    const badStatus = await post({ ...TASK, status: "closed" });
    expect(badStatus.body.errors[0].field).toBe("status");
    const badDate = await post({ ...TASK, dueDate: "2026-02-30" });
    expect(badDate.status).toBe(400);
    expect(badDate.body.errors[0].field).toBe("dueDate");
    const badLabel = await post({ ...TASK, labels: ["has space"] });
    expect(badLabel.body.errors[0].field).toBe("labels.0");
    const injection = await post({ ...TASK, assigneeId: { $ne: null } });
    expect(injection.status).toBe(400);
  });

  it("requires the assignee to be an active project member", async () => {
    const { lead, outsider, member } = await setup();

    const notMember = await lead.client.post("/projects/WEB/tasks", {
      ...TASK,
      assigneeId: outsider.id,
    });
    expect(notMember.status).toBe(400);
    expect(notMember.body.errors[0].field).toBe("assigneeId");

    await UserModel.updateOne({ _id: member.id }, { isActive: false });
    const inactive = await lead.client.post("/projects/WEB/tasks", {
      ...TASK,
      assigneeId: member.id,
    });
    expect(inactive.status).toBe(400);
    expect(inactive.body.errors[0].field).toBe("assigneeId");
  });

  it("starts done tasks with a completion time", async () => {
    const { lead } = await setup();
    const res = await lead.client.post("/projects/WEB/tasks", {
      ...TASK,
      status: "done",
    });
    expect(res.body.data.task.completedAt).toBeTruthy();
  });
});

describe("GET /tasks/:taskKey", () => {
  it("returns visible tasks and 404s everything else", async () => {
    const { lead, outsider, otherManager } = await setup();
    await lead.client.post("/projects/WEB/tasks", TASK);

    const own = await lead.client.get("/tasks/web-1");
    expect(own.status).toBe(200);
    expect(own.body.data.task.key).toBe("WEB-1");

    // read-only for a manager who isn't on the project
    const browse = await otherManager.client.get("/tasks/WEB-1");
    expect(browse.body.data.task.permissions).toEqual({
      canEdit: false,
      canDelete: false,
    });

    expect((await outsider.client.get("/tasks/WEB-1")).status).toBe(404);
    expect((await lead.client.get("/tasks/WEB-99")).status).toBe(404);
    expect((await lead.client.get("/tasks/NOPE-1")).status).toBe(404);
    expect((await lead.client.get("/tasks/WEB-0")).status).toBe(404);
    expect((await lead.client.get("/tasks/not-a-key")).status).toBe(404);
  });
});

describe("PATCH /tasks/:taskKey", () => {
  it("lets members edit and tracks completion", async () => {
    const { lead, member } = await setup();
    await lead.client.post("/projects/WEB/tasks", TASK);

    const done = await member.client.patch("/tasks/WEB-1", {
      status: "done",
      assigneeId: member.id,
      priority: "highest",
      dueDate: "2031-05-01",
    });
    expect(done.status).toBe(200);
    expect(done.body.data.task).toMatchObject({
      status: "done",
      assignee: { id: member.id },
      priority: "highest",
      dueDate: "2031-05-01T00:00:00.000Z",
    });
    expect(done.body.data.task.completedAt).toBeTruthy();

    const reopened = await member.client.patch("/tasks/WEB-1", {
      status: "in_progress",
      assigneeId: null,
      dueDate: null,
    });
    expect(reopened.body.data.task).toMatchObject({
      status: "in_progress",
      assignee: null,
      dueDate: null,
      completedAt: null,
    });
  });

  it("rejects immutable fields, empty bodies and non-members", async () => {
    const { lead, otherManager, outsider } = await setup();
    await lead.client.post("/projects/WEB/tasks", TASK);

    expect(
      (await lead.client.patch("/tasks/WEB-1", { key: "WEB-9" })).status
    ).toBe(400);
    expect((await lead.client.patch("/tasks/WEB-1", {})).status).toBe(400);
    expect(
      (await otherManager.client.patch("/tasks/WEB-1", { title: "x" })).status
    ).toBe(403);
    expect(
      (await outsider.client.patch("/tasks/WEB-1", { title: "x" })).status
    ).toBe(404);
  });

  it("keeps a deactivated assignee but won't assign a new one", async () => {
    const { lead, member } = await setup();
    await lead.client.post("/projects/WEB/tasks", {
      ...TASK,
      assigneeId: member.id,
    });
    await UserModel.updateOne({ _id: member.id }, { isActive: false });

    const same = await lead.client.patch("/tasks/WEB-1", {
      title: "Renamed",
      assigneeId: member.id,
    });
    expect(same.status).toBe(200);

    await lead.client.patch("/tasks/WEB-1", { assigneeId: null });
    const again = await lead.client.patch("/tasks/WEB-1", {
      assigneeId: member.id,
    });
    expect(again.status).toBe(400);
  });
});

describe("DELETE /tasks/:taskKey", () => {
  it("allows the reporter, the lead or an admin", async () => {
    const { lead, member, admin } = await setup();
    await lead.client.post("/projects/WEB/tasks", TASK); // WEB-1 reported by lead
    await member.client.post("/projects/WEB/tasks", TASK); // WEB-2 reported by member
    await member.client.post("/projects/WEB/tasks", TASK); // WEB-3

    const listed = await member.client.get(
      "/projects/WEB/tasks?sort=key&order=asc"
    );
    expect(
      listed.body.data.tasks.map(
        (t: { permissions: { canDelete: boolean } }) => t.permissions.canDelete
      )
    ).toEqual([false, true, true]);

    expect((await member.client.del("/tasks/WEB-1")).status).toBe(403);
    expect((await member.client.del("/tasks/WEB-2")).status).toBe(200);
    expect((await lead.client.del("/tasks/WEB-3")).status).toBe(200);
    expect((await admin.client.del("/tasks/WEB-1")).status).toBe(200);
    expect((await admin.client.del("/tasks/WEB-1")).status).toBe(404);

    // numbers are never reused
    const next = await lead.client.post("/projects/WEB/tasks", TASK);
    expect(next.body.data.task.key).toBe("WEB-4");
  });
});

describe("archived projects", () => {
  it("are read-only", async () => {
    const { lead } = await setup();
    await lead.client.post("/projects/WEB/tasks", TASK);
    expect((await lead.client.post("/projects/WEB/archive")).status).toBe(200);

    expect((await lead.client.post("/projects/WEB/tasks", TASK)).status).toBe(
      409
    );
    expect(
      (await lead.client.patch("/tasks/WEB-1", { title: "x" })).status
    ).toBe(409);
    expect((await lead.client.del("/tasks/WEB-1")).status).toBe(409);

    const read = await lead.client.get("/tasks/WEB-1");
    expect(read.status).toBe(200);
    expect(read.body.data.task.permissions.canEdit).toBe(false);
  });
});

describe("listing and filters", () => {
  async function seed() {
    const ctx = await setup();
    const post = (body: object) =>
      ctx.lead.client.post("/projects/WEB/tasks", body);
    await post({
      title: "Alpha login",
      priority: "low",
      assigneeId: ctx.member.id,
    });
    await post({
      title: "Beta signup",
      priority: "highest",
      status: "in_progress",
    });
    await post({
      title: "Gamma overdue",
      priority: "medium",
      dueDate: isoDay(-3),
    });
    await post({
      title: "Delta done late",
      status: "done",
      dueDate: isoDay(-3),
    });
    await post({ title: "Epsilon soon", type: "bug", dueDate: isoDay(2) });
    return ctx;
  }
  const titles = (res: { body: { data: { tasks: { title: string }[] } } }) =>
    res.body.data.tasks.map((t) => t.title);

  it("filters by status, priority, type, assignee and due date", async () => {
    const { lead, member } = await seed();
    const list = (qs: string) => lead.client.get(`/projects/WEB/tasks?${qs}`);

    expect(
      titles(await list("status=in_progress,done&sort=key&order=asc"))
    ).toEqual(["Beta signup", "Delta done late"]);
    expect(titles(await list("status=todo&status=done&priority=low"))).toEqual([
      "Alpha login",
    ]);
    expect(titles(await list("type=bug"))).toEqual(["Epsilon soon"]);
    expect(titles(await list(`assignee=${member.id}`))).toEqual([
      "Alpha login",
    ]);
    expect(
      titles(await member.client.get("/projects/WEB/tasks?assignee=me"))
    ).toEqual(["Alpha login"]);
    expect((await list("assignee=unassigned")).body.data.pagination.total).toBe(
      4
    );
    // done tasks are never overdue
    expect(titles(await list("due=overdue"))).toEqual(["Gamma overdue"]);
    expect(titles(await list("due=week"))).toEqual(["Epsilon soon"]);
    expect((await list("due=none")).body.data.pagination.total).toBe(2);
  });

  it("sorts by real priority order and searches safely", async () => {
    const { lead } = await seed();
    const byPriority = await lead.client.get(
      "/projects/WEB/tasks?sort=priority&order=desc&limit=2"
    );
    expect(
      byPriority.body.data.tasks.map((t: { priority: string }) => t.priority)
    ).toEqual(["highest", "medium"]);
    const ascending = await lead.client.get(
      "/projects/WEB/tasks?sort=priority&order=asc"
    );
    expect(titles(ascending)[0]).toBe("Alpha login");
    expect(byPriority.body.data.pagination).toMatchObject({
      total: 5,
      totalPages: 3,
    });

    expect(
      titles(await lead.client.get("/projects/WEB/tasks?search=LOGIN"))
    ).toEqual(["Alpha login"]);
    expect(
      (await lead.client.get("/projects/WEB/tasks?search=WEB-2")).body.data
        .tasks[0].key
    ).toBe("WEB-2");
    expect(
      (await lead.client.get("/projects/WEB/tasks?search=.*")).body.data
        .pagination.total
    ).toBe(0);

    expect(
      (await lead.client.get("/projects/WEB/tasks?status=bogus")).status
    ).toBe(400);
    expect(
      (await lead.client.get("/projects/WEB/tasks?sort=password")).status
    ).toBe(400);
    expect(
      (await lead.client.get("/projects/WEB/tasks?limit=1000")).status
    ).toBe(400);
  });

  it("global list only shows tasks from projects the user can see", async () => {
    const { lead, member, outsider, admin } = await seed();
    const other = await admin.client.post("/projects", {
      name: "Mobile",
      key: "MOB",
      memberIds: [outsider.id],
    });
    expect(other.status).toBe(201);
    await outsider.client.post("/projects/MOB/tasks", {
      title: "Secret mobile task",
    });

    expect((await member.client.get("/tasks")).body.data.pagination.total).toBe(
      5
    );
    expect(
      (await outsider.client.get("/tasks")).body.data.tasks.map(
        (t: { key: string }) => t.key
      )
    ).toEqual(["MOB-1"]);
    expect((await admin.client.get("/tasks")).body.data.pagination.total).toBe(
      6
    );
    expect(
      (await admin.client.get("/tasks?project=mob")).body.data.pagination.total
    ).toBe(1);
    // filtering by a hidden project 404s instead of returning an empty list
    expect((await member.client.get("/tasks?project=MOB")).status).toBe(404);

    // archived projects drop out of the global list unless asked for
    await lead.client.post("/projects/WEB/archive");
    expect((await member.client.get("/tasks")).body.data.pagination.total).toBe(
      0
    );
    expect(
      (await member.client.get("/tasks?project=WEB")).body.data.pagination.total
    ).toBe(5);
  });
});

describe("project membership changes", () => {
  it("unassigns open tasks when a member leaves the project", async () => {
    const { lead, member } = await setup();
    await lead.client.post("/projects/WEB/tasks", {
      ...TASK,
      assigneeId: member.id,
    });
    await lead.client.post("/projects/WEB/tasks", {
      ...TASK,
      status: "done",
      assigneeId: member.id,
    });

    const res = await lead.client.patch("/projects/WEB", { memberIds: [] });
    expect(res.status).toBe(200);

    const open = await lead.client.get("/tasks/WEB-1");
    expect(open.body.data.task.assignee).toBeNull();
    const done = await lead.client.get("/tasks/WEB-2");
    expect(done.body.data.task.assignee).toMatchObject({ id: member.id });
  });
});

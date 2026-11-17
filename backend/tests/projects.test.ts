import { describe, expect, it } from "vitest";
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

const PROJECT = { name: "Website Revamp", key: "web", description: "New site" };

describe("POST /projects", () => {
  it("lets a manager create a project they lead", async () => {
    const manager = await userWithRole("manager", "m@example.com");
    const member = await userWithRole("member", "u@example.com");

    const res = await manager.client.post("/projects", {
      ...PROJECT,
      memberIds: [member.id, member.id],
    });

    expect(res.status).toBe(201);
    const { project } = res.body.data;
    expect(project).toMatchObject({
      name: "Website Revamp",
      key: "WEB",
      status: "active",
      lead: { id: manager.id, name: VALID_USER.name },
    });
    // lead is always a member; duplicates collapse
    expect(project.members.map((m: { id: string }) => m.id)).toEqual([
      manager.id,
      member.id,
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("forbids members from creating projects", async () => {
    const member = await userWithRole("member", "u@example.com");
    expect((await member.client.post("/projects", PROJECT)).status).toBe(403);
  });

  it("validates input and rejects mass-assignment", async () => {
    const { client } = await userWithRole("admin", "a@example.com");

    const badKey = await client.post("/projects", { ...PROJECT, key: "1X" });
    expect(badKey.status).toBe(400);
    expect(badKey.body.errors[0].field).toBe("key");

    const shortName = await client.post("/projects", { ...PROJECT, name: "A" });
    expect(shortName.status).toBe(400);
    expect(shortName.body.errors[0].field).toBe("name");

    const extra = await client.post("/projects", {
      ...PROJECT,
      status: "archived",
    });
    expect(extra.status).toBe(400);

    const badMember = await client.post("/projects", {
      ...PROJECT,
      memberIds: ["nope"],
    });
    expect(badMember.status).toBe(400);
  });

  it("rejects duplicate keys with a key field error", async () => {
    const { client } = await userWithRole("admin", "a@example.com");
    expect((await client.post("/projects", PROJECT)).status).toBe(201);

    const dup = await client.post("/projects", { ...PROJECT, key: "WEB" });
    expect(dup.status).toBe(409);
    expect(dup.body.errors).toEqual([
      { field: "key", message: "Project key already exists" },
    ]);
  });

  it("requires the lead to be an active admin or manager", async () => {
    const admin = await userWithRole("admin", "a@example.com");
    const member = await userWithRole("member", "u@example.com");

    const memberLead = await admin.client.post("/projects", {
      ...PROJECT,
      leadId: member.id,
    });
    expect(memberLead.status).toBe(400);
    expect(memberLead.body.errors[0].field).toBe("leadId");

    const manager = await userWithRole("manager", "m@example.com");
    await UserModel.updateOne({ _id: manager.id }, { isActive: false });
    const inactive = await admin.client.post("/projects", {
      ...PROJECT,
      leadId: manager.id,
    });
    expect(inactive.status).toBe(400);
    expect(inactive.body.errors[0].field).toBe("leadId");
  });
});

describe("GET /projects", () => {
  it("shows members only the projects they belong to", async () => {
    const admin = await userWithRole("admin", "a@example.com");
    const member = await userWithRole("member", "u@example.com");
    await admin.client.post("/projects", {
      ...PROJECT,
      memberIds: [member.id],
    });
    await admin.client.post("/projects", { name: "Secret Ops", key: "OPS" });

    const list = await member.client.get("/projects");
    expect(list.status).toBe(200);
    expect(list.body.data.projects.map((p: { key: string }) => p.key)).toEqual([
      "WEB",
    ]);

    // not visible → 404 so the key's existence doesn't leak
    expect((await member.client.get("/projects/OPS")).status).toBe(404);
    expect((await member.client.get("/projects/web")).status).toBe(200);
    expect((await admin.client.get("/projects/OPS")).status).toBe(200);
  });

  it("paginates, sorts and searches safely", async () => {
    const { client } = await userWithRole("admin", "a@example.com");
    for (const [name, key] of [
      ["Alpha", "ALP"],
      ["beta", "BET"],
      ["Gamma", "GAM"],
    ]) {
      await client.post("/projects", { name: `${name} project`, key });
    }

    const page = await client.get("/projects?sort=name&order=asc&limit=2");
    expect(page.body.data.projects.map((p: { key: string }) => p.key)).toEqual([
      "ALP",
      "BET",
    ]);
    expect(page.body.data.pagination).toMatchObject({
      total: 3,
      totalPages: 2,
    });

    const byKey = await client.get("/projects?search=gam");
    expect(byKey.body.data.pagination.total).toBe(1);

    // regex metacharacters are literal text
    const regex = await client.get(
      `/projects?search=${encodeURIComponent(".*")}`
    );
    expect(regex.body.data.pagination.total).toBe(0);

    expect((await client.get("/projects?limit=1000")).status).toBe(400);
    expect((await client.get("/projects?status=deleted")).status).toBe(400);
  });
});

describe("PATCH /projects/:key", () => {
  it("lets only the lead manager or an admin edit", async () => {
    const lead = await userWithRole("manager", "lead@example.com");
    const other = await userWithRole("manager", "other@example.com");
    const admin = await userWithRole("admin", "a@example.com");
    await lead.client.post("/projects", PROJECT);

    expect(
      (await other.client.patch("/projects/WEB", { name: "Hijacked" })).status
    ).toBe(403);

    const own = await lead.client.patch("/projects/WEB", { name: "Web 2.0" });
    expect(own.status).toBe(200);
    expect(own.body.data.project.name).toBe("Web 2.0");

    const byAdmin = await admin.client.patch("/projects/WEB", {
      leadId: other.id,
    });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.project.lead.id).toBe(other.id);
    // previous lead stays a member; new lead is added
    const ids = byAdmin.body.data.project.members.map(
      (m: { id: string }) => m.id
    );
    expect(ids).toEqual(expect.arrayContaining([lead.id, other.id]));
  });

  it("rejects key changes and empty updates", async () => {
    const { client } = await userWithRole("admin", "a@example.com");
    await client.post("/projects", PROJECT);

    expect((await client.patch("/projects/WEB", { key: "NEW" })).status).toBe(
      400
    );
    expect((await client.patch("/projects/WEB", {})).status).toBe(400);
    expect((await client.patch("/projects/NOPE", { name: "Xyz" })).status).toBe(
      404
    );
  });
});

describe("archive / restore", () => {
  it("archives, makes read-only, and restores", async () => {
    const lead = await userWithRole("manager", "lead@example.com");
    const member = await userWithRole("member", "u@example.com");
    await lead.client.post("/projects", { ...PROJECT, memberIds: [member.id] });

    expect((await member.client.post("/projects/WEB/archive")).status).toBe(
      403
    );

    const archived = await lead.client.post("/projects/WEB/archive");
    expect(archived.status).toBe(200);
    expect(archived.body.data.project.status).toBe("archived");
    expect(archived.body.data.project.archivedAt).toBeTruthy();

    expect((await lead.client.post("/projects/WEB/archive")).status).toBe(409);
    expect(
      (await lead.client.patch("/projects/WEB", { name: "Changed" })).status
    ).toBe(409);

    expect(
      (await lead.client.get("/projects")).body.data.projects
    ).toHaveLength(0);
    expect(
      (await lead.client.get("/projects?status=archived")).body.data.projects
    ).toHaveLength(1);

    const restored = await lead.client.post("/projects/WEB/restore");
    expect(restored.status).toBe(200);
    expect(restored.body.data.project).toMatchObject({
      status: "active",
      archivedAt: null,
    });
    expect((await lead.client.post("/projects/WEB/restore")).status).toBe(409);
  });
});

describe("GET /users?isActive", () => {
  it("filters by active state for the people pickers", async () => {
    const admin = await userWithRole("admin", "a@example.com");
    const member = await userWithRole("member", "u@example.com");
    await UserModel.updateOne({ _id: member.id }, { isActive: false });

    const res = await admin.client.get("/users?isActive=true");
    expect(res.body.data.users.map((u: { id: string }) => u.id)).toEqual([
      admin.id,
    ]);
    expect((await admin.client.get("/users?isActive=yes")).status).toBe(400);
  });
});

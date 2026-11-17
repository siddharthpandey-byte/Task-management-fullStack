import type { Types } from "mongoose";
import { PROJECT_STATUS, ROLES } from "../constants.js";
import { ProjectModel, type ProjectDocument } from "../models/project.model.js";
import { UserModel } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeRegex } from "../utils/regex.js";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "../validators/project.validator.js";

// only what the UI needs about a person; never the whole user document
const PERSON_FIELDS = "name email role isActive";
const POPULATE = [
  { path: "lead", select: PERSON_FIELDS },
  { path: "members", select: PERSON_FIELDS },
];

type IdLike = Types.ObjectId | { _id: Types.ObjectId } | string;
const idOf = (value: IdLike): string =>
  typeof value === "string"
    ? value
    : "_id" in value
      ? String(value._id)
      : String(value);

const READ_ONLY_MESSAGE =
  "Archived projects are read-only. Restore it to make changes.";

// --- permissions -----------------------------------------------------------
// admins/managers can browse every project; members only the ones they belong to

export function canView(user: AuthUser, project: ProjectDocument): boolean {
  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) return true;
  return project.members.some((m) => idOf(m) === user.id);
}

// admins manage everything; managers only the projects they lead
export function canManage(user: AuthUser, project: ProjectDocument): boolean {
  if (user.role === ROLES.ADMIN) return true;
  return user.role === ROLES.MANAGER && idOf(project.lead) === user.id;
}

// --- people ----------------------------------------------------------------

async function assertLead(leadId: string) {
  const lead = await UserModel.findById(leadId).select("role isActive").lean();
  if (!lead || !lead.isActive) {
    throw new ApiError(400, "Project lead must be an active user", [
      { field: "leadId", message: "Project lead must be an active user" },
    ]);
  }
  if (lead.role !== ROLES.ADMIN && lead.role !== ROLES.MANAGER) {
    throw new ApiError(400, "Project lead must be an admin or manager", [
      { field: "leadId", message: "Project lead must be an admin or manager" },
    ]);
  }
}

async function assertActiveUsers(ids: string[]) {
  if (ids.length === 0) return;
  const found = await UserModel.countDocuments({
    _id: { $in: ids },
    isActive: true,
  });
  if (found !== ids.length) {
    throw new ApiError(400, "Every member must be an active user", [
      { field: "memberIds", message: "Every member must be an active user" },
    ]);
  }
}

const withLead = (leadId: string, memberIds: string[]) => [
  leadId,
  ...memberIds.filter((id) => id !== leadId),
];

// --- queries ---------------------------------------------------------------

export async function listProjects(user: AuthUser, query: ListProjectsQuery) {
  const { page, limit, search, status, sort, order } = query;

  const filter: Record<string, unknown> = {};
  if (status !== "all") filter.status = status;
  if (user.role === ROLES.MEMBER) filter.members = user.id;
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ name: pattern }, { key: pattern }];
  }

  const direction = order === "asc" ? 1 : -1;
  const [projects, total] = await Promise.all([
    ProjectModel.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ [sort]: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "lead", select: PERSON_FIELDS }),
    ProjectModel.countDocuments(filter),
  ]);

  return {
    projects,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// 404 (not 403) when the user can't see it, so private project keys don't leak
export async function findVisibleProject(user: AuthUser, key: string) {
  const project = await ProjectModel.findOne({ key });
  if (!project || !canView(user, project)) {
    throw new ApiError(404, "Project not found");
  }
  return project;
}

async function findManageableProject(user: AuthUser, key: string) {
  const project = await findVisibleProject(user, key);
  if (!canManage(user, project)) {
    throw new ApiError(
      403,
      "Only the project lead or an admin can change this project"
    );
  }
  return project;
}

export const populate = (project: ProjectDocument) =>
  project.populate(POPULATE);

// --- mutations -------------------------------------------------------------

export async function createProject(user: AuthUser, input: CreateProjectInput) {
  const leadId = input.leadId ?? user.id;
  const memberIds = withLead(leadId, input.memberIds ?? []);

  await assertLead(leadId);
  await assertActiveUsers(memberIds.filter((id) => id !== leadId));

  try {
    const project = await ProjectModel.create({
      name: input.name,
      key: input.key,
      description: input.description ?? "",
      lead: leadId,
      members: memberIds,
      createdBy: user.id,
    });
    return populate(project);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new ApiError(409, "Project key already exists", [
        { field: "key", message: "Project key already exists" },
      ]);
    }
    throw error;
  }
}

export async function updateProject(
  user: AuthUser,
  key: string,
  input: UpdateProjectInput
) {
  const project = await findManageableProject(user, key);
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    throw new ApiError(409, READ_ONLY_MESSAGE);
  }

  if (input.name !== undefined) project.name = input.name;
  if (input.description !== undefined) project.description = input.description;

  if (input.leadId !== undefined || input.memberIds !== undefined) {
    const currentMembers = new Set(project.members.map(idOf));
    const leadId = input.leadId ?? idOf(project.lead);
    const memberIds = withLead(leadId, input.memberIds ?? [...currentMembers]);

    if (leadId !== idOf(project.lead)) await assertLead(leadId);
    // people already on the project stay valid even if deactivated later;
    // only newly added ones are checked
    await assertActiveUsers(
      memberIds.filter((id) => id !== leadId && !currentMembers.has(id))
    );

    project.set({ lead: leadId, members: memberIds });
  }

  await project.save();
  return populate(project);
}

export async function setArchived(
  user: AuthUser,
  key: string,
  archived: boolean
) {
  const project = await findManageableProject(user, key);
  const from = archived ? PROJECT_STATUS.ACTIVE : PROJECT_STATUS.ARCHIVED;

  // conditional update so two concurrent requests can't both succeed
  const updated = await ProjectModel.findOneAndUpdate(
    { _id: project._id, status: from },
    archived
      ? {
          status: PROJECT_STATUS.ARCHIVED,
          archivedAt: new Date(),
          archivedBy: user.id,
        }
      : { status: PROJECT_STATUS.ACTIVE, archivedAt: null, archivedBy: null },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw new ApiError(
      409,
      archived ? "Project is already archived" : "Project is not archived"
    );
  }
  return populate(updated);
}

import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import {
  PROJECT_KEY_REGEX,
  PROJECT_LIMITS,
  PROJECT_STATUS,
  PROJECT_STATUS_VALUES,
} from "../constants.js";

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: PROJECT_LIMITS.NAME_MIN,
      maxlength: PROJECT_LIMITS.NAME_MAX,
    },
    // used in URLs and (later) issue ids like WEB-42, so it never changes after creation
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: PROJECT_KEY_REGEX,
      immutable: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: PROJECT_LIMITS.DESCRIPTION_MAX,
    },
    lead: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // always contains the lead
    members: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= PROJECT_LIMITS.MEMBERS_MAX,
        message: `A project can have at most ${PROJECT_LIMITS.MEMBERS_MAX} members`,
      },
    },
    status: {
      type: String,
      enum: PROJECT_STATUS_VALUES,
      default: PROJECT_STATUS.ACTIVE,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    // last issued task number (WEB-1, WEB-2, …); only ever incremented atomically
    taskCounter: { type: Number, default: 0, min: 0, select: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  }
);

projectSchema.index({ status: 1, updatedAt: -1 });
projectSchema.index({ members: 1 });
projectSchema.index({ lead: 1 });

export type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDocument = HydratedDocument<Project>;

export const ProjectModel = model("Project", projectSchema);

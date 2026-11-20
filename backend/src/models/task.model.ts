import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import {
  TASK_KEY_REGEX,
  TASK_LIMITS,
  TASK_PRIORITY,
  TASK_PRIORITY_RANK,
  TASK_PRIORITY_VALUES,
  TASK_STATUS,
  TASK_STATUS_VALUES,
  TASK_TYPE,
  TASK_TYPE_VALUES,
  type TaskPriority,
} from "../constants.js";

const taskSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      immutable: true,
    },
    // per-project sequence number; together with the project key it forms the issue key
    number: { type: Number, required: true, min: 1, immutable: true },
    key: {
      type: String,
      required: true,
      unique: true,
      match: TASK_KEY_REGEX,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: TASK_LIMITS.TITLE_MAX,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: TASK_LIMITS.DESCRIPTION_MAX,
    },
    type: {
      type: String,
      enum: TASK_TYPE_VALUES,
      default: TASK_TYPE.TASK,
      required: true,
    },
    status: {
      type: String,
      enum: TASK_STATUS_VALUES,
      default: TASK_STATUS.TODO,
      required: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITY_VALUES,
      default: TASK_PRIORITY.MEDIUM,
      required: true,
    },
    // derived from priority (see pre-validate hook); lets the list sort by importance
    priorityRank: { type: Number, required: true, select: false },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    // a calendar day, stored as UTC midnight
    dueDate: { type: Date, default: null },
    labels: {
      type: [{ type: String, maxlength: TASK_LIMITS.LABEL_MAX }],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= TASK_LIMITS.LABELS_MAX,
        message: `A task can have at most ${TASK_LIMITS.LABELS_MAX} labels`,
      },
    },
    // when the task last moved to "done"; cleared if it is reopened
    completedAt: { type: Date, default: null },
    // Project-wide manual order (fractional index, compared byte-wise; see rank.service).
    // A board column is the tasks of one status sorted by rank. Not required so tasks
    // created before ranking existed still save; they sort first and get a rank on rebalance.
    rank: { type: String, maxlength: 128 },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.priorityRank;
        delete ret.rank;
        return ret;
      },
    },
  }
);

taskSchema.pre("validate", function () {
  this.priorityRank = TASK_PRIORITY_RANK[this.priority as TaskPriority];
});

taskSchema.index({ project: 1, number: 1 }, { unique: true });
taskSchema.index({ project: 1, status: 1, updatedAt: -1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ project: 1, dueDate: 1 });
// board columns: one project's tasks of one status in rank order
taskSchema.index({ project: 1, status: 1, rank: 1, number: 1 });
taskSchema.index({ project: 1, rank: -1 });

export type Task = InferSchemaType<typeof taskSchema>;
export type TaskDocument = HydratedDocument<Task>;

export const TaskModel = model("Task", taskSchema);

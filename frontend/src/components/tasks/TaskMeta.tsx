import { Icon, type IconName } from "../ui/Icon";
import { Lozenge } from "../ui/Lozenge";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_APPEARANCE,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "../../constants/task.constant";
import type { Task, TaskPriority, TaskStatus, TaskType } from "../../types/task.types";
import { dueState, formatDueDate } from "../../utils/task.helper";
import styles from "./TaskMeta.module.css";

const TYPE_ICONS: Record<TaskType, IconName> = { task: "check", bug: "bug", story: "story" };

// Jira-style coloured type tile
export function TaskTypeIcon({ type, size = 16 }: { type: TaskType; size?: number }) {
  return (
    <span
      className={`${styles.typeTile} ${styles[`type_${type}`]}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={TASK_TYPE_LABELS[type]}
      title={TASK_TYPE_LABELS[type]}
    >
      <Icon name={TYPE_ICONS[type]} size={Math.round(size * 0.7)} strokeWidth={2.5} />
    </span>
  );
}

const PRIORITY_ICONS: Record<TaskPriority, IconName> = {
  highest: "priorityHighest",
  high: "priorityHigh",
  medium: "priorityMedium",
  low: "priorityLow",
  lowest: "priorityLowest",
};

export function PriorityIcon({
  priority,
  withLabel = false,
}: {
  priority: TaskPriority;
  withLabel?: boolean;
}) {
  return (
    <span className={styles.priority} title={`${TASK_PRIORITY_LABELS[priority]} priority`}>
      <Icon
        name={PRIORITY_ICONS[priority]}
        size={16}
        strokeWidth={2.5}
        className={styles[`priority_${priority}`]}
        aria-label={withLabel ? undefined : `${TASK_PRIORITY_LABELS[priority]} priority`}
      />
      {withLabel && <span>{TASK_PRIORITY_LABELS[priority]}</span>}
    </span>
  );
}

export function StatusLozenge({ status }: { status: TaskStatus }) {
  return (
    <Lozenge appearance={TASK_STATUS_APPEARANCE[status]}>{TASK_STATUS_LABELS[status]}</Lozenge>
  );
}

export function DueDate({ task }: { task: Pick<Task, "dueDate" | "status"> }) {
  if (!task.dueDate) return <span className={styles.none}>—</span>;
  const state = dueState(task);
  return (
    <span className={`${styles.due} ${state ? styles[`due_${state}`] : ""}`}>
      {state === "overdue" && <Icon name="clock" size={14} />}
      <span>{formatDueDate(task.dueDate)}</span>
      {state === "overdue" && <span className="visually-hidden"> (overdue)</span>}
      {state === "today" && <span className="visually-hidden"> (due today)</span>}
    </span>
  );
}

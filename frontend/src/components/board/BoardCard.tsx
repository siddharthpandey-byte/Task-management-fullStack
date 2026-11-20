import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, type KeyboardEvent, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router";
import { taskPath } from "../../constants/route.constant";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "../../constants/task.constant";
import type { Task, TaskStatus } from "../../types/task.types";
import { ActionMenu, type ActionMenuItem } from "../ui/ActionMenu";
import { Avatar } from "../ui/Avatar";
import { Spinner } from "../ui/Spinner";
import { DueDate, PriorityIcon, TaskTypeIcon } from "../tasks/TaskMeta";
import styles from "./Board.module.css";

export type MoveTarget = { status: TaskStatus; edge: "top" | "bottom" };

interface BoardCardProps {
  task: Task;
  // position in its column, for the move menu
  index: number;
  columnSize: number;
  // drag-and-drop and the move menu are off (read-only board or save in flight)
  disabled: boolean;
  saving: boolean;
  // must be stable (the card is memoised)
  onMove: (taskKey: string, target: MoveTarget) => void;
}

// keyboard- and screen-reader-friendly alternative to dragging
function moveItems(
  task: Task,
  index: number,
  columnSize: number,
  onMove: BoardCardProps["onMove"]
): ActionMenuItem[] {
  const items: ActionMenuItem[] = [];
  const move = (target: MoveTarget) => () => onMove(task.key, target);
  if (index > 0) {
    items.push({
      label: "Move to top",
      icon: "arrowUp",
      onSelect: move({ status: task.status, edge: "top" }),
    });
  }
  if (index < columnSize - 1) {
    items.push({
      label: "Move to bottom",
      icon: "arrowDown",
      onSelect: move({ status: task.status, edge: "bottom" }),
    });
  }
  for (const status of TASK_STATUSES) {
    if (status === task.status) continue;
    items.push({
      label: `Move to ${TASK_STATUS_LABELS[status]}`,
      icon: "arrowRight",
      onSelect: move({ status, edge: "top" }),
    });
  }
  return items;
}

// keep key presses and clicks inside the menu from starting a drag
const stop = (event: SyntheticEvent) => event.stopPropagation();

export const BoardCard = memo(function BoardCard({
  task,
  index,
  columnSize,
  disabled,
  saving,
  onMove,
}: BoardCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.key,
    disabled,
  });

  // Space picks the card up (dnd-kit); Enter opens the task like a link would
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      navigate(taskPath(task.key));
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.cardPlaceholder : ""} ${
        disabled ? styles.cardStatic : ""
      }`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      // a read-only card is still reachable and opens with Enter
      tabIndex={0}
      aria-roledescription={disabled ? "task" : "draggable task"}
      aria-label={`${task.key}: ${task.title}`}
      aria-busy={saving || undefined}
      data-testid={`board-card-${task.key}`}
    >
      <CardBody task={task} linked />
      <span className={styles.cardCorner}>
        {saving && <Spinner size="sm" label={`Saving ${task.key}`} />}
        {!disabled && (
          <span onPointerDown={stop} onKeyDown={stop} className={styles.cardMenu}>
            <ActionMenu
              label={`Move ${task.key}`}
              items={moveItems(task, index, columnSize, onMove)}
            />
          </span>
        )}
      </span>
    </div>
  );
});

// shared by the card on the board and the copy that follows the pointer while dragging
export function CardBody({ task, linked = false }: { task: Task; linked?: boolean }) {
  return (
    <>
      {linked ? (
        // not a tab stop: the card itself is focusable and opens the task with Enter
        <Link to={taskPath(task.key)} className={styles.cardTitle} tabIndex={-1} draggable={false}>
          {task.title}
        </Link>
      ) : (
        <span className={styles.cardTitle}>{task.title}</span>
      )}
      {task.labels.length > 0 && (
        <span className={styles.cardLabels}>
          {task.labels.slice(0, 3).map((label) => (
            <span key={label} className={styles.cardLabel}>
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className={styles.cardLabel}>+{task.labels.length - 3}</span>
          )}
        </span>
      )}
      <span className={styles.cardMeta}>
        <TaskTypeIcon type={task.type} size={16} />
        <span className={styles.cardKey}>{task.key}</span>
        <PriorityIcon priority={task.priority} />
        {task.dueDate && (
          <span className={styles.cardDue}>
            <DueDate task={task} />
          </span>
        )}
        <span className={styles.cardAssignee}>
          {task.assignee ? (
            <>
              <Avatar name={task.assignee.name} size="xs" inactive={!task.assignee.isActive} />
              <span className="visually-hidden">Assigned to {task.assignee.name}</span>
            </>
          ) : (
            <span className={styles.unassigned} title="Unassigned">
              <span className="visually-hidden">Unassigned</span>
            </span>
          )}
        </span>
      </span>
    </>
  );
}

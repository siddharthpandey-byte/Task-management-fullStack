import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMemo } from "react";
import { Link } from "react-router";
import { projectTasksPath } from "../../constants/route.constant";
import { TASK_STATUS_LABELS } from "../../constants/task.constant";
import type { BoardColumn as Column } from "../../types/task.types";
import { BoardCard, type MoveTarget } from "./BoardCard";
import { columnId } from "./board.state";
import styles from "./Board.module.css";

interface BoardColumnProps {
  column: Column;
  projectKey: string;
  canEdit: boolean;
  savingKeys: ReadonlySet<string>;
  onMove: (taskKey: string, target: MoveTarget) => void;
}

export function BoardColumn({ column, projectKey, canEdit, savingKeys, onMove }: BoardColumnProps) {
  const { status, tasks, total } = column;
  const label = TASK_STATUS_LABELS[status];
  // the whole column is a drop target so empty columns (and the space under the
  // last card) accept drops
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status), disabled: !canEdit });
  const items = useMemo(() => tasks.map((task) => task.key), [tasks]);
  const headingId = `board-column-${status}`;
  const capped = total > tasks.length;

  return (
    <section
      className={`${styles.column} ${isOver ? styles.columnOver : ""}`}
      aria-labelledby={headingId}
      data-status={status}
    >
      <header className={styles.columnHeader}>
        <h2 id={headingId} className={styles.columnTitle}>
          {label}
        </h2>
        <span
          className={styles.columnCount}
          aria-label={`${total} ${total === 1 ? "task" : "tasks"}`}
        >
          {total}
        </span>
      </header>

      <SortableContext id={status} items={items} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.columnBody} role="list" aria-labelledby={headingId}>
          {tasks.map((task, index) => (
            <div role="listitem" key={task.key}>
              <BoardCard
                task={task}
                index={index}
                columnSize={tasks.length}
                disabled={!canEdit || savingKeys.has(task.key)}
                saving={savingKeys.has(task.key)}
                onMove={onMove}
              />
            </div>
          ))}
          {tasks.length === 0 && (
            <p className={styles.columnEmpty}>{canEdit ? "Drop tasks here" : "No tasks"}</p>
          )}
        </div>
      </SortableContext>

      {capped && (
        <p className={styles.columnFooter}>
          Showing {tasks.length} of {total}.{" "}
          <Link to={`${projectTasksPath(projectKey)}?status=${status}`}>View all in list</Link>
        </p>
      )}
    </section>
  );
}

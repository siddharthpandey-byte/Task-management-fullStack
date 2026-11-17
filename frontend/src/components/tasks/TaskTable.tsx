import { Link } from "react-router";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "../../constants/task.constant";
import { taskPath } from "../../constants/route.constant";
import type { SortOrder } from "../../types/project.types";
import type { Task, TaskSort, TaskStatus } from "../../types/task.types";
import { formatDate } from "../../utils/project.helper";
import { ProjectTile } from "../projects/ProjectTile";
import { ActionMenu, type ActionMenuItem } from "../ui/ActionMenu";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { DueDate, PriorityIcon, StatusLozenge, TaskTypeIcon } from "./TaskMeta";
import styles from "./TaskTable.module.css";

const SKELETON_ROWS = 6;

interface TaskTableProps {
  tasks: Task[];
  loading: boolean;
  showSkeleton: boolean;
  sort: TaskSort;
  order: SortOrder;
  onSort: (sort: TaskSort) => void;
  showProject: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

export function TaskTable({
  tasks,
  loading,
  showSkeleton,
  sort,
  order,
  onSort,
  showProject,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskTableProps) {
  const columns = showProject ? 10 : 9;

  const sortHeader = (key: TaskSort, label: string, className?: string) => {
    const active = sort === key;
    return (
      <th
        scope="col"
        className={className}
        aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined}
      >
        <button type="button" className={styles.sortButton} onClick={() => onSort(key)}>
          {label}
          <Icon
            name={active && order === "asc" ? "arrowUp" : "arrowDown"}
            size={12}
            className={active ? styles.sortActive : styles.sortIdle}
          />
        </button>
      </th>
    );
  };

  const rowActions = (task: Task): ActionMenuItem[] => {
    if (!task.permissions.canEdit) return [];
    const items: ActionMenuItem[] = [
      { label: "Edit", icon: "edit", onSelect: () => onEdit(task) },
      ...TASK_STATUSES.filter((s) => s !== task.status).map((status) => ({
        label: `Move to ${TASK_STATUS_LABELS[status]}`,
        icon: (status === "done" ? "checkCircle" : "arrowRight") as ActionMenuItem["icon"],
        onSelect: () => onStatusChange(task, status),
      })),
    ];
    if (task.permissions.canDelete) {
      items.push({ label: "Delete", icon: "trash", danger: true, onSelect: () => onDelete(task) });
    }
    return items;
  };

  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <thead>
          <tr>
            <th scope="col" className={styles.typeCol}>
              <span className="visually-hidden">Type</span>
            </th>
            {sortHeader("key", "Key", styles.keyCol)}
            {sortHeader("title", "Summary")}
            {showProject && (
              <th scope="col" className={styles.hideMd}>
                Project
              </th>
            )}
            <th scope="col">Status</th>
            <th scope="col" className={styles.hideSm}>
              Assignee
            </th>
            {sortHeader("priority", "Priority", styles.hideSm)}
            {sortHeader("dueDate", "Due")}
            {sortHeader("updatedAt", "Updated", styles.hideMd)}
            <th scope="col" className={styles.actionsCol}>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className={loading && !showSkeleton ? styles.refreshing : undefined}>
          {showSkeleton
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} className={styles.skeletonRow} aria-hidden="true">
                  {Array.from({ length: columns }, (__, j) => (
                    <td key={j}>
                      <span className={styles.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            : tasks.map((task) => (
                <tr key={task.id}>
                  <td className={styles.typeCol}>
                    <TaskTypeIcon type={task.type} />
                  </td>
                  <td className={styles.keyCol}>
                    <Link
                      to={taskPath(task.key)}
                      className={`${styles.key} ${task.status === "done" ? styles.done : ""}`}
                    >
                      {task.key}
                    </Link>
                  </td>
                  <td className={styles.summaryCell}>
                    <Link to={taskPath(task.key)} className={styles.summary}>
                      {task.title}
                    </Link>
                    {task.labels.length > 0 && (
                      <span className={styles.labels}>
                        {task.labels.slice(0, 3).map((label) => (
                          <span key={label} className={styles.label}>
                            {label}
                          </span>
                        ))}
                        {task.labels.length > 3 && (
                          <span className={styles.more}>+{task.labels.length - 3}</span>
                        )}
                      </span>
                    )}
                  </td>
                  {showProject && (
                    <td className={styles.hideMd}>
                      <span className={styles.project}>
                        <ProjectTile projectKey={task.project.key} />
                        <span className={styles.ellipsis}>{task.project.name}</span>
                      </span>
                    </td>
                  )}
                  <td>
                    <StatusLozenge status={task.status} />
                  </td>
                  <td className={styles.hideSm}>
                    {task.assignee ? (
                      <span className={styles.person}>
                        <Avatar name={task.assignee.name} inactive={!task.assignee.isActive} />
                        <span className={styles.ellipsis}>{task.assignee.name}</span>
                      </span>
                    ) : (
                      <span className={styles.muted}>Unassigned</span>
                    )}
                  </td>
                  <td className={styles.hideSm}>
                    <PriorityIcon priority={task.priority} withLabel />
                  </td>
                  <td>
                    <DueDate task={task} />
                  </td>
                  <td className={`${styles.muted} ${styles.hideMd}`}>
                    {formatDate(task.updatedAt)}
                  </td>
                  <td className={styles.actionsCol}>
                    <ActionMenu label={`Actions for ${task.key}`} items={rowActions(task)} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

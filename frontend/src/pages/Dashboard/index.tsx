import { Link } from "react-router";
import { Can } from "../../components/auth/Can";
import { APP_NAME } from "../../components/Logo";
import {
  DueDate,
  PriorityIcon,
  StatusLozenge,
  TaskTypeIcon,
} from "../../components/tasks/TaskMeta";
import { Alert } from "../../components/ui/Alert";
import { buttonClass } from "../../components/ui/Button/buttonClass";
import { Card } from "../../components/ui/Card";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Lozenge } from "../../components/ui/Lozenge";
import { PageHeader } from "../../components/ui/PageHeader";
import { RoleBadge } from "../../components/ui/RoleBadge";
import { ROLES } from "../../constants/auth.constant";
import { ROUTES, taskPath } from "../../constants/route.constant";
import { TASK_STATUS_APPEARANCE, TASK_STATUS_LABELS } from "../../constants/task.constant";
import { useAuth } from "../../hooks/useAuth";
import { useDashboard } from "../../hooks/useDashboard";
import type { Role } from "../../types/auth.types";
import type { DashboardStats, DashboardTask } from "../../types/dashboard.types";
import { getFirstName, getInitials } from "../../utils/user.helper";
import styles from "./Dashboard.module.css";

const PERMISSIONS: Record<Role, string[]> = {
  admin: ["Manage users and roles", "Create and archive projects", "Assign and track tasks"],
  manager: ["Create and manage projects", "Assign tasks to members", "View team members"],
  member: [
    "View projects you belong to",
    "Work on tasks assigned to you",
    "Comment and update status",
  ],
};

// each tile opens the matching filtered task list
const STATS: {
  key: keyof DashboardStats;
  label: string;
  icon: IconName;
  tone: string;
  to: string;
}[] = [
  {
    key: "assigned",
    label: "Assigned to me",
    icon: "task",
    tone: styles.toneBlue,
    to: `${ROUTES.TASKS}?assignee=me&status=todo%2Cin_progress%2Cin_review`,
  },
  {
    key: "inProgress",
    label: "In progress",
    icon: "clock",
    tone: styles.tonePurple,
    to: `${ROUTES.TASKS}?assignee=me&status=in_progress`,
  },
  {
    key: "overdue",
    label: "Overdue",
    icon: "error",
    tone: styles.toneRed,
    to: `${ROUTES.TASKS}?assignee=me&due=overdue`,
  },
  {
    key: "doneThisWeek",
    label: "Done in the last 7 days",
    icon: "checkCircle",
    tone: styles.toneGreen,
    to: `${ROUTES.TASKS}?assignee=me&status=done`,
  },
];

const MY_OPEN_WORK = STATS[0].to;

const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboard();
  if (!user) return null;

  const firstLoad = loading && !data;
  const assigned = data?.assigned;
  const board = data?.board;

  return (
    <div className={styles.page}>
      <title>{`Dashboard · ${APP_NAME}`}</title>

      <PageHeader
        breadcrumbs={[{ label: APP_NAME, to: ROUTES.DASHBOARD }, { label: "Dashboard" }]}
        title={`${greeting()}, ${getFirstName(user.name)}`}
        description="Here's what's happening across your workspace."
        actions={
          <Can roles={[ROLES.ADMIN, ROLES.MANAGER]}>
            <Link to={`${ROUTES.PROJECTS}?create=1`} className={buttonClass()}>
              <Icon name="plus" size={16} />
              New project
            </Link>
          </Can>
        }
      />

      {error && (
        <Alert variant="error" title="Couldn't load your dashboard">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      )}

      <section
        className={styles.stats}
        aria-label="Task summary"
        aria-busy={firstLoad || undefined}
      >
        {STATS.map((stat) => {
          const value = data?.stats[stat.key];
          return (
            <Link key={stat.key} to={stat.to} className={styles.stat}>
              <span className={`${styles.statIcon} ${stat.tone}`}>
                <Icon name={stat.icon} size={20} />
              </span>
              <span className={styles.statText}>
                <span
                  className={`${styles.statValue} ${
                    stat.key === "overdue" && value ? styles.statDanger : ""
                  }`}
                >
                  {value ?? (firstLoad ? <span className={styles.skeletonValue} /> : "—")}
                </span>
                <span className={styles.statLabel}>{stat.label}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Card
            title="Assigned to me"
            meta={<Lozenge>{assigned?.total ?? 0}</Lozenge>}
            actions={
              assigned && assigned.total > 0 ? (
                <Link to={MY_OPEN_WORK} className={styles.cardLink}>
                  View all
                </Link>
              ) : undefined
            }
            flush
          >
            <div className={styles.tableHead} aria-hidden="true">
              <span>Summary</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Due</span>
            </div>
            {firstLoad ? (
              <ul className={styles.rows} aria-hidden="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className={styles.row}>
                    <span className={styles.skeleton} />
                    <span className={styles.skeleton} />
                    <span className={styles.skeleton} />
                    <span className={styles.skeleton} />
                  </li>
                ))}
              </ul>
            ) : assigned && assigned.tasks.length > 0 ? (
              <>
                <ul className={styles.rows} aria-label="Open tasks assigned to you">
                  {assigned.tasks.map((task) => (
                    <AssignedRow key={task.id} task={task} />
                  ))}
                </ul>
                {assigned.total > assigned.tasks.length && (
                  <Link to={MY_OPEN_WORK} className={styles.moreLink}>
                    View all {assigned.total} assigned tasks
                    <Icon name="arrowRight" size={14} />
                  </Link>
                )}
              </>
            ) : (
              <EmptyState
                title="You have no assigned work"
                text="Issues assigned to you will show up here, sorted by priority."
              />
            )}
          </Card>

          <Card
            title="Board overview"
            meta={
              <span className={styles.metaText}>
                {board
                  ? `${board.projectCount} active project${board.projectCount === 1 ? "" : "s"}`
                  : "All projects"}
              </span>
            }
            actions={
              <Link to={ROUTES.TASKS} className={styles.cardLink}>
                All tasks
              </Link>
            }
            flush
          >
            <div className={styles.board} role="list" aria-label="Board columns">
              {(board?.columns ?? []).map((column) => (
                <div key={column.status} className={styles.column} role="listitem">
                  <div className={styles.columnHeader}>
                    <Lozenge appearance={TASK_STATUS_APPEARANCE[column.status]}>
                      {TASK_STATUS_LABELS[column.status]}
                    </Lozenge>
                    <span className={styles.columnCount}>{column.count}</span>
                  </div>
                  {column.tasks.length === 0 ? (
                    <div className={styles.columnEmpty}>No issues</div>
                  ) : (
                    <ul className={styles.cards}>
                      {column.tasks.map((task) => (
                        <li key={task.id}>
                          <BoardCard task={task} />
                        </li>
                      ))}
                      {column.count > column.tasks.length && (
                        <li>
                          <Link
                            to={`${ROUTES.TASKS}?status=${column.status}`}
                            className={styles.columnMore}
                          >
                            +{column.count - column.tasks.length} more
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
              {!board &&
                Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className={styles.column} aria-hidden="true">
                    <span className={styles.skeleton} />
                  </div>
                ))}
            </div>
          </Card>
        </div>

        <aside className={styles.sideCol} aria-label="About you">
          <Card title="Profile">
            <div className={styles.profile}>
              <span className={styles.avatar} aria-hidden="true">
                {getInitials(user.name)}
              </span>
              <div className={styles.profileText}>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>Role</dt>
                <dd>
                  <RoleBadge role={user.role} />
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Lozenge appearance={user.isActive ? "success" : "removed"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Lozenge>
                </dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card
            title="Your access"
            footer={
              <>
                <Can roles={[ROLES.ADMIN]}>
                  <Link to={ROUTES.ADMIN} className={styles.footerLink}>
                    Open admin console
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </Can>
                <Can roles={[ROLES.MANAGER, ROLES.MEMBER]}>
                  <p className={styles.muted}>Need more access? Ask a workspace admin.</p>
                </Can>
              </>
            }
          >
            <ul className={styles.permissions}>
              {PERMISSIONS[user.role].map((permission) => (
                <li key={permission}>
                  <span className={styles.permissionIcon}>
                    <Icon name="check" size={14} strokeWidth={2.5} />
                  </span>
                  {permission}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AssignedRow({ task }: { task: DashboardTask }) {
  return (
    <li className={styles.row}>
      <span className={styles.summary}>
        <TaskTypeIcon type={task.type} />
        <Link to={taskPath(task.key)} className={styles.summaryLink}>
          <span className={styles.taskKey}>{task.key}</span>
          <span className={styles.taskTitle}>{task.title}</span>
        </Link>
      </span>
      <span>
        <StatusLozenge status={task.status} />
      </span>
      <span>
        <PriorityIcon priority={task.priority} withLabel />
      </span>
      <span className={styles.due}>
        <DueDate task={task} />
      </span>
    </li>
  );
}

function BoardCard({ task }: { task: DashboardTask }) {
  return (
    <Link to={taskPath(task.key)} className={styles.card}>
      <span className={styles.cardTitle}>{task.title}</span>
      <span className={styles.cardMeta}>
        <TaskTypeIcon type={task.type} size={14} />
        <span className={styles.taskKey}>{task.key}</span>
        <PriorityIcon priority={task.priority} />
        {task.assignee && (
          <span className={styles.cardAssignee} title={task.assignee.name}>
            {getInitials(task.assignee.name)}
          </span>
        )}
      </span>
    </Link>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <svg
        className={styles.emptyArt}
        width="120"
        height="88"
        viewBox="0 0 120 88"
        aria-hidden="true"
      >
        <rect x="14" y="10" width="92" height="68" rx="8" className={styles.artBack} />
        <rect x="24" y="22" width="72" height="12" rx="3" className={styles.artRow} />
        <rect x="24" y="40" width="72" height="12" rx="3" className={styles.artRow} />
        <rect x="24" y="58" width="44" height="12" rx="3" className={styles.artRow} />
        <circle cx="30" cy="28" r="3" className={styles.artDot} />
        <circle cx="30" cy="46" r="3" className={styles.artDot} />
        <circle cx="94" cy="68" r="14" className={styles.artBadge} />
        <path
          d="m88 68 4 4 8-8"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.muted}>{text}</p>
    </div>
  );
}

import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getErrorMessage } from "../../api/api.helper";
import { taskService } from "../../api/services/task.service";
import { APP_NAME } from "../../components/Logo";
import { ProjectTile } from "../../components/projects/ProjectTile";
import { LabelInput } from "../../components/tasks/LabelInput";
import {
  PriorityIcon,
  StatusLozenge,
  TaskTypeIcon,
  DueDate,
} from "../../components/tasks/TaskMeta";
import { TaskFormModal } from "../../components/tasks/TaskFormModal";
import { ActionMenu, type ActionMenuItem } from "../../components/ui/ActionMenu";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { buttonClass } from "../../components/ui/Button/buttonClass";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorState } from "../../components/ui/ErrorState";
import { Lozenge } from "../../components/ui/Lozenge";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextArea } from "../../components/ui/TextArea";
import { TextField } from "../../components/ui/TextField";
import { UserPicker } from "../../components/ui/UserPicker";
import { projectTasksPath, ROUTES } from "../../constants/route.constant";
import {
  TASK_KEY_REGEX,
  TASK_LIMITS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
} from "../../constants/task.constant";
import { useProject } from "../../hooks/useProjects";
import { useTask } from "../../hooks/useTasks";
import type { Task, UpdateTaskInput } from "../../types/task.types";
import { formatDateTime, toDayString } from "../../utils/task.helper";
import styles from "./TaskDetail.module.css";

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export default function TaskDetailPage() {
  const { taskKey = "" } = useParams();
  const key = taskKey.toUpperCase();
  const validKey = TASK_KEY_REGEX.test(key);
  const { data: task, error, reload, setData } = useTask(validKey ? key : "");

  if (!validKey || error?.status === 404 || error?.status === 400) {
    return (
      <ErrorState
        code="404"
        title="Task not found"
        text="This task doesn't exist, was deleted, or you don't have access to it."
        actions={
          <Link to={ROUTES.TASKS} className={buttonClass({ variant: "primary" })}>
            Back to tasks
          </Link>
        }
      />
    );
  }

  if (!task) {
    return error ? (
      <div className={styles.page}>
        <Alert variant="error" title="Couldn't load this task">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      </div>
    ) : (
      <div className={styles.loading}>
        <Spinner size="lg" label="Loading task…" />
      </div>
    );
  }

  return <TaskView task={task} onChange={setData} />;
}

function TaskView({ task, onChange }: { task: Task; onChange: (task: Task) => void }) {
  const navigate = useNavigate();
  const { data: project } = useProject(task.project.key);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { canEdit, canDelete } = task.permissions;
  const archived = task.project.status === "archived";

  // every inline field PATCHes just itself; the server response replaces local state
  const save = async (input: UpdateTaskInput) => {
    setSaving(true);
    setSaveError("");
    try {
      onChange(await taskService.update(task.key, input));
      return true;
    } catch (err) {
      setSaveError(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const menu: ActionMenuItem[] = [];
  if (canEdit)
    menu.push({ label: "Edit all fields", icon: "edit", onSelect: () => setEditing(true) });
  if (canDelete)
    menu.push({ label: "Delete", icon: "trash", danger: true, onSelect: () => setDeleting(true) });

  return (
    <div className={styles.page}>
      <title>{`[${task.key}] ${task.title} · ${APP_NAME}`}</title>

      <nav aria-label="Breadcrumb">
        <ol className={styles.crumbs}>
          <li>
            <Link to={ROUTES.PROJECTS}>Projects</Link>
          </li>
          <li>
            <Link to={projectTasksPath(task.project.key)} className={styles.crumbProject}>
              <ProjectTile projectKey={task.project.key} />
              {task.project.name}
            </Link>
          </li>
          <li className={styles.crumbKey}>
            <TaskTypeIcon type={task.type} />
            <span aria-current="page">{task.key}</span>
          </li>
        </ol>
      </nav>

      {archived && (
        <Alert variant="info">This task belongs to an archived project and is read-only.</Alert>
      )}
      {!archived && !canEdit && (
        <Alert variant="info">You can view this task. Only project members can change it.</Alert>
      )}
      {saveError && <Alert variant="error">{saveError}</Alert>}

      <div className={styles.grid}>
        <main className={styles.main}>
          <InlineTitle task={task} canEdit={canEdit} onSave={(title) => save({ title })} />
          <InlineDescription
            task={task}
            canEdit={canEdit}
            onSave={(description) => save({ description })}
          />
        </main>

        <aside className={styles.side} aria-label="Task details">
          <div className={styles.sideTop}>
            {canEdit ? (
              <Select
                label="Status"
                hideLabel
                className={styles.statusSelect}
                value={task.status}
                disabled={saving}
                options={options(TASK_STATUSES, TASK_STATUS_LABELS)}
                onChange={(event) => save({ status: event.target.value as Task["status"] })}
              />
            ) : (
              <StatusLozenge status={task.status} />
            )}
            <ActionMenu label={`More actions for ${task.key}`} items={menu} />
          </div>

          <section className={styles.details}>
            <h2 className={styles.detailsTitle}>Details</h2>

            <DetailRow label="Assignee">
              {canEdit ? (
                <UserPicker
                  label="Assignee"
                  value={task.assignee ? [task.assignee] : []}
                  candidates={project?.members ?? []}
                  placeholder="Unassigned"
                  onChange={(people) => save({ assigneeId: people[0]?.id ?? null })}
                />
              ) : (
                <PersonValue person={task.assignee} empty="Unassigned" />
              )}
            </DetailRow>

            <DetailRow label="Reporter">
              <PersonValue person={task.reporter} empty="—" />
            </DetailRow>

            <DetailRow label="Priority">
              {canEdit ? (
                <Select
                  label="Priority"
                  hideLabel
                  value={task.priority}
                  disabled={saving}
                  options={options(TASK_PRIORITIES, TASK_PRIORITY_LABELS)}
                  onChange={(event) => save({ priority: event.target.value as Task["priority"] })}
                />
              ) : (
                <PriorityIcon priority={task.priority} withLabel />
              )}
            </DetailRow>

            <DetailRow label="Work type">
              {canEdit ? (
                <Select
                  label="Work type"
                  hideLabel
                  value={task.type}
                  disabled={saving}
                  options={options(TASK_TYPES, TASK_TYPE_LABELS)}
                  onChange={(event) => save({ type: event.target.value as Task["type"] })}
                />
              ) : (
                <span className={styles.inline}>
                  <TaskTypeIcon type={task.type} /> {TASK_TYPE_LABELS[task.type]}
                </span>
              )}
            </DetailRow>

            <DetailRow label="Due date">
              {canEdit ? (
                <DueDateField
                  key={task.dueDate ?? "none"}
                  task={task}
                  disabled={saving}
                  onSave={(dueDate) => save({ dueDate })}
                />
              ) : (
                <DueDate task={task} />
              )}
            </DetailRow>

            <DetailRow label="Labels">
              {canEdit ? (
                <LabelInput
                  label="Labels"
                  value={task.labels}
                  onChange={(labels) => save({ labels })}
                />
              ) : task.labels.length > 0 ? (
                <span className={styles.labels}>
                  {task.labels.map((label) => (
                    <Lozenge key={label}>{label}</Lozenge>
                  ))}
                </span>
              ) : (
                <span className={styles.muted}>None</span>
              )}
            </DetailRow>
          </section>

          <dl className={styles.dates}>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(task.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(task.updatedAt)}</dd>
            </div>
            {task.completedAt && (
              <div>
                <dt>Resolved</dt>
                <dd>{formatDateTime(task.completedAt)}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      {editing && (
        <TaskFormModal
          mode="edit"
          task={task}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            onChange(updated);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${task.key}?`}
          confirmLabel="Delete"
          appearance="danger"
          onConfirm={async () => {
            await taskService.remove(task.key);
            navigate(projectTasksPath(task.project.key), { replace: true });
          }}
          onClose={() => setDeleting(false)}
        >
          <p>
            “{task.title}” will be permanently deleted. This can't be undone, and its key won't be
            reused.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel} aria-hidden="true">
        {label}
      </span>
      <div className={styles.rowValue}>{children}</div>
    </div>
  );
}

function PersonValue({ person, empty }: { person: Task["assignee"]; empty: string }) {
  if (!person) return <span className={styles.muted}>{empty}</span>;
  return (
    <span className={styles.inline}>
      <Avatar name={person.name} inactive={!person.isActive} />
      <span>{person.name}</span>
    </span>
  );
}

function DueDateField({
  task,
  disabled,
  onSave,
}: {
  task: Task;
  disabled: boolean;
  onSave: (dueDate: string | null) => void;
}) {
  const initial = toDayString(task.dueDate);
  const [value, setValue] = useState(initial);
  const commit = () => {
    if (value !== initial) onSave(value || null);
  };
  return (
    <div className={styles.dueField}>
      <TextField
        label="Due date"
        type="date"
        className={styles.hiddenLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      {initial && !disabled && (
        <button type="button" className={styles.inlineLink} onClick={() => onSave(null)}>
          Clear
        </button>
      )}
    </div>
  );
}

function InlineTitle({
  task,
  canEdit,
  onSave,
}: {
  task: Task;
  canEdit: boolean;
  onSave: (title: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (draft === null) {
    return canEdit ? (
      <h1 className={styles.title}>
        <button
          type="button"
          className={styles.titleButton}
          onClick={() => setDraft(task.title)}
          aria-label={`Edit summary: ${task.title}`}
        >
          {task.title}
        </button>
      </h1>
    ) : (
      <h1 className={styles.title}>{task.title}</h1>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return setError("Summary is required");
    if (value === task.title) return setDraft(null);
    if (await onSave(value)) setDraft(null);
  };

  return (
    <form className={styles.inlineForm} onSubmit={submit}>
      <TextField
        label="Summary"
        className={styles.hiddenLabel}
        value={draft}
        autoFocus
        maxLength={TASK_LIMITS.TITLE_MAX}
        error={error}
        onChange={(event) => {
          setDraft(event.target.value);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setDraft(null);
        }}
      />
      <div className={styles.inlineActions}>
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function InlineDescription({
  task,
  canEdit,
  onSave,
}: {
  task: Task;
  canEdit: boolean;
  onSave: (description: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Description</h2>
        {canEdit ? (
          <button
            type="button"
            className={styles.descriptionButton}
            onClick={() => setDraft(task.description)}
            aria-label="Edit description"
          >
            {task.description ? (
              <span className={styles.description}>{task.description}</span>
            ) : (
              <span className={styles.muted}>Add a description…</span>
            )}
          </button>
        ) : task.description ? (
          <p className={styles.description}>{task.description}</p>
        ) : (
          <p className={styles.muted}>No description</p>
        )}
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <form
        className={styles.inlineForm}
        onSubmit={async (event) => {
          event.preventDefault();
          if (draft.trim() === task.description) return setDraft(null);
          if (await onSave(draft)) setDraft(null);
        }}
      >
        <TextArea
          label="Description"
          rows={8}
          autoFocus
          value={draft}
          maxLength={TASK_LIMITS.DESCRIPTION_MAX}
          hint={`${draft.length}/${TASK_LIMITS.DESCRIPTION_MAX}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDraft(null);
          }}
        />
        <div className={styles.inlineActions}>
          <Button type="submit" size="sm">
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

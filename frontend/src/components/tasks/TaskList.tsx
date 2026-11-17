import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getErrorMessage } from "../../api/api.helper";
import { taskService } from "../../api/services/task.service";
import { TASK_STATUS_LABELS } from "../../constants/task.constant";
import { taskPath } from "../../constants/route.constant";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useTasks } from "../../hooks/useTasks";
import type { Task, TaskSort, TaskStatus } from "../../types/task.types";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { Pagination } from "../ui/Pagination";
import { TaskFilters } from "./TaskFilters";
import { TaskFormModal, type ProjectChoice } from "./TaskFormModal";
import { TaskTable } from "./TaskTable";
import {
  activeFilterCount,
  CLEARED_FILTERS,
  readTaskParams,
  writeTaskParams,
} from "./tasks.params";
import styles from "./TaskList.module.css";

interface TaskListProps {
  // one project's tasks; omitted → every task the user can see
  projectKey?: string;
  // cross-project list: projects offered in the project filter …
  projectChoices?: ProjectChoice[];
  // … and the ones a task can be created in (the user must be on the project)
  createChoices?: ProjectChoice[];
  // project a new task can be created in (scoped list) or the choices exist (global)
  canCreate: boolean;
  // the page owns the header button; TaskList owns the modal
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}

type Notice = { text: string; taskKey?: string } | null;

export function TaskList({
  projectKey,
  projectChoices,
  createChoices,
  canCreate,
  creating,
  onCreatingChange,
}: TaskListProps) {
  const [params, setParams] = useSearchParams();
  const query = readTaskParams(params);
  const global = !projectKey;

  const [searchInput, setSearchInput] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [actionError, setActionError] = useState("");

  const { data, loading, error, reload } = useTasks(
    { ...query, project: global ? query.project : undefined },
    projectKey
  );

  const update = (changes: Parameters<typeof writeTaskParams>[1]) =>
    setParams((current) => writeTaskParams(current, changes), { replace: true });

  // debounced search → URL (resets to page 1)
  useEffect(() => {
    if (debouncedSearch !== query.search) {
      setParams((current) => writeTaskParams(current, { q: debouncedSearch, page: 1 }), {
        replace: true,
      });
    }
  }, [debouncedSearch, query.search, setParams]);

  // e.g. last task on the last page was deleted → step back to a page that exists
  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (!loading && totalPages > 0 && query.page > totalPages) {
      setParams((current) => writeTaskParams(current, { page: totalPages }), { replace: true });
    }
  }, [loading, totalPages, query.page, setParams]);

  const toggleSort = (sort: TaskSort) => {
    const order =
      query.sort === sort
        ? query.order === "asc"
          ? "desc"
          : "asc"
        : sort === "key" || sort === "title"
          ? "asc"
          : "desc";
    update({ sort, order, page: 1 });
  };

  const changeStatus = async (task: Task, status: TaskStatus) => {
    setActionError("");
    try {
      await taskService.update(task.key, { status });
      setNotice({ text: `moved to ${TASK_STATUS_LABELS[status]}.`, taskKey: task.key });
      reload();
    } catch (err) {
      setActionError(`Couldn't update ${task.key}: ${getErrorMessage(err)}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await taskService.remove(deleting.key);
    setNotice({ text: `${deleting.key} was deleted.` });
    setDeleting(null);
    reload();
  };

  const clearFilters = () => {
    setSearchInput("");
    update(global ? CLEARED_FILTERS : { ...CLEARED_FILTERS, project: undefined });
  };

  const filterCount = activeFilterCount(query, global);
  const tasks = data?.tasks ?? [];
  const showSkeleton = loading && !data;
  const isEmpty = !loading && !error && data && tasks.length === 0;

  return (
    <>
      {notice && (
        <Alert variant="success">
          {notice.taskKey ? (
            <>
              <Link to={taskPath(notice.taskKey)} className={styles.noticeLink}>
                {notice.taskKey}
              </Link>{" "}
              {notice.text}
            </>
          ) : (
            notice.text
          )}
        </Alert>
      )}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      <TaskFilters
        query={query}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onChange={update}
        onClear={clearFilters}
        activeCount={filterCount}
        projectChoices={global ? projectChoices : undefined}
      />

      {error && (
        <Alert variant="error" title="Couldn't load tasks">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      )}

      <div className={styles.card}>
        {isEmpty ? (
          filterCount > 0 ? (
            <EmptyState
              icon="search"
              title="No tasks match your filters"
              text="Try removing a filter or searching for something else."
              actions={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="task"
              title={canCreate ? "Create your first task" : "No tasks yet"}
              text={
                canCreate
                  ? "Break the work down into tasks, then assign, prioritise and schedule them."
                  : global
                    ? "Tasks from the projects you belong to show up here."
                    : "This project doesn't have any tasks yet."
              }
              actions={
                canCreate && <Button onClick={() => onCreatingChange(true)}>Create task</Button>
              }
            />
          )
        ) : (
          <TaskTable
            tasks={tasks}
            loading={loading}
            showSkeleton={showSkeleton}
            sort={query.sort}
            order={query.order}
            onSort={toggleSort}
            showProject={global}
            onEdit={setEditing}
            onDelete={setDeleting}
            onStatusChange={changeStatus}
          />
        )}
        {data && data.pagination.total > 0 && (
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={data.pagination.limit}
            noun={data.pagination.total === 1 ? "task" : "tasks"}
            onPageChange={(page) => update({ page })}
          />
        )}
      </div>

      {creating && (
        <TaskFormModal
          mode="create"
          projectKey={projectKey}
          projectChoices={global ? (createChoices ?? []) : undefined}
          onClose={() => onCreatingChange(false)}
          onSaved={(task) => {
            onCreatingChange(false);
            setNotice({ text: "was created.", taskKey: task.key });
            reload();
          }}
        />
      )}

      {editing && (
        <TaskFormModal
          mode="edit"
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={(task) => {
            setEditing(null);
            setNotice({ text: "was updated.", taskKey: task.key });
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.key}?`}
          confirmLabel="Delete"
          appearance="danger"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            “{deleting.title}” will be permanently deleted. This can't be undone, and its key won't
            be reused.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

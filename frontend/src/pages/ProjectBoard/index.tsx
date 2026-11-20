import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Board } from "../../components/board/Board";
import { ProjectPageShell } from "../../components/projects/ProjectPageShell";
import { TaskFilters } from "../../components/tasks/TaskFilters";
import { TaskFormModal } from "../../components/tasks/TaskFormModal";
import {
  activeFilterCount,
  CLEARED_FILTERS,
  readTaskParams,
  writeTaskParams,
} from "../../components/tasks/tasks.params";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { taskPath } from "../../constants/route.constant";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useBoard } from "../../hooks/useTasks";
import type { ProjectDetail } from "../../types/project.types";
import { forgetBoard, rememberBoard } from "../../utils/lastBoard";
import styles from "./ProjectBoard.module.css";

const remember = (project: ProjectDetail) => rememberBoard(project.key);

export default function ProjectBoardPage() {
  const { key = "" } = useParams();
  const projectKey = key.toUpperCase();
  const [creating, setCreating] = useState(false);
  const forget = useCallback(() => forgetBoard(projectKey), [projectKey]);

  return (
    <ProjectPageShell
      projectKey={projectKey}
      view="board"
      onCreate={() => setCreating(true)}
      onLoaded={remember}
      onNotFound={forget}
    >
      {({ project, canWork }) => (
        <ProjectBoardView
          project={project}
          canWork={canWork}
          creating={creating}
          onCreatingChange={setCreating}
        />
      )}
    </ProjectPageShell>
  );
}

interface ProjectBoardViewProps {
  project: ProjectDetail;
  canWork: boolean;
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}

function ProjectBoardView({ project, canWork, creating, onCreatingChange }: ProjectBoardViewProps) {
  const [params, setParams] = useSearchParams();
  // status, sort and page belong to the list; the board ignores them
  const query = { ...readTaskParams(params), status: [] };
  const [searchInput, setSearchInput] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const [created, setCreated] = useState<string | null>(null);

  const { search, priority, type, assignee, due } = query;
  const { data, loading, error, reload } = useBoard(project.key, {
    search,
    priority,
    type,
    assignee,
    due,
  });

  const update = (changes: Parameters<typeof writeTaskParams>[1]) =>
    setParams((current) => writeTaskParams(current, { ...changes, page: undefined }), {
      replace: true,
    });

  useEffect(() => {
    if (debouncedSearch !== query.search) {
      setParams((current) => writeTaskParams(current, { q: debouncedSearch }), { replace: true });
    }
  }, [debouncedSearch, query.search, setParams]);

  const clearFilters = () => {
    setSearchInput("");
    update({ ...CLEARED_FILTERS, project: undefined, status: undefined });
  };

  const filterCount = activeFilterCount(query, false);
  const nothingMatches =
    data && filterCount > 0 && data.columns.every((column) => column.total === 0);
  const readOnlyMember = data && !data.canEdit && project.status === "active";

  return (
    <>
      {created && (
        <Alert variant="success">
          <Link to={taskPath(created)} className={styles.noticeLink}>
            {created}
          </Link>{" "}
          was created.
        </Alert>
      )}

      <TaskFilters
        query={query}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onChange={update}
        onClear={clearFilters}
        activeCount={filterCount}
        showStatus={false}
      />

      {readOnlyMember && (
        <Alert variant="info">
          You can view this board, but only members of {project.name} can move its tasks.
        </Alert>
      )}
      {nothingMatches && (
        <Alert variant="info" title="No tasks match your filters">
          Try removing a filter or{" "}
          <button type="button" className={styles.inlineLink} onClick={clearFilters}>
            clear them all
          </button>
          .
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Couldn't load the board">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      )}

      {data ? (
        <div aria-busy={loading || undefined} className={loading ? styles.refreshing : undefined}>
          <Board data={data} onReload={reload} />
        </div>
      ) : (
        !error && (
          <div className={styles.loading}>
            <Spinner size="lg" label="Loading board…" />
          </div>
        )
      )}

      {creating && canWork && (
        <TaskFormModal
          mode="create"
          projectKey={project.key}
          onClose={() => onCreatingChange(false)}
          onSaved={(task) => {
            onCreatingChange(false);
            setCreated(task.key);
            reload();
          }}
        />
      )}
    </>
  );
}

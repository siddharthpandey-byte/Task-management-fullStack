import { Link, Navigate } from "react-router";
import { APP_NAME } from "../../components/Logo";
import { ProjectTile } from "../../components/projects/ProjectTile";
import { Alert } from "../../components/ui/Alert";
import { buttonClass } from "../../components/ui/Button/buttonClass";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { projectBoardPath, ROUTES } from "../../constants/route.constant";
import { useProjects } from "../../hooks/useProjects";
import { readLastBoard } from "../../utils/lastBoard";
import styles from "./BoardHome.module.css";

// one page of active projects is plenty for a picker; the Projects page has search
const PICKER_LIMIT = 50;

// Sidebar "Board": reopen the last board, or pick a project when there isn't one
// (other boards are a click away via a project's List/Board tabs)
export default function BoardHomePage() {
  const last = readLastBoard();
  if (last) return <Navigate to={projectBoardPath(last)} replace />;
  return <ProjectPicker />;
}

function ProjectPicker() {
  const { data, error, reload } = useProjects({
    status: "active",
    sort: "name",
    order: "asc",
    limit: PICKER_LIMIT,
  });
  const projects = data?.projects ?? [];

  return (
    <div className={styles.page}>
      <title>{`Boards · ${APP_NAME}`}</title>
      <PageHeader
        breadcrumbs={[{ label: APP_NAME, to: ROUTES.DASHBOARD }, { label: "Boards" }]}
        title="Boards"
        description="Choose a project to open its board."
      />

      {error && (
        <Alert variant="error" title="Couldn't load your projects">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      )}

      {!data && !error && (
        <div className={styles.loading}>
          <Spinner size="lg" label="Loading projects…" />
        </div>
      )}

      {data && projects.length === 0 && (
        <EmptyState
          icon="board"
          title="No boards yet"
          text="A project's board appears here once you're a member of an active project."
          actions={
            <Link to={ROUTES.PROJECTS} className={buttonClass({ variant: "primary" })}>
              Go to projects
            </Link>
          }
        />
      )}

      {projects.length > 0 && (
        <ul className={styles.grid} aria-label="Projects">
          {projects.map((project) => (
            <li key={project.id}>
              <Link to={projectBoardPath(project.key)} className={styles.tile}>
                <ProjectTile projectKey={project.key} size="lg" />
                <span className={styles.text}>
                  <span className={styles.name}>{project.name}</span>
                  <span className={styles.meta}>
                    {project.key} · Lead: {project.lead.name}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.pagination.total > projects.length && (
        <p className={styles.more}>
          Showing {projects.length} of {data.pagination.total} projects.{" "}
          <Link to={ROUTES.PROJECTS}>Find a project</Link>
        </p>
      )}
    </div>
  );
}

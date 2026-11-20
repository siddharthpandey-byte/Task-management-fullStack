import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { APP_NAME } from "../Logo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { buttonClass } from "../ui/Button/buttonClass";
import { ErrorState } from "../ui/ErrorState";
import { Icon } from "../ui/Icon";
import { Lozenge } from "../ui/Lozenge";
import { PageHeader } from "../ui/PageHeader";
import { Spinner } from "../ui/Spinner";
import { projectSettingsPath, ROUTES } from "../../constants/route.constant";
import { useAuth } from "../../hooks/useAuth";
import { useProject } from "../../hooks/useProjects";
import type { ProjectDetail } from "../../types/project.types";
import { canWorkOnProject } from "../../utils/task.helper";
import { ProjectTile } from "./ProjectTile";
import { ProjectViewTabs, type ProjectView } from "./ProjectViewTabs";
import styles from "./ProjectPageShell.module.css";

export interface ProjectPageContext {
  project: ProjectDetail;
  // the signed-in user may create and change tasks here
  canWork: boolean;
}

interface ProjectPageShellProps {
  projectKey: string;
  view: ProjectView;
  // the header's "Create task" button; omitted → no button
  onCreate?: () => void;
  // a project became visible (e.g. remember it as the last board opened)
  onLoaded?: (project: ProjectDetail) => void;
  // a project with this key doesn't exist or isn't visible
  onNotFound?: () => void;
  children: (context: ProjectPageContext) => ReactNode;
}

// Loading, 404 and error handling plus the header shared by a project's views
export function ProjectPageShell({
  projectKey,
  view,
  onCreate,
  onLoaded,
  onNotFound,
  children,
}: ProjectPageShellProps) {
  const { user } = useAuth();
  const { data: project, error, reload } = useProject(projectKey);
  const notFound = error?.status === 404 || error?.status === 400;

  useEffect(() => {
    if (project) onLoaded?.(project);
  }, [project, onLoaded]);
  useEffect(() => {
    if (notFound) onNotFound?.();
  }, [notFound, onNotFound]);

  if (notFound) {
    return (
      <ErrorState
        code="404"
        title="Project not found"
        text="This project doesn't exist, or you don't have access to it."
        actions={
          <Link to={ROUTES.PROJECTS} className={buttonClass({ variant: "primary" })}>
            Back to projects
          </Link>
        }
      />
    );
  }

  if (!project) {
    return error ? (
      <div className={styles.page}>
        <Alert variant="error" title="Couldn't load this project">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      </div>
    ) : (
      <div className={styles.loading}>
        <Spinner size="lg" label="Loading project…" />
      </div>
    );
  }

  const archived = project.status === "archived";
  const canWork = canWorkOnProject(user, project);

  return (
    <div className={`${styles.page} ${view === "board" ? styles.wide : ""}`}>
      <title>{`${project.key} ${view === "board" ? "board" : "tasks"} · ${APP_NAME}`}</title>
      <PageHeader
        breadcrumbs={[{ label: "Projects", to: ROUTES.PROJECTS }, { label: project.name }]}
        title={
          <span className={styles.title}>
            <ProjectTile projectKey={project.key} size="lg" />
            <span>{project.name}</span>
            {archived && <Lozenge>Archived</Lozenge>}
          </span>
        }
        description={project.description || undefined}
        actions={
          <>
            <Link
              to={projectSettingsPath(project.key)}
              className={buttonClass({ variant: "secondary" })}
            >
              <Icon name="settings" size={16} /> Project settings
            </Link>
            {canWork && onCreate && (
              <Button iconBefore={<Icon name="plus" size={16} />} onClick={onCreate}>
                Create task
              </Button>
            )}
          </>
        }
      />

      <ProjectViewTabs projectKey={project.key} />

      {archived && (
        <Alert variant="info" title="This project is archived">
          Its tasks are read-only. A project lead or admin can restore it from project settings.
        </Alert>
      )}

      {children({ project, canWork })}
    </div>
  );
}

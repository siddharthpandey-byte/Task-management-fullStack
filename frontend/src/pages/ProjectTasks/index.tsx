import { useState } from "react";
import { Link, useParams } from "react-router";
import { APP_NAME } from "../../components/Logo";
import { ProjectTile } from "../../components/projects/ProjectTile";
import { TaskList } from "../../components/tasks/TaskList";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { buttonClass } from "../../components/ui/Button/buttonClass";
import { ErrorState } from "../../components/ui/ErrorState";
import { Icon } from "../../components/ui/Icon";
import { Lozenge } from "../../components/ui/Lozenge";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { projectSettingsPath, ROUTES } from "../../constants/route.constant";
import { useAuth } from "../../hooks/useAuth";
import { useProject } from "../../hooks/useProjects";
import { canWorkOnProject } from "../../utils/task.helper";
import styles from "./ProjectTasks.module.css";

export default function ProjectTasksPage() {
  const { key = "" } = useParams();
  const { user } = useAuth();
  const { data: project, error, reload } = useProject(key.toUpperCase());
  const [creating, setCreating] = useState(false);

  if (error?.status === 404 || error?.status === 400) {
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
  const canCreate = canWorkOnProject(user, project);

  return (
    <div className={styles.page}>
      <title>{`${project.key} tasks · ${APP_NAME}`}</title>
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
            {canCreate && (
              <Button iconBefore={<Icon name="plus" size={16} />} onClick={() => setCreating(true)}>
                Create task
              </Button>
            )}
          </>
        }
      />

      {archived && (
        <Alert variant="info" title="This project is archived">
          Its tasks are read-only. A project lead or admin can restore it from project settings.
        </Alert>
      )}

      <TaskList
        projectKey={project.key}
        canCreate={canCreate}
        creating={creating}
        onCreatingChange={setCreating}
      />
    </div>
  );
}

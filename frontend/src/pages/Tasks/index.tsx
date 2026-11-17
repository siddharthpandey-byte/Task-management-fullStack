import { useMemo, useState } from "react";
import { APP_NAME } from "../../components/Logo";
import { TaskList } from "../../components/tasks/TaskList";
import type { ProjectChoice } from "../../components/tasks/TaskFormModal";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { PageHeader } from "../../components/ui/PageHeader";
import { ROUTES } from "../../constants/route.constant";
import { useAuth } from "../../hooks/useAuth";
import { useProjects } from "../../hooks/useProjects";
import { canWorkOnProject } from "../../utils/task.helper";
import styles from "./Tasks.module.css";

// active projects for the filter and the create form (the API caps a page at 100)
const PROJECT_QUERY = { status: "active", limit: 100, sort: "name", order: "asc" } as const;

export default function TasksPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data } = useProjects(PROJECT_QUERY);

  const { visible, workable } = useMemo(() => {
    const projects = data?.projects ?? [];
    const toChoice = (p: { key: string; name: string }): ProjectChoice => ({
      key: p.key,
      name: p.name,
    });
    return {
      visible: projects.map(toChoice),
      workable: projects.filter((p) => canWorkOnProject(user, p)).map(toChoice),
    };
  }, [data, user]);

  const canCreate = workable.length > 0;

  return (
    <div className={styles.page}>
      <title>{`Tasks · ${APP_NAME}`}</title>
      <PageHeader
        breadcrumbs={[{ label: APP_NAME, to: ROUTES.DASHBOARD }, { label: "Tasks" }]}
        title="Tasks"
        description="Work items across the projects you can see."
        actions={
          canCreate && (
            <Button iconBefore={<Icon name="plus" size={16} />} onClick={() => setCreating(true)}>
              Create task
            </Button>
          )
        }
      />
      <TaskList
        projectChoices={visible}
        createChoices={workable}
        canCreate={canCreate}
        creating={creating}
        onCreatingChange={setCreating}
      />
    </div>
  );
}

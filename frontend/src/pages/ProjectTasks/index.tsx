import { useState } from "react";
import { useParams } from "react-router";
import { ProjectPageShell } from "../../components/projects/ProjectPageShell";
import { TaskList } from "../../components/tasks/TaskList";

export default function ProjectTasksPage() {
  const { key = "" } = useParams();
  const [creating, setCreating] = useState(false);

  return (
    <ProjectPageShell projectKey={key.toUpperCase()} view="list" onCreate={() => setCreating(true)}>
      {({ project, canWork }) => (
        <TaskList
          projectKey={project.key}
          canCreate={canWork}
          creating={creating}
          onCreatingChange={setCreating}
        />
      )}
    </ProjectPageShell>
  );
}

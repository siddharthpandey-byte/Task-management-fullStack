import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useParams } from "react-router";
import { projectService } from "../../api/services/project.service";
import { APP_NAME } from "../../components/Logo";
import { LEAD_ROLES, toFormError } from "../../components/projects/project.form";
import { ProjectTile } from "../../components/projects/ProjectTile";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { buttonClass } from "../../components/ui/Button/buttonClass";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorState } from "../../components/ui/ErrorState";
import { Lozenge } from "../../components/ui/Lozenge";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { TextArea } from "../../components/ui/TextArea";
import { TextField } from "../../components/ui/TextField";
import { UserPicker } from "../../components/ui/UserPicker";
import { PROJECT_LIMITS } from "../../constants/project.constant";
import { ROUTES } from "../../constants/route.constant";
import { useAuth } from "../../hooks/useAuth";
import { useProject } from "../../hooks/useProjects";
import type { ProjectDetail, UpdateProjectInput } from "../../types/project.types";
import { applyServerErrors } from "../../utils/form.helper";
import { canManageProject, formatDate } from "../../utils/project.helper";
import {
  projectDetailsSchema,
  type ProjectDetailsFormValues,
} from "../../validation/project.schemas";
import styles from "./ProjectSettings.module.css";

export default function ProjectSettingsPage() {
  const { key = "" } = useParams();
  const { user } = useAuth();
  const { data: project, loading, error, reload, setData } = useProject(key.toUpperCase());
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);

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

  const canManage = canManageProject(user, project);
  const archived = project.status === "archived";
  const readOnly = !canManage || archived;

  const toggleArchive = async () => {
    const updated = archived
      ? await projectService.restore(project.key)
      : await projectService.archive(project.key);
    setData(updated);
    setConfirming(false);
    setNotice(archived ? "Project restored." : "Project archived.");
  };

  return (
    <div className={styles.page}>
      <title>{`${project.name} settings · ${APP_NAME}`}</title>
      <PageHeader
        breadcrumbs={[
          { label: "Projects", to: ROUTES.PROJECTS },
          { label: project.name },
          { label: "Project settings" },
        ]}
        title={
          <span className={styles.title}>
            <ProjectTile projectKey={project.key} size="lg" />
            <span>Details</span>
            {archived && <Lozenge>Archived</Lozenge>}
          </span>
        }
        description={loading ? "Refreshing…" : undefined}
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {archived ? (
        <Alert variant="warning" title="This project is archived">
          It's read-only.{" "}
          {canManage
            ? "Restore it to make changes."
            : "Ask the project lead or an admin to restore it."}
        </Alert>
      ) : (
        !canManage && (
          <Alert variant="info">
            You can view these details. Only the project lead or an admin can change them.
          </Alert>
        )
      )}

      <div className={styles.grid}>
        <Card title="Project details">
          <DetailsForm
            // remount with fresh defaults whenever the server copy changes
            key={`${project.id}:${project.updatedAt}`}
            project={project}
            readOnly={readOnly}
            onSaved={(updated) => {
              setData(updated);
              setNotice("Your changes were saved.");
            }}
          />
        </Card>

        <div className={styles.side}>
          <Card title="About">
            <dl className={styles.meta}>
              <div>
                <dt>Key</dt>
                <dd className={styles.mono}>{project.key}</dd>
              </div>
              <div>
                <dt>Lead</dt>
                <dd className={styles.person}>
                  <Avatar name={project.lead.name} inactive={!project.lead.isActive} />
                  {project.lead.name}
                </dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>{project.members.length}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(project.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(project.updatedAt)}</dd>
              </div>
              {archived && (
                <div>
                  <dt>Archived</dt>
                  <dd>{formatDate(project.archivedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {canManage && (
            <Card
              title={archived ? "Restore project" : "Archive project"}
              className={styles.danger}
            >
              <p className={styles.dangerText}>
                {archived
                  ? "Make this project active again so its details can be edited."
                  : "Archiving makes the project read-only and hides it from the active list. You can restore it later."}
              </p>
              <div>
                <Button
                  variant={archived ? "primary" : "danger"}
                  onClick={() => setConfirming(true)}
                >
                  {archived ? "Restore project" : "Archive project"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={archived ? `Restore ${project.name}?` : `Archive ${project.name}?`}
          confirmLabel={archived ? "Restore" : "Archive"}
          appearance={archived ? "primary" : "danger"}
          onConfirm={toggleArchive}
          onClose={() => setConfirming(false)}
        >
          <p>
            {archived
              ? "The project becomes active again."
              : "The project becomes read-only until it is restored."}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

interface DetailsFormProps {
  project: ProjectDetail;
  readOnly: boolean;
  onSaved: (project: ProjectDetail) => void;
}

function DetailsForm({ project, readOnly, onSaved }: DetailsFormProps) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<ProjectDetailsFormValues>({
    resolver: zodResolver(projectDetailsSchema),
    mode: "onTouched",
    defaultValues: {
      name: project.name,
      description: project.description,
      lead: project.lead,
      // the lead is shown in its own field
      members: project.members.filter((m) => m.id !== project.lead.id),
    },
  });
  const lead = useWatch({ control, name: "lead" });
  const description = useWatch({ control, name: "description" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    // send only what changed
    const changes: UpdateProjectInput = {};
    if (dirtyFields.name) changes.name = values.name;
    if (dirtyFields.description) changes.description = values.description;
    if (dirtyFields.lead && values.lead) changes.leadId = values.lead.id;
    // members only when edited: a lead-only change keeps the previous lead on the team (server-side)
    if (dirtyFields.members) changes.memberIds = values.members.map((m) => m.id);
    try {
      onSaved(await projectService.update(project.key, changes));
    } catch (error) {
      setServerError(
        applyServerErrors(toFormError(error), setError, ["name", "description", "lead", "members"])
      );
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <fieldset className={styles.fieldset} disabled={readOnly || isSubmitting}>
        <legend className="visually-hidden">Project details</legend>
        <TextField
          label="Name"
          required
          maxLength={PROJECT_LIMITS.NAME_MAX}
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label="Key"
          value={project.key}
          readOnly
          disabled
          className={styles.keyField}
          hint="Project keys can't be changed."
        />
        <TextArea
          label="Description"
          rows={5}
          maxLength={PROJECT_LIMITS.DESCRIPTION_MAX}
          placeholder={readOnly ? "No description" : "What is this project about?"}
          error={errors.description?.message}
          hint={readOnly ? undefined : `${description.length}/${PROJECT_LIMITS.DESCRIPTION_MAX}`}
          {...register("description")}
        />
        <Controller
          control={control}
          name="lead"
          render={({ field }) => (
            <UserPicker
              label="Project lead"
              required
              disabled={readOnly || isSubmitting}
              value={field.value ? [field.value] : []}
              onChange={(people) => field.onChange(people[0] ?? null)}
              onBlur={field.onBlur}
              allowedRoles={[...LEAD_ROLES]}
              placeholder="Search admins and managers…"
              error={errors.lead?.message}
              hint={readOnly ? undefined : "The lead can edit and archive the project."}
            />
          )}
        />
        <Controller
          control={control}
          name="members"
          render={({ field }) => (
            <UserPicker
              label="Members"
              multiple
              disabled={readOnly || isSubmitting}
              max={PROJECT_LIMITS.MEMBERS_MAX - 1}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              excludeIds={lead ? [lead.id] : []}
              error={errors.members?.message}
              hint={readOnly ? undefined : "Members can see this project."}
            />
          )}
        />
      </fieldset>

      {!readOnly && (
        <div className={styles.actions}>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="ghost" onClick={() => reset()} disabled={!isDirty || isSubmitting}>
            Discard
          </Button>
        </div>
      )}
    </form>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { projectService } from "../../api/services/project.service";
import { LEAD_ROLES, toFormError } from "../../components/projects/project.form";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextArea } from "../../components/ui/TextArea";
import { TextField } from "../../components/ui/TextField";
import { UserPicker } from "../../components/ui/UserPicker";
import { PROJECT_KEY_MAX, PROJECT_LIMITS } from "../../constants/project.constant";
import { useAuth } from "../../hooks/useAuth";
import type { ProjectDetail } from "../../types/project.types";
import { applyServerErrors } from "../../utils/form.helper";
import { suggestProjectKey } from "../../utils/project.helper";
import {
  createProjectSchema,
  type CreateProjectFormValues,
} from "../../validation/project.schemas";
import styles from "./Projects.module.css";

const FORM_ID = "create-project-form";

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (project: ProjectDetail) => void;
}

export function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const { user } = useAuth();
  const [serverError, setServerError] = useState("");
  // stop auto-suggesting once the user types their own key
  const [keyEdited, setKeyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      key: "",
      description: "",
      // the creator leads by default (only admins/managers can open this)
      lead: user ? { ...user } : null,
      members: [],
    },
  });
  const lead = useWatch({ control, name: "lead" });
  const description = useWatch({ control, name: "description" });

  const nameField = register("name", {
    onChange: (event) => {
      if (!keyEdited) setValue("key", suggestProjectKey(event.target.value));
    },
  });
  const keyField = register("key", {
    onChange: (event) => {
      setKeyEdited(true);
      // keys are uppercase; normalise as the user types
      setValue(
        "key",
        String(event.target.value)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
      );
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const project = await projectService.create({
        name: values.name,
        key: values.key,
        description: values.description || undefined,
        leadId: values.lead?.id,
        memberIds: values.members.map((m) => m.id),
      });
      onCreated(project);
    } catch (error) {
      setServerError(
        applyServerErrors(toFormError(error), setError, [
          "name",
          "key",
          "description",
          "lead",
          "members",
        ])
      );
    }
  });

  return (
    <Modal
      title="Create project"
      description="Projects group your team's work. You can change these details later."
      onClose={onClose}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={onSubmit} noValidate>
        {serverError && <Alert variant="error">{serverError}</Alert>}
        <p className={styles.required}>
          Required fields are marked with an asterisk <span aria-hidden="true">*</span>
        </p>

        <TextField
          label="Name"
          required
          placeholder="e.g. Website revamp"
          autoFocus
          maxLength={PROJECT_LIMITS.NAME_MAX}
          error={errors.name?.message}
          {...nameField}
        />
        <TextField
          label="Key"
          required
          placeholder="e.g. WEB"
          maxLength={PROJECT_KEY_MAX}
          autoCapitalize="characters"
          spellCheck={false}
          className={styles.keyField}
          error={errors.key?.message}
          hint="Used as a prefix for work items (e.g. WEB-12). It can't be changed later."
          {...keyField}
        />
        <TextArea
          label="Description"
          placeholder="What is this project about?"
          maxLength={PROJECT_LIMITS.DESCRIPTION_MAX}
          error={errors.description?.message}
          hint={`${description.length}/${PROJECT_LIMITS.DESCRIPTION_MAX}`}
          {...register("description")}
        />
        <Controller
          control={control}
          name="lead"
          render={({ field }) => (
            <UserPicker
              label="Project lead"
              required
              value={field.value ? [field.value] : []}
              onChange={(people) => field.onChange(people[0] ?? null)}
              onBlur={field.onBlur}
              allowedRoles={[...LEAD_ROLES]}
              placeholder="Search admins and managers…"
              error={errors.lead?.message}
              hint="The lead can edit and archive the project."
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
              max={PROJECT_LIMITS.MEMBERS_MAX - 1}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              excludeIds={lead ? [lead.id] : []}
              error={errors.members?.message}
              hint="Members can see this project. The lead is always a member."
            />
          )}
        />
      </form>
    </Modal>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { taskService } from "../../api/services/task.service";
import {
  TASK_LIMITS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
} from "../../constants/task.constant";
import { useAuth } from "../../hooks/useAuth";
import { useProject } from "../../hooks/useProjects";
import type { Task } from "../../types/task.types";
import { applyServerErrors } from "../../utils/form.helper";
import { taskFormSchema, type TaskFormValues } from "../../validation/task.schemas";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { TextArea } from "../ui/TextArea";
import { TextField } from "../ui/TextField";
import { UserPicker } from "../ui/UserPicker";
import { LabelInput } from "./LabelInput";
import {
  TASK_FORM_FIELDS,
  taskToFormValues,
  toCreateInput,
  toTaskFormError,
  toUpdateInput,
} from "./task.form";
import styles from "./TaskFormModal.module.css";

const FORM_ID = "task-form";

export interface ProjectChoice {
  key: string;
  name: string;
}

type TaskFormModalProps = {
  onClose: () => void;
  onSaved: (task: Task) => void;
} & (
  | {
      mode: "create";
      // fixed project (project page) …
      projectKey?: string;
      // … or let the user pick one (cross-project list)
      projectChoices?: ProjectChoice[];
    }
  | { mode: "edit"; task: Task }
);

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export function TaskFormModal(props: TaskFormModalProps) {
  const { onClose, onSaved } = props;
  const { user } = useAuth();
  const [serverError, setServerError] = useState("");
  const editing = props.mode === "edit";
  const choices = props.mode === "create" ? props.projectChoices : undefined;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting, dirtyFields, isDirty },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    mode: "onTouched",
    defaultValues:
      props.mode === "edit"
        ? taskToFormValues(props.task)
        : {
            projectKey: props.projectKey ?? (choices?.length === 1 ? choices[0].key : ""),
            title: "",
            description: "",
            type: "task",
            status: "todo",
            priority: "medium",
            assignee: null,
            dueDate: "",
            labels: [],
          },
  });

  const projectKey = useWatch({ control, name: "projectKey" });
  const assignee = useWatch({ control, name: "assignee" });
  const description = useWatch({ control, name: "description" });

  // assignees come from the chosen project's members
  const project = useProject(projectKey);
  const members = project.data?.members ?? [];
  const meOnProject = !!user && members.some((m) => m.id === user.id && m.isActive);

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      if (props.mode === "edit") {
        const input = toUpdateInput(values, dirtyFields);
        if (Object.keys(input).length === 0) return onClose();
        onSaved(await taskService.update(props.task.key, input));
      } else {
        onSaved(await taskService.create(values.projectKey, toCreateInput(values)));
      }
    } catch (error) {
      setServerError(applyServerErrors(toTaskFormError(error), setError, TASK_FORM_FIELDS));
    }
  });

  const submitLabel = editing
    ? isSubmitting
      ? "Saving…"
      : "Save changes"
    : isSubmitting
      ? "Creating…"
      : "Create";

  return (
    <Modal
      title={editing ? `Edit ${props.task.key}` : "Create task"}
      size="lg"
      onClose={onClose}
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            loading={isSubmitting}
            disabled={editing && !isDirty}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={onSubmit} noValidate>
        {serverError && <Alert variant="error">{serverError}</Alert>}
        <p className={styles.required}>
          Required fields are marked with an asterisk <span aria-hidden="true">*</span>
        </p>

        <div className={styles.row}>
          {choices && (
            <Select
              label="Project"
              required
              options={[
                { value: "", label: choices.length ? "Select a project" : "No projects available" },
                ...choices.map((c) => ({ value: c.key, label: `${c.name} (${c.key})` })),
              ]}
              error={errors.projectKey?.message}
              {...register("projectKey", {
                // a different project has different members
                onChange: () => setValue("assignee", null),
              })}
            />
          )}
          <Select
            label="Work type"
            required
            options={options(TASK_TYPES, TASK_TYPE_LABELS)}
            error={errors.type?.message}
            {...register("type")}
          />
        </div>

        <TextField
          label="Summary"
          required
          autoFocus
          placeholder="What needs to be done?"
          maxLength={TASK_LIMITS.TITLE_MAX}
          error={errors.title?.message}
          {...register("title")}
        />
        <TextArea
          label="Description"
          rows={5}
          placeholder="Add more detail, acceptance criteria, links…"
          maxLength={TASK_LIMITS.DESCRIPTION_MAX}
          error={errors.description?.message}
          hint={`${description.length}/${TASK_LIMITS.DESCRIPTION_MAX}`}
          {...register("description")}
        />

        <div className={styles.row}>
          <Select
            label="Status"
            options={options(TASK_STATUSES, TASK_STATUS_LABELS)}
            error={errors.status?.message}
            {...register("status")}
          />
          <Select
            label="Priority"
            options={options(TASK_PRIORITIES, TASK_PRIORITY_LABELS)}
            error={errors.priority?.message}
            {...register("priority")}
          />
        </div>

        <div className={styles.assignee}>
          <Controller
            control={control}
            name="assignee"
            render={({ field }) => (
              <UserPicker
                label="Assignee"
                value={field.value ? [field.value] : []}
                onChange={(people) => field.onChange(people[0] ?? null)}
                onBlur={field.onBlur}
                candidates={members}
                disabled={!projectKey}
                placeholder={projectKey ? "Search project members…" : "Choose a project first"}
                error={errors.assignee?.message}
                hint={
                  project.error
                    ? "Couldn't load project members."
                    : "Only project members can be assigned."
                }
              />
            )}
          />
          {meOnProject && assignee?.id !== user?.id && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() =>
                user &&
                setValue("assignee", members.find((m) => m.id === user.id) ?? null, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              Assign to me
            </button>
          )}
        </div>

        <div className={styles.row}>
          <TextField
            label="Due date"
            type="date"
            error={errors.dueDate?.message}
            {...register("dueDate")}
          />
          <div />
        </div>

        <Controller
          control={control}
          name="labels"
          render={({ field }) => (
            <LabelInput
              label="Labels"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.labels?.message ?? errors.labels?.root?.message}
              hint="Press Enter or comma to add. Lowercase, no spaces."
            />
          )}
        />
      </form>
    </Modal>
  );
}

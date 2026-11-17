import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
} from "../../constants/task.constant";
import type { AssigneeFilter, DueFilter } from "../../types/task.types";
import { Icon } from "../ui/Icon";
import { FilterMenu, type FilterOption } from "./FilterMenu";
import type { ProjectChoice } from "./TaskFormModal";
import type { TaskListParams, TaskParamName } from "./tasks.params";
import styles from "./TaskFilters.module.css";

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const ASSIGNEE_OPTIONS: FilterOption<Exclude<AssigneeFilter, "">>[] = [
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const DUE_OPTIONS: FilterOption<Exclude<DueFilter, "">>[] = [
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due in the next 7 days" },
  { value: "none", label: "No due date" },
];

interface TaskFiltersProps {
  query: TaskListParams;
  searchInput: string;
  onSearchInput: (value: string) => void;
  onChange: (changes: Partial<Record<TaskParamName, string | string[] | number>>) => void;
  onClear: () => void;
  activeCount: number;
  // cross-project list only
  projectChoices?: ProjectChoice[];
}

export function TaskFilters({
  query,
  searchInput,
  onSearchInput,
  onChange,
  onClear,
  activeCount,
  projectChoices,
}: TaskFiltersProps) {
  const set = (changes: Parameters<typeof onChange>[0]) => onChange({ ...changes, page: 1 });

  return (
    <div className={styles.bar} role="search" aria-label="Filter tasks">
      <div className={styles.search}>
        <Icon name="search" size={16} className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by summary or key"
          aria-label="Search tasks"
          maxLength={100}
          value={searchInput}
          onChange={(event) => onSearchInput(event.target.value)}
        />
      </div>

      {projectChoices && (
        <FilterMenu
          label="Project"
          single
          options={projectChoices.map((p) => ({ value: p.key, label: `${p.name} (${p.key})` }))}
          selected={query.project ? [query.project] : []}
          onChange={(selected) => set({ project: selected[0] ?? "" })}
        />
      )}
      <FilterMenu
        label="Status"
        options={opts(TASK_STATUSES, TASK_STATUS_LABELS)}
        selected={query.status}
        onChange={(status) => set({ status })}
      />
      <FilterMenu
        label="Assignee"
        single
        options={ASSIGNEE_OPTIONS}
        selected={query.assignee ? [query.assignee] : []}
        onChange={(selected) => set({ assignee: selected[0] ?? "" })}
      />
      <FilterMenu
        label="Priority"
        options={opts(TASK_PRIORITIES, TASK_PRIORITY_LABELS)}
        selected={query.priority}
        onChange={(priority) => set({ priority })}
      />
      <FilterMenu
        label="Type"
        options={opts(TASK_TYPES, TASK_TYPE_LABELS)}
        selected={query.type}
        onChange={(type) => set({ type })}
      />
      <FilterMenu
        label="Due"
        single
        options={DUE_OPTIONS}
        selected={query.due ? [query.due] : []}
        onChange={(selected) => set({ due: selected[0] ?? "" })}
      />

      {activeCount > 0 && (
        <button type="button" className={styles.clearAll} onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

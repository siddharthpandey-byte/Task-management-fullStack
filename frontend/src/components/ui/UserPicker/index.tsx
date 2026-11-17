import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getErrorMessage, isRequestCanceled } from "../../../api/api.helper";
import { userService } from "../../../api/services/user.service";
import { ROLE_LABELS } from "../../../constants/auth.constant";
import { useAnchoredPopover } from "../../../hooks/useAnchoredPopover";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { Role } from "../../../types/auth.types";
import type { Person } from "../../../types/project.types";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import fieldStyles from "../TextField/TextField.module.css";
import styles from "./UserPicker.module.css";

interface UserPickerProps {
  label: string;
  value: Person[];
  onChange: (people: Person[]) => void;
  onBlur?: () => void;
  // single: picking replaces the current person
  multiple?: boolean;
  // only offer people with these roles (e.g. project lead must be admin/manager)
  allowedRoles?: Role[];
  // never offer these ids (e.g. the lead in the members picker)
  excludeIds?: string[];
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  max?: number;
}

interface SearchResult {
  query: string;
  people: Person[];
  error?: string;
}

// Searchable people picker (WAI-ARIA combobox + listbox). Searches active users only.
export function UserPicker({
  label,
  value,
  onChange,
  onBlur,
  multiple = false,
  allowedRoles,
  excludeIds,
  placeholder = "Search people…",
  error,
  hint,
  disabled = false,
  required = false,
  max,
}: UserPickerProps) {
  const inputId = useId();
  const listId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const { anchorRef, open, show, hide, style } = useAnchoredPopover<HTMLDivElement>({
    matchWidth: true,
  });

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    userService
      .searchActive(debouncedQuery, controller.signal)
      .then((people) => setResult({ query: debouncedQuery, people }))
      .catch((err: unknown) => {
        if (isRequestCanceled(err)) return;
        setResult({ query: debouncedQuery, people: [], error: getErrorMessage(err) });
      });
    return () => controller.abort();
  }, [open, debouncedQuery]);

  const loading = open && (result?.query !== debouncedQuery || query.trim() !== debouncedQuery);

  const options = useMemo(() => {
    const hidden = new Set([...(excludeIds ?? []), ...value.map((p) => p.id)]);
    return (result?.people ?? []).filter(
      (person) => !hidden.has(person.id) && (!allowedRoles || allowedRoles.includes(person.role))
    );
  }, [result, excludeIds, value, allowedRoles]);

  const atMax = multiple && max !== undefined && value.length >= max;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  const optionId = (index: number) => `${listId}-opt-${index}`;
  const safeActive = Math.min(activeIndex, Math.max(options.length - 1, 0));

  const select = (person: Person) => {
    onChange(multiple ? [...value, person] : [person]);
    setQuery("");
    setActiveIndex(0);
    if (!multiple) hide();
  };

  const remove = (id: string) => {
    onChange(value.filter((person) => person.id !== id));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) show();
        else setActiveIndex((safeActive + 1) % Math.max(options.length, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((safeActive - 1 + options.length) % Math.max(options.length, 1));
        break;
      case "Enter":
        // never submit the surrounding form from the picker
        event.preventDefault();
        if (open && options[safeActive]) select(options[safeActive]);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          // keep Esc from also closing a surrounding modal
          event.stopPropagation();
          hide();
        }
        break;
      case "Backspace":
        if (!query && multiple && value.length > 0) remove(value[value.length - 1].id);
        break;
    }
  };

  return (
    <div className={fieldStyles.field}>
      <label htmlFor={inputId} className={fieldStyles.label}>
        {label}
        {required && (
          <span className={fieldStyles.required} aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>

      <div
        ref={anchorRef}
        className={`${styles.control} ${error ? styles.invalid : ""} ${disabled ? styles.disabled : ""}`}
        onClick={() => !disabled && inputRef.current?.focus()}
        onBlur={(event) => {
          // stay open while focus moves within the picker
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            hide();
            setQuery("");
            onBlur?.();
          }
        }}
      >
        {value.length > 0 && (
          <ul className={styles.chips} aria-label={`Selected: ${label}`}>
            {value.map((person) => (
              <li key={person.id} className={styles.chip}>
                <Avatar name={person.name} size="xs" inactive={!person.isActive} />
                <span className={styles.chipName}>{person.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(person.id);
                    }}
                    aria-label={`Remove ${person.name}`}
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!disabled && !atMax && (
          <input
            ref={inputRef}
            id={inputId}
            className={styles.input}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options.length > 0 ? optionId(safeActive) : undefined}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            autoComplete="off"
            maxLength={100}
            placeholder={value.length > 0 ? (multiple ? "Add more…" : "Change…") : placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              if (!open) show();
            }}
            onFocus={show}
            onKeyDown={onKeyDown}
          />
        )}
        {disabled && value.length === 0 && <span className={styles.none}>None</span>}

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className={styles.listbox}
            style={style}
          >
            {loading && options.length === 0 ? (
              <li className={styles.status}>
                <Spinner size="sm" /> Searching…
              </li>
            ) : result?.error ? (
              <li className={styles.status}>{result.error}</li>
            ) : options.length === 0 ? (
              <li className={styles.status}>No matching people</li>
            ) : (
              options.map((person, index) => (
                <li
                  key={person.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === safeActive}
                  className={`${styles.option} ${index === safeActive ? styles.active : ""}`}
                  // keep focus in the input
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(person)}
                >
                  <Avatar name={person.name} size="sm" />
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{person.name}</span>
                    <span className={styles.optionMeta}>{person.email}</span>
                  </span>
                  <span className={styles.optionRole}>{ROLE_LABELS[person.role]}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {error ? (
        <p id={errorId} className={fieldStyles.error}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <div id={hintId} className={fieldStyles.hint}>
            {hint}
          </div>
        )
      )}
    </div>
  );
}

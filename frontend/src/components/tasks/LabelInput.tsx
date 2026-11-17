import { useId, useRef, useState, type KeyboardEvent } from "react";
import { TASK_LIMITS } from "../../constants/task.constant";
import { parseLabels } from "../../utils/task.helper";
import { labelSchema } from "../../validation/task.schemas";
import { Icon } from "../ui/Icon";
import fieldStyles from "../ui/TextField/TextField.module.css";
import pickerStyles from "../ui/UserPicker/UserPicker.module.css";
import styles from "./LabelInput.module.css";

interface LabelInputProps {
  label: string;
  value: string[];
  onChange: (labels: string[]) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

// Chip input: Enter, comma or space adds a label; Backspace on empty removes the last one
export function LabelInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled = false,
}: LabelInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const atMax = value.length >= TASK_LIMITS.LABELS_MAX;

  const commit = (raw: string) => {
    const incoming = parseLabels(raw);
    if (incoming.length === 0) return true;
    for (const candidate of incoming) {
      const parsed = labelSchema.safeParse(candidate);
      if (!parsed.success) {
        setDraftError(parsed.error.issues[0]?.message ?? "Invalid label");
        return false;
      }
    }
    const next = [...new Set([...value, ...incoming])].slice(0, TASK_LIMITS.LABELS_MAX);
    onChange(next);
    setDraft("");
    setDraftError("");
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      // never submit the surrounding form from here
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const shownError = draftError || error;
  const describedBy =
    [shownError && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={fieldStyles.field}>
      <label htmlFor={inputId} className={fieldStyles.label}>
        {label}
      </label>
      <div
        className={`${pickerStyles.control} ${shownError ? pickerStyles.invalid : ""} ${disabled ? pickerStyles.disabled : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.length > 0 && (
          <ul className={pickerStyles.chips} aria-label={`Selected: ${label}`}>
            {value.map((item) => (
              <li key={item} className={`${pickerStyles.chip} ${styles.chip}`}>
                <span className={pickerStyles.chipName}>{item}</span>
                {!disabled && (
                  <button
                    type="button"
                    className={pickerStyles.remove}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(value.filter((v) => v !== item));
                      inputRef.current?.focus();
                    }}
                    aria-label={`Remove label ${item}`}
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
            className={pickerStyles.input}
            value={draft}
            maxLength={TASK_LIMITS.LABEL_MAX * 2}
            autoComplete="off"
            spellCheck={false}
            placeholder={value.length > 0 ? "Add more…" : "e.g. frontend"}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftError("");
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (commit(draft)) onBlur?.();
            }}
          />
        )}
        {disabled && value.length === 0 && <span className={pickerStyles.none}>None</span>}
      </div>
      {shownError ? (
        <p id={errorId} className={fieldStyles.error}>
          <Icon name="error" size={16} />
          <span>{shownError}</span>
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

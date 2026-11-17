import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";
import { Icon } from "../Icon";
import fieldStyles from "../TextField/TextField.module.css";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: ReactNode;
  // visually hide the label (it stays the accessible name)
  hideLabel?: boolean;
  ref?: Ref<HTMLSelectElement>;
}

// Native <select> styled like TextField: keyboard and screen-reader support for free
export function Select({
  label,
  options,
  error,
  hint,
  hideLabel = false,
  id,
  className,
  ref,
  ...selectProps
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`${fieldStyles.field} ${className ?? ""}`}>
      <label htmlFor={selectId} className={hideLabel ? "visually-hidden" : fieldStyles.label}>
        {label}
        {selectProps.required && (
          <span className={fieldStyles.required} aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <div className={styles.control}>
        <select
          ref={ref}
          id={selectId}
          className={`${fieldStyles.input} ${styles.select} ${error ? fieldStyles.invalid : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...selectProps}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className={styles.chevron} />
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

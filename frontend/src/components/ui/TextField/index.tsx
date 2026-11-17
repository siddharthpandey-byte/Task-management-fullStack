import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "../Icon";
import styles from "./TextField.module.css";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  // rendered on the right of the label row (e.g. "Forgot password?")
  labelAction?: ReactNode;
  // rendered inside the input on the right (e.g. show/hide toggle)
  endAdornment?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  error,
  hint,
  labelAction,
  endAdornment,
  id,
  className,
  ref,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {inputProps.required && (
            <span className={styles.required} aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
        {labelAction}
      </div>
      <div className={styles.control}>
        <input
          ref={ref}
          id={inputId}
          className={`${styles.input} ${error ? styles.invalid : ""} ${endAdornment ? styles.withAdornment : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {endAdornment && <div className={styles.adornment}>{endAdornment}</div>}
      </div>
      {error ? (
        <p id={errorId} className={styles.error}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <div id={hintId} className={styles.hint}>
            {hint}
          </div>
        )
      )}
    </div>
  );
}

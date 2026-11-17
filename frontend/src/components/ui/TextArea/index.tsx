import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { Icon } from "../Icon";
import fieldStyles from "../TextField/TextField.module.css";
import styles from "./TextArea.module.css";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  ref?: Ref<HTMLTextAreaElement>;
}

// Same anatomy and states as TextField
export function TextArea({
  label,
  error,
  hint,
  id,
  className,
  ref,
  rows = 4,
  ...props
}: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`${fieldStyles.field} ${className ?? ""}`}>
      <label htmlFor={inputId} className={fieldStyles.label}>
        {label}
        {props.required && (
          <span className={fieldStyles.required} aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`${fieldStyles.input} ${styles.textarea} ${error ? fieldStyles.invalid : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
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

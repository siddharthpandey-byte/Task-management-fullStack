import { useEffect, useId, useRef } from "react";
import { useAnchoredPopover } from "../../hooks/useAnchoredPopover";
import { Icon } from "../ui/Icon";
import styles from "./TaskFilters.module.css";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterMenuProps<T extends string> {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
  // single: picking one replaces the selection (radio semantics)
  single?: boolean;
}

// Jira-style filter dropdown: a toggle button plus a popover of checkboxes / radios
export function FilterMenu<T extends string>({
  label,
  options,
  selected,
  onChange,
  single = false,
}: FilterMenuProps<T>) {
  const { anchorRef, open, show, hide, style } = useAnchoredPopover<HTMLButtonElement>();
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const name = useId();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) hide();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, hide, anchorRef]);

  const toggle = (value: T) => {
    if (single) onChange(selected.includes(value) ? [] : [value]);
    else
      onChange(
        selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
      );
  };

  const summary =
    selected.length === 0
      ? label
      : single || selected.length === 1
        ? `${label}: ${options.find((o) => o.value === selected[0])?.label ?? ""}`
        : `${label} (${selected.length})`;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`${styles.filterButton} ${selected.length ? styles.filterActive : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? hide() : show())}
      >
        <span className={styles.filterLabel}>{summary}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className={styles.panel}
          style={style}
          role="group"
          aria-label={`Filter by ${label.toLowerCase()}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              hide();
              anchorRef.current?.focus();
            }
          }}
        >
          {options.map((option) => (
            <label key={option.value} className={styles.option}>
              <input
                type={single ? "radio" : "checkbox"}
                name={single ? name : undefined}
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                onClick={() => {
                  // clicking the selected radio clears it
                  if (single && selected.includes(option.value)) onChange([]);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className={styles.panelClear} onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </>
  );
}

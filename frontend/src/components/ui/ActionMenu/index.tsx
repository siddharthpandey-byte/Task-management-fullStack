import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useAnchoredPopover } from "../../../hooks/useAnchoredPopover";
import { Icon, type IconName } from "../Icon";
import styles from "./ActionMenu.module.css";

export interface ActionMenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
}

interface ActionMenuProps {
  // accessible name of the trigger, e.g. "Actions for Website (WEB)"
  label: string;
  items: ActionMenuItem[];
}

// "•••" menu (WAI-ARIA menu button pattern)
export function ActionMenu({ label, items }: ActionMenuProps) {
  const { anchorRef, open, show, hide, style } = useAnchoredPopover<HTMLButtonElement>({
    align: "end",
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchorRef.current?.contains(target)) hide();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, hide, anchorRef]);

  const close = (restoreFocus = true) => {
    hide();
    if (restoreFocus) anchorRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => entries[(i + entries.length) % entries.length]?.focus();

    if (event.key === "ArrowDown") focusAt(index + 1);
    else if (event.key === "ArrowUp") focusAt(index - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(entries.length - 1);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") hide();
    else return;
    if (event.key !== "Tab") event.preventDefault();
  };

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? hide() : show())}
      >
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.menu}
          style={style}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`${styles.item} ${item.danger ? styles.danger : ""}`}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

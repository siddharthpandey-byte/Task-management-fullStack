import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  text?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, text, actions }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>
        <Icon name={icon} size={24} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {text && <p className={styles.text}>{text}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

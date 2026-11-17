import { getInitials } from "../../../utils/user.helper";
import styles from "./Avatar.module.css";

interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md";
  // dim people whose account was deactivated
  inactive?: boolean;
}

export function Avatar({ name, size = "sm", inactive }: AvatarProps) {
  return (
    <span
      className={`${styles.avatar} ${styles[size]} ${inactive ? styles.inactive : ""}`}
      aria-hidden="true"
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}

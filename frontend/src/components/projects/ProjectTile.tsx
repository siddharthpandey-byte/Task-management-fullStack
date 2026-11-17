import { projectColor } from "../../utils/project.helper";
import styles from "./ProjectTile.module.css";

// colored square with the key's first letter; same color for a key everywhere
export function ProjectTile({
  projectKey,
  size = "sm",
}: {
  projectKey: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`${styles.tile} ${styles[size]} ${styles[projectColor(projectKey)]}`}
      aria-hidden="true"
    >
      {projectKey.slice(0, 1)}
    </span>
  );
}

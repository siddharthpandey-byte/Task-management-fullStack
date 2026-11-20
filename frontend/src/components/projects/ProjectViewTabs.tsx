import { NavLink } from "react-router";
import { projectBoardPath, projectTasksPath } from "../../constants/route.constant";
import { Icon } from "../ui/Icon";
import styles from "./ProjectViewTabs.module.css";

export type ProjectView = "list" | "board";

// switches between a project's list and board views (both keep their own URL)
export function ProjectViewTabs({ projectKey }: { projectKey: string }) {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.tab} ${isActive ? styles.active : ""}`;
  return (
    <nav className={styles.tabs} aria-label="Project views">
      <NavLink to={projectTasksPath(projectKey)} className={tabClass} end>
        <Icon name="backlog" size={16} /> List
      </NavLink>
      <NavLink to={projectBoardPath(projectKey)} className={tabClass} end>
        <Icon name="board" size={16} /> Board
      </NavLink>
    </nav>
  );
}

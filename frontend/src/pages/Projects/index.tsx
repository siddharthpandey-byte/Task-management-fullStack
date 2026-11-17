import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { projectService } from "../../api/services/project.service";
import { Can } from "../../components/auth/Can";
import { APP_NAME } from "../../components/Logo";
import { ProjectTile } from "../../components/projects/ProjectTile";
import { ActionMenu, type ActionMenuItem } from "../../components/ui/ActionMenu";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Lozenge } from "../../components/ui/Lozenge";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { ROLES } from "../../constants/auth.constant";
import { projectSettingsPath, ROUTES } from "../../constants/route.constant";
import { useAuth } from "../../hooks/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useProjects } from "../../hooks/useProjects";
import type { Project, ProjectSort, ProjectStatusFilter } from "../../types/project.types";
import { canManageProject, formatDate } from "../../utils/project.helper";
import { CreateProjectModal } from "./CreateProjectModal";
import { readListParams, writeListParams } from "./projects.params";
import styles from "./Projects.module.css";

const STATUS_TABS: { value: ProjectStatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const SKELETON_ROWS = 5;

type PendingAction = { project: Project; action: "archive" | "restore" };

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = readListParams(params);

  const [searchInput, setSearchInput] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState("");

  const { data, loading, error, reload } = useProjects(query);

  const update = (changes: Parameters<typeof writeListParams>[1]) =>
    setParams((current) => writeListParams(current, changes), { replace: true });

  // debounced search → URL (resets to page 1)
  useEffect(() => {
    if (debouncedSearch !== query.search) {
      setParams((current) => writeListParams(current, { q: debouncedSearch, page: 1 }), {
        replace: true,
      });
    }
  }, [debouncedSearch, query.search, setParams]);

  // e.g. last item on the last page was archived → step back to a page that exists
  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (!loading && totalPages > 0 && query.page > totalPages) {
      setParams((current) => writeListParams(current, { page: totalPages }), { replace: true });
    }
  }, [loading, totalPages, query.page, setParams]);

  const toggleSort = (sort: ProjectSort) => {
    const order =
      query.sort === sort
        ? query.order === "asc"
          ? "desc"
          : "asc"
        : sort === "updatedAt" || sort === "createdAt"
          ? "desc"
          : "asc";
    update({ sort, order, page: 1 });
  };

  const runPending = async () => {
    if (!pending) return;
    const { project, action } = pending;
    if (action === "archive") await projectService.archive(project.key);
    else await projectService.restore(project.key);
    setPending(null);
    setNotice(
      action === "archive"
        ? `${project.name} (${project.key}) was archived.`
        : `${project.name} (${project.key}) was restored.`
    );
    reload();
  };

  const rowActions = (project: Project): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        label: "Project settings",
        icon: "settings",
        onSelect: () => navigate(projectSettingsPath(project.key)),
      },
    ];
    if (!canManageProject(user, project)) return items;
    items.push(
      project.status === "archived"
        ? {
            label: "Restore project",
            icon: "restore",
            onSelect: () => setPending({ project, action: "restore" }),
          }
        : {
            label: "Archive project",
            icon: "archive",
            danger: true,
            onSelect: () => setPending({ project, action: "archive" }),
          }
    );
    return items;
  };

  const sortHeader = (sort: ProjectSort, label: string) => {
    const active = query.sort === sort;
    return (
      <th
        scope="col"
        aria-sort={active ? (query.order === "asc" ? "ascending" : "descending") : undefined}
      >
        <button type="button" className={styles.sortButton} onClick={() => toggleSort(sort)}>
          {label}
          <Icon
            name={active && query.order === "asc" ? "arrowUp" : "arrowDown"}
            size={12}
            className={active ? styles.sortActive : styles.sortIdle}
          />
        </button>
      </th>
    );
  };

  const projects = data?.projects ?? [];
  const showSkeleton = loading && !data;
  const isEmpty = !loading && !error && data && projects.length === 0;

  return (
    <div className={styles.page}>
      <title>{`Projects · ${APP_NAME}`}</title>
      <PageHeader
        breadcrumbs={[{ label: APP_NAME, to: ROUTES.DASHBOARD }, { label: "Projects" }]}
        title="Projects"
        description="Browse the projects in your workspace."
        actions={
          <Can roles={[ROLES.ADMIN, ROLES.MANAGER]}>
            <Button iconBefore={<Icon name="plus" size={16} />} onClick={() => setCreating(true)}>
              Create project
            </Button>
          </Can>
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon name="search" size={16} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name or key"
            aria-label="Search projects"
            maxLength={100}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className={styles.tabs} role="group" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={styles.tab}
              aria-pressed={query.status === tab.value}
              onClick={() => update({ status: tab.value, page: 1 })}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Couldn't load projects">
          {error.message}{" "}
          <button type="button" className={styles.inlineLink} onClick={reload}>
            Try again
          </button>
        </Alert>
      )}

      <div className={styles.tableCard}>
        {isEmpty ? (
          <ProjectsEmpty
            search={query.search}
            status={query.status}
            canCreate={user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER}
            onCreate={() => setCreating(true)}
            onClear={() => {
              setSearchInput("");
              update({ q: "", page: 1 });
            }}
          />
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table} aria-busy={loading || undefined}>
              <thead>
                <tr>
                  {sortHeader("name", "Name")}
                  {sortHeader("key", "Key")}
                  <th scope="col">Lead</th>
                  <th scope="col" className={styles.hideSm}>
                    Members
                  </th>
                  {sortHeader("updatedAt", "Updated")}
                  <th scope="col" className={styles.actionsCol}>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={loading && data ? styles.refreshing : undefined}>
                {showSkeleton
                  ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                      <tr key={i} className={styles.skeletonRow} aria-hidden="true">
                        {Array.from({ length: 6 }, (__, j) => (
                          <td key={j}>
                            <span className={styles.skeleton} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : projects.map((project) => (
                      <tr key={project.id}>
                        <td>
                          <Link to={projectSettingsPath(project.key)} className={styles.nameCell}>
                            <ProjectTile projectKey={project.key} />
                            <span className={styles.name}>{project.name}</span>
                          </Link>
                          {project.status === "archived" && (
                            <span className={styles.archivedTag}>
                              <Lozenge>Archived</Lozenge>
                            </span>
                          )}
                        </td>
                        <td className={styles.key}>{project.key}</td>
                        <td>
                          <span className={styles.person}>
                            <Avatar name={project.lead.name} inactive={!project.lead.isActive} />
                            <span className={styles.personName}>{project.lead.name}</span>
                          </span>
                        </td>
                        <td className={styles.hideSm}>{project.members.length}</td>
                        <td className={styles.muted}>{formatDate(project.updatedAt)}</td>
                        <td className={styles.actionsCol}>
                          <ActionMenu
                            label={`Actions for ${project.name}`}
                            items={rowActions(project)}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={data.pagination.limit}
            noun={data.pagination.total === 1 ? "project" : "projects"}
            onPageChange={(page) => update({ page })}
          />
        )}
      </div>

      {creating && (
        <CreateProjectModal
          onClose={() => setCreating(false)}
          onCreated={(project) => {
            setCreating(false);
            setNotice(`${project.name} (${project.key}) was created.`);
            if (query.status === "archived") update({ status: "active", page: 1 });
            else reload();
          }}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={
            pending.action === "archive"
              ? `Archive ${pending.project.name}?`
              : `Restore ${pending.project.name}?`
          }
          confirmLabel={pending.action === "archive" ? "Archive" : "Restore"}
          appearance={pending.action === "archive" ? "danger" : "primary"}
          onConfirm={runPending}
          onClose={() => setPending(null)}
        >
          {pending.action === "archive" ? (
            <p>
              The project becomes read-only and is hidden from the active list. You can restore it
              at any time.
            </p>
          ) : (
            <p>The project becomes active again and its details can be edited.</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

function ProjectsEmpty({
  search,
  status,
  canCreate,
  onCreate,
  onClear,
}: {
  search: string;
  status: ProjectStatusFilter;
  canCreate: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  if (search) {
    return (
      <EmptyState
        icon="search"
        title="No projects match your search"
        text={`Nothing matches “${search}”. Check the spelling or try a different term.`}
        actions={
          <Button variant="secondary" onClick={onClear}>
            Clear search
          </Button>
        }
      />
    );
  }
  if (status === "archived") {
    return (
      <EmptyState
        icon="archive"
        title="No archived projects"
        text="Projects you archive show up here."
      />
    );
  }
  return (
    <EmptyState
      icon="folder"
      title={canCreate ? "Create your first project" : "No projects yet"}
      text={
        canCreate
          ? "Projects keep your team's work organised in one place."
          : "You haven't been added to any projects yet. Ask a project lead to add you."
      }
      actions={canCreate && <Button onClick={onCreate}>Create project</Button>}
    />
  );
}

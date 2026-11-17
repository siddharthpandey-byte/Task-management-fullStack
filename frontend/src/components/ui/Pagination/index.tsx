import { Button } from "../Button";
import { Icon } from "../Icon";
import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  // label for the count, e.g. "projects"
  noun?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  noun = "items",
}: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <p className={styles.summary}>
        {from}–{to} of {total} {noun}
      </p>
      {totalPages > 1 && (
        <div className={styles.controls}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Previous page"
            iconBefore={<Icon name="chevronLeft" size={16} />}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
          <span className={styles.page} aria-current="page">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Next page"
            iconBefore={<Icon name="chevronRight" size={16} />}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      )}
    </nav>
  );
}

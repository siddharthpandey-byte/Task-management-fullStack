import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { getErrorMessage } from "../../api/api.helper";
import { taskService } from "../../api/services/task.service";
import { TASK_STATUS_LABELS } from "../../constants/task.constant";
import type { BoardColumn as Column, BoardData } from "../../types/task.types";
import { Alert } from "../ui/Alert";
import { CardBody, type MoveTarget } from "./BoardCard";
import { BoardColumn } from "./BoardColumn";
import {
  findCard,
  getTask,
  moveCard,
  neighboursAt,
  placementChanged,
  replaceTask,
  statusFromColumnId,
  type Placement,
} from "./board.state";
import styles from "./Board.module.css";

interface BoardProps {
  data: BoardData;
  // refetch from the server (after a failed move, or when the tab regains focus)
  onReload: () => void;
}

interface DragSession {
  key: string;
  start: Placement;
  snapshot: Column[];
}

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To pick up a task, press Space. While dragging, use the arrow keys to move it within " +
    "and between columns, then press Space to drop it or Escape to cancel. " +
    "Press Enter to open the task.",
};

// a click that ends a drag must not open the task underneath the pointer
const CLICK_SUPPRESS_MS = 250;

// Kanban board for one project. Moves are applied optimistically, then saved one
// at a time in the order they were made (each move's neighbours assume the previous
// one landed). If a save fails the board is put back and refetched.
export function Board({ data, onReload }: BoardProps) {
  const { canEdit, project } = data;

  // local copy of the columns, reset whenever a fresh board arrives from the server
  const [synced, setSynced] = useState(data);
  const [columns, setColumns] = useState(data.columns);
  if (synced !== data) {
    setSynced(data);
    setColumns(data.columns);
  }

  const columnsRef = useRef(columns);
  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

  const drag = useRef<DragSession | null>(null);
  const lastDragEnd = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // bumped when a save fails: moves queued behind it are dropped (the board refetches)
  const epoch = useRef(0);
  const pending = useRef(0);
  const reloadWhenIdle = useRef(false);

  const sensors = useSensors(
    // a small distance so a plain click still opens the task
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // press-and-hold on touch so the page can still be scrolled with a swipe
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is kept for opening the task
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    })
  );

  const setSaving = (key: string, saving: boolean) =>
    setSavingKeys((current) => {
      const next = new Set(current);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });

  const commit = useCallback(
    (key: string, placement: Placement, snapshot: Column[]) => {
      const startedIn = epoch.current;
      pending.current += 1;
      setSaving(key, true);

      queue.current = queue.current.then(async () => {
        try {
          if (startedIn !== epoch.current) return;
          const task = await taskService.move(key, {
            status: placement.status,
            afterKey: placement.afterKey,
            beforeKey: placement.beforeKey,
          });
          setColumns((current) => replaceTask(current, task));
        } catch (err) {
          epoch.current += 1;
          // with nothing else in flight the snapshot is exactly the last good state
          if (pending.current === 1) setColumns(snapshot);
          setError(`Couldn't move ${key}. ${getErrorMessage(err)}`);
          setLiveMessage(`Couldn't move ${key}. It was put back.`);
          reloadWhenIdle.current = true;
        } finally {
          pending.current -= 1;
          setSaving(key, false);
          if (pending.current === 0 && reloadWhenIdle.current) {
            reloadWhenIdle.current = false;
            onReload();
          }
        }
      });
    },
    [onReload]
  );

  // keep the board fresh when the user comes back to the tab, unless they're mid-move
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (drag.current || pending.current > 0) return;
      onReload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onReload]);

  // --- menu moves (no dragging) ----------------------------------------------

  const focusCard = (key: string) =>
    requestAnimationFrame(() =>
      // task keys are [A-Z0-9-] only, so they're safe in a selector as-is
      document.querySelector<HTMLElement>(`[data-testid="board-card-${key}"]`)?.focus()
    );

  const onMenuMove = useCallback(
    (key: string, { status, edge }: MoveTarget) => {
      const current = columnsRef.current;
      const target = current.find((c) => c.status === status);
      if (!target) return;
      const next = moveCard(current, key, status, edge === "top" ? 0 : target.tasks.length);
      const placement = neighboursAt(next, key);
      if (next === current || !placement) return;
      setError("");
      setColumns(next);
      commit(key, placement, current);
      setLiveMessage(`${key} moved to the ${edge} of ${TASK_STATUS_LABELS[status]}.`);
      focusCard(key);
    },
    [commit]
  );

  // --- drag and drop -----------------------------------------------------------

  const onDragStart = ({ active }: DragStartEvent) => {
    const key = String(active.id);
    const start = neighboursAt(columnsRef.current, key);
    if (!start) return;
    drag.current = { key, start, snapshot: columnsRef.current };
    setActiveKey(key);
    setError("");
  };

  // moving into another column happens while dragging, so the card makes room there
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const key = String(active.id);
    const overId = String(over.id);
    setColumns((current) => {
      const from = findCard(current, key);
      const overCard = findCard(current, overId);
      const toStatus = statusFromColumnId(overId) ?? overCard?.status;
      if (!from || !toStatus || toStatus === from.status) return current;

      const target = current.find((c) => c.status === toStatus)!;
      let index = target.tasks.length;
      if (overCard) {
        const dragged = active.rect.current.translated;
        const below = dragged ? dragged.top > over.rect.top + over.rect.height / 2 : false;
        index = overCard.index + (below ? 1 : 0);
      }
      return moveCard(current, key, toStatus, index);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    lastDragEnd.current = performance.now();
    setActiveKey(null);
    const session = drag.current;
    drag.current = null;
    if (!session) return;
    if (!over) {
      setColumns(session.snapshot);
      return;
    }

    const key = String(active.id);
    let next = columnsRef.current;
    // reordering inside the column the card is in now
    const from = findCard(next, key);
    const to = findCard(next, String(over.id));
    if (from && to && from.status === to.status && from.index !== to.index) {
      next = moveCard(next, key, to.status, to.index);
    }

    const end = neighboursAt(next, key);
    if (!end || !placementChanged(session.start, end)) {
      setColumns(session.snapshot);
      return;
    }
    setColumns(next);
    commit(key, end, session.snapshot);
  };

  const onDragCancel = () => {
    lastDragEnd.current = performance.now();
    setActiveKey(null);
    if (drag.current) setColumns(drag.current.snapshot);
    drag.current = null;
  };

  const suppressClickAfterDrag = (event: MouseEvent) => {
    if (performance.now() - lastDragEnd.current < CLICK_SUPPRESS_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // --- screen reader announcements --------------------------------------------

  const describe = (key: string) => {
    const at = findCard(columnsRef.current, key);
    if (!at) return "";
    const size = columnsRef.current.find((c) => c.status === at.status)?.tasks.length ?? 0;
    return `${TASK_STATUS_LABELS[at.status]}, position ${at.index + 1} of ${size}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${active.id}. It is in ${describe(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${active.id} is now in ${describe(String(active.id))}.`
        : `${active.id} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${active.id} was dropped in ${describe(String(active.id))}.`
        : `${active.id} was put back where it started.`,
    onDragCancel: ({ active }) => `Moving ${active.id} was cancelled. It was put back.`,
  };

  const activeTask = activeKey ? getTask(columns, activeKey) : undefined;

  return (
    <>
      {error && (
        <Alert variant="error" title="The board was not updated">
          {error}
        </Alert>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">
        {liveMessage}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      >
        <div
          className={styles.board}
          onClickCapture={suppressClickAfterDrag}
          aria-label={`${project.name} board`}
          role="region"
        >
          {columns.map((column) => (
            <BoardColumn
              key={column.status}
              column={column}
              projectKey={project.key}
              canEdit={canEdit}
              savingKeys={savingKeys}
              onMove={onMenuMove}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className={`${styles.card} ${styles.cardOverlay}`}>
              <CardBody task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

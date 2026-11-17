import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const GAP = 4;
const VIEWPORT_MARGIN = 8;

// Positions a popover with `position: fixed` next to its anchor so it isn't clipped by
// scrolling containers (tables, modal bodies). Flips above the anchor when there's no room below.
export function useAnchoredPopover<T extends HTMLElement>({
  align = "start",
  maxHeight = 280,
  matchWidth = false,
}: { align?: "start" | "end"; maxHeight?: number; matchWidth?: boolean } = {}) {
  const anchorRef = useRef<T>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const { innerHeight, innerWidth } = window;
    const below = innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const above = rect.top - VIEWPORT_MARGIN;
    const flip = below < Math.min(maxHeight, 160) && above > below;

    const next: CSSProperties = {
      position: "fixed",
      maxHeight: Math.max(120, Math.min(maxHeight, (flip ? above : below) - GAP)),
    };
    if (flip) next.bottom = innerHeight - rect.top + GAP;
    else next.top = rect.bottom + GAP;
    if (align === "end") next.right = Math.max(VIEWPORT_MARGIN, innerWidth - rect.right);
    else next.left = Math.max(VIEWPORT_MARGIN, rect.left);
    if (matchWidth) next.width = rect.width;
    setStyle(next);
  }, [align, maxHeight, matchWidth]);

  const show = useCallback(() => {
    measure();
    setOpen(true);
  }, [measure]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    // capture: also catch scrolls of any ancestor container
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  return { anchorRef, open, show, hide, style, reposition: measure };
}

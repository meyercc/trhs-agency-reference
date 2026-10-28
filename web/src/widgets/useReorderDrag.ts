// Drag-to-reorder for boards of cards — the Home dashboard's pick-up-and-drop
// as it was in September, lifted out so Personalize › Quick Controls moves the
// same way. The Home board itself kept its own copy because, from TH-440 until
// 2026-10-21, it also dragged into slots beside the carousel, which this hook
// had no notion of (merge deferred 2026-10-07). The slots are gone, so the two
// copies could be one again — a merge worth its own ticket, not a side effect.
// Press on a card and move past a few px: the card lifts into a floating
// overlay under the cursor, its cell becomes the dashed drop placeholder, and
// the others reflow live in reading order.
//
// The host renders the cells (calling `registerEl` + `onDragStart`), the
// `.wb-cell.dragging` placeholder and the `.wb-drag-overlay` from `drag` +
// `pointer`; styles live in widgets/board.css.
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 4; // px before a press becomes a drag (so clicks don't flash)

export interface ReorderDrag {
  id: string;
  w: number;
  h: number;
  offX: number;
  offY: number;
}

export function useReorderDrag({
  getOrder,
  moveTo,
}: {
  /** Current ids in reading order (read fresh on every move). */
  getOrder: () => string[];
  /** Move `id` to `index` among the others. Called live while dragging. */
  moveTo: (id: string, index: number) => void;
}) {
  const [drag, setDrag] = useState<ReorderDrag | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const cellEls = useRef<Map<string, HTMLElement>>(new Map());
  const pendingRef = useRef<(ReorderDrag & { sx: number; sy: number }) | null>(null);
  const activeRef = useRef(false);
  const cb = useRef({ getOrder, moveTo });
  cb.current = { getOrder, moveTo };

  useEffect(() => {
    document.body.classList.toggle('wb-dragging', !!drag);
    return () => document.body.classList.remove('wb-dragging');
  }, [drag]);

  const registerEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cellEls.current.set(id, el);
    else cellEls.current.delete(id);
  }, []);

  // Insertion index in reading order, from viewport coords (so it's correct no
  // matter how far the page is scrolled).
  const computeDropIndex = useCallback((px: number, py: number, id: string) => {
    let idx = 0;
    for (const other of cb.current.getOrder()) {
      if (other === id) continue;
      const el = cellEls.current.get(other);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const band = r.height / 2;
      // Past this cell in reading order → the dragged item goes after it.
      const after = py > cy + band ? true : py < cy - band ? false : px > cx;
      if (after) idx++;
    }
    return idx;
  }, []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const pd = pendingRef.current;
      if (!pd) return;
      setPointer({ x: e.clientX, y: e.clientY });
      if (!activeRef.current) {
        if (Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) < DRAG_THRESHOLD) return;
        activeRef.current = true;
        setDrag({ id: pd.id, w: pd.w, h: pd.h, offX: pd.offX, offY: pd.offY });
      }
      cb.current.moveTo(pd.id, computeDropIndex(e.clientX, e.clientY, pd.id));
    },
    [computeDropIndex],
  );

  const onUp = useCallback(() => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    pendingRef.current = null;
    activeRef.current = false;
    setDrag(null);
  }, [onMove]);

  const onDragStart = useCallback(
    (id: string, e: React.PointerEvent) => {
      // Measure the card, not whatever took the press: Personalize listens on
      // the tile grid, so the registered tile is what lifts. On the Home board
      // the press lands on the cell itself, so this is the same element.
      const r = (cellEls.current.get(id) ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
      pendingRef.current = {
        id,
        w: r.width,
        h: r.height,
        offX: e.clientX - r.left,
        offY: e.clientY - r.top,
        sx: e.clientX,
        sy: e.clientY,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onMove, onUp],
  );

  return { drag, pointer, registerEl, onDragStart };
}

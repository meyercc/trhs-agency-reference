import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Icon } from '../components';
import { RENDERERS, DEFAULT_LAYOUT, META_BY_ID, DEVICE_WIDGET_SKU, type BoardItem as Item } from './catalog';
import { WidgetPicker } from './WidgetPicker';
import { useModules } from '../state/Modules';
import { useDeviceSim } from '../state/DeviceSim';
import { WIDGET_MODULE } from '../modules/registry';
import './board.css';

const STORAGE_KEY = 'board-layout';

function loadLayout(): Item[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Item[];
    const valid = parsed.filter((i) => META_BY_ID[i.id]);
    return valid.length ? valid : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

const COLS = 6;
const MIN_SPAN = 2;
const MAX_ROWS = 3;
const DRAG_THRESHOLD = 4; // px before a press becomes a drag (so clicks don't flash)
const SPRINGS = {
  snappy: { type: 'spring', stiffness: 500, damping: 34 },
  smooth: { type: 'spring', stiffness: 260, damping: 30 },
  bouncy: { type: 'spring', stiffness: 420, damping: 16 },
} as const;
type SpringName = keyof typeof SPRINGS;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface CellProps {
  item: Item;
  dragging: boolean;
  resizing: boolean;
  size: { span: number; rows: number };
  transition: (typeof SPRINGS)[SpringName];
  registerEl: (id: string, el: HTMLElement | null) => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent, id: string) => void;
  onRemove: (id: string) => void;
}

function Cell({ item, dragging, resizing, size, transition, registerEl, onDragStart, onResizeStart, onRemove }: CellProps) {
  return (
    <motion.div
      layout={!resizing}
      ref={(el) => registerEl(item.id, el)}
      data-widget={item.id}
      className={'wb-cell' + (dragging ? ' dragging' : '') + (resizing ? ' resizing' : '')}
      style={{ gridColumn: `span ${size.span}`, gridRow: `span ${size.rows}` }}
      transition={transition}
      onPointerDown={
        dragging
          ? undefined
          : (e) => {
              const t = e.target as Element;
              if (t.closest('.wb-resize')) return; // resize handle
              if (t.closest('button, a, input, select, textarea')) return; // interactive controls
              // Drag from the header, or anywhere on a header-less card
              // (device cards, Last Played, component-status cards).
              if (t.closest('.w-label, .ds-devcard, .wg-lastplayed, .cs-card')) onDragStart(item.id, e);
            }
      }
    >
      {/* While this widget is the one being dragged, the cell is a dashed
          placeholder marking exactly where it will land; the floating overlay
          (rendered by the board) shows the widget under the cursor. */}
      {dragging ? null : (
        <>
          {RENDERERS[item.id]()}
          <button className="wb-remove" type="button" aria-label={`Remove ${META_BY_ID[item.id]?.name ?? 'widget'}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(item.id)}>
            <Icon name="close" />
          </button>
          {resizing && (
            <div className="wb-size-pill">
              {size.span} × {size.rows}
            </div>
          )}
          <div className="wb-resize" aria-label="Resize widget" onPointerDown={(e) => onResizeStart(e, item.id)} />
        </>
      )}
    </motion.div>
  );
}

interface DragState {
  id: string;
  w: number;
  h: number;
  offX: number;
  offY: number;
}

export function WidgetBoard({ spring = 'snappy' }: { spring?: SpringName }) {
  const { has } = useModules();
  const { simState } = useDeviceSim();
  const [items, setItems] = useState<Item[]>(loadLayout);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Widgets belonging to a removed module are hidden (not deleted) — reinstalling
  // the module brings them back at their saved position. A disconnected device
  // takes its card with it the same way: hidden while the hardware is away,
  // back at its saved position when it's plugged in again.
  const shownItems = items.filter((it) => {
    const mod = WIDGET_MODULE[it.id];
    if (mod && !has(mod)) return false;
    const sku = DEVICE_WIDGET_SKU[it.id];
    return !sku || simState(sku).connected;
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellEls = useRef<Map<string, HTMLElement>>(new Map());
  const pendingRef = useRef<{ id: string; w: number; h: number; offX: number; offY: number; sx: number; sy: number } | null>(null);
  const activeRef = useRef(false);
  const transition = SPRINGS[spring] || SPRINGS.snappy;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    document.body.classList.toggle('wb-dragging', !!drag);
    return () => document.body.classList.remove('wb-dragging');
  }, [drag]);

  const registerEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cellEls.current.set(id, el);
    else cellEls.current.delete(id);
  }, []);

  function addWidget(id: string) {
    const meta = META_BY_ID[id];
    if (!meta) return;
    setItems((prev) => (prev.some((i) => i.id === id) ? prev : [...prev, { id, span: meta.span, rows: meta.rows }]));
  }
  function removeWidget(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Insertion index in reading order, from viewport coords (so it's correct no
  // matter how far the page is scrolled — the old bug used page coords).
  const computeDropIndex = useCallback((px: number, py: number, id: string) => {
    const others = itemsRef.current.filter((i) => i.id !== id);
    let idx = 0;
    for (const it of others) {
      const el = cellEls.current.get(it.id);
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

  const moveTo = useCallback((id: string, index: number) => {
    setItems((prev) => {
      const cur = prev.find((i) => i.id === id);
      if (!cur) return prev;
      const others = prev.filter((i) => i.id !== id);
      const i = clamp(index, 0, others.length);
      others.splice(i, 0, cur);
      if (others.every((it, k) => it.id === prev[k]?.id)) return prev; // no change
      return others;
    });
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
      moveTo(pd.id, computeDropIndex(e.clientX, e.clientY, pd.id));
    },
    [computeDropIndex, moveTo],
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
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      pendingRef.current = { id, w: r.width, h: r.height, offX: e.clientX - r.left, offY: e.clientY - r.top, sx: e.clientX, sy: e.clientY };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onMove, onUp],
  );

  function startResize(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    setResizing(id);
    const grid = gridRef.current;
    const cs = grid ? getComputedStyle(grid) : null;
    const colGap = cs ? parseFloat(cs.columnGap) || 0 : 0;
    const rowGap = cs ? parseFloat(cs.rowGap) || 0 : 0;
    const autoRow = cs ? parseFloat(cs.gridAutoRows) || 160 : 160;
    const colStep = ((grid ? grid.clientWidth : 720) + colGap) / COLS;
    const rowStep = autoRow + rowGap;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = items.find((i) => i.id === id)!;
    const startSpan = start.span;
    const startRows = start.rows;

    const move = (ev: PointerEvent) => {
      const span = clamp(startSpan + Math.round((ev.clientX - startX) / colStep), MIN_SPAN, COLS);
      const rows = clamp(startRows + Math.round((ev.clientY - startY) / rowStep), 1, MAX_ROWS);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, span, rows } : it)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setResizing(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const dragItem = drag ? items.find((i) => i.id === drag.id) : null;

  return (
    <>
      <div className="wb-grid" ref={gridRef}>
        {shownItems.map((item) => (
          <Cell
            key={item.id}
            item={item}
            dragging={drag?.id === item.id}
            resizing={resizing === item.id}
            size={{ span: item.span, rows: item.rows }}
            transition={transition}
            registerEl={registerEl}
            onDragStart={onDragStart}
            onResizeStart={startResize}
            onRemove={removeWidget}
          />
        ))}
        <button className="wb-add" type="button" onClick={() => setPicking(true)} style={{ gridColumn: 'span 2' }}>
          <span className="wb-add-plus" aria-hidden="true">
            +
          </span>
          Add a widget
        </button>
      </div>

      {/* Floating overlay — the picked-up widget, following the cursor. */}
      {drag &&
        dragItem &&
        createPortal(
          <div className="wb-drag-overlay" style={{ left: pointer.x - drag.offX, top: pointer.y - drag.offY, width: drag.w, height: drag.h }}>
            {RENDERERS[dragItem.id]()}
          </div>,
          document.body,
        )}

      {picking && <WidgetPicker current={new Set(items.map((i) => i.id))} onAdd={addWidget} onClose={() => setPicking(false)} />}
    </>
  );
}

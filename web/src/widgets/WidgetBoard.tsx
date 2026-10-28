import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Icon, WidgetShellActionSlot, type WidgetShellAction } from '../components';
import { RENDERERS, DEFAULT_LAYOUT, META_BY_ID, DEVICE_WIDGET_SKU, type BoardItem as Item } from './catalog';
import { WidgetPicker } from './WidgetPicker';
import { useModules } from '../state/Modules';
import { useDeviceSim } from '../state/DeviceSim';
import { useSettings } from '../state/Settings';
import { isOnDesk } from '../devices/connectedDevices';
import { WIDGET_MODULE } from '../modules/registry';
import { cellSize, packBoard, type Placed, type Reserved } from './pack';
import { ADD_SPAN, COLS, COLS_10, COLS_8, COLS_COMPACT, HERO_ROWS, HERO_SPAN, MAX_ROWS, MIN_SPAN, SCOPE_HIDDEN_WIDGETS, nameFor, normalizeLayout, type LayoutContext } from './layout';
import { W, uiZoom, usePageSize } from '../app/breakpoints';
import { cardMeta, cardMetas } from './cardMeta';
import { CustomWidget } from './CustomWidget';
import { CellActionsContext } from './cellActions';
import { BoardCardMenu } from './CardMenu';
import { isCardId } from '../state/overlays';
import { useVitalsStream } from '../modals/vitalsData';
import './board.css';

// The layout is read and written through Settings (`boardLayout`), which keeps
// the same raw `board-layout` key this component used to own. One reader, so
// the two cannot drift; `null` there means nothing stored, which is a different
// answer from `[]` — a deliberately empty board.

// The numbers that define a legal layout now live in `layout.ts`, so a
// validator can import them without importing this component (TH-442).
// The page's width is read here (`usePageSize`) because placement is computed
// in JS (pack.ts), not by the stylesheet — from the same box shell.css grows
// the cap by, so the packer and the grid always count the same columns.
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
  /** What to draw inside. Passed in because a `card-*` id has no `RENDERERS` entry (TH-443). */
  render: (id: string) => ReactNode;
  /** The widget's own name, for the three aria-labels — see `nameFor`. */
  name: string;
  dragging: boolean;
  resizing: boolean;
  size: { span: number; rows: number };
  pos: Placed;
  transition: (typeof SPRINGS)[SpringName];
  registerEl: (id: string, el: HTMLElement | null) => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent, id: string) => void;
  onRemove: (id: string) => void;
  /** Put this card first. The ⋮'s one layout row; absent on the card that is already first. */
  onToTop?: (id: string) => void;
}

function Cell({ item, render, name, dragging, resizing, size, pos, transition, registerEl, onDragStart, onResizeStart, onRemove, onToTop }: CellProps) {
  // The card's header link, handed over by its `WidgetShell` — the ⋮'s first row.
  const [open, setOpen] = useState<WidgetShellAction | null>(null);
  return (
    <motion.div
      layout={!resizing}
      ref={(el) => registerEl(item.id, el)}
      data-widget={item.id}
      className={'wb-cell' + (dragging ? ' dragging' : '') + (resizing ? ' resizing' : '')}
      style={{ gridColumn: `${pos.col} / span ${size.span}`, gridRow: `${pos.row} / span ${size.rows}` }}
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
              // A composed card is a `.w` with a `.w-label`, so it is covered by
              // the first selector — that is the reason it reuses WidgetShell.
            }
      }
    >
      {/* While this widget is the one being dragged, the cell is a dashed
          placeholder marking exactly where it will land; the floating overlay
          (rendered by the board) shows the widget under the cursor. */}
      {dragging ? null : (
        <>
          {/* The cell's footprint and removal, for a card that draws its own ⋮.
              Every card gets the `CardMenu` (Treehouse IC meeting 2026-10-06,
              Chris: «all of the widget cards»), and it REPLACES the corner × —
              Remove from Home is its last row. A card with actions of its own
              (the monitor card's Customize) draws its own copy and this one
              steps aside (`card-menu.css`). */}
          <CellActionsContext.Provider
            value={{
              span: size.span,
              rows: size.rows,
              remove: () => onRemove(item.id),
              toTop: onToTop && (() => onToTop(item.id)),
            }}
          >
            <WidgetShellActionSlot.Provider value={setOpen}>{render(item.id)}</WidgetShellActionSlot.Provider>
            <BoardCardMenu id={item.id} name={name} open={open} />
          </CellActionsContext.Provider>
          {resizing && <div className="wb-size-pill">{`${size.span} × ${size.rows}`}</div>}
          <div className="wb-resize" aria-label={`Resize ${name}`} onPointerDown={(e) => onResizeStart(e, item.id)} />
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

/**
 * The home board. With `hero` (the carousel) it renders it as the grid's
 * first cell — HERO_SPAN × HERO_ROWS, top-left — and the widgets pack around
 * it: beside it in the columns a wider page adds, under it otherwise (Chris,
 * 2026-10-21: «i can't place widgets in the top row by the carousel»).
 * `between` (the inline ad) is a full-width row under the hero's rows.
 *
 * The column count is the PAGE's (`usePageSize`, 2026-10-21): two on a
 * compact page, six on the 1100 page every screen was drawn at, eight where
 * eight of those tracks fit and ten where ten do — the same named widths
 * shell.css grows the cap by, so a track never changes width and a card
 * keeps the size it was drawn at. The page, not the window: with Nova
 * reserving 380px of a 1920 window the page is 1477 and the board stays at
 * six. (TH-440's slots beside the carousel are gone — Chris, 2026-10-21.)
 */
export function WidgetBoard({ spring = 'snappy', hero, between }: { spring?: SpringName; hero?: ReactNode; between?: ReactNode }) {
  const { has } = useModules();
  const { step, width } = usePageSize();
  const cols = step === 'compact' ? COLS_COMPACT : width >= W.board10 ? COLS_10 : width >= W.board8 ? COLS_8 : COLS;
  const { simState } = useDeviceSim();
  const { deskDevices, boardLayout, setBoardLayout, cards, mvpScope } = useSettings();
  // Local `items` stays the working copy and Settings is the source of truth.
  // Both, not one: `moveTo` runs on every pointermove, and writing Settings per
  // frame would re-render every useSettings() consumer in the app. So the drag
  // mutates locally and the commit happens on release (the effect below).
  const [items, setItems] = useState<Item[]>(() => boardLayout ?? DEFAULT_LAYOUT);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Widgets belonging to a removed module are hidden (not deleted) — reinstalling
  // the module brings them back at their saved position. A disconnected device
  // takes its card with it the same way: hidden while the hardware is away,
  // back at its saved position when it's plugged in again.
  const shownItems = items.filter((it) => {
    // A widget the MVP scope leaves out is hidden the same way (layout.ts).
    if (SCOPE_HIDDEN_WIDGETS[mvpScope].has(it.id)) return false;
    const mod = WIDGET_MODULE[it.id];
    if (mod && !has(mod)) return false;
    const sku = DEVICE_WIDGET_SKU[it.id];
    // Two separate absences, both hide the card: a device the Admin row took off
    // this desk was never here (2026-09-18 — the OMEN OLED 27 card outlived its
    // removal), and a device on the desk can be unplugged (simulator).
    return !sku || (isOnDesk(sku, deskDevices) && simState(sku).connected);
  });
  // Custom cards (TH-443): the vocabulary for every id the board cannot look up
  // in `META_BY_ID`, and ONE telemetry stream for all of them. Per-card hooks
  // would each be an independent random walk, so two cards showing CPU would
  // disagree on screen — `OverlayHost` solved this the same way, at the host.
  const cardCtx = useMemo<LayoutContext>(() => ({ cards: cardMetas(cards) }), [cards]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const hasCards = items.some((i) => isCardId(i.id) && cardById.has(i.id));
  const stream = useVitalsStream(hasCards);
  /**
   * What to draw for an id. `RENDERERS[id]()` on an id with no entry is a
   * TypeError **in render** — a white screen, with `normalizeLayout` as the only
   * thing standing in front of it. So this answers null instead: an id nothing
   * recognises leaves an empty cell the remove button still works on.
   */
  const renderWidget = useCallback(
    (id: string): ReactNode => {
      const r = RENDERERS[id];
      if (r) return r();
      const card = cardById.get(id);
      return card ? <CustomWidget spec={card} stream={stream} /> : null;
    },
    [cardById, stream],
  );

  const [drag, setDrag] = useState<DragState | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellEls = useRef<Map<string, HTMLElement>>(new Map());
  const pendingRef = useRef<{ id: string; w: number; h: number; offX: number; offY: number; sx: number; sy: number } | null>(null);
  const activeRef = useRef(false);
  const transition = SPRINGS[spring] || SPRINGS.snappy;

  // Commit to Settings, but never mid-gesture — see the note on `items` above.
  useEffect(() => {
    if (drag || resizing) return;
    if (JSON.stringify(items) === JSON.stringify(boardLayout)) return;
    setBoardLayout(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, drag, resizing]);

  // And take a layout set from OUTSIDE — Nova proposing one (TH-442), the Admin
  // reset, onboarding's seed. Skipped mid-gesture so an incoming write cannot
  // yank a card out from under the pointer.
  useEffect(() => {
    if (drag || resizing) return;
    if (boardLayout === null) return;
    if (JSON.stringify(boardLayout) === JSON.stringify(items)) return;
    setItems(boardLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardLayout]);
  useEffect(() => {
    document.body.classList.toggle('wb-dragging', !!drag);
    return () => document.body.classList.remove('wb-dragging');
  }, [drag]);

  const registerEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cellEls.current.set(id, el);
    else cellEls.current.delete(id);
  }, []);

  function addWidget(id: string) {
    const card = cardById.get(id);
    const meta = META_BY_ID[id] ?? (card ? cardMeta(card) : undefined);
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

  // The ⋮'s «Move to the top» — the board's one way to reorder without dragging.
  const toTop = useCallback((id: string) => moveTo(id, 0), [moveTo]);

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
    // Steps in WINDOW px, which is what the pointer deltas below are in: the
    // grid's own sizes are in zoomed px (app/breakpoints.ts `uiZoom`).
    const zoom = uiZoom();
    const colStep = (((grid ? grid.clientWidth : 720) + colGap) / cols) * zoom;
    const rowStep = (autoRow + rowGap) * zoom;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = items.find((i) => i.id === id)!;
    const startSpan = start.span;
    const startRows = start.rows;

    const move = (ev: PointerEvent) => {
      const span = clamp(startSpan + Math.round((ev.clientX - startX) / colStep), MIN_SPAN, cols);
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
  // The hero's cell and the ad's row are taken before any widget is placed.
  const heroCell: Reserved | null = hero ? { col: 1, row: 1, span: HERO_SPAN, rows: HERO_ROWS } : null;
  const betweenCell: Reserved | null = between ? { col: 1, row: (heroCell ? HERO_ROWS : 0) + 1, span: cols, rows: 1 } : null;
  const reserved = [heroCell, betweenCell].filter((z): z is Reserved => !!z);
  // Every cell is placed explicitly (see pack.ts) so the add button can never be
  // backfilled into a hole mid-board — it always sits after the last widget.
  const packed = packBoard(shownItems, cols, ADD_SPAN, reserved);

  return (
    <>
      <div className={'wb-grid' + (cols === COLS ? '' : ` cols-${cols}`)} ref={gridRef}>
        {heroCell && (
          <div className="wb-hero" style={{ gridColumn: `1 / span ${Math.min(HERO_SPAN, cols)}`, gridRow: `1 / span ${HERO_ROWS}` }}>
            {hero}
          </div>
        )}
        {betweenCell && (
          <div className="wb-between" style={{ gridColumn: '1 / -1', gridRow: `${betweenCell.row}` }}>
            {between}
          </div>
        )}
        {shownItems.map((item) => (
          <Cell
            key={item.id}
            item={item}
            render={renderWidget}
            name={nameFor(item.id, cardCtx)}
            dragging={drag?.id === item.id}
            resizing={resizing === item.id}
            // The SAME helper the packer uses. This style used to take the raw
            // value while packBoard clamped, so a stored span of 8 grew implicit
            // column tracks on the six-column grid — reachable by pointer with
            // no AI involved, since the resize handler clamps to `cols` and that
            // is 10 on a wide page: resize wide, then narrow the window.
            size={cellSize(item, cols)}
            pos={packed.cells[item.id]}
            transition={transition}
            registerEl={registerEl}
            onDragStart={onDragStart}
            onResizeStart={startResize}
            onRemove={removeWidget}
            onToTop={item.id !== shownItems[0]?.id ? toTop : undefined}
          />
        ))}
        <button className="wb-add" type="button" onClick={() => setPicking(true)} style={{ gridColumn: `${packed.add.col} / span ${ADD_SPAN}`, gridRow: `${packed.add.row}` }}>
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
            {renderWidget(dragItem.id)}
          </div>,
          document.body,
        )}

      {picking && <WidgetPicker current={new Set(items.map((i) => i.id))} onAdd={addWidget} onClose={() => setPicking(false)} />}
    </>
  );
}

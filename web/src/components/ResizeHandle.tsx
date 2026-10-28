import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { uiZoom } from '../app/breakpoints';

export type ResizeEdge = 'left' | 'right' | 'top' | 'bottom';

export interface ResizeHandleProps {
  /** What it resizes — the separator's accessible name ("Resize Nova"). */
  label: string;
  /** The current size, px. */
  value: number;
  min: number;
  max: number;
  /**
   * The size asked for, px — UNCLAMPED while dragging, so the owner can treat
   * "past the max" as an intent of its own (Nova: go full screen). Keys stay
   * inside min…max.
   */
  onChange: (px: number) => void;
  /** The drag ended (or a key was pressed), with the last size asked for. */
  onRelease?: (px: number) => void;
  /**
   * Which edge of the surface the handle sits on; a left edge grows leftward,
   * a top edge upward. `left`/`right` size a width (←/→), `top`/`bottom` a
   * height (↑/↓).
   */
  edge?: ResizeEdge;
  /** Arrow-key step, px. Shift multiplies it by four. */
  step?: number;
  /** Fires when a drag starts and ends — the owner can pause transitions. */
  onDragState?: (dragging: boolean) => void;
  className?: string;
}

/**
 * Thin wrapper over `.ds-resize-handle` (shared/components.css): the edge of a
 * resizable surface, as a WAI-ARIA window splitter — `role="separator"` with
 * `aria-valuenow/min/max`, focusable, ←/→ (a side edge) or ↑/↓ (a top or
 * bottom edge) to resize, Home/End for the limits.
 *
 * It owns the gesture, not the size: it reports what was asked for and the
 * owner stores, clamps or reinterprets it.
 *
 * Avalonia: a `GridSplitter` on the panel's edge — ResizeDirection=Columns
 * for left/right, Rows for top/bottom.
 */
export function ResizeHandle({ label, value, min, max, onChange, onRelease, edge = 'left', step = 24, onDragState, className }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ at: number; v: number; last: number } | null>(null);
  // A side edge sizes a width along x, a top or bottom edge a height along y.
  const vertical = edge === 'top' || edge === 'bottom';
  const grow = edge === 'left' || edge === 'top' ? -1 : 1;

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { at: vertical ? e.clientY : e.clientX, v: value, last: value };
    setDragging(true);
    onDragState?.(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    // The pointer moves in window px; the size is in the surface's own px,
    // which the interface-size zoom (app/breakpoints.ts `uiZoom`) divides.
    const next = Math.round(s.v + (grow * ((vertical ? e.clientY : e.clientX) - s.at)) / uiZoom());
    s.last = next;
    onChange(next);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    start.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    onDragState?.(false);
    onRelease?.(s.last);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.shiftKey ? step * 4 : step;
    // The arrow moves the EDGE, as the pointer does: ← on a left-edge handle
    // moves it left, which widens the surface; ↑ on a top edge makes it taller.
    const [back, fwd] = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    let next: number | null = null;
    if (e.key === back) next = value - grow * by;
    else if (e.key === fwd) next = value + grow * by;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next == null) return;
    e.preventDefault();
    const clamped = Math.max(min, Math.min(max, next));
    onChange(clamped);
    onRelease?.(clamped);
  };

  return (
    <div
      className={['ds-resize-handle', edge === 'left' ? '' : edge, dragging ? 'dragging' : '', className].filter(Boolean).join(' ')}
      role="separator"
      // The orientation of the LINE: a side edge is a vertical splitter.
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    />
  );
}

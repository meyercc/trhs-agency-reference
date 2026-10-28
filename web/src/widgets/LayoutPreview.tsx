/**
 * Nova's proposed board, as an arrangement diagram (TH-442).
 *
 * It is NOT a scaled-down board. Rendering eight real widgets at thumbnail size
 * would be heavy and illegible, and a picture of unreadable cards tells you
 * nothing. What is worth showing is the *shape*: which widgets, how big, in what
 * order. So each cell is a labeled box at the proposed footprint.
 *
 * It is exact rather than approximate, because it borrows the board's own
 * arithmetic: `packBoard` — the same function `WidgetBoard` calls — places every
 * cell, and its `rowCount` drives an `aspect-ratio`. A board column is about
 * 163px and a board row is `--widget-row: 160px`, within 2% of square, so the
 * cells' proportions are the board's at any scale with no magic numbers.
 *
 * No new `.ds-` class, and no composed one either. The first draft composed
 * `.ds-stat-grid` and then overrode its `grid-template-columns` — but that
 * property IS that component ("a 2-column grid for key-value stat pairs"), and
 * the override won on source order alone, since both selectors are a single
 * class. A bundle reorder would have flipped it silently. `.wb-preview-*` owns
 * its grid instead, exactly as `.wb-grid` does for the real board.
 */
import { useMemo } from 'react';
import type { BoardItem } from './catalog';
import { cellSize, packBoard } from './pack';
import { COLS, nameFor, normalizeLayout, type LayoutContext } from './layout';
import { cardMetas } from './cardMeta';
import { useSettings } from '../state/Settings';
import './board.css';

export interface LayoutPreviewProps {
  /** The proposed board, as the reply's control record carries it. */
  items: readonly BoardItem[];
  /** Columns to draw. Defaults to the narrow board, which is what the chat is. */
  cols?: number;
}

export function LayoutPreview({ items, cols = COLS }: LayoutPreviewProps) {
  // A proposal can name a card Nova composed (TH-443), which has no catalog row
  // — without the vocabulary `normalizeLayout` would drop it from the diagram
  // while the board happily rendered it.
  const { cards } = useSettings();
  const ctx = useMemo<LayoutContext>(() => ({ cards: cardMetas(cards) }), [cards]);
  const nameOf = (id: string) => nameFor(id, ctx);
  // Re-normalized on render, not trusted. A control record is persisted in
  // `trhs-nova` and replayed, so an old conversation can hand us a proposal
  // whose widgets have since been gated — and a bad span would reach `packBoard`.
  const safe = useMemo(() => normalizeLayout(items as BoardItem[], ctx), [items, ctx]);
  const packed = useMemo(() => packBoard(safe, cols, 1), [safe, cols]);

  if (!safe.length) return null;

  const summary = `Proposed dashboard, ${cols} columns: ${safe.map((i) => nameOf(i.id)).join(', ')}`;

  return (
    <div className="wb-preview">
      <div
        className="wb-preview-grid"
        role="img"
        aria-label={summary}
        style={{ '--wb-preview-cols': cols, aspectRatio: `${cols} / ${Math.max(1, packed.rowCount)}` } as React.CSSProperties}
      >
        {safe.map((item) => {
          const at = packed.cells[item.id];
          const size = cellSize(item, cols);
          return (
            <div
              key={item.id}
              className="wb-preview-cell"
              data-widget={item.id}
              title={nameOf(item.id)}
              style={{ gridColumn: `${at.col} / span ${size.span}`, gridRow: `${at.row} / span ${size.rows}` }}
            >
              <span className="wb-preview-name">{nameOf(item.id)}</span>
            </div>
          );
        })}
      </div>
      <span className="wb-preview-state">
        {safe.length} widget{safe.length === 1 ? '' : 's'} · {cols} columns
      </span>
    </div>
  );
}

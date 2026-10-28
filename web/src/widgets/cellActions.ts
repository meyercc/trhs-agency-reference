import { createContext, useContext } from 'react';

/** What a widget may read and do about its own board cell — its footprint, and removal —
    for a widget that carries its own options menu (the monitor card's ⋮,
    Cindy 2026-10-01, from Chris 1:1 09-29 «Customize and × into the card's
    overflow menu»). Null outside the board (the drag overlay, a story).
    Provided by `WidgetBoard`'s cell; its own module so the card can read it
    without importing the board. */
export interface CellActions {
  span: number;
  rows: number;
  remove: () => void;
  /** Put the card first on the board — the board's one way to reorder without
      dragging. Absent on the card that is already first. */
  toTop?: () => void;
}
export const CellActionsContext = createContext<CellActions | null>(null);
export const useCellActions = () => useContext(CellActionsContext);

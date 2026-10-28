// Deterministic placement for the widget board.
//
// The board used to lean on `grid-auto-flow: row dense`, which packs tightly but
// backfills *any* later item into *any* earlier hole — including the "Add a
// widget" button, which then surfaced mid-board whenever a tall card left a gap
// (TH-423). Placing every cell explicitly reproduces the browser's dense
// first-fit for the widgets, and pins the add button to the true end: the first
// free slot, in reading order, after the last widget.

export interface Placed {
  col: number; // 1-based grid line
  row: number; // 1-based grid line
}

interface Sized {
  id: string;
  span: number;
  rows: number;
}

/**
 * The tallest a single cell may be while packing. The board's own cap is
 * MAX_ROWS (3); this is a looser backstop so a legitimately tall future widget
 * is not silently squashed, while `rows: 1e6` cannot allocate a million rows.
 */
const MAX_PACK_ROWS = 12;

/**
 * The only definition of a legal cell size, used by the packer AND by the
 * board's render site — they must not disagree, because `packBoard` clamping
 * `span` for PLACEMENT while the style attribute got the raw value is what let
 * a stored span of 8 grow implicit column tracks on the six-column grid.
 *
 * Note the deliberate asymmetry: a finite overshoot CLAMPS (`rows: 99` → the
 * cap) but a non-number FALLS BACK to 1 (`'lots'`, `undefined`, `NaN`,
 * `Infinity` → 1). Clamping garbage to the maximum would turn nonsense into the
 * biggest possible card; the smallest safe value is the honest reading of "I
 * cannot tell what this was meant to be". `Infinity` only reaches here from an
 * in-memory object — `JSON.stringify(Infinity)` is `null`, which takes the same
 * path.
 *
 * It coerces rather than clamps, and that is the load-bearing part.
 * `Math.min(NaN, cols)` is NaN and `Math.min('wide', 6)` is NaN, so a
 * non-numeric size either freezes the packer (`c + NaN <= cols` is false
 * forever, and the row loop has no exit condition) or emits `span NaN` into a
 * style string, where the browser drops the declaration and auto-places the
 * item into a column nobody asked for. Neither throws. Neither logs.
 */
export function cellSize(it: { span: unknown; rows: unknown }, cols: number): { span: number; rows: number } {
  const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 1);
  return {
    span: Math.max(1, Math.min(int(it.span), cols)),
    rows: Math.max(1, Math.min(int(it.rows), MAX_PACK_ROWS)),
  };
}

export interface Packed {
  cells: Record<string, Placed>;
  add: Placed;
  rowCount: number; // rows occupied by widgets alone (0 when the board is empty)
}

/** A region no widget may take: the hero carousel's cell, the inline ad's row (2026-10-21). */
export interface Reserved extends Placed {
  span: number;
  rows: number;
}

/**
 * First-fit, row-major — the same scan `grid-auto-flow: row dense` performs.
 * `reserved` regions are taken before any widget is placed, so the widgets
 * flow around them: beside the carousel on a wide page, under it on a narrow one.
 */
export function packBoard(items: readonly Sized[], cols: number, addSpan: number, reserved: readonly Reserved[] = []): Packed {
  const occupied: boolean[][] = []; // occupied[row][col], 0-based
  const rowAt = (r: number) => (occupied[r] ??= new Array<boolean>(cols).fill(false));
  const free = (r: number, c: number, span: number, rows: number) => {
    for (let y = r; y < r + rows; y++) for (let x = c; x < c + span; x++) if (rowAt(y)[x]) return false;
    return true;
  };
  const take = (r: number, c: number, span: number, rows: number) => {
    for (let y = r; y < r + rows; y++) for (let x = c; x < c + span; x++) rowAt(y)[x] = true;
  };
  // Clamped to the grid, as a cell is: a hero six wide on a two-column page
  // is the two columns, not four phantom tracks.
  for (const z of reserved) take(z.row - 1, z.col - 1, Math.max(1, Math.min(z.span, cols - z.col + 1)), Math.max(1, Math.min(z.rows, MAX_PACK_ROWS)));

  // ⚠️ `cellSize` is a HANG guard, not tidiness. `Math.min(NaN, cols)`
  // is NaN, so a non-numeric span makes `c + span <= cols` false forever, and
  // the `for (let r = 0; ; r++)` below has NO exit condition except `placed` —
  // the tab freezes with nothing thrown, nothing logged, and a CDP suite that
  // hits it HANGS rather than failing red. `rows: Infinity` freezes the same
  // way, by allocating a row array per iteration in `rowAt`. A layout written
  // by anything other than this board's own pointer code can carry either
  // (TH-442), and a stored layout from an older build already can.
  const cells: Record<string, Placed> = {};
  for (const it of items) {
    const { span, rows } = cellSize(it, cols);
    for (let r = 0; ; r++) {
      let placed = false;
      for (let c = 0; c + span <= cols; c++) {
        if (free(r, c, span, rows)) {
          take(r, c, span, rows);
          cells[it.id] = { col: c + 1, row: r + 1 };
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
  }

  // The add button goes in the first free slot, in reading order, after the
  // start cell of the reading-order-last widget. That is "after everything" as
  // the eye reads it: beside the last card if its row has room, else below.
  let rowCount = 0;
  let lastStart: Placed = { col: 0, row: 0 };
  for (const it of items) {
    const c = cells[it.id];
    // Same coercion as above: a raw NaN here makes rowCount NaN, which silently
    // breaks the add button's row and any consumer of rowCount (the preview).
    rowCount = Math.max(rowCount, c.row + cellSize(it, cols).rows - 1);
    if (c.row > lastStart.row || (c.row === lastStart.row && c.col > lastStart.col)) lastStart = c;
  }
  let add: Placed | null = null;
  for (let r = Math.max(0, lastStart.row - 1); !add; r++) {
    for (let c = r === lastStart.row - 1 ? lastStart.col : 0; c + addSpan <= cols; c++) {
      if (free(r, c, addSpan, 1)) {
        add = { col: c + 1, row: r + 1 };
        break;
      }
    }
  }
  return { cells, add, rowCount };
}

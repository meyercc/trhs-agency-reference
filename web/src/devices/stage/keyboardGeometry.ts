// The drawn keyboard's geometry, in key units (1 = one keycap, `--ku`).
//
// KeyboardHero lays the board out in CSS from keyboardLayout.ts; every length
// there is a multiple of --ku (keyboard-canvas.css). This file walks the same
// cells with the same rules, so the 3D notebook's keycaps sit where the drawn
// board's do — the camera can land on the 3D board and the drawn board can
// take over in the same place. No three.js here.

import {
  KB_ARROWS,
  KB_ARROW_UP,
  KB_FROW,
  KB_MEDIA,
  KB_NAV,
  KB_NUMPAD,
  KB_ROWS,
  isSpacer,
  type Cell,
  type KeySpec,
} from '../keyboardLayout';

/** keyboard-canvas.css: --kg, the board's padding, the gap between clusters. */
const GAP = 0.09;
const PAD = 0.42;
const CLUSTER = 0.5;
const MEDIA_W = 0.82;
const MEDIA_H = 0.6;

export interface KeyRect {
  code: string;
  label: string;
  /** Top-left corner from the board's outer top-left, in key units. */
  x: number;
  y: number;
  w: number;
  h: number;
  media?: boolean;
}

export interface BoardGeometry {
  width: number;
  height: number;
  keys: KeyRect[];
}

const keyW = (w = 1) => w + GAP * (w - 1);

/** One flex row of cells from x0; returns its keys and its width. */
function row(cells: Cell[], x0: number, y: number): { keys: KeyRect[]; width: number } {
  const keys: KeyRect[] = [];
  let x = x0;
  cells.forEach((c, i) => {
    if (i > 0) x += GAP;
    if (isSpacer(c)) {
      x += c.sp * (1 + GAP);
      return;
    }
    const w = keyW(c.w);
    keys.push({ code: c.code, label: c.base, x, y, w, h: 1 });
    x += w;
  });
  return { keys, width: x - x0 };
}

const rowY = (i: number) => PAD + i * (1 + GAP);

function gridSpan(v: string | undefined): [number, number] {
  // "1", "2 / span 2", "1 / span 2" → [start (0-based), span]
  if (!v) return [0, 1];
  const m = v.match(/^(\d+)(?:\s*\/\s*span\s*(\d+))?$/);
  return m ? [Number(m[1]) - 1, m[2] ? Number(m[2]) : 1] : [0, 1];
}

let cached: BoardGeometry | null = null;

/** The whole board: main block, nav cluster, media row + numpad. */
export function boardGeometry(): BoardGeometry {
  if (cached) return cached;
  const keys: KeyRect[] = [];

  // Main block — the F-row, then the five rows; as wide as its widest row.
  let mainW = 0;
  [KB_FROW, ...KB_ROWS].forEach((cells, i) => {
    const r = row(cells, PAD, rowY(i));
    keys.push(...r.keys);
    mainW = Math.max(mainW, r.width);
  });

  // Nav cluster — three rows of three, an empty row, the inverted T.
  const navX = PAD + mainW + CLUSTER;
  const navW = keyW(1) * 3 + GAP * 2;
  [0, 3, 6].forEach((start, i) => keys.push(...row(KB_NAV.slice(start, start + 3), navX, rowY(i)).keys));
  keys.push(...row([KB_ARROW_UP], navX + (navW - 1) / 2, rowY(4)).keys);
  keys.push(...row(KB_ARROWS, navX, rowY(5)).keys);

  // Right — the media keys (short caps centred in a key row), then the numpad
  // grid: four columns, five rows, + and Ent two tall, 0 two wide.
  const rightX = navX + navW + CLUSTER;
  KB_MEDIA.forEach((k: KeySpec, i) => {
    keys.push({ code: k.code, label: k.base, x: rightX + i * (MEDIA_W + GAP), y: rowY(0) + (1 - MEDIA_H) / 2, w: MEDIA_W, h: MEDIA_H, media: true });
  });
  KB_NUMPAD.forEach((k) => {
    const [c, cs] = gridSpan(k.gc);
    const [r, rs] = gridSpan(k.gr);
    keys.push({ code: k.code, label: k.base, x: rightX + c * (1 + GAP), y: rowY(1 + r), w: keyW(cs), h: keyW(rs) });
  });
  const rightW = 4 + GAP * 3;

  cached = {
    width: rightX + rightW + PAD,
    height: PAD * 2 + 6 + GAP * 5,
    keys,
  };
  return cached;
}

// ── A notebook's board ────────────────────────────────────────────────────────

export interface LaptopBoardOptions {
  /** A numpad on the right (the 16" machines have one). */
  numpad: boolean;
  /** Dedicated macro keys, a column on the far left (keys-macros.7). 0 = none. */
  macroKeys: number;
}

/** The macro keys' codes, in order: p1 … pN. */
export const macroKeyCodes = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);

const laptopCache = new Map<string, BoardGeometry>();

/**
 * The 3D notebook's keyboard (laptopModel.ts): the main block with the
 * arrows as an inverted T beside it, a numpad where the machine has one, and
 * the macro keys as a column on the far left, one key per row from the
 * number row down. No nav cluster and no media keys — a notebook has
 * neither. The main block's cells are the drawn board's (keyboardLayout.ts),
 * so a key's code is the one lighting and key assignments use; the macro
 * keys are `p1`…`pN`, which no lighting zone names (they take the colour of
 * the keys beside them when painted).
 */
export function laptopBoardGeometry(o: LaptopBoardOptions): BoardGeometry {
  const key = `${o.numpad ? 'n' : '-'}${o.macroKeys}`;
  const hit = laptopCache.get(key);
  if (hit) return hit;
  const keys: KeyRect[] = [];
  let x0 = PAD;
  if (o.macroKeys > 0) {
    macroKeyCodes(o.macroKeys).forEach((code, i) => keys.push({ code, label: code.toUpperCase(), x: x0, y: rowY(1 + i), w: 1, h: 1 }));
    x0 += 1 + CLUSTER;
  }
  let mainW = 0;
  [KB_FROW, ...KB_ROWS].forEach((cells, i) => {
    const r = row(cells, x0, rowY(i));
    keys.push(...r.keys);
    mainW = Math.max(mainW, r.width);
  });
  // The arrows, an inverted T in the bottom two rows beside the main block.
  const arrowX = x0 + mainW + GAP * 3;
  keys.push(...row([KB_ARROW_UP], arrowX + 1 + GAP, rowY(4)).keys);
  keys.push(...row(KB_ARROWS, arrowX, rowY(5)).keys);
  let right = arrowX + keyW(1) * 3 + GAP * 2;
  if (o.numpad) {
    const numX = right + CLUSTER;
    KB_NUMPAD.forEach((k) => {
      const [c, cs] = gridSpan(k.gc);
      const [r, rs] = gridSpan(k.gr);
      keys.push({ code: k.code, label: k.base, x: numX + c * (1 + GAP), y: rowY(1 + r), w: keyW(cs), h: keyW(rs) });
    });
    right = numX + 4 + GAP * 3;
  }
  const geo: BoardGeometry = { width: right + PAD, height: PAD * 2 + 6 + GAP * 5, keys };
  laptopCache.set(key, geo);
  return geo;
}

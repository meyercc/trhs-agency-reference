// ══════════════════════════════════════════════════════════════════════════
// Shared arrangement model — one desk drawing, two surfaces.
//
// The monitor modal hero (DisplayArrange) and the Perform Device Overview map
// read and write the SAME saved layout (Settings.displayArrange), so a display
// dragged in one place has moved in the other. Decision C, 2026-07-28:
// "one schematic, two verbs (View / Arrange)" — design-assets/chris-sync-2026-07.md #2.
//
// Coordinates are FRACTIONS of the stage box (0–1, tile top-left), not pixels.
// Measured 2026-07-30: the modal hero stage is 988×230 (fluid — it tracks the
// modal width) and the Perform stage is 672×248, so a pixel saved on one stage
// lands somewhere else on the other, and the modal's own layout shifts when the
// window is resized. Fractions fix both. `space: 'fraction'` tags the payload;
// anything without that tag is a legacy pixel layout and falls back to DEFAULTS.
// ══════════════════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import type { DisplayArrange as ArrangeState } from '../state/Settings';

export type Frac = { left: number; top: number };
export type Positions = Record<string, Frac>;

// Displays the OS knows about — the drag/save roster. The clamshell Gaming
// Laptop is deliberately absent: a closed lid is not part of a display
// arrangement (Cindy, 2026-07-29), so it is placed relative to the monitor it
// drives instead. See SLAB_OFFSET.
export const DISPLAYS = [
  { id: 'oled-27', name: 'OMEN OLED 27', kind: 'monitor', sku: 'pulse-27' },
  { id: 'builtin', name: 'Built-in Display', kind: 'laptop' },
  { id: 'treehouse-32', name: 'Treehouse 32', kind: 'monitor', sku: 'treehouse-32' },
] as const;

export const TILE_W: Record<string, number> = { monitor: 144, laptop: 112 };
export const TILE_H: Record<string, number> = { monitor: 82, laptop: 70 };

// ── Photoreal tile sizes (2026-08-02, Cindy) ────────────────────────────────
// The schematic tiles sized every monitor the same (144px) and the laptop at
// 78% of one, which is not what a desk looks like: a 16" laptop is about HALF
// the width of a 32" monitor. A photoreal map cannot borrow that fudge — a real
// render at the wrong size reads as a wrong render — so tile width comes from
// the hardware's physical width, and everything else is measured, not guessed.
//
// WIDTH_CM = the product's overall width (not the diagonal): what you would
// measure across the desk. The 32" draws at TILE_REF px and the rest follow.
const TILE_REF = 132; // px drawn for the 32"
const WIDTH_CM: Record<string, number> = { 'treehouse-32': 71.5, 'oled-27': 61.0, builtin: 35.6 };

// Where the hardware actually sits inside each PNG. Measured 2026-08-02 with
// Pillow (alpha bounding box of the source files), not eyeballed:
//   treehouse32-front-tight  1150x1080  bbox (84,158,1067,888)
//   omen-oled27-front        2112x1572  bbox (317,312,1795,1278)
//   macbook-front-generic    2219x1472  bbox (256,256,1963,1216)
// The three were authored at different times with different margins (the
// Treehouse file is nearly square, the OLED has ~15% padding a side), so the
// tile crops to this box instead of drawing the whole file. Without it the
// selection ring frames a rectangle of empty PNG rather than the display.
// ⚠️ This is a workaround for renders that do not share a frame. The real fix
// is one export spec for the whole set — see progress.md 2026-08-02.
export interface RenderBox { w: number; h: number; l: number; t: number; iw: number; ih: number }
const BOX: Record<string, RenderBox> = {
  'treehouse-32': { iw: 1150, ih: 1080, l: 84, t: 158, w: 983, h: 730 },
  'oled-27': { iw: 2112, ih: 1572, l: 317, t: 312, w: 1478, h: 966 },
  builtin: { iw: 2219, ih: 1472, l: 256, t: 256, w: 1707, h: 960 },
};

export const renderBox = (id: string): RenderBox => BOX[id] ?? BOX['oled-27'];

// ── Arrange-editor tile sizes ───────────────────────────────────────────────
// The precise editor sizes displays by PIXEL SPACE, not physical size, because
// what it is editing is where the cursor crosses — and the cursor travels in
// pixels. So the two lenses on the same desk draw deliberately different
// pictures: the view map asks "how big is this thing on my desk" (WIDTH_CM
// above), the editor asks "how much screen does it contribute".
//
// These are LOGICAL points, the space the OS arranges in, not native pixels —
// a 16" MacBook is 3456x2234 physical but arranges as ~1728x1117. ⚠️ The values
// below are the defaults for these panels; a real implementation reads the
// user's current scaling instead, which can change these numbers a lot.
const LOGICAL: Record<string, { w: number; h: number }> = {
  'treehouse-32': { w: 3840, h: 2160 },
  'oled-27': { w: 2560, h: 1440 },
  builtin: { w: 1728, h: 1117 },
};
/** px per logical point — tuned so the default three-display desk fits the
    editor stage with room to rearrange. */
export const ARRANGE_SCALE = 0.078;

/** Editor tile size for a display, in stage px. */
export function logicalTile(id: string): { w: number; h: number } {
  const l = LOGICAL[id] ?? LOGICAL['oled-27'];
  return { w: Math.round(l.w * ARRANGE_SCALE), h: Math.round(l.h * ARRANGE_SCALE) };
}

/** Drawn size of a display's render — the photoreal tile's bounds = the
    hardware's box, so the ring hugs the display and the drag grabs it. */
export function photoTile(id: string): { w: number; h: number } {
  const cm = WIDTH_CM[id] ?? WIDTH_CM['oled-27'];
  const b = renderBox(id);
  // Honest ratios, but not below a grabbable tile: a 16" laptop really is half
  // the width of a 32" monitor, and at TILE_REF that lands near 66px — true to
  // the desk and too small to aim at. The floor trades a little accuracy at the
  // small end for a target you can hit; the big end stays exact.
  const w = Math.max(90, Math.round(TILE_REF * (cm / WIDTH_CM['treehouse-32'])));
  return { w, h: Math.round((w * b.h) / b.w) };
}
// Room kept under a tile for its name label (Chris's clamp used the same 24px).
const NAME_GUTTER = 24;

// Default layout = the reviewed Device Overview map (v3), converted from its
// 672×248 stage so both surfaces open on the same picture.
export const DEFAULTS: Positions = {
  'oled-27': { left: 24 / 672, top: 64 / 248 },
  builtin: { left: 205 / 672, top: 78 / 248 },
  'treehouse-32': { left: 354 / 672, top: 64 / 248 },
};

// Mirror stacks the displays (mode-only; never overwrites saved positions).
// Converted from Chris's MIRROR constants on his 672-wide authoring stage.
export const MIRROR: Positions = {
  'oled-27': { left: 300 / 672, top: 70 / 230 },
  builtin: { left: 314 / 672, top: 78 / 230 },
  'treehouse-32': { left: 328 / 672, top: 86 / 230 },
};

// The clamshell laptop is not a display, so it has no saved position — it sits
// at a fixed offset from the monitor it feeds and travels with it.
export const SLAB_ANCHOR = 'treehouse-32';
export const SLAB_OFFSET: Frac = { left: (535 - 354) / 672, top: (133 - 64) / 248 };

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const isFrac = (p: unknown): p is Frac =>
  !!p && Number.isFinite((p as Frac).left) && Number.isFinite((p as Frac).top);

/** CSS position for a fraction — percentages need no stage measurement. */
export const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

/** Saved layout → usable state, discarding pre-fraction (pixel) payloads. */
export function readArrangement(saved: ArrangeState | null): {
  mode: 'extend' | 'mirror';
  positions: Positions;
} {
  if (!saved || saved.space !== 'fraction') return { mode: saved?.mode ?? 'extend', positions: DEFAULTS };
  // Keep only well-formed entries: a display whose saved pair is incomplete or
  // non-finite falls back to its default rather than rendering nowhere.
  const clean: Positions = { ...DEFAULTS };
  for (const [id, p] of Object.entries(saved.positions ?? {})) if (isFrac(p)) clean[id] = p;
  return { mode: saved.mode, positions: clean };
}

export function offsetFrom(pos: Frac | undefined, offset: Frac): Frac {
  const base = pos ?? DEFAULTS[SLAB_ANCHOR];
  return { left: base.left + offset.left, top: base.top + offset.top };
}

/**
 * Pointer-drag for one tile, in fraction space. Shared by the modal hero and
 * the Perform map so both surfaces move a display exactly the same way.
 */
export function useArrangeDrag(opts: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  getPositions: () => Positions;
  onMove: (next: Positions) => void;
  onCommit: (next: Positions) => void;
  /** Pointer released without ever moving — i.e. a click, not a drag. Surfaces
      use this to drop their live copy without writing anything. */
  onCancel?: () => void;
  /** Tile bounds override — photoreal tiles are sized per display, not per
      kind. Defaults to the schematic TILE_W/TILE_H so the Perform map, which
      still draws schematic tiles, is unaffected. */
  getSize?: (id: string, kind: string) => { w: number; h: number };
  /** Adjust the free-dragged position before it is committed, in stage px.
      The precise editor uses this to pull edges flush; surfaces without it
      drag freely, exactly as before. */
  snap?: (id: string, cand: { left: number; top: number }, size: { w: number; h: number }) => { left: number; top: number };
}) {
  const { stageRef, enabled, getPositions, onMove, onCommit, onCancel, getSize, snap } = opts;

  return useCallback(
    (e: React.PointerEvent, id: string, kind: string) => {
      if (!enabled) return;
      const stage = stageRef.current;
      if (!stage) return;
      const sr = stage.getBoundingClientRect();
      // A collapsed stage (hidden panel, zero-width window) would divide by zero
      // and persist NaN over a good layout — don't start a drag we can't measure.
      if (sr.width <= 0 || sr.height <= 0) return;
      const { w, h } = getSize ? getSize(id, kind) : { w: TILE_W[kind], h: TILE_H[kind] };
      const start = getPositions()[id] ?? DEFAULTS[id];
      const dx = e.clientX - (sr.left + start.left * sr.width);
      const dy = e.clientY - (sr.top + start.top * sr.height);
      (e.target as Element).setPointerCapture(e.pointerId);

      let latest = getPositions();
      // A press that never moved is a CLICK, and a click must not write the
      // layout. Committing unconditionally meant tapping a display to open its
      // settings also re-saved the arrangement — and on a surface whose commit
      // recentres the group, that made the whole desk visibly jump on a click
      // nobody meant as a drag (Cindy, 2026-08-03).
      let moved = false;
      const move = (ev: PointerEvent) => {
        moved = true;
        let left = Math.max(0, Math.min(sr.width - w, ev.clientX - sr.left - dx));
        let top = Math.max(0, Math.min(sr.height - h - NAME_GUTTER, ev.clientY - sr.top - dy));
        if (snap) ({ left, top } = snap(id, { left, top }, { w, h }));
        latest = { ...latest, [id]: { left: round(left / sr.width), top: round(top / sr.height) } };
        onMove(latest);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (moved) onCommit(latest);
        else onCancel?.();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [stageRef, enabled, getPositions, onMove, onCommit, onCancel, getSize, snap],
  );
}

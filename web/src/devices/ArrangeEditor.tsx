// ══════════════════════════════════════════════════════════════════════════
// Arrange displays — the precise lens on the desk (2026-08-02, Cindy).
//
// The desk has two lenses over ONE saved layout (Settings.displayArrange):
//   • the modal hero  = the view. Photoreal, always on, read-only. Answers
//     "what is on my desk and what is it plugged into".
//   • this editor     = the hand. Plain rectangles, entered on purpose,
//     answers "where does my cursor cross from one screen to the next".
// Chris, 1:1 2026-07-30 (transcript 00:12:29), on why they are not one screen:
// arranging is "literally trying to move a few pixels just to get it to line
// up correctly… this might look kind of gross compared to the digital twin
// version". The split was Cindy's proposal in that call; he agreed and hedged.
//
// Two things follow from "this is the pixel lens":
//   1. Tiles are sized by LOGICAL RESOLUTION, not physical width — the cursor
//      travels in pixels, so that is the space being edited. A display can be
//      bigger here and smaller in the view; that is correct, not a bug.
//   2. Displays are ALWAYS JOINED — see dock(). Not "snap when you get close":
//      a floating display is not a state this editor can be in. There is also no
//      separate "which edge joins which" control, because a flush edge IS the
//      crossing; position already says it, the same way the OS editors say it.
//      NOTE the deliberate difference from the view lens: gaps are wrong HERE
//      (coordinate space must be continuous) and right THERE (a real desk has
//      space between the monitors). Same order, different spacing — the view is
//      free to spread things out, this screen is not (Cindy, 2026-08-03).
//
// What travels between the lenses is ROWS, not coordinates (2026-08-05). "Same
// order" was literally a left-to-right order until then, and a desk is not one
// dimensional: displays on an arm sit above each other, and that includes an
// OPEN LAPTOP on a laptop arm, which is in this roster (Cindy, 2026-08-05 —
// "모니터 암이 모니터에만 해당되는 게 아니야"). So the saved layout now carries
// who is beside whom AND who is above whom, and each lens keeps its own spacing.
// See groupRows() in ./arrangement.ts.
// ══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Backdrop, Button, ToggleButtonGroup } from '../components';
import { ModalShell } from '../components/ModalShell';
import { useSettings } from '../state/Settings';
import {
  DEFAULTS,
  DISPLAYS,
  visibleDisplays,
  MIRROR,
  ROW_GAP_TOKEN,
  STAGE_INSET_TOKEN,
  groupRows,
  hasStoredLayout,
  computerSide,
  hasTower,
  deskHosts,
  defaultsFor,
  logicalTile,
  pct,
  photoTile,
  readArrangement,
  tokenPx,
  useArrangeDrag,
  type IdRect,
  type Positions,
  standOnFloor,
} from './arrangement';
import './arrange-editor.css';

/** Shortest shared edge a dock is allowed to leave, in stage px — below this
    two displays touch at a corner, which is not a crossing the pointer can use. */
const MIN_SHARE = 28;

/**
 * Edge-alignment magnet on the SLIDING axis, in stage px — same reach as the
 * hero's bottom-line magnet (SNAP_PX, DisplayArrange.tsx).
 *
 * dock() glues the axis you are docking on; the other axis used to slide freely
 * to wherever the pointer was. So "put this beside that" landed with the two
 * bottoms a few px apart — invisible at drop time, and then the next tile docked
 * underneath rests on the LOWER of the two bottoms and daylight opens under the
 * higher one (measured 2026-08-05, from Cindy's session: OMEN OLED 27 beside
 * Treehouse 32, bottoms ~5px apart, Built-in Display flush under one and gapped
 * under the other — "1번하고 2번 사이에 약간의 미세한 간격").
 *
 * Within reach, edges align exactly; past it, a deliberate stagger is the
 * user's own and stays.
 */
const EDGE_SNAP = 8;

/** Align a slid coordinate to the neighbour's matching edges when close. */
function alignEdge(slid: number, span: number, oStart: number, oEnd: number): number {
  if (Math.abs(slid - oStart) <= EDGE_SNAP) return oStart;
  if (Math.abs(slid + span - oEnd) <= EDGE_SNAP) return oEnd - span;
  return slid;
}

interface Rect { left: number; top: number; w: number; h: number }

const right = (r: Rect) => r.left + r.w;
const bottom = (r: Rect) => r.top + r.h;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Touching is legal; sharing area is not. */
const overlaps = (a: Rect, b: Rect) =>
  right(a) - 0.5 > b.left && right(b) - 0.5 > a.left && bottom(a) - 0.5 > b.top && bottom(b) - 0.5 > a.top;

/**
 * Project a freely dragged rect onto the nearest LEGAL arrangement: flush
 * against a neighbour, never overlapping one.
 *
 * A display may not float. The desktop is one coordinate space and the pointer
 * walks through it, so a gap is a band of coordinates belonging to no display —
 * there is nowhere for the pointer to be while it crosses. The OS editors do
 * not allow it either (Cindy, from daily use). Overlap is the same rule from
 * the other side: one coordinate cannot belong to two displays.
 *
 * So this is not "snap when you get close" — there is no illegal position to be
 * in. Every candidate is docked to some neighbour's edge, the perpendicular
 * axis slides freely (clamped to keep a real shared edge), and docks that would
 * overlap somebody are discarded before the nearest survivor wins.
 */
function dock(
  cand: Rect,
  others: Rect[],
  /** Where this tile was before the pointer moved — the fallback when nothing
      legal is in reach. Must itself be legal, which it is: it is a position this
      function returned (or the packed layout the editor opened with). */
  lastLegal: { left: number; top: number },
): { left: number; top: number } {
  if (!others.length) return { left: cand.left, top: cand.top };
  type Option = { left: number; top: number; d: number };
  const opts: Option[] = [];
  for (const o of others) {
    // Butt against each side; the free axis keeps at least MIN_SHARE of overlap
    // so the two displays share an edge segment rather than a corner point —
    // and within EDGE_SNAP it aligns to the neighbour's matching edge outright,
    // so "almost level" collapses to "level" instead of surviving as a few px
    // of stagger that opens daylight under the next dock.
    const slideY = alignEdge(
      clamp(cand.top, o.top - cand.h + MIN_SHARE, bottom(o) - MIN_SHARE),
      cand.h,
      o.top,
      bottom(o),
    );
    const slideX = alignEdge(
      clamp(cand.left, o.left - cand.w + MIN_SHARE, right(o) - MIN_SHARE),
      cand.w,
      o.left,
      right(o),
    );
    const cands: { left: number; top: number }[] = [
      { left: o.left - cand.w, top: slideY }, // to its left
      { left: right(o), top: slideY }, // to its right
      { left: slideX, top: o.top - cand.h }, // above it
      { left: slideX, top: bottom(o) }, // below it
    ];
    for (const c of cands) {
      const r: Rect = { ...c, w: cand.w, h: cand.h };
      if (others.some((x) => overlaps(r, x))) continue;
      opts.push({ ...c, d: Math.hypot(c.left - cand.left, c.top - cand.top) });
    }
  }
  // Every dock overlapped something (a very crowded desk). This used to return
  // the raw dragged position, which is how an ILLEGAL layout got through: the
  // tile stayed wherever the pointer was, overlapping a neighbour — measured
  // 2026-08-05 from Cindy's own session, Treehouse 32 sitting 8px inside the
  // OMEN OLED 27. "Leave the drag where it is" reads as harmless and is exactly
  // the state this screen is built to make impossible.
  // So: refuse the move instead. The tile stays at the last position that WAS
  // legal, the pointer keeps going, and a legal spot picks it up again.
  if (!opts.length) return lastLegal;
  opts.sort((a, b) => a.d - b.d);
  return { left: opts[0].left, top: opts[0].top };
}


/**
 * Close the arrangement up and centre it, WITHOUT flattening it into one row.
 *
 * This was `packRow` until 2026-08-05, and it is the reason a display dragged
 * on top of another sprang back the moment the pointer was released: it sorted
 * every tile by `left` and butted each one against the previous, so the only
 * shape it could produce was a single row. It ran on release as well as on open,
 * which is why the stack was visibly undone rather than merely unsaved.
 *
 * Now rows are preserved: each row closes up left-to-right, rows stack
 * top-to-bottom, and the whole group is parked in the middle of the stage — the
 * same "the desk sits centred" rule the view hero follows (Cindy, 2026-08-03).
 *
 * Honest limit: this makes the arrangement TIDY, not provably gap-free. Two rows
 * whose members sit at different heights can leave a wedge of coordinate space
 * between them, and closing every such wedge is a packing problem this screen
 * does not need to solve — `dock()` is what guarantees legality for the tile
 * actually being moved, one drag at a time.
 */
function packLayout(rects: IdRect[], stage: { width: number; height: number }): IdRect[] {
  const rows = groupRows(rects.map((r) => ({ ...r })));

  // Within a row: butt each tile against the chain, sliding vertically only as
  // far as a real shared edge requires (a corner touch is not a crossing) — and
  // through the same EDGE_SNAP magnet the live drag uses, so a stagger that is
  // within the magnet's reach settles level HERE too. This is what tidies a
  // layout saved before the magnet existed: packLayout runs on open and on
  // release, so the near-miss does not have to be re-dragged to heal.
  for (const row of rows) {
    for (let i = 1; i < row.length; i++) {
      const prev = row[i - 1];
      row[i].left = right(prev);
      row[i].top = alignEdge(
        clamp(row[i].top, prev.top - row[i].h + MIN_SHARE, bottom(prev) - MIN_SHARE),
        row[i].h,
        prev.top,
        bottom(prev),
      );
    }
  }

  // Between rows: keep a real shared edge sideways first — two rows that overlap
  // by only a few px are two islands the pointer cannot walk between, which is
  // the same rule MIN_SHARE enforces inside a row, applied to the other axis.
  for (let k = 1; k < rows.length; k++) {
    const above = rows[k - 1];
    const row = rows[k];
    const aL = Math.min(...above.map((r) => r.left));
    const aR = Math.max(...above.map(right));
    const rL = Math.min(...row.map((r) => r.left));
    const rR = Math.max(...row.map(right));
    if (Math.min(aR, rR) - Math.max(aL, rL) < MIN_SHARE) {
      const dx = rL > aL ? aR - MIN_SHARE - rL : aL + MIN_SHARE - rR;
      for (const r of row) r.left += dx;
    }

    // …then sit each tile on WHATEVER IS ACTUALLY ABOVE IT, one tile at a time.
    //
    // Not on the row as a block (Cindy, 2026-08-05: "면끼리 닿는 부분은 전부 다
    // 붙을 수 있게 해야 되는데, 어떤 경우에는 붙고 어떤 경우에는 안 붙거든").
    // Aligning the whole row to the row above's LOWEST bottom leaves a gap under
    // every tile that ends higher: measured, dragging Treehouse 32 to the lower
    // left parked it flush under the MacBook (bottom 233.1) and therefore 4.2px
    // clear of the OMEN OLED 27 (bottom 228.9) — the one tile it was actually
    // under. A 4px gap is a band of coordinates belonging to no display, which is
    // the one thing this screen exists to prevent.
    //
    // Honest limit, unchanged in kind but much smaller: a tile spanning TWO tiles
    // above with different bottoms still lands on the lower of them, so a wedge
    // remains under the higher one. Closing every such wedge is rectangle packing
    // and not this screen's job — `dock()` guarantees the tile being dragged.
    const rowFloor = Math.max(...above.map(bottom));
    for (const r of row) {
      const over = above.filter((a) => Math.min(right(a), right(r)) - Math.max(a.left, r.left) > 0.5);
      r.top = over.length ? Math.max(...over.map(bottom)) : rowFloor;
    }
  }

  const out = rows.flat();
  const minL = Math.min(...out.map((r) => r.left));
  const maxR = Math.max(...out.map((r) => right(r)));
  const minT = Math.min(...out.map((r) => r.top));
  const maxB = Math.max(...out.map((r) => bottom(r)));
  const dx = (stage.width - (maxR - minL)) / 2 - minL;
  const dy = (stage.height - (maxB - minT)) / 2 - minT;
  for (const r of out) { r.left += dx; r.top += dy; }
  return out;
}

/**
 * Re-draw the SAVED (view-lens) desk so it has the rows this editor just made —
 * as a DESIGNED picture, not a copy of this screen's coordinates.
 *
 * What travels between the lenses is the arrangement's SHAPE ONLY: who is
 * beside whom, who is above whom, in what left-to-right order. Everything else
 * about the view's picture is composed by rule (Cindy, 2026-08-29: "두 화면의
 * 위치를 맞추는 게 아니라 관계만 맞추고, hero 그림은 우리가 설계한 값으로").
 * This function used to re-use the horizontal gaps it found in the saved layout
 * "in order" — but a walk across rows consumed a flat gap list measured on a
 * different desk, and the tops were written row-aligned to the CEILING. The
 * result read as devices hung from a rail at odd spacings (Cindy's 2026-08-29
 * report: "히어로 섹션에서 각 디바이스 사이 간격이 이상해 보이고 … 위에로
 * Align이 돼").
 *
 * The designed rules, each one an existing decision:
 *   • WITHIN a row — bottoms aligned on the row's floor: things standing on a
 *     desk share the desk surface (2026-08-06; the defaults have always drawn
 *     this way, see FLOOR in arrangement.ts).
 *   • ACROSS a row — the DEFAULT desk's evened gap, measured from DEFAULTS in
 *     this same frame, so an editor round trip lands looking like the desk the
 *     app opens with. Hand-set spacing has exactly one home: the Personalize
 *     DESK card, where the gaps are the content (2026-08-20). This screen
 *     cannot express desk gaps at all, so it does not get to write them.
 *   • BETWEEN rows — ROW_GAP_TOKEN, the arm's real ~2cm (2026-08-07).
 *   • Rows centred on the widest row, because a stack is the arm case and an
 *     arm mounts screens on a shared vertical axis.
 *
 * Sizes are the VIEW's tiles (photoTile), not this screen's — the point of the
 * whole exercise is that the two lenses draw the same desk at different sizes.
 */
/** The ruler saved fractions are measured against — `--dsa-href`/`--dsa-vref`
    on the view lens's stage, NOT that stage's live box (see their notes in
    DisplayArrange). Every conversion between stored fractions and pixels has to
    use these, in both directions and on both screens; mixing the two rulers is
    what drew one desk in the editor and a different one behind it. Falls back
    to the element's own box for a surface that does not define the tokens. */
function viewRefs(view: HTMLElement, box: DOMRect) {
  const cs = getComputedStyle(view);
  return {
    hRef: parseFloat(cs.getPropertyValue('--dsa-href')) || box.width,
    vRef: parseFloat(cs.getPropertyValue('--dsa-vref')) || box.height,
  };
}

function projectRowsOntoView(
  editorRects: IdRect[],
  viewStage: HTMLElement,
): Positions | null {
  const sr = viewStage.getBoundingClientRect();
  if (sr.width <= 0 || sr.height <= 0) return null;
  // ── Divide by the ruler the view MULTIPLIES by, not by its live box ──────
  // Saved fractions are read against `--dsa-href`/`--dsa-vref` — fixed
  // reference numbers, deliberately not the live stage (see their notes in
  // DisplayArrange: a fraction of the live box would move every display each
  // time the window changed shape). This write used to divide by the live box
  // anyway, so a layout saved here came back distorted by however much the
  // window differed from the reference — at 1512×950 that was ×0.82 sideways
  // and ×1.59 down, which pulled tiles onto each other and pushed rows apart
  // (Cindy's overlapping desk, 2026-08-24). The editor looked right and the
  // hero looked wrong because only one of them was using the wrong ruler.
  const { hRef, vRef } = viewRefs(viewStage, sr);

  // The designed side-to-side gap: the DEFAULT desk's evened spacing, measured
  // from DEFAULTS in this same frame. One number for every gap this write lays
  // — evened gaps are what the reviewed default desk looks like (2026-08-06,
  // "Unequal gaps under deliberately unequal widths read as a desk that is
  // off-centre"). Falls back to the ramp if the roster ever has one display.
  const defGap = (() => {
    const ds = visibleDisplays()
      .map((d) => ({ l: DEFAULTS[d.id].left * hRef, w: photoTile(d.id).w }))
      .sort((a, b) => a.l - b.l);
    const gs: number[] = [];
    for (let i = 1; i < ds.length; i++) gs.push(ds[i].l - (ds[i - 1].l + ds[i - 1].w));
    const real = gs.filter((g) => g > 0);
    return real.length
      ? real.reduce((a, b) => a + b, 0) / real.length
      : tokenPx(viewStage, '--gutter', 24);
  })();
  const rowGap = tokenPx(viewStage, ROW_GAP_TOKEN, 4);

  const rows = groupRows(editorRects).map((row) =>
    row.map((r) => {
      const t = photoTile(r.id);
      return { id: r.id, left: 0, top: 0, w: t.w, h: t.h };
    }),
  );

  // Lay each row on its FLOOR, then stack the rows. `top = y` (the ceiling)
  // was the 2026-08-29 bug: a row of unequal tiles came back hung from a rail,
  // bottoms staggered — the opposite of hardware standing on a desk.
  let y = 0;
  for (const row of rows) {
    const rowH = Math.max(...row.map((r) => r.h));
    let x = 0;
    for (const r of row) {
      r.left = x;
      r.top = y + (rowH - r.h);
      x += r.w + defGap;
    }
    y += rowH + rowGap;
  }

  // Centre every row on the widest one — the shared vertical axis of an arm.
  const widest = Math.max(
    ...rows.map((row) => Math.max(...row.map((r) => r.left + r.w)) - Math.min(...row.map((r) => r.left))),
  );
  for (const row of rows) {
    const w = Math.max(...row.map((r) => r.left + r.w)) - Math.min(...row.map((r) => r.left));
    const shift = (widest - w) / 2 - Math.min(...row.map((r) => r.left));
    for (const r of row) r.left += shift;
  }

  // Park the desk at the stage's inset, NOT centred.
  //
  // Centring is the view lens's own job on every render, and it cannot be done
  // from here: how the view centres depends on how much it has to shrink the desk
  // to fit (fitScale), and that in turn depends on the very layout being written.
  // Writing a "centred" layout would be guessing the answer to that circle. What
  // this write does owe the view is coordinates that are inside its stage — every
  // value ≥ 0 — which is exactly what parking at the inset guarantees.
  const pad = tokenPx(viewStage, STAGE_INSET_TOKEN, 16);
  const all = rows.flat();
  const minL = Math.min(...all.map((r) => r.left));
  const minT = Math.min(...all.map((r) => r.top));
  const out: Positions = {};
  for (const r of all) {
    out[r.id] = {
      left: +((r.left - minL + pad) / hRef).toFixed(4),
      top: +((r.top - minT + pad) / vRef).toFixed(4),
    };
  }
  return out;
}

export function ArrangeEditor({
  currentSku,
  onClose,
  viewStage,
}: {
  currentSku: string;
  onClose: () => void;
  /** The view lens's stage element, from the surface that opened this editor.
      Passed in rather than looked up: what this screen commits is a layout for
      THAT stage (its tile sizes, its box), so the destination is an argument,
      not something to find in the DOM and hope is the right one. */
  viewStage: () => HTMLElement | null;
}) {
  const { displayArrange, setDisplayArrange } = useSettings();
  const stageRef = useRef<HTMLDivElement>(null);
  const [identify, setIdentify] = useState(false);
  const [drag, setDrag] = useState<Positions | null>(null);

  const state = readArrangement(displayArrange);
  const mode = state.mode;
  const mirror = mode === 'mirror';
  const positions = drag ?? state.positions;
  const current =
    DISPLAYS.find((d) => 'sku' in d && d.sku === currentSku) || visibleDisplays().find((d) => d.kind === 'monitor');

  /**
   * Write back the ROWS, not this screen's coordinates.
   *
   * The stored layout is the physical one — the desk the view lens shows, gaps
   * and all, because that is what the user spread out to match their room. This
   * editor works on a packed copy of it, so committing its coordinates would
   * close every gap they had set: changing which side a display sits on would
   * silently shove the furniture together.
   *
   * So what crosses over is the arrangement's SHAPE — who is beside whom, who is
   * above whom — and the view redraws its own desk to have that shape while
   * keeping its own spacing. Shape unchanged → the redraw is the identity and
   * nothing visibly moves. See projectRowsOntoView above.
   */
  /**
   * `nextMode` exists because the Extend / Mirror buttons are a WRITE, and they
   * used to be the one write that skipped this function (2026-09-02). They saved
   * `positions` raw — the editor's own fractions, measured against the editor's
   * stage with the editor's resolution-shaped tiles — and the hero then read
   * those numbers against ITS stage with physically-shaped tiles. Measured that
   * day: pressing `Extend` on a fresh three-display desk stored
   * .198 / .388 / .517, which the hero draws at 145 / 284 / 378 against tile
   * widths 143 / 114 / 168 — OMEN overlapping Built-in by 4px and Treehouse
   * overlapping Built-in by 20px. That is the pile-up Cindy screenshotted.
   */
  const commit = (p: Positions, nextMode?: 'extend' | 'mirror') => {
    const stage = stageRef.current;
    const sr = stage?.getBoundingClientRect();
    if (!stage || !sr || sr.width <= 0 || sr.height <= 0) {
      setDrag(null);
      return;
    }
    const rects: IdRect[] = visibleDisplays().map((d) => {
      const pos = p[d.id] ?? DEFAULTS[d.id];
      const t = logicalTile(d.id);
      return { id: d.id, left: pos.left * sr.width, top: pos.top * sr.height, w: t.w, h: t.h };
    });

    const view = viewStage();
    const next = view ? projectRowsOntoView(rects, view) : null;
    // A destination that cannot be measured means writing a layout for a stage
    // whose size is unknown, which is how coordinates end up outside it. Better
    // to keep the picture on screen and save nothing: the next drag commits.
    // `computers` rides along untouched. It is not part of `positions` and this
    // function only recomputes positions — dropping it here would quietly undo
    // the person's chosen end every time they nudged a screen.
    if (next) {
      setDisplayArrange({
        mode: nextMode ?? mode,
        positions: next,
        space: 'fraction',
        ...(displayArrange?.computers ? { computers: displayArrange.computers } : {}),
      });
    }

    // The editor keeps showing ITS OWN legal picture, not the saved layout (that
    // one carries the view's desk gaps). Reordering can strand a display mid-drag
    // — dock() only guarantees the dragged tile lands flush — so the release is
    // where the shelf closes: pack the arrangement and keep it as the working copy.
    const packed: Positions = {};
    for (const r of packLayout(rects, sr)) {
      packed[r.id] = { left: r.left / sr.width, top: r.top / sr.height };
    }
    setDrag(packed);
  };

  function doIdentify() {
    setIdentify(true);
    setTimeout(() => setIdentify(false), 1100);
  }

  // The saved layout can be an illegal picture for THIS lens — the defaults came
  // from the view map, where a real desk has space between the monitors, and the
  // view is allowed to keep it. Here a gap is unreachable coordinate space, so
  // the arrangement is packed into a legal one on open: same rows, same
  // left-to-right order within each, edges closed up. Held in `drag` (the
  // uncommitted-display channel) so opening the editor writes nothing — only a
  // real drag commits.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || mirror) return;
    const sr = stage.getBoundingClientRect();
    if (sr.width <= 0 || sr.height <= 0) return;
    // Saved fractions belong to the VIEW's ruler; multiplying them by this
    // stage instead skewed the picture by however much the two boxes differ,
    // which could split a row that was really one (2026-08-24). packLayout
    // re-lays everything into this stage afterwards, so only the shape these
    // pixels carry matters — but the shape has to be the true one.
    const view = viewStage();
    const { hRef, vRef } = view ? viewRefs(view, sr) : { hRef: sr.width, vRef: sr.height };
    // The fallback for a desk with nothing saved is `defaultsFor()`, not the raw
    // `DEFAULTS` table (2026-09-01). Two reasons, and the second is the one that
    // bit:
    //   · `DEFAULTS` is authored for a THREE-display desk and its lefts do not
    //     re-derive when a display is added or removed, so this editor opened on
    //     a different set of relationships than the hero did.
    //   · Its rows are not even in one reference frame — `builtin` is written
    //     `/ 732` while its neighbours are `/ 672` — which is why it is now the
    //     last-resort constant and every surface asks `defaultsFor()` instead.
    // The editor keeps its own REGISTER (logical-resolution tiles, edges closed
    // up by packLayout): that difference is the 2026-07-22 two-lens decision and
    // is not what this changes. What it changes is that both lenses now start
    // from one description of the desk.
    // Same desk the hero reads: `readArrangement` has already placed anything
    // attached after the layout was saved, and `defaultsFor` covers a desk with
    // nothing saved at all (2026-09-02).
    // Stood on one floor in THIS lens's tiles before packing (2026-09-23): the
    // seed's tops were computed for the desk photos' heights, and read with the
    // editor's resolution-shaped tiles they left the laptop hanging 50px above
    // the Treehouse 32's bottom on a desk nobody had arranged yet. Only the rows
    // cross over; each lens stands them on its own floor (see standOnFloor).
    const seeded = standOnFloor(
      hasStoredLayout(displayArrange) ? state.positions : defaultsFor(vRef, photoTile, hRef),
      logicalTile,
      vRef,
    );
    const rects: IdRect[] = visibleDisplays().map((d) => {
      const p = seeded[d.id] ?? DEFAULTS[d.id];
      const t = logicalTile(d.id);
      return { id: d.id, left: p.left * hRef, top: p.top * vRef, w: t.w, h: t.h };
    });
    // No "already connected → skip": packLayout also centres, and an already-
    // joined group can still be sitting in a corner of a stage this size. And it
    // no longer flattens a stack, so a saved two-row desk opens as two rows.
    const packed: Positions = {};
    for (const r of packLayout(rects, sr)) {
      packed[r.id] = { left: r.left / sr.width, top: r.top / sr.height };
    }
    setDrag(packed);
    // Runs once per open: `state.positions` is the saved layout, and after this
    // the live `drag` copy is what renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The computer's own drag. Deliberately NOT `useArrangeDrag`: that hook docks
     against neighbours and resolves overlap, which is the machinery of a
     coordinate space this tile is not in. Here the only question is which half
     of the stage the pointer let go in. Keyboard reaches it too — the tile is
     focusable and ← → move it — because the last drag we retired died partly
     for having no keyboard path (2026-09-01). */
  /* The stage's measured size. Read during render off `stageRef` it is 0 on the
     first paint, and a `|| 1` fallback then turns a 200px tile into a fraction
     of 200 — which put this tile at x=316369 the first time it drew (measured
     2026-09-10). State + observer instead: nothing is drawn until the stage has
     a size worth dividing by. */
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const read = () => {
      const r = stage.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setStageBox((b) => (Math.abs(b.w - r.width) > 0.5 || Math.abs(b.h - r.height) > 0.5
          ? { w: r.width, h: r.height } : b));
      }
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  const [pcDrag, setPcDrag] = useState(false);
  const [pcSide, setPcSide] = useState<'left' | 'right' | null>(null);
  const savePcSide = (next: 'left' | 'right') => {
    setPcSide(next);
    const base = displayArrange ?? { mode, positions: {}, space: 'fraction' as const };
    setDisplayArrange({ ...base, computers: { ...(base.computers ?? {}), tower: next } });
  };
  const onPcDown = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setPcDrag(true);
    const up = (ev: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      savePcSide(ev.clientX < r.left + r.width / 2 ? 'left' : 'right');
      setPcDrag(false);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointerup', up);
  };

  const onTileDown = useArrangeDrag({
    stageRef,
    enabled: !mirror,
    getPositions: () => positions,
    onMove: setDrag,
    // No onCancel here on purpose: in this editor `drag` doubles as the packed
    // display copy built on open, so clearing it on a click-without-move would
    // un-pack the row and make the arrangement jump apart. Not committing is
    // already the whole job — the hook simply skips the write.
    onCommit: commit,
    getSize: (id) => logicalTile(id),
    // Snapping needs the neighbours in the same px space the drag works in, so
    // the fractions are resolved against the live stage on every move.
    snap: (id, cand, size) => {
      const stage = stageRef.current;
      if (!stage) return cand;
      const sr = stage.getBoundingClientRect();
      const others: Rect[] = visibleDisplays().filter((d) => d.id !== id).map((d) => {
        const p = positions[d.id] ?? DEFAULTS[d.id];
        const t = logicalTile(d.id);
        return { left: p.left * sr.width, top: p.top * sr.height, w: t.w, h: t.h };
      });
      // The tile's CURRENT position is the fallback for a pointer that has wandered
      // somewhere with no legal dock — `positions` is the live drag copy, so this is
      // the last spot dock() itself approved.
      const now = positions[id] ?? DEFAULTS[id];
      return dock({ ...cand, w: size.w, h: size.h }, others, {
        left: now.left * sr.width,
        top: now.top * sr.height,
      });
    },
  });

  return createPortal(
    <>
      {/* The scrim was written by hand as `ds-backdrop ae-backdrop` and never
          carried `.open`, which the library needs to show it (components.css:
          "Add .open to show"). So it rendered at opacity 0 with
          pointer-events: none — the page behind stayed sharp and this
          element's own onClick could never fire, taking click-outside-to-close
          with it. `.ae-backdrop` styled nothing anywhere in the repo.
          Chris saw the symptom at the 2026-08-20 design review: "the background
          wasn't blurred or dimmed, so you can see two close buttons — it's a
          little confusing."
          Fixed by using the component instead of the class string: `Backdrop`
          owns the `.open` logic, so the class list cannot go stale again.

          The z-index is inline on purpose — the library says to set it per
          context ("Z-index is NOT set — apply inline per context since stacking
          varies by feature"). The component's default 50 pairs with a plain
          `.modal-shell` (51), but this editor opens from INSIDE the device
          window, and that window is `.dc-canvas` at 51 as well: at 50 the scrim
          dimmed the page and left the device window — and its close button —
          bright on top, which is the half of Chris's note about two close
          buttons. 60/61 puts the scrim above the window it was opened from.
          `.dc-canvas` is not ours to renumber; see `.arrange-modal` in
          arrange-editor.css for the matching 61. */}
      <Backdrop onClick={onClose} style={{ zIndex: 60 }} />
      {/* `narrow` for the HEIGHT rule, not the width (2026-08-24, Cindy: the
          dialog kept a window's worth of empty grid under the desk). The
          variant's own note says a modal with a single subject should not span
          the window, and this one has exactly one subject — but a desk needs
          room to drag in, so `.arrange-modal` widens it back out. What is
          borrowed is `height: fit-content` + the centring, which is the
          library's answer to the thing that was wrong. */}
      <ModalShell title="Arrange displays" onClose={onClose} className="arrange-modal" width="narrow">
        <div className="ae-head">
          {/* One line, not three (2026-08-24, Cindy). The paragraph explained
              the rule the screen already enforces: displays cannot be dropped
              apart, so "displays stay joined" describes what the reader is
              about to watch happen rather than telling them anything they can
              act on. What is left is the only instruction — that this is a
              drag. */}
          {/* "where it sits" was a slight over-promise (2026-09-02, consultant
              pass). This editor carries TWO things to the desk picture: which
              side a display is on, and whether it is on another row. It does not
              carry distance — `packLayout` closes every gap in a row on release,
              so a space you drag open is gone before you let go — and it does
              not carry a small height difference either, because the desk
              picture stands a row on one surface (2026-08-29, rule ⓐ).
              Saying the two things it DOES carry is both shorter to read and the
              only version that survives contact with the hero. */}
          <p className="ae-hint">Drag a display to set which side it sits on, and whether it sits above or below.</p>
          <div className="ae-actions">
            <ToggleButtonGroup
              aria-label="Display mode"
              value={mode}
              // Through `commit`, like every other write — see its note. Writing
              // `positions` straight from here was how editor coordinates reached
              // the hero unconverted.
              onChange={(m) => commit(positions, m as 'extend' | 'mirror')}
              options={[
                { label: 'Extend', value: 'extend' },
                { label: 'Mirror', value: 'mirror' },
              ]}
            />
            <Button size="sm" onClick={doIdentify}>
              Identify
            </Button>
            {/* An implicit save needs an undo. Dragging commits the layout the
                moment you let go — silent and automatic, which is the right
                default (nobody wants to press Save to describe their own desk)
                but it leaves no way back. That trade was already decided for
                modes: profile-proposal-2026-07.md:45, "Removing the save button
                moves saving to Zone 1 … an implicit save needs an undo. Reset is
                the Zone 3 escape hatch." The desk has exactly the same shape and
                had no hatch (Cindy, 2026-08-06).
                `null`, not a fresh set of coordinates: that is what the store
                reads as "this user has not arranged anything", so the opening
                layout goes back to being resolved against the stage AND the
                first-run hint on the view lens comes back. Writing default
                numbers instead would look identical and quietly keep the desk
                marked as arranged.
                Hidden when there is nothing to undo — a permanently visible
                Reset invites the question "what would that even do?".
                No confirm step: re-arranging three tiles costs seconds, and a
                dialog for a cheap, obvious action is the more expensive mistake.
                Words only. `icon-reset` exists in the set and was tried here, but
                the library pins any icon inside a button to 10px
                (`.ds-btn svg` in shared/components.css) — at that size it read as
                a smudge and added nothing the four words do not already say. An
                icon earns its place when it carries information of its own. */}
            {hasStoredLayout(displayArrange) && (
              <Button size="sm" variant="ghost" onClick={() => setDisplayArrange(null)}>
                Reset to default
              </Button>
            )}
          </div>
        </div>

        <div
          className={'ae-stage' + (mirror ? ' mirror' : '') + (identify ? ' identify' : '')}
          ref={stageRef}
        >
          {mirror && (
            <span className="ae-mirror-note">Mirrored — every display shows the same image</span>
          )}
          {/* The computer. It is IN this window because that is where people
              look for it (Cindy asked twice, on two channels), and it does not
              break the window's one rule — "a display may not float" exists so
              the pointer never crosses into a gap, and nothing crosses into a
              computer. So it takes no coordinate: drag it and it goes to the
              nearer END of the desk, which is the whole of what there is to
              say about where a tower stands. Two outcomes, no overlap to
              resolve, and the desk picture lays the same choice out with its
              own spacing. */}
          {hasTower() && stageBox.w > 0 && (() => {
            const xs = visibleDisplays().map((d) => {
              const pos = mirror ? MIRROR[d.id] : positions[d.id] ?? DEFAULTS[d.id];
              return { l: pos.left, r: pos.left + logicalTile(d.id).w / stageBox.w };
            });
            if (!xs.length) return null;
            const rowL = Math.min(...xs.map((x) => x.l));
            const rowR = Math.max(...xs.map((x) => x.r));
            const side = pcSide ?? computerSide(displayArrange) ?? 'right';
            const floor = Math.max(...visibleDisplays().map((d) => {
              const pos = mirror ? MIRROR[d.id] : positions[d.id] ?? DEFAULTS[d.id];
              return pos.top + logicalTile(d.id).h / stageBox.h;
            }));
            // Stand it on the same floor line as the screens, in fractions of
            // the stage rather than a guessed offset.
            const topFrac = Math.max(0, floor - 82 / stageBox.h);
            const gapFrac = 14 / stageBox.w;
            return (
              <div
                className={'ae-tile ae-pc' + (pcDrag ? ' dragging' : '')}
                style={{
                  left: pct(side === 'right' ? rowR + gapFrac : Math.max(0, rowL - gapFrac - 34 / stageBox.w)),
                  top: pct(topFrac),
                  width: 34,
                  height: 82,
                }}
                title="Drag to the other end of the desk"
                role="button"
                tabIndex={0}
                aria-label={`${deskHosts()[1]} stands at the ${side} end of the desk — press left or right arrow to move it`}
                onPointerDown={onPcDown}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') { e.preventDefault(); savePcSide('left'); }
                  if (e.key === 'ArrowRight') { e.preventDefault(); savePcSide('right'); }
                }}
              >
                <span className="ae-tile-name">{deskHosts()[1]}</span>
              </div>
            );
          })()}
          {visibleDisplays().map((d, i) => {
            const pos = mirror ? MIRROR[d.id] : positions[d.id] ?? DEFAULTS[d.id];
            const t = logicalTile(d.id);
            const isCur = current?.id === d.id;
            return (
              <div
                key={d.id}
                className={'ae-tile' + (isCur ? ' current' : '')}
                data-display={d.id}
                style={{ left: pct(pos.left), top: pct(pos.top), width: t.w, height: t.h }}
                onPointerDown={(e) => onTileDown(e, d.id, d.kind)}
              >
                <span className="ae-num">{i + 1}</span>
                {/* `This display` retired 2026-08-24, with the hero's ▼ and for
                    the same reason: the accent ring around this tile already
                    says it, so the words were a second voice — and on a tile
                    this size they landed on top of the name (seen in capture).
                    The meaning survives for assistive tech on the name. */}
                <span className="ae-tile-name" aria-current={isCur || undefined}>{d.name}</span>
              </div>
            );
          })}
        </div>

        {/* The footnote about resolution-vs-physical-size is gone (2026-08-24,
            Cindy). It answered a question nobody asks inside this screen: the
            tiles here are plain grey rectangles on a grid, which already reads
            as a coordinate diagram rather than a picture of hardware — the
            photoreal desk is the other lens, and that is where a size could be
            misread. Two lines of type at the bottom of a dialog cost more than
            the misreading they were guarding against. */}
      </ModalShell>
    </>,
    document.body,
  );
}

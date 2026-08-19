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
// ══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ToggleButtonGroup } from '../components';
import { ModalShell } from '../components/ModalShell';
import { useSettings } from '../state/Settings';
import {
  DEFAULTS,
  DISPLAYS,
  MIRROR,
  logicalTile,
  pct,
  readArrangement,
  useArrangeDrag,
  type Positions,
} from './arrangement';
import './arrange-editor.css';

/** Shortest shared edge a dock is allowed to leave, in stage px — below this
    two displays touch at a corner, which is not a crossing the pointer can use. */
const MIN_SHARE = 28;

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
function dock(cand: Rect, others: Rect[]): { left: number; top: number } {
  if (!others.length) return { left: cand.left, top: cand.top };
  type Option = { left: number; top: number; d: number };
  const opts: Option[] = [];
  for (const o of others) {
    // Butt against each side; the free axis keeps at least MIN_SHARE of overlap
    // so the two displays share an edge segment rather than a corner point.
    const slideY = clamp(cand.top, o.top - cand.h + MIN_SHARE, bottom(o) - MIN_SHARE);
    const slideX = clamp(cand.left, o.left - cand.w + MIN_SHARE, right(o) - MIN_SHARE);
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
  // Every dock overlapped something (a very crowded desk) — leave the drag
  // where it is rather than teleporting it somewhere unrelated.
  if (!opts.length) return { left: cand.left, top: cand.top };
  opts.sort((a, b) => a.d - b.d);
  return { left: opts[0].left, top: opts[0].top };
}


/** Close a row up and centre it: keep left-to-right order, butt each tile
    against the chain, slide vertically only as far as a real shared edge
    requires — then park the whole group in the middle of the stage, the same
    "the desk sits centred" rule the view hero follows (Cindy, 2026-08-03). */
function packRow(
  row: (Rect & { id: string })[],
  stage: { width: number; height: number },
): (Rect & { id: string })[] {
  const out = [...row].sort((a, b) => a.left - b.left).map((r) => ({ ...r }));
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    out[i].left = right(prev);
    out[i].top = clamp(out[i].top, prev.top - out[i].h + MIN_SHARE, bottom(prev) - MIN_SHARE);
  }
  const minL = Math.min(...out.map((r) => r.left));
  const maxR = Math.max(...out.map((r) => right(r)));
  const minT = Math.min(...out.map((r) => r.top));
  const maxB = Math.max(...out.map((r) => bottom(r)));
  const dx = (stage.width - (maxR - minL)) / 2 - minL;
  const dy = (stage.height - (maxB - minT)) / 2 - minT;
  for (const r of out) { r.left += dx; r.top += dy; }
  return out;
}

export function ArrangeEditor({ currentSku, onClose }: { currentSku: string; onClose: () => void }) {
  const { displayArrange, setDisplayArrange } = useSettings();
  const stageRef = useRef<HTMLDivElement>(null);
  const [identify, setIdentify] = useState(false);
  const [drag, setDrag] = useState<Positions | null>(null);

  const state = readArrangement(displayArrange);
  const mode = state.mode;
  const mirror = mode === 'mirror';
  const positions = drag ?? state.positions;
  const current =
    DISPLAYS.find((d) => 'sku' in d && d.sku === currentSku) || DISPLAYS.find((d) => d.kind === 'monitor');

  /**
   * Write back the ORDER, not this screen's coordinates.
   *
   * The stored layout is the physical one — the desk the view lens shows, gaps
   * and all, because that is what the user spread out to match their room. This
   * editor works on a packed copy of it, so committing its coordinates would
   * close every gap they had set: changing which side a display sits on would
   * silently shove the furniture together.
   *
   * So the saved positions are treated as SLOTS. A drag here can change who
   * occupies which slot; the slots keep the spacing they had. Order unchanged →
   * the permutation is the identity and nothing moves.
   *
   * Honest limit: slots are ordered left-to-right, so a purely vertical change
   * made here (stacking one display above another) reaches the view only as far
   * as its left-to-right position carries it. Stacking is a follow-up.
   */
  const commit = (p: Positions) => {
    const saved = state.positions;
    const byLeft = (src: Positions) => (a: string, b: string) =>
      (src[a] ?? DEFAULTS[a]).left - (src[b] ?? DEFAULTS[b]).left;
    const ids = DISPLAYS.map((d) => d.id);
    const slots = [...ids].sort(byLeft(saved)).map((id) => saved[id] ?? DEFAULTS[id]);
    const next: Positions = {};
    [...ids].sort(byLeft(p)).forEach((id, i) => { next[id] = slots[i]; });
    setDisplayArrange({ mode, positions: next, space: 'fraction' });
    // The editor keeps showing ITS OWN legal picture, not the saved slots (those
    // carry the view's desk gaps). Reordering can strand a display mid-drag —
    // dock() only guarantees the dragged tile lands flush — so the release is
    // where the shelf closes: pack the row and keep it as the working copy.
    const stage = stageRef.current;
    if (stage) {
      const sr = stage.getBoundingClientRect();
      if (sr.width > 0 && sr.height > 0) {
        const packed = packRow(
          DISPLAYS.map((d) => {
            const pos = p[d.id] ?? DEFAULTS[d.id];
            const t = logicalTile(d.id);
            return { id: d.id, left: pos.left * sr.width, top: pos.top * sr.height, w: t.w, h: t.h };
          }),
          sr,
        );
        const view: Positions = {};
        for (const r of packed) view[r.id] = { left: r.left / sr.width, top: r.top / sr.height };
        setDrag(view);
        return;
      }
    }
    setDrag(null);
  };

  function doIdentify() {
    setIdentify(true);
    setTimeout(() => setIdentify(false), 1100);
  }

  // The saved layout can be an illegal picture for THIS lens — the defaults came
  // from the view map, where a real desk has space between the monitors, and the
  // view is allowed to keep it. Here a gap is unreachable coordinate space, so
  // the arrangement is packed into a legal one on open: same left-to-right order,
  // same rough vertical offsets, edges closed up. Held in `drag` (the
  // uncommitted-display channel) so opening the editor writes nothing — only a
  // real drag commits.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || mirror) return;
    const sr = stage.getBoundingClientRect();
    if (sr.width <= 0 || sr.height <= 0) return;
    const row = DISPLAYS.map((d) => {
      const p = state.positions[d.id] ?? DEFAULTS[d.id];
      const t = logicalTile(d.id);
      return { id: d.id, left: p.left * sr.width, top: p.top * sr.height, w: t.w, h: t.h };
    });
    // No "already connected → skip": packRow now also centres, and an already-
    // joined group can still be sitting in a corner of a stage this size.
    const packed: Positions = {};
    for (const r of packRow(row, sr)) packed[r.id] = { left: r.left / sr.width, top: r.top / sr.height };
    setDrag(packed);
    // Runs once per open: `state.positions` is the saved layout, and after this
    // the live `drag` copy is what renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const others: Rect[] = DISPLAYS.filter((d) => d.id !== id).map((d) => {
        const p = positions[d.id] ?? DEFAULTS[d.id];
        const t = logicalTile(d.id);
        return { left: p.left * sr.width, top: p.top * sr.height, w: t.w, h: t.h };
      });
      return dock({ ...cand, w: size.w, h: size.h }, others);
    },
  });

  return createPortal(
    <>
      <div className="ds-backdrop ae-backdrop" onClick={onClose} />
      <ModalShell title="Arrange displays" onClose={onClose} className="arrange-modal">
        <div className="ae-head">
          <p className="ae-hint">
            Drag a display to set which side it sits on. Displays stay joined — where two of them
            meet is where the pointer crosses between them.
          </p>
          <div className="ae-actions">
            <ToggleButtonGroup
              aria-label="Display mode"
              value={mode}
              onChange={(m) => setDisplayArrange({ mode: m as 'extend' | 'mirror', positions, space: 'fraction' })}
              options={[
                { label: 'Extend', value: 'extend' },
                { label: 'Mirror', value: 'mirror' },
              ]}
            />
            <Button size="sm" onClick={doIdentify}>
              Identify
            </Button>
          </div>
        </div>

        <div
          className={'ae-stage' + (mirror ? ' mirror' : '') + (identify ? ' identify' : '')}
          ref={stageRef}
        >
          {mirror && (
            <span className="ae-mirror-note">Mirrored — every display shows the same image</span>
          )}
          {DISPLAYS.map((d, i) => {
            const pos = mirror ? MIRROR[d.id] : positions[d.id] ?? DEFAULTS[d.id];
            const t = logicalTile(d.id);
            const isCur = current?.id === d.id;
            return (
              <div
                key={d.id}
                className={'ae-tile' + (isCur ? ' current' : '')}
                style={{ left: pct(pos.left), top: pct(pos.top), width: t.w, height: t.h }}
                onPointerDown={(e) => onTileDown(e, d.id, d.kind)}
              >
                <span className="ae-num">{i + 1}</span>
                <span className="ae-tile-name">{d.name}</span>
                {isCur && <span className="ae-tile-here">This display</span>}
              </div>
            );
          })}
        </div>

        {/* Sizes are the giveaway that this is a different lens, so they are
            labelled rather than left to be misread as physical size. */}
        <p className="ae-foot">
          Displays are drawn at their resolution, not their physical size — this is the space your
          pointer moves through.
        </p>
      </ModalShell>
    </>,
    document.body,
  );
}

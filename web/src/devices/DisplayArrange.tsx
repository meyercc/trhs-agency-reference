import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components';
import { useSettings } from '../state/Settings';
import { ArrangeEditor } from './ArrangeEditor';
import {
  DEFAULTS,
  DISPLAYS,
  MIRROR,
  pct,
  photoTile,
  readArrangement,
  renderBox,
  useArrangeDrag,
  type Positions,
} from './arrangement';
import './display-arrange.css';
import treehouseUrl from './monitor/assets/treehouse32-front-tight.png';
import oled27Url from './monitor/assets/omen-oled27-front.png';
import macbookUrl from './monitor/assets/macbook-front-generic.png';

// Which render stands for which display. A display with no render of its own
// falls back to the generic monitor — the same rule the app already follows for
// non-HP hardware (2026-07-15). ⚠️ The generic monitor render does not exist
// yet: Cindy is making it in Figma Make (progress.md, 2026-08-02), so until it
// lands an unknown display borrows the OLED 27 and is visibly wrong on purpose
// rather than silently missing.
const RENDER: Record<string, string> = {
  'treehouse-32': treehouseUrl,
  'oled-27': oled27Url,
  builtin: macbookUrl,
};

/** Percentages that make the render's hardware box fill the tile bounds. */
function renderCrop(id: string): React.CSSProperties {
  const b = renderBox(id);
  return {
    width: `${(b.iw / b.w) * 100}%`,
    height: `${(b.ih / b.h) * 100}%`,
    left: `${(-b.l / b.w) * 100}%`,
    top: `${(-b.t / b.h) * 100}%`,
  };
}

/**
 * Multi-display arrangement for the monitor modal hero. The layout (positions +
 * extend/mirror mode) is shared state persisted via Settings, so opening any
 * display's modal — or the Perform Device Overview map — shows the same
 * arrangement. React port of display-arrange.js; the roster, defaults and drag
 * math now live in ./arrangement.ts so both surfaces run the same code.
 */
export function DisplayArrange({ currentSku }: { currentSku: string }) {
  const { displayArrange, setDisplayArrange } = useSettings();
  const stageRef = useRef<HTMLDivElement>(null);
  const [identify, setIdentify] = useState(false);
  const [drag, setDrag] = useState<Positions | null>(null);
  // `&arrange=1` opens the editor straight from the URL, the same way the modal
  // itself opens from `?sku=`. Review and screenshots need to reach it without
  // a click, and it saves describing a path in every message that mentions it.
  const [arranging, setArranging] = useState(() =>
    typeof window !== 'undefined' && /[?&]arrange=1(&|$)/.test(window.location.hash),
  );

  const state = readArrangement(displayArrange);
  const mirror = state.mode === 'mirror';
  const positions = drag ?? state.positions;

  // The desk is ALWAYS centred in the band — not only after a drag here. The
  // defaults, an editor-driven reorder, an old saved layout: whatever the
  // stored positions are, the group renders in the middle (Cindy, 2026-08-03 —
  // v1 only recentred on this hero's own drag-release, so the default page
  // opened lopsided). One shared offset on a wrapper, so relative gaps are
  // untouched and the store is never written by merely LOOKING at the desk.
  // Recomputed whenever the saved layout changes; frozen during a drag.
  const [groupOff, setGroupOff] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (drag) return;
    const stage = stageRef.current;
    if (!stage) return;
    const recentre = () => {
      const sr = stage.getBoundingClientRect();
      // Measure the HARDWARE, not the caption. `.dsa-disp` is a centred column
      // whose width is max(tile, name row), and the name row grows when the
      // "This display" tag lands on it — so centring off the container made the
      // whole desk shift sideways the moment you switched to another monitor,
      // purely because the widest label moved (Cindy, 2026-08-03). `.dsa-bounds`
      // is the display itself and does not care which one is selected.
      const kids = [...stage.querySelectorAll<HTMLElement>('.dsa-disp .dsa-bounds')].map((el) =>
        el.getBoundingClientRect(),
      );
      if (sr.width <= 0 || !kids.length) return;
      // Absolute, not accumulative: measured rects include whatever transform is
      // currently painted, so subtract it back out before centring. An
      // accumulative `off + dx` double-applies under React dev StrictMode's twin
      // effect run (measured: the group overshot exactly 2x, 26/173 -> 173/26),
      // and the same idempotence lets this run on every resize without drifting.
      const wrap = stage.querySelector<HTMLElement>('.dsa-group');
      const mtx = wrap ? new DOMMatrixReadOnly(getComputedStyle(wrap).transform) : { m41: 0, m42: 0 };
      const minL = Math.min(...kids.map((r) => r.left)) - sr.left - mtx.m41;
      const maxR = Math.max(...kids.map((r) => r.right)) - sr.left - mtx.m41;
      const minT = Math.min(...kids.map((r) => r.top)) - sr.top - mtx.m42;
      const maxB = Math.max(...kids.map((r) => r.bottom)) - sr.top - mtx.m42;
      const x = (sr.width - (maxR - minL)) / 2 - minL;
      const y = (sr.height - (maxB - minT)) / 2 - minT;
      setGroupOff((o) => (Math.abs(o.x - x) > 1 || Math.abs(o.y - y) > 1 ? { x, y } : o));
    };
    recentre();
    // Re-centre whenever the band resizes. Without this the desk stays wherever
    // it was first measured: the hero band is derived from the window height
    // (--mc-hero-h) and the stage from the modal width, so resizing the window
    // left the group parked off to one side — and a stage measured at zero width
    // (mounted while the modal was still opening) never got centred at all.
    const ro = new ResizeObserver(recentre);
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayArrange, drag]);

  const current = DISPLAYS.find((d) => 'sku' in d && d.sku === currentSku) || DISPLAYS.find((d) => d.kind === 'monitor');

  // Clicking another display on the desk opens ITS settings. The map already
  // shows the whole desk and says the arrangement is shared across every
  // display — so a monitor you can see but not reach is a dead end, and the
  // alternative is closing this modal, finding the card on Perform, reopening.
  // The modal is `?sku=` driven (DeviceModalHost), so switching is one param.
  const [params, setParams] = useSearchParams();
  const downAt = useRef<{ x: number; y: number } | null>(null);
  /** Only monitors with a SKU of their own have a modal to open — the MacBook's
      built-in panel has no settings page, so it stays a picture. */
  const canOpen = (sku?: string) => !!sku && sku !== currentSku;
  function openDevice(sku: string) {
    const p = new URLSearchParams(params);
    p.set('sku', sku);
    // Drop the tab and the arrange flag: the next device opens on its own
    // default tab, not on whatever tab this one happened to be showing.
    p.delete('tab');
    p.delete('arrange');
    setParams(p);
  }
  /** A drag is not a click. Movement past a few px means the user was moving
      furniture, and navigating away mid-arrange would be the worst possible
      outcome of a successful drag. */
  function onTileClick(e: React.MouseEvent, sku?: string) {
    const d0 = downAt.current;
    downAt.current = null;
    if (!sku || !canOpen(sku) || !d0) return;
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 4) return;
    openDevice(sku);
  }

  function doIdentify() {
    setIdentify(true);
    setTimeout(() => setIdentify(false), 1100);
  }

  // Dragging here moves FURNITURE, not the display arrangement. A real desk has
  // space between the monitors and a laptop off to one side, and this is the lens
  // that shows the desk, so gaps are the point rather than a fault — the opposite
  // of the Arrange editor, where a gap is coordinate space the pointer cannot
  // cross (Cindy, 2026-08-03). Hence no dock() and no snapping: free placement.
  // Order still travels, because the editor reads its order from these positions
  // and writes order back as a permutation of them.
  const onTileDown = useArrangeDrag({
    stageRef,
    enabled: !mirror,
    getPositions: () => positions,
    onMove: setDrag,
    // A click (no movement) must leave the saved layout alone.
    onCancel: () => setDrag(null),
    onCommit: (p) => {
      // Recentre the GROUP on release (Cindy, 2026-08-03): free placement means
      // the furniture can wander into a corner, but this band is a picture of
      // the desk, so the desk itself stays in the middle. Every relative gap the
      // user just set is preserved — one shared offset moves the whole group.
      // (~24px under each tile is its name row, part of the visual block.)
      let next = p;
      const stage = stageRef.current;
      if (stage) {
        const sr = stage.getBoundingClientRect();
        // Measure the RENDERED tiles, not the data: a tile's visual box is wider
        // than photoTile() whenever its name row outgrows the render ("Built-in
        // Display", "… THIS DISPLAY"), and computing the group box from data
        // left the centring visibly lopsided (measured 107px vs 66px margins).
        const kids = [...stage.querySelectorAll<HTMLElement>('.dsa-disp')].map((el) =>
          el.getBoundingClientRect(),
        );
        if (sr.width > 0 && sr.height > 0 && kids.length) {
          const minL = Math.min(...kids.map((r) => r.left - sr.left));
          const maxR = Math.max(...kids.map((r) => r.right - sr.left));
          const minT = Math.min(...kids.map((r) => r.top - sr.top));
          const maxB = Math.max(...kids.map((r) => r.bottom - sr.top));
          const dx = ((sr.width - (maxR - minL)) / 2 - minL) / sr.width;
          const dy = ((sr.height - (maxB - minT)) / 2 - minT) / sr.height;
          next = {};
          for (const d of DISPLAYS) {
            const pos = p[d.id] ?? DEFAULTS[d.id];
            next[d.id] = { left: +(pos.left + dx).toFixed(4), top: +(pos.top + dy).toFixed(4) };
          }
        }
      }
      setDisplayArrange({ mode: state.mode, positions: next, space: 'fraction' });
      setDrag(null);
    },
    getSize: (id) => photoTile(id),
  });

  return (
    <div className="dsa-hero">
      <div className="dsa-hero-head">
        <div className="dsa-head-left">
          <span className="dsa-hero-title">Arrangement · {DISPLAYS.length} displays</span>
          <span className="dsa-hint">
            Drag a display to match where it sits on your desk · shared across every display's settings
          </span>
        </div>
        {/* Extend/Mirror and edge-exact placement live in the editor, not here:
            those are the arrangement, and nudging a few pixels looks crude on a
            picture built to look good (Chris, 1:1 2026-07-30). What stays is what
            belongs to the desk — spreading the furniture, and Identify, which
            flashes numbers rather than changing anything.
            No "Save as profile": the layout commits on drag end, so a save button
            promised a second, named copy that nothing stored or recalled (a 1.4s
            "Saved ✓" and no persistence). */}
        <div className="dsa-actions">
          <Button size="sm" onClick={doIdentify}>
            Identify
          </Button>
          <Button size="sm" variant="accent" onClick={() => setArranging(true)}>
            Arrange
          </Button>
        </div>
      </div>

      <div
        className={'dsa-stage' + (mirror ? ' mirror' : '') + (identify ? ' identify' : '') + (drag ? ' dragging' : '')}
        ref={stageRef}
      >
        {mirror && <span className="dsa-mirror-badge">Mirrored — all displays show the same image</span>}
        <div className="dsa-group" style={{ transform: `translate(${groupOff.x}px, ${groupOff.y}px)` }}>
        {DISPLAYS.map((d, i) => {
          const pos = mirror ? MIRROR[d.id] : positions[d.id] ?? DEFAULTS[d.id];
          const isCur = current?.id === d.id;
          const size = photoTile(d.id);
          return (
            <div
              key={d.id}
              className={`dsa-disp dsa-${d.kind}${isCur ? ' current' : ''}${
                canOpen('sku' in d ? d.sku : undefined) ? ' navigable' : ''
              }`}
              role={canOpen('sku' in d ? d.sku : undefined) ? 'button' : undefined}
              tabIndex={canOpen('sku' in d ? d.sku : undefined) ? 0 : undefined}
              aria-label={canOpen('sku' in d ? d.sku : undefined) ? `Open ${d.name} settings` : undefined}
              onKeyDown={(e) => {
                const sku = 'sku' in d ? d.sku : undefined;
                if (canOpen(sku) && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  openDevice(sku!);
                }
              }}
              style={{ left: pct(pos.left), top: pct(pos.top) }}
              onPointerDown={(e) => {
                downAt.current = { x: e.clientX, y: e.clientY };
                onTileDown(e, d.id, d.kind);
              }}
              onClick={(e) => onTileClick(e, 'sku' in d ? d.sku : undefined)}
            >
              {/* Bounds box, not the render's silhouette, carries every piece of
                  state (selection ring, number, "this display"). A glow traced
                  around a photographed stand and bezel reads as a lamp behind
                  the desk; a rectangle reads as "this one is selected". It is
                  also the drag hit target, so what you see is what you grab. */}
              <div className="dsa-bounds" style={{ width: size.w, height: size.h }}>
                {/* The render is scaled up and pushed left/up so that its
                    measured hardware box — not the PNG — fills the bounds; the
                    surrounding margin is cropped by .dsa-bounds. */}
                <img
                  className="dsa-render"
                  src={RENDER[d.id] ?? oled27Url}
                  alt=""
                  draggable={false}
                  style={renderCrop(d.id)}
                />
                <span className="dsa-num">{i + 1}</span>
              </div>
              {/* "This display" sits in the name row, not on the render: inside
                  the bounds it landed on the stand, and the ring + accent name
                  were already saying the same thing twice in the same corner. */}
              <span className="dsa-name">
                {d.name}
                {isCur && <span className="dsa-here">This display</span>}
              </span>
            </div>
          );
        })}
        </div>
      </div>

      {arranging && <ArrangeEditor currentSku={currentSku} onClose={() => setArranging(false)} />}
    </div>
  );
}

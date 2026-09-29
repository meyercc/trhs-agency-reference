import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components';
import { useSettings } from '../state/Settings';
import { ArrangeEditor } from './ArrangeEditor';
import { deviceTabs, monitorHeroIsDeskMap } from './deviceTabs';
import { getResolvedSku } from './skus';
import {
  CLICK_SLOP,
  DEFAULTS,
  defaultsFor,
  hasStoredLayout,
  healOverlap,
  standOnFloor,
  deskSpan,
  DESK_FLOOR,
  DISPLAYS,
  visibleDisplays,
  MIRROR,
  deskOffset,
  fitScale,
  photoTile,
  towerTile,
  slabPlacement,
  computerSide,
  hasTower,
  deskHosts,
  hardwareName,
  type DeskExtra,
  readArrangement,
  tokenPx,
  type Positions,
} from './arrangement';
import './display-arrange.css';
// The computer's box and glyph are the DESK card's — one drawing of the tower.
import { LaptopGlyph } from '../widgets/DeskWidget';
import '../widgets/desk-widget.css';
// Chris's device-picker pill, worn by the name under each display (`.ls-rail-btn`
// — see the chip's own note below). Imported HERE rather than trusted to load
// with Light Studio: this modal can be opened on a session that never visits
// that page, and a stylesheet that arrives only sometimes is a label that is
// styled only sometimes.
import '../lightstudio/light-studio.css';
import { ScreenContent } from './ScreenContent';
import treehouseUrl from './monitor/assets/treehouse32-front-tight.png';
import oled27Url from './monitor/assets/omen-oled27-front.png';
import macbookUrl from './monitor/assets/macbook-front-generic.png';
import treehouseBackUrl from './monitor/assets/treehouse32-back.png';

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

// PROTOTYPE 2026-08-04 — the same display, seen from behind. Only Treehouse 32
// has a rear render; a display with no entry here simply never turns around.
const REAR: Record<string, string> = {
  'treehouse-32': treehouseBackUrl,
};

/* `deskOffset` — the one definition of "centred" — moved to ./arrangement.ts on
   2026-08-05, because the Arrange editor's write-back is now a third caller that
   has to land inside the same stage. The maths is unchanged; see the docstring
   there for the two bugs it exists to prevent. */

/**
 * Multi-display arrangement for the monitor modal hero. The layout (positions +
 * extend/mirror mode) is shared state persisted via Settings, so opening any
 * display's modal — or the Perform Device Overview map — shows the same
 * arrangement. React port of display-arrange.js; the roster, defaults and the
 * geometry both lenses share live in ./arrangement.ts.
 *
 * This lens is READ-ONLY — see the note at the desk itself for the three of our
 * own decisions that say so and what removing the drag cost (2026-08-20).
 */
export function DisplayArrange({ currentSku, rearSku }: { currentSku: string; rearSku?: string }) {
  const { displayArrange, setDisplayArrange, deskDevices } = useSettings();
  /** What the configured display is doing with its sources. Read here rather
      than passed in: MonitorCanvas owns the provider this value's picker sits
      under, so lifting it would mean consuming a context that component
      supplies. Outside a monitor canvas there is simply no layout and the
      marks do not render. */
  const stageRef = useRef<HTMLDivElement>(null);
  /* `headRef` (the Identify/Arrange pill) and `nameRefs` (each display's name
     chip) were measured live so the drag could refuse to bury either one. With
     the drag gone nothing reads them, so both are gone too — a ref that is only
     ever written is a measurement nobody takes. If a future editor needs the
     same clearances, `ArrangeEditor` already has them in dock(). */
  // `&identify=1` HOLDS the flash open instead of just triggering it. Same
  // reason `&arrange=1` exists (below) plus one this state has on its own: the
  // flash lasts 1.1s, which is shorter than a screenshot round-trip, so nobody
  // reviewing this can actually see it — measured 2026-08-06, three attempts,
  // every capture landed after it had already ended. Pinned it does not
  // self-cancel, so the numbers and the line the stage prints can be looked at
  // and captured. Review-only door: nothing in the UI sets this param.
  const identifyPinned = typeof window !== 'undefined' && /[?&]identify=1(&|$)/.test(window.location.hash);
  const [identify, setIdentify] = useState(identifyPinned);
  // `&arrange=1` opens the editor straight from the URL, the same way the modal
  // itself opens from `?sku=`. Review and screenshots need to reach it without
  // a click, and it saves describing a path in every message that mentions it.
  const arrangeFromUrl =
    typeof window !== 'undefined' && /[?&]arrange=1(&|$)/.test(window.location.hash);
  const [arranging, setArranging] = useState(arrangeFromUrl);
  /**
   * Where to put the user down when the editor closes — only set when the editor
   * was opened BY the URL, so a click on this hero's own `Arrange` still just
   * closes and stays. Read once, at mount: the param would otherwise survive a
   * sku switch and send someone back to a page they did not come from.
   *
   * Without this, `Arrange` on Personalize's `Desk` card ended the errand in the
   * monitor modal, a window the user never opened (Cindy, 2026-08-21). The card
   * names its own destination; closing should return to the card, not to the
   * room the shortcut happened to pass through.
   */
  const navigate = useNavigate();
  const returnTo = useRef<string | null>(
    arrangeFromUrl && typeof window !== 'undefined'
      ? /[?&]from=([a-z0-9-]+)/.exec(window.location.hash)?.[1] ?? null
      : null,
  );

  const state = readArrangement(displayArrange);
  const mirror = state.mode === 'mirror';
  // Until the user has a layout of their own, the desk is resolved against THIS
  // stage so every display stands on one floor — see defaultsFor(). Stored
  // layouts are left exactly as saved: the floor is an opening position, not a
  // rule imposed on a desk somebody has already arranged.
  const [stageH, setStageH] = useState(0);
  /**
   * The height a saved `top` is a fraction of — `--dsa-vref`, the stage at the
   * band's ceiling, NOT the live stage (see the token's note in
   * monitor-canvas.css and `vRef` on fitScale). Vertical distance on this desk is
   * a physical claim: two displays on an arm clear each other by about 2cm, and
   * that has to stay 2cm when the window gets shorter. Measuring it against the
   * live stage made it shrink with the band until the rows collided.
   * Falls back to the live stage, so a surface without the token behaves exactly
   * as it did before.
   */
  const [vRef, setVRef] = useState(0);
  const vh = vRef || stageH;
  /**
   * The width a saved `left` is a fraction of — `--dsa-href`, the desk box the
   * arrangement was authored in, NOT the live stage. Its twin is `vRef` above
   * and the reason is the same one, on the other axis (see `hRef` on fitScale):
   * the stage is as wide as the hero panel now, and a fraction read against
   * THAT would push the displays apart every time the panel grew, instead of
   * drawing the same desk larger. Falls back to the live stage, so a surface
   * without the token behaves exactly as it did before.
   */
  const [hRef, setHRef] = useState(0);
  const [stageW, setStageW] = useState(0);
  const hw = hRef || stageW;
  /**
   * How far the under-glow reaches past the hardware, read from the CSS that
   * draws it (`--dsa-glow-*` on `.dsa-stage`). Handed to `fitScale` as `aura`
   * so the desk leaves the lamp its room instead of being cut off by the stage
   * at full brightness (Cindy, 2026-08-18).
   *
   * Even on all four sides, because the lamp is a source placed at the strip's
   * measured centre rather than a shadow pushed off the silhouette — light from
   * the middle of the panel's back reaches as far up as it does down. Reserved
   * whether or not the lamp is on, so switching it does not resize the desk.
   */
  const [glow, setGlow] = useState({ top: 0, side: 0, bottom: 0 });
  const stored = hasStoredLayout(displayArrange);
  // A stored layout passes through the overlap limit before it is drawn: this
  // lens shows whatever the store holds, and the store can hold a burial (see
  // healOverlap in ./arrangement.ts — the writer that allows it and the day it
  // bit). Healed in this surface's own frame (`hw`/`vh`), the same numbers the
  // tiles multiply by; until the frame is measured the layout passes untouched
  // and the memo re-runs when it lands.
  const base = useMemo(
    // `hw` goes in: this surface authors against 732px, the DESK card against
    // 672, so a gap stated in px only lands the same on both if each converts it
    // with its own width (2026-09-01, SPEC: desk-stage).
    // `state.positions` is already complete: `readArrangement` places a display
    // attached after the layout was saved, so both lenses start from one desk
    // (2026-09-02).
    () => (stored ? standOnFloor(healOverlap(state.positions, photoTile, hw, vh), photoTile, vh, hw) : defaultsFor(vh, photoTile, hw)),
    // `deskDevices` goes in although nothing above reads it by name: every call
    // here reads the desk through `visibleDisplays()`, which is localStorage and
    // tells React nothing. Without it, changing the Admin `Display scenario`
    // with this window open dropped a display from the picture but kept every
    // other one where it stood — a hole where it was, the pair parked off to one
    // side, the zoom still sized for three (2026-09-23, Cindy: «중간에 붕 떠 있어»).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stored, displayArrange, vh, hw, deskDevices],
  );
  const positions = base;

  /**
   * The computer on this desk (2026-09-18, Cindy: "홈페이지랑 사이드 패널에
   * 컴퓨터가 2개로 뜨는데 정작 디스플레이 모달에는 컴퓨터 한 대만"). The laptop
   * was already here — it brings a screen — but the OMEN 35L was drawn only on
   * the DESK card, so the two desk pictures disagreed about what the Admin row
   * says is on the desk. Same box, same glyph, same placement function and the
   * same person-chosen side as the DESK card (`slabPlacement` + `computerSide`,
   * the `Arrange` window's answer from 2026-09-10): one desk, drawn twice.
   * `nameH` is the caption row the tile keeps under it, this stage's own pill.
   */
  const [nameH, setNameH] = useState(29);
  const tower = useMemo(() => towerTile(), []);
  const towerAt = useMemo(
    () =>
      hasTower() && hw > 0 && vh > 0
        ? slabPlacement(mirror ? MIRROR : base, photoTile, hw, vh, tower, nameH, computerSide(displayArrange))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, mirror, hw, vh, nameH, displayArrange, deskDevices],
  );
  const floorSpan = useMemo(() => {
    const span = deskSpan(mirror ? MIRROR : base, photoTile, hw, towerAt ? { left: towerAt.left * hw, w: tower.w } : undefined);
    return span && vh > 0 ? { left: span.left - span.width * 0.35, width: span.width * 1.7, top: DESK_FLOOR * vh } : null;
  }, [base, mirror, hw, vh, towerAt, tower]);
  const towerBox: DeskExtra | undefined = towerAt
    ? { left: towerAt.left * hw, top: towerAt.top * vh, w: tower.w, h: tower.h + nameH }
    : undefined;
  // Height is measured on its own.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const read = () => {
      const h = stage.getBoundingClientRect().height;
      // A zero is never a real stage — it is a hidden tab or a modal still
      // opening, and taking it flips the desk back to the unresolved defaults
      // (observed 2026-08-06: backgrounding the preview pane made the floor
      // un-align itself). Same trap the fit-scale notes record for 2026-08-05.
      if (!(h > 0)) return;
      setStageH((cur) => (Math.abs(cur - h) > 0.5 ? h : cur));
      const w = stage.getBoundingClientRect().width;
      if (w > 0) setStageW((cur) => (Math.abs(cur - w) > 0.5 ? w : cur));
      // Read from the same element, in the same pass: the tokens are constants,
      // but they are only readable once the stage is in the document.
      const ref = tokenPx(stage, '--dsa-vref', 0);
      if (ref > 0) setVRef((cur) => (Math.abs(cur - ref) > 0.5 ? ref : cur));
      const wref = tokenPx(stage, '--dsa-href', 0);
      if (wref > 0) setHRef((cur) => (Math.abs(cur - wref) > 0.5 ? wref : cur));
      // The caption pill's height — the row the computer keeps under it.
      const nh = tokenPx(stage, '--dsa-name-h', 0);
      if (nh > 0) setNameH((cur) => (Math.abs(cur - nh) > 0.5 ? nh : cur));
      // `room`, not `reach` — the two are separate on purpose (see the stage's
      // own note). The wash is centred on the strip and spreads evenly, so what
      // the layout keeps clear is the same on every side; past it the light is
      // dim enough to lie over the panel, which is the surface it is falling on.
      // Reserving the whole reach instead made the desk draw SMALLER than its
      // authored size to hold a fade nobody can see (measured 2026-08-18, 0.95).
      const room = tokenPx(stage, '--dsa-glow-room', 0);
      const next = { top: room, side: room, bottom: room };
      setGlow((cur) =>
        Math.abs(cur.bottom - next.bottom) > 0.5 || Math.abs(cur.side - next.side) > 0.5 ? next : cur,
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // The desk is ALWAYS centred in the band — not only after a drag here. The
  // defaults, an editor-driven reorder, an old saved layout: whatever the
  // stored positions are, the group renders in the middle (Cindy, 2026-08-03 —
  // v1 only recentred on this hero's own drag-release, so the default page
  // opened lopsided). One shared offset on a wrapper, so relative gaps are
  // untouched and the store is never written by merely LOOKING at the desk.
  // Recomputed whenever the saved layout changes.
  const [groupOff, setGroupOff] = useState({ x: 0, y: 0 });
  // Rung two of the responsive ladder: when the band cannot grow far enough for
  // the desk (a stacked one on a short window), the desk shrinks instead. One
  // factor for the whole group — see fitScale in ./arrangement.ts. 1 whenever it
  // fits, which is every one-row desk, so the common case is untouched.
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const recentre = () => {
      const pos = mirror ? MIRROR : base;
      // No `below` argument: the caption hangs under the hardware again
      // (2026-08-18), so the default — the ramp's own `--gutter` — is exactly
      // the row it needs.
      //
      // ── The lamp keeps its room SIDEWAYS, not above and below (2026-08-24,
      // Cindy: "위아래만 여백을 없애고 다 채우는 거를 원하는 건데"). ───────
      // Reserving the glow on all four sides is what put 54px of empty band
      // over and under the desk at 1512×950 — the hardware was drawn at 1.37
      // when 1.7 fits, and the difference was being held for light. Sideways
      // the reservation stays: that is where a desk grows toward its
      // neighbours, and a glow cut at the left edge reads as a wall.
      //
      // What this costs, deliberately: `.dsa-stage` clips (`overflow: hidden`),
      // so with the lamp on, the top of the pool is cut by the band. The desk
      // being small the rest of the time was the worse trade — the picture is
      // the thing the eye is here for, and the light is a halo around it, not
      // the subject.
      //
      // BELOW keeps its reservation, and what it is really holding is the
      // CAPTION. The name hangs under the tile and draws at a fixed size however
      // far the desk is zoomed, so its band does not scale with everything else
      // — and the glow's depth is what has been covering it.
      //
      // Two shallower reservations were tried on 2026-08-24 and both cut the
      // name off: the ramp's `--gutter` alone lost 6px on a one-display desk at
      // 1512×950, and `--gutter` + `--gutter-xs` lost 4px on three desks at
      // 1280×720 (three captions clipped). Keeping the glow's own depth on this
      // side costs about 40px of band and clips nothing at any window size, so
      // this is where it stops.
      // TOP is zero only while every caption hangs BELOW its tile. A stacked
      // desk flips the upper display's caption above it (`label-up`), and that
      // pill then has nothing to sit in — measured 2026-08-24, the Treehouse 32
      // chip 21px past the top edge of the band. So the reservation comes back
      // for exactly that case, and it is the caption's own line rather than the
      // glow's much deeper pool. Detected from the layout, not from `labelUp`
      // below: that set is derived from `fit`, which this call produces, and
      // reading it here would be a loop.
      const anyAbove = (() => {
        const pos = mirror ? MIRROR : base;
        const list = visibleDisplays();
        return list.some((a) => {
          const A = pos[a.id] ?? DEFAULTS[a.id];
          const at = A.top * vh;
          const al = A.left * hw;
          const ar = al + photoTile(a.id).w;
          return list.some((b) => {
            if (b.id === a.id) return false;
            const B = pos[b.id] ?? DEFAULTS[b.id];
            const bl = B.left * hw;
            const br = bl + photoTile(b.id).w;
            if (br <= al || bl >= ar) return false;
            return B.top * vh > at;
          });
        });
      })();
      const heroAura = {
        top: anyAbove ? tokenPx(stage, '--dsa-name-h', 29) : 0,
        side: glow.side,
        bottom: glow.bottom,
      };
      // The computer is part of the desk the band has to hold and centre — the
      // same `extra` box the DESK card hands these two (left out, a tower at
      // the right end is drawn off the stage).
      const s = mirror ? 1 : fitScale(stage, pos, photoTile, undefined, vh, towerBox, hw, MAX_ZOOM, heroAura);
      setFit((f) => (Math.abs(f - s) > 0.005 ? s : f));
      const off = deskOffset(stage, pos, s, photoTile, vh, towerBox, hw, heroAura);
      if (!off) return;
      setGroupOff((o) => (Math.abs(o.x - off.x) > 1 || Math.abs(o.y - off.y) > 1 ? off : o));
    };
    recentre();
    // Re-center whenever the band resizes. Without this the desk stays wherever
    // it was first measured: the hero band is derived from the window height
    // (--mc-hero-h) and the stage from the modal width, so resizing the window
    // left the group parked off to one side — and a stage measured at zero width
    // (mounted while the modal was still opening) never got centred at all.
    const ro = new ResizeObserver(recentre);
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, mirror, vh, hw, glow, towerAt, nameH]);

  const current = DISPLAYS.find((d) => 'sku' in d && d.sku === currentSku) || visibleDisplays().find((d) => d.kind === 'monitor');

  // Clicking another display on the desk opens ITS settings. The map already
  // shows the whole desk and says the arrangement is shared across every
  // display — so a monitor you can see but not reach is a dead end, and the
  // alternative is closing this modal, finding the card on Perform, reopening.
  // The modal is `?sku=` driven (DeviceModalHost), so switching is one param.
  const [params, setParams] = useSearchParams();
  const downAt = useRef<{ x: number; y: number } | null>(null);
  /**
   * Someone pushed a display instead of clicking it. Answered with the how-to
   * line that is already on this stage rather than a new surface: the sentence
   * exists to answer "what am I supposed to do here?", and a hand that just
   * pushed a display is asking exactly that. Reusing it also means the answer
   * cannot drift from the resting copy, and nothing new had to be styled.
   *
   * Fired on the STAGE's pointer release, measured against where the press
   * landed. Three triggers were tried before this one, and each failed for a
   * reason worth keeping:
   *   · `onPointerMove` on the tile — with the drag hook gone there is no
   *     pointer capture, so a push of any size has already left the tile's box
   *     and its own handler never sees the move.
   *   · `onPointerMove` on the stage — answers mid-gesture, and could not be
   *     exercised in review at all: neither synthetic PointerEvents nor the
   *     automation harness's drag emit an intermediate move.
   *   · the `travelled` branch of `onTileClick` — a `click` needs press and
   *     release on the SAME element, and a push that is worth answering has
   *     usually left the tile, so the click lands on an ancestor and that
   *     branch is never reached. Verified: press 280,190 → release 335,198
   *     produced no click on the tile.
   * Release on the stage is the one moment the whole gesture is guaranteed to
   * pass through, and it is honest timing too — the push is finished.
   */
  const [dragTried, setDragTried] = useState(false);
  const dragTriedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notePush() {
    setDragTried(true);
    if (dragTriedTimer.current) clearTimeout(dragTriedTimer.current);
    dragTriedTimer.current = setTimeout(() => setDragTried(false), 2600);
  }
  useEffect(() => () => {
    if (dragTriedTimer.current) clearTimeout(dragTriedTimer.current);
  }, []);
  /** Only monitors with a SKU of their own have a modal to open — the MacBook's
      built-in panel has no settings page, so it stays a picture. */
  const canOpen = (sku?: string) => !!sku && sku !== currentSku;
  /**
   * Navigating here always means "I was looking at the desk" — this component
   * only mounts as the desk-map hero (MonitorCanvas swaps in XrayHero for
   * Connectivity+xray tabs instead), so the destination should keep showing
   * the desk, not whatever tab happens to be first for the new SKU.
   *
   * Bug this fixes (Cindy, 2026-08-03): pulse-27 has no Overview tab (no
   * `modes`) and IS an xray SKU, so its first tab is Connectivity — clicking
   * it from the Overview desk map landed on the rear-render hero, and the
   * desk the user just clicked on vanished. Picking the target's first
   * DESK-MAP tab (via the same `monitorHeroIsDeskMap` MonitorCanvas's hero
   * switch uses) keeps the hero the map it always is on this surface.
   */
  function openDevice(sku: string) {
    const target = getResolvedSku(sku);
    const deskTab = target && deviceTabs(target).find((t) => monitorHeroIsDeskMap(target, t.id));
    const p = new URLSearchParams(params);
    p.set('sku', sku);
    if (deskTab) p.set('tab', deskTab.id);
    else p.delete('tab');
    p.delete('arrange');
    // The way back belonged to the display we are leaving — drop it from the URL
    // and from the ref, since this component is reused across skus rather than
    // remounted, and a stale marker would fire on the NEXT close.
    p.delete('from');
    returnTo.current = null;
    setParams(p);
  }
  /** A push is not a click. The test predates the drag's removal — it existed so
      that finishing a drag would not also navigate away — and it is still the
      right test with the drag gone: a pointer that travelled was trying to MOVE
      this display, and opening its settings page is not the answer to that.
      Now it says so out loud instead of silently doing nothing (2026-08-20).
      Note the order: the mark is read, then cleared, on every release. */
  function onTileClick(e: React.MouseEvent, sku?: string) {
    const d0 = downAt.current;
    if (!sku || !canOpen(sku) || !d0) return;
    downAt.current = null;
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > CLICK_SLOP) return;
    openDevice(sku);
  }
  /** Did this gesture start on a display, and end somewhere else? Then it was a
      push. Runs on the stage so it catches the releases the tiles never see. */
  function onStageUp(e: React.PointerEvent) {
    const d0 = downAt.current;
    if (!d0 || mirror) {
      downAt.current = null;
      return;
    }
    /* Clear the mark ONLY when this release was a push. `pointerup` bubbles to
       the stage BEFORE the tile's `click` fires, so clearing here unconditionally
       left `onTileClick` with nothing to measure and it returned early — every
       click on another display did nothing (Cindy, 2026-08-24). A click leaves
       the mark standing for the handler that runs next; the following
       `pointerdown` overwrites it, so nothing goes stale. */
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > CLICK_SLOP) {
      downAt.current = null;
      notePush();
    }
  }

  function doIdentify() {
    setIdentify(true);
    if (identifyPinned) return; // pinned by URL — stays up so it can be captured
    setTimeout(() => setIdentify(false), 1100);
  }

  /**
   * How far the desk may be zoomed UP to take the band it has been given
   * (`max` on fitScale — down is unbounded to the function's own 0.4 floor).
   *
   * A rail, not the number that decides: at every window this hero actually
   * gets, the band's own width or height binds first — measured 2026-08-18 at
   * 1512×950, the desk fills the panel at ~1.7 and this constant is nowhere
   * near. It exists for the case the geometry stops answering: a very tall,
   * very wide window would otherwise blow the renders up past what a 979px
   * export can carry, and a desk drawn softer than the panel around it reads
   * as a broken image rather than a big one.
   */
  const MAX_ZOOM = 2.5;
  /* `snapGuide` and `namesClear` arrived with this merge and are NOT kept: both
     existed only for the free drag this branch retired (the accent line that
     followed a snap, and the release-time recheck that a settled layout had not
     buried a name). `labelUp` below is kept — it is about where a caption sits
     on a stacked desk, which the read-only map still draws. */
  /**
   * Which names wear their chip ABOVE the tile (decision 2026-08-19): on a
   * stacked desk the rows sit an arm's ~2cm apart, and the upper display's
   * caption hangs exactly into that gap — onto the lower display's top edge.
   * Widening the rows to fit the caption would draw a gap the real desk does
   * not have (the thing this map exists not to do), so the caption changes
   * sides instead, and ONLY for the display that actually has hardware under
   * it — side-by-side desks keep every caption below (2026-08-18 placement).
   * A display boxed in on BOTH sides keeps the caption below: flipping it
   * into the upper neighbour trades one collision for the same one.
   * Same fraction coordinates the magnet stacks in; the zone divides the
   * chip's screen size back out of the zoom because the chip itself does
   * (see `.dsa-name` — it counter-scales to stay 12px).
   */
  const { up: labelUp, down2: labelDown2 } = useMemo(() => {
    const up = new Set<string>();
    // Caption + its two gutters, in screen px, un-zoomed like the chip is.
    const zone = 28 / fit;
    const box = (id: string) => {
      const p = mirror ? MIRROR[id] : positions[id] ?? DEFAULTS[id];
      const s = photoTile(id);
      const l = p.left * hw;
      const t = p.top * vh;
      return { l, r: l + s.w, t, b: t + s.h };
    };
    for (const a of visibleDisplays()) {
      const A = box(a.id);
      let below = false;
      let above = false;
      for (const b of visibleDisplays()) {
        if (b.id === a.id) continue;
        const B = box(b.id);
        if (B.r <= A.l || B.l >= A.r) continue; // no shared column, no collision
        if (B.t >= A.b - 1 && B.t - A.b < zone) below = true;
        if (B.b <= A.t + 1 && A.t - B.b < zone) above = true;
      }
      if (below && !above) up.add(a.id);
    }
    // ── Second pass: chips against CHIPS (2026-08-24) ─────────────────────
    // The pass above keeps a caption off another display's HARDWARE. But the
    // captions keep their reading size while the desk zooms, so on a stacked
    // desk drawn small two neighbours' chips can meet even though their tiles
    // never do — measured at fit 0.61: tiles 69px apart wearing 129px chips,
    // overlapping by 19px. Same cure as the first pass, chosen pairwise: when
    // two same-side chips would meet, one changes sides. The one that moves is
    // the one with free air above (flipping into hardware would just trade one
    // collision for another); on a tie, the left one, so the answer is stable.
    const CHIP_W = 132; // the widest pill of this roster, screen px
    const CHIP_H = 30;
    const clearAbove = (id: string) => {
      const A = box(id);
      for (const b of visibleDisplays()) {
        if (b.id === id) continue;
        const B = box(b.id);
        if (B.r <= A.l || B.l >= A.r) continue;
        if (B.b <= A.t + 1 && A.t - B.b < zone) return false;
      }
      return true;
    };
    const roster = visibleDisplays();
    const down2 = new Set<string>();
    for (let i = 0; i < roster.length; i++) {
      for (let j = i + 1; j < roster.length; j++) {
        const a = roster[i].id;
        const b = roster[j].id;
        if (up.has(a) !== up.has(b)) continue; // already on different sides
        const A = box(a);
        const B = box(b);
        // Chips hang centred on their tile, at the edge the side dictates —
        // fixed size, so the meeting test runs in screen px.
        const dx = Math.abs((A.l + A.r) / 2 - (B.l + B.r) / 2) * fit;
        const ea = up.has(a) ? A.t : A.b;
        const eb = up.has(b) ? B.t : B.b;
        if (dx >= CHIP_W || Math.abs(ea - eb) * fit >= CHIP_H) continue;
        const flip = clearAbove(a) ? a : clearAbove(b) ? b : null;
        if (flip) {
          up.add(flip);
          continue;
        }
        // Neither can go up — there is hardware over both (a stacked desk is
        // exactly where this happens). The pills are WIDER than the tiles they
        // name (126px of pill under a 92px laptop, measured 2026-08-24), so
        // side by side they must collide, and there is no spacing answer that
        // does not lie about the desk. So one of them steps down a line: same
        // two-position grammar as `label-up`, one notch further. The right-hand
        // one moves, so the reading order stays left-to-right on the top line.
        down2.add(A.l >= B.l ? a : b);
      }
    }
    return { up, down2 };
  }, [positions, mirror, fit, hw, vh]);

  // ── The desk here is READ-ONLY (2026-08-20) ───────────────────────────────
  // This hero used to carry a free-placement drag: tiles could be moved with no
  // snapping, because "a real desk has space between the monitors" and this is
  // the lens that shows the desk (Cindy, 2026-08-03). It is gone, and what went
  // with it was ~250 lines — the legality machinery that free placement needs
  // (overlap limits, the release-time name-legibility recheck, the snap guide).
  //
  // Three decisions of our own already said this surface was the view:
  //   · Decision C, 2026-07-28 — "the map's default is View; Arrange is a mode
  //     you enter, not permanent editing" (design-assets/chris-decisions.md).
  //   · Two registers, 2026-07-22 — photoreal = identification, schematic =
  //     arrangement and routing (see DeskWidget.tsx).
  //   · One editor, 2026-08-18 — dragging in two places is how two surfaces
  //     start disagreeing, which is why the Personalize DESK card is read-only.
  //   And ArrangeEditor.tsx's own header has called this hero "read-only" since
  //   2026-08-02.
  // Chris asked the same question at the 2026-08-20 design review: "I would
  // question if we need that interaction here since we have the arrange modal
  // for that."
  //
  // What is actually lost: the hand-set HORIZONTAL gaps. Measured before
  // removing — the editor's write-back (projectRowsOntoView) already reuses the
  // saved side gaps but flattens vertical stagger to one top per row, so half of
  // "my desk really looks like this" had not survived a trip through the editor
  // for some time. The gaps the defaults ship with were evened up on 2026-08-07.
  //
  // Clicking a tile still switches the modal to that display — that is
  // `onTileClick`, and it kept the CLICK_SLOP test on purpose: a pointer that
  // travelled is not a click, so someone who still tries to drag does not get
  // navigated away as a reward.

  return (
    <div className="dsa-hero">
      {/* The title and the how-to used to live here as two permanent lines
          (Cindy, 2026-08-05: "이 정말 필요한 텍스트야?"). Both are gone from the
          header — three monitors drawn on a desk already say "this is where your
          displays are", and a how-to is read once and then read forever.
          What that buys is not tidiness, it is the feature: the two lines cost
          20px of a band that had been squeezed to 32px.
          The how-to moved INTO the stage and appears on hover (below). The title
          is not replaced by other visible text — the stage carries the name in
          the accessibility tree instead, which is more than the title did: it
          was plain text referenced by nothing (checked 2026-08-05 — no `id`, no
          `role`, and no `aria-labelledby` pointing at it). */}
      <div className="dsa-hero-head">
        <div className="dsa-head-left" />
        {/* The how-to used to sit here, right-aligned beside the buttons. Moved
            back onto the desk 2026-08-06 (Cindy: "center align에 밑부분에 놔달라고
            내가 저번에 말하지 않았어?") — it lives with the stage now, next to the
            mirror and Identify lines it shares a pill with.
            Not the DS `Tooltip` component, whichever placement wins: that hangs a
            popup off a small trigger, and the trigger here is the whole desk. */}
        {/* Extend/Mirror and edge-exact placement live in the editor, not here:
            those are the arrangement, and nudging a few pixels looks crude on a
            picture built to look good (Chris, 1:1 2026-07-30). What stays is what
            belongs to the desk — spreading the furniture, and Identify, which
            flashes numbers rather than changing anything.
            No "Save as profile": the layout commits on drag end, so a save button
            promised a second, named copy that nothing stored or recalled (a 1.4s
            "Saved ✓" and no persistence). */}
        {/* ⚠️ Text links, not buttons — and this is the THIRD treatment for this
            pair, each one a step further from "control" and toward "label"
            (Cindy): filled accent + hand-rolled black box → both `on-image`
            (2026-08-18, when the box came off) → the house's own text link
            (2026-08-19: "코너에 있는 이 Arrange 버튼, 이런 스타일을 hero image
            area에 있는 floating 버튼에 적용을 시키면 좋을 것 같거든").
            `.ds-text-overline.w-link` is Chris's, verbatim and in the same order
            `WidgetShell` writes it — the exact pair on the ARRANGE at the corner
            of the Personalize DISPLAY card, which is what Cindy was pointing at.
            Reused by class, not by copying its values (mono · 14px · uppercase ·
            no surface · `--text-muted` → accent on hover), so if he changes it
            these change with it.
            The reason this is safe over artwork, which is why the earlier
            treatments carried a surface: nothing bright ever gets under it. It
            used to be a drag obstacle with zero overlap allowance so no display
            could be moved beneath it; now that the desk is read-only, displays
            sit where the saved layout puts them and the defaults keep clear.
            What IS under it is the stage and the under-glow — see the
            `.dsa-actions` note for the measurement that says the glow does not
            eat it. ⚠️ If a display ever lands under this pill from a layout
            saved elsewhere, that is the case to fix; it is no longer prevented
            here. */}
        {/* `Arrange` needs two screens to mean anything — one display has no
            arrangement, and a button that opens an editor with nothing to move
            is the "control with no engine behind it" case.

            It is replaced, not padlocked. This screen settled that grammar on
            2026-08-21 (Cindy): a padlock says "you cannot open this", and a
            second display is something the person CAN add, so the line names
            what arrives instead of what is withheld — the same call the Gear
            Switch card's `With a second PC` fold rests on.

            `Identify` stays either way: it still flashes a number onto the one
            panel, which is how you confirm the app is talking to the display in
            front of you. */}
        <div className="dsa-actions">
          <button className="ds-text-overline w-link" type="button" onClick={doIdentify}>
            Identify
          </button>
          {visibleDisplays().length > 1 ? (
            <button className="ds-text-overline w-link" type="button" onClick={() => setArranging(true)}>
              Arrange
            </button>
          ) : (
            <span className="ds-text-overline dsa-action-when">With a second display</span>
          )}
        </div>
      </div>

      <div
        className={'dsa-stage' + (mirror ? ' mirror' : '') + (identify ? ' identify' : '')}
        ref={stageRef}
        /* A press that did not land on a display clears the mark. The tile's own
           handler sets it and this one bubbles afterwards, so the check IS the
           question "did this gesture start on a display" — without it a press on
           empty desk would inherit the previous gesture's origin and a later
           release could answer a push nobody made. */
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest('.dsa-disp')) downAt.current = null;
        }}
        onPointerUp={onStageUp}
        /* The name the removed title used to carry, now where it belongs: on the
           region itself, so it reaches assistive tech instead of only sighted
           users. `group` because this is a set of related things to read and
           move through, not a single control. */
        role="group"
        aria-label={`Display arrangement · ${visibleDisplays().length} displays`}
      >
        {/* Identify's real work happens OFF this screen: the monitors put a big
            number on their own panels, and the numbers here are the other half of
            that pair — that is how you learn which tile is the display to your
            right. A web prototype cannot light up real hardware, so without this
            line the button looks broken: the corner chips grow and nothing else
            happens. Saying what the hardware does keeps it a real feature instead
            of a dead control (wired-state audit — promote, don't remove; Cindy,
            2026-08-06). Replaces the mirror line for its 1.1s rather than
            stacking on top of it. */}
        {identify ? (
          <span className="dsa-stage-note">Each display is showing this number on its own screen</span>
        ) : (
          mirror && <span className="dsa-mirror-badge">Mirrored — all displays show the same image</span>
        )}
        {/* The how-to, under the desk it describes (Cindy, 2026-08-05: "Hero
            Section 중간 밑에 떠야지 유저들이 읽기 쉬울 거 아니야"). Two earlier
            placements are why it is here and this short:
            · bottom-centre of the stage wearing the caption chip — the 91-char
              sentence spanned the band and laid a dark bar over all three
              displays and their names;
            · the header row — no longer covering anything, but sharing a y-band
              with the status pills, so it read as colliding with them.
            The fix for both was the copy, not the position: at 23 characters it
            sits under the desk without reaching the tiles. See the CSS note for
            what came out of the sentence and why.
            ⚠️ 2026-08-06 — this comment described the right placement while the
            element itself had been moved up into the header row, and the stale
            note is what made the header look like a decided answer. Restored
            here on Cindy's word ("center align에 밑부분에 놔달라고 내가 저번에
            말하지 않았어?"), and the 「조작법이 데스크를 가리지 않고, 읽기 쉬운
            자리에 뜬다」 line in `regression-invariants.md` agrees ("데스크 아래
            중앙 … 되돌리지 말 것"). Styling is the library's helper text, not the
            announcement pill the siblings wear — see the CSS note.
            `!stored` — shown only until this desk has been arranged once (Cindy,
            2026-08-06). The sentence exists to answer "what am I supposed to do
            here?", and that question is asked once. After a layout has been saved
            it is a caption that repeats something the user has already done, on
            every hover, for the life of the app. `hasStoredLayout` is the same
            signal the opening layout uses, so nothing new is being remembered to
            support this.
            ⚠️ 2026-08-20 — the copy said "Drag to match your desk" and the tiles
            wore `cursor: grab`. Both were promises this hero no longer keeps, so
            the sentence now names the control that does the work. It is also
            shown on `dragTried`, REGARDLESS of `stored`: a hand that pushed a
            display is asking the question again, and answering it once per push
            is not the same as repeating a caption on every hover.
            `aria-hidden` — the stage's own `aria-label` already names the
            region, and a screen-reader user is not being told to hover. */}
        {/* The "Arrange to match your desk" line is gone (2026-08-24, Cindy:
            "Arrange 버튼이 있는데 그게 왜 필요해?"). It was a caption telling
            people to use a control that is already on screen and already named
            `Arrange` — and after the first save it only appeared for 2.6s, when
            a hand tried to push a display that no longer moves. A label on the
            button is where that answer belongs, not a line under the picture. */}
        {/* One transform carries both rungs of the ladder: where the desk sits
            (always centred) and how big it is drawn (1 unless a stacked desk has
            to shrink into the band — see fitScale). `transform-origin: 0 0` in the
            CSS is what makes the zoom compose with the translate the way every
            caller's maths assumes; at zoom 1 the origin is irrelevant. */}
        <div
          className="dsa-group"
          style={
            {
              transform: `translate(${groupOff.x}px, ${groupOff.y}px) scale(${fit})`,
              // Published so the writing can divide itself back out of the zoom
              // (see `.dsa-name` / `.dsa-num` in display-arrange.css). A custom
              // property rather than a second inline style on every tile: the
              // zoom is a property OF THE GROUP, and anything inside that must
              // not shrink reads it from here.
              '--dsa-fit': fit,
            } as React.CSSProperties
          }
        >
        {/* The desk they stand on — no line (2026-09-23, Cindy «선없는 판으로 가자»,
            which supersedes the 2026-08-04 «no floor»: that one rejected a lit,
            busy surface; this is light pooling on it plus contact shadows). Same
            element and span rule as the DESK card (`deskSpan`), at the floor every
            tile now stands on (`standOnFloor`). */}
        {floorSpan && (
          <div
            className="dov-floor"
            aria-hidden="true"
            style={{
              left: floorSpan.left,
              width: floorSpan.width,
              top: floorSpan.top,
              // The room under the floor, so the light fades before the stage clips it.
              height: stageH > 0 ? Math.max(20, Math.min(110, (stageH - groupOff.y) / (fit || 1) - floorSpan.top)) : undefined,
            }}
          />
        )}
        {visibleDisplays().map((d, i) => {
          const pos = mirror ? MIRROR[d.id] : positions[d.id] ?? DEFAULTS[d.id];
          const isCur = current?.id === d.id;
          const size = photoTile(d.id);
          // Only hardware that HAS the strip lights up — read from the SKU, not
          // from a list of ids here, so a second under-glow display needs no edit
          // in this file. The glow channel was deliberately reserved for this
          // (see the WITHDRAWN selection proposal in display-arrange.css).
          const glows = 'sku' in d && !!getResolvedSku(d.sku)?.features?.underGlow;
          return (
            /* EVERY tile is reachable by keyboard, not only the ones that open a
               settings page (Cindy, 2026-08-04). Once displays may overlap, a
               buried tile's name is recovered by bringing it forward — and with
               tab-stops only on "openable" tiles a keyboard user had no way to do
               that at all: the current display and the built-in panel were
               unreachable, so their names could be hidden with no route back.
               Focus raises the tile exactly like hover does — see the
               `:focus-visible` half of the z-index ladder in display-arrange.css.
               The ring itself is NOT redefined here; the library's global one
               (`html:root :focus-visible`) is what a keyboard user should meet.
               `group` rather than `button` for the tiles with nowhere to go —
               they are something you can read and drag, not a control. */
            <div
              key={d.id}
              className={`dsa-disp dsa-${d.kind}${isCur ? ' current' : ''}${
                canOpen('sku' in d ? d.sku : undefined) ? ' navigable' : ''
              }${glows ? ' glowing' : ''}${labelUp.has(d.id) ? ' label-up' : ''}${
                labelDown2.has(d.id) ? ' label-down2' : ''
              }`}
              role={canOpen('sku' in d ? d.sku : undefined) ? 'button' : 'group'}
              tabIndex={0}
              aria-label={canOpen('sku' in d ? d.sku : undefined) ? `Open ${hardwareName(d)} settings` : hardwareName(d)}
              data-display={d.id}
              onKeyDown={(e) => {
                const sku = 'sku' in d ? d.sku : undefined;
                if (canOpen(sku) && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  openDevice(sku!);
                }
              }}
              /* Both axes hand CSS the raw fraction and let the stage say what it
                 is a fraction OF (`--dsa-href` / `--dsa-vref`; see the `left` and
                 `top` rules in display-arrange.css), so the first paint is already
                 final. Left was a percentage of the live stage until 2026-08-18 —
                 that is what made a wider hero spread the desk instead of drawing
                 it larger; see `hRef` on fitScale. Both fall back to 100%, i.e.
                 the stage, so surfaces that set neither behave as before. */
              style={
                {
                  ['--dsa-l' as string]: pos.left,
                  ['--dsa-t' as string]: pos.top,
                } as React.CSSProperties
              }
              onPointerDown={(e) => {
                downAt.current = { x: e.clientX, y: e.clientY };
              }}
              onClick={(e) => onTileClick(e, 'sku' in d ? d.sku : undefined)}
            >
              {/* Bounds box, not the render's silhouette, carries every piece of
                  state (selection ring, number, "this display"). A glow traced
                  around a photographed stand and bezel reads as a lamp behind
                  the desk; a rectangle reads as "this one is selected". It is
                  also the click target, so what you see is what you open. */}
              <div className="dsa-bounds" style={{ width: size.w, height: size.h }}>
                {/* The renders are tight-cropped (zero margin, one export spec —
                    render-framing.py), so the file IS the hardware box and fills
                    the bounds with no per-file offset math. */}
                {/* PROTOTYPE 2026-08-04 — a display asked for by `rearSku`
                    turns around in place. Connectivity uses it so the tab keeps
                    the arrangement (which computer holds the keyboard & mouse)
                    while still showing the ports.
                    The turn is a real rotation (both faces mounted) only for
                    displays that own a rear render; everything else keeps the
                    plain img. A first paint that is already rear — the modal
                    opened straight onto Connectivity — lands without animating,
                    because a CSS transition needs a live change: exactly the
                    approved policy, play only when the user was just looking at
                    the desk (Cindy, 2026-08-04). Both faces stay mounted so the
                    first turn never waits on an image fetch. */}
                {REAR[d.id] ? (
                  <div className={`dsa-flip${d.id === rearSku ? ' is-rear' : ''}`}>
                    <div className="dsa-flip-inner">
                      <img
                        className="dsa-render dsa-face dsa-face-front"
                        src={RENDER[d.id] || oled27Url}
                        alt=""
                        draggable={false}
                      />
                      {/* On the front face, so a turn to the rear hides it. */}
                      <span className="dsa-face dsa-screen-face">
                        <ScreenContent id={d.id} live />
                      </span>
                      {/* The rear face is a wrapper rather than a bare img so the
                          port-strip marker can use the SAME percentage box the
                          render does. That is what makes it line up with the
                          panel's port map, which is a zoom of exactly this strip
                          (measured 2026-08-04: 60×8px here → 602×124px there, so
                          ~10×; nothing static reads at the small end, hence the
                          marker only appears while the plate is hovered).
                          Inert on purpose: a hit target here would eat 60×8px out
                          of the tile's drag area. */}
                      <div className="dsa-face dsa-face-rear">
                        <img
                          className="dsa-render dsa-rear-img"
                          src={REAR[d.id]}
                          alt=""
                          draggable={false}
                        />
                        <span className="dsa-port-mark" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    className="dsa-render"
                    src={RENDER[d.id] || oled27Url}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
                {!REAR[d.id] && <ScreenContent id={d.id} live />}
                {/* No layout MARKS on the render (2026-09-22, Cindy) — a white line
                    on a photograph read as pasted on, and it repeated the tiles.
                    What IS drawn since 2026-09-23 is each computer's desktop in its
                    pane (ScreenContent): which computer is where, which the tiles
                    cannot say. */}
                <span className="dsa-num">{i + 1}</span>
              </div>
              {/* The ▼ pointer that used to hang here is RETIRED (2026-08-24,
                  Cindy: "그 화살표가 왜 있어야 되는지 모르겠고"). It was her own
                  2026-08-04 call — a fixed triangle replacing an 11-character
                  "This display" label — but the 2026-08-19 move to Chris's
                  device-picker pill made the pill's blue tint say "this
                  display" already, so the triangle had become a second voice.
                  It also sat inside the zoomed group without the counter-scale
                  the text wears, so it grew and shrank with the desk while
                  everything labelled stayed put. The assistive-tech word it
                  carried lives on the pill now (`aria-current`). */}
              {/* ⚠️ `.ls-rail-btn`, which is CHRIS'S DEVICE-PICKER PILL — the rail
                  under the Light Studio preview where you choose which device you
                  are lighting (`web/src/lightstudio/light-studio.css`, byte-for-byte
                  upstream, his commit `2d9353a`). Cindy, 2026-08-19: "Personalize
                  페이지에 보면, 거기서 쓰는 Device Select 버튼이랑 우리가 쓰는
                  Select 버튼이랑 다르거든. 크리스 디자인으로 따라가 줘."
                  She is right that these are the same control: a name under a
                  picture of a device that you click to pick that device. Two
                  drawings of one thing is the thing this map has been told not to
                  do, so the drawing that stays is his.
                  ⚠️ It replaced `.ds-tag.overlay` (a status badge — mono, 12px,
                  3px corners, black scrim, SOLID accent when selected). Do not
                  put that back: the tag is for a word about a thing ("NEW", "4K")
                  and this is the thing's name. What his pill brings that the tag
                  fought us for: display face at reading size, a pill corner, and
                  a selected state that TINTS rather than floods — which is what
                  lets the pointer above the tile stay the loud channel for "this
                  display" (2026-08-04 decision) instead of competing with it.
                  Reused by CLASS, not by copying values — see the note on
                  `.dsa-name` in display-arrange.css for the one thing that had to
                  be handled locally (it is a rail on a panel there and a label on
                  artwork here) and for the request that this pill graduate into
                  the library, where a device picker belongs. */}
              <span
                className={`dsa-name ls-rail-btn${isCur ? ' active' : ''}`}
                aria-current={isCur || undefined}
              >
                {/* `MacBook`, not `Built-in Display`, for the laptop — the hero
                    draws hardware (arrangement.ts `hardwareName`, 2026-09-21). */}
                {hardwareName(d)}
              </span>
            </div>
          );
        })}
        {/* The computer that stands on this desk — see `towerAt`. Not a
            display, so no number, no glow, no click: it is here so the picture
            agrees with the Admin row and the DESK card, not to be configured.
            The box is the DESK card's `.dov-slab` (30×73 = `towerTile()`) with
            its glyph, and the name wears the same pill as every display here. */}
        {towerAt && (
          <div
            className="dsa-disp dsa-computer"
            role="group"
            aria-label={deskHosts()[1]}
            style={{ ['--dsa-l' as string]: towerAt.left, ['--dsa-t' as string]: towerAt.top } as React.CSSProperties}
          >
            <div className="dsa-bounds" style={{ width: tower.w, height: tower.h }}>
              <div className="dov-slab"><LaptopGlyph /></div>
            </div>
            <span className="dsa-name ls-rail-btn">{deskHosts()[1]}</span>
          </div>
        )}
        </div>
      </div>

      {arranging && (
        <ArrangeEditor
          currentSku={currentSku}
          onClose={() => {
            const back = returnTo.current;
            // One-way: a second open from this hero is not the deep link's.
            returnTo.current = null;
            setArranging(false);
            if (back === 'personalize') navigate('/personalize');
          }}
          /* The editor commits a layout for THIS stage — its tile sizes, its box
             — so it is handed the destination rather than looking for it. */
          viewStage={() => stageRef.current}
        />
      )}
    </div>
  );
}

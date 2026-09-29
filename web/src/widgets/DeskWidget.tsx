// ══════════════════════════════════════════════════════════════════════════
// DESK — Personalize → Display. Where the screens sit and which computer the
// keyboard is on. It SHOWS the desk; it does not edit it.
//
// Where it comes from: the Map half of the retired Perform `DeviceOverview`
// (git b9665ab~1), lifted rather than redrawn so the two cannot drift.
//
// ⚠️ Placement lived here from 2026-08-21 to 2026-09-01 and no longer does
// (Cindy). Older commit messages, reports and the CSS header all describe a
// card you could drag on — read those as history. The `Arrange` window in this
// card's corner is the one editor, which is also the 2026-08-19 call this had
// drifted away from.
//
// Why it lives on Personalize and not in a device window: a device window is
// about ONE piece of hardware, and a desk is the relationship between several.
// Personalize is the page about the DESK rather than the app (2026-08-07) —
// Lighting is the desk's light, this is the desk's screens.
//
// Two registers, still (2026-07-22): photoreal = identification (the modal
// hero) · schematic = arrangement and routing (here). This one is deliberately
// small and flat so it does not read as a second copy of Light Studio's 3D
// desk, which sits further down the same page.
//
// Nothing here is a placeholder: the tiles are the saved layout, and clicking
// one writes the same `kvm.activePc` the Connectivity tab's Gear Switch card
// reads and writes.
//
// ⚠️ 2026-08-20 (later the same day) — THIS CARD NOW AUTHORS PLACEMENT. The desk
// used to be edited in the monitor window's hero; that drag retired after Chris
// asked at the design review why the interaction was there when the Arrange
// editor exists. The reason it comes back HERE rather than staying gone is the
// reason Cindy wanted a movable desk in the first place: not authoring an
// arrangement, but seeing "how the backlight actually looks on MY desk". That
// answer needs the real gaps between the monitors, and the Arrange editor cannot
// hold them — it joins displays flush on purpose, because coordinate space has
// to be continuous (`ArrangeEditor.tsx`).
//
// Two jobs, two values, and that is what keeps this from being "two editors"
// (the 2026-08-18 call): the editor owns the TOPOLOGY — who is beside whom, flush
// — and this lens owns the SPACING. The shape still travels between them through
// `projectRowsOntoView`. Placement moved house; it did not multiply.
//
// It also does not overturn the 2026-07-22 register decision. That split
// identification (photoreal) from arrangement + routing (schematic), and the
// arrangement it meant is the pixel topology Chris called "moving a few pixels
// just to get it to line up correctly". Physical placement for light is a third
// job, and photoreal is what it needs — which is why it lands on this card now
// that this card draws the renders.
// ══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, WidgetShell } from '../components';
import { useSettings } from '../state/Settings';
import { useNavigate } from 'react-router-dom';
import {
  visibleDisplays,
  hasSecondPc,
  deskGear,
  computerSide,
  hasTower,
  deskHosts,
  towerTile,
  DEFAULTS,
  MIRROR,
  deskOffset,
  fitScale,
  slabPlacement,
  readArrangement,
  tokenPx,
  STAGE_INSET_TOKEN,
  defaultsFor,
  hasStoredLayout,
  healOverlap,
  standOnFloor,
  deskSpan,
  DESK_FLOOR,
  photoTile,
  type Frac,
  type Positions,
} from '../devices/arrangement';
import '../devices/display-arrange.css'; // mirror badge, hint type — Chris's, reused
import './desk-widget.css';
// The SAME renders the modal hero draws (2026-08-20, decision of 2026-08-19).
// Imported straight from the asset folder rather than re-exported through
// DisplayArrange: one drawing means one set of files, and reaching for the files
// keeps this card independent of that component's own churn.
import { ScreenContent } from '../devices/ScreenContent';
import treehouseUrl from '../devices/monitor/assets/treehouse32-front-tight.png';
import oled27Url from '../devices/monitor/assets/omen-oled27-front.png';
import macbookUrl from '../devices/monitor/assets/macbook-front-generic.png';

/** Which render stands for which display — same map, same fallback rule as the
    hero: a display with no render of its own borrows the OLED 27 and is visibly
    wrong on purpose rather than silently missing (generic monitor render still
    pending, progress.md 2026-08-02). */
const RENDER: Record<string, string> = {
  'treehouse-32': treehouseUrl,
  'oled-27': oled27Url,
  builtin: macbookUrl,
};

/**
 * What this map draws BELOW the box that `photoTile` reports, in px. Passed to
 * fitScale so a stacked desk shrinks enough for the bottom row's writing to
 * survive.
 *
 * The stand USED to be part of this number (`.dov-base`, 10px). It is not any
 * more: the renders are tight-cropped including the stand, so the tile box now
 * ends at the desk surface and only the writing hangs below it — the caption
 * (`--gutter-xs` 8 over an 11px line = 19). The host tag that used to hang under
 * the Treehouse tile (≈ 20 more) left on 2026-09-13, and this number went with it —
 * it had been reserving 20px of air under every caption for a chip that was gone.
 */
const BELOW_TILE = 19;
/** The card draws nothing outside the hardware but the caption, so the desk is
    centred on hardware + caption (`aura.bottom`), not on the hardware alone —
    otherwise the caption's room is charged to the top half too and the stage
    carries a band of air under the writing (measured 2026-09-13: 73px). */
const CARD_AURA = { top: 0, side: 0, bottom: BELOW_TILE };
/** When the card is given more height than the desk needs (`.pg-rail-fill`: it
    takes the rail's height), the desk grows into it instead of floating in air —
    same cap as the hero's `MAX_ZOOM` (DisplayArrange.tsx), so both surfaces
    stop at the same size. Width binds long before this does on a 672px stage. */
const CARD_MAX_ZOOM = 2.5;

/**
 * The second computer's drawn box. A TOWER since 2026-09-03 — `towerTile()`
 * sizes it from the hardware the way `photoTile` sizes a display. Hardware only,
 * like `photoTile`: the caption's room is added ONCE for every tile alike, by
 * `need` and `CARD_AURA` — until 2026-09-13 it was added here as well, so the
 * tower paid twice and the stage carried 19px of air under every caption. It
 * stays out of `photoTile` because that answers for displays and this is a
 * computer: it has no screen on this desk, which is exactly why it is here and
 * not in DISPLAYS.
 */
const SLAB_ART = towerTile();
const SLAB_BOX = { w: SLAB_ART.w, h: SLAB_ART.h };

// ── draft glyphs (paths lifted verbatim from the retired map's inline symbols) ──
// Hand-drawn ON PURPOSE, and only until the icon set lands. Re-checked
// 2026-08-18: `shared/icons.svg` and `web/src/components/icon-names.ts` carry no
// keyboard, mouse or laptop symbol — the nearest are `keys` (a single keycap)
// and the generic `devices`. Chris has all three on the Hadouken icons page and
// will bring them over with that set, so these are placeholders with a known
// exit: swap to <Icon name="…" /> the moment the set arrives.
//
// WHERE THAT REQUEST ACTUALLY LIVES (corrected 2026-08-19 — Cindy remembered
// this and she was right): it was handed to Chris at the 1:1 of 2026-07-30,
// `design-assets/chris-1on1-2026-07-30.md` item 2 — "Keyboard + mouse icons —
// nothing to design, two to carry over … both are on the Hadouken icons page —
// so please just include them when you bring that set over." The internal
// ledger is `design-assets/icon-requests.md` rows 8/9/10, which also records
// that Cindy opened the Hadouken page herself and turned the ask from "draw
// these" into "port these", dropping the new-design count to zero.
//
// This comment used to cite `chris-next-outbound.md`. That file is the queue of
// things NOT YET SENT, so the citation read as "still owed" and a grep there
// came back empty — which then got reported as "no request was ever filed".
// Sent history and pending queue are two different registers; cite the one that
// holds the fact.
function KeyboardGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.8" y="5.3" width="16.4" height="9.4" rx="1.8" />
      <path d="M4.6 8.2h.9M7.5 8.2h.9M10.4 8.2h.9M13.3 8.2h.9M5.5 11.6h9" />
    </svg>
  );
}
function MouseGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6.6" y="2.6" width="6.8" height="14.8" rx="3.4" />
      <path d="M10 5.4v2.8" />
    </svg>
  );
}
/**
 * The keyboard + mouse mark. ONE component now, placed by `deskGear()` rather
 * than by two CSS classes racing the `is-kvm` root — see that function for why
 * the old binary could leave the desk with no mark at all.
 */
function GearPill({ where }: { where: 'hub' | 'direct' }) {
  // Only on a two-computer desk (2026-09-21). With one computer the keyboard is
  // always on it, so the mark said the same thing on every desk — a mark with
  // nothing to tell apart (Cindy 2026-09-09: 뜻 없는 것은 놓지 않는다). It comes
  // back with the second computer, where "follows the screen" is the news.
  if (!hasSecondPc()) return null;
  const g = deskGear();
  const on = (['keyboard', 'mouse'] as const).filter((k) => g[k] === where);
  if (!on.length) return null;
  const names = on.join(' & ');
  return (
    <span
      className="dov-io-pill"
      title={
        where === 'hub'
          ? `${names} — plugged into the Treehouse 32, so they follow the screen`
          : `${names} — plugged into the computer, so they stay put`
      }
    >
      {on.includes('keyboard') && <KeyboardGlyph />}
      {on.includes('mouse') && <MouseGlyph />}
    </span>
  );
}

/** Exported so the monitor window's hero draws the same computer (2026-09-18). */
export function LaptopGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 10.5h11l1.7 3.2H2.8z" />
      <path d="M7.5 12.1h5" />
    </svg>
  );
}

type StageProps = {
  positions: Positions;
  mirror: boolean;
  stageRef: React.RefObject<HTMLDivElement>;
  /** Hand the keyboard + mouse to a computer — writes `kvm.activePc`, the same
      routing the Connectivity tab's Gear Switch card edits. */
  onSwitch: (to: 'pc1' | 'pc2') => void;
  /** Switching only exists once Gear Switch is set up (`kvm.configured`) — a
      keyboard can't be handed to the other computer before the KVM knows it. */
  canSwitch: boolean;
  /** Uniform zoom for the whole desk — 1 unless the saved layout is too tall for
      this stage, which a STACKED arrangement is (see fitScale in
      devices/arrangement.ts). */
  fit: number;
  /** Where the desk has to move to sit in the middle of the stage (deskOffset). */
  groupOff: { x: number; y: number };
  /** Ids whose caption hangs ABOVE the tile — see `.dov-disp.label-up`. */
  labelUp: Set<string>;
  /** Height this desk needs to be drawn at full size, published as `--dov-need`
      so CSS can take `max(authored, needed)`. 0 = the authored box is enough. */
  need: number;
  /** Where the second computer stands — `slabPlacement`, resolved once by the widget
      so the tile that is drawn and the box that is measured are the same box. */
  slabAt: Frac;
  /** The stretch of desk the hardware covers, in authored px (2026-09-23) — the
      surface the pictures stand on. Null until the card has measured itself. */
  floor: { left: number; width: number; top: number } | null;
};

/**
 * One display, drawn. The box is `photoTile`'s — the hardware's own bounds — so
 * whatever sits on top of the picture (the KVM mark) can be placed against the
 * panel rather than against a guessed rectangle.
 *
 * Why an explicit box instead of letting the image size itself: the tile's width
 * is a physical claim (a 32" IS wider than a 27"), and an `<img>` left to its own
 * intrinsic size would draw the export's pixel dimensions instead. The renders
 * share one tight-crop export spec, so box + `object-fit: contain` reproduces the
 * hero's drawing exactly.
 */
function Shot({ id, children }: { id: string; children?: React.ReactNode }) {
  const { w, h } = photoTile(id);
  return (
    <div className="dov-shot" style={{ width: w, height: h }}>
      <img className="dov-render" src={RENDER[id] ?? RENDER['oled-27']} alt="" draggable={false} />
      {/* Each computer's desktop on its screen, the same as the hero (2026-09-23). */}
      <ScreenContent id={id} />
      {children}
    </div>
  );
}

/** The desk stage — direct/KVM appearance is CSS-driven via the root `is-kvm`. */
function DeskStage({ positions, mirror, stageRef, onSwitch, canSwitch, fit, groupOff, labelUp, need, slabAt, floor }: StageProps) {
  // The two computers, named by the SKU rather than typed here (2026-09-03).
  const [pc1Name, pc2Name] = deskHosts();
  const up = (id: string) => (labelUp.has(id) ? ' label-up' : '');
  /* Which screens the desk actually has. The three tiles below are written out
     by hand (each carries its own labels and pills), so the roster cannot place
     them in a loop — the set is what each one asks before it draws. */
  const onDesk = new Set(visibleDisplays().map((d) => d.id));
  /* `?? DEFAULTS[id]` is the belt to the braces above: `positions` only carries
     the screens on the desk now, and a stale saved layout can name one that is
     no longer attached. Reading `.left` off undefined took the whole card down
     with it (seen 2026-08-24, the first time a one-display desk ever rendered
     this card — the section used to be hidden entirely). */
  const at = (id: string) => (mirror ? MIRROR[id] : positions[id]) ?? DEFAULTS[id];
  /* The fraction goes out raw and `.dov-disp` multiplies it by the authored box
     (`--dov-href`/`--dov-vref` in desk-widget.css). Percentages of the live stage
     would move every tile the moment the stage grew for a stack, which is the
     whole reason the stage could not grow before. */
  const place = (id: string) =>
    ({ ['--dov-l' as string]: at(id).left, ['--dov-t' as string]: at(id).top }) as React.CSSProperties;
  /* Resolved by the widget (see `slabPlacement`): beside the monitor it feeds,
     by RULE — nobody authors this position, which is the open question in the
     2026-09-09 review (a person cannot move the computer anywhere in the app),
     stepping aside when a screen already holds that spot. */
  const slab = slabAt;

  const switcher = (to: 'pc1' | 'pc2', label: string) =>
    !canSwitch
      ? {}
      : {
          className: ' is-activate',
          role: 'button',
          tabIndex: 0,
          title: label,
          'aria-label': label,
          onClick: (e: React.MouseEvent) => {
            onSwitch(to);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSwitch(to);
            }
          },
        };

  const mac = switcher('pc1', `Switch the active computer to ${pc1Name}`);
  const tree = switcher('pc2', `Switch the Treehouse 32 KVM to the ${pc2Name}`);
  const gaming = switcher('pc2', `Switch the active computer to ${pc2Name}`);

  return (
    <div
      className={'dov-stage' + (mirror ? ' is-mirror' : '')}
      ref={stageRef}
      style={need > 0 ? ({ ['--dov-need' as string]: `${need}px` } as React.CSSProperties) : undefined}
    >
      {mirror && <span className="dsa-mirror-badge">Mirrored — all displays show the same image</span>}

      {/* The desk, wrapped so one transform can zoom all of it at once. The badge
          above stays outside: it labels the stage, it is not furniture on it. */}
      <div
        className="dov-group"
        style={
          {
            transform: `translate(${groupOff.x}px, ${groupOff.y}px) scale(${fit})`,
            // Published so the writing can divide itself back out of the zoom
            // (`.dov-name` / `.dov-tag`). The zoom is a property OF THE GROUP.
            '--dov-fit': fit,
          } as React.CSSProperties
        }
      >
        {/* The desk they stand on (2026-09-23, Cindy «선없는 판으로 가자»): no line —
            a line read as one more divider — just light pooling on the surface
            and each device's contact shadow (`.dov-shot::after`). Drawn at the
            floor every tile stands on (`standOnFloor`), so if a tile ever left
            that floor it would visibly float instead of quietly drifting. */}
        {/* Its height is the room left under the floor, so the light has faded by
            the stage's edge instead of being cut there (a clipped glow is a line). */}
        {floor && (
          <div
            className="dov-floor"
            aria-hidden="true"
            style={{
              left: floor.left,
              width: floor.width,
              top: floor.top,
              height: need > 0 ? Math.max(20, Math.min(110, (need - groupOff.y) / (fit || 1) - floor.top)) : undefined,
            }}
          />
        )}
        {/* OMEN OLED 27 — always MacBook's utility screen */}
        {onDesk.has('oled-27') && (
        <div className={'dov-monitor dov-disp d-omen' + up('oled-27')} style={place('oled-27')}>
          <Shot id="oled-27" />
          <span className="dov-name">OMEN OLED 27</span>
        </div>
        )}

        {/* The MacBook — captioned `MacBook` again since 2026-09-21 (Cindy, after
            the flow audit: «MacBook으로 바꾸고»). From 2026-09-01 it read
            `Built-in Display` (SPEC: desk-stage §7) so the card would be a roster
            of SCREENS; but everywhere else the same laptop is `MacBook` — the
            Admin desk, Gear Switch, My Devices, the hand-off badge — and a laptop
            IS the computer, screen and all. With `Built-in Display` here, picking
            `1 monitor · 2 computers` drew no computer called MacBook, and the
            blue caption that means "the keyboard is on the MacBook" named a
            screen. `Built-in Display` stays in the Arrange window only, which
            arranges screens in the OS's own words. */}
        {onDesk.has('builtin') && (
        <div {...mac} className={'dov-laptop dov-disp d-mac' + (mac.className ?? '') + up('builtin')} style={place('builtin')}>
          <Shot id="builtin" />
          <span className="dov-name">{pc1Name}</span>
        </div>
        )}

        {/* Treehouse 32 — shared screen, built-in 2-host KVM */}
        <div {...tree} className={'dov-monitor dov-disp d-tree' + (tree.className ?? '') + up('treehouse-32')} style={place('treehouse-32')}>
          {/* The hub's mark, and it does not blink out when the roster changes:
              the Treehouse 32 is always on this desk, so whatever is plugged
              into its hub always has a tile to sit on. */}
          <GearPill where="hub" />
          {/* No tag on the photograph and no chip under the name (2026-09-13,
              Cindy's review of this page). One fact — which computer the
              keyboard reaches — was drawn five times on this card: the gear
              pill, the accent on the active computer's name, the `KVM` tag on
              the screen, the computer-name chip under it, and the sentence in
              the footer. The pill and the accent stay: they are the two that
              say it without words. */}
          <Shot id="treehouse-32" />
          <span className="dov-name">Treehouse 32</span>
        </div>

        {/* The second computer — a tower since 2026-09-03; not a display, so it keeps its place
            beside the monitor it feeds (Cindy, 2026-07-29).
            Drawn only when the desk HAS a second computer (2026-09-02). It used
            to be furniture that never left, so `PCs 1` and `PCs 2` produced the
            same picture — the axis moved the Connectivity tab and nothing here. */}
        {/* Since 2026-09-08 the tower stands whenever it is on the desk — the
            Admin row lists hardware now, so "second computer" and "tower" are
            no longer the same question: a desk can have the tower alone. */}
        {hasTower() && (
        <div
          {...gaming}
          className={'dov-disp d-slab' + (gaming.className ?? '')}
          style={{ ['--dov-l' as string]: slab.left, ['--dov-t' as string]: slab.top } as React.CSSProperties}
        >
          {/* Anything plugged straight into a computer belongs on that
              computer, not on a screen — this is the home the old binary
              never had. Nothing ships `direct` today, so this renders empty
              until a SKU says otherwise. */}
          <GearPill where="direct" />
          <div className="dov-slab"><LaptopGlyph /></div>
          <span className="dov-name">{pc2Name}</span>
        </div>
        )}
      </div>
    </div>
  );
}

export function DeskWidget() {
  const { displayArrange, setDisplayArrange, kvm, setKvm, deskDevices } = useSettings();
  const navigate = useNavigate();

  // Read, not picked by hand: the Gear Switch routing decides the appearance —
  // KVM when the keyboard is handed to the second computer (pc2), Direct
  // otherwise, including "set up but keyboard on the MacBook", which looks the
  // same as never-set-up because it IS the same desk.
  const kvmActive = kvm.configured && kvm.activePc === 'pc2';
  const state = readArrangement(displayArrange);
  const mirror = state.mode === 'mirror';
  const stageRef = useRef<HTMLDivElement>(null);

  /**
   * The box the saved fractions are measured against — `--dov-vref`/`--dov-href`
   * on the stage, NOT the live stage. Read once from the tokens so CSS and this
   * component cannot disagree about what a fraction means.
   *
   * This is the whole reason the stage may now grow: a `top` of 0.5 lands at the
   * same place whether the card is 248px tall or 346, so making room for a second
   * row no longer moves the first one. Before, the two were the same number, and
   * the only way to fit a stack was to draw the desk smaller — which took the
   * writing down with it (measured 2026-08-20: 11px drawn at 8.9px).
   */
  const [ref, setRef] = useState({ v: 0, h: 0, pad: 16 });
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const read = () => {
      const v = tokenPx(stage, '--dov-vref', 0);
      const h = tokenPx(stage, '--dov-href', 0);
      const pad = tokenPx(stage, STAGE_INSET_TOKEN, 16);
      // A zero is never a real reading — it is a hidden tab or a page still
      // painting, and taking it flips the desk back to unresolved defaults
      // (observed 2026-08-06 on the retired map).
      if (!(v > 0) || !(h > 0)) return;
      setRef((cur) => (Math.abs(cur.v - v) > 0.5 || Math.abs(cur.h - h) > 0.5 || cur.pad !== pad ? { v, h, pad } : cur));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);
  // A stored layout passes through the overlap limit before this card draws it
  // — same rule, same frame convention as the modal hero (see healOverlap in
  // ../devices/arrangement.ts). This card is also the writer that can PRODUCE a
  // burial (free placement below), so the commit runs through it too.
  const saved = useMemo(
    () =>
      hasStoredLayout(displayArrange)
        ? // Stood on the desk after healing: the saved heights are not drawn,
          // only the saved rows are (see standOnFloor, 2026-09-23).
          standOnFloor(healOverlap(state.positions, photoTile, ref.h, ref.v), photoTile, ref.v, ref.h)
        : defaultsFor(ref.v, photoTile, ref.h),
    // `deskDevices`: the desk is read through `visibleDisplays()` (localStorage),
    // so React needs telling — same hole the hero had (2026-09-23).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayArrange, ref.v, ref.h, deskDevices],
  );
  /* The saved layout, full stop — there is no live drag layer any more. */
  const positions = saved;

  /**
   * Where the clamshell stands. Resolved ONCE here so the tile that is drawn and
   * the box `boxes` measures are the same box — they used to compute the offset
   * separately, which is how a slab could be drawn on top of a screen while the
   * height maths reported a desk that fit.
   */
  const slabAt = useMemo(
    () => slabPlacement(mirror ? MIRROR : positions, photoTile, ref.h, ref.v, SLAB_ART, BELOW_TILE,
                        computerSide(displayArrange)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, mirror, ref.h, ref.v, displayArrange],
  );
  const floorSpan = useMemo(() => {
    const span = deskSpan(mirror ? MIRROR : positions, photoTile, ref.h,
      hasTower() ? { left: slabAt.left * ref.h, w: SLAB_ART.w } : undefined);
    // The pool reaches past the outer devices so it fades out on the desk, not at them.
    return span && ref.v > 0 ? { left: span.left - span.width * 0.35, width: span.width * 1.7, top: DESK_FLOOR * ref.v } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, mirror, ref.h, ref.v, slabAt, displayArrange]);

  /**
   * Every box on the desk, in the authored space the fractions live in. One
   * helper because three things now need the same rectangles: how tall the card
   * has to be, which captions have to change sides, and (through fitScale) the
   * zoom of last resort.
   *
   * The clamshell is in here too. It is not a display, so the layout maths knows
   * nothing about it — and it sits to the RIGHT of the widest monitor, exactly
   * where a desk runs out of stage. Left out, it was clipped by 54px (measured
   * 2026-08-18; the retired Perform map had the same gap).
   */
  /* The tower's NAME is wider than the tower (58px of `OMEN 35L` over a 30px
     box), and the name is centred on it — so a desk fitted to the box alone put
     the box flush with the stage edge and cut the last 11px of the name off
     (measured 2026-09-21 at 1440: box right = stage right = 887, name right =
     898 → `OMEN 3`). The displays never hit this because every display is wider
     than its caption. Measured from the drawn caption (layout width, so the
     zoom does not feed back into it) and charged symmetrically. */
  const [slabCapW, setSlabCapW] = useState(0);
  // Same idea for the keyboard·mouse badge ABOVE the Treehouse 32 — the room it
  // needs over the desk, in layout px (badge + the gap its stub spans). Read by
  // `need` (the card grows for it) and by the fit (the desk leaves room for it).
  const [ioH, setIoH] = useState(0);
  useLayoutEffect(() => {
    const st = stageRef.current;
    const w = st?.querySelector<HTMLElement>('.d-slab .dov-name')?.offsetWidth ?? 0;
    setSlabCapW((cur) => (Math.abs(cur - w) > 0.5 ? w : cur));
    const pill = st?.querySelector<HTMLElement>('.dov-io-pill');
    const h = pill && st ? pill.offsetHeight + tokenPx(st, '--gutter-xs', 8) : 0;
    setIoH((cur) => (Math.abs(cur - h) > 0.5 ? h : cur));
  });
  const boxes = useMemo(() => {
    if (!(ref.v > 0) || !(ref.h > 0)) return null;
    const pos = mirror ? MIRROR : positions;
    const slabW = Math.max(SLAB_BOX.w, slabCapW);
    const extra = { left: slabAt.left * ref.h - (slabW - SLAB_BOX.w) / 2, top: slabAt.top * ref.v, w: slabW, h: SLAB_BOX.h };
    const rects = visibleDisplays().map((d) => {
      const p = pos[d.id] ?? DEFAULTS[d.id];
      const s = photoTile(d.id);
      const l = p.left * ref.h;
      const tp = p.top * ref.v;
      return { id: d.id, l, r: l + s.w, t: tp, b: tp + s.h };
    });
    const all = [...rects, { id: '__slab', l: extra.left, r: extra.left + extra.w, t: extra.top, b: extra.top + extra.h }];
    return { extra, rects, all };
  }, [positions, mirror, ref.v, ref.h, slabAt, slabCapW]);

  /**
   * How tall the card has to be for this desk to be drawn at full size.
   *
   * From fitScale's own inequality, solved for the height instead of the zoom.
   * The desk is centred on hardware + caption (`CARD_AURA`), so the caption row
   * is charged once: a fit of 1 needs `H ≥ deskHeight + captionRow + 2·inset`.
   * Published as `--dov-need`, and since 2026-09-13 the stage SPENDS exactly this
   * (SPEC desk-stage 6, "무대 높이는 내용을 따른다") — it used to floor at the
   * authored 248px and a one-row desk sat in 73px of air. `--dov-vref` is still
   * the box the saved fractions are measured against; it never changes.
   * Capped: past MAX_STAGE the card would be taller than the section that holds
   * it, so beyond that the desk shrinks again and the counter-scale on the
   * writing takes over.
   */
  const MAX_STAGE = 480;
  const need = useMemo(() => {
    if (!boxes || mirror) return 0;
    const bH = Math.max(...boxes.all.map((r) => r.b)) - Math.min(...boxes.all.map((r) => r.t));
    return Math.min(MAX_STAGE, Math.round(bH + 2 * ref.pad + BELOW_TILE + ioH));
  }, [boxes, mirror, ref.pad, ioH]);

  /**
   * Which captions hang ABOVE their tile: a display with hardware directly below
   * it and nothing directly above. Same rule as the hero's (2026-08-20) — see
   * `.dov-disp.label-up` for why a caption changes sides instead of the rows
   * moving apart. Boxed in on both sides, it stays below: flipping it up would
   * trade one collision for the same one.
   */
  const labelUp = useMemo(() => {
    const up = new Set<string>();
    if (!boxes || mirror) return up;
    for (const a of boxes.rects) {
      let below = false;
      let above = false;
      for (const b of boxes.all) {
        if (b.id === a.id) continue;
        if (b.r <= a.l || b.l >= a.r) continue; // no shared column, no collision
        if (b.t >= a.b - 1 && b.t - a.b < BELOW_TILE) below = true;
        if (b.b <= a.t + 1 && a.t - b.b < BELOW_TILE) above = true;
      }
      if (below && !above) up.add(a.id);
    }
    return up;
  }, [boxes, mirror]);

  // The zoom of last resort: the stage grows first, so this stays 1 for any desk
  // the card can make room for. It still moves for a desk too WIDE for 672px,
  // which no amount of height fixes. The desk sits centred either way — centring
  // is a paint-time property of each surface, not something stored, because the
  // editor writes a layout parked at its own inset and cannot know what a reader
  // will do to fit it.
  const [fit, setFit] = useState(1);
  const [groupOff, setGroupOff] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    // ⚠️ FROZEN WHILE A DRAG IS LIVE, and this one line is the difference between
    // a desk you can move and one that looks broken. Centring is computed FROM the
    // positions, so with the drag feeding new positions every pointer move, the
    // group slid back by however far the tile had gone: measured 2026-08-20 on the
    // handed-over implementation, dragging a tile 90px left produced 4px of net
    // travel, and Cindy read that in the browser as "드래그했는데 아예 안 움직인다".
    // The retired hero drag carried the same guard for the same reason; it did not
    // come across with the rest of the port, so it is spelled out here.
    // Releasing re-runs this effect through `onCommit`, which is where the desk is
    // supposed to settle back to the middle.
     // Runs unconditionally now: the "don't re-centre mid-drag" guard that used
    // to sit here had nothing left to guard once placement moved to the Arrange
    // window (2026-09-01).
    const stage = stageRef.current;
    if (!stage || !boxes) return;
    const measure = () => {
      const pos = mirror ? MIRROR : positions;
      /* The keyboard·mouse badge stands ABOVE the Treehouse 32 (`.dov-io-pill`,
         bottom = tile top + gutter-xs), and nothing reserved that room: on a
         MacBook + tower desk the fit put the monitor 2px under the stage top and
         the badge was cut by 26px (measured 2026-09-21). Its height is layout px
         inside the zoomed group, so the room it needs on screen is that times
         the zoom — the zoom from the last pass, which settles in one more. */
      const ioRoom = ioH * fit;
      const aura = { ...CARD_AURA, top: Math.max(CARD_AURA.top, ioRoom) };
      const s = mirror ? 1 : fitScale(stage, pos, photoTile, BELOW_TILE, ref.v, boxes.extra, ref.h, CARD_MAX_ZOOM, aura);
      setFit((f) => (Math.abs(f - s) > 0.005 ? s : f));
      const off = deskOffset(stage, pos, s, photoTile, ref.v, boxes.extra, ref.h, aura);
      if (!off) return;
      setGroupOff((o) => (Math.abs(o.x - off.x) > 1 || Math.abs(o.y - off.y) > 1 ? off : o));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, mirror, boxes, ref.v, ref.h, fit, ioH]);

  /* Placement moved OUT of this card on 2026-09-01 (Cindy). It had come here on
     2026-08-21 when the hero's drag retired, which left the app with two ways to
     place a display — dragging here and the `Arrange` window this card already
     links to — against our own "one editor" call from 2026-08-19.

     Three things went with the drag, and each was a reason to remove it rather
     than dress it: a tile carried two meanings split only by a 4px threshold
     (move vs switch computer), keyboard users could not move anything at all
     (no tabindex, no arrow keys), and touch dragged the page instead of the
     tile. The `Arrange` window is a real editing surface and already handles
     all three. What Cindy asked this card for on 2026-08-21 was to SHOW how the
     light falls on the desk — that job is untouched. */

  const activeName = kvmActive ? deskHosts()[1] : deskHosts()[0];

  return (
    <WidgetShell
      title="Desk"
      /* Editing lives in one place. This is the door to it, not a second one —
         and now the door opens ONTO the editor rather than into the room next to
         it (Cindy, 2026-08-19: "왜 Arrange 버튼을 누르면 그 디바이스 디스플레이
         메뉴로 가는 거야? … 그 팝업 창이 뜬다거나").

         Before, this landed on the monitor modal's desk-map hero and left the
         user to find `Arrange` there and press it again — the button named the
         destination but delivered the lobby. `&arrange=1` is the editor's own
         deep link (`DisplayArrange.tsx` reads it on mount), so one press now
         ends where the label promised.

         This does NOT reopen the "two editors" question the 2026-08-18 call
         closed: there is still exactly one ArrangeEditor, mounted by the hero.
         What changed is the length of the path to it. A shortcut into the single
         editor is the opposite of a second editor.

         (A paragraph stood here until 2026-09-08 saying "now that this card
         drags too" the editor owned topology and this card owned spacing. The
         drag left on 2026-09-01 and the paragraph did not — eight days later a
         reviewer read it as the state of the code. This card does not drag;
         spacing is a rule, `SPEC: desk-stage` 3.) The label is the editor's
         own name plus how many screens it opens onto — see `action` below. */
      /* `from=personalize` is the way back. Closing the editor used to leave the
         user standing in the monitor modal — a window they never opened, on the
         way to a job they started from here (Cindy, 2026-08-21). The shortcut
         that brought them in now also says where to put them down. Read once on
         mount by `DisplayArrange.tsx`, so a later sku switch cannot inherit it. */
      /* Dropped on a one-display desk, the same call the hero's own `Arrange`
         makes: there is no arrangement to edit, and an editor opened on one
         screen is a room with nothing in it. The card itself stays — one screen
         still sits somewhere, and watching the light fall on it is what this
         picture was asked for in the first place. */
      action={
        visibleDisplays().length > 1
          ? {
              // The count is the label's whole point (2026-09-08): this desk
              // stands computers as well as screens, the Arrange window moves
              // screens only, and the two pictures disagreeing on how many
              // objects there are was the first thing Cindy asked about
              // (2026-09-03). Say the number here, before the click.
              // `displays`, not `screens` (2026-09-21): the window this opens is
              // titled `Arrange displays`, and so are ALL DISPLAYS and the Smart
              // actions line beside it — one word for one thing on this page.
              label: `Arrange ${visibleDisplays().length} displays`,
              onClick: () => navigate('/?sku=treehouse-32&arrange=1&from=personalize'),
            }
          : undefined
      }
    >
      {/* `two-pc` gates every "which computer" mark in desk-widget.css — the
          accent caption, the halos, the gear pill. One computer = nothing to
          choose between, so no blue on this card (2026-09-21). */}
      <div className={'dov' + (kvmActive ? ' is-kvm' : '') + (hasSecondPc() ? ' two-pc' : '')}>
        <DeskStage
          positions={positions}
          mirror={mirror}
          stageRef={stageRef}
          onSwitch={(pc) => setKvm({ ...kvm, activePc: pc })}
          canSwitch={kvm.configured && hasSecondPc()}
          fit={fit}
          groupOff={groupOff}
          labelUp={labelUp}
          need={need}
          slabAt={slabAt}
          floor={floorSpan}
        />

        {/* One row in the grammar the card's neighbours already use (`.wg-foot`:
            label left, value right — `Brightness  80%` on ALL DISPLAYS, Chris's
            class). It replaced three sentences on 2026-09-13 (Cindy: "글자가 왜
            이렇게 많아"): the closed row still states its value, as the monitor's
            fold rows do (`Protections · All on ›`), and the chevron opens the
            Gear Switch card, where the setup and the explanation live. */}
        {/* Only with two computers (2026-09-21, Cindy: "기어 스위치는 컴퓨터가 두 대
            이상 있어야 되는 거 아니니?"). On a one-computer desk this row read
            `With a second PC ›` — an advert for hardware the desk does not have,
            on the page about the desk you DO have. That condition line stays in
            the monitor window's Connectivity tab, the feature's own home, where
            discovering the KVM is the point (2026-08-20/21). */}
        {hasSecondPc() && (
        <div className="dov-foot">
          <button
            type="button"
            className="wg-foot dov-gear"
            onClick={() => navigate('/?sku=treehouse-32&tab=connectivity&from=personalize')}
            aria-label="Open Gear Switch on the Treehouse 32"
          >
            <span className="ds-text-label">Gear Switch</span>
            <span className="dov-gear-val ds-text-label">
              {kvm.configured ? activeName : 'Set up'}
              <Icon name="chevron-right" size={14} aria-hidden />
            </span>
          </button>
        </div>
        )}
      </div>
    </WidgetShell>
  );
}

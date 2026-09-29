// ══════════════════════════════════════════════════════════════════════════
// X-Ray Port View — Connectivity-tab card + full-screen overlay.
// Ported from the approved Treehouse-monitor design (mechanism v2, 2026-07-13):
// the card shows the rear render + the real port-strip crop with fitted
// hotspots; the overlay lays the mirrored rear render over the screen 1:1 with
// a Transparency slider (port-strip region stays fixed). Hotspot geometry and
// tooltip copy carried over verbatim; controls are library components.
// ══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, Icon, Slider, ToggleButtonGroup, Badge, Ng3Section, Ng3Row, Ng3Label, Tooltip } from '../../components';
import './monitor-xray.css';
import { PORTS, portTip, isOff, isPlugged, type Port, type PortNames } from './ports';
import backUrl from './assets/treehouse32-back.png';
import xrayUrl from './assets/treehouse32-back-stand-xray.png';
import portmapUrl from './assets/xray-portmap-base.png';
import hdmiDefaultUrl from './assets/port-hdmi-default.svg';
import hdmiHoverUrl from './assets/port-hdmi-hover.svg';
import dpDefaultUrl from './assets/port-dp-default.svg';
import dpHoverUrl from './assets/port-dp-hover.svg';

// Both views draw a port the same way (Cindy, 2026-08-06): HDMI and DP from the
// Figma silhouette assets imported above, the rest from the card's `.pmport` CSS
// (white outline → accent outline + 80% fill → glow). The fullscreen overlay
// used to hand-draw its own SVG paths instead; they read as a different shape
// from the map's, and the hand-drawn HDMI tapered where the real opening does
// not. Deleted rather than fixed — the assets already exist (rule 15).

// ── card port map — Cindy's Figma design, node 434:18718, imported verbatim ──
// Frame 836×237: base plate render at (48,45) 740×152 + per-port silhouette
// components at exact Figma positions. State model (Cindy component variants):
// empty = white outline · empty hover = blue outline · plugged = blue outline +
// 80% blue fill · plugged hover = + glow · HDMI/DP = silhouette SVG assets.
//
// Coordinates only. What is plugged into each port, what it is called and what
// it is for all live in `ports.ts` — this table just says where on the plate to
// draw it (2026-08-06; the two views used to keep separate copies of the facts
// and had drifted apart).
const PM = { w: 836, h: 237 } as const;
const PM_GEOM: Record<string, { x: number; y: number; w: number; h: number }> = {
  audio: { x: 86, y: 125, w: 29, h: 29 },
  usbc3: { x: 151, y: 122, w: 17, h: 35 },
  usba2: { x: 204, y: 117, w: 24, h: 45 },
  usba1: { x: 258, y: 117, w: 24, h: 45 },
  usbaKvm: { x: 312, y: 117, w: 24, h: 45 },
  c2: { x: 503, y: 122, w: 17, h: 35 },
  c1: { x: 557, y: 122, w: 17, h: 35 },
  dp1: { x: 609, y: 111, w: 24, h: 57 },
  hdmi2: { x: 667, y: 114, w: 23, h: 51 },
  hdmi1: { x: 722, y: 114, w: 23, h: 51 },
};

// Uncropped-width remap (2026-07-23 Cindy: crop top/bottom only, keep L/R
// margins so the card view matches the dashed callout's framing). PORTMAP stays
// authored in Cindy's Figma frame coords (verbatim, node 434:18718); this remap
// projects them onto the full-width image fill. Derivation: Figma fill was
// 117.45% wide at -8.66% (of the 740×152 window) → content scale to 100% width
// SX = 740/869.13; vertical fill 190.02% at -49.15% → new 162.3% at -32.9%
// keeps the port row at the same window height (SY = 246.67/288.83).
const RM = { sx: 0.85142, sy: 0.85404, ox: 64.08, oy: 74.71, ty: -50.01 } as const;
const rmX = (x: number) => 48 + (x - 48 + RM.ox) * RM.sx;
const rmY = (y: number) => 45 + (y - 45 + RM.oy) * RM.sy + RM.ty;

/**
 * One port on the map — Cindy's component variants, converted to our CSS.
 *
 * The hover card stays (2026-08-20: taken out for one afternoon and put back
 * the same day, Cindy — *"우리 티칭 팁처럼 information 떴었잖아. 그거 왜 없앴어?"*).
 * Removing it was fixing the wrong thing: the tooltip was being painted over by
 * the panel's tab strip, and the cause was two lines of our own CSS, not the
 * tooltip. `.pm` carried a `transform`, which opens a stacking context and traps
 * every popup inside it below a LATER sibling — `.ds-ng3-tab`, z-index 1 —
 * however high the popup's own z-index is (measured: the tab's chamfer across a
 * 26px band, x589-823, cutting the tip's title row). Same failure the mode bar
 * has written down two files over (monitor-canvas.css `.mb-bar`, the
 * backdrop-filter version of it). The offset is now `top`, which needs no
 * stacking context, and the crop no longer clips — so the card can teach again.
 *
 * `hi` = pointed at from outside (a `RENAME INPUTS` row hovered or focused). It
 * re-uses the hover drawing rather than inventing a second selected look, so
 * pointing at a name and pointing at a port light the same lamp.
 */
function PMPortBox({
  port, limited, hi, names, onHover,
}: {
  port: Port; limited: boolean; hi?: boolean; names?: PortNames;
  onHover?: (id: string | null) => void;
}) {
  const g = PM_GEOM[port.id];
  const off = isOff(port, limited);
  const pct = (v: number, base: number) => `${(v / base) * 100}%`;
  const style = {
    left: pct(rmX(g.x), PM.w), top: pct(rmY(g.y), PM.h),
    width: pct(g.w * RM.sx, PM.w), height: pct(g.h * RM.sy, PM.h),
  };
  // `isPlugged`, not the `connected` literal: a computer that is not on this
  // desk has nothing in its port (ports.ts, 2026-09-21).
  const plugged = isPlugged(port) && !off;
  const cls = 'pmport pm-' + port.kind + (plugged ? ' plug' : '') + (off ? ' off' : '')
    + (hi ? ' is-hi' : '');
  const hover = onHover
    ? { onMouseEnter: () => onHover(port.id), onMouseLeave: () => onHover(null) }
    : undefined;
  if (port.kind === 'hdmi' || port.kind === 'dp') {
    const [def, hov] = port.kind === 'hdmi'
      ? [hdmiDefaultUrl, hdmiHoverUrl] : [dpDefaultUrl, dpHoverUrl];
    return (
      <div className={cls} style={style} {...hover}>
        <img className="pmp-img-default" src={def} alt="" />
        <img className="pmp-img-hover" src={hov} alt="" />
        {plugged && <span className="pmp-fill" />}
        <PortTipCard port={port} limited={limited} names={names} />
      </div>
    );
  }
  return (
    <div className={cls} style={style} {...hover}>
      <span className="pmp-stroke" />
      <span className="pmp-glow" />
      {plugged && <span className="pmp-fill" />}
      <PortTipCard port={port} limited={limited} names={names} />
    </div>
  );
}

/**
 * A port's hover card — the design system's own tooltip, not a bespoke one.
 * The port used to carry `data-tip` and paint the box from `::before` in our
 * CSS: a hand-drawn tooltip carried over from the pre-library mockup, which
 * had drifted from the DS (no arrow, 10px type, pure black) and read as a
 * different component beside the DS tooltips on the same screen.
 *
 * The Tooltip component is not the right shape here — it renders its own
 * relative wrapper, and each port is absolutely placed from Figma coordinates
 * (spec 6/8), so wrapping would move the anchor. This is the library's other
 * documented form for exactly that case: drop `.ds-tooltip-popup` inside an
 * already-positioned item and drive it from that item's hover, the same way
 * the nav menu does (Menu.tsx + `.ds-menu.has-tips` in shared/components.css).
 * The `.pm-tip-*` classes only lay out rows INSIDE that popup — the box, arrow,
 * blur and colours are all still the library's. Checked before adding them:
 * `shared/components.css` and `web/src/components/` have the tooltip as a
 * single run of text, with no row/label-value form to reuse.
 *
 * Both views render this same card from the same `portTip()` (2026-08-06). The
 * map used to show a single line while the fullscreen view showed the detail —
 * so the small view was the one that couldn't answer "what is this for", which
 * is backwards: the map is where you look first.
 * aria-hidden: the rows repeat what the panel already states in text.
 */
function PortTipCard({ port, limited, names }: { port: Port; limited: boolean; names?: PortNames }) {
  const t = portTip(port, { limited, names });
  return (
    <span className="ds-tooltip-popup top pm-tip" aria-hidden="true">
      <span className="pm-tip-title">{t.title}</span>
      {t.warn && (
        <span className="pm-tip-warn">
          <Icon name="alert" size={12} aria-hidden /> {t.warn}
        </span>
      )}
      {t.rows.map((r) => (
        <span className="pm-tip-row" key={r.label}>
          <span>{r.label}</span>
          <span>{r.value}</span>
        </span>
      ))}
    </span>
  );
}

// ── overlay hotspots ────────────────────────────────────────────────────────
// `left`/`top` are the port's CENTRE in image-percent (`.xhot` carries
// translate(-50%,-50%)); `w`/`h` are the aperture itself, because the silhouette
// SVG fills this box — a generous hit area would show up as a blue shape
// spilling off the port.
//
// Every number below was measured off the runtime render's own pixels
// (2026-08-06: aperture edges in the 66–69% band, PIL column profile), not
// carried over. The render's right-hand bank had moved ~1% left of where the old
// coordinates put it, so those blue fills were landing on bare metal.
//
// Order is left→right ON THE MIRRORED RENDER, which is why HDMI comes first: the
// fullscreen view is the back of the display seen THROUGH the screen (SPEC: xray
// #3), so left and right are swapped relative to the card's port map.
// Coordinates only — see `ports.ts` for what each port IS.
const XRAY_GEOM: Record<string, { cx: number; cy: number; w: number; h: number }> = {
  hdmi1: { cx: 39.33, cy: 68.15, w: 0.59, h: 2.09 },
  hdmi2: { cx: 41.17, cy: 68.15, w: 0.56, h: 2.09 },
  dp1: { cx: 43.15, cy: 68.07, w: 0.66, h: 2.36 },
  c1: { cx: 45.02, cy: 68.15, w: 0.39, h: 1.47 },
  c2: { cx: 46.85, cy: 68.15, w: 0.39, h: 1.47 },
  usbaKvm: { cx: 53.44, cy: 68.12, w: 0.59, h: 2.09 },
  usba1: { cx: 55.30, cy: 68.12, w: 0.59, h: 2.09 },
  usba2: { cx: 57.12, cy: 68.12, w: 0.61, h: 2.09 },
  usbc3: { cx: 59.02, cy: 68.15, w: 0.37, h: 1.47 },
  audio: { cx: 61.02, cy: 68.15, w: 0.66, h: 0.92 },
};

const INFO_TIP =
  "Point your monitor's camera at the back to see port locations in real time. Only works when viewing from this monitor.";

/**
 * Connectivity hero — the rear render with the dashed port-region callout on it
 * (Cindy, 2026-07-30). The canvas swaps its hero per tab (Chris's own pattern),
 * so Connectivity trades the arrangement diagram for the back of the display:
 * the ports are that tab's subject. Clicking the callout opens the full-screen
 * X-ray, which already owns the 1:1 port detail — which is what frees the whole
 * panel below for controls.
 *
 * Render, callout and their measurements are the card's own
 * `.xrb / .xrb-wrap / .port-hl` — reused, not restyled.
 */
export function XrayHero({ skuName }: { skuName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* `.dc-hero-fig` is the canvas's shrink-wrapped figure: it hugs the
          rendered image so percentage-anchored overlays track the photo at any
          hero height (Chris built it for the keyboard's button callouts). That is
          exactly what the dashed callout needs — the card's fixed-height wrapper
          would either clip the port region or slide the dashes off-center. */}
      <div className="xr-hero">
        <div className="dc-hero-fig">
          <img src={backUrl} alt={`${skuName} rear`} />
          <button
            type="button"
            className="port-hl"
            aria-label="Open the full-screen X-ray port view"
            onClick={() => setOpen(true)}
          />
        </div>
        {/* Cindy's port map (Figma 434:18718) — re-homed from the retired
            in-panel card (2026-08-02, Cindy). Same markup, so the Figma-verbatim
            geometry renders identically; the callout hover → arrow + white glow
            link lives inside this container now. This hero variant is not inside
            the Connectivity panel, so it has no Port-power state to read. */}
        <div className="pm xr-hero-pm" aria-label="Rear port map">
          <span className="pm-arrow" aria-hidden />
          <div className="pm-basewrap">
            <img className="pm-base" src={portmapUrl} alt="" />
          </div>
          {PORTS.map((p) => (
            <PMPortBox key={p.id} port={p} limited={false} />
          ))}
        </div>
      </div>
      {open && <XrayOverlay skuName={skuName} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * PROTOTYPE 2026-08-04 — the port map back in the panel, where it can have the
 * full width. It left the panel because the hero was showing a big rear render
 * and the two drew the same ports twice; now the hero shows the arrangement
 * with the selected display turned around, so that duplication is gone.
 *
 * The labelled `X-ray view` button comes back with it. It existed on the old
 * card shell and disappeared when the shell went unused — nothing ever decided
 * to remove it, and a dashed rectangle on a photo is not a control.
 */
export function PortMapPanel({
  skuName,
  limited = false,
  names,
  hoverId = null,
  onHover,
  children,
}: {
  skuName: string;
  /** Port power = Limited: the hub ports show as switched off. */
  limited?: boolean;
  /** Names the user typed under "Rename Inputs", keyed by port id. */
  names?: PortNames;
  /**
   * The port being pointed at anywhere on the tab (2026-08-20, Cindy). Owned by
   * ConnectivityTab, not here, because two cards read and write it: hovering a
   * `RENAME INPUTS` row lights that port on this plate, and the plate's own
   * hovers light the detail line. A first pass moved the rename rows INTO this
   * card to get that link — reverted same day (Cindy): a card split into two
   * zones is not a library pattern. The cards stay what the library says a card
   * is; only the pointing state is shared.
   */
  hoverId?: string | null;
  onHover?: (id: string | null) => void;
  /** Rows that belong to the rear panel, arriving folded (2026-08-24 sketch).
   *  NOT the zone split tried and reverted on 2026-08-20: these come in as
   *  `.mt-fold` ROWS — the shape OLED Care already uses — so the card stays a
   *  stack of rows instead of a card cut into regions. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /**
   * No entry animation here (tried and removed 2026-08-04, Cindy). The plate
   * flying in from the tile in the hero was built and looked wrong for a reason
   * worth keeping written down: Rear ports is its own section INSIDE the
   * Connectivity panel, so a plate that arrives from outside the panel crosses a
   * boundary the layout has already drawn. The turn in the hero carries the
   * relationship on its own; the plate just belongs where it sits.
   * The hover link stays (`.dsa-port-mark`, display-arrange.css): pointing at
   * the strip on demand costs nothing and needs no motion.
   */
  return (
    <Ng3Section>
      {/* `Ng3Row`, not the old `.dm-row` (2026-08-04, Cindy). `.dm-row` has no
          rule anywhere in the repo — repo-wide *.css grep, 0 definitions — so
          the button was not placed, it just followed the label and read as more
          label text rather than a control (a ghost button has no chrome at
          rest). The library row already means "label left, action right", and
          the Smart Actions section in this same panel already uses it. */}
      <Ng3Row className="xr-head">
        {/* Same shape as MonitorTabs' InfoTip (not imported — that would cycle:
            MonitorTabs already imports PortMapPanel from here). A title ⓘ only
            stays when it has something to say (2026-08-08, Cindy); this one
            names the map's invisible affordance. */}
        {/* The ⓘ is gone (2026-08-20). Its whole sentence was "Hover a port to
            see what plugs in there" — an announcement for an invisible
            affordance. The list and the detail line below now say it by being
            there, so the tooltip had no information left of its own, which is
            when the icon goes too and not just the words (copy-rules 5, the
            2026-08-08 ⓘ cleanup rule). */}
        <Ng3Label strong>Rear ports</Ng3Label>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          X-ray view
        </Button>
      </Ng3Row>
      {/* The plate is a picture, not a door (2026-09-22, Cindy — reversing
          2026-08-24). For four weeks the plate ALSO opened X-ray on click and
          rang on hover; the labelled button above is the one door now. Two
          doors to one place read as two places, and a photograph does not
          announce that it is a control. */}
      <div className="pm-crop">
        <div className="pm pm-panel" aria-label="Rear port map">
          <div className="pm-basewrap">
            <img className="pm-base" src={portmapUrl} alt="" />
          </div>
          {PORTS.map((p) => (
            <PMPortBox
              key={p.id}
              port={p}
              limited={limited}
              hi={hoverId === p.id}
              names={names}
              onHover={onHover}
            />
          ))}
        </div>
      </div>
      {/* No caption line under the plate (tried 2026-08-20, removed the same
          day — Cindy: *"밑에 텍스트 가독성이 너무 떨어져, 어느 부분을 설명하는
          건지 이해가 안 되니까"*). It was a line of text at the card's edge
          pointing at a 20px port 100px away, so it never said WHICH port it
          meant. The hover card says that by being attached to the port. */}
      {children}
      {open && (
        <XrayOverlay skuName={skuName} limited={limited} names={names} onClose={() => setOpen(false)} />
      )}
    </Ng3Section>
  );
}

/**
 * ⚠️ Unused since 2026-07-31 — the rear render moved to the hero (XrayHero) and
 * port detail lives in the full-screen view. 2026-08-02: the port map found its
 * home in the hero, and 2026-08-06 the Port-power ↔ map wiring — the last thing
 * this shell still owned — moved up to ConnectivityTab, which is where the
 * Limited toggle actually lives. **Nothing here is reachable now.**
 * Deleting it is cleanup pending Cindy approval (rule 19③).
 */
export function XrayCard({ skuName }: { skuName: string }) {
  const [open, setOpen] = useState(false);
  const [power, setPower] = useState('Full');
  return (
    <section className="xr" aria-label="X-ray port view">
      {/* header — native section label + actions (matches the other modal tabs) */}
      <div className="dm-row xr-head">
        <p className="dm-field-label" style={{ margin: 0 }}>X-Ray Port View</p>
        <div className="xr-actions">
          {/* ⓘ = the library's own trigger + tooltip pairing (the same one
              Input.tsx and PowerThermal.tsx use), not a hand-drawn box. This
              button used to carry `data-tip` and paint the tip from `::after`
              in our CSS — another mockup-era tooltip that had drifted (no
              arrow, pure black, its own type size). No absolute-position
              constraint here, so this is the wrapped-component form; the port
              map next to it needs the other form (see PortTip above).
              No `size` on the Icon: `.ds-tooltip-trigger svg` sizes it. */}
          <Tooltip content={INFO_TIP} placement="bottom">
            <button type="button" className="ds-tooltip-trigger" aria-label="X-ray view info">
              <Icon name="info" />
            </button>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>X-ray view</Button>
        </div>
      </div>

      {/* rear render with centered rear-ports callout */}
      <div className="xrb">
        <div className="xrb-wrap">
          <img src={backUrl} alt={`${skuName} rear`} />
          {/* hover the callout → the port map below lights up + an arrow (placed
              down by the map, not under the cursor) points at it. Pure CSS —
              .xr:has(.port-hl:hover) drives the glow/arrow, no JS state. */}
          <div className="port-hl" aria-hidden />
        </div>
      </div>

      {/* power mode — native field row */}
      <div className="dm-row xr-pm">
        <p className="dm-field-label" style={{ margin: 0 }}>Power mode</p>
        <ToggleButtonGroup aria-label="Power mode" value={power} onChange={setPower}
          options={[{ label: 'Full', value: 'Full' }, { label: 'Limited', value: 'Limited' }]} />
      </div>

      {/* Cindy's port map (Figma 434:18718) — base plate + shaped ports, no box.
          Lights up when the rear-ports callout on the render is hovered (CSS :has). */}
      <div className="pm">
        <span className="pm-arrow" aria-hidden />
        <div className="pm-basewrap">
          <img className="pm-base" src={portmapUrl} alt="Rear port map" />
        </div>
        {PORTS.map((p) => (
          <PMPortBox key={p.id} port={p} limited={power === 'Limited'} />
        ))}
      </div>

      {/* active-connection summary — per-port detail is in the map above; KVM in Gear Switch */}
      <div className="dm-row xr-foot">
        <span className="dm-note">Connected to <strong>MacBook</strong> · 3840 × 2160 · 240 Hz</span>
        <span className="xr-badges">
          <Badge variant="status" tone="info"><Icon name="bolt" size={9} aria-hidden /> Thunderbolt 4</Badge>
          <Badge variant="status" tone="positive"><Icon name="check" size={9} aria-hidden /> Calibrated</Badge>
        </span>
      </div>

      {open && <XrayOverlay skuName={skuName} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Full-screen X-ray — 1:1 mirrored rear render seen THROUGH the desktop. */

/**
 * How much of the rear panel shows through the screen at rest (0–1).
 *
 * 2026-09-23 (Jaewoo 1:1 → Cindy picked the recommended preview,
 * `design-assets/xray-depth-2026-09-23/`): X-ray means seeing past the thing in
 * front, so the thing in front — your own desktop — has to read first and the
 * panel behind it has to read as behind. At the old 0.7 the panel covered the
 * desktop and the overlay read as "the screen turned into a photo of the back".
 * 0.35 + a light blur keeps the panel's outline and the stand as a reference
 * for WHERE a port sits, without pulling it to the front.
 */
const PANEL_REST = 0.35;
/** The slider says how see-through the panel is, so its number is 1 − opacity. */
const toTransparency = (opacity: number) => Math.round((1 - opacity) * 100);

/** The demo desktop's clock reads the real time — a fixed 2023 date read as a mock-up. */
function deskClock(now: Date) {
  return {
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    date: now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
  };
}

function XrayOverlay({
  skuName,
  onClose,
  limited = false,
  names,
}: {
  skuName: string;
  onClose: () => void;
  limited?: boolean;
  names?: PortNames;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const fixRef = useRef<HTMLDivElement>(null);
  const [tr, setTr] = useState(toTransparency(PANEL_REST));
  const [clock] = useState(() => deskClock(new Date()));
  const closingRef = useRef(false);

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The library's own curve, read from the token rather than copied (rule 15).
  const ease = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--ease-default').trim() ||
    'cubic-bezier(0.4, 0, 0.2, 1)';

  /**
   * Entry — rebuilt 2026-09-23 on top of the 2026-08-06 rules, which still hold:
   * `fill: 'backwards'` on every track (no first-frame flash), tracks that end
   * together, and near things settling before far things (that gap IS the depth).
   *
   * What changed: the panel no longer climbs to full opacity and falls back.
   * That 0 → 1 → 0.7 ramp was the one round trip the 08-06 rules still allowed,
   * and with a 0.35 rest it would be a flash of the whole back followed by a
   * fade — the "prototype" feel Cindy named. Now every track goes one way:
   *   desktop   eases down a touch (it stays readable; the taskbar is not in it)
   *   panel     fades in from nothing while it comes out of a deep blur
   *   port block  arrives first and sharp — it is what you came for
   *   port marks  land last, after the picture they belong to
   *   chrome    is there from the start (0.15s), only the picture arrives
   * Runs ~3.2s all in (Cindy 2026-09-24: the 2.2s cut went by too fast — each
   * phase has to be seen as deliberate).
   * `prefers-reduced-motion` skips it and lands on the rest state.
   */
  useEffect(() => {
    const back = backRef.current;
    if (!back) return;
    document.body.style.overflow = 'hidden';
    const restore = () => { document.body.style.overflow = ''; };

    if (reducedMotion()) {
      back.style.opacity = String(PANEL_REST);
      setTr(toTransparency(PANEL_REST));
      return restore;
    }
    const EASE = ease();
    const root = rootRef.current;

    const anim = back.animate(
      [{ opacity: 0 }, { opacity: PANEL_REST }],
      { duration: 1400, delay: 100, easing: EASE, fill: 'backwards' },
    );
    // (Opacity lands early on purpose: the sweep below is what should be seen
    // arriving, not a fade that hides it for the first half second.)
    // The panel arrives top-to-bottom through the soft-edged mask in the CSS
    // (`.xray-back`). One way, no line: the picture itself is the sweep.
    const revealAnim = back.animate(
      [{ maskPosition: '0 100%', webkitMaskPosition: '0 100%' } as Keyframe, { maskPosition: '0 0%', webkitMaskPosition: '0 0%' } as Keyframe],
      { duration: 2400, delay: 100, easing: EASE, fill: 'backwards' },
    );
    const deskAnim = deskRef.current?.animate(
      [{ filter: 'brightness(1)' }, { filter: 'brightness(0.85)' }],
      { duration: 1800, easing: EASE, fill: 'both' },
    );
    // Rest filter lives in the CSS (`.xray-back .xr-img`); the keyframes end on
    // exactly that value so nothing snaps when the animation lets go.
    // Transform only — the panel's blur is static in the CSS. Animating a
    // filter re-renders the whole image every frame; a scale settling from
    // 1.03 to 1 is composited and reads as the same "coming into place".
    const farAnim = back.querySelector('.xr-img')?.animate(
      [
        { transform: 'translateX(-50%) scale(1.03)' },
        { transform: 'translateX(-50%) scale(1)' },
      ],
      { duration: 2700, easing: EASE, fill: 'backwards' },
    );
    // The lens settles once the reveal has passed the port block (~86vh ≈ 1.3s):
    // it comes in at its resting tone (the CSS opacity) and sharpens from a blur.
    const nearAnim = fixRef.current?.animate(
      [{ opacity: 0 }, { opacity: 0.4 }],
      { duration: 900, delay: 2000, easing: EASE, fill: 'backwards' },
    );
    const lensAnim = root?.querySelector('.xray-lens')?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 900, delay: 2150, easing: EASE, fill: 'backwards' },
    );
    const hotsAnim = root?.querySelector('.xhots')?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 700, delay: 2500, easing: EASE, fill: 'backwards' },
    );
    // Controls are the user's, not the scene's (Cindy 2026-09-24: they came in
    // after 1.1s and the screen read as loading). They are simply there,
    // almost at once; only the picture arrives.
    const chromeAnims = [...(root?.querySelectorAll('.xray-chrome') ?? [])].map((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 150, easing: EASE, fill: 'backwards' }),
    );
    // Parallax starts once the picture has settled, so it never fights the
    // entry transforms. Max 4px either way; the lens window does not move.
    let parallaxOn = false;
    let raf2 = 0;
    const onMove = (e: PointerEvent) => {
      if (!parallaxOn || !root) return;
      cancelAnimationFrame(raf2);
      raf2 = requestAnimationFrame(() => {
        const px = (e.clientX / window.innerWidth - 0.5) * 8;
        const py = (e.clientY / window.innerHeight - 0.5) * 8;
        root.style.setProperty('--px', `${px.toFixed(2)}px`);
        root.style.setProperty('--py', `${py.toFixed(2)}px`);
      });
    };
    root?.addEventListener('pointermove', onMove);
    revealAnim.onfinish = () => { parallaxOn = true; };

    let raf = 0;
    const tick = () => {
      setTr(toTransparency(parseFloat(getComputedStyle(back).opacity)));
      if (anim.playState === 'running') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    anim.onfinish = () => { back.style.opacity = String(PANEL_REST); setTr(toTransparency(PANEL_REST)); };
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      root?.removeEventListener('pointermove', onMove);
      [anim, revealAnim, deskAnim, farAnim, nearAnim, lensAnim, hotsAnim, ...chromeAnims].forEach((a) => a?.cancel());
      restore();
    };
  }, []);

  /**
   * Leaving mirrors arriving instead of cutting: the scene fades out as one
   * piece, quickly — you have found the port, so the way back should not make
   * you wait. A second Esc/click while it runs is ignored.
   */
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const root = rootRef.current;
    if (!root || reducedMotion()) { onClose(); return; }
    const out = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: ease(), fill: 'forwards' });
    out.onfinish = onClose;
  };

  // Esc closes the X-ray first (capture phase, so the device modal underneath
  // doesn't close on the same keypress — DeviceModalHost listens on bubble).
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  const setTransparency = (v: number) => {
    setTr(v);
    if (backRef.current) backRef.current.style.opacity = String((100 - v) / 100);
  };

  // Portal to <body>: the modal shell's backdrop-filter creates a containing
  // block that would trap position:fixed — the overlay must own the viewport.
  return createPortal(
    <div className="xray-ov" role="dialog" aria-label={`${skuName} X-ray port view`} ref={rootRef}>
      {/* demo desktop wallpaper (Windows default look) — dims slightly; the taskbar is not in here */}
      <div className="xray-desk" ref={deskRef}>
        <div className="xd-swirl" />
      </div>

      {/* rear panel (opacity = 1 − Transparency) — mirrored, 1:1 */}
      <div className="xray-back" ref={backRef}>
        <img className="xr-img" src={xrayUrl} alt={`${skuName} rear panel, seen through the display`} />
      </div>
      {/* same image, seen through the lens over the port block — fixed
          regardless of Transparency. The lens grows when the pointer comes
          near (the zone) or lands on a port; the ring is its edge. */}
      <div className="xray-fix" aria-hidden="true" ref={fixRef}>
        <img className="xr-img xr-soft" src={xrayUrl} alt="" />
        <img className="xr-img xr-sharp" src={xrayUrl} alt="" />
      </div>
      <div className="xray-zone" aria-hidden="true" />
      <div className="xray-lens" aria-hidden="true" />

      {/* Hotspots over the real ports (mirrored-image coordinates).
          Same port vocabulary as the card's port map (Cindy, 2026-08-06): the
          `.pmport` markup and classes are reused verbatim, so a port says the
          same thing in both places — white outline when empty, accent outline +
          fill when something is plugged in, glow on hover. HDMI and DP use
          the same Figma silhouette assets the map does rather than a hand-drawn
          path; `.xhots` flips them back, since this render is mirrored. */}
      <div className="xhots">
        {PORTS.map((p) => {
          const g = XRAY_GEOM[p.id];
          const off = isOff(p, limited);
          const plugged = isPlugged(p) && !off;
          return (
            <div
              key={p.id}
              className={`xhot pmport pm-${p.kind}` + (plugged ? ' plug' : '') + (off ? ' off' : '')}
              style={{ left: `${g.cx}%`, top: `${g.cy}%`, width: `${g.w}%`, height: `${g.h}%` }}
              tabIndex={0}
              aria-label={p.label}
            >
              {p.kind === 'hdmi' || p.kind === 'dp' ? (
                <>
                  <img className="pmp-img-default" src={p.kind === 'hdmi' ? hdmiDefaultUrl : dpDefaultUrl} alt="" />
                  <img className="pmp-img-hover" src={p.kind === 'hdmi' ? hdmiHoverUrl : dpHoverUrl} alt="" />
                  {/* The Figma silhouette set has no "plugged" variant — the card
                      map never had an HDMI or DP in use, so the case never came
                      up. Here two of them ARE in use, and a white outline would
                      read as empty, so the fill goes in behind the silhouette.
                      Outline colour still can't follow (it lives in the asset);
                      that half is a question for Cindy. */}
                  {plugged && <span className="pmp-fill" />}
                </>
              ) : (
                <>
                  <span className="pmp-stroke" />
                  <span className="pmp-glow" />
                  {plugged && <span className="pmp-fill" />}
                </>
              )}
              <PortTipCard port={p} limited={limited} names={names} />
            </div>
          );
        })}
      </div>

      {/* Taskbar — the front-most part of the desktop, so it sits ABOVE the
          panel at full strength (Cindy, 2026-09-23: "밑에 메뉴 창이 확실하게").
          Scenery standing in for Windows; the glyphs are the library's own. */}
      <div className="xd-task" aria-hidden="true">
        <div className="xd-wx">24°C<br />Sunny</div>
        <div className="xd-apps">
          <span className="xd-search"><Icon name="search" size="sm" />Search</span>
          <span className="xd-app"><Icon name="browser" size="sm" /></span>
          <span className="xd-app"><Icon name="folder" size="sm" /></span>
          <span className="xd-app"><Icon name="mail" size="sm" /></span>
          <span className="xd-app"><Icon name="media-player" size="sm" /></span>
          <span className="xd-app"><Icon name="settings" size="sm" /></span>
        </div>
        <div className="xd-clock">{clock.time}<br />{clock.date}</div>
      </div>

      {/* chrome — always visible regardless of transparency */}
      <div className="xray-chrome xray-pill xray-close-wrap">
        <Button variant="ghost" size="sm" className="xray-close" onClick={close}>
          <Icon name="close" size="sm" />
          Close X-ray
        </Button>
      </div>
      <div className="xray-chrome xray-pill xray-tr">
        <label htmlFor="xray-transparency">Transparency</label>
        <Slider id="xray-transparency" min={0} max={100} value={tr} onChange={setTransparency} aria-label="Transparency" />
        <span className="xr-tr-val">{tr}</span>
      </div>
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════════════════
// X-Ray Port View — Connectivity-tab card + full-screen overlay.
// Ported from the approved Treehouse-monitor design (mechanism v2, 2026-07-13):
// the card shows the rear render + the real port-strip crop with fitted
// hotspots; the overlay lays the mirrored rear render over the screen 1:1 with
// a Transparency slider (port-strip region stays fixed). Hotspot geometry and
// tooltip copy carried over verbatim; controls are library components.
// ══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Icon, Slider, ToggleButtonGroup, Badge } from '../../components';
import './monitor-xray.css';
import backUrl from './assets/treehouse32-back.png';
import xrayUrl from './assets/treehouse32-back-stand-xray.png';
import portmapUrl from './assets/xray-portmap-base.png';
import hdmiDefaultUrl from './assets/port-hdmi-default.svg';
import hdmiHoverUrl from './assets/port-hdmi-hover.svg';
import dpDefaultUrl from './assets/port-dp-default.svg';
import dpHoverUrl from './assets/port-dp-hover.svg';

// Port-opening silhouettes — one shape component per connector type, matching
// the Figma originals (which are shaped per port, not generic rectangles). The
// SVG fills its hotspot box (preserveAspectRatio none) so it hugs the real port
// in the render; stroke stays crisp via non-scaling-stroke. Fill/stroke states
// (empty-hover ring / connected fill / disabled outline) come from the CSS.
type PortShape = 'hdmi' | 'dp' | 'usbc' | 'usba' | 'audio';
function PortGlyph({ shape }: { shape: PortShape }) {
  switch (shape) {
    case 'hdmi': // near-square, chamfered bottom corners (HDMI silhouette)
      return (
        <svg className="pg" viewBox="0 0 26 26" preserveAspectRatio="none" aria-hidden>
          <path className="pg-shape" vectorEffect="non-scaling-stroke" d="M2 2H24V16L18 24H8L2 16Z" />
        </svg>
      );
    case 'dp': // portrait rectangle with one keyed (beveled) top corner
      return (
        <svg className="pg" viewBox="0 0 22 30" preserveAspectRatio="none" aria-hidden>
          <path className="pg-shape" vectorEffect="non-scaling-stroke" d="M7 2H20V28H2V7Z" />
        </svg>
      );
    case 'usbc': // portrait fully-rounded pill
      return (
        <svg className="pg" viewBox="0 0 20 30" preserveAspectRatio="none" aria-hidden>
          <rect className="pg-shape" vectorEffect="non-scaling-stroke" x="1.5" y="1.5" width="17" height="27" rx="8.5" />
        </svg>
      );
    case 'usba': // portrait rounded rectangle
      return (
        <svg className="pg" viewBox="0 0 20 26" preserveAspectRatio="none" aria-hidden>
          <rect className="pg-shape" vectorEffect="non-scaling-stroke" x="1.5" y="1.5" width="17" height="23" rx="2.5" />
        </svg>
      );
    case 'audio': // 3.5mm jack circle
      return (
        <svg className="pg" viewBox="0 0 24 24" preserveAspectRatio="none" aria-hidden>
          <circle className="pg-shape" vectorEffect="non-scaling-stroke" cx="12" cy="12" r="10.5" />
        </svg>
      );
  }
}

// ── card port map — Cindy's Figma design, node 434:18718, imported verbatim ──
// Frame 836×237: base plate render at (48,45) 740×152 + per-port silhouette
// components at exact Figma positions. State model (Cindy component variants):
// empty = white outline · empty hover = blue outline · plugged = blue outline +
// 80% blue fill · plugged hover = + glow · HDMI/DP = silhouette SVG assets.
// `dis` = USB hub port that Limited power mode turns off.
const PM = { w: 836, h: 237 } as const;
type PMKind = 'audio' | 'usbc' | 'usba' | 'hdmi' | 'dp';
interface PMPort {
  kind: PMKind; x: number; y: number; w: number; h: number;
  plug?: boolean; dis?: boolean; tip: string; tipLimited?: string;
}
const PORTMAP: PMPort[] = [
  { kind: 'audio', x: 86, y: 125, w: 29, h: 29, tip: '3.5mm audio out' },
  { kind: 'usbc', x: 151, y: 122, w: 17, h: 35, dis: true, tip: 'USB-C 3 · Empty', tipLimited: 'USB-C 3 · Off (USB hub disabled)' },
  { kind: 'usba', x: 204, y: 117, w: 24, h: 45, dis: true, tip: 'USB-A 2 · Empty', tipLimited: 'USB-A 2 · Off (USB hub disabled)' },
  { kind: 'usba', x: 258, y: 117, w: 24, h: 45, dis: true, tip: 'USB-A 1 · Empty', tipLimited: 'USB-A 1 · Off (USB hub disabled)' },
  { kind: 'usba', x: 312, y: 117, w: 24, h: 45, plug: true, tip: 'USB dongle · Keyboard & mouse (KVM)' },
  { kind: 'usbc', x: 503, y: 122, w: 17, h: 35, plug: true, tip: 'USB-C C2 → MacBook · Laptop + charging' },
  { kind: 'usbc', x: 557, y: 122, w: 17, h: 35, tip: 'USB-C C1 · DP Alt Mode · Empty' },
  { kind: 'dp', x: 609, y: 111, w: 24, h: 57, tip: 'DisplayPort · Empty' },
  { kind: 'hdmi', x: 667, y: 114, w: 23, h: 51, tip: 'HDMI 2 · Empty' },
  { kind: 'hdmi', x: 722, y: 114, w: 23, h: 51, tip: 'HDMI 1 · Empty' },
];

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

/** One port on the map — Cindy's component variants, converted to our CSS. */
function PMPortBox({ p, off }: { p: PMPort; off: boolean }) {
  const pct = (v: number, base: number) => `${(v / base) * 100}%`;
  const style = {
    left: pct(rmX(p.x), PM.w), top: pct(rmY(p.y), PM.h),
    width: pct(p.w * RM.sx, PM.w), height: pct(p.h * RM.sy, PM.h),
  };
  const cls = 'pmport pm-' + p.kind + (p.plug ? ' plug' : '') + (off ? ' off' : '');
  const tip = off && p.tipLimited ? p.tipLimited : p.tip;
  if (p.kind === 'hdmi' || p.kind === 'dp') {
    const [def, hov] = p.kind === 'hdmi'
      ? [hdmiDefaultUrl, hdmiHoverUrl] : [dpDefaultUrl, dpHoverUrl];
    return (
      <div className={cls} style={style} data-tip={tip}>
        <img className="pmp-img-default" src={def} alt="" />
        <img className="pmp-img-hover" src={hov} alt="" />
      </div>
    );
  }
  return (
    <div className={cls} style={style} data-tip={tip}>
      <span className="pmp-stroke" />
      <span className="pmp-glow" />
      {p.plug && <span className="pmp-fill" />}
    </div>
  );
}

// ── overlay hotspots (mirrored-image coordinates, left→right) ───────────────
interface XPort {
  left: number; top: number; w: number; h: number; shape: PortShape; on?: boolean;
  title: string; warn?: string; rows: [string, string][];
}
const XRAY_PORTS: XPort[] = [
  { left: 38.5, top: 68.5, w: 1.3, h: 1.7, shape: 'audio', title: '3.5mm Audio Out',
    rows: [['Use for', 'Headphones & speakers'], ['Status', 'Empty']] },
  { left: 40.5, top: 68.5, w: 0.8, h: 2.3, shape: 'usbc', title: 'USB-C 3.2 Gen2', warn: 'Disabled in Limited mode',
    rows: [['Use for', 'USB devices'], ['Speed', '10Gbps'], ['Status', 'Empty']] },
  { left: 42.3, top: 68.5, w: 1.25, h: 3.1, shape: 'usba', title: 'USB-A 3.2 Gen2', warn: 'Disabled in Limited mode',
    rows: [['Use for', 'USB devices + KVM'], ['Speed', '10Gbps'], ['Status', 'Empty']] },
  { left: 44.1, top: 68.5, w: 1.25, h: 3.1, shape: 'usba', title: 'USB-A 3.2 Gen2', warn: 'Disabled in Limited mode',
    rows: [['Use for', 'USB devices + KVM'], ['Speed', '10Gbps'], ['Status', 'Empty']] },
  { left: 46.05, top: 68.5, w: 1.25, h: 3.1, shape: 'usba', on: true, title: 'USB-A 3.2 Gen2',
    rows: [['Use for', 'USB devices + KVM'], ['Connected', 'Keyboard & mouse dongle'], ['Status', 'KVM · Active']] },
  { left: 53.6, top: 68.5, w: 0.8, h: 2.3, shape: 'usbc', title: 'USB-C Thunderbolt 4',
    rows: [['Use for', 'Laptop + 90W charging'], ['Speed', '40Gbps'], ['Status', 'Empty']] },
  { left: 55.4, top: 68.5, w: 0.8, h: 2.3, shape: 'usbc', on: true, title: 'USB-C Thunderbolt 4',
    rows: [['Use for', 'Laptop + 90W charging'], ['Speed', '40Gbps'], ['Status', 'MacBook · Active']] },
  { left: 57.4, top: 68.5, w: 1.3, h: 3.1, shape: 'dp', on: true, title: 'DisplayPort 1.4',
    rows: [['Use for', 'PCs'], ['Speed', '32.4Gbps'], ['Status', 'Gaming Laptop · Active']] },
  { left: 59.4, top: 68.5, w: 1.3, h: 3.1, shape: 'hdmi', title: 'HDMI 2.1',
    rows: [['Use for', 'Consoles & PCs'], ['Speed', '48Gbps'], ['Status', 'Empty']] },
  { left: 61.4, top: 68.5, w: 1.3, h: 3.1, shape: 'hdmi', on: true, title: 'HDMI 2.1',
    rows: [['Use for', 'Consoles & PCs'], ['Speed', '48Gbps'], ['Status', 'Console · Active']] },
];

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
          would either clip the port region or slide the dashes off-centre. */}
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
            link lives inside this container now. `off` is always false here:
            the Limited link needs ConnectivityTab's Port-power state lifted
            (follow-up — see the card comment below). */}
        <div className="pm xr-hero-pm" aria-label="Rear port map">
          <span className="pm-arrow" aria-hidden />
          <div className="pm-basewrap">
            <img className="pm-base" src={portmapUrl} alt="" />
          </div>
          {PORTMAP.map((p, i) => (
            <PMPortBox key={i} p={p} off={false} />
          ))}
        </div>
      </div>
      {open && <XrayOverlay skuName={skuName} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * ⚠️ Unused since 2026-07-31 — the rear render moved to the hero (XrayHero) and
 * port detail lives in the full-screen view. 2026-08-02: the port map found its
 * home — Cindy chose to re-mount it in the hero (see XrayHero above), so the
 * one thing this shell still owns is the Port-power ↔ map `off` wiring below
 * (the hero renders `off=false` until that state is lifted out of
 * ConnectivityTab). Removing the shell = cleanup pending Cindy approval.
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
          <button type="button" className="xr-tipable" aria-label="X-ray view info" data-tip={INFO_TIP}>
            <Icon name="info" size={15} aria-hidden />
          </button>
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
        {PORTMAP.map((p, i) => (
          <PMPortBox key={i} p={p} off={power === 'Limited' && !!p.dis} />
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

/** Full-screen X-ray — 1:1 mirrored rear render over a demo desktop. */
function XrayOverlay({ skuName, onClose }: { skuName: string; onClose: () => void }) {
  const backRef = useRef<HTMLDivElement>(null);
  const [tr, setTr] = useState(70);

  // Entry animation from the approved design: fade the see-through panel
  // 0 → 1 (55%) → 0.7 over 2.2s, keeping the slider in sync while it runs.
  useEffect(() => {
    const back = backRef.current;
    if (!back) return;
    document.body.style.overflow = 'hidden';
    const anim = back.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.55 }, { opacity: 0.7 }],
      { duration: 2200, easing: 'ease-in-out' },
    );
    let raf = 0;
    const tick = () => {
      setTr(Math.round(parseFloat(getComputedStyle(back).opacity) * 100));
      if (anim.playState === 'running') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    anim.onfinish = () => { back.style.opacity = '0.7'; setTr(70); };
    return () => { cancelAnimationFrame(raf); anim.cancel(); document.body.style.overflow = ''; };
  }, []);

  // Esc closes the X-ray first (capture phase, so the device modal underneath
  // doesn't close on the same keypress — DeviceModalHost listens on bubble).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const setTransparency = (v: number) => {
    setTr(v);
    if (backRef.current) backRef.current.style.opacity = String(v / 100);
  };

  // Portal to <body>: the modal shell's backdrop-filter creates a containing
  // block that would trap position:fixed — the overlay must own the viewport.
  return createPortal(
    <div className="xray-ov" role="dialog" aria-label={`${skuName} X-ray port view`}>
      {/* demo desktop backdrop (Windows default apps) */}
      <div className="xray-desk">
        <div className="xd-swirl" />
        <div className="xd-task">
          <div className="xd-wx">24°C<br />Sunny</div>
          <div className="xd-search">Search</div>
          <div className="ti c1" /><div className="ti" /><div className="ti c2" /><div className="ti" /><div className="ti c3" />
          <div className="xd-clock">11:00 AM<br />09/26/2023</div>
        </div>
      </div>

      {/* rear panel (opacity = Transparency) — mirrored, 1:1 */}
      <div className="xray-back" ref={backRef}>
        <img className="xr-img" src={xrayUrl} alt={`${skuName} rear panel, seen through the display`} />
      </div>
      {/* same image, port-strip region only, fixed regardless of Transparency */}
      <div className="xray-fix" aria-hidden="true">
        <img className="xr-img" src={xrayUrl} alt="" />
      </div>

      {/* hotspots over the real ports (mirrored-image coordinates) */}
      <div className="xhots">
        {XRAY_PORTS.map((p, i) => (
          <div key={i} className={'xhot' + (p.on ? ' on' : '')}
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.w}%`, height: `${p.h}%` }}>
            <PortGlyph shape={p.shape} />
            <div className="xtip">
              <div className="xtip-title">{p.title}</div>
              {p.warn && (
                <div className="xtip-warn"><Icon name="alert" size={12} aria-hidden /> {p.warn}</div>
              )}
              {p.rows.map(([k, v]) => (
                <div className="xtip-row" key={k + v}><span>{k}</span><span>{v}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* chrome — always visible regardless of transparency */}
      <Button variant="ghost" className="xray-close" onClick={onClose}>Close X-ray</Button>
      <div className="xray-tr">
        <label htmlFor="xray-transparency">Transparency</label>
        <Slider id="xray-transparency" min={0} max={100} value={tr} onChange={setTransparency} aria-label="Transparency" />
        <span className="xr-tr-val">{tr}</span>
      </div>
    </div>,
    document.body,
  );
}

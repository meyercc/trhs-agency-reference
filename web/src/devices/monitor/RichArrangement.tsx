// ══════════════════════════════════════════════════════════════════════════
// Rich Arrangement HERO — the monitor modal's identity / overview area.
//
// Register decision B (2026-07-22, consultant review with Cindy): the app shows
// "the display set" in two deliberate registers —
//   • photoreal (HERE)  = IDENTIFICATION / desirability, scoped to THIS device
//   • schematic (Perform DeviceOverview / Personalize) = arrangement + routing + KVM
// So this HERO is READ-ONLY and deliberately DROPS the routing / topology /
// desktop-level actions it used to carry (KVM routing tag, EXTEND/MIRROR toggle,
// Save-as-profile). Those live on the schematic surfaces, which stay the single
// source of truth for "which computer is active" — removing the two-places-
// can-disagree AI-zone risk.
//
// Roster = the display set (v3): Treehouse 32 (this display) · Built-in (MacBook)
// · OMEN OLED 27. The Gaming Laptop is a KVM host (a non-display) → NOT shown
// here; it lives on the schematic Device Overview where routing belongs.
//
// Composition matches the Canvas "Home" original (borderless photoreal row, names
// below, per-device hover detail): design-loop/refs/arrangement-home-*.png.
//
// ⚠ Detailed visual expression is NOT final — direction only. Specifics (View-
// ports link placement, hover vs persistent detail, whether "this display" is
// sized up) land at the Thursday sub-design review (chris-sync #2).
// ══════════════════════════════════════════════════════════════════════════
import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '../../components';
import './monitor-arrangement.css';
import treehouseUrl from './assets/treehouse32-front-tight.png';
import macbookUrl from './assets/macbook-front-generic.png';
import oled27Url from './assets/omen-oled27-front.png';

interface ArInfo {
  conn: string;
  res: string;
  hz: string;
  state: string;
  extra?: string;
}
interface ArDisplay {
  name: string;
  sub: string;
  img: string;
  kind: 'monitor' | 'laptop';
  thisDisplay?: boolean;
  info: ArInfo; // per-device identity/status shown on hover — NOT routing
}

const DISPLAYS: ArDisplay[] = [
  {
    name: 'Treehouse 32', sub: '4K · 240Hz', img: treehouseUrl, kind: 'monitor', thisDisplay: true,
    info: { conn: 'USB-C / Thunderbolt 4', res: '3840 × 2160', hz: '240 Hz', state: 'Active' },
  },
  {
    name: 'Built-in Display', sub: 'MacBook', img: macbookUrl, kind: 'laptop',
    info: { conn: 'Thunderbolt', res: '3456 × 2234', hz: '120 Hz', state: 'Active', extra: 'Charging' },
  },
  {
    name: 'OMEN OLED 27', sub: 'OLED', img: oled27Url, kind: 'monitor',
    info: { conn: 'DisplayPort', res: '2560 × 1440', hz: '240 Hz', state: 'Active' },
  },
];

export function RichArrangement() {
  const navigate = useNavigate();
  return (
    <section className="mar" aria-label="Displays">
      <div className="ar-stage">
        {DISPLAYS.map((d) => (
          <div key={d.name} className={'ar-dev' + (d.thisDisplay ? ' this' : '')}>
            <div className={'ar-render ar-' + d.kind}>
              {d.thisDisplay && <span className="ar-thisdisplay">◇ THIS DISPLAY</span>}
              <img src={d.img} alt={d.name} className={'ar-img ar-img-' + d.kind} />
              <div className="ar-tip" role="tooltip">
                <span className="ar-tip-conn">{d.info.conn}</span>
                <span className="ar-tip-row"><span>Resolution</span><b>{d.info.res}</b></span>
                <span className="ar-tip-row"><span>Refresh rate</span><b>{d.info.hz}</b></span>
                <span className="ar-tip-tags">
                  <span className="ar-tip-state">{d.info.state}</span>
                  {d.info.extra && <span className="ar-tip-extra">{d.info.extra}</span>}
                </span>
              </div>
            </div>
            <div className="ar-name">
              <b>{d.name}</b>
              <span>{d.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* read-only wayfinding only — per-device Identify + link out to where
          arrangement editing lives (Personalize). No topology/profile actions. */}
      <div className="mar-foot">
        {/* NOTE: no size="sm" — `.ds-btn.sm` binds height to an undefined token
            (--control-height-sm), collapsing the button to text height so the
            hover sheen looks cramped/off-center. Default (md) = --control-height
            (32px). Library gap flagged to Chris (chris-sync). */}
        <Button variant="ghost">
          <Icon name="devices" size={14} aria-hidden /> Identify
        </Button>
        <Button variant="ghost" onClick={() => navigate('/personalize')}>
          Open arrangement <span aria-hidden>→</span>
        </Button>
      </div>
    </section>
  );
}

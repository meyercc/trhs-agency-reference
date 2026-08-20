import { useState } from 'react';
import { ModalShell, Toggle, ToggleButtonGroup } from '../../components';
import type { NbMode } from '../perform5/NetworkBoosterCard';

// ── Network Booster Detail modal (PerformV7) ──
// V7 fork of the V5 modal. Two changes, nothing else:
//   1. width="narrow" — a single-subject modal stops spanning the whole window,
//      and the narrow shell centres on both axes.
//   2. The Off/Auto/Custom switch moves OUT of the bottom of the body and INTO
//      the header's right-hand end, via ModalShell's `headerControl`. It governs
//      what the entire body means, so it belongs where surface-scope things live
//      — the same position a card's title row reserves for card-scope elements.
// Everything below the header is the V5 content unchanged.

interface AppRow {
  name: string;
  down: string;
  up: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}
const APPS: AppRow[] = [
  { name: 'Heroes of the Storm', down: '7334 kbps', up: '30 kbps', priority: 'HIGH' },
  { name: 'Google Chrome', down: '1290 kbps', up: '11 kbps', priority: 'MEDIUM' },
  { name: 'Spotify', down: '0 kbps', up: '0 kbps', priority: 'MEDIUM' },
  { name: 'UStream', down: '322 kbps', up: '5 kbps', priority: 'LOW' },
];

interface IfaceProps {
  kind: 'ethernet' | 'wifi';
  name: string;
  ip: string;
  mac: string;
  cap: string;
}
function Iface({ kind, name, ip, mac, cap }: IfaceProps) {
  return (
    <div className="pv5-nbm-iface">
      <div className="pv5-nbm-iface-head">
        <span className="pv5-nbm-iface-kind">{kind === 'wifi' ? 'WI-FI' : 'ETH'}</span>
        <span className="pv5-nbm-iface-name">{name}</span>
      </div>
      <div className="pv5-nbm-kv"><span>IP Address</span><b>{ip}</b></div>
      <div className="pv5-nbm-kv"><span>MAC Address</span><b>{mac}</b></div>
      <div className="pv5-nbm-kv"><span>Hardware Max Capacity</span><b>{cap}</b></div>
    </div>
  );
}

export interface NetworkBoosterModalProps {
  mode: NbMode;
  onMode: (m: NbMode) => void;
  onClose?: () => void;
}

export function NetworkBoosterModal({ mode, onMode, onClose }: NetworkBoosterModalProps) {
  const [dualForce, setDualForce] = useState(true);
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

  const headerControl = (
    <ToggleButtonGroup
      options={[
        { label: 'Off', value: 'off' },
        { label: 'Auto', value: 'auto' },
        { label: 'Custom', value: 'custom' },
      ]}
      value={mode}
      onChange={(v) => onMode(v as NbMode)}
      aria-label="Network Booster mode"
    />
  );

  return (
    <ModalShell title="Network Booster" onClose={onClose} className="pv5-nbm" width="narrow" headerControl={headerControl}>
      <div className="pv5-nbm-summary">
        {/* matches the card's live reading: ↓229.3 + ↑13.0 */}
        <span className="pv5-nbm-sum-v">242.3</span>
        <span className="pv5-nbm-sum-u">Mbps total</span>
        <span className="pv5-nbm-sum-meta">{modeLabel} · powered by Realtek Gaming Technology</span>
      </div>

      <div className="pv5-nbm-sect">Interfaces</div>
      <div className="pv5-nbm-ifaces">
        <Iface kind="ethernet" name="Realtek Gaming GbE Family Controller" ip="0.0.0.0" mac="31:13:8b:12:2d:8a" cap="0.00 Mbps" />
        <Iface kind="wifi" name="Intel Wi-Fi 7 BE200 · 320MHz" ip="0.0.0.0" mac="31:13:8b:12:2d:8a" cap="0.11 Mbps" />
      </div>

      <div className="pv5-nbm-dualforce">
        <div className="pv5-nbm-df-head">
          <div>
            <div className="pv5-nbm-df-title">Dual Force</div>
            <div className="pv5-nbm-df-meta">Enables Ethernet and Wi-Fi at the same time.</div>
          </div>
          <Toggle checked={dualForce} onChange={setDualForce} aria-label="Dual Force" />
        </div>
      </div>

      <div className="pv5-nbm-sect">Per-app priority</div>
      <div className="pv5-nbm-table">
        <div className="pv5-nbm-row pv5-nbm-row-head">
          <span>App</span>
          <span>Download</span>
          <span>Upload</span>
          <span>Priority</span>
          <span>Block</span>
        </div>
        {APPS.map((a) => (
          <div className="pv5-nbm-row" key={a.name}>
            <span className="pv5-nbm-app">{a.name}</span>
            <span className="pv5-nbm-num">{a.down}</span>
            <span className="pv5-nbm-num">{a.up}</span>
            <span className={'pv5-nbm-prio pv5-nbm-prio--' + a.priority.toLowerCase()}>{a.priority}</span>
            <span className="pv5-nbm-block">
              <Toggle checked={false} onChange={() => {}} aria-label={`Block ${a.name}`} />
            </span>
          </div>
        ))}
      </div>
      <div className="pv5-nbm-note">Default priority is MEDIUM; blocked apps lose network access.</div>
    </ModalShell>
  );
}

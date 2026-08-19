import { useState } from 'react';
import { Menu, ModalShell } from '../../components';
import { LineGraph } from './LineGraph';

// ── System Vitals detail modal (PerformV5) ──
// Control-and-Status modal, NO interactive image (per the 3-template canon).
// Follows Chris's UnleashModal shell: left identity + a vertical <Menu> that
// navigates the readings (CPU/GPU/RAM/Network/Storage); right = the readings for
// that component + a history LineGraph. Read-only → no footer / commit row.
// Opened from the System Vitals card (MonitoringBar's onOpenTab).

interface Tab {
  id: string;
  label: string;
  stats: [string, string][];
  series: number[];
}

const TABS: Tab[] = [
  { id: 'cpu', label: 'CPU', stats: [['Load', '44%'], ['Temp', '58°C'], ['Clock', '4.8 GHz'], ['Power', '45 W']], series: [30, 42, 38, 50, 44, 47, 44] },
  { id: 'gpu', label: 'GPU', stats: [['Load', '37%'], ['Temp', '60°C'], ['Core', '1853 MHz'], ['Power', '92 W']], series: [55, 48, 52, 40, 37, 42, 37] },
  { id: 'ram', label: 'RAM', stats: [['Used', '18.7 GB'], ['Free', '13.2 GB'], ['Total', '32 GB'], ['Util', '54%']], series: [48, 50, 52, 51, 54, 53, 54] },
  { id: 'network', label: 'Network', stats: [['Down', '229 Mbps'], ['Up', '13 Mbps'], ['Latency', '12 ms']], series: [10, 40, 25, 60, 45, 50, 64] },
  { id: 'storage', label: 'Storage', stats: [['C:', '385 GB free'], ['D:', '13 GB free'], ['E:', '8 GB free']], series: [61, 61, 62, 62, 62, 62, 62] },
];

export interface SystemVitalsModalProps {
  initialTab?: string;
  onClose?: () => void;
}

export function SystemVitalsModal({ initialTab = 'cpu', onClose }: SystemVitalsModalProps) {
  const [tab, setTab] = useState(initialTab);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  const left = (
    <div className="pv5-svm-left">
      <div className="pv5-svm-id-sub">Live hardware telemetry — read-only.</div>
      <div className="pv5-svm-status">
        <span className="pv5-svm-dot" />
        Nominal · updated 2s ago
      </div>
      <Menu
        orientation="vertical"
        aria-label="Readings"
        items={TABS.map((t) => ({ id: t.id, label: t.label, active: t.id === tab, onClick: () => setTab(t.id) }))}
      />
    </div>
  );

  return (
    <ModalShell title="System Vitals" onClose={onClose} className="pv5-svm" left={left}>
      <div className="pv5-svm-head">{active.label}</div>
      <div className="pv5-svm-stats">
        {active.stats.map(([k, v]) => (
          <div className="pv5-svm-stat" key={k}>
            <span className="pv5-svm-stat-l">{k}</span>
            <span className="pv5-svm-stat-v">{v}</span>
          </div>
        ))}
      </div>
      <div className="pv5-svm-graph-head">Last 60s</div>
      <LineGraph data={active.series} height={120} />
    </ModalShell>
  );
}

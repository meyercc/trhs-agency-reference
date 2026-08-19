import { useSettings } from '../state/Settings';
import { toUnit } from '../state/units';
import { Gauge, NetArrow } from './Gauge';
import './vitals.css';

// ── Monitoring bar (.perf-vitals-bar) ──
// The full-width 5-panel system monitor that leads the Perform page: CPU / GPU /
// RAM arc gauges, a Network throughput panel, and a Storage drives panel. Ported
// from the vanilla `.perf-vitals-bar`; reuses the shared <Gauge> + the vitals
// `.vital-label` / `.gauge-temp-badge` / `.net-*` classes.

interface GaugeCellProps {
  load: number;
  label: string;
  /** badge content; CPU/GPU pass a °C value, RAM passes a string like "18.7 GB" */
  tempC?: number;
  badge?: string;
  onOpen?: () => void;
}
function GaugeCell({ load, label, tempC, badge, onOpen }: GaugeCellProps) {
  const { tempUnit } = useSettings();
  const badgeText = badge ?? `${toUnit(tempC!, tempUnit)}°${tempUnit}`;
  const badgeClass = badge ? 'ram' : (tempC ?? 0) >= 80 ? 'orange' : 'green';
  return (
    <div className="pvital-cell" onClick={onOpen} title={`${label} Details`}>
      <Gauge value={load} />
      <span className="vital-label">{label}</span>
      <div className={'gauge-temp-badge ' + badgeClass}>{badgeText}</div>
    </div>
  );
}

interface Drive {
  name: string;
  pct: number;
}
const DRIVES: Drive[] = [
  { name: 'D: · NVMe SSD', pct: 62 },
  { name: 'C: · NVMe SSD', pct: 61 },
];

export interface MonitoringBarProps {
  /** open the System Vitals modal to a given tab (cpu/gpu/ram/network/storage) */
  onOpenTab?: (tab: string) => void;
}

export function MonitoringBar({ onOpenTab }: MonitoringBarProps) {
  return (
    <div className="perf-vitals-bar" title="System monitoring">
      <GaugeCell load={44} label="CPU" tempC={58} onOpen={() => onOpenTab?.('cpu')} />
      <GaugeCell load={37} label="GPU" tempC={60} onOpen={() => onOpenTab?.('gpu')} />
      <GaugeCell load={54} label="RAM" badge="18.7 GB" onOpen={() => onOpenTab?.('ram')} />

      <div className="pvital-cell pvital-net" onClick={() => onOpenTab?.('network')} title="Network Details">
        <div className="pvital-net-stack">
          <div className="pvital-net-row">
            <NetArrow />
            <span className="net-speed">13.0</span>
            <span className="net-unit">Mbps</span>
            <div className="net-minibar">
              <div className="net-minibar-fill" style={{ width: '12%', background: 'var(--green)' }} />
            </div>
          </div>
          <div className="pvital-net-row">
            <NetArrow down />
            <span className="net-speed">229.3</span>
            <span className="net-unit">Mbps</span>
            <div className="net-minibar">
              <div className="net-minibar-fill" style={{ width: '64%', background: 'var(--cyan)' }} />
            </div>
          </div>
        </div>
        <span className="vital-label pvital-corner-label">Network</span>
      </div>

      <div className="pvital-cell pvital-storage" onClick={() => onOpenTab?.('storage')} title="Storage Details">
        <div className="pvital-storage-stack">
          {DRIVES.map((d) => (
            <div className="pvital-storage-item" key={d.name}>
              <div className="storage-drive-label">
                <span className="storage-drive-name">{d.name}</span>
                <span className="storage-drive-pct">{d.pct}%</span>
              </div>
              <div className="storage-bar">
                <div className="storage-bar-fill" style={{ width: `${d.pct}%`, background: 'var(--accent-color)' }} />
              </div>
            </div>
          ))}
        </div>
        <span className="vital-label pvital-corner-label">Storage</span>
      </div>
    </div>
  );
}

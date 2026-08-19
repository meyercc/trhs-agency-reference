import { useSettings } from '../../state/Settings';
import { toUnit } from '../../state/units';
import { Gauge } from '../Gauge';
import '../vitals.css';

// ── System Vitals readout (PerformV5, V5-local) ──
// A V5-local re-author of the shared MonitoringBar. Three hardware readings on
// the glance (CPU / GPU / RAM). Network throughput moved to the Network Booster
// card (the data lives with the feature that shapes it); Storage stays reachable
// in the System Vitals modal's menu. Cells are separated by dividers (not framed
// as sub-cards), each with its label pinned TOP-LEFT (so the metric is
// discoverable before the number); the gauge is vertically centred in the cell.
// Does NOT modify Chris's MonitoringBar; only reuses the shared Gauge primitive
// + vitals.css atoms.

interface GaugeCardProps {
  load: number;
  label: string;
  /** badge content; CPU/GPU pass a °C value, RAM passes a string like "18.7 GB" */
  tempC?: number;
  badge?: string;
  onOpen?: () => void;
}
function GaugeCard({ load, label, tempC, badge, onOpen }: GaugeCardProps) {
  const { tempUnit } = useSettings();
  const badgeText = badge ?? `${toUnit(tempC!, tempUnit)}°${tempUnit}`;
  const badgeClass = badge ? 'ram' : (tempC ?? 0) >= 80 ? 'orange' : 'green';
  return (
    <button type="button" className="pv5-vcard" onClick={onOpen} title={`${label} details`}>
      <span className="pv5-vcard-label">{label}</span>
      <div className="pv5-vcard-gauge">
        <Gauge value={load} />
        <div className={'gauge-temp-badge ' + badgeClass}>{badgeText}</div>
      </div>
    </button>
  );
}

export interface VitalsReadoutProps {
  /** open the System Vitals modal to a given tab (cpu/gpu/ram/network/storage) */
  onOpenTab?: (tab: string) => void;
}

export function VitalsReadout({ onOpenTab }: VitalsReadoutProps) {
  return (
    <div className="pv5-vitals-grid">
      <GaugeCard load={44} label="CPU" tempC={58} onOpen={() => onOpenTab?.('cpu')} />
      <GaugeCard load={37} label="GPU" tempC={60} onOpen={() => onOpenTab?.('gpu')} />
      <GaugeCard load={54} label="RAM" badge="18.7 GB" onOpen={() => onOpenTab?.('ram')} />
    </div>
  );
}

import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components';
import { useSettings } from '../state/Settings';
import { toUnit } from '../state/units';
import { Gauge } from './Gauge';
import './component-status.css';

/**
 * Component status card — a reusable dashboard widget template: a title + model,
 * a status pill (coloured dot + label), an arc gauge (top-right, e.g. temp), and
 * a labelled utilization meter along the bottom. Used for the Processor (CPU) and
 * Graphics (GPU) widgets; drop in more components (RAM, SSD, …) the same way.
 */

export type StatusTone = 'positive' | 'warn' | 'danger' | 'neutral';

export interface ComponentStatusCardProps {
  title: string;
  model: string;
  status: { label: string; tone?: StatusTone };
  /** Arc gauge — `value` (0–100) drives the fill + colour; `display` overrides the
   *  shown number; unit/label render in the centre. */
  gauge: { value: number; display?: number; unit?: string; label?: string };
  /** Bottom meter — a labelled percentage bar. */
  meter: { label: string; value: number };
  onClick?: () => void;
}

export function ComponentStatusCard({ title, model, status, gauge, meter, onClick }: ComponentStatusCardProps) {
  const tone = status.tone ?? 'positive';
  return (
    <div
      className="w cs-card"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
    >
      <div className="cs-top">
        <div className="cs-head">
          <div className="cs-title">{title}</div>
          <div className="cs-model">{model}</div>
          <div className="cs-status">
            <span className={'cs-dot cs-dot-' + tone} aria-hidden="true" />
            <span className="cs-status-label">{status.label}</span>
          </div>
        </div>
        <Gauge className="cs-gauge" value={gauge.value} display={gauge.display} unit={gauge.unit} sublabel={gauge.label} />
      </div>

      <div className="cs-meter">
        <div className="cs-meter-head">
          <span className="cs-meter-label">{meter.label}</span>
          <span className="cs-meter-val">{meter.value}%</span>
        </div>
        <div className="wg-bar cs-bar">
          <div className="wg-bar-fill" style={{ width: `${meter.value}%` }} />
        </div>
      </div>

      {onClick && (
        <span className="cs-chevron" aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
      )}
    </div>
  );
}

/** Processor (CPU) status widget — opens the vitals modal's CPU tab. */
export function CpuStatusWidget() {
  const [, setParams] = useSearchParams();
  const { tempUnit } = useSettings();
  return (
    <ComponentStatusCard
      title="Processor"
      model="AMD Ryzen 9 7950X3D"
      status={{ label: 'Optimal', tone: 'positive' }}
      gauge={{ value: 48, display: toUnit(48, tempUnit), unit: '°', label: tempUnit === 'F' ? 'Fahrenheit' : 'Celsius' }}
      meter={{ label: 'Utilization', value: 87 }}
      onClick={() => setParams({ modal: 'vitals', tab: 'cpu' })}
    />
  );
}

/** Graphics (GPU) status widget — opens the vitals modal's GPU tab. */
export function GpuStatusWidget() {
  const [, setParams] = useSearchParams();
  const { tempUnit } = useSettings();
  return (
    <ComponentStatusCard
      title="Graphics"
      model="NVIDIA GeForce RTX 4080"
      status={{ label: 'Optimal', tone: 'positive' }}
      gauge={{ value: 60, display: toUnit(60, tempUnit), unit: '°', label: tempUnit === 'F' ? 'Fahrenheit' : 'Celsius' }}
      meter={{ label: 'Utilization', value: 42 }}
      onClick={() => setParams({ modal: 'vitals', tab: 'gpu' })}
    />
  );
}

import { useState } from 'react';
import { Badge, Button, Menu, ModalShell } from '../../components';
import { CpuTab } from '../unleash/CpuTab';
import { GpuTab } from '../unleash/GpuTab';
import { MemoryTab } from '../unleash/MemoryTab';
import { ThermalTab } from '../unleash/ThermalTab';
import { AdvancedPowerTab } from '../unleash/AdvancedPowerTab';
import '../unleash-tuning.css';

// ── Unleashed — Advanced Tuning as a Detail Modal ──
// Chris's second modal pattern (OMEN AI / Booster): left identity panel +
// right working console. Left = hero glyph, positioning copy, status row, the
// five-domain tab navigation (Menu vertical), and the L4 considerations
// banner (the approved warning copy). Right = the active domain's control
// group, rendered open (the nav does the disclosure), plus a live-vitals
// strip on CPU/GPU (user decision, supersedes the v7 metric-readout removal;
// Robin's always-visible-vitals constraint). SPG is NOT here — it lives on
// the envelope card under the mode row (user decision, supersedes v7's "SPG
// at top of the Unleashed view").

const BoltIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
    <circle cx="50" cy="50" r="46" stroke="rgba(239,68,68,0.15)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="36" stroke="rgba(239,68,68,0.22)" strokeWidth="1" strokeDasharray="4,3" />
    <polygon
      points="50,13 82,50 50,87 18,50"
      fill="rgba(239,68,68,0.05)"
      stroke="rgba(239,68,68,0.45)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M54 30 L40 54 H50 L46 70 L62 46 H51 L54 30 Z"
      fill="rgba(239,68,68,0.15)"
      stroke="rgba(239,68,68,0.8)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const DOMAINS = [
  { id: 'cpu', label: 'CPU' },
  { id: 'gpu', label: 'GPU' },
  { id: 'memory', label: 'Memory' },
  { id: 'thermal', label: 'Thermal' },
  { id: 'advanced', label: 'Advanced Power' },
];

/** Live vitals strip (CPU / GPU tabs) — .ds-stat-grid from the shared DS. */
function LiveStats({ cells }: { cells: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className="ds-stat-grid pv4-um-vitals">
      {cells.map((c) => (
        <div className="ds-stat-cell" key={c.label}>
          <div className="ds-spark-lbl">{c.label}</div>
          <div className="ds-spark-val" style={c.tone ? { color: `var(--${c.tone})` } : undefined}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

const CPU_VITALS = [
  { label: 'Temp', value: '58°C', tone: 'green' },
  { label: 'Clock', value: '4.8 GHz' },
  { label: 'Voltage', value: '1.21 V' },
  { label: 'Power', value: '45 W', tone: 'cyan' },
];
const GPU_VITALS = [
  { label: 'Temp', value: '60°C', tone: 'green' },
  { label: 'Core', value: '1853 MHz' },
  { label: 'Mem', value: '1872 MHz' },
  { label: 'Power', value: '92 W', tone: 'cyan' },
];

export interface UnleashModalProps {
  onClose?: () => void;
}

export function UnleashModal({ onClose }: UnleashModalProps) {
  const [tab, setTab] = useState('cpu');

  const left = (
    <div className="pv4-um-left">
      <div className="pv4-um-hero">
        <BoltIcon />
      </div>
      <div className="pv4-um-title">Unleashed</div>
      <p className="pv4-um-desc">
        Raises the power and thermal ceiling past the factory-certified line. PBO is auto-enabled and the advanced
        controls below are unlocked — system stability is the user's responsibility.
      </p>
      <div className="pv4-um-status">
        <i aria-hidden="true" />
        <span>Unleashed active</span>
        <span className="pv4-um-status-meta">PBO auto-enabled</span>
      </div>
      <Menu
        orientation="vertical"
        aria-label="Tuning domain"
        items={DOMAINS.map((d) => ({
          id: d.id,
          label: d.label,
          active: tab === d.id,
          onClick: () => setTab(d.id),
        }))}
      />
      <div className="ut-banner warn pv4-um-warn">
        <span className="ut-banner-title">
          <Badge variant="status" tone="warn">L4</Badge>
          Considerations
        </span>
        <span className="ut-banner-copy">
          Improper configuration may pose risks to VRM, battery, or CPU longevity.
        </span>
      </div>
    </div>
  );

  return (
    <ModalShell title="Unleashed — Advanced Tuning" onClose={onClose} className="pv4-um" left={left}>
      <div className="pv4-um-body">
        {tab === 'cpu' && (
          <>
            <LiveStats cells={CPU_VITALS} />
            <CpuTab defaultOpen />
          </>
        )}
        {tab === 'gpu' && (
          <>
            <LiveStats cells={GPU_VITALS} />
            <GpuTab defaultOpen />
          </>
        )}
        {tab === 'memory' && <MemoryTab defaultOpen />}
        {tab === 'thermal' && <ThermalTab defaultOpen />}
        {tab === 'advanced' && <AdvancedPowerTab defaultOpen />}
        <div className="ut-footer">
          <Button>Reset to Default</Button>
          <Button variant="accent">Apply</Button>
        </div>
      </div>
    </ModalShell>
  );
}

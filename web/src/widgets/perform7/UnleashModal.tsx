import { useState } from 'react';
import { Badge, Button, Menu, ModalShell } from '../../components';
import { InfoDisclosure } from './InfoDisclosure';
import { CpuTab } from '../unleash/CpuTab';
import { GpuTab } from '../unleash/GpuTab';
import { MemoryTab } from '../unleash/MemoryTab';
import { ThermalTab } from '../unleash/ThermalTab';
import { AdvancedPowerTab } from '../unleash/AdvancedPowerTab';
import '../unleash-tuning.css';

// ── Unleashed — Advanced Tuning (PerformV7) ──
// V7 fork. The rail is reduced to what a rail is for: NAVIGATION. What left it:
//   · hero glyph + "Unleashed" title — deleted. The mode is implied by the route: this
//     modal is only reachable from inside Unleashed, so naming it again is chrome
//     restating context the user just created.
//   · the About disclosure sits at the FOOTER LEFT, not the header. The header's
//     right-hand end is reserved for controls that change what the modal does,
//     and a modal can need a control and an explanation at the same time.
//     Splitting them by touch frequency settles it: the control keeps the prime
//     slot, the explanation is read once and sits bottom-left.
//   · the positioning paragraph — SPLIT by what each sentence actually is.
//     "Runs past the factory-certified ceiling" is education → the About
//     disclosure. "System stability is your responsibility" is liability →
//     the warning banner, next to the risk it qualifies. About holds what a
//     thing IS; it is not a bucket for whatever left the rail.
//   · the "Unleashed active / PBO auto-enabled" status — DELETED, not relocated.
//     Three reasons: it duplicates a sentence already in the About panel; it is
//     styled as a live status while being a static fact; and PBO is AMD's name
//     for its boost feature, while the MVP desktops are Nova Lake — Intel. If we
//     do want the attribution (this mode switched something on for you), it
//     belongs as a receipt on the control it actually affected, on hardware
//     where it is true — not as a standing banner.
// What STAYED, deliberately: the L4 Considerations banner. Overclocking can
// actually damage hardware, and our rule puts a warning at the boundary that
// unlocks the risky set rather than on every control inside it. This modal IS
// that boundary, so the banner moves to the top of the body — the first thing
// read on arrival — instead of sitting in a rail beside it.
//
// Original V4 note follows.
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

const BoltIcon = () => (
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
    <circle cx="50" cy="50" r="46" stroke="rgba(239,68,68,0.18)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="36" stroke="rgba(239,68,68,0.26)" strokeWidth="1" strokeDasharray="4,3" />
    <polygon
      points="50,13 82,50 50,87 18,50"
      fill="rgba(239,68,68,0.06)"
      stroke="rgba(239,68,68,0.5)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M54 30 L40 54 H50 L46 70 L62 46 H51 L54 30 Z" fill="rgba(239,68,68,0.85)" />
  </svg>
);

export interface UnleashModalProps {
  onClose?: () => void;
}

export function UnleashModal({ onClose }: UnleashModalProps) {
  const [tab, setTab] = useState('cpu');

  // Rail: navigation only.
  const left = (
    <div className="pv4-um-left pv7-um-left">
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
    </div>
  );

  // "What this mode is" — read once, then noise. Same treatment as OMEN AI.
  const about = (
    <InfoDisclosure label="About" title="Advanced tuning" icon={<BoltIcon />}>
      <p className="pv7-disc-body">
        Tuning past the factory-certified power and thermal ceiling. These controls set clocks,
        voltages and power limits directly, instead of through a power mode.
      </p>
    </InfoDisclosure>
  );

  return (
    <ModalShell
      title="Advanced Tuning"
      onClose={onClose}
      className="pv4-um pv7-um"
      left={left}
      /* Apply is the whole point of this modal and it used to sit ~280px below
         the fold. In the frame footer it is reachable from any tab, at any
         scroll position. */
      footer={
        <div className="ut-footer pv7-footer">
          {about}
          <Button>Reset to Default</Button>
          <Button variant="accent">Apply</Button>
        </div>
      }
    >
      <div className="pv4-um-body">
        {/* The boundary warning for the whole L4 set — first thing read on arrival. */}
        <div className="ut-banner warn pv7-um-warn">
          <span className="ut-banner-title">
            <Badge variant="status" tone="warn">L4</Badge>
            Considerations
          </span>
          <span className="ut-banner-copy">
            Improper configuration may pose risks to VRM, battery, or CPU longevity. System stability
            is your responsibility.
          </span>
        </div>
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
      </div>
    </ModalShell>
  );
}

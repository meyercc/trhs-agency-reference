import { useState } from 'react';
import { Badge, Button, Toggle, ToggleButtonGroup } from '../components';
import { CpuTab } from './unleash/CpuTab';
import { GpuTab } from './unleash/GpuTab';
import { MemoryTab } from './unleash/MemoryTab';
import { ThermalTab } from './unleash/ThermalTab';
import { AdvancedPowerTab } from './unleash/AdvancedPowerTab';
import './feature-cards.css';
import './power-thermal.css';
import './performance-card.css';
import './unleash-tuning.css';

// ── Performance section (mode-first, L2) ──
// One card whose primary control is the power mode (Eco / Balanced /
// Performance / Unleashed), with per-mode content per the unleash_v7 spec.
// Unleashed reveals the five tuning domains (CPU / GPU / Memory / Thermal /
// Advanced Power) inline on the card as collapsible sections — headers and
// summaries always visible, settings one click away; only L4 sits behind an
// extra disclosure (Per-Core Tuning, Advanced Power electrical limits).

const PowerIcon = () => (
  <svg viewBox="0 0 22 20" width="22" height="20" fill="none" aria-hidden="true">
    <path d="M4 19V12M4 8V1M11 19V10M11 6V1M18 19V14M18 10V1M1 12H7M8 6H14M15 14H21" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export type PowerMode = 'eco' | 'balanced' | 'performance' | 'unleashed';

const MODES: { id: PowerMode; label: string; watts: string; variant: string }[] = [
  { id: 'eco', label: 'Eco', watts: '35W', variant: 'batt-mode' },
  { id: 'balanced', label: 'Balanced', watts: '65W', variant: '' },
  { id: 'performance', label: 'Performance', watts: '95W', variant: 'perf-mode' },
  { id: 'unleashed', label: 'Unleashed', watts: '115W', variant: 'unleash-mode' },
];

const FAN_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'Max', value: 'max' },
];

export function PerformanceCard() {
  const [mode, setMode] = useState<PowerMode>('balanced');
  const [fan, setFan] = useState('auto');
  const [spg, setSpg] = useState(true);
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div className="ds-feature-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-icon">
          <PowerIcon />
        </div>
        <Badge variant="status">{active.label}</Badge>
      </div>
      <div className="ds-feature-card-title">Power Mode</div>
      <div className="power-modes pm-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={['power-mode-btn', mode === m.id ? 'active' : '', mode === m.id ? m.variant : ''].filter(Boolean).join(' ')}
            onClick={() => setMode(m.id)}
          >
            <span className="power-mode-dot" />
            <span className="power-mode-label">{m.label}</span>
            <span className="power-mode-watts">{m.watts}</span>
          </button>
        ))}
      </div>

      <div className="mode-context">
        {mode === 'eco' && (
          <>
            <div className="mode-setting-row">
              <Badge variant="status" tone="positive">
                Eco Mode Activated
              </Badge>
            </div>
            <div className="ds-feature-card-sub">
              CPU and GPU power are capped at minimum levels. Fans run quietly. All performance adjustments are locked.
            </div>
          </>
        )}
        {mode === 'balanced' && (
          <>
            <div className="ds-feature-card-sub">
              Balanced mode automatically balances performance and power, suited for everyday tasks and light gaming.
            </div>
            <div className="mode-setting-row">
              <span className="mode-setting-label">Fan Control</span>
              <ToggleButtonGroup options={FAN_OPTIONS} value={fan} onChange={setFan} aria-label="Fan control" />
            </div>
          </>
        )}
        {mode === 'performance' && (
          <>
            <div className="ds-feature-card-sub">
              Performance mode removes default power limits to prioritize game framerate and CPU frequency.
            </div>
            <div className="mode-setting-row">
              <span className="mode-setting-label">Fan Control</span>
              <ToggleButtonGroup options={FAN_OPTIONS} value={fan} onChange={setFan} aria-label="Fan control" />
            </div>
          </>
        )}
        {mode === 'unleashed' && (
          <>
            <div className="ut-banner">
              <span className="ut-banner-copy">
                ⚡ <strong>Unleashed activated</strong> — PBO auto-enabled, advanced controls unlocked. System stability
                is the user's responsibility.
              </span>
            </div>
            <div className="ut-group">
              <div className="ut-row">
                <div className="ut-row-main">
                  <span className="ut-row-label">Smart Performance Gain</span>
                  <span className="ut-row-meta">
                    Dynamically transfers unused GPU power to the CPU in real time; can briefly exceed the Sustained
                    Power Limit.
                  </span>
                </div>
                <div className="ut-row-control">
                  <Toggle checked={spg} onChange={setSpg} aria-label="Smart Performance Gain" />
                </div>
              </div>
            </div>
            <CpuTab />
            <GpuTab />
            <MemoryTab />
            <ThermalTab />
            <AdvancedPowerTab />
            <div className="ut-footer">
              <Button>Reset to Default</Button>
              <Button variant="accent">Apply</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

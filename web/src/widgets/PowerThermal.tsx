import { useEffect, useState } from 'react';
import { Badge, Button, Toggle, Slider, Tooltip } from '../components';
import { useSettings } from '../state/Settings';
import { useModules } from '../state/Modules';
import { toUnit } from '../state/units';
import './feature-cards.css';
import './power-thermal.css';

// ── Power & Thermal section ──
// The Perform-page "Power & Thermal" row, ported from the vanilla `.perf-grid-4`:
// Power Mode presets · Fan Control · Undervolting · Overclocking. Built from DS
// components (Badge / Button / Toggle / Slider / Tooltip) on the shared
// .ds-feature-card surface; cards split the container evenly (.feature-card-grid).

// ── Header glyphs (brand-specific, inline like the Optimizer/Maintenance cards) ──
const PowerIcon = () => (
  <svg viewBox="0 0 22 20" width="22" height="20" fill="none" aria-hidden="true">
    <path d="M4 19V12M4 8V1M11 19V10M11 6V1M18 19V14M18 10V1M1 12H7M8 6H14M15 14H21" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const FanIcon = () => (
  <svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M2.34025 15.9997C1.0881 13.8298 1.72473 11.0644 3.79795 9.66006L3.80018 9.65784C5.46564 8.53235 7.65775 8.57012 9.28433 9.75228L12.7164 12.2477C14.3418 13.4299 16.5339 13.4676 18.2005 12.3421L18.2027 12.3399C20.2771 10.9356 20.9148 8.16792 19.6604 6.00026M16.002 19.6593C13.8321 20.9114 11.0667 20.2748 9.66229 18.2016L9.66006 18.1994C8.53457 16.5339 8.57234 14.3418 9.7545 12.7152L12.2499 9.28317C13.4321 7.6577 13.4699 5.46559 12.3444 3.79901L12.3399 3.79679C10.9356 1.72468 8.16792 1.08582 6.00026 2.3402M18.0705 3.92901C21.9758 7.83436 21.9758 14.1651 18.0705 18.0705C14.1651 21.9758 7.83436 21.9758 3.92901 18.0705C0.0236626 14.1651 0.0236626 7.83436 3.92901 3.92901C7.83436 0.0236626 14.1651 0.0236626 18.0705 3.92901Z" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BoltIcon = () => (
  <svg viewBox="0 0 19 22" width="19" height="22" fill="none" aria-hidden="true">
    <path d="M10.4325 1L1.52593 11.6879C1.17713 12.1064 1.00272 12.3157 1.00006 12.4925C0.99774 12.6461 1.06621 12.7923 1.18574 12.8889C1.32323 13 1.59566 13 2.14051 13H9.43248L8.43248 21L17.339 10.3121C17.6878 9.89358 17.8622 9.68429 17.8649 9.50754C17.8672 9.35388 17.7987 9.2077 17.6792 9.11111C17.5417 9 17.2693 9 16.7244 9H9.43248L10.4325 1Z" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChipIcon = () => (
  <svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true">
    <path d="M8 1V3M14 1V3M8 19V21M14 19V21M19 8H21M19 13H21M1 8H3M1 13H3M7.8 19H14.2C15.8802 19 16.7202 19 17.362 18.673C17.9265 18.3854 18.3854 17.9265 18.673 17.362C19 16.7202 19 15.8802 19 14.2V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V14.2C3 15.8802 3 16.7202 3.32698 17.362C3.6146 17.9265 4.07354 18.3854 4.63803 18.673C5.27976 19 6.11984 19 7.8 19ZM9.6 14H12.4C12.9601 14 13.2401 14 13.454 13.891C13.6422 13.7951 13.7951 13.6422 13.891 13.454C14 13.2401 14 12.9601 14 12.4V9.6C14 9.03995 14 8.75992 13.891 8.54601C13.7951 8.35785 13.6422 8.20487 13.454 8.10899C13.2401 8 12.9601 8 12.4 8H9.6C9.03995 8 8.75992 8 8.54601 8.10899C8.35785 8.20487 8.20487 8.35785 8.10899 8.54601C8 8.75992 8 9.03995 8 9.6V12.4C8 12.9601 8 13.2401 8.10899 13.454C8.20487 13.6422 8.35785 13.7951 8.54601 13.891C8.75992 14 9.03995 14 9.6 14Z" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Small info-tooltip trigger reused on the Fan / Undervolt / OC titles. */
function InfoTip({ content }: { content: string }) {
  return (
    <Tooltip content={content} placement="bottom">
      <button type="button" className="ds-tooltip-trigger" aria-label="More info" onClick={(e) => e.stopPropagation()}>
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="5" />
          <line x1="6" y1="5.5" x2="6" y2="8.5" />
          <circle cx="6" cy="3.8" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </Tooltip>
  );
}

type Mode = 'auto' | 'performance' | 'balanced' | 'eco';
const MANUAL_MODES: { id: Mode; label: string; watts: string; variant: string }[] = [
  { id: 'performance', label: 'Performance', watts: '95W', variant: 'perf-mode' },
  { id: 'balanced', label: 'Balanced', watts: '65W', variant: '' },
  { id: 'eco', label: 'Eco', watts: '35W', variant: 'batt-mode' },
];
// The guided (learner-persona) preset: OMEN AI drives power/thermals. Only
// offered when the OMEN AI module is installed — picking any manual mode takes over.
const AUTO_MODE = { id: 'auto' as Mode, label: 'Auto', watts: 'OMEN AI', variant: 'ai-mode' };

export interface PowerThermalProps {
  onOpenFan?: () => void;
  onOpenUndervolt?: () => void;
  onOpenOverclock?: () => void;
}

export function PowerThermal({ onOpenFan, onOpenUndervolt, onOpenOverclock }: PowerThermalProps) {
  const { tempUnit, persona } = useSettings();
  const { has } = useModules();

  // Persona sets the posture: learner leads with OMEN AI automation, minimalist
  // gets presets only, tinkerer (and pre-onboarding) keeps the full manual surface.
  // Auto needs the OMEN AI module, but a learner without it still stays non-advanced.
  const learner = persona === 'learner';
  const guided = learner && has('omenai');
  const minimal = persona === 'minimalist';
  const advanced = !learner && !minimal;

  const modes = guided ? [AUTO_MODE, ...MANUAL_MODES] : MANUAL_MODES;
  const [mode, setMode] = useState<Mode>(guided ? 'auto' : 'performance');
  // Persona can change live (Settings → Experience Style): entering guided hands
  // control back to Auto; leaving it lands on a real manual mode.
  useEffect(() => {
    setMode((m) => (guided ? 'auto' : m === 'auto' ? 'performance' : m));
  }, [guided]);

  const [uvOn, setUvOn] = useState(true);
  const [uv, setUv] = useState(-80);
  const modeLabel = modes.find((m) => m.id === mode)?.label ?? 'Performance';

  return (
    <div className="feature-card-grid">
      {/* Power Mode */}
      <div className="ds-feature-card">
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <PowerIcon />
          </div>
          <Badge variant="status">{modeLabel}</Badge>
        </div>
        <div className="ds-feature-card-title">Power Mode</div>
        <div className="power-modes">
          {modes.map((m) => (
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
        {guided && mode === 'auto' && (
          <p className="power-auto-note">
            OMEN AI balances power, thermals, and noise for you. Pick a mode any time to take over.
          </p>
        )}
      </div>

      {/* Fan Control — minimalist keeps just the presets card */}
      {!minimal && (
      <div className="ds-feature-card" role="button" tabIndex={0} onClick={onOpenFan}>
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <FanIcon />
          </div>
          <Badge variant="status">{guided && mode === 'auto' ? 'Auto' : 'Custom'}</Badge>
        </div>
        <div className="ds-feature-card-title">
          Fan Control <InfoTip content="Maps CPU temperature to fan RPM. Custom curves let you balance cooling and noise." />
        </div>
        <svg className="fan-curve-svg" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="22" x2="200" y2="22" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <line x1="0" y1="11" x2="200" y2="11" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="0" y1="33" x2="200" y2="33" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <path d="M0,40 C20,38 40,34 60,28 C80,22 100,16 130,10 C155,6 175,4 200,3 L200,44 L0,44 Z" fill="rgba(0,200,215,0.07)" />
          <path d="M0,40 C20,38 40,34 60,28 C80,22 100,16 130,10 C155,6 175,4 200,3" fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="80" cy="22" r="3" fill="var(--cyan)" opacity="0.8" />
        </svg>
        <div className="fan-rpm-row">
          <div>
            <span className="fan-rpm-val">2,840</span>
            <span className="fan-rpm-unit">RPM</span>
          </div>
          <span className="fan-temp-val">
            {toUnit(58, tempUnit)}°{tempUnit}
          </span>
        </div>
        <div className="ds-feature-card-footer">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpenFan?.(); }}>
            Configure
          </Button>
        </div>
      </div>
      )}

      {/* Undervolting — advanced surface, tinkerer only */}
      {advanced && (
      <div className="ds-feature-card">
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <BoltIcon />
          </div>
          <Toggle checked={uvOn} onChange={setUvOn} aria-label="Undervolting" />
        </div>
        <div className="ds-feature-card-title">
          Undervolting <InfoTip content="Reduces CPU/GPU voltage below stock to lower temps and power draw with no performance cost." />
        </div>
        <div className="ds-feature-card-sub">CPU &amp; GPU core voltage offset</div>
        <div className="uv-slider-row">
          <Slider min={-200} max={0} step={5} value={uv} onChange={setUv} aria-label="Voltage offset" />
          <span className="ds-slider-value">{uv < 0 ? '−' : ''}{Math.abs(uv)} mV</span>
        </div>
        <div className="ds-feature-card-footer">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpenUndervolt?.(); }}>
            Configure
          </Button>
        </div>
      </div>
      )}

      {/* Overclocking — advanced surface, tinkerer only */}
      {advanced && (
      <div className="ds-feature-card">
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <ChipIcon />
          </div>
          <Badge variant="status">Stock</Badge>
        </div>
        <div className="ds-feature-card-title">
          Overclocking <InfoTip content="Pushes CPU/GPU beyond factory clocks for more FPS. Increases heat — requires adequate cooling." />
        </div>
        <div className="oc-clock-row">
          <span className="ds-feature-card-stat">4.8</span>
          <span className="ds-feature-card-stat-unit">GHz</span>
        </div>
        <div className="ds-feature-card-stat-label">Current boost clock</div>
        <div className="ds-feature-card-footer">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpenOverclock?.(); }}>
            Configure
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Badge, Button, Toggle, ToggleButtonGroup } from '../../components';
import { OmenAiIcon } from '../perform3/OmenAiHeader';
import type { Form, ModeChangeEvent, PowerMode } from '../perform3/machine';
import '../feature-cards.css';
import '../power-thermal.css';
import '../performance-card.css';
import '../unleash-tuning.css';

// ── Power envelope — the page ANCHOR (V4 grammar) ──
// Base design restored from the original PerformanceCard (icon header, Power
// Mode title, 4-up tile row, per-mode context verbatim from unleash_v7).
// Unleashed context: activation banner → SPG (visible the moment Unleashed is
// entered, per the v7 intent — now on the card under the mode row) → the
// Advanced Tuning entry, which opens the UnleashModal Detail Modal. Depth
// lives in the modal, so this card's height is state-stable again.
// The AI layers on top as marks, never as structure:
//   Form 0 — no AI pixels (attribution recorded, not displayed).
//   Form 1 — signature badge on the shared write point ("Set by OMEN AI").
//   Form 2 — peer-tile absorption (Armoury Crate inversion): OMEN AI joins
//   the mode row as the default tile; manual modes become the escape hatch.

const PowerIcon = () => (
  <svg viewBox="0 0 22 20" width="22" height="20" fill="none" aria-hidden="true">
    <path d="M4 19V12M4 8V1M11 19V10M11 6V1M18 19V14M18 10V1M1 12H7M8 6H14M15 14H21" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

export interface EnvelopeCardProps {
  form: Form;
  current: ModeChangeEvent;
  /** user picks a mode tile (recorded with source 'user' upstream) */
  onSelect: (mode: PowerMode) => void;
  /** Form 2: user hands the envelope back to the AI tile */
  onDelegate?: () => void;
  /** open the Unleashed Advanced Tuning detail modal */
  onOpenTuning?: () => void;
  /** managed STATE (states-as-forms): an agent is driving this card. Renders the
   *  governance strip (the CardLab `managed` treatment) and makes the controls
   *  inert while the readout persists. Optional — V4 never passes it. */
  managed?: boolean;
  /** release the card back to manual control */
  onRelease?: () => void;
}

export function EnvelopeCard({ form, current, onSelect, onDelegate, onOpenTuning, managed, onRelease }: EnvelopeCardProps) {
  const [fan, setFan] = useState('auto');
  const [spg, setSpg] = useState(true);
  const mode = current.mode;
  const aiSet = current.source !== 'user';
  const aiTile = form === 'form2';
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div className={'ds-feature-card pv4-envelope' + (form !== 'form0' ? ' pv4-captured' : '') + (managed ? ' pv4-managed' : '')}>
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-icon">
          <PowerIcon />
        </div>
        <Badge variant="status">{active.label}</Badge>
      </div>
      <div className="ds-feature-card-title">Power Mode</div>

      {managed && (
        <div className="clab-strip">
          <span>Managed by OMEN AI{current.game ? ` · ${current.game}` : ''}</span>
          <span className="spacer" />
          <Button variant="ghost" size="sm" onClick={onRelease}>
            Release
          </Button>
        </div>
      )}

      <div className={'power-modes pm-row' + (aiTile ? ' pv4-modes-5' : '')}>
        {aiTile && (
          <button
            type="button"
            className={'power-mode-btn pv4-ai-tile' + (aiSet ? ' active' : '')}
            onClick={onDelegate}
          >
            <span className="pv4-ai-tile-icon">
              <OmenAiIcon />
            </span>
            <span className="power-mode-label">OMEN AI</span>
            <span className="power-mode-watts">Auto</span>
          </button>
        )}
        {MODES.map((m) => {
          const selected = mode === m.id && (!aiTile || !aiSet);
          return (
            <button
              key={m.id}
              type="button"
              className={['power-mode-btn', selected ? 'active' : '', selected ? m.variant : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(m.id)}
            >
              <span className="power-mode-dot" />
              <span className="power-mode-label">{m.label}</span>
              <span className="power-mode-watts">{m.watts}</span>
            </button>
          );
        })}
      </div>

      {/* Signature — the shared write point's attribution (Form 1+ display;
          the data is recorded in every form). */}
      {form !== 'form0' && (
        <div className="pv4-signature">
          {aiSet ? (
            <>
              <Badge variant="status" tone="info">Set by OMEN AI</Badge>
              <span className="pv4-signature-meta">
                {aiTile ? `holding ${active.label} · ${active.watts}` : ''}
                {current.game ? `${aiTile ? ' ' : ''}for ${current.game}` : ''}
              </span>
            </>
          ) : (
            <Badge variant="status">Set manually</Badge>
          )}
        </div>
      )}

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
            <div className="ds-feature-card-footer">
              <Button variant="accent" size="sm" onClick={onOpenTuning}>
                Advanced Tuning
              </Button>
              <span className="ds-feature-card-meta">CPU · GPU · Memory · Thermal · Advanced Power</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

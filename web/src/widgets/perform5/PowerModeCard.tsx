import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Toggle, ToggleButtonGroup } from '../../components';
import { CardDoor } from './CardKit';
import type { ModeChangeEvent, PowerMode } from '../perform3/machine';
import '../feature-cards.css';
import '../power-thermal.css';
import '../performance-card.css';
import '../unleash-tuning.css';

// ── Power Mode card (PerformV5) — V5-local copy of perform4/EnvelopeCard ──
// Copied per the "copy, then modify the copy" rule — V4's EnvelopeCard is
// untouched. form0 shape only: V5 renders governance as a page-level chip, so
// the form1/form2 signature + AI-tile code is dropped, and (V5 rule) no
// explanatory copy on the card.
//
// THE INTERACTION FIX: switching modes used to snap the card to its new height
// in one commit, which made the section's framer-motion layout spring FLIP the
// whole section (scaleY stretch = "the whole card re-expands"). <GrowArea>
// holds the sub-control area at a measured pixel height and CSS-transitions it,
// so the content GROWS out from under the mode row; the card's height changes
// smoothly across frames and the section-level spring never fires.

const MODES: { id: PowerMode; label: string; watts: string; variant: string }[] = [
  { id: 'eco', label: 'Eco', watts: '35W', variant: 'batt-mode' },
  { id: 'balanced', label: 'Balanced', watts: '65W', variant: '' },
  { id: 'performance', label: 'Performance', watts: '95W', variant: 'perf-mode' },
  { id: 'unleashed', label: 'Unleashed', watts: '115W', variant: 'unleash-mode' },
];

// Per-mode icons (stroke, currentColor — CSS drives the state colour). The
// tiles are the card's PRIMARY control; the icon + taller two-row tile give
// them the weight the sub-control list defers to.
const MODE_ICONS: Record<PowerMode, ReactNode> = {
  eco: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.8 3.2c-7.6 0-12 4.2-12 10 0 1.5.3 2.8.9 3.7" />
      <path d="M16.8 3.2c.4 7.8-3.4 12.4-11.1 13.7" />
    </svg>
  ),
  balanced: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5h14" />
      <circle cx="12.5" cy="6.5" r="2.1" />
      <path d="M3 13.5h14" />
      <circle cx="7.5" cy="13.5" r="2.1" />
    </svg>
  ),
  performance: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 14.5a6.5 6.5 0 1 1 13 0" />
      <path d="M10 14.5l3.6-4.3" />
      <circle cx="10" cy="14.5" r="1" />
    </svg>
  ),
  unleashed: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5L4.5 11.5h4.5l-1 6 7-9h-4.5l1-6z" />
    </svg>
  ),
};

const FAN_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'Max', value: 'max' },
];

/** Pixel-height container: measures its content each render and CSS-transitions
 *  to the new height, so branch swaps grow/shrink instead of snapping. */
function GrowArea({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);

  // Runs after every render (including its own follow-up, which then no-ops):
  // measure the new content pre-paint and let the CSS transition do the rest.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const next = inner.offsetHeight;
    if (next !== h) setH(next);
  });

  return (
    <div className="pv5-pm-grow" style={h === null ? undefined : { height: h }}>
      <div className="pv5-pm-grow-inner" ref={innerRef}>
        {children}
      </div>
    </div>
  );
}

export interface PowerModeCardProps {
  current: ModeChangeEvent;
  /** user picks a mode tile (recorded with source 'user' upstream) */
  onSelect: (mode: PowerMode) => void;
  /** open the Unleashed Advanced Tuning detail modal */
  onOpenTuning?: () => void;
}

export function PowerModeCard({ current, onSelect, onOpenTuning }: PowerModeCardProps) {
  const [fan, setFan] = useState('auto');
  const [spg, setSpg] = useState(true);
  const mode = current.mode;

  return (
    <div className="ds-feature-card pv4-envelope">
      <div className="ds-feature-card-title">Power Mode</div>

      <div className="power-modes pm-row">
        {MODES.map((m) => {
          const selected = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={['power-mode-btn', 'pv5-mode-tile', selected ? 'active' : '', selected ? m.variant : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(m.id)}
            >
              <span className="pv5-mode-ic">{MODE_ICONS[m.id]}</span>
              <span className="power-mode-watts">{m.watts}</span>
              <span className="power-mode-label">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub controls grow out from under the mode row. One row style for all
          modes (the SPG list-item look, .ut-group/.ut-row); the wrapper carries
          a mode-hued spine so the area visually belongs to the selected mode.
          No explanatory copy (V5 rule) — tooltip candidates preserved below. */}
      <GrowArea>
        {/* Eco has no sub controls — the selected tile already says it; the
            area collapses to nothing. (Removed "Eco Mode Activated" badge;
            tooltip candidate: "CPU and GPU power are capped at minimum levels.
            Fans run quietly. All performance adjustments are locked.") */}
        {mode !== 'eco' && (
        <div className={`mode-context pv5-pm-sub pv5-pm-sub--${mode}`}>
          {(mode === 'balanced' || mode === 'performance') && (
            /* tooltip candidates: balanced "Balanced mode automatically balances
               performance and power, suited for everyday tasks and light gaming."
               · performance "Performance mode removes default power limits to
               prioritize game framerate and CPU frequency." */
            <div className="ut-group">
              <div className="ut-row">
                <div className="ut-row-main">
                  <span className="ut-row-label">Fan Control</span>
                </div>
                <div className="ut-row-control">
                  <ToggleButtonGroup options={FAN_OPTIONS} value={fan} onChange={setFan} aria-label="Fan control" />
                </div>
              </div>
            </div>
          )}
          {mode === 'unleashed' && (
            <>
              {/* No standing warning banner on the card (removed 2026-07-23):
                  risk warnings belong at the point of the risky WRITE — the L4
                  gate dialog inside Advanced Tuning — not as ambient copy.
                  Removed text: "⚡ Unleashed activated — PBO auto-enabled,
                  advanced controls unlocked. System stability is the user's
                  responsibility." */}
              <div className="ut-group">
                <div className="ut-row">
                  <div className="ut-row-main">
                    {/* tooltip candidate: "Dynamically transfers unused GPU power
                        to the CPU in real time; can briefly exceed the Sustained
                        Power Limit." */}
                    <span className="ut-row-label">Smart Performance Gain</span>
                  </div>
                  <div className="ut-row-control">
                    <Toggle checked={spg} onChange={setSpg} aria-label="Smart Performance Gain" />
                  </div>
                </div>
                <div className="ut-row">
                  <div className="ut-row-main">
                    <span className="ut-row-label">Advanced Tuning</span>
                  </div>
                  <div className="ut-row-control">
                    <CardDoor verb="configure" onClick={onOpenTuning} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </GrowArea>
    </div>
  );
}

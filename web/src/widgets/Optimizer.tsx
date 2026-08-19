import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Badge, Button } from '../components';
import { useModules } from '../state/Modules';
import './feature-cards.css';

// ── Optimizer section ──
// The Perform-page "Optimizer" row, ported from the vanilla `.perf-grid`. Renders
// feature cards on the shared `.ds-feature-card` surface. The cards split the
// container into equal fractions (two → halves, three → thirds, …) so adding a
// card later needs no layout change — see `.opt-grid` (grid-auto-flow: column).

const OmenAiIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M24 12L12 24L0 12L12 0L24 12ZM3 12L12 21L21 12L12 3L3 12ZM16.2861 12L12 16.2861L7.71484 12L12 7.71387L16.2861 12Z"
      fill="var(--accent-color)"
    />
  </svg>
);

const BoosterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10.5 14.0002L7.5 11.0002M10.5 14.0002C11.8968 13.469 13.2369 12.799 14.5 12.0002M10.5 14.0002V19.0002C10.5 19.0002 13.53 18.4502 14.5 17.0002C15.58 15.3802 14.5 12.0002 14.5 12.0002M7.5 11.0002C8.03214 9.61968 8.7022 8.29631 9.5 7.05025C10.6652 5.18723 12.2876 3.6533 14.213 2.59434C16.1384 1.53538 18.3027 0.986619 20.5 1.00025C20.5 3.72025 19.72 8.50025 14.5 12.0002M7.5 11.0002H2.5C2.5 11.0002 3.05 7.97025 4.5 7.00025C6.12 5.92025 9.5 7.00025 9.5 7.00025M3 15.5002C1.5 16.7602 1 20.5002 1 20.5002C1 20.5002 4.74 20.0002 6 18.5002C6.71 17.6602 6.7 16.3702 5.91 15.5902C5.52131 15.2193 5.00929 15.0049 4.47223 14.9883C3.93516 14.9717 3.41088 15.154 3 15.5002Z"
      stroke="var(--accent-color)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface OptimizerProps {
  /** open the OMEN AI experience (`?modal=omenai`) */
  onConfigureAi?: () => void;
  /** open the Booster experience (`?modal=booster`) */
  onConfigureBooster?: () => void;
}

/** Enter/Space on a role="button" card activates it (keyboard parity with click). */
function cardKeyActivate(handler?: () => void) {
  return (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler?.();
    }
  };
}

export function Optimizer({ onConfigureAi, onConfigureBooster }: OptimizerProps) {
  const { has } = useModules();
  return (
    <div className="feature-card-grid">
      {/* OMEN AI */}
      {has('omenai') && (
      <div className="ds-feature-card" onClick={onConfigureAi} onKeyDown={cardKeyActivate(onConfigureAi)} role="button" tabIndex={0}>
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <OmenAiIcon />
          </div>
          <Badge variant="status">Active</Badge>
        </div>
        <div className="ds-feature-card-title">OMEN AI</div>
        <div className="ds-feature-card-sub">
          Maximizing performance with adaptive profiling. CPU and GPU targets optimized.
        </div>
        <div className="ds-feature-card-footer">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConfigureAi?.();
            }}
          >
            Configure
          </Button>
          <span className="ds-feature-card-meta">Last tuned 2h ago</span>
        </div>
      </div>
      )}

      {/* Booster */}
      {has('booster') && (
      <div className="ds-feature-card" onClick={onConfigureBooster} onKeyDown={cardKeyActivate(onConfigureBooster)} role="button" tabIndex={0}>
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <BoosterIcon />
          </div>
          <Badge variant="status">Ready</Badge>
        </div>
        <div className="ds-feature-card-title">Booster</div>
        <div className="ds-feature-card-stat">2,123,154</div>
        <div className="ds-feature-card-stat-label">Games boosted yesterday</div>
        <div className="ds-feature-card-footer">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConfigureBooster?.();
            }}
          >
            Configure
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

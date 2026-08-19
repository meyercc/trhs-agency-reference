import { useState } from 'react';
import { Badge, Toggle } from '../../components';
import type { AiState } from './machine';

// ── Block 3: optimizers (software write) ──
// Contents depend on the AI engine version present. Renders wherever software
// write is available (all simulated machines). "Booster" is absorbed into the
// OMEN AI umbrella from 2.0 — it appears as a row here, not as its own card.
// All quantitative copy is [ENG] — do not extend the claims.

interface OptRow {
  label: string;
  sub: string;
  on?: boolean;
}

const V1_ROWS: OptRow[] = [
  { label: 'Game optimization', sub: '15 supported titles, per-cohort optimum. Per-game off; revert is undoable.', on: true },
  { label: 'Booster', sub: 'Auto-applies the learned optimum for your machine cohort.', on: true },
];

const V2_ROWS: OptRow[] = [
  { label: 'Game optimization', sub: 'Any game gets booster + CPU gains; listed titles get deeper optimization.', on: true },
  { label: 'Booster', sub: 'Cross-session learning — composes the settings that tested positive.', on: true },
  { label: 'CPU scheduling', sub: 'Opt-in: play 10–20 min, tuning runs in the background. Software-only.', on: true },
  { label: 'Network booster', sub: 'Open to all users — manual first, auto later.', on: false },
  { label: 'FPS target', sub: 'Fidelity / framerate targeting. Default target = display refresh rate.', on: true },
];

export interface OptimizersBlockProps {
  ai: AiState;
}

export function OptimizersBlock({ ai }: OptimizersBlockProps) {
  const rows = ai === 'v1' ? V1_ROWS : V2_ROWS;
  const [state, setState] = useState(() => rows.map((r) => r.on ?? false));

  return (
    <div className="ds-feature-card pv3-optimizers">
      <div className="pv3-block-head">
        <span className="ds-feature-card-title">Optimization</span>
        <Badge variant="status">{ai === 'v1' ? '15 titles' : 'All games'}</Badge>
      </div>
      <div className="pv3-opt-rows">
        {rows.map((r, i) => (
          <div className="pv3-opt-row" key={r.label}>
            <div className="pv3-opt-row-main">
              <span className="pv3-opt-row-label">{r.label}</span>
              <span className="pv3-opt-row-sub">{r.sub}</span>
            </div>
            <Toggle
              checked={state[i] ?? false}
              onChange={(v) => setState((prev) => prev.map((p, idx) => (idx === i ? v : p)))}
              aria-label={r.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

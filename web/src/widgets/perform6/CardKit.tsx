import type { ReactNode } from 'react';

// ── CardKit V6 — the reading-forms expansion ──
// V6 keeps V5's entire grammar (anatomy, status words, door verbs, Facts) and
// widens ONE axis: the READING FORMS vocabulary. V5 flattened every reading to
// a Facts list (the baseline move); V6 re-adds controlled variety so each card
// declares one HERO READING form that fits its data's nature:
//   Metric — big mono number + unit (throughput, recoverable GB, counts)
//   Level  — full-width bar + % (health, capacity) · neutral fill, never accent
//   Facts  — list rows (receipts: last/next/history) — always the baseline
//   Trend  — sparkline (history) — reserved, not built yet
// Rule stays: ONE colored reading per card (the status word). Metric values are
// bright but neutral; Level fills are neutral.

export { STATUS_VOCAB, FeatStatus, CardDoor, Facts } from '../perform5/CardKit';
export type { StatusWord, StatusTone, FeatStatusProps, DoorVerb, CardDoorProps, Fact } from '../perform5/CardKit';

export interface MetricProps {
  value: string;
  unit?: string;
  /** small caption under the number, e.g. "Recoverable" */
  label?: string;
  /** direction glyph shown before the number, e.g. "↓" */
  arrow?: string;
}

export function Metric({ value, unit, label, arrow }: MetricProps) {
  return (
    <div className="pv6-metric">
      <div className="pv6-metric-top">
        {arrow && <span className="pv6-metric-a" aria-hidden="true">{arrow}</span>}
        <span className="pv6-metric-v">{value}</span>
        {unit && <span className="pv6-metric-u">{unit}</span>}
      </div>
      {label && <div className="pv6-metric-l">{label}</div>}
    </div>
  );
}

/** Lay two or more Metrics side by side (e.g. down/up throughput). */
export function Metrics({ children }: { children: ReactNode }) {
  return <div className="pv6-metrics">{children}</div>;
}

export interface LevelProps {
  /** 0..100 */
  pct: number;
  /** e.g. "82%" — defaults to `${pct}%` */
  value?: string;
  /** small mono caption right of the value, e.g. "fan health · est." */
  label?: string;
}

export function Level({ pct, value, label }: LevelProps) {
  return (
    <div className="pv6-level">
      <div className="pv6-level-bar">
        <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <div className="pv6-level-row">
        <span className="pv6-level-v">{value ?? `${pct}%`}</span>
        {label && <span className="pv6-level-l">{label}</span>}
      </div>
    </div>
  );
}

// (CardIcon identity tiles were tried and removed — 2026-07-23. The header
// stays title + door only; visual variety comes from the reading forms.)

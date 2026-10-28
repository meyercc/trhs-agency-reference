import type React from 'react';

export interface SparkPoint {
  t: number;
  v: number;
}

export interface SparklineProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  /** The series, oldest first — the vitals stream's two-minute history. */
  points: readonly SparkPoint[];
  /** The number read beside the label; default the last point. */
  display?: string;
  unit?: string;
  /** A fixed scale (0–100 for a percentage); absent = the series' own range. */
  min?: number;
  max?: number;
}

// ViewBox units; the SVG stretches to its box (`preserveAspectRatio="none"`)
// and the stroke stays constant through `vector-effect`.
const W = 100;
const H = 28;

/**
 * A reading over time (TH-454): the `.ds-spark-cell` label/value head — the
 * cell was named for this and never had it — with the last two minutes drawn
 * as a line over a faint area. Read-only, no axes: a card or a HUD has no room
 * for them, and the number beside the label is the axis that matters.
 */
export function Sparkline({ label, points, display, unit, min, max, className, ...rest }: SparklineProps) {
  const vs = points.map((p) => p.v);
  const lo = min ?? (vs.length ? Math.min(...vs) : 0);
  const hi = max ?? (vs.length ? Math.max(...vs) : 1);
  const span = hi - lo || 1;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W);
  const y = (v: number) => H - 1 - ((v - lo) / span) * (H - 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = points.length ? `${line} L ${W} ${H} L 0 ${H} Z` : '';
  const last = points[points.length - 1]?.v;
  return (
    <div className={['ds-spark-cell', 'graph', className].filter(Boolean).join(' ')} {...rest}>
      <span className="ds-spark-lbl">{label}</span>
      <span className="ds-spark-val">
        {display ?? (last != null ? Math.round(last) : '\u2014')}
        {unit ? <span className="ds-spark-unit">{unit}</span> : null}
      </span>
      <svg className="ds-spark-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}, the last ${points.length} readings`}>
        {area && <path d={area} className="ds-spark-area" />}
        {line && <path d={line} className="ds-spark-line" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

import type React from 'react';

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  /** 0–100: how far the bar fills. */
  value: number;
  /** What the number reads when it is not the percentage itself ("71" for a temperature filling on its own scale). */
  display?: string;
  /** Beside the number; default '%'. */
  unit?: string;
}

const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);

/**
 * A reading as a level (TH-454): the label/value cell over the progress bar.
 * Composes two existing `.ds-` families — `.ds-spark-cell` for the head and
 * `.ds-prog-track`/`.ds-prog-fill` for the bar — so the only new class is the
 * root that stacks them. Read-only; a level the person can move is a `Slider`.
 */
export function Meter({ label, value, display, unit = '%', className, ...rest }: MeterProps) {
  const pct = clamp(value);
  return (
    <div
      className={['ds-meter', className].filter(Boolean).join(' ')}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      {...rest}
    >
      <div className="ds-spark-cell">
        <span className="ds-spark-lbl">{label}</span>
        <span className="ds-spark-val">
          {display ?? Math.round(pct)}
          {unit ? <span className="ds-spark-unit">{unit}</span> : null}
        </span>
      </div>
      <div className="ds-prog-track" aria-hidden="true">
        <div className="ds-prog-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

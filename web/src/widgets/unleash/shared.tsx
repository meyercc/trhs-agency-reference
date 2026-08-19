import React, { useState } from 'react';
import { Badge, Button, Slider } from '../../components';
import { runBenchmark } from './benchStub';

// Shared pieces for the Unleash Advanced Tuning tabs. Visual vocabulary comes
// from the existing screens only: `.ut-*` (V2 tuning modal), `.ds-*` library
// components, and the collapse-head pattern from DeviceCanvas key groups.

/** Full-width slider row — header (label · value) over the ds-slider, note
 *  beneath. Mirrors the existing `.uv-slider-row` pattern from PowerThermal. */
export function SliderRow({
  label,
  sub,
  min,
  max,
  step = 1,
  value,
  onChange,
  unit = '',
  note,
  showRange,
  format,
}: {
  label: string;
  sub?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  note?: string;
  showRange?: boolean;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => `${v}${unit}`);
  return (
    <div className="ut-srow">
      <div className="ut-srow-head">
        <span className="ut-row-label">
          {label}
          {sub && <span className="ut-row-meta">{sub}</span>}
        </span>
        <span className="ds-slider-value">{fmt(value)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
      {showRange && (
        <div className="ut-srow-range">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      )}
      {note && <div className="ut-srow-note">{note}</div>}
    </div>
  );
}

/** Collapsible panel — head shows title, tier badge and a mono summary when
 *  closed. Same disclosure pattern as the DeviceCanvas key-group heads. */
export function Collapse({
  title,
  badge,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={'ut-collapse' + (open ? ' open' : '')}>
      <button type="button" className="ut-collapse-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="ut-collapse-title">
          {title}
          {badge}
        </span>
        {!open && summary && <span className="ut-collapse-summary">{summary}</span>}
        <span className="ut-collapse-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && <div className="ut-collapse-body">{children}</div>}
    </div>
  );
}

/** Benchmark row — title + run button; a thin progress bar while running, a
 *  large mono score once done. */
export function BenchmarkRow({ kind, title, desc }: { kind: 'cpu' | 'gpu'; title: string; desc: string }) {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const run = () => {
    setRunning(true);
    setScore(null);
    runBenchmark(kind).then((s) => {
      setScore(s);
      setRunning(false);
    });
  };
  return (
    <div className="ut-group">
      <div className="ut-row">
        <div className="ut-row-main">
          <span className="ut-row-label">{title}</span>
          <span className="ut-row-meta">{desc}</span>
        </div>
        <div className="ut-row-control">
          <Button size="sm" onClick={run} disabled={running}>
            {running ? 'Running...' : 'Run Benchmark'}
          </Button>
        </div>
      </div>
      {running && (
        <div className="ut-bench-bar" aria-hidden="true">
          <i />
        </div>
      )}
      {score !== null && !running && (
        <div className="ut-bench-score">
          {score.toLocaleString()} <span>points</span>
        </div>
      )}
    </div>
  );
}

/** L3 / L4 tier badge (existing Badge status tones). */
export function TierBadge({ tier }: { tier: 'L3' | 'L4' }) {
  return (
    <Badge variant="status" tone={tier === 'L3' ? 'info' : 'warn'}>
      {tier}
    </Badge>
  );
}

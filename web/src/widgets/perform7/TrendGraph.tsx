// ── TrendGraph (PerformV7) ──
// The V5 LineGraph drew a line with no y-domain and no reference points: it
// auto-scaled to whatever it was given, so the same shape meant a different
// thing on every tab and a spike was indistinguishable from noise.
//
// A trend is only readable against something. This one declares:
//   · a real domain (0..max in the metric's own unit), so height means a value
//   · the PEAK in the window, marked and labelled — the thing people look for
//   · optional THRESHOLDS as rules, and the whole trace takes their tone once
//     the current value crosses one, because a spike matters relative to a limit
//
// Two rendering rules learned the hard way:
//   · the path stretches (preserveAspectRatio="none") so it always fills its
//     box, but NOTHING ELSE may live inside that SVG — text and circles get
//     non-uniformly scaled with it and come out distorted. Markers and labels
//     are HTML positioned over the chart.
//   · the current value is NOT repeated here. It is already the big number in
//     the selected reading above; a second copy at the right edge cost the plot
//     its full width to say nothing new.
//
// This is the concrete definition of the reading form the card spec carries as
// "Trend — reserved".

export interface TrendGraphProps {
  data: number[];
  /** Top of the y domain, in the metric's own unit. */
  max: number;
  unit: string;
  /** Plot height in px. Defaults to the standard trend height. */
  height?: number;
  thresholds?: { warn?: number; danger?: number };
  /** Window label, e.g. "Last 60s". */
  window?: string;
  /**
   * Time range, rendered as the chart's own control at its foot — the range
   * governs this trend and nothing else, so it belongs on the trend rather than
   * in the modal header.
   */
  range?: TrendRange;
  onRange?: (r: TrendRange) => void;
}

export type TrendRange = '60s' | '24h' | '7d' | '30d';

export const TREND_RANGES: { value: TrendRange; label: string; window: string }[] = [
  { value: '60s', label: '60s', window: 'Last 60 seconds' },
  { value: '24h', label: '24h', window: 'Last 24 hours' },
  { value: '7d', label: '7d', window: 'Last 7 days' },
  { value: '30d', label: '30d', window: 'Last 30 days' },
];

/** One default height for every trend, so charts do not each pick their own. */
export const TREND_HEIGHT = 132;

export function TrendGraph({ data, max, unit, height = TREND_HEIGHT, thresholds, window: windowLabel, range, onRange }: TrendGraphProps) {
  const n = data.length;
  const pct = (v: number) => (Math.min(Math.max(v, 0), max) / max) * 100;

  const pts = data.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * 100 : 0;
    const y = 100 - pct(v);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = 'M' + pts.join(' L');
  const area = `${line} L100,100 L0,100 Z`;

  const peakValue = Math.max(...data);
  const peakIndex = data.indexOf(peakValue);
  const current = data[n - 1];

  const over = (t?: number) => t !== undefined && current >= t;
  const tone = over(thresholds?.danger) ? 'var(--red)' : over(thresholds?.warn) ? 'var(--orange)' : 'var(--cyan)';

  // Marker positions in percent, so HTML can sit exactly over the stretched path.
  const at = (i: number, v: number) => ({
    left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%`,
    top: `${100 - pct(v)}%`,
  });

  return (
    <div className="pv7-trend">
      <div className="pv7-trend-plot" style={{ height }}>
        <svg className="pv7-trend-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {thresholds?.warn !== undefined && thresholds.warn < max && (
            <line x1="0" x2="100" y1={100 - pct(thresholds.warn)} y2={100 - pct(thresholds.warn)} className="pv7-trend-rule pv7-trend-rule-warn" vectorEffect="non-scaling-stroke" />
          )}
          {thresholds?.danger !== undefined && thresholds.danger < max && (
            <line x1="0" x2="100" y1={100 - pct(thresholds.danger)} y2={100 - pct(thresholds.danger)} className="pv7-trend-rule pv7-trend-rule-danger" vectorEffect="non-scaling-stroke" />
          )}
          <path d={area} style={{ fill: `color-mix(in srgb, ${tone}, transparent 88%)` }} />
          <path d={line} className="pv7-trend-line" style={{ stroke: tone }} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Markers in HTML — inside the SVG they would be squashed with the path. */}
        <span className="pv7-trend-peak" style={at(peakIndex, peakValue)} aria-hidden="true" />
        <span className="pv7-trend-peak-label" style={at(peakIndex, peakValue)}>
          peak {peakValue}{unit}
        </span>
        <span className="pv7-trend-now" style={{ ...at(n - 1, current), background: tone }} aria-hidden="true" />

        <span className="ds-sr-only">
          {windowLabel ?? 'History'}: now {current}{unit}, peak {peakValue}{unit}, scale 0 to {max}{unit}
        </span>
      </div>
      <div className="pv7-trend-foot">
        {onRange ? (
          <span className="pv7-trend-ranges" role="group" aria-label="Time range">
            {TREND_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                className={'pv7-trend-range' + (r.value === range ? ' active' : '')}
                aria-pressed={r.value === range}
                onClick={() => onRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </span>
        ) : (
          <span>{windowLabel}</span>
        )}
        <span className="pv7-trend-scale">0–{max}{unit}</span>
      </div>
    </div>
  );
}

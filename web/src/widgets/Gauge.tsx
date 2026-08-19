import { useId } from 'react';

// ── Arc gauge (hand-rolled SVG — the vanilla used ECharts, but these 270° arcs
// don't need a charting library; identical look, zero dependency) ──
// Geometry mirrors the vanilla ECharts gauge: startAngle 220°, endAngle −40°
// (a 260° sweep with the gap at the bottom), radius 44, centre (50, 60).
// Shared by SystemVitalsWidget (card) and MonitoringBar (full-width perf bar).
const CX = 50;
const CY = 60;
const R = 44;
const START = 220;
const SWEEP = 260;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Colour ramp by value — cyan → yellow → orange → red (matches `_ecPalette`).
function palette(v: number): [string, string, string] {
  if (v < 50) return ['rgba(0,200,215,0.65)', 'rgba(140,245,255,1)', 'rgba(0,200,215,0.4)'];
  if (v < 75) return ['rgba(234,179,8,0.7)', 'rgba(255,224,60,1)', 'rgba(234,179,8,0.38)'];
  if (v < 90) return ['rgba(255,107,43,0.72)', 'rgba(255,176,85,1)', 'rgba(255,107,43,0.42)'];
  return ['rgba(239,68,68,0.78)', 'rgba(255,124,124,1)', 'rgba(239,68,68,0.48)'];
}
const polar = (deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
};
// Clockwise arc between two angles (degrees, math convention).
function arcPath(from: number, to: number): string {
  const [x1, y1] = polar(from);
  const [x2, y2] = polar(to);
  const large = Math.abs(from - to) > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function Gauge({
  value,
  className,
  unit = '%',
  sublabel,
  display,
}: {
  value: number;
  className?: string;
  /** Center unit glyph (default '%'; pass '°' for temperature). */
  unit?: string;
  /** Small caption under the value (e.g. 'Celsius'). */
  sublabel?: string;
  /** Override the centre number (fill/colour still track `value`, 0–100) — e.g.
   *  a temp gauge fills on the °C scale but shows a °F number. */
  display?: number;
}) {
  const v = clamp(value, 0, 100);
  const [a, b, glow] = palette(v);
  const gid = 'gauge-' + useId().replace(/:/g, '');
  const end = START - (v / 100) * SWEEP;
  return (
    <div className={'gauge-wrap' + (className ? ' ' + className : '')}>
      <svg className="gauge-ec" viewBox="0 0 100 100" width="100" height="100" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        </defs>
        <path d={arcPath(START, -40)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" strokeLinecap="round" />
        <path
          d={arcPath(START, end)}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${glow})`, transition: 'all 0.5s var(--ease-default)' }}
        />
      </svg>
      <div className="gauge-val">
        <span className="gauge-num">
          <span className="gauge-n">{display ?? Math.round(v)}</span>
          <span className="gauge-u">{unit}</span>
        </span>
        {sublabel && <span className="gauge-sub">{sublabel}</span>}
      </div>
    </div>
  );
}

/** Up/down throughput chevron — green up, cyan down. */
export const NetArrow = ({ down }: { down?: boolean }) => (
  <svg viewBox="0 0 14 14" fill="none" stroke={down ? 'var(--cyan)' : 'var(--green)'} strokeWidth="1.6" strokeLinecap="round" width="12" height="12" aria-hidden="true">
    {down ? (
      <>
        <line x1="7" y1="2" x2="7" y2="12" />
        <polyline points="3.5,8.5 7,12 10.5,8.5" />
      </>
    ) : (
      <>
        <line x1="7" y1="12" x2="7" y2="2" />
        <polyline points="3.5,5.5 7,2 10.5,5.5" />
      </>
    )}
  </svg>
);

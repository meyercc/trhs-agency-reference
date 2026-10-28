import React, { useId, useRef } from 'react';
import { DEFAULT_FAN_CURVE, FAN_T_MAX, FAN_T_MIN, fanSpeedAt, type FanCurvePoint } from '../state/fanCurve';

export interface FanCurveProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** The eight stops. Defaults to the default curve. */
  points?: readonly FanCurvePoint[];
  /** Present → the points drag (pointer) and step (arrow keys). Absent → read-only. */
  onChange?: (points: FanCurvePoint[]) => void;
  /** The current reference temperature, °C — drawn as a hairline and a mark on the curve. */
  liveTemp?: number;
  /** Line and area only, no axes — for a card or a chat bubble. */
  compact?: boolean;
  /** Accessible name for the group of point sliders. */
  'aria-label'?: string;
}

// Geometry in viewBox units. The SVG scales to its box; the padding leaves
// room for the tick labels, which the compact variant does not draw.
const W = 340;
const H = 210;
const PAD = { l: 40, r: 16, t: 18, b: 30 };
const PAD_COMPACT = { l: 2, r: 2, t: 4, b: 2 };
const H_COMPACT = 60;
const STEP = 5; // arrow-key increment, %
const SPEED_TICKS = [0, 25, 50, 75, 100];
const SPEED_LABELS = ['Min', '25%', '50%', '75%', 'Max'];
const TEMP_TICKS = Array.from({ length: 5 }, (_, i) => FAN_T_MIN + i * 10);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The design system's fan curve (`.ds-fan-curve`, shared/components.css):
 * fan speed against temperature, eight stops. With `onChange` each stop is a
 * vertical slider — drag it, or focus it and use the arrow keys (Home/End for
 * 0/100) — so the curve is fully keyboard-operable, which the editor it
 * replaces was not. Temperatures are fixed; only speeds move.
 *
 * One model everywhere (state/fanCurve.ts): the OMEN AI modal edits it, the
 * Performance card shows it compact, a Nova reply can carry it live.
 *
 * Avalonia: a Canvas-based templated control bound to an ObservableCollection
 * of points, each stop a Thumb with its own automation peer (RangeValue).
 */
export function FanCurve({ points = DEFAULT_FAN_CURVE, onChange, liveTemp, compact = false, className, 'aria-label': ariaLabel = 'Fan curve', ...rest }: FanCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId();
  const editable = !!onChange;
  const pad = compact ? PAD_COMPACT : PAD;
  const h = compact ? H_COMPACT : H;
  const tToX = (t: number) => pad.l + ((t - FAN_T_MIN) / (FAN_T_MAX - FAN_T_MIN)) * (W - pad.l - pad.r);
  const rToY = (r: number) => pad.t + ((100 - r) / 100) * (h - pad.t - pad.b);
  const yToR = (y: number) => clamp(Math.round(100 - ((y - pad.t) / (h - pad.t - pad.b)) * 100), 0, 100);

  const setPoint = (i: number, r: number) => onChange?.(points.map((p, j) => (j === i ? { ...p, r: clamp(r, 0, 100) } : p)));

  // Drag: grab the nearest stop within reach, then follow the pointer's y.
  const onPointerDown = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg || !editable) return;
    const rect = svg.getBoundingClientRect();
    const sx = W / rect.width;
    const sy = h / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;
    let ci = -1;
    let md = 18;
    points.forEach((p, i) => {
      const d = Math.hypot(tToX(p.t) - mx, rToY(p.r) - my);
      if (d < md) {
        md = d;
        ci = i;
      }
    });
    if (ci === -1) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r2 = svg.getBoundingClientRect();
      setPoint(ci, yToR((ev.clientY - r2.top) * sy));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent) => {
    if (!editable) return;
    const r = points[i].r;
    const next =
      e.key === 'ArrowUp' || e.key === 'ArrowRight' ? r + STEP
      : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? r - STEP
      : e.key === 'PageUp' ? r + STEP * 4
      : e.key === 'PageDown' ? r - STEP * 4
      : e.key === 'Home' ? 0
      : e.key === 'End' ? 100
      : null;
    if (next == null) return;
    e.preventDefault();
    setPoint(i, next);
  };

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${tToX(p.t)} ${rToY(p.r)}`).join(' ');
  const area = `${line} L ${tToX(points[points.length - 1].t)} ${h - pad.b} L ${tToX(points[0].t)} ${h - pad.b} Z`;
  const live = liveTemp != null ? { x: tToX(clamp(liveTemp, FAN_T_MIN, FAN_T_MAX)), y: rToY(fanSpeedAt(points, liveTemp)) } : null;

  const classes = ['ds-fan-curve', compact ? 'compact' : '', editable ? 'editable' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${h}`}
        className="ds-fan-curve-svg"
        role={editable ? 'group' : 'img'}
        aria-label={ariaLabel}
        preserveAspectRatio={compact ? 'none' : 'xMidYMid meet'}
        onPointerDown={onPointerDown}
      >
        {!compact && (
          <>
            {SPEED_TICKS.map((r) => (
              <line key={r} x1={pad.l} y1={rToY(r)} x2={W - pad.r} y2={rToY(r)} className="ds-fan-curve-grid" />
            ))}
            {TEMP_TICKS.map((t) => (
              <line key={t} x1={tToX(t)} y1={pad.t} x2={tToX(t)} y2={h - pad.b} className="ds-fan-curve-grid" />
            ))}
            {SPEED_LABELS.map((l, i) => (
              <text key={l} x={pad.l - 6} y={rToY(i * 25) + 3} textAnchor="end" className="ds-fan-curve-tick">
                {l}
              </text>
            ))}
            {TEMP_TICKS.map((t) => (
              <text key={t} x={tToX(t)} y={h - pad.b + 13} textAnchor="middle" className="ds-fan-curve-tick">
                {t}°
              </text>
            ))}
            <text x={pad.l + (W - pad.l - pad.r) / 2} y={h - 4} textAnchor="middle" className="ds-fan-curve-axis">
              Temperature (°C)
            </text>
            <text x={10} y={pad.t + (h - pad.t - pad.b) / 2} textAnchor="middle" className="ds-fan-curve-axis" transform={`rotate(-90 10 ${pad.t + (h - pad.t - pad.b) / 2})`}>
              Fan Speed
            </text>
          </>
        )}
        <path d={area} className="ds-fan-curve-area" />
        <path d={line} className="ds-fan-curve-line" />
        {live && (
          <>
            <line x1={live.x} y1={pad.t} x2={live.x} y2={h - pad.b} className="ds-fan-curve-live" />
            <circle cx={live.x} cy={live.y} r={compact ? 2.5 : 3.5} className="ds-fan-curve-live-dot" />
          </>
        )}
        {!compact &&
          points.map((p, i) => (
            <circle
              key={p.t}
              cx={tToX(p.t)}
              cy={rToY(p.r)}
              r={5.5}
              className="ds-fan-curve-point"
              tabIndex={editable ? 0 : undefined}
              role={editable ? 'slider' : undefined}
              aria-label={editable ? `Fan speed at ${p.t}°C` : undefined}
              aria-valuemin={editable ? 0 : undefined}
              aria-valuemax={editable ? 100 : undefined}
              aria-valuenow={editable ? p.r : undefined}
              aria-valuetext={editable ? `${p.r}%` : undefined}
              aria-orientation={editable ? 'vertical' : undefined}
              id={`${uid}-${p.t}`}
              onKeyDown={onKeyDown(i)}
            />
          ))}
      </svg>
    </div>
  );
}

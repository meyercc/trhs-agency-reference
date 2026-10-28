/**
 * The fan curve — fan speed (%) against temperature (°C), as eight points the
 * person drags. One model for everywhere the curve appears: the Settings store
 * it lives in, the OMEN AI modal's editor, the Performance page's card, and a
 * Nova reply (TH-436). Until TH-436 the editor held it in local view-state and
 * the Performance card drew a hand-authored path: two curves, neither saved.
 *
 * Temperatures are fixed stops; only the speed at each moves. That is what
 * keeps the curve monotone-friendly and the editor a one-axis drag.
 */
export interface FanCurvePoint {
  /** °C — fixed per point. */
  t: number;
  /** Fan speed, 0–100 %. */
  r: number;
}

export const FAN_T_MIN = 50;
export const FAN_T_MAX = 90;

export const DEFAULT_FAN_CURVE: readonly FanCurvePoint[] = [
  { t: 50, r: 20 }, { t: 55, r: 25 }, { t: 60, r: 32 }, { t: 65, r: 42 },
  { t: 70, r: 55 }, { t: 75, r: 68 }, { t: 80, r: 80 }, { t: 90, r: 95 },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A stored curve, or the default for anything that is not eight sane points. */
export function normalizeFanCurve(raw: unknown): FanCurvePoint[] {
  if (!Array.isArray(raw) || raw.length !== DEFAULT_FAN_CURVE.length) return [...DEFAULT_FAN_CURVE];
  const ok = raw.every((p, i) => p && typeof p.r === 'number' && Number.isFinite(p.r) && p.t === DEFAULT_FAN_CURVE[i].t);
  if (!ok) return [...DEFAULT_FAN_CURVE];
  return (raw as FanCurvePoint[]).map((p) => ({ t: p.t, r: clamp(Math.round(p.r), 0, 100) }));
}

/** The speed the curve asks for at a temperature — linear between stops. */
export function fanSpeedAt(points: readonly FanCurvePoint[], temp: number): number {
  if (temp <= points[0].t) return points[0].r;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (temp <= b.t) return Math.round(a.r + ((temp - a.t) / (b.t - a.t)) * (b.r - a.r));
  }
  return points[points.length - 1].r;
}

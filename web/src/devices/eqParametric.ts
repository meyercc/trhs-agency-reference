// ══════════════════════════════════════════════════════════════════════════
// Parametric equalizer — the band model and the response math.
//
// Pure and React-free, like eqData.tsx: the Advanced Equalizer modal draws
// what these functions say, and a script can check the math without a
// browser. The response is a real biquad cascade (the RBJ Audio EQ Cookbook),
// not a spline through the points — a shelf looks like a shelf and a narrow Q
// looks narrow because the numbers are right, not because a curve was drawn to
// look right.
// ══════════════════════════════════════════════════════════════════════════

import type { IconName } from '../components/icon-names';
import type { CustomEqPreset } from '../state/Settings';
import { curveFromGains, EQ_DB_MAX, EQ_DB_MIN } from './eqData';

export type EqFilterType = 'lowpass' | 'highpass' | 'peak' | 'lowshelf' | 'highshelf';

/** One band of a parametric preset. `on: false` bypasses it (kept, not deleted). */
export interface EqBandParam {
  type: EqFilterType;
  hz: number;
  /** dB. For the pass filters it is makeup gain — a flat offset, so the point still moves. */
  gain: number;
  q: number;
  on: boolean;
}

export const EQ_HZ_MIN = 20;
export const EQ_HZ_MAX = 20000;
export const EQ_Q_MIN = 0.1;
export const EQ_Q_MAX = 10;
export const EQ_Q_DEFAULT = 0.5;
export const EQ_GAIN_STEP = 0.5;
export const EQ_Q_STEP = 0.05;

/** The ten fixed bands, one per point on the graph. Every preset has all ten. */
export const PARAMETRIC_HZ = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
export const PARAMETRIC_BAND_COUNT = PARAMETRIC_HZ.length;

/** The filter types in the order the picker shows them. `icon` is a sprite symbol. */
export const FILTER_TYPES: { type: EqFilterType; label: string; icon: IconName }[] = [
  { type: 'lowpass', label: 'Low Pass', icon: 'eq-lowpass' },
  { type: 'highpass', label: 'High Pass', icon: 'eq-highpass' },
  { type: 'peak', label: 'Peak', icon: 'eq-peak' },
  { type: 'lowshelf', label: 'Low Shelf', icon: 'eq-lowshelf' },
  { type: 'highshelf', label: 'High Shelf', icon: 'eq-highshelf' },
];

export const filterLabel = (t: EqFilterType) => FILTER_TYPES.find((f) => f.type === t)?.label ?? t;

export const defaultBand = (i: number): EqBandParam => ({
  type: 'peak',
  hz: PARAMETRIC_HZ[i] ?? 1000,
  gain: 0,
  q: EQ_Q_DEFAULT,
  on: true,
});
export const defaultBands = (): EqBandParam[] => PARAMETRIC_HZ.map((_, i) => defaultBand(i));

/** Named ranges over the graph, edge to edge. Widths on the graph follow the log scale. */
export const PARAMETRIC_GROUPS: { group: string; from: number; to: number }[] = [
  { group: 'Sub-Bass', from: 20, to: 80 },
  { group: 'Bass', from: 80, to: 300 },
  { group: 'Low Mids', from: 300, to: 600 },
  { group: 'Mids', from: 600, to: 2000 },
  { group: 'High Mids', from: 2000, to: 4000 },
  { group: 'Highs', from: 4000, to: 20000 },
];

/** Frequency ticks along the bottom of the graph. */
export const PARAMETRIC_HZ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

// ── Scales ───────────────────────────────────────────────────────────────────

const LOG_SPAN = Math.log10(EQ_HZ_MAX / EQ_HZ_MIN);

/** 0..1 across the graph for a frequency, log scale. */
export const hzToUnit = (hz: number) => Math.log10(clampHz(hz) / EQ_HZ_MIN) / LOG_SPAN;
/** One octave, as a share of the plot's width. */
export const OCTAVE_UNIT = Math.log10(2) / LOG_SPAN;
export const unitToHz = (u: number) => EQ_HZ_MIN * Math.pow(10, Math.min(1, Math.max(0, u)) * LOG_SPAN);

/** 0..1 down the graph for a gain: +12 dB at the top edge of the plot, -12 at the bottom. */
export const dbToUnit = (db: number) => (EQ_DB_MAX - clampDb(db)) / (EQ_DB_MAX - EQ_DB_MIN);
export const unitToDb = (u: number) => EQ_DB_MAX - Math.min(1, Math.max(0, u)) * (EQ_DB_MAX - EQ_DB_MIN);

export const clampHz = (hz: number) => Math.min(EQ_HZ_MAX, Math.max(EQ_HZ_MIN, hz));
export const clampDb = (db: number) => Math.min(EQ_DB_MAX, Math.max(EQ_DB_MIN, db));
export const clampQ = (q: number) => Math.min(EQ_Q_MAX, Math.max(EQ_Q_MIN, q));
/**
 * Half the band's width in octaves, from Q — the RBJ relation
 * BW = (2/ln2)·asinh(1/2Q). The graph draws the band's edges at
 * f0·2^±half and reads Q back from where an edge is dragged to.
 */
export const qToHalfOctaves = (q: number) => Math.asinh(1 / (2 * clampQ(q))) / Math.LN2;
export const halfOctavesToQ = (half: number) => clampQ(1 / (2 * Math.sinh(Math.LN2 * Math.max(1e-6, half))));

/** A sensible step for the frequency stepper at a given frequency. */
export const hzStep = (hz: number) => (hz < 100 ? 1 : hz < 1000 ? 10 : 100);

export const formatHzValue = (hz: number) =>
  hz >= 1000 ? `${+(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz` : `${+hz.toFixed(1)} Hz`;
export const formatDb = (db: number) => `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
export const formatQ = (q: number) => q.toFixed(2);

/** "2.5k", "2.5 kHz", "250", "250hz" → Hz, or null when it is not a frequency. */
export function parseHz(text: string): number | null {
  const m = /^\s*([\d.]+)\s*(k)?\s*(hz)?\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] ? n * 1000 : n;
}

// ── Response ─────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 48000;

/** Magnitude response of one band at `f`, in dB. A bypassed band is 0 dB. */
export function bandResponseDb(b: EqBandParam, f: number): number {
  if (!b.on) return 0;
  const w0 = (2 * Math.PI * b.hz) / SAMPLE_RATE;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const A = Math.pow(10, b.gain / 40);
  const alpha = sin / (2 * b.q);
  const sA = Math.sqrt(A);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  switch (b.type) {
    case 'peak':
      b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
      break;
    case 'lowshelf':
      b0 = A * (A + 1 - (A - 1) * cos + 2 * sA * alpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cos);
      b2 = A * (A + 1 - (A - 1) * cos - 2 * sA * alpha);
      a0 = A + 1 + (A - 1) * cos + 2 * sA * alpha;
      a1 = -2 * (A - 1 + (A + 1) * cos);
      a2 = A + 1 + (A - 1) * cos - 2 * sA * alpha;
      break;
    case 'highshelf':
      b0 = A * (A + 1 + (A - 1) * cos + 2 * sA * alpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - 2 * sA * alpha);
      a0 = A + 1 - (A - 1) * cos + 2 * sA * alpha;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - 2 * sA * alpha;
      break;
    case 'lowpass':
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case 'highpass':
    default:
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
  }
  // |H(e^jw)| with z⁻¹ = e^(-jw).
  const w = (2 * Math.PI * f) / SAMPLE_RATE;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  const mag = Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
  const db = 20 * Math.log10(Math.max(mag, 1e-9));
  // The pass filters have no gain of their own; the band's gain is makeup.
  return b.type === 'lowpass' || b.type === 'highpass' ? db + b.gain : db;
}

/** The whole cascade at `f`, in dB. */
export const responseDb = (bands: EqBandParam[], f: number) =>
  bands.reduce((sum, b) => sum + bandResponseDb(b, f), 0);

/** Log-spaced sample frequencies across the graph. */
export function sampleHz(n = 160): number[] {
  return Array.from({ length: n }, (_, i) => unitToHz(i / (n - 1)));
}

/**
 * SVG paths for the composite curve inside a `w`×`h` plot whose ±12 dB lines
 * sit at the top and bottom edges. `line` is the curve; `fill` closes it to the
 * 0 dB line so a boost fills up and a cut fills down.
 */
export function responsePaths(bands: EqBandParam[], w: number, h: number, n = 160): { line: string; fill: string } {
  const pts = sampleHz(n).map((f, i) => {
    const x = (i / (n - 1)) * w;
    const y = dbToUnit(responseDb(bands, f)) * h;
    return [+x.toFixed(2), +y.toFixed(2)] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  // The fill is the area under the curve, down to the graph's floor (Figma
  // Audio 7364:430990), not toward 0 dB.
  const fill = `${line} L${w} ${h} L0 ${h} Z`;
  return { line, fill };
}

/**
 * The 40×14 curve glyph for a parametric preset, so it draws the same way a
 * simple preset does in the headset panel's list (see eqData.curveFromGains).
 */
export function curveFromParams(bands: EqBandParam[]): string {
  const n = 9;
  return sampleHz(n)
    .map((f, i) => {
      const x = 1 + (i / (n - 1)) * 38;
      const y = 7 - (clampDb(responseDb(bands, f)) / EQ_DB_MAX) * 5;
      return `${+x.toFixed(1)},${+y.toFixed(1)}`;
    })
    .join(' ');
}

/** True when every band is at rest — the preset would apply nothing. */
export const isFlat = (bands: EqBandParam[]) => bands.every((b) => !b.on || b.gain === 0);

/** The row glyph for any user preset, whichever editor made it. */
export const presetCurve = (p: CustomEqPreset) =>
  p.kind === 'parametric' ? curveFromParams(p.params) : curveFromGains(p.gains);

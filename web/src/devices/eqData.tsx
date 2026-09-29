// ══════════════════════════════════════════════════════════════════════════
// Equalizer data + the shared curve glyph.
//
// Shared by the headset Audio panel's preset list and the Simple Equalizer
// modal, so a preset draws the same curve wherever it appears. Factory presets
// carry a hand-drawn curve; a user-made preset derives one from its gains.
// ══════════════════════════════════════════════════════════════════════════

/** Factory curve presets. SKU data names which of these a headset carries. */
export const EQ_PRESETS: Record<string, { label: string; points: string }> = {
  balanced: { label: 'Balanced', points: '1,7 10,7 20,7 30,7 39,7' },
  gaming: { label: 'Gaming', points: '1,4 10,7 20,8 30,7 39,3' },
  voice: { label: 'Voice Chat', points: '1,10 10,8 20,3 30,8 39,10' },
  bassboost: { label: 'Bass Boost', points: '1,3 10,4 20,8 30,9 39,9' },
  basscut: { label: 'Bass Cut', points: '1,12 10,10 20,7 30,6 39,6' },
  trebleboost: { label: 'Treble Boost', points: '1,9 10,9 20,8 30,4 39,3' },
  treblecut: { label: 'Treble Cut', points: '1,6 10,6 20,7 30,10 39,12' },
};

/** The range every simple-EQ band moves in — matches the headset type defaults. */
export const EQ_DB_MIN = -12;
export const EQ_DB_MAX = 12;
/** Axis ticks down the left of the editor, top to bottom. */
export const EQ_DB_TICKS = [12, 6, 0, -6, -12];

export interface EqBand {
  hz: number;
  /** Which named range this band belongs to — the header pills group by it. */
  group: string;
}

/**
 * Simple-EQ band sets. This is component data, like the keyboard layout or the
 * surround-stage geometry — NOT `features.audio.equalizer.bands`. The band
 * count is the user's choice in the modal footer, not a SKU capability, so it
 * cannot come from the SKU.
 *
 * The five group names are the same in both sets: they name frequency RANGES,
 * and a range does not stop being itself when you subdivide it. So switching to
 * 10 bands splits each named range in two rather than inventing ten new names.
 */
export const SIMPLE_BANDS_5: EqBand[] = [
  { hz: 125, group: 'Bass' },
  { hz: 250, group: 'Low Mids' },
  { hz: 1000, group: 'Mids' },
  { hz: 4000, group: 'High Mids' },
  { hz: 8000, group: 'Highs' },
];

export const SIMPLE_BANDS_10: EqBand[] = [
  { hz: 31, group: 'Bass' },
  { hz: 62, group: 'Bass' },
  { hz: 125, group: 'Low Mids' },
  { hz: 250, group: 'Low Mids' },
  { hz: 500, group: 'Mids' },
  { hz: 1000, group: 'Mids' },
  { hz: 2000, group: 'High Mids' },
  { hz: 4000, group: 'High Mids' },
  { hz: 8000, group: 'Highs' },
  { hz: 16000, group: 'Highs' },
];

export type BandCount = 5 | 10;

export const bandsFor = (count: BandCount): EqBand[] =>
  count === 10 ? SIMPLE_BANDS_10 : SIMPLE_BANDS_5;

/** 125 → "125 Hz", 1000 → "1 kHz", 16000 → "16 kHz". */
export function formatHz(hz: number): string {
  return hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`;
}

/** Consecutive bands sharing a group, as [group, span] pairs for the header row. */
export function bandGroups(bands: EqBand[]): { group: string; span: number }[] {
  const out: { group: string; span: number }[] = [];
  for (const b of bands) {
    const last = out[out.length - 1];
    if (last && last.group === b.group) last.span += 1;
    else out.push({ group: b.group, span: 1 });
  }
  return out;
}

/**
 * Gains → the polyline of the 40×14 curve glyph, so a user preset gets the same
 * treatment as a factory one. y is inverted (SVG grows down) and 0 dB sits on
 * the center line, matching the hand-drawn factory curves.
 */
export function curveFromGains(gains: number[]): string {
  if (gains.length === 0) return '1,7 39,7';
  const span = 38;
  return gains
    .map((g, i) => {
      const x = 1 + (gains.length === 1 ? span / 2 : (i / (gains.length - 1)) * span);
      const y = 7 - (Math.max(EQ_DB_MIN, Math.min(EQ_DB_MAX, g)) / EQ_DB_MAX) * 5;
      return `${+x.toFixed(1)},${+y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Resample gains onto a different band count, so switching 5 ⇄ 10 keeps the
 * curve the user drew instead of flattening it. Linear interpolation across the
 * normalised position of each band.
 */
export function resampleGains(gains: number[], to: number): number[] {
  if (gains.length === to) return [...gains];
  if (gains.length === 0) return Array(to).fill(0);
  if (gains.length === 1) return Array(to).fill(gains[0]);
  return Array.from({ length: to }, (_, i) => {
    const pos = (i / (to - 1)) * (gains.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(gains.length - 1, lo + 1);
    const t = pos - lo;
    return Math.round((gains[lo] * (1 - t) + gains[hi] * t) * 10) / 10;
  });
}

/** Test-bench clips. Named by what they exercise, not by track title. */
export const TEST_CLIPS = [
  { label: 'Footsteps & positional cues', value: 'footsteps' },
  { label: 'Explosions & low end', value: 'explosions' },
  { label: 'Voice chat', value: 'voice' },
  { label: 'Music — full range', value: 'music' },
];

/** The shared curve glyph. */
export function EqCurve({ points }: { points: string }) {
  return (
    <svg className="hc-eq-curve" viewBox="0 0 40 14" fill="none" aria-hidden="true">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

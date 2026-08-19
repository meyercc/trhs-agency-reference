// ══════════════════════════════════════════════════════════════════════════════
// LIGHTING DATA — presets + colour maths for the keyboard modal's Lighting tab.
// Ported from the vanilla `personalize-peripherals.js` (LIGHT_PRESETS + the
// HSL↔hex↔rgb helpers + the preset-editor swatch palette).
// ══════════════════════════════════════════════════════════════════════════════

import type { IconName } from '../components';

const RAINBOW =
  'linear-gradient(90deg, #e02020, #fa6400 17%, #f7b500 33%, #6dd400 50%, #0091ff 67%, #6236ff 83%, #b620e0)';

export interface LightPreset {
  id: string;
  name: string;
  /** CSS background for the preset swatch. */
  swatch: string;
  /** "r,g,b" — the hero glow + all-key colour when applied. */
  glow: string;
  /** effect glyph (icon name). */
  fx: IconName;
}

let _seq = 0;
const uid = () => `preset-${_seq++}`;

const RAW_PRESETS: Omit<LightPreset, 'id'>[] = [
  { name: 'Wave', swatch: RAINBOW, glow: '0,145,255', fx: 'wave' },
  { name: 'Rainbow Wave', swatch: RAINBOW, glow: '109,212,0', fx: 'rainbow' },
  { name: 'Lakers', swatch: 'linear-gradient(135deg, #552583, #fdb927)', glow: '152,86,200', fx: 'fade' },
  { name: 'Orange', swatch: '#ff6600', glow: '255,102,0', fx: 'solid' },
  { name: 'Touch Grass', swatch: '#6dd400', glow: '109,212,0', fx: 'solid' },
  { name: 'Ocean', swatch: '#44d7b6', glow: '68,215,182', fx: 'wave' },
  { name: 'Pastel Confetti', swatch: 'linear-gradient(135deg, #f9a8d4, #a5b4fc, #fcd34d)', glow: '165,180,252', fx: 'confetti' },
  { name: 'Cotton Candy', swatch: 'linear-gradient(135deg, #f9a8d4, #93c5fd)', glow: '249,168,212', fx: 'fade' },
  { name: 'Banana', swatch: '#f7b500', glow: '247,181,0', fx: 'solid' },
  { name: 'Midnight Purple', swatch: '#6236ff', glow: '98,54,255', fx: 'solid' },
  { name: 'Pretty Pink', swatch: '#ec4899', glow: '236,72,153', fx: 'solid' },
  { name: 'HyperX Red', swatch: '#c8102e', glow: '200,16,46', fx: 'solid' },
  { name: 'Blue Skye', swatch: '#0091ff', glow: '0,145,255', fx: 'solid' },
  { name: 'Campfire', swatch: 'linear-gradient(135deg, #ff6600, #e02020)', glow: '255,102,0', fx: 'flame' },
  { name: 'Captain America', swatch: 'linear-gradient(135deg, #0091ff 42%, #f9f9f8 50%, #e02020 58%)', glow: '0,145,255', fx: 'color-palette' },
  { name: 'Vibes', swatch: 'linear-gradient(135deg, #b620e0, #0091ff)', glow: '182,32,224', fx: 'fade' },
];

export const LIGHT_PRESETS: LightPreset[] = RAW_PRESETS.map((p) => ({ id: uid(), ...p }));

/** Default editor swatch palette. */
export const SWATCHES = [
  '#e02020', '#ff6600', '#f7b500', '#6dd400', '#44d7b6',
  '#32c5ff', '#0091ff', '#6236ff', '#b620e0',
];

/** Hue-band gradient for the hue slider track. */
export const HUE_GRADIENT = 'linear-gradient(90deg,#ff0000,#ff0,#0f0,#0ff,#00f,#f0f,#ff0000)';

// ── Colour maths — HSL (h 0-360, s/l 0-100) ↔ rgb/hex ────────────────────────

export interface Hsl {
  h: number;
  s: number;
  l: number;
  a: number;
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as [number, number, number];
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

export const hslToHex = (h: number, s: number, l: number): string =>
  '#' + hslToRgb(h, s, l).map(hex2).join('');

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let x = hex.replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  return rgbToHsl(parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16));
}

/** `rgb(...)` string for an HSL colour (ignores alpha — used to paint keys). */
export const hslToRgbStr = (c: Hsl): string => {
  const [r, g, b] = hslToRgb(c.h, c.s, c.l);
  return `rgb(${r}, ${g}, ${b})`;
};

/** Regex for a valid 3/6-digit hex (no #). */
export const HEX_RE = /^[0-9a-f]{6}$|^[0-9a-f]{3}$/i;

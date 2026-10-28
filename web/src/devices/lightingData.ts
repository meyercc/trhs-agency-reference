// ══════════════════════════════════════════════════════════════════════════════
// LIGHTING DATA — presets + color maths for the keyboard modal's Lighting tab.
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
  /** "r,g,b" — the hero glow + all-key color when applied. */
  glow: string;
  /** effect glyph (icon name). */
  fx: IconName;
  /**
   * The effect stack, bottom first, when the preset was made in the editor.
   * A preset without it reads as one layer (`layersOf`); `swatch`, `glow` and
   * `fx` are kept in step with the first layer so everything that shows a
   * preset (the grid, the drawn board, a profile file) still works.
   */
  layers?: EffectLayer[];
  /**
   * Where a factory preset came from. NGENUITY's list is unmarked; `omen` is
   * an OMEN Gaming Hub effect kept as a preset (Chris, 2026-10-21: all lighting
   * runs on NGENUITY's engine, and OMEN's effects join the library as factory
   * presets rather than a second editor). The grid lists them after NGENUITY's
   * in one list, with no label naming OGH (design review, 2026-10-22).
   */
  origin?: 'omen';
}

/** The effects a layer can play. `solid` takes one color; the rest a palette. */
export type EffectFx = 'solid' | 'wave' | 'rainbow' | 'fade' | 'confetti' | 'flame' | 'color-palette';

export const EFFECTS: { fx: EffectFx; label: string }[] = [
  { fx: 'solid', label: 'Solid' },
  { fx: 'wave', label: 'Wave' },
  { fx: 'rainbow', label: 'Rainbow' },
  { fx: 'fade', label: 'Fade' },
  { fx: 'confetti', label: 'Confetti' },
  { fx: 'flame', label: 'Flame' },
  { fx: 'color-palette', label: 'Color Palette' },
];
export const effectLabel = (fx: string) => EFFECTS.find((e) => e.fx === fx)?.label ?? fx;

/** One effect in a preset's stack. Colors are hex; a palette's stops are evenly spaced. */
export interface EffectLayer {
  fx: EffectFx;
  colors: string[];
  /** Degrees; 0 sweeps left to right. Only the sweeping effects read it. */
  angle: number;
  /** 0–100; 50 is the factory pace, 0 holds still. */
  speed: number;
  /** 0–100 — how much of the layers below shows through. */
  opacity: number;
}

/** A gradient has at most this many stops (Figma's Gradient Editor holds seven). */
export const MAX_STOPS = 7;

const hexesIn = (css: string) => css.match(/#[0-9a-f]{6}/gi) ?? [];
const rgbHex = (glow: string) => '#' + glow.split(',').map((n) => Number(n).toString(16).padStart(2, '0')).join('');

/** A preset's effect stack — its own, or the one its swatch and effect imply. */
export function layersOf(p: LightPreset): EffectLayer[] {
  if (p.layers?.length) return p.layers;
  const fx = (EFFECTS.some((e) => e.fx === p.fx) ? p.fx : 'solid') as EffectFx;
  const colors = hexesIn(p.swatch);
  return [{ fx, colors: fx === 'solid' ? [colors[0] ?? rgbHex(p.glow)] : colors.length ? colors : [rgbHex(p.glow)], angle: 0, speed: 50, opacity: 100 }];
}

/** A preset from an edited stack: the grid's swatch, glow and glyph follow the first layer. */
export function presetFromLayers(id: string, name: string, layers: EffectLayer[]): LightPreset {
  const base = layers[0];
  const first = base.colors[0];
  const swatch = base.colors.length > 1 ? `linear-gradient(90deg, ${base.colors.join(', ')})` : first;
  const glow = [1, 3, 5].map((i) => parseInt(first.slice(i, i + 2), 16)).join(',');
  return { id, name, swatch, glow, fx: base.fx, layers };
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
  // ── OMEN Gaming Hub's effects, as factory presets ──
  // The names are OGH's: the laptop Lighting page's row (Starlight … Sun) and
  // the ARGB Gen2 desktop's animations (OMEN, Blinking, Music, Spiral, System
  // Vitals; lightstudio/towerZones.ts as it stood on 2026-10-20). Wave and
  // Confetti already exist under NGENUITY's names and are not repeated. Each
  // runs the nearest effect this editor has; its colours are this prototype's
  // reading of the effect, not a sourced palette. They come LAST so the ids
  // of NGENUITY's presets (`preset-0` …) stay what saved profiles point at.
  { name: 'OMEN', swatch: 'linear-gradient(90deg, #c8102e, #ff4b5c, #c8102e)', glow: '200,16,46', fx: 'wave', origin: 'omen' },
  { name: 'Color Cycle', swatch: RAINBOW, glow: '224,32,32', fx: 'rainbow', origin: 'omen' },
  { name: 'Breathing', swatch: '#c8102e', glow: '200,16,46', fx: 'fade', origin: 'omen' },
  { name: 'Blinking', swatch: '#ffffff', glow: '255,255,255', fx: 'fade', origin: 'omen' },
  { name: 'Starlight', swatch: 'linear-gradient(135deg, #ffffff, #0091ff)', glow: '255,255,255', fx: 'confetti', origin: 'omen' },
  { name: 'Raindrop', swatch: 'linear-gradient(135deg, #0091ff, #44d7b6)', glow: '0,145,255', fx: 'confetti', origin: 'omen' },
  { name: 'Ripple', swatch: 'linear-gradient(90deg, #0091ff, #ffffff)', glow: '0,145,255', fx: 'wave', origin: 'omen' },
  { name: 'Spiral', swatch: 'linear-gradient(90deg, #6236ff, #0091ff, #44d7b6)', glow: '98,54,255', fx: 'wave', origin: 'omen' },
  { name: 'Rave', swatch: RAINBOW, glow: '182,32,224', fx: 'rainbow', origin: 'omen', layers: [{ fx: 'rainbow', colors: ['#e02020', '#fa6400', '#f7b500', '#6dd400', '#0091ff', '#6236ff', '#b620e0'], angle: 0, speed: 95, opacity: 100 }] },
  { name: 'Ghosting', swatch: '#b620e0', glow: '182,32,224', fx: 'fade', origin: 'omen' },
  { name: 'Music', swatch: 'linear-gradient(135deg, #b620e0, #0091ff, #6dd400)', glow: '182,32,224', fx: 'confetti', origin: 'omen' },
  { name: 'Audio Equalizer', swatch: 'linear-gradient(90deg, #6dd400, #f7b500, #e02020)', glow: '109,212,0', fx: 'wave', origin: 'omen' },
  { name: 'Sun', swatch: 'linear-gradient(135deg, #f7b500, #ff6600)', glow: '247,181,0', fx: 'flame', origin: 'omen' },
  { name: 'System Vitals', swatch: 'linear-gradient(90deg, #6dd400 33%, #f7b500 66%, #e02020)', glow: '109,212,0', fx: 'color-palette', origin: 'omen' },
];

export const LIGHT_PRESETS: LightPreset[] = RAW_PRESETS.map((p) => ({ id: uid(), ...p }));

/** The OMEN Gaming Hub effects in the factory list. */
export const OMEN_PRESETS: LightPreset[] = LIGHT_PRESETS.filter((p) => p.origin === 'omen');

/**
 * A stored library from before the OMEN presets (2026-10-21) gets them added
 * after what it holds. A person who deletes every one of them gets them back
 * on the next load — the cost of not keeping a separate "seen" flag in a
 * prototype; deleting some keeps the rest gone.
 */
export function withOmenPresets(list: LightPreset[]): LightPreset[] {
  if (list.some((p) => p.origin === 'omen')) return list;
  const have = new Set(list.map((p) => p.id));
  return [...list, ...OMEN_PRESETS.filter((p) => !have.has(p.id))];
}

/**
 * The editor's gradient presets — the palettes of the factory's multi-color
 * presets (Rainbow, Lakers, Pastel Confetti, Cotton Candy, Campfire, Vibes).
 * Product colors, not UI tokens.
 */
export const GRADIENT_PRESETS: string[][] = [
  ['#e02020', '#fa6400', '#f7b500', '#6dd400', '#0091ff', '#6236ff', '#b620e0'],
  ['#552583', '#fdb927'],
  ['#f9a8d4', '#a5b4fc', '#fcd34d'],
  ['#f9a8d4', '#93c5fd'],
  ['#ff6600', '#e02020'],
  ['#b620e0', '#0091ff'],
];

/** Default editor swatch palette. */
export const SWATCHES = [
  '#e02020', '#ff6600', '#f7b500', '#6dd400', '#44d7b6',
  '#32c5ff', '#0091ff', '#6236ff', '#b620e0',
];

/** Hue-band gradient for the hue slider track. */
export const HUE_GRADIENT = 'linear-gradient(90deg,#ff0000,#ff0,#0f0,#0ff,#00f,#f0f,#ff0000)';

// ── Color maths — HSL (h 0-360, s/l 0-100) ↔ rgb/hex ────────────────────────

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

/** `rgb(...)` string for an HSL color (ignores alpha — used to paint keys). */
export const hslToRgbStr = (c: Hsl): string => {
  const [r, g, b] = hslToRgb(c.h, c.s, c.l);
  return `rgb(${r}, ${g}, ${b})`;
};

/** Regex for a valid 3/6-digit hex (no #). */
export const HEX_RE = /^[0-9a-f]{6}$|^[0-9a-f]{3}$/i;

/**
 * A preset's color at `t` (0 = left, 1 = right) across a device, as "rgb(...)".
 * The swatch IS the preset's look: a rainbow preset spreads its rainbow across
 * the keys rather than painting them all its one glow color (Kristy,
 * 2026-10-14: Rainbow Wave painted the keyboard green). A solid swatch is one
 * color everywhere; Off has none and falls back to the glow.
 */
export function presetColorAt(p: Pick<LightPreset, 'swatch' | 'glow'>, t: number): string {
  const stops = [...p.swatch.matchAll(/#([0-9a-f]{6})(?:\s+([\d.]+)%)?/gi)].map((m, i, all) => ({
    rgb: [0, 2, 4].map((o) => parseInt(m[1].slice(o, o + 2), 16)),
    at: m[2] != null ? Number(m[2]) / 100 : all.length > 1 ? i / (all.length - 1) : 0,
  }));
  if (!stops.length) return `rgb(${p.glow})`;
  if (stops.length === 1 || t <= stops[0].at) return `rgb(${stops[0].rgb.join(',')})`;
  const last = stops[stops.length - 1];
  if (t >= last.at) return `rgb(${last.rgb.join(',')})`;
  const j = stops.findIndex((s) => s.at >= t);
  const a = stops[j - 1];
  const b = stops[j];
  const k = b.at === a.at ? 0 : (t - a.at) / (b.at - a.at);
  return `rgb(${a.rgb.map((v, i) => Math.round(v + (b.rgb[i] - v) * k)).join(',')})`;
}

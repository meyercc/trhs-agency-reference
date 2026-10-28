import { layersOf, type EffectLayer, type LightPreset } from './lightingData';

/**
 * How a lighting preset lights a key over time — the "live" half of the
 * Lights tab. A preset is a palette (the colors in its swatch) and an effect
 * (`fx`); `sampleEffect` turns those plus a key's place on the board and the
 * clock into one color. Pure functions; `KeyboardBacklight` draws them.
 */
export type Rgb = [number, number, number];

/** The colors in a preset's swatch — one for a solid, the gradient's stops otherwise. */
export function paletteOf(preset: LightPreset): Rgb[] {
  const hexes = preset.swatch.match(/#[0-9a-f]{6}/gi) ?? [];
  const colors = hexes.map(hex);
  return colors.length ? colors : [glowRgb(preset.glow)];
}

export const glowRgb = (glow: string): Rgb => glow.split(',').map(Number) as Rgb;
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** The palette read as a loop: `p` in 0–1 blends between its evenly spaced stops and wraps. */
export function sample(palette: Rgb[], p: number): Rgb {
  if (palette.length === 1) return palette[0];
  const u = ((p % 1) + 1) % 1;
  const span = u * palette.length;
  const i = Math.floor(span);
  const f = span - i;
  const a = palette[i % palette.length];
  const b = palette[(i + 1) % palette.length];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** A stable 0–1 per key, for effects that treat each key on its own. */
export const phaseOf = (code: string) => {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
};

/** Effects that move. The rest draw once. */
export const ANIMATED = new Set<string>(['wave', 'rainbow', 'fade', 'confetti', 'flame']);

/**
 * A key's color under `preset` at time `t` (seconds). `u`/`v` are the key's
 * center across and down the board, 0–1. Returns the color and an intensity
 * 0–1 (how lit the key is right now).
 */
export function sampleEffect(preset: LightPreset, palette: Rgb[], code: string, u: number, v: number, t: number): { rgb: Rgb; level: number } {
  const phase = phaseOf(code);
  switch (preset.fx) {
    // The Figma "Wave": the palette sweeps across the board. A one-color wave
    // is a ripple of brightness instead.
    case 'wave':
      return palette.length > 1
        ? { rgb: sample(palette, u - t * 0.12), level: 1 }
        : { rgb: palette[0], level: 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (u - t * 0.3))) };
    // The whole board cycles through the palette, a little behind on the right.
    case 'rainbow':
      return { rgb: sample(palette, t * 0.08 + u * 0.15), level: 1 };
    // Breathes from one palette color to the next.
    case 'fade':
      return { rgb: sample(palette, t * 0.07), level: 0.7 + 0.3 * Math.sin(t * 1.4) };
    // Every key its own color, twinkling on its own clock.
    case 'confetti':
      return { rgb: sample(palette, phase), level: 0.25 + 0.75 * Math.abs(Math.sin(t * 1.6 + phase * 6.28)) };
    // Flicker, hotter at the bottom of the board.
    case 'flame': {
      const n = 0.5 + 0.5 * Math.sin(t * 5.2 + phase * 6.28) * Math.sin(t * 2.1 + phase * 12.6);
      return { rgb: sample(palette, n * 0.5), level: 0.55 + 0.45 * n * (0.6 + 0.4 * v) };
    }
    // Static bands of the palette across the board.
    case 'color-palette':
      return { rgb: sample(palette, u * (palette.length - 1) / palette.length), level: 1 };
    default:
      return { rgb: palette[0], level: 1 };
  }
}

/** A layer's palette as channels. */
export const layerPalette = (layer: EffectLayer): Rgb[] => (layer.colors.length ? layer.colors.map(hex) : [[255, 255, 255]]);

/** Effects that sweep across the board, and so read a direction. */
const SWEEPS = new Set(['wave', 'rainbow', 'color-palette']);

/**
 * One layer's color and intensity on a key: the preset sampler with the
 * layer's direction (the sweep runs along `angle`) and speed (a time scale;
 * 50 is the factory pace, 0 holds still).
 */
export function sampleLayer(layer: EffectLayer, palette: Rgb[], code: string, u: number, v: number, t: number): { rgb: Rgb; level: number } {
  let along = u;
  if (SWEEPS.has(layer.fx)) {
    const a = (layer.angle * Math.PI) / 180;
    along = 0.5 + (u - 0.5) * Math.cos(a) + (v - 0.5) * Math.sin(a);
  }
  const fake = { fx: layer.fx, swatch: '', glow: '255,255,255', id: '', name: '' } as LightPreset;
  return sampleEffect(fake, palette, code, along, v, t * (layer.speed / 50));
}

/** Does any layer of this preset move? */
export const presetMoves = (preset: LightPreset) => layersOf(preset).some((l) => ANIMATED.has(l.fx) && l.speed > 0);

/**
 * A key's color under the whole stack: each layer drawn over the ones below
 * at its opacity × its intensity right now. Returns straight (not
 * premultiplied) color and the stack's coverage, 0–1.
 */
export function sampleStack(layers: EffectLayer[], palettes: Rgb[][], code: string, u: number, v: number, t: number): { rgb: Rgb; level: number } {
  let rgb: Rgb = [0, 0, 0];
  let cover = 0;
  layers.forEach((layer, i) => {
    const s = sampleLayer(layer, palettes[i], code, u, v, t);
    const a = s.level * (layer.opacity / 100);
    const next = a + cover * (1 - a);
    if (next <= 0) return;
    rgb = [0, 1, 2].map((k) => (s.rgb[k] * a + rgb[k] * cover * (1 - a)) / next) as Rgb;
    cover = next;
  });
  return { rgb, level: cover };
}

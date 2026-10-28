// ══════════════════════════════════════════════════════════════════════════════
// THE LOOK A PC'S LIGHT ZONE WEARS — one vocabulary for the PC side of lighting.
//
// Every lighting editor follows the peripherals' (HyperX NGENUITY, JY
// 2026-10-21): a zone — a fan, the memory, the graphics card; a keyboard
// zone, the light bar, the lid logo — wears a preset from the shared preset
// library (lightingData.ts, the same library the keyboard and mouse pick
// from), and the preset editor is the one the peripherals have.
//
// A look is the preset's effect stack, copied to the zone when the preset is
// applied, so the zone keeps what it was given even when the library changes
// under it (a preset edited or deleted later leaves the zone as it was until
// another is applied). The colour of one LED or key at a moment comes from
// the peripherals' sampler (backlight.ts), so a preset lights a fan ring the
// way it lights a keyboard.
//
// The device modules keep what is theirs: which zones the machine has
// (lightstudio/towerZones.ts, devices/pcLighting.ts) and what a zone can and
// cannot do (a four-zone keyboard has no per-key; lighting-family.6).
// ══════════════════════════════════════════════════════════════════════════════
import { layersOf, type EffectLayer, type LightPreset } from './lightingData';
import { layerPalette, sampleStack, type Rgb } from './backlight';

export type { Rgb };

/** What a zone wears: a preset's stack, as applied. */
export interface ZoneLook {
  /** The library preset it came from, for the grid's highlight. */
  presetId: string;
  name: string;
  layers: EffectLayer[];
}

/** Zone id → its look; null is a zone turned off. */
export type ZoneLooks = Record<string, ZoneLook | null>;

/** The look a preset gives. */
export function lookOf(p: LightPreset): ZoneLook {
  return { presetId: p.id, name: p.name, layers: layersOf(p).map((l) => ({ ...l, colors: [...l.colors] })) };
}

/** One colour, held still — the editor's live colour on the selected zones. */
export function solidLook(hex: string, name = 'Custom'): ZoneLook {
  return { presetId: '', name, layers: [{ fx: 'solid', colors: [hex], angle: 0, speed: 50, opacity: 100 }] };
}

const palettes = new WeakMap<ZoneLook, Rgb[][]>();
function palettesOf(look: ZoneLook): Rgb[][] {
  let p = palettes.get(look);
  if (!p) {
    p = look.layers.map(layerPalette);
    palettes.set(look, p);
  }
  return p;
}

/**
 * The colour and strength of one light under a look at time `t` (seconds):
 * `key` names the light (a key code, a fan's LED), `u` and `v` are where it
 * sits across and down its zone, 0–1. The peripherals' sampler.
 */
export function sampleLook(look: ZoneLook, key: string, u: number, v: number, t: number): { rgb: Rgb; level: number } {
  return sampleStack(look.layers, palettesOf(look), key, u, v, t);
}

/** "#rrggbb" of a sampled colour. */
export const rgbHex = (rgb: Rgb): string => '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');

/** The first colour of a look, as "#rrggbb" — what a dot or a swatch shows. */
export function lookHex(look: ZoneLook | null): string | null {
  const c = look?.layers[0]?.colors[0];
  return c ?? null;
}

/** A CSS background for a look: its colours as a gradient, or the one colour. */
export function lookSwatch(look: ZoneLook | null): string {
  if (!look) return 'transparent';
  const colors = look.layers[0]?.colors ?? [];
  if (colors.length > 1) return `linear-gradient(90deg, ${colors.join(', ')})`;
  return colors[0] ?? 'transparent';
}

/** Does the look move? A solid or a stopped layer holds still. */
export const lookMoves = (look: ZoneLook | null): boolean => !!look && look.layers.some((l) => l.fx !== 'solid' && l.speed > 0);

/** Two looks the same, as a zone compares them. */
export const sameLook = (a: ZoneLook | null, b: ZoneLook | null): boolean => (a === b ? true : !a || !b ? false : JSON.stringify(a) === JSON.stringify(b));

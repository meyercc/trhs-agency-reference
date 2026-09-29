// Lighting presets as device lighting — no three.js, no UI. Every lighting a
// mode, a suggestion or the desk wears is one of these presets (NGENUITY's, plus
// White and Off), so the preset list can always show which one is on.
import { LIGHT_PRESETS, type LightPreset } from '../devices/lightingData';
import { MULTICOLOR_EFFECTS, PRESET_EFFECT, type Effect } from './lighting';
import type { DeviceState } from './scene';

export type PresetPatch = { color: string; effect: Effect; preset: string };

/** A desk preset: NGENUITY's, or one of the desk's own with its effect named. */
export type DeskPreset = LightPreset & { effect?: Effect };

/** What the desk offers: NGENUITY's list, then plain white light and lights off. */
export const DESK_PRESETS: DeskPreset[] = [
  ...LIGHT_PRESETS,
  { id: 'preset-white', name: 'White', swatch: '#ffffff', glow: '255,255,255', fx: 'solid' },
  // Off keeps a white glow, so turning the lights back on lands on White.
  { id: 'preset-off', name: 'Off', swatch: 'transparent', glow: '255,255,255', fx: 'none', effect: 'off' },
];

/** A preset as device lighting: its glow color, its effect, and which preset. */
export function presetPatch(p: DeskPreset): PresetPatch {
  // Wave here rolls a rainbow; a one-color wave preset (Ocean) has no rainbow to
  // roll, so it breathes in its own color instead.
  const oneColor = !p.swatch.includes('gradient');
  const effect = p.effect ?? (p.fx === 'wave' && oneColor ? 'breathe' : (PRESET_EFFECT[p.fx] ?? 'solid'));
  return { color: p.glow, effect, preset: p.id };
}

/** A preset's lighting by its name ("Blue Skye"). */
export function presetNamed(name: string): PresetPatch {
  const p = DESK_PRESETS.find((x) => x.name === name);
  if (!p) throw new Error(`No lighting preset named ${name}`);
  return presetPatch(p);
}

export const presetName = (id: string | undefined) => DESK_PRESETS.find((p) => p.id === id)?.name;

/** Does this device light the way the preset does? A multicolor effect rolls
 *  its own colors and off shows none, so only the effect has to match. */
const wears = (d: DeviceState, p: DeskPreset) => {
  const patch = presetPatch(p);
  if (d.effect !== patch.effect) return false;
  return d.effect === 'off' || MULTICOLOR_EFFECTS.includes(d.effect) || d.color === patch.color;
};

/** The preset every given device is wearing, if they all wear the same one:
 *  the one they were picked from while it still matches, else the first that
 *  lights the same way. */
export function wornPresetId(states: (DeviceState | undefined)[]): string | undefined {
  const worn = states.filter((d): d is DeviceState => !!d);
  if (!worn.length) return undefined;
  const picked = worn[0].preset && DESK_PRESETS.find((p) => p.id === worn[0].preset);
  if (picked && worn.every((d) => d.preset === picked.id && wears(d, picked))) return picked.id;
  return DESK_PRESETS.find((p) => worn.every((d) => wears(d, p)))?.id;
}

const rgb = (c: string) => c.split(',').map(Number);
const distance = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
};

/** The same device lighting, on the nearest preset: lighting saved before
 *  presets (a free color) lands on the preset closest to it — same kind of
 *  effect, nearest color — keeping its brightness and speed. */
export function onPreset(d: DeviceState): DeviceState {
  // Already lit like a preset: take its exact color too (a multicolor effect
  // ignores it), so the same lighting always compares equal.
  const worn = DESK_PRESETS.find((p) => p.id === wornPresetId([d]));
  if (worn) {
    const patch = presetPatch(worn);
    return d.preset === patch.preset && d.color === patch.color ? d : { ...d, ...patch };
  }
  const patches = DESK_PRESETS.map(presetPatch).filter((p) => p.effect !== 'off');
  const multi = MULTICOLOR_EFFECTS.includes(d.effect);
  const sameEffect = patches.filter((p) => p.effect === d.effect);
  const sameKind = patches.filter((p) => MULTICOLOR_EFFECTS.includes(p.effect) === multi);
  const pool = sameEffect.length ? sameEffect : sameKind;
  const nearest = pool.reduce((best, p) => (distance(p.color, d.color) < distance(best.color, d.color) ? p : best));
  return { ...d, ...nearest };
}

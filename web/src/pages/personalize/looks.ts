// What a light is wearing, in a word and a swatch — one reading for every
// place that says it: the labels on the Lighting overview's desk
// (LightsSection.tsx), the rows of the "Devices with lights" window
// (LightingModal.tsx), and the Lighting title above them (lightingSummary and
// lightingSpread in model.ts, through `useLookReader`). Kept apart from the
// tiles because LightsSection imports useLightsPower from LightingModal;
// LightingModal importing back would be a cycle. JY, 2026-10-21: the tower's
// row and the title used to read the desk's copy of its look and ignore its
// own per-part lighting, so they could disagree with its label.
import { MULTICOLOR_EFFECTS } from '../../lightstudio/lighting';
import { DESK_PRESETS } from '../../lightstudio/presets';
import { useChassisMachine } from '../../lightstudio/ChassisLights';
import { chassisOf, lookAt, panelDrives, zonesOf, type ChassisZoneId } from '../../lightstudio/towerZones';
import type { DeviceId, DeviceState, DeviceStates } from '../../lightstudio/scene';
import { lookSwatch, sameLook, type ZoneLook } from '../../devices/lightLooks';
import { isOff, lookOf, type LookReader } from './model';

export interface LookLine {
  name: string;
  /** A CSS background: a colour, or a gradient for looks that bring their own. */
  swatch: string;
  off: boolean;
  /** 0–100: the device's brightness, or the PC's panel brightness. */
  brightness?: number;
}

export const OFF: LookLine = { name: 'Off', swatch: 'transparent', off: true };
/** A swatch for looks made of many colours. */
export const MANY = 'conic-gradient(from 90deg, #ff2a2a, #ffb800, #2bd94a, #00d2ff, #3a5bff, #c03aff, #ff2a2a)';

/** A desk device's look as the desk sets it: its preset, else its effect. */
export function deskLook(d: DeviceState): LookLine {
  if (isOff(d)) return OFF;
  const preset = DESK_PRESETS.find((p) => p.id === d.preset);
  const swatch =
    preset && preset.swatch !== 'transparent' ? preset.swatch : MULTICOLOR_EFFECTS.includes(d.effect) ? MANY : `rgb(${d.color})`;
  return { name: lookOf(d), swatch, off: false, brightness: d.brightness };
}

/** The look one of the PC's parts wears, as the PC's Lights panel sets it; the
 *  zone's preset, or the desk's look while the panel is not driving. */
function zoneLook(tower: DeviceState, zone: ChassisZoneId): { line: LookLine; look: ZoneLook | null } {
  const c = chassisOf(tower);
  if (!c.on || c.brightness === 0) return { line: OFF, look: null };
  const look = lookAt(c, zone);
  if (!look) return { line: OFF, look: null };
  return { line: { name: look.name, swatch: lookSwatch(look), off: false, brightness: c.brightness }, look };
}

/** One of the PC's parts. Until its Lights panel takes over, every part wears
 *  the PC's desk look. */
export function partLook(tower: DeviceState, zone: ChassisZoneId): LookLine {
  if (!panelDrives(tower)) return deskLook(tower);
  return zoneLook(tower, zone).line;
}

/** The PC in one line: the one look its parts share, else "Custom by part"
 *  (no middle dot: the title's line joins looks with one). */
export function towerLook(tower: DeviceState, zones: ChassisZoneId[]): LookLine {
  if (!panelDrives(tower)) return deskLook(tower);
  const c = chassisOf(tower);
  if (!c.on || c.brightness === 0) return OFF;
  const parts = zones.map((z) => zoneLook(tower, z));
  if (!parts.length) return OFF;
  const first = parts[0];
  if (parts.every((p) => sameLook(p.look, first.look))) return first.line;
  return { name: 'Custom by part', swatch: MANY, off: false, brightness: c.brightness };
}

/** A device in one line. */
export function deviceLook(id: DeviceId, states: DeviceStates, zones: ChassisZoneId[]): LookLine {
  const d = states[id];
  if (!d) return OFF;
  return id === 'tower' ? towerLook(d, zones) : deskLook(d);
}

/** The Lighting title's reader (model.ts `LookReader`): each lit device as its
 *  label says it, so "Wave · 80%" can't sit over a PC that reads "Custom by
 *  part". An off device keeps its own brightness, as the desk's reader does. */
export function useLookReader(states: DeviceStates): LookReader {
  const zones = zonesOf(useChassisMachine());
  return (id: DeviceId) => {
    const d = states[id];
    if (!d) return null;
    const line = deviceLook(id, states, zones);
    return { name: line.name, brightness: line.brightness ?? d.brightness };
  };
}

// The desktop's lights, zone by zone — what the PC's Lights panel edits and the
// 3D tower shows. Kept free of three.js like lighting.ts, so the device window
// and Light Studio name the zones without pulling in the scene.
//
// The machine is an ARGB Gen2 desktop (the tower's model is a Snowball 35L,
// Assets/3d-devices/coldsnap-35l.glb): five fans on the lighting board's ports
// 1–5 and the CPU cooler on port 6, RGB memory, and an HP-supplied graphics
// card (OpenGSW lighting, "What each machine lights"). The Figma reference is
// OMEN ARGB Gen2 Lighting VX (Apr 2024), with the graphics card from the 2023
// chassis lighting file. The chassis strip is not lit (2026-10-19, JY).
//
// Where OpenGSW is cited, the id is beside the line that follows it.

import type { Effect } from './lighting';
import { LIGHT_PRESETS } from '../devices/lightingData';
import { lookOf, sampleLook, type Rgb, type ZoneLook, type ZoneLooks } from '../devices/lightLooks';

// ── Zones ──────────────────────────────────────────────────────────────────────

export const CHASSIS_ZONES = [
  { id: 'fans', label: 'Fans' },
  { id: 'memory', label: 'Memory' },
  { id: 'gpu', label: 'Graphics card' },
] as const;

export type ChassisZoneId = (typeof CHASSIS_ZONES)[number]['id'];

// ── The machine ────────────────────────────────────────────────────────────────

/** LEDs on one fan's ring, as the Gen2 fan cards draw them. */
export const FAN_LEDS = 12;
/** LEDs on one DDR5 module (lighting, "What each machine lights"). */
export const MEMORY_LEDS = 5;
/** At most four modules. */
export const MAX_MODULES = 4;
/** LEDs along the graphics card's light bar. */
export const GPU_LEDS = 8;

/**
 * One fan on the lighting board, as the 3D model has it. The fan list itself,
 * and the names players give fans, are Cooler Cap LCD and DIY Kits' (lcd-diy.12,
 * .13, .37): `devices/fanKit.ts`, whose board fans are `board-1`…`board-6`.
 * This only says where each board fan is on the model; the panel names fans
 * with `fanName`. The port order is an assumption, not from a source.
 */
export interface ChassisFan {
  /** The fan's id in the fan list (fanKit.ts). */
  id: string;
  /** The lighting board port it is on. Port 6 is the CPU's. */
  port: number;
  /** The model's node and, where one mesh holds two fans, which of the two. */
  node: TowerNode;
  part: number;
}

export type TowerNode = 'front' | 'top' | 'rear' | 'cpu' | 'memory' | 'chassis';

/** The model's node for each lit part. The loader turns spaces into underscores,
 *  so the scene matches these loosely. */
export const TOWER_NODES: Record<TowerNode, string> = {
  front: 'Front Fans',
  top: 'Top fans',
  rear: 'Rear System fan',
  cpu: '120mm Air Cooler',
  memory: 'Ram',
  chassis: 'CHASSIS',
};

export const CHASSIS_FANS: ChassisFan[] = [
  { id: 'board-1', port: 1, node: 'front', part: 0 },
  { id: 'board-2', port: 2, node: 'front', part: 1 },
  { id: 'board-3', port: 3, node: 'top', part: 0 },
  { id: 'board-4', port: 4, node: 'top', part: 1 },
  { id: 'board-5', port: 5, node: 'rear', part: 0 },
  // The CPU fan or cooler cap goes on port 6, so the app knows it as the CPU's.
  { id: 'board-6', port: 6, node: 'cpu', part: 0 },
];
/** The CPU's port. */
export const CPU_FAN = 'board-6';

/**
 * What this desktop has lit. A part the machine lacks is not offered
 * (lighting-family.6): no memory zone without RGB memory, no graphics card
 * zone unless the card is HP-supplied and known (lighting.7).
 */
export interface ChassisMachine {
  /** RGB memory modules fitted, 0–4. */
  modules: number;
  /** An HP-supplied NVIDIA card the app knows by its four-part id. */
  hpGpu: boolean;
  /** Board fans found, by fan-list id, in port order. */
  fans: string[];
}

export const DEFAULT_MACHINE: ChassisMachine = { modules: 4, hpGpu: true, fans: CHASSIS_FANS.map((f) => f.id) };

const MACHINE_KEY = 'chassisMachine';
const MACHINE_EVENT = 'chassis-machine';

/** The machine as the lab has set it up (Modal Lab), else the full Gen2 desktop. */
export function readMachine(): ChassisMachine {
  try {
    const raw = localStorage.getItem(MACHINE_KEY);
    if (!raw) return DEFAULT_MACHINE;
    const m = JSON.parse(raw) as Partial<ChassisMachine>;
    return {
      modules: Math.max(0, Math.min(MAX_MODULES, Number(m.modules ?? DEFAULT_MACHINE.modules))),
      hpGpu: m.hpGpu ?? DEFAULT_MACHINE.hpGpu,
      // The CPU's fan is always there; a list from an older build falls back.
      fans: Array.isArray(m.fans) && m.fans.some((id) => CHASSIS_FANS.some((f) => f.id === id))
        ? CHASSIS_FANS.map((f) => f.id).filter((id) => id === CPU_FAN || m.fans!.includes(id))
        : DEFAULT_MACHINE.fans,
    };
  } catch {
    return DEFAULT_MACHINE;
  }
}

export function writeMachine(m: ChassisMachine) {
  try {
    localStorage.setItem(MACHINE_KEY, JSON.stringify(m));
  } catch {
    /* private window: the lab change just doesn't stick */
  }
  window.dispatchEvent(new Event(MACHINE_EVENT));
}

export function onMachine(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === MACHINE_KEY && fn();
  window.addEventListener(MACHINE_EVENT, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MACHINE_EVENT, fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** The zones this machine lights. Fans are always there: the board is. */
export function zonesOf(m: ChassisMachine): ChassisZoneId[] {
  return CHASSIS_ZONES.map((z) => z.id).filter((id) => (id === 'memory' ? m.modules > 0 : id === 'gpu' ? m.hpGpu : true));
}

// ── Looks ──────────────────────────────────────────────────────────────────────
//
// Every zone wears a preset from the shared library, as the peripherals'
// lights do (devices/lightLooks.ts; JY 2026-10-21): the fans as one zone, or
// any fan on its own, the memory, the graphics card. The panel header's LIGHTS
// switch puts every light out and keeps every look. Nothing waits for Apply
// (lighting#open:3 is open; this follows the peripherals).

export type { ZoneLook };

export interface ChassisLighting {
  /** The panel header's LIGHTS switch. Off lights nothing and keeps every look. */
  on: boolean;
  brightness: number; // 0–100
  /** `fans`, `memory`, `gpu` always; a fan's own id (fanKit.ts) when that fan
   *  wears a look of its own over the fans'. null is a zone turned off. */
  zones: ZoneLooks;
}

/** A fan's colour before the player paints it. */
export const DEFAULT_COLOR = '#e8173a';

const preset = (name: string) => lookOf(LIGHT_PRESETS.find((p) => p.name === name) ?? LIGHT_PRESETS[0]);

/**
 * The look the PC starts in (lighting.4): every fan runs a wave, the memory
 * and the card a rainbow (lighting.5 names Color Cycle for the memory; the
 * library's Rainbow Wave is its nearest). No source names the graphics card's
 * start on a standard machine, so it follows the memory.
 */
export function startingLighting(): ChassisLighting {
  return { on: true, brightness: 100, zones: { fans: preset('Wave'), memory: preset('Rainbow Wave'), gpu: preset('Rainbow Wave') } };
}

/** The tower's entry in the desk lighting, as far as this panel cares. */
export interface TowerLike {
  color: string;
  effect: Effect;
  brightness: number;
  speed: number;
  /** The Lights panel's state. Absent: the tower wears Light Studio's desk look. */
  chassis?: ChassisLighting;
}

/** Whether this panel drives the tower's lights. Without it the tower wears
 *  Light Studio's desk look, which a desk-wide preset puts back (clearsZones). */
export const panelDrives = (tower: TowerLike): boolean => !!tower.chassis?.zones;

/** The panel's state: the tower's, else the one it starts in. A state saved
 *  by an earlier build (modes and looks per part) starts over. */
export function chassisOf(tower: TowerLike): ChassisLighting {
  const c = tower.chassis;
  const s = startingLighting();
  if (!c?.zones) return s;
  return { ...s, ...c, zones: { ...s.zones, ...c.zones } };
}

/** A patch that changes the whole tower's look hands it back to the desk:
 *  a desk-wide preset should light the whole PC, not leave the panel's look. */
export function clearsZones(patch: { color?: unknown; effect?: unknown; preset?: unknown; chassis?: unknown }): boolean {
  return !('chassis' in patch) && (patch.color !== undefined || patch.effect !== undefined || patch.preset !== undefined);
}

/** The look a zone wears now: a fan's own, else the fans'; null when dark. */
export function lookAt(c: ChassisLighting, zone: ChassisZoneId, fanId?: string): ZoneLook | null {
  if (!c.on) return null;
  if (fanId && c.zones[fanId] !== undefined) return c.zones[fanId];
  return c.zones[zone] ?? null;
}

// ── Colour at a moment ─────────────────────────────────────────────────────────

export type { Rgb };

/**
 * One LED's colour and strength at time `t`: LED `i` of `n` on a part (on fan
 * `fanId`). A zone's lights move in step with each other (lighting.10). Zero
 * brightness and black leave the LED off (light-studio.21, lighting-family.8).
 */
export function ledAt(c: ChassisLighting, zone: ChassisZoneId, i: number, n: number, t: number, fanId?: string): { rgb: Rgb; a: number } {
  const look = lookAt(c, zone, fanId);
  if (!look) return { rgb: [0, 0, 0], a: 0 };
  const s = sampleLook(look, `${fanId ?? zone}:${i}`, i / n, 0.5, t);
  if (s.rgb[0] + s.rgb[1] + s.rgb[2] < 3) return { rgb: s.rgb, a: 0 };
  return { rgb: s.rgb, a: s.level * (c.brightness / 100) };
}

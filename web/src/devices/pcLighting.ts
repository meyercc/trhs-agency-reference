// ══════════════════════════════════════════════════════════════════════════════
// A LAPTOP'S OWN LIGHTING — the model behind the keyboard, light bar and logo.
//
// This is the PC side of lighting, not the peripheral side. The peripheral
// editor (LightingTab) is a preset library plus a colour editor; a laptop's is
// the structure OMEN Gaming Hub gave Rockstar and the 6/29 review kept:
//
//   zones, each wearing a preset from the shared library — the keyboard's
//   zones, the light bar, the lid logo — in the peripherals' layout (JY
//   2026-10-21; lightLooks.ts, ZoneLightsTab.tsx). Off is the panel header's
//   LIGHTS switch, not a look.
//
// This file keeps what a laptop has: its parts and zones, how a key is
// painted from its zone's look, the hotkeys and ECO lighting.
//
// What a machine lights comes from its data, never from the screen
// (lighting.6, lighting-family.6): the keyboard by its firmware type, a light
// bar and a logo only where the machine has them.
//
// Nothing here waits for Apply. A 4-zone keyboard keeps Apply in OGH
// (lighting.16, open:3), but the 7/27 review collapsed the lighting modal to
// one confirm: closing is confirming. This follows the review and says so.
// ══════════════════════════════════════════════════════════════════════════════
import type { Features } from './skus';
import { NOTEBOOK_ZONES } from './notebookZones';
import { ALL_CODES, KB_QS_GROUPS } from './keyboardLayout';
import { LIGHT_PRESETS } from './lightingData';
import { lookHex, lookMoves, lookOf, rgbHex, sampleLook, solidLook, type ZoneLook, type ZoneLooks } from './lightLooks';

// ── What the machine has ────────────────────────────────────────────────────

/** The keyboard's lights as its firmware reports them (lighting.6): one zone,
 *  four, or a light under every key. Per-key is OMEN Max's (Rockstar; lighting
 *  "What each machine lights") and is edited the way NGENUITY edits a per-key
 *  board: keys picked one by one or by a box (Chris, 2026-10-21). A four-zone
 *  machine stays locked to its bands. */
export type KeyboardKind = 'none' | 'one' | 'four' | 'per-key';
/** A 4-zone bar (Dojo, Vibrance) or OMEN Max's U-shaped one. */
export type BarKind = 'none' | 'four' | 'u';
/** One lamp (a lid logo) or OMEN Max's four-region logo. */
export type LogoKind = 'none' | 'single' | 'four';

export interface LightCaps {
  keyboard: KeyboardKind;
  bar: BarKind;
  logo: LogoKind;
}

export type PartId = 'keyboard' | 'bar' | 'logo';

/**
 * Read a SKU's lit parts. `features.lighting.{keyboard,bar,logo}` says it
 * outright; a SKU that only declares the older facts (`keyboard.rgbZones`,
 * `lighting.coverLogo`) is read from those.
 */
export function capsOf(features: Features): LightCaps {
  const l = (features.lighting ?? {}) as Record<string, unknown>;
  const kb = (features.keyboard ?? {}) as Record<string, unknown>;
  let keyboard: KeyboardKind = 'none';
  if (l.keyboard === 'one' || l.keyboard === 'four' || l.keyboard === 'none' || l.keyboard === 'per-key') keyboard = l.keyboard;
  else if (kb.perKeyRGB === true) keyboard = 'per-key';
  else if (kb.rgbZones === 1) keyboard = 'one';
  else if (typeof kb.rgbZones === 'number' && kb.rgbZones > 1) keyboard = 'four';
  const bar: BarKind = (l.bar as BarKind) ?? 'none';
  const logo: LogoKind = (l.logo as LogoKind) ?? (l.coverLogo === true ? 'single' : 'none');
  return { keyboard, bar, logo };
}

/** Parts the machine has, in the order the editor lists them. */
export function partsOf(caps: LightCaps): PartId[] {
  const out: PartId[] = [];
  if (caps.keyboard !== 'none') out.push('keyboard');
  if (caps.logo !== 'none') out.push('logo');
  if (caps.bar !== 'none') out.push('bar');
  return out;
}

/** OMEN Max's ECO lighting rides with the U-shaped bar (lighting.13). */
export const hasEco = (caps: LightCaps): boolean => caps.bar === 'u';

/** Zone ids a part is lit by: a bar of four, a logo of four regions. */
export const BAR_ZONES = ['bar-1', 'bar-2', 'bar-3', 'bar-4'];
export const LOGO_ZONES = ['logo-1', 'logo-2', 'logo-3', 'logo-4'];

export function zonesOf(part: PartId, caps: LightCaps): string[] {
  if (part === 'keyboard') {
    if (caps.keyboard === 'four') return NOTEBOOK_ZONES.map((z) => z.id);
    if (caps.keyboard === 'one') return ['all'];
    // Per key: every key is a zone of its own. A key with no look of its own
    // wears the whole keyboard's (`all`), see zoneLookNow.
    if (caps.keyboard === 'per-key') return ALL_CODES;
    return [];
  }
  if (part === 'bar') return caps.bar === 'four' ? BAR_ZONES : caps.bar === 'u' ? ['bar'] : [];
  return caps.logo === 'four' ? LOGO_ZONES : caps.logo === 'single' ? ['logo'] : [];
}

// ── The state ───────────────────────────────────────────────────────────────

export type { ZoneLook };

/** The charging light's colour: amber while charging is the OGH default. */
export type ChargeColor = 'amber' | 'white';

export interface PcLighting {
  /** Zone id → the preset it wears (null: that zone off). Keyboard zones are
   *  `all` (one-zone) or the four bands; on a per-key keyboard `all` is the
   *  whole board and a key code is that one key, painted over it; the bar
   *  `bar` or `bar-1`…`bar-4`; the logo `logo` or `logo-1`…`logo-4`. */
  zones: ZoneLooks;
  eco: boolean;
  /** Lights go off at sleep (lighting-family.9). */
  sleepOff: boolean;
  chargeColor: ChargeColor;
  /** On AC or battery — the source ECO lighting follows (lighting.13). */
  ac: boolean;
}

const preset = (name: string): ZoneLook => lookOf(LIGHT_PRESETS.find((p) => p.name === name) ?? LIGHT_PRESETS[0]);

/** The look a machine starts in — Reset to default returns here (lighting.4):
 *  a wave over the keyboard and the bar, the lid logo in HyperX red. */
export function defaultLighting(): PcLighting {
  const zones: ZoneLooks = {};
  ['all', ...NOTEBOOK_ZONES.map((z) => z.id), 'bar', ...BAR_ZONES].forEach((id) => (zones[id] = preset('Wave')));
  ['logo', ...LOGO_ZONES].forEach((id) => (zones[id] = preset('HyperX Red')));
  return { zones, eco: false, sleepOff: true, chargeColor: 'amber', ac: true };
}

/** A stored value may predate a field; fill what is missing from the default.
 *  A value from before the zones (modes and looks per part) starts over. */
export function normalizeLighting(v: Partial<PcLighting> | undefined): PcLighting {
  const d = defaultLighting();
  if (!v || typeof v.zones !== 'object' || !v.zones) return d;
  return { ...d, ...v, zones: { ...d.zones, ...v.zones } };
}

/** A key's colour before the player paints it. */
export const DEFAULT_COLOR = '#ffffff';

// ── What each zone shows right now ──────────────────────────────────────────

/** The look a zone wears once ECO has had its say (lighting.13): under ECO
 *  only a white keyboard, and only on AC. */
export function zoneLookNow(s: PcLighting, caps: LightCaps, part: PartId, zone: string): ZoneLook | null {
  if (hasEco(caps) && s.eco) return part === 'keyboard' && s.ac ? solidLook('#ffffff', 'ECO') : null;
  // A per-key keyboard's key without a look of its own wears the whole board's.
  if (part === 'keyboard' && caps.keyboard === 'per-key' && isKeyCode(zone) && s.zones[zone] === undefined) return s.zones.all ?? null;
  return s.zones[zone] ?? null;
}

const KEY_CODES: ReadonlySet<string> = new Set(ALL_CODES);
/** Is this zone id one key of a per-key keyboard? */
export const isKeyCode = (id: string): boolean => KEY_CODES.has(id);

/** The keyboard's zones, all wearing one look; on a per-key board the whole
 *  board (`all`), every key's own look lifted. */
export function keyboardLooks(zones: ZoneLooks, caps: LightCaps, look: ZoneLook | null): ZoneLooks {
  if (caps.keyboard === 'per-key') {
    const next: ZoneLooks = {};
    Object.entries(zones).forEach(([k, v]) => {
      if (!isKeyCode(k)) next[k] = v;
    });
    next.all = look;
    return next;
  }
  const next = { ...zones };
  zonesOf('keyboard', caps).forEach((z) => (next[z] = look));
  return next;
}

export type Shown = { kind: 'off' } | { kind: 'lit'; look: ZoneLook };

/** Whether a part shows anything, and the first look it wears. */
export function shownFor(s: PcLighting, caps: LightCaps, part: PartId): Shown {
  for (const z of zonesOf(part, caps)) {
    const look = zoneLookNow(s, caps, part, z);
    if (look) return { kind: 'lit', look };
  }
  return { kind: 'off' };
}

/** What ECO lighting does, in words, for the Other settings row. */
export function ecoReading(ac: boolean): string {
  return ac ? 'Keyboard white. Light bar and logo off.' : 'Keyboard and light bar off on battery.';
}

// ── The keyboard as the hero draws it ───────────────────────────────────────

export interface KeyboardPaint {
  /** code → colour, for `KeyboardHero.keyColors` (empty = unlit). */
  colors: Map<string, string>;
  /** Hint colour for the glow behind the board. */
  glow: string | null;
}

const css = (rgb: [number, number, number], level: number) => `rgb(${rgb.map((c) => Math.round(c * level)).join(', ')})`;

/** The keyboard zone a key belongs to on this keyboard type. */
export function keyZone(kind: KeyboardKind, code: string): string | null {
  if (kind === 'one') return 'all';
  if (kind === 'four') return ZONE_ID_OF.get(code) ?? null;
  if (kind === 'per-key') return code;
  return null;
}

/**
 * Paint every key of the board for the current state at time `t`: a key's
 * colour is its zone's look sampled at the key's place along the board, so a
 * wave runs across the board as the preset editor meant (lighting.2).
 */
export function paintKeyboard(s: PcLighting, caps: LightCaps, codes: string[] = ALL_CODES, t = 0): KeyboardPaint {
  const colors = new Map<string, string>();
  if (caps.keyboard === 'none') return { colors, glow: null };
  let glow: string | null = null;
  codes.forEach((code, i) => {
    const zone = keyZone(caps.keyboard, code);
    const look = zone ? zoneLookNow(s, caps, 'keyboard', zone) : null;
    if (!look) return;
    const sm = sampleLook(look, code, codes.length > 1 ? i / (codes.length - 1) : 0, 0.5, t);
    colors.set(code, css(sm.rgb, Math.max(0.15, sm.level)));
    if (!glow) glow = sm.rgb.map((c) => Math.round(c)).join(', ');
  });
  return { colors, glow };
}

/** The colour of one bar or logo zone (or a keyboard zone) now, or null while it is dark. */
export function zoneColor(s: PcLighting, caps: LightCaps, part: PartId, zone: string, index: number, count: number, t = 0): string | null {
  const look = zoneLookNow(s, caps, part, zone);
  if (!look) return null;
  const sm = sampleLook(look, zone, count > 1 ? index / (count - 1) : 0.5, 0.5, t);
  return rgbHex(sm.rgb.map((c) => c * Math.max(0.15, sm.level)) as [number, number, number]);
}

// ── Keyboard selection ──────────────────────────────────────────────────────

/** The rail's groups for a keyboard type; `Reset` is the hero's own. An unlit
 *  keyboard keeps the standalone board's key groups, for the drawn board. */
export function quickSelectFor(kind: KeyboardKind): { id: string; label: string }[] {
  if (kind === 'four') return [{ id: 'all', label: 'All zones' }, ...NOTEBOOK_ZONES.map((z) => ({ id: z.id, label: z.label }))];
  if (kind === 'one') return [{ id: 'all', label: 'Whole keyboard' }];
  return [
    { id: 'all', label: 'All' },
    { id: 'wasd', label: 'WASD' },
    { id: 'qwer', label: 'QWER' },
    { id: 'numbers', label: 'Numbers' },
    { id: 'arrows', label: 'Arrows' },
    { id: 'functions', label: 'Functions' },
  ];
}

/** Keys a rail item stands for on this keyboard type. */
export function quickSelectCodes(kind: KeyboardKind, id: string): string[] {
  if (id === 'all') return kind === 'four' ? NOTEBOOK_ZONES.flatMap((z) => z.codes) : ALL_CODES;
  if (kind === 'four') return NOTEBOOK_ZONES.find((z) => z.id === id)?.codes ?? [];
  return KB_QS_GROUPS[id] ?? [];
}

/** The keyboard zone ids a selection of keys stands for. */
export function zonesSelected(kind: KeyboardKind, codes: ReadonlySet<string>): string[] {
  if (kind === 'one') return codes.size ? ['all'] : [];
  if (kind === 'four') return NOTEBOOK_ZONES.filter((z) => z.codes.every((c) => codes.has(c))).map((z) => z.id);
  if (kind === 'per-key') return ALL_CODES.every((c) => codes.has(c)) ? ['all'] : ALL_CODES.filter((c) => codes.has(c));
  return [];
}

/** The keys a set of keyboard zone ids covers. */
export function codesOfZones(kind: KeyboardKind, zones: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const z of zones) {
    if (z === 'all') quickSelectCodes(kind, 'all').forEach((c) => out.add(c));
    else if (kind === 'four') NOTEBOOK_ZONES.find((x) => x.id === z)?.codes.forEach((c) => out.add(c));
    else if (kind === 'per-key' && isKeyCode(z)) out.add(z);
  }
  return out;
}

/** code → the id of the 4-zone band it belongs to. */
export const ZONE_ID_OF: Map<string, string> = new Map(NOTEBOOK_ZONES.flatMap((z) => z.codes.map((c) => [c, z.id] as [string, string])));

// ── Hotkeys ─────────────────────────────────────────────────────────────────

export type Hotkey = 'fn-space' | 'fn-f9';

export interface HotkeyResult {
  state: PcLighting;
  /** Fn+F9 flips the keyboard's lights; true/false is the new power, null leaves it. */
  power: boolean | null;
  /** What happened, for the line under the buttons. */
  notice: string;
}

const MOVING = LIGHT_PRESETS.filter((p) => lookMoves(lookOf(p)));

/** The keyboard's zones, all wearing one look. */
function keyboardWearing(s: PcLighting, caps: LightCaps, look: ZoneLook): PcLighting {
  return { ...s, zones: keyboardLooks(s.zones, caps, look) };
}

/**
 * What a hotkey does to the lights (lighting-family.10, lighting.25, .29, .30).
 * The page follows the keyboard: the state returned is what the editor then
 * shows.
 */
export function applyHotkey(s: PcLighting, caps: LightCaps, key: Hotkey, power: boolean): HotkeyResult {
  if (caps.keyboard === 'none') return { state: s, power: null, notice: 'This machine has no keyboard lighting.' };
  if (key === 'fn-f9') {
    if (hasEco(caps) && s.eco) return { state: { ...s, eco: false }, power: null, notice: 'Fn+F9 ended ECO lighting.' };
    return { state: s, power: !power, notice: power ? 'Fn+F9: the keyboard lights went off.' : 'Fn+F9: the keyboard lights came back.' };
  }
  // Fn+Space
  if (hasEco(caps) && s.eco) {
    return { state: keyboardWearing({ ...s, eco: false }, caps, lookOf(MOVING[0])), power: null, notice: 'Fn+Space ended ECO lighting and moved the keyboard to an animation.' };
  }
  if (caps.keyboard === 'four') {
    return { state: s, power: null, notice: 'Fn+Space does nothing on a 4-zone keyboard.' };
  }
  const now = s.zones.all;
  if (!now) {
    return { state: keyboardWearing(s, caps, lookOf(MOVING[0])), power: null, notice: 'Fn+Space started the keyboard’s first animation.' };
  }
  const i = MOVING.findIndex((p) => p.id === now.presetId);
  const next = MOVING[(i + 1) % MOVING.length];
  return { state: keyboardWearing(s, caps, lookOf(next)), power: null, notice: `Fn+Space moved to the next animation: ${next.name}.` };
}

// ── The machine's picture: what its lights look like from outside ───────────

/** Colour stops (hex) across the keyboard deck, left to right; empty = dark. */
export function deckStops(s: PcLighting, caps: LightCaps, power: boolean): string[] {
  if (!power || caps.keyboard === 'none') return [];
  // A per-key board is read at a few keys across it rather than all of them.
  const zones = caps.keyboard === 'per-key' ? ['esc', '4', '7', 'minus', 'backspace'].filter(isKeyCode) : zonesOf('keyboard', caps);
  const stops = zones.map((z, i) => zoneColor(s, caps, 'keyboard', z, i, zones.length)).filter((c): c is string => !!c);
  return stops;
}

export interface PartDot {
  part: PartId;
  label: string;
  /** "#rrggbb", or null while the part is dark. */
  color: string | null;
}

/** One dot per part the machine has: its colour right now, or dark. */
export function partDots(s: PcLighting, caps: LightCaps, power: boolean): PartDot[] {
  const label: Record<PartId, string> = { keyboard: 'Keyboard', logo: 'Logo', bar: 'Light bar' };
  return partsOf(caps).map((part) => {
    if (!power) return { part, label: label[part], color: null };
    const shown = shownFor(s, caps, part);
    return { part, label: label[part], color: shown.kind === 'lit' ? lookHex(shown.look) : null };
  });
}

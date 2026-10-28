// ── Personalize › Quick Control — the model ───────────────────────────────────
// Personalize owns how the desk LOOKS, SOUNDS and FEELS: lighting, audio
// character, mic, mouse buttons. How the machine RUNS (power, thermals, fans)
// is Perform's; battery and connection are Devices'. Nothing here reads or
// writes those — a tile that would is a boundary bug.
//
// The software profile (Settings.activeProfileId — Gaming / Work / Silent /
// Stream, plus any mode the user made) is the "mode". A mode is a bundle, and Personalize shows only the desk half of
// it: switching the mode re-applies MODE_PRESETS below. Changing a value a mode
// owns marks it overridden until the next mode switch or a Reset.
import type { DeviceId, DeviceState, DeviceStates } from '../../lightstudio/scene';
import { EFFECTS, LIT_DEVICE_IDS, type Effect } from '../../lightstudio/lighting';
import { onPreset, presetName, presetNamed, wornPresetId } from '../../lightstudio/presets';
import type { IconName } from '../../components';
import valorantArt from '../../../../Assets/games/valorant.webp';

export const DESK_DEVICES: DeviceId[] = ['tower', 'monitor', 'keyboard', 'mouse', 'headset', 'mic'];

/** Which product each device on the 3D desk is (the device panel a pick opens). */
export const DESK_SKU: Record<DeviceId, string> = {
  tower: 'forge-45l',
  monitor: 'pulse-27',
  keyboard: 'origins-65',
  mouse: 'saga-pro',
  headset: 'cloud-iii',
  mic: 'solocast-2-pro',
};

export type EqPreset = 'fps' | 'music' | 'movie' | 'voice' | 'flat';
export const EQ_LABEL: Record<EqPreset, string> = {
  fps: 'FPS',
  music: 'Music',
  movie: 'Movie',
  voice: 'Voice',
  flat: 'Flat',
};

export type MicPreset = 'gaming' | 'streaming' | 'podcast' | 'conference';
export type ButtonLayout = 'default' | 'valorant' | 'productivity';
export const BUTTONS_LABEL: Record<ButtonLayout, string> = {
  default: 'Default',
  valorant: 'Valorant',
  productivity: 'Work',
};

export const EFFECT_LABEL = Object.fromEntries(EFFECTS.map(e => [e.id, e.label])) as Record<Effect, string>;

/** Values a mode owns. Overriding one is tracked by key. */
export type ModeOwned = 'lighting' | 'eq' | 'spatial' | 'mic';

export interface DeskState {
  lighting: DeviceStates;
  eq: EqPreset;
  spatial: boolean;
  micPreset: MicPreset;
  micOn: boolean;
  micNoise: boolean;
  buttons: ButtonLayout;
  /** Headset volume. Not profile-owned on purpose: a profile restores how the
   *  desk looks and sounds, and nobody wants yesterday's volume back. */
  volume: number;
  sidetone: number;
  dpi: string;
  gameSync: boolean;
}

const all = (s: DeviceState): DeviceStates =>
  Object.fromEntries(DESK_DEVICES.map(id => [id, { ...s }])) as DeviceStates;

/** The desk half of a mode — what switching to it sets here. */
export interface ModeDesk {
  lighting: DeviceStates;
  eq: EqPreset;
  spatial: boolean;
  micPreset: MicPreset;
}

/** What each built-in mode sets on the desk. Keys match SOFTWARE_PROFILES ids;
 *  user-made modes carry their own ModeDesk (Settings.customProfiles[].desk). */
export const MODE_PRESETS: Record<string, ModeDesk> = {
  // Lighting defaults, from the interviews: expression when playing (the one
  // gamer's rigs are "超絢麗", and per-game color is what gamers notice), one
  // steady color and no animation when you're working or on camera, and a
  // deliberately darker, set ambience for streaming.
  gaming: {
    lighting: all({ ...presetNamed('Wave'), brightness: 80, speed: 5 }),
    eq: 'fps',
    spatial: true,
    micPreset: 'gaming',
  },
  work: {
    lighting: all({ ...presetNamed('Blue Skye'), brightness: 80, speed: 5 }),
    eq: 'voice',
    spatial: false,
    micPreset: 'conference',
  },
  silent: {
    lighting: all({ ...presetNamed('White'), brightness: 50, speed: 2 }),
    eq: 'flat',
    spatial: false,
    micPreset: 'podcast',
  },
  stream: {
    lighting: all({ ...presetNamed('Midnight Purple'), brightness: 45, speed: 3 }),
    eq: 'voice',
    spatial: false,
    micPreset: 'streaming',
  },
};

/** Every device on a preset — lighting saved before presets lands on the
 *  nearest one, so the preset list always shows what a mode wears. */
export const onPresets = (l: DeviceStates): DeviceStates =>
  Object.fromEntries(Object.entries(l).map(([id, d]) => [id, d && onPreset(d)])) as DeviceStates;

export const DEFAULT_DESK: DeskState = {
  ...MODE_PRESETS.gaming,
  micOn: true,
  micNoise: false,
  buttons: 'default',
  volume: 62,
  sidetone: 40,
  dpi: '1600',
  gameSync: false,
};

/** Same lighting, field by field. JSON order isn't stable across the 3D scene,
 *  saved state and presets, and a string compare would flag an unchanged desk
 *  as "Changed". */
export function sameLighting(a: DeviceStates, b: DeviceStates) {
  return DESK_DEVICES.every(id => {
    const x = a[id];
    const y = b[id];
    return (
      !!x &&
      !!y &&
      x.color === y.color &&
      x.effect === y.effect &&
      x.brightness === y.brightness &&
      x.speed === y.speed &&
      // Presets that light the same only differ by name; unnamed lighting matches either.
      (!x.preset || !y.preset || x.preset === y.preset) &&
      // The tower's Lights panel (towerZones.ts): a change there is a change.
      stableKey(x.chassis) === stableKey(y.chassis)
    );
  });
}

/** A value as a string that does not depend on key order. */
function stableKey(v: unknown): string {
  if (v === undefined) return '';
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x,
  );
}

/** How each desk device is named in a lighting summary. */
export const DESK_DEVICE_LABEL: Record<DeviceId, string> = {
  tower: 'Desktop',
  monitor: 'Monitor',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  headset: 'Headset',
  mic: 'Mic',
};

export const isOff = (d: DeviceState) => d.effect === 'off' || d.brightness === 0;
/** One device's look in words: its preset, else its effect. */
export const lookOf = (d: DeviceState) =>
  isOff(d) ? 'Off' : presetName(d.preset) ?? presetName(wornPresetId([d])) ?? EFFECT_LABEL[d.effect] ?? d.effect;

/** What one lit device wears, for the Lighting title: a name and a brightness. */
export type LookReader = (id: DeviceId) => { name: string; brightness?: number } | null;

/** Each device's look as the desk's own copy has it. The tiles pass
 *  `useLookReader` (looks.ts) instead, which also reads the PC's per-part
 *  lighting, so the title says what the labels say (JY, 2026-10-21). */
const deskReader =
  (l: DeviceStates): LookReader =>
  id => {
    const d = l[id];
    return d ? { name: lookOf(d), brightness: d.brightness } : null;
  };

/**
 * The desk's looks, most-worn first: [look, devices wearing it].
 * Only devices with lights of their own count (no headset, no monitor).
 */
function looks(read: LookReader): [string, DeviceId[]][] {
  const by = new Map<string, DeviceId[]>();
  LIT_DEVICE_IDS.forEach(id => {
    const look = read(id)?.name;
    if (look == null) return;
    by.set(look, [...(by.get(look) ?? []), id]);
  });
  return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
}

/**
 * The Lighting title (Kristy, 2026-10-01). It used to name the KEYBOARD's
 * preset whenever the devices differed, so a desk of four colors read as
 * "HyperX Red · 80%". Now it names one look only when the whole desk wears it,
 * and the brightness only when every device shares it.
 */
export function lightingSummary(l: DeviceStates, read: LookReader = deskReader(l)): string {
  const all = looks(read);
  if (all.length === 0) return 'Lighting';
  if (all.length > 1) return 'Mixed lighting';
  const [look] = all[0];
  if (look === 'Off') return 'Lights off';
  const levels = new Set(LIT_DEVICE_IDS.map(id => read(id)?.brightness).filter(b => b != null));
  return levels.size === 1 ? `${look} · ${[...levels][0]}%` : look;
}

/** Where each look is, for the line under the title: "HyperX Red on 4 devices · Ocean on Keyboard". */
export function lightingSpread(l: DeviceStates, read: LookReader = deskReader(l)): string {
  const all = looks(read);
  if (all.length === 1) return `On all ${all[0][1].length} devices`;
  return all
    .map(([look, ids]) => `${look} on ${ids.length === 1 ? DESK_DEVICE_LABEL[ids[0]] : `${ids.length} devices`}`)
    .join(' · ');
}

// ── Context ──────────────────────────────────────────────────────────────────
// Context is simulated in the prototype: a scenario stands in for the signals a
// shipping app would read (running game, calendar, clock, voice apps).

export type TileId = 'mode' | 'lighting' | 'volume' | 'eq' | 'mic' | 'buttons' | 'spatial' | 'sidetone' | 'dpi';
export type SuggestionId =
  | 'meeting-soon'
  | 'go-live'
  | 'night-lighting'
  | 'game-sync'
  | 'calm-lighting'
  | 'mic-noise'
  | 'lights-off';
export type ScenarioId = 'valorant' | 'meeting' | 'late' | 'stream';

export interface Signal {
  label: string;
  icon: IconName;
  /** The signal that caused the ranking. Everything else is supporting. */
  lead?: boolean;
  /** Only true in the evening — dropped by day so the page never contradicts the clock. */
  evening?: boolean;
}

export interface Scenario {
  /** 'custom' is a mode no detected activity is paired with (see contextForMode). */
  id: ScenarioId | 'custom';
  label: string;
  /** The specifics under the label — what Treehouse actually saw, e.g.
   *  "Competitive · match 2 · 38 min in". Relative only: the strip adds the one
   *  real clock, so switching modes never shows a different "now". */
  when: string;
  icon: IconName;
  /** Cover art when the context is a game. */
  art?: string;
  /** The mode this context switches to when Context is on. */
  mode: string;
  signals: Signal[];
  /** Tiles ranked into "Ranked for now", in order. */
  ranked: TileId[];
  suggestions: SuggestionId[];
  /** Why the mode switched — the reason line on the Mode tile. */
  modeReason: string;
  /**
   * What kind of signal this context is, which decides how the profile moves
   * (the profile band's one rule: your rules act and say so, guesses ask).
   *   · `game`     — a game started. A profile with that game in its Game Link
   *                  switches by itself; with none, the band asks.
   *   · `schedule` — the clock reached a window. A profile whose Schedule
   *                  covers it switches by itself; with none, the band asks.
   *   · `guess`    — anything else Treehouse inferred (a calendar entry, an
   *                  app opening). Never switches by itself: it asks.
   */
  trigger: { kind: 'game'; gameId: string; title: string } | { kind: 'schedule' } | { kind: 'guess' };
  /** The question the band asks when this context has no rule behind it. */
  ask: string;
  /** The clock this context happens at, when it is not the demo's 6:30 PM. */
  at?: Date;
}

// One context per built-in mode, all on the same evening (Wed 6:30 PM, a Teams
// call at 7:00). The strip follows the mode, and each context only says what is
// true right now: you're mid-match, the call is in 30 minutes, quiet hours are
// later tonight, and you could go live — Treehouse asks, it doesn't assume.
export const SCENARIOS: (Scenario & { id: ScenarioId })[] = [
  {
    id: 'valorant',
    label: 'Playing Valorant',
    when: 'Competitive · match 2 · 38 min in',
    icon: 'gaming',
    mode: 'gaming',
    art: valorantArt,
    signals: [
      { label: 'Valorant running', icon: 'gaming', lead: true },
      { label: 'Discord voice', icon: 'mic' },
      { label: 'Cloud III on', icon: 'audio-headset' },
      { label: 'Meeting at 7:00 PM', icon: 'work' },
      { label: 'Evening', icon: 'sunset', evening: true },
    ],
    ranked: ['mode', 'mic', 'volume', 'buttons', 'eq'],
    suggestions: ['meeting-soon', 'night-lighting', 'game-sync'],
    modeReason: 'Valorant started 38 min ago',
    trigger: { kind: 'game', gameId: 'valorant', title: 'Valorant' },
    ask: 'Valorant started. Switch to Gaming?',
  },
  {
    id: 'meeting',
    label: 'Meeting in 30 min',
    when: 'Design review · Teams · 4 people',
    icon: 'work',
    mode: 'work',
    signals: [
      { label: 'Teams call at 7:00 PM on your calendar', icon: 'work', lead: true },
      { label: 'Camera on in your last 3 calls', icon: 'mic' },
      { label: 'Cloud III on', icon: 'audio-headset' },
    ],
    ranked: ['mode', 'mic', 'volume', 'eq', 'spatial'],
    suggestions: ['calm-lighting', 'mic-noise'],
    modeReason: 'Teams call at 7:00 PM on your calendar',
    // A calendar entry is Treehouse's inference, not a rule you set: it asks.
    trigger: { kind: 'guess' },
    ask: 'Teams call at 7:00 PM. Switch to Work?',
  },
  {
    // Quiet hours happen at their own hour: this context is the moment the
    // window opens, so it carries its own clock rather than the demo's 6:30 PM
    // (a schedule that fired at 6:30 for an 11:00 window would be a lie).
    id: 'late',
    label: 'Quiet hours',
    when: 'Your schedule · 11:00 PM – 7:00 AM',
    icon: 'moon',
    mode: 'silent',
    at: new Date(2026, 8, 16, 23, 0),
    signals: [
      { label: 'Quiet hours you set: 11:00 PM – 7:00 AM', icon: 'moon', lead: true },
      { label: 'Evening', icon: 'sunset', evening: true },
    ],
    ranked: ['mode', 'volume', 'mic', 'eq', 'sidetone'],
    suggestions: ['lights-off'],
    modeReason: 'Quiet hours on your schedule',
    trigger: { kind: 'schedule' },
    ask: 'It’s 11:00 PM. Switch to Silent?',
  },
  {
    id: 'stream',
    label: 'Ready to go live',
    when: 'OBS open · Twitch connected · SoloCast 2 Pro ready',
    icon: 'stream',
    mode: 'stream',
    signals: [
      { label: 'OBS opened at 6:24 PM', icon: 'stream', lead: true },
      { label: 'Twitch account connected', icon: 'stream' },
      { label: 'SoloCast 2 Pro ready', icon: 'mic' },
    ],
    ranked: ['mode', 'mic', 'volume', 'eq', 'sidetone'],
    suggestions: ['go-live', 'mic-noise'],
    modeReason: 'OBS opened at 6:24 PM',
    trigger: { kind: 'guess' },
    ask: 'OBS is open. Switch to Stream?',
  },
];

/** The context the page shows for a mode: the activity paired with it, or — for
 *  a mode you made — the mode itself, with nothing claimed about what you're doing. */
export function contextForMode(mode: string, name: string, icon: IconName): Scenario {
  return (
    SCENARIOS.find(s => s.mode === mode) ?? {
      id: 'custom',
      label: name,
      when: 'Your mode · nothing detected is linked to it',
      icon,
      mode,
      signals: [],
      ranked: ['mode', 'mic', 'volume', 'eq', 'buttons'],
      suggestions: [],
      modeReason: 'A mode you made',
      trigger: { kind: 'guess' },
      ask: '',
    }
  );
}

export const scenarioById = (id: ScenarioId) => SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0];

/** Every tile the page can show. */
// 'lighting' stays a TileId so saved layouts still load; the desk is part of the
// Mode tile now, so it isn't offered on its own.
// Keyboard brightness is not here: it is the keyboard's slice of the desk
// lighting, and Lighting owns that — two places to set one value, one of which
// (Off / 50 / 100) could not even express what Light Studio sets.
export const ALL_TILES: TileId[] = ['mode', 'volume', 'mic', 'eq', 'buttons', 'dpi', 'spatial', 'sidetone'];
/** Grid footprint per tile when it is arranged (default 1×1). */
// Mouse buttons is 2×1: its three layouts need the room; every other small tile is 1×1.
export const TILE_SPAN: Partial<Record<TileId, 'full' | 'l' | 'm'>> = { mode: 'full' };

/** Nothing is pinned to begin with. The page ranks for what you're doing and
 *  you pin what you keep reaching for — pre-curating a grid for someone is the
 *  opposite of what the study asked for ("the less settings, the better"). */
export const DEFAULT_PINS: TileId[] = [];

/**
 * Where every control sits until you arrange them (Quick Controls direction A,
 * Kristy 2026-10-06). The same in every profile and every context: context
 * only lights a tile up, it never moves one. Your pins come first, in the
 * order you dragged them; this order fills the rest.
 */
export const DEFAULT_TILE_ORDER: TileId[] = ['volume', 'mic', 'eq', 'spatial', 'buttons', 'dpi', 'sidetone'];
/** How many controls the front shows at least. */
export const QUICK_FRONT_MIN = 4;

/**
 * Quick Controls from what you starred (`pins`, newest first) and where you
 * dragged them (`order`). Starred tiles always come first (Kristy 2026-10-06:
 * "pin的位置要移到最前面"). Starring never touches `order`, so unstarring puts
 * a tile back exactly where it was ("unpin的時候要恢復原來的樣子"). The front is
 * the first max(4, pins). Pure, so the page and the state agree on it.
 */
export function quickControls(order: TileId[], pins: TileId[]) {
  const known = [...new Set(order)].filter(id => DEFAULT_TILE_ORDER.includes(id));
  const all = [...known, ...DEFAULT_TILE_ORDER.filter(id => !known.includes(id))];
  const pinned = [...new Set(pins)].filter(id => all.includes(id));
  const controls = [...pinned, ...all.filter(id => !pinned.includes(id))];
  const frontCount = Math.max(QUICK_FRONT_MIN, pinned.length);
  return { all, pinned, controls, frontCount, front: controls.slice(0, frontCount) };
}

/** Star `id`: it moves to the very front. Its own place is kept for later. */
export const pinTile = (pins: TileId[], id: TileId) => [id, ...pins.filter(x => x !== id)];

/** Unstar `id`: it goes back to the place it had before. */
export const unpinTile = (pins: TileId[], id: TileId) => pins.filter(x => x !== id);

/**
 * A drag inside the front. Starred tiles reorder among themselves (`pins`);
 * unstarred ones trade places in `order`, and every other place stays put.
 */
export function arrangeQuickFront(order: TileId[], pins: TileId[], front: TileId[]) {
  const { all, pinned } = quickControls(order, pins);
  const nextPins = [...front.filter(id => pinned.includes(id)), ...pinned.filter(id => !front.includes(id))];
  const moved = front.filter(id => !pinned.includes(id));
  const slots = all.map((id, i) => (moved.includes(id) ? i : -1)).filter(i => i >= 0);
  const nextOrder = [...all];
  slots.forEach((slot, k) => (nextOrder[slot] = moved[k]));
  return { order: nextOrder, pins: nextPins };
}

/** Icons a user can give a mode they make. */
export const MODE_ICON_CHOICES: IconName[] = [
  'gaming',
  'work',
  'silent',
  'stream',
  'moon',
  'lights',
  'star',
  'heart',
  'audio-headset',
  'mic',
];

/** Snapshot the desk half of the current state — a new mode starts as "this, now". */
export const deskToMode = (d: DeskState): ModeDesk => ({
  lighting: structuredClone(d.lighting),
  eq: d.eq,
  spatial: d.spatial,
  micPreset: d.micPreset,
});

/** The prototype's one clock: a weekday evening at 6:30 PM — time for a game,
 *  with a Teams call at 7:00 PM. Every context reads this, so switching modes
 *  changes what is detected, never what time it is. */
export const DEMO_NOW = new Date(2026, 8, 16, 18, 30);

/** Evening by the clock (6 PM – 6 AM) — gates evening signals and suggestions. */
export const isEvening = (now: Date) => now.getHours() >= 18 || now.getHours() < 6;

/** The one clock the context strip shows, e.g. "Tue 9:12 PM". */
export const formatClock = (now: Date) =>
  now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(',', '');

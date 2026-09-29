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
import { EFFECTS, type Effect } from '../../lightstudio/lighting';
import { onPreset, presetName, presetNamed, wornPresetId } from '../../lightstudio/presets';
import type { IconName } from '../../components';
import valorantArt from '../../../../Assets/games/valorant.webp';

export const DESK_DEVICES: DeviceId[] = ['tower', 'monitor', 'keyboard', 'mouse', 'headset', 'mic'];

export type EqPreset = 'fps' | 'music' | 'movie' | 'voice' | 'flat';
export const EQ_LABEL: Record<EqPreset, string> = { fps: 'FPS', music: 'Music', movie: 'Movie', voice: 'Voice', flat: 'Flat' };

export type MicPreset = 'gaming' | 'streaming' | 'podcast' | 'conference';
export type ButtonLayout = 'default' | 'valorant' | 'productivity';
export const BUTTONS_LABEL: Record<ButtonLayout, string> = {
  default: 'Default',
  valorant: 'Valorant',
  productivity: 'Work',
};

export const EFFECT_LABEL = Object.fromEntries(EFFECTS.map((e) => [e.id, e.label])) as Record<Effect, string>;

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
  Object.fromEntries(DESK_DEVICES.map((id) => [id, { ...s }])) as DeviceStates;

/** The desk half of a mode — what switching to it sets here. */
export interface ModeDesk {
  lighting: DeviceStates;
  eq: EqPreset;
  spatial: boolean;
  micPreset: MicPreset;
}

/** What each built-in mode sets on the desk. Keys match SOFTWARE_PROFILES ids;
 *  user-made profiles start from the desk as it is (see PersonalizeProvider). */
export const MODE_PRESETS: Record<string, ModeDesk> = {
  // Lighting defaults, from the interviews: expression when playing (the one
  // gamer's rigs are "超絢麗", and per-game color is what gamers notice), one
  // steady color and no animation when you're working or on camera, and a
  // deliberately darker, set ambience for streaming.
  gaming: { lighting: all({ ...presetNamed('Wave'), brightness: 80, speed: 5 }), eq: 'fps', spatial: true, micPreset: 'gaming' },
  work: { lighting: all({ ...presetNamed('Blue Skye'), brightness: 80, speed: 5 }), eq: 'voice', spatial: false, micPreset: 'conference' },
  silent: { lighting: all({ ...presetNamed('White'), brightness: 50, speed: 2 }), eq: 'flat', spatial: false, micPreset: 'podcast' },
  stream: { lighting: all({ ...presetNamed('Midnight Purple'), brightness: 45, speed: 3 }), eq: 'voice', spatial: false, micPreset: 'streaming' },
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
  return DESK_DEVICES.every((id) => {
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
      (!x.preset || !y.preset || x.preset === y.preset)
    );
  });
}

/** A one-line, desk-only summary of a mode — what switching to it will do here. */
export function lightingSummary(l: DeviceStates): string {
  const k = l.keyboard;
  if (k.effect === 'off' || k.brightness === 0) return 'Lights off';
  const name = presetName(wornPresetId(DESK_DEVICES.map((id) => l[id]))) ?? presetName(wornPresetId([k]));
  return `${name ?? EFFECT_LABEL[k.effect] ?? k.effect} · ${k.brightness}%`;
}

// ── Context ──────────────────────────────────────────────────────────────────
// Context is simulated in the prototype: a scenario stands in for the signals a
// shipping app would read (running game, calendar, clock, voice apps).

export type TileId = 'mode' | 'lighting' | 'volume' | 'eq' | 'mic' | 'buttons' | 'spatial' | 'sidetone' | 'dpi';
export type SuggestionId = 'meeting-soon' | 'go-live' | 'night-lighting' | 'game-sync' | 'calm-lighting' | 'mic-noise' | 'lights-off';
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
  },
  {
    id: 'late',
    label: 'Quiet hours at 11:00 PM',
    when: 'Your schedule · 11:00 PM – 7:00 AM · starts in 4 hr 30 min',
    icon: 'moon',
    mode: 'silent',
    signals: [
      { label: 'Quiet hours you set: 11:00 PM – 7:00 AM', icon: 'moon', lead: true },
      { label: 'Evening', icon: 'sunset', evening: true },
    ],
    ranked: ['mode', 'volume', 'mic', 'eq', 'sidetone'],
    suggestions: ['lights-off'],
    modeReason: 'Quiet hours on your schedule',
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
  },
];

/** The context the page shows for a mode: the activity paired with it, or — for
 *  a mode you made — the mode itself, with nothing claimed about what you're doing. */
export function contextForMode(mode: string, name: string, icon: IconName): Scenario {
  return (
    SCENARIOS.find((s) => s.mode === mode) ?? {
      id: 'custom',
      label: name,
      when: 'Your mode · nothing detected is linked to it',
      icon,
      mode,
      signals: [],
      ranked: ['mode', 'mic', 'volume', 'eq', 'buttons'],
      suggestions: [],
      modeReason: 'A mode you made',
    }
  );
}

export const scenarioById = (id: ScenarioId) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

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

/** Icons a user can give a mode they make. */
export const MODE_ICON_CHOICES: IconName[] = ['gaming', 'work', 'silent', 'stream', 'moon', 'lights', 'star', 'heart', 'audio-headset', 'mic'];

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

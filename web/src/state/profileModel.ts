import type { SlotSettings } from './DeviceProfiles';
import type { SettingName } from './Settings';

// ══════════════════════════════════════════════════════════════════════════
// The software-profile model: types, schedule matching, and the arbitration
// rules — all pure, all React-free.
//
// This is deliberately separate from `Profiles.tsx` (the provider). The
// arbitration rules below have a clause that is easy to get subtly wrong and
// impossible to see in the UI once it is, so they live somewhere a script can
// call them directly: `scripts/verify-profiles.mjs`.
// ══════════════════════════════════════════════════════════════════════════

/** How the active profile came to be active. Drives the revert rule below. */
export type TriggerSource = 'manual' | 'schedule' | 'game';

/**
 * Settings a profile may take over. Anything here must be a real Settings
 * schema key — `satisfies` fails the build if one is renamed out from under us.
 *
 * Deliberately appearance-only for now. Desk lighting is NOT here: the
 * Lighting widget holds its state in local `useState` and persists nothing, so
 * there is no baseline to override yet — it has to become a real setting first.
 */
export const OVERRIDABLE = ['accent', 'wallpaper', 'wpBlur', 'wpOpacity'] as const satisfies readonly SettingName[];
export type OverridableName = (typeof OVERRIDABLE)[number];
export type Overrides = Partial<Record<OverridableName, unknown>>;

/**
 * A recurring window that activates the profile.
 * `start`/`end` are minutes from midnight (0–1439); `days` are 0=Sun…6=Sat.
 */
export interface Schedule {
  enabled: boolean;
  start: number;
  end: number;
  days: number[];
}

/** Games whose launch activates the profile. Ids come from the OMEN AI game list. */
export interface GameLink {
  enabled: boolean;
  gameIds: string[];
}

export interface Profile {
  id: string;
  name: string;
  /**
   * The profile's photo — what identifies it beside its name everywhere.
   * `wp:<wallpaper id>` picks one of the app's wallpapers (theme-aware); a
   * `data:` URL is a photo the user uploaded (downscaled to a thumbnail).
   */
  image: string;
  overrides: Overrides;
  /** Captured per-device settings, keyed by SKU id. */
  devices: Record<string, SlotSettings>;
  gameLink: GameLink;
  schedule: Schedule;
}

export interface ProfileStore {
  profiles: Profile[];
  activeId: string;
  source: TriggerSource;
  /** Where a game close falls back to when no schedule applies. */
  revertTo: string | null;
}

export const EMPTY_SCHEDULE: Schedule = { enabled: false, start: 9 * 60, end: 17 * 60, days: [1, 2, 3, 4, 5] };
export const EMPTY_GAME_LINK: GameLink = { enabled: false, gameIds: [] };

/** The three profiles the app shipped with, now real records rather than labels. */
export const SEED_PROFILES: Profile[] = [
  { id: 'gaming', name: 'Gaming', image: 'wp:red', overrides: {}, devices: {}, gameLink: EMPTY_GAME_LINK, schedule: EMPTY_SCHEDULE },
  { id: 'work', name: 'Work', image: 'wp:blue', overrides: {}, devices: {}, gameLink: EMPTY_GAME_LINK, schedule: EMPTY_SCHEDULE },
  { id: 'silent', name: 'Silent', image: 'wp:purple', overrides: {}, devices: {}, gameLink: EMPTY_GAME_LINK, schedule: EMPTY_SCHEDULE },
];

export const DEFAULT_PROFILE_IMAGE = 'wp:abstractv2';

/**
 * Profiles saved before photos carried an accent-token id as their identity
 * color; the nearest wallpaper keeps them recognizable after the upgrade.
 */
const COLOR_TO_WALLPAPER: Record<string, string> = {
  red: 'wp:red', orange: 'wp:red', yellow: 'wp:red',
  cyan: 'wp:blue', green: 'wp:blue',
  indigo: 'wp:purple', purple: 'wp:purple',
};

export const newProfile = (id: string, name: string, image = DEFAULT_PROFILE_IMAGE): Profile => ({
  id,
  name,
  image,
  overrides: {},
  devices: {},
  gameLink: EMPTY_GAME_LINK,
  schedule: EMPTY_SCHEDULE,
});

/** Fill a parsed record out to a whole Profile, so a partial payload can't crash a consumer. */
export function hydrate(raw: Partial<Profile>, i: number): Profile {
  return {
    id: raw.id || `profile-${i}`,
    name: raw.name || 'Profile',
    image:
      raw.image ||
      COLOR_TO_WALLPAPER[(raw as { color?: string }).color ?? ''] ||
      DEFAULT_PROFILE_IMAGE,
    overrides: raw.overrides ?? {},
    devices: raw.devices ?? {},
    gameLink: { ...EMPTY_GAME_LINK, ...(raw.gameLink ?? {}) },
    schedule: { ...EMPTY_SCHEDULE, ...(raw.schedule ?? {}) },
  };
}

// ── Export / import ──────────────────────────────────────────────────────────
//
// A profiles file carries the profiles and nothing else: not which one is
// active, not the trigger state. Those describe THIS machine right now, and
// importing them would yank someone onto a profile they never chose.

/** Marks a file as ours, so an unrelated JSON file is refused rather than mangled. */
export const PROFILES_FILE_FORMAT = 'trhs-profiles';
export const PROFILES_FILE_VERSION = 1;

export interface ProfilesFile {
  format: typeof PROFILES_FILE_FORMAT;
  version: number;
  exported: string;
  profiles: Profile[];
}

/** The text of an export file. `now` is injectable so the output is testable byte for byte. */
export function serializeProfiles(profiles: Profile[], now: Date = new Date()): string {
  const file: ProfilesFile = {
    format: PROFILES_FILE_FORMAT,
    version: PROFILES_FILE_VERSION,
    exported: now.toISOString(),
    profiles,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * The profiles inside an export file, or `null` when the text is not one.
 * Anything that parses and carries our format marker is accepted — a future
 * version's extra fields are ignored and missing ones are filled by `hydrate`,
 * so an older app can still read a newer file's profiles.
 */
export function parseProfilesFile(text: string): Profile[] | null {
  try {
    const raw = JSON.parse(text) as Partial<ProfilesFile>;
    if (!raw || raw.format !== PROFILES_FILE_FORMAT || !Array.isArray(raw.profiles)) return null;
    return raw.profiles.filter((p) => p && typeof p === 'object').map(hydrate);
  } catch {
    return null;
  }
}

/**
 * Merge imported profiles into the store. Returns the new store and the ids
 * the imported profiles ended up with, in file order.
 *
 * The rule: a profile that is the SAME profile (same id and same name) is
 * updated in place, so re-importing your own export is idempotent and a file
 * from your other machine refreshes rather than duplicates. Anything else is
 * added — under a fresh id when its id is already taken, because two different
 * profiles must never share one. The active profile and trigger state are
 * untouched: importing is adding options, never choosing one.
 */
export function applyImport(
  s: ProfileStore,
  incoming: Profile[],
  freshId: () => string,
): { store: ProfileStore; ids: string[] } {
  if (incoming.length === 0) return { store: s, ids: [] };
  const profiles = [...s.profiles];
  const ids: string[] = [];
  incoming.forEach((p) => {
    const i = profiles.findIndex((q) => q.id === p.id && q.name === p.name);
    if (i >= 0) {
      profiles[i] = { ...p, id: profiles[i].id };
      ids.push(profiles[i].id);
      return;
    }
    const id = profiles.some((q) => q.id === p.id) ? freshId() : p.id;
    profiles.push({ ...p, id });
    ids.push(id);
  });
  return { store: { ...s, profiles }, ids };
}

// ── Schedule matching ────────────────────────────────────────────────────────

/**
 * Is `now` inside the schedule's window?
 *
 * A window that wraps midnight (22:00 → 02:00) belongs to the day it *started*
 * on, so the after-midnight tail of a Friday window tests Friday, not Saturday.
 * A zero-length window never matches — otherwise `start === end` would read as
 * "always", which is never what someone means by setting the same time twice.
 */
export function scheduleMatches(s: Schedule, now: Date): boolean {
  if (!s.enabled || s.days.length === 0 || s.start === s.end) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  if (s.start < s.end) return s.days.includes(day) && mins >= s.start && mins < s.end;
  if (mins >= s.start) return s.days.includes(day);
  return s.days.includes((day + 6) % 7);
}

/** The first profile whose schedule window covers `now`, or null. */
export function scheduledProfile(profiles: Profile[], now: Date): Profile | null {
  return profiles.find((p) => scheduleMatches(p.schedule, now)) ?? null;
}

/** The first profile linked to `gameId`, or null. */
export function linkedProfile(profiles: Profile[], gameId: string): Profile | null {
  return profiles.find((p) => p.gameLink.enabled && p.gameLink.gameIds.includes(gameId)) ?? null;
}

// ── Arbitration: the latest intent wins ──────────────────────────────────────
//
// Every switch records WHY it happened, because the revert rule depends on it.
// Manual and schedule are plain switches. The two game cases are the subtle
// ones, and they are subtle in opposite directions:
//
//   · A game launch beats an open schedule window — on a gaming PC, starting a
//     game is the loudest statement of intent there is.
//   · A game close only reverts IF a game is still what's reigning. Pick a
//     profile by hand mid-game and that pick supersedes the game's claim, so
//     closing the game must leave you where you chose to be.
//
// That second clause is the whole rule. Without it, "Work (scheduled) → launch
// game → manually pick Music → quit game" would yank you off Music, undoing a
// deliberate act on the strength of a stale one.

/** The user picked a profile. Beats everything until the next trigger event. */
export function applySelect(s: ProfileStore, id: string): ProfileStore {
  if (!s.profiles.some((p) => p.id === id)) return s;
  return { ...s, activeId: id, source: 'manual', revertTo: null };
}

/** A linked game launched. No-op when no profile claims that game. */
export function applyGameLaunch(s: ProfileStore, gameId: string): ProfileStore {
  const target = linkedProfile(s.profiles, gameId);
  if (!target || target.id === s.activeId) return s;
  return {
    ...s,
    activeId: target.id,
    source: 'game',
    // Remember where we came from — but only when a game isn't already
    // reigning, so game-to-game handoffs keep the pre-gaming profile.
    revertTo: s.source === 'game' ? s.revertTo : s.activeId,
  };
}

/** The game closed. Only reverts if a game is still what's reigning. */
export function applyGameClose(s: ProfileStore, now: Date): ProfileStore {
  if (s.source !== 'game') return s;
  // A schedule window that opened during play takes over on exit — it's the
  // newer standing intent. Otherwise go back where we were.
  const scheduled = scheduledProfile(s.profiles, now);
  if (scheduled) return { ...s, activeId: scheduled.id, source: 'schedule', revertTo: null };
  const back = s.profiles.find((p) => p.id === s.revertTo);
  return back
    ? { ...s, activeId: back.id, source: 'manual', revertTo: null }
    : { ...s, source: 'manual', revertTo: null };
}

/** A schedule window opened. Edge-triggered by the caller, never polled level. */
export function applyScheduleOpen(s: ProfileStore, id: string): ProfileStore {
  // A window opening mid-game does not steal focus; `applyGameClose` will find
  // it still open and hand over then.
  if (s.source === 'game' || !s.profiles.some((p) => p.id === id)) return s;
  return { ...s, activeId: id, source: 'schedule', revertTo: null };
}

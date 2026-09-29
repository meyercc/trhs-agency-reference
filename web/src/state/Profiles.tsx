import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SlotSettings } from './DeviceProfiles';
import {
  applyGameClose,
  applyGameLaunch,
  applyScheduleOpen,
  applyImport,
  applySelect,
  hydrate,
  newProfile,
  parseProfilesFile,
  SEED_PROFILES,
  serializeProfiles,
  type OverridableName,
  type Profile,
  type ProfileStore,
  type TriggerSource,
} from './profileModel';

// ══════════════════════════════════════════════════════════════════════════
// Software profiles — the app-level "what am I doing right now" axis.
//
// A profile is a *container*, not a screen. It holds three kinds of thing:
//
//   1. `overrides` — app settings it takes over while it is active. Unset keys
//      fall through to the Settings baseline, so a profile says only what it
//      cares about. Resolution happens inside SettingsProvider, which is why
//      this provider sits OUTSIDE it (main.tsx) — every existing
//      `useSettings()` consumer gets profile-aware values with no change.
//   2. `devices` — per-device settings captured while the profile was active.
//      Same shape as an onboard flash slot (`SlotSettings`), deliberately: the
//      two halves of the device profile bar hold the same kind of bag, one in
//      software and one in hardware.
//   3. `gameLink` / `schedule` — the triggers that can make it active.
//
// This replaces the old `state/profiles.ts`, where SOFTWARE_PROFILES was three
// hardcoded names with nothing behind them. The types and the arbitration
// rules live in `profileModel.ts`; this file is persistence and the provider.
// ══════════════════════════════════════════════════════════════════════════

export type { Profile, Schedule, GameLink, Overrides, OverridableName, TriggerSource } from './profileModel';
export { OVERRIDABLE, EMPTY_SCHEDULE, EMPTY_GAME_LINK, scheduleMatches, scheduledProfile, linkedProfile } from './profileModel';

const STORAGE_KEY = 'trhs-profiles';
/** Pre-profiles key. Read once so an existing install keeps the profile it was on. */
const LEGACY_ACTIVE_KEY = 'activeProfileId';

function load(): ProfileStore {
  let legacyActive: string | null = null;
  try {
    legacyActive = localStorage.getItem(LEGACY_ACTIVE_KEY);
  } catch {
    /* storage unavailable */
  }
  const fresh: ProfileStore = {
    profiles: SEED_PROFILES,
    activeId: legacyActive || SEED_PROFILES[0].id,
    source: 'manual',
    revertTo: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<ProfileStore>;
    const profiles =
      Array.isArray(parsed.profiles) && parsed.profiles.length > 0 ? parsed.profiles.map(hydrate) : SEED_PROFILES;
    // An activeId pointing at a deleted profile would leave the whole app
    // resolving against nothing — fall back rather than carry a dangling id.
    const activeId = profiles.some((p) => p.id === parsed.activeId) ? parsed.activeId! : profiles[0].id;
    return {
      profiles,
      activeId,
      source: parsed.source ?? 'manual',
      revertTo: profiles.some((p) => p.id === parsed.revertTo) ? parsed.revertTo! : null,
    };
  } catch {
    return fresh;
  }
}

function persist(store: ProfileStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

const uid = () => `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ── Context ──────────────────────────────────────────────────────────────────

interface ProfilesValue {
  profiles: Profile[];
  activeProfile: Profile;
  activeId: string;
  /** How the active profile came to be active. */
  source: TriggerSource;

  // Switching — the rules live in profileModel.ts.
  /** The user picked a profile. Beats everything until the next trigger. */
  selectProfile: (id: string) => void;
  /** A linked game launched. No-op when no profile claims that game. */
  gameLaunched: (gameId: string) => void;
  /** The game closed. Only reverts if a game is still what's reigning. */
  gameClosed: (now?: Date) => void;
  /** A schedule window opened. Edge-triggered by the caller, never polled level. */
  scheduleOpened: (id: string) => void;

  // CRUD
  createProfile: (name: string, image?: string) => string;
  updateProfile: (id: string, patch: Partial<Omit<Profile, 'id'>>) => void;
  deleteProfile: (id: string) => void;
  reorderProfiles: (ids: string[]) => void;

  /** Set one override on a profile. `undefined` clears it back to the baseline. */
  setOverride: (id: string, name: OverridableName, value: unknown) => void;
  /** Replace a device's captured settings wholesale. */
  setDeviceSettings: (id: string, deviceId: string, settings: SlotSettings) => void;
  /**
   * Merge keys into a device's captured settings.
   *
   * This is what callers writing ONE setting should use. Building the merged
   * object outside and passing it to `setDeviceSettings` reads the bag from a
   * render closure, so two writes in the same tick both start from the same
   * stale copy and the first one is silently lost — which is exactly what
   * happened to `sensor.motionSync` when two toggles were flipped together.
   * Merging inside the updater makes concurrent writes compose.
   */
  mergeDeviceSettings: (id: string, deviceId: string, patch: SlotSettings) => void;
  /** The text of a profiles file holding every profile — what "Export All Profiles" saves. */
  exportProfiles: () => string;
  /**
   * Merge a profiles file's contents in. Returns the ids the imported profiles
   * now have (file order), or `null` when the text is not a profiles file.
   * Never changes which profile is active.
   */
  importProfiles: (text: string) => string[] | null;
}

const ProfilesContext = createContext<ProfilesValue | null>(null);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ProfileStore>(load);

  const update = useCallback((next: (s: ProfileStore) => ProfileStore) => {
    setStore((s) => {
      const out = next(s);
      if (out === s) return s;
      persist(out);
      return out;
    });
  }, []);

  /** Patch one profile in place, leaving order and everything else alone. */
  const patch = useCallback(
    (id: string, fn: (p: Profile) => Profile) =>
      update((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? fn(p) : p)) })),
    [update],
  );

  const value = useMemo<ProfilesValue>(() => {
    // `load()` guarantees activeId resolves, and every mutation below keeps that
    // true, so this cannot be undefined — but fall back rather than crash the app.
    const activeProfile = store.profiles.find((p) => p.id === store.activeId) ?? store.profiles[0];

    return {
      profiles: store.profiles,
      activeProfile,
      activeId: activeProfile.id,
      source: store.source,

      selectProfile: (id) => update((s) => applySelect(s, id)),
      gameLaunched: (gameId) => update((s) => applyGameLaunch(s, gameId)),
      gameClosed: (now = new Date()) => update((s) => applyGameClose(s, now)),
      scheduleOpened: (id) => update((s) => applyScheduleOpen(s, id)),

      createProfile: (name, image) => {
        const id = uid();
        update((s) => ({ ...s, profiles: [...s.profiles, newProfile(id, name, image)] }));
        return id;
      },

      updateProfile: (id, p) => patch(id, (prev) => ({ ...prev, ...p, id: prev.id })),

      deleteProfile: (id) =>
        update((s) => {
          // The last profile can't go — the app always resolves against one.
          if (s.profiles.length <= 1 || !s.profiles.some((p) => p.id === id)) return s;
          const profiles = s.profiles.filter((p) => p.id !== id);
          const activeId = s.activeId === id ? profiles[0].id : s.activeId;
          // Deleting the revert target would leave a game close pointing at
          // nothing; drop the claim rather than revert somewhere arbitrary.
          const revertTo = s.revertTo === id ? null : s.revertTo;
          return { ...s, profiles, activeId, revertTo, source: s.activeId === id ? 'manual' : s.source };
        }),

      reorderProfiles: (ids) =>
        update((s) => {
          const by = new Map(s.profiles.map((p) => [p.id, p]));
          const next = ids.map((id) => by.get(id)).filter((p): p is Profile => !!p);
          // Anything the caller left out keeps its place at the end rather than
          // being silently dropped.
          const rest = s.profiles.filter((p) => !ids.includes(p.id));
          return { ...s, profiles: [...next, ...rest] };
        }),

      setOverride: (id, name, v) =>
        patch(id, (p) => {
          const overrides = { ...p.overrides };
          // `undefined` is "stop overriding", not "override with nothing" —
          // the key has to leave the object or resolution still finds it.
          if (v === undefined) delete overrides[name];
          else overrides[name] = v;
          return { ...p, overrides };
        }),

      setDeviceSettings: (id, deviceId, settings) =>
        patch(id, (p) => ({ ...p, devices: { ...p.devices, [deviceId]: settings } })),

      mergeDeviceSettings: (id, deviceId, keys) =>
        patch(id, (p) => ({
          ...p,
          devices: { ...p.devices, [deviceId]: { ...(p.devices[deviceId] ?? {}), ...keys } },
        })),

      exportProfiles: () => serializeProfiles(store.profiles),

      importProfiles: (text) => {
        const incoming = parseProfilesFile(text);
        if (!incoming) return null;
        // Resolve the merge against the store as it is now — `applyImport` is
        // pure, so the ids can be handed back synchronously.
        const { store: next, ids } = applyImport(store, incoming, uid);
        update(() => next);
        return ids;
      },
    };
  }, [store, update, patch]);

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within <ProfilesProvider>');
  return ctx;
}

/**
 * Profiles if they're mounted, null if not.
 *
 * SettingsProvider resolves through this. Stories (and any isolated render)
 * mount SettingsProvider on its own, and a primitive shouldn't need the whole
 * profile stack to show a swatch — without a profile above it, Settings simply
 * serves its baseline, which is exactly the right degraded behavior.
 */
export function useProfilesOptional(): ProfilesValue | null {
  return useContext(ProfilesContext);
}

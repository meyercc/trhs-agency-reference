// ── Personalize › Quick Control — shared state ────────────────────────────────
// One store for the page, so every view of a value is the same value: the
// Lighting tile's swatches, its 3D preview and the expanded Light Studio all
// read and write `desk.lighting` (page-local — see writeLighting); the Mode tile,
// the Home profile widget and the device modals' profile bar share Settings.activeId.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProfiles } from '../../state/Profiles';
import type { DeviceId, DeviceState, DeviceStates } from '../../lightstudio/scene';
import {
  DEFAULT_DESK,
  DEFAULT_PINS,
  MODE_PRESETS,
  deskToMode,
  type ModeDesk,
  sameLighting,
  contextForMode,
  scenarioById,
  type Scenario,
  type DeskState,
  type ModeOwned,
  type ScenarioId,
  type SuggestionId,
  type TileId,
  onPresets,
  MODE_ICON_CHOICES,
} from './model';

const STORAGE_KEY = 'personalize-quick-control-v1';

interface AutoSwitch {
  from: string;
  to: string;
}

interface Stored {
  desk: DeskState;
  overrides: ModeOwned[];
  /** The mode whose preset `desk` was last built from. */
  appliedMode: string;
  scenario: ScenarioId;
  pins: TileId[];
  dismissed: SuggestionId[];
  /** Accepted suggestions → what the desk looked like before, for Undo. */
  accepted: Partial<Record<SuggestionId, { desk: Partial<DeskState>; overrides: ModeOwned[] }>>;
  autoSwitch: AutoSwitch | null;
  /** Your changes to a mode's audio half (EQ, spatial, mic preset). Lighting is
   *  not kept per mode while it is page-local. */
  modeDesks: Record<string, ModeDesk>;
  /** The glyph each mode shows. Chris's Profile carries a photo, not an icon,
   *  and Personalize has always named modes with one (next: fold onto Profile). */
  modeIcons: Record<string, string>;
}

const INITIAL: Stored = {
  desk: DEFAULT_DESK,
  overrides: [],
  appliedMode: 'gaming',
  scenario: 'valorant',
  pins: DEFAULT_PINS,
  dismissed: [],
  accepted: {},
  autoSwitch: null,
  modeDesks: {},
  modeIcons: {},
};

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = { ...INITIAL, ...JSON.parse(raw) } as Stored;
    // Lighting saved before presets lands on the nearest preset.
    return {
      ...saved,
      desk: { ...saved.desk, lighting: onPresets(saved.desk.lighting) },
      modeDesks: Object.fromEntries(Object.entries(saved.modeDesks).map(([id, m]) => [id, { ...m, lighting: onPresets(m.lighting) }])),
    };
  } catch {
    return INITIAL;
  }
}

const OWNED_KEY: Record<ModeOwned, keyof DeskState> = {
  lighting: 'lighting',
  eq: 'eq',
  spatial: 'spatial',
  mic: 'micPreset',
};

export interface PersonalizeApi extends Stored {
  mode: string;
  /** The desk half of the active mode (built-in preset or the user's own). */
  preset: ModeDesk | undefined;
  /** What any mode sets on the desk. */
  presetFor: (id: string) => ModeDesk | undefined;
  /** Every mode, in profile order — Chris's profiles, with Personalize's icons. */
  modes: ModeSummary[];
  /** A mode's name, for a label. */
  modeName: (id: string) => string;
  /** Change what a mode sets — active or not. */
  saveModeDesk: (id: string, patch: Partial<ModeDesk>) => void;
  /** Keep a changed desk value as the active mode's own. */
  saveToMode: (key: ModeOwned) => void;
  /** Put a built-in mode back to how it shipped. */
  resetModeDesk: (id: string) => void;
  setMode: (mode: string) => void;
  undoAutoSwitch: () => void;
  setScenario: (id: ScenarioId) => void;
  /** Change desk values. Pass `owned` when the value belongs to the mode. */
  update: (patch: Partial<DeskState>, owned?: ModeOwned) => void;
  /** Patch lighting on some devices (all when `ids` is empty). */
  setLighting: (ids: DeviceId[], patch: Partial<DeviceState>) => void;
  /** Replace lighting wholesale — edits coming back from Light Studio. */
  replaceLighting: (states: DeviceStates) => void;
  resetOwned: (key: ModeOwned) => void;
  accept: (id: SuggestionId, patch: Partial<DeskState>, owned?: ModeOwned[]) => void;
  undoSuggestion: (id: SuggestionId) => void;
  dismiss: (id: SuggestionId) => void;
  pin: (id: TileId) => void;
  unpin: (id: TileId) => void;
  /** Replace Your usual (order included). */
}

/** A mode as Personalize lists it: the profile, plus the glyph it shows here. */
export interface ModeSummary {
  id: string;
  name: string;
  icon: string;
  /** False for the three the app shipped with (they can be reset, not deleted). */
  custom: boolean;
}

const Ctx = createContext<PersonalizeApi | null>(null);

export function PersonalizeProvider({ children }: { children: ReactNode }) {
  // Modes ARE profiles: Personalize keeps the desk half, the profile keeps the
  // identity, its overrides, its Game Link and its schedule.
  const { profiles, activeId, selectProfile } = useProfiles();
  const [st, setSt] = useState<Stored>(load);
  const stRef = useRef(st);
  stRef.current = st;

  // Desk lighting is PAGE-LOCAL for now (September 29 port decision): it lives in
  // this store's `desk.lighting`, not on the profile. Main already captures
  // lighting per device inside the profile (`lighting.*` keys in the device
  // panels); a whole-desk override next to that would be a second home for the
  // same setting. Until the desk is reconciled onto those per-device keys, a
  // profile switch leaves the desk's lighting alone.
  const lighting = st.desk.lighting;
  const lightingRef = useRef(lighting);
  lightingRef.current = lighting;
  const writeLighting = useCallback((next: DeviceStates) => {
    setSt((s) => (sameLighting(next, s.desk.lighting) ? s : { ...s, desk: { ...s.desk, lighting: structuredClone(next) } }));
  }, []);
  // What a mode sets on the desk: your edits, else the built-in default, else
  // the desk as it is now (a profile made outside Personalize starts from here).
  const presetFor = useCallback(
    (id: string): ModeDesk | undefined => {
      const base = st.modeDesks[id] ?? MODE_PRESETS[id];
      if (!base) return undefined;
      // The active profile's lighting is the live desk; another's is what it
      // shipped with (lighting is not saved per profile while it is page-local).
      const own = id === activeId ? lighting : base.lighting;
      return { ...base, lighting: own };
    },
    [st.modeDesks, activeId, lighting],
  );

  const modes: ModeSummary[] = useMemo(
    () =>
      profiles.map((prof) => ({
        id: prof.id,
        name: prof.name,
        icon: st.modeIcons[prof.id] ?? (MODE_ICON_CHOICES as readonly string[]).find((i) => i === prof.id) ?? 'star',
        custom: !MODE_PRESETS[prof.id],
      })),
    [profiles, st.modeIcons],
  );
  const modeName = useCallback((id: string) => modes.find((m) => m.id === id)?.name ?? 'Mode', [modes]);

  const presetRef = useRef(presetFor);
  presetRef.current = presetFor;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch {
      /* storage full or blocked — the page still works for this session */
    }
  }, [st]);

  // The mode changed (here, on Home, or in a device modal): rebuild the desk half
  // of it. Overrides belong to the mode they were made under, so they clear.
  useEffect(() => {
    setSt((s) => {
      if (s.appliedMode === activeId) return s;
      const preset = presetRef.current(activeId);
      const autoSwitch = s.autoSwitch && s.autoSwitch.to === activeId ? s.autoSwitch : null;
      if (!preset) return { ...s, appliedMode: activeId, autoSwitch };
      const { lighting: _lit, ...audioHalf } = preset;
      return {
        ...s,
        desk: { ...s.desk, ...audioHalf },
        overrides: [],
        accepted: {},
        appliedMode: activeId,
        autoSwitch,
      };
    });
  }, [activeId]);

  const switchFor = useCallback(
    (target: string) => {
      if (target === activeId) return;
      setSt((s) => ({ ...s, autoSwitch: { from: activeId, to: target } }));
      selectProfile(target);
    },
    [activeId, selectProfile],
  );

  const setMode = useCallback(
    (mode: string) => {
      setSt((s) => ({ ...s, autoSwitch: null }));
      selectProfile(mode);
    },
    [selectProfile],
  );

  const undoAutoSwitch = useCallback(() => {
    const a = stRef.current.autoSwitch;
    if (!a) return;
    setSt((s) => ({ ...s, autoSwitch: null }));
    selectProfile(a.from);
  }, [selectProfile]);

  const setScenario = useCallback(
    (id: ScenarioId) => {
      setSt((s) => ({ ...s, scenario: id, dismissed: [], accepted: {} }));
      switchFor(scenarioById(id).mode);
    },
    [switchFor],
  );

  const addOverride = (list: ModeOwned[], key?: ModeOwned) => (key && !list.includes(key) ? [...list, key] : list);

  const update = useCallback((patch: Partial<DeskState>, owned?: ModeOwned) => {
    setSt((s) => ({ ...s, desk: { ...s.desk, ...patch }, overrides: addOverride(s.overrides, owned) }));
  }, []);

  const setLighting = useCallback(
    (ids: DeviceId[], patch: Partial<DeviceState>) => {
      const current = lightingRef.current;
      const targets = ids.length ? ids : (Object.keys(current) as DeviceId[]);
      const next = { ...current } as DeviceStates;
      targets.forEach((id) => (next[id] = { ...next[id], ...patch }));
      writeLighting(next);
    },
    [writeLighting],
  );

  const replaceLighting = useCallback((states: DeviceStates) => writeLighting(states), [writeLighting]);

  const resetOwned = useCallback((key: ModeOwned) => {
    setSt((s) => {
      const preset = presetRef.current(s.appliedMode);
      if (!preset) return s;
      const field = OWNED_KEY[key];
      const value = field === 'lighting' ? structuredClone(preset.lighting) : preset[field as 'eq' | 'spatial' | 'micPreset'];
      return { ...s, desk: { ...s.desk, [field]: value }, overrides: s.overrides.filter((o) => o !== key) };
    });
  }, []);

  const accept = useCallback((id: SuggestionId, patch: Partial<DeskState>, owned: ModeOwned[] = []) => {
    setSt((s) => {
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, s.desk[k as keyof DeskState]])) as Partial<DeskState>;
      return {
        ...s,
        desk: { ...s.desk, ...patch },
        overrides: owned.reduce(addOverride, s.overrides),
        accepted: { ...s.accepted, [id]: { desk: before, overrides: s.overrides } },
      };
    });
  }, []);

  const undoSuggestion = useCallback((id: SuggestionId) => {
    setSt((s) => {
      const snap = s.accepted[id];
      if (!snap) return s;
      const accepted = { ...s.accepted };
      delete accepted[id];
      return { ...s, desk: { ...s.desk, ...snap.desk }, overrides: snap.overrides, accepted };
    });
  }, []);

  // ── Customizing a mode ────────────────────────────────────────────────────
  // Edits land on the mode itself, active or not. If it IS the active mode the
  // desk follows at once, and the edited values stop counting as overrides —
  // the desk and its mode agree again.
  const saveModeDesk = useCallback(
    (id: string, patch: Partial<ModeDesk>) => {
      const current = presetRef.current(id);
      if (!current) return;
      // Lighting is page-local: a mode never saves its own (see writeLighting).
      const { lighting: _lighting, ...audioPatch } = patch;
      patch = audioPatch;
      const next: ModeDesk = { ...current, ...patch, lighting: structuredClone(current.lighting) };
      const same = (a: ModeDesk, b: ModeDesk) =>
        sameLighting(a.lighting, b.lighting) && a.eq === b.eq && a.spatial === b.spatial && a.micPreset === b.micPreset;
      // Light Studio reports its lighting as it loads: an unchanged mode isn't an edit.
      if (same(next, current)) return;
      setSt((s) => {
        const modeDesks = { ...s.modeDesks, [id]: next };
        // Edited back to how it shipped: it's the built-in again, not an edit.
        const shipped = MODE_PRESETS[id];
        if (shipped && same(next, shipped)) delete modeDesks[id];
        return { ...s, modeDesks };
      });
      if (id === activeId) {
        const fields = Object.keys(patch);
        setSt((s) => ({
          ...s,
          desk: { ...s.desk, ...patch, ...(patch.lighting ? { lighting: structuredClone(patch.lighting) } : {}) },
          overrides: s.overrides.filter((o) => !fields.includes(OWNED_KEY[o])),
        }));
      }
    },
    [activeId],
  );

  const saveToMode = useCallback(
    (key: ModeOwned) => {
      const field = OWNED_KEY[key];
      saveModeDesk(activeId, { [field]: stRef.current.desk[field] } as Partial<ModeDesk>);
    },
    [saveModeDesk, activeId],
  );

  const resetModeDesk = useCallback(
    (id: string) => {
      const base = MODE_PRESETS[id];
      if (!base) return;
      setSt((s) => {
        const modeDesks = { ...s.modeDesks };
        delete modeDesks[id];
        const { lighting: _lit, ...audioHalf } = base;
        return id === activeId ? { ...s, modeDesks, desk: { ...s.desk, ...audioHalf }, overrides: [] } : { ...s, modeDesks };
      });
    },
    [activeId],
  );

  const dismiss = useCallback((id: SuggestionId) => {
    setSt((s) => (s.dismissed.includes(id) ? s : { ...s, dismissed: [...s.dismissed, id] }));
  }, []);

  const pin = useCallback((id: TileId) => {
    setSt((s) => (s.pins.includes(id) ? s : { ...s, pins: [...s.pins, id] }));
  }, []);
  const unpin = useCallback((id: TileId) => {
    setSt((s) => ({ ...s, pins: s.pins.filter((p) => p !== id) }));
  }, []);


  const api = useMemo<PersonalizeApi>(
    () => ({
      ...st,
      desk: { ...st.desk, lighting },
      mode: activeId,
      preset: presetFor(activeId),
      presetFor,
      modes,
      modeName,
      saveModeDesk,
      saveToMode,
      resetModeDesk,
      setMode,
      undoAutoSwitch,
      setScenario,
      update,
      setLighting,
      replaceLighting,
      resetOwned,
      accept,
      undoSuggestion,
      dismiss,
      pin,
      unpin,
    }),
    [st, lighting, activeId, presetFor, modes, modeName, saveModeDesk, saveToMode, resetModeDesk, setMode, undoAutoSwitch, setScenario, update, setLighting, replaceLighting, resetOwned, accept, undoSuggestion, dismiss, pin, unpin],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePersonalize(): PersonalizeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePersonalize must be used inside <PersonalizeProvider>');
  return v;
}

/** What the context strip, ranking and suggestions follow: the active mode's
 *  context. Switching modes — by hand or automatically — changes it. */
export function useActiveContext(): Scenario {
  const p = usePersonalize();
  const { modes } = usePersonalize();
  const mode = modes.find((m) => m.id === p.mode);
  return contextForMode(p.mode, mode?.name ?? p.mode, (mode?.icon as Scenario['icon'] | undefined) ?? 'star');
}

// ── Personalize › Quick Control — shared state ────────────────────────────────
// One store for the page, so every view of a value is the same value: the
// Lighting tile's swatches, its 3D preview and the expanded Light Studio all
// read and write `desk.lighting`; the Mode tile, the Home profile widget and the
// device modals' profile bar all share Settings.activeId.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../../state/Settings';
import { useProfiles } from '../../state/Profiles';
import {
  applyGameClose,
  applyGameLaunch,
  applyScheduleOpen,
  linkedProfile,
  scheduledProfile,
} from '../../state/profileModel';
import type { DeviceId, DeviceState, DeviceStates } from '../../lightstudio/scene';
import { clearsZones } from '../../lightstudio/towerZones';
import { CUSTOM_PRESET, DESK_PRESETS, presetPatch, type DeskPreset } from '../../lightstudio/presets';
import { ALL_CODES } from '../../devices/keyboardLayout';
import { RING_IDS, averageRgb } from '../../devices/MicCanvas';
import {
  DEFAULT_DESK,
  DEMO_NOW,
  arrangeQuickFront,
  pinTile,
  quickControls,
  unpinTile,
  DESK_SKU,
  DEFAULT_PINS,
  DEFAULT_TILE_ORDER,
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

/**
 * A switch the user did not make by picking a profile, and what the profile
 * band says about it. `via` is what moved it: one of the profile's own rules
 * (`game`, `schedule`), the end of a game (`ended`), or a question the band
 * asked and you answered (`asked`).
 */
interface AutoSwitch {
  from: string;
  to: string;
  via?: 'game' | 'schedule' | 'ended' | 'asked';
  /** The band's line, e.g. "Switched by Game Link · Valorant started 38 min ago". */
  reason?: string;
}

/** A switch Treehouse only guessed at: the band asks instead of acting. */
export interface ProfileAsk {
  to: string;
  question: string;
  /** Said once you answer yes, as the band's reason line. */
  reason: string;
  /** Offered when the guess was a game no profile links: "Always for Valorant". */
  linkGame?: { id: string; title: string };
}

interface Stored {
  desk: DeskState;
  overrides: ModeOwned[];
  /** The mode whose preset `desk` was last built from. */
  appliedMode: string;
  scenario: ScenarioId;
  pins: TileId[];
  /** Where you dragged the quick controls to; separate from what you starred. */
  order: TileId[];
  dismissed: SuggestionId[];
  /** Accepted suggestions → what the desk looked like before, for Undo. */
  accepted: Partial<Record<SuggestionId, { desk: Partial<DeskState>; overrides: ModeOwned[] }>>;
  autoSwitch: AutoSwitch | null;
  /** A guessed switch waiting for your answer. */
  ask: ProfileAsk | null;
  /** The quick control that was just saved to the profile, for its brief "Saved to …". */
  saved: { key: ModeOwned; at: number } | null;
  /** Your changes to built-in modes (the desk half). User-made modes keep their
   *  desk in Settings.customProfiles instead, next to their name and icon. */
  modeDesks: Record<string, ModeDesk>;
  /** The glyph each mode shows. Chris's Profile carries a colour, not an icon,
   *  and Personalize has always named modes with one. */
  modeIcons: Record<string, string>;
}

const INITIAL: Stored = {
  desk: DEFAULT_DESK,
  overrides: [],
  appliedMode: 'gaming',
  scenario: 'valorant',
  pins: DEFAULT_PINS,
  order: DEFAULT_TILE_ORDER,
  dismissed: [],
  accepted: {},
  autoSwitch: null,
  ask: null,
  saved: null,
  modeDesks: {},
  modeIcons: {},
};

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const saved = { ...INITIAL, ...parsed } as Stored;
    // Saved before position and star were split (2026-10-06): that build
    // starred the whole front on any star or drag, so keep the order it
    // showed and start the stars over.
    if (!parsed.order)
      Object.assign(saved, {
        order: quickControls(DEFAULT_TILE_ORDER, saved.pins).front.concat(DEFAULT_TILE_ORDER),
        pins: DEFAULT_PINS,
      });
    // Lighting saved before presets lands on the nearest preset.
    return {
      ...saved,
      // "Saved to …" is a moment, not a state: it never survives a reload.
      saved: null,
      desk: { ...saved.desk, lighting: onPresets(saved.desk.lighting) },
      modeDesks: Object.fromEntries(
        Object.entries(saved.modeDesks).map(([id, m]) => [id, { ...m, lighting: onPresets(m.lighting) }]),
      ),
    };
  } catch {
    return INITIAL;
  }
}

export type NewMode = { name: string; icon: string };

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
  /** Save what is on the desk now as a new mode, and switch to it. Returns its id. */
  createMode: (m: NewMode) => string;
  /** Rename / re-icon a user mode; `fromDesk` also replaces what it sets. */
  updateMode: (id: string, m: NewMode, fromDesk: boolean) => void;
  deleteMode: (id: string) => void;
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
  /** Answer the band's question yes. `always` also links the game, so next time it switches by itself. */
  acceptAsk: (always?: boolean) => void;
  /** Answer the band's question no. */
  dismissAsk: () => void;
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
  /**
   * Arrange the front of Quick Controls (a drag, or an arrow key on a grip):
   * every tile in the front becomes yours, in this order, so nothing jumps
   * after you drop it.
   */
  arrangeFront: (front: TileId[]) => void;
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

// ── Desk ⇄ device panel lighting (see PersonalizeProvider) ──────────────────
/** Desk devices whose own panel has a Lights tab (Keyboard, Mic, and since
 *  2026-10-01 the mouse and the tower via ProfileLights). The OMEN OLED 27 and
 *  the Cloud III have no lights of their own. */
const PANEL_LIT: DeviceId[] = ['keyboard', 'mic', 'mouse', 'tower'];
/** Devices whose panel paints each key or ring light: what the panel SHOWS is
 *  this record, not the preset, so a desk change has to repaint it too. */
export const PAINT: Partial<Record<DeviceId, { key: string; ids: string[] }>> = {
  keyboard: { key: 'lighting.keyColors', ids: ALL_CODES },
  mic: { key: 'lighting.lightColors', ids: RING_IDS },
};
const OFF_PRESET = DESK_PRESETS.find(p => p.id === 'preset-off')!;
type Bag = Record<string, unknown>;

/** What a panel stores for how this device is lit. The desk's own White has no
 *  panel preset, so a preset the panel cannot show is left as it was. */
function panelFromDesk(
  d: DeviceState,
  panelHas: (pid: string) => boolean,
  paint?: { key: string; ids: string[] },
  bag: Bag = {},
): Bag {
  const on = d.effect !== 'off' && d.brightness > 0;
  // Repaint every key / light in the desk color, unless they already all are
  // (or the panel painted its own mix, which already matches the desk on average).
  const painted = paint ? Object.values((bag[paint.key] as Record<string, string> | undefined) ?? {}) : [];
  const repaint = !!paint && on && !(painted.length > 0 && averageRgb(painted) === d.color);
  return {
    ...(repaint ? { [paint!.key]: Object.fromEntries(paint!.ids.map(id => [id, `rgb(${d.color})`])) } : {}),
    'lighting.power': on,
    'lighting.brightness': d.brightness,
    ...(on && d.preset && panelHas(d.preset) ? { 'lighting.preset': d.preset } : {}),
  };
}

/** How the desk lights a device its panel set. */
function deskFromPanel(
  d: DeviceState,
  bag: Bag,
  presetById: (pid: unknown) => DeskPreset | undefined,
  paint?: { key: string; ids: string[] },
): DeviceState {
  let out: DeviceState = { ...d };
  const p = presetById(bag['lighting.preset']);
  if (p && bag['lighting.power'] !== false) out = { ...out, ...presetPatch(p) };
  if (typeof bag['lighting.brightness'] === 'number') out.brightness = bag['lighting.brightness'];
  if (bag['lighting.power'] === false) return { ...out, ...presetPatch(OFF_PRESET) };
  if (bag['lighting.power'] === true && out.effect === 'off') out = { ...out, ...presetPatch(p ?? DESK_PRESETS[0]) };
  // Keys or ring lights painted by hand: the desk shows one color per device,
  // so it wears their average. A paint that is just the preset's own glow
  // keeps the preset (and its effect); anything else is a solid custom color.
  const painted = paint ? Object.values((bag[paint.key] as Record<string, string> | undefined) ?? {}) : [];
  const avg = painted.length ? averageRgb(painted) : null;
  if (avg && avg !== out.color) out = { ...out, color: avg, effect: 'solid', preset: CUSTOM_PRESET };
  return out;
}

const sameDevice = (a: DeviceState, b: DeviceState) =>
  a.color === b.color && a.effect === b.effect && a.brightness === b.brightness && a.preset === b.preset;

/** The same array instance until an element changes identity — a memo key for lists rebuilt each render. */
function useShallowStable<T>(arr: T[]): T[] {
  const ref = useRef(arr);
  if (arr.length !== ref.current.length || arr.some((x, i) => x !== ref.current[i])) ref.current = arr;
  return ref.current;
}

export function PersonalizeProvider({ children }: { children: ReactNode }) {
  // Modes ARE profiles: Personalize keeps the desk half, the profile keeps the
  // identity, its overrides, its Game Link and its schedule.
  //
  // This provider wraps the whole page, so its value must only change when
  // something Personalize shows changes. The profiles value is new on EVERY
  // profile edit (its functions too), and a Game Link toggle in the Profiles
  // modal used to rebuild this value and re-render the entire page behind the
  // modal: 50–100 ms per click, against ~10 ms over Home (measured 2026-10-01).
  // So: read profiles through a ref, wrap its functions once, and key the
  // derived values on what they actually use — names, and override objects
  // (which keep their identity unless an override changes).
  const prof = useProfiles();
  const profRef = useRef(prof);
  profRef.current = prof;
  const { activeId } = prof;
  const profiles = prof.profiles;
  const selectProfile = useCallback((id: string) => profRef.current.selectProfile(id), []);
  const createProfile = useCallback((name: string, image?: string) => profRef.current.createProfile(name, image), []);
  const updateProfile = useCallback(
    (id: string, p: Parameters<typeof prof.updateProfile>[1]) => profRef.current.updateProfile(id, p),
    [],
  );
  const deleteProfile = useCallback((id: string) => profRef.current.deleteProfile(id), []);
  const setOverride = useCallback(
    (id: string, name: Parameters<typeof prof.setOverride>[1], v: unknown) => profRef.current.setOverride(id, name, v),
    [],
  );
  const overridesList = useShallowStable(profiles.map(p => p.overrides));
  const namesKey = profiles.map(p => `${p.id}\u0000${p.name}`).join('\u0001');
  // Desk lighting is a real setting (Settings SCHEMA) and an overridable one, so
  // `deskLighting` already arrives resolved for whoever is active. Nothing saved
  // yet falls back to the lighting that profile shipped with.
  const { deskLighting } = useSettings();
  const [st, setSt] = useState<Stored>(load);
  const stRef = useRef(st);
  stRef.current = st;

  const lighting = useMemo(
    () => onPresets((deskLighting as DeviceStates | null) ?? MODE_PRESETS[activeId]?.lighting ?? DEFAULT_DESK.lighting),
    [deskLighting, activeId],
  );
  const lightingRef = useRef(lighting);
  lightingRef.current = lighting;
  /** Writing the desk's lighting IS writing the active profile's. */
  // Light Studio reports its scene after the states prop changes, so the first
  // report after a profile switch is the OLD profile's lighting arriving late.
  // Writing it would hand the profile you just picked the look you just left.
  const wroteFor = useRef(activeId);

  // ── The desk and the device panels are one lighting ──────────────────────
  // The keyboard and mic panels keep their lighting in the profile's device
  // settings (`lighting.preset` / `.brightness` / `.power`); the desk keeps
  // its own copy in `deskLighting`. They used to be two lightings: change the
  // keyboard to Banana in its panel and the desk here stayed on Wave (Kristy,
  // 2026-10-01). Both preset lists are NGENUITY's (same ids), so each side now
  // writes the other: the desk pushes into the panels below (`pushToPanels`),
  // and the effect after it pulls a panel's change onto the desk.
  const { lightPresets } = useSettings();
  const presetById = useCallback(
    (pid: unknown) =>
      typeof pid === 'string'
        ? lightPresets.find(x => x.id === pid) ?? DESK_PRESETS.find(x => x.id === pid)
        : undefined,
    [lightPresets],
  );
  const pushToPanels = useCallback(
    (profileId: string, next: DeviceStates) => {
      const p = profRef.current.profiles.find(pr => pr.id === profileId);
      PANEL_LIT.forEach(deskId => {
        const d = next[deskId];
        const sku = DESK_SKU[deskId];
        if (!d || !p) return;
        const bag = p.devices[sku] ?? {};
        const want = panelFromDesk(d, pid => lightPresets.some(x => x.id === pid), PAINT[deskId], bag);
        if (Object.entries(want).every(([k, v]) => JSON.stringify(bag[k]) === JSON.stringify(v))) return;
        profRef.current.mergeDeviceSettings(profileId, sku, want);
      });
    },
    [lightPresets],
  );

  const writeLighting = useCallback(
    (next: DeviceStates) => {
      if (wroteFor.current !== activeId) {
        wroteFor.current = activeId;
        return;
      }
      if (sameLighting(next, lightingRef.current)) return;
      setOverride(activeId, 'deskLighting', structuredClone(next));
      pushToPanels(activeId, next);
    },
    [activeId, setOverride, pushToPanels],
  );

  // A panel changed (same profile, not a switch): put it on the desk.
  const panelSig = PANEL_LIT.map(id => {
    const bag = prof.activeProfile.devices[DESK_SKU[id]] ?? {};
    const paint = PAINT[id];
    return `${String(bag['lighting.preset'])}|${String(bag['lighting.brightness'])}|${String(bag['lighting.power'])}|${
      paint ? JSON.stringify(bag[paint.key] ?? null) : ''
    }`;
  }).join('/');
  const seenPanels = useRef({ profile: activeId, sig: panelSig });
  const seenOnce = useRef(false);
  useEffect(() => {
    const seen = seenPanels.current;
    seenPanels.current = { profile: activeId, sig: panelSig };
    // A profile switch brings both halves of the new profile at once, so it is
    // not an edit to carry across — unless the desk has never been set for this
    // profile (no `deskLighting` of its own, only the shipped default). Then
    // the panel's explicit choice is the profile's lighting: this is what
    // mends a profile saved before the two were joined (Banana on the keyboard
    // panel, Wave on the desk).
    const switched = seen.profile !== activeId || !seenOnce.current;
    seenOnce.current = true;
    if (switched ? 'deskLighting' in prof.activeProfile.overrides : seen.sig === panelSig) return;
    const cur = lightingRef.current;
    let next: DeviceStates | null = null;
    PANEL_LIT.forEach(deskId => {
      const bag = prof.activeProfile.devices[DESK_SKU[deskId]];
      const d = cur[deskId];
      if (!bag || !d) return;
      const lit = deskFromPanel(d, bag, presetById, PAINT[deskId]);
      if (sameDevice(lit, d)) return;
      next = next ?? { ...cur };
      next[deskId] = lit;
    });
    if (next) setOverride(activeId, 'deskLighting', structuredClone(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelSig, activeId]);
  // What a mode sets on the desk: your edits, else the built-in default, else
  // the desk as it is now (a profile made outside Personalize starts from here).
  const presetFor = useCallback(
    (id: string): ModeDesk | undefined => {
      // A profile made outside Personalize has no desk of its own yet: the
      // active one wears the desk as it is, so what you change lands on it.
      const base = st.modeDesks[id] ?? MODE_PRESETS[id] ?? (id === activeId ? deskToMode(st.desk) : undefined);
      if (!base) return undefined;
      // The active profile's lighting is the live one; another profile's is
      // whatever it has saved, or what it shipped with.
      const own =
        id === activeId
          ? lighting
          : (profRef.current.profiles.find(pr => pr.id === id)?.overrides.deskLighting as DeviceStates | undefined) ??
            base.lighting;
      return { ...base, lighting: own };
    },
    // `overridesList` stands in for the profiles: it changes when any
    // profile's overrides (its desk lighting among them) change, and only then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st.modeDesks, st.desk, activeId, lighting, overridesList],
  );

  const modes: ModeSummary[] = useMemo(
    () =>
      profRef.current.profiles.map(pr => ({
        id: pr.id,
        name: pr.name,
        icon: st.modeIcons[pr.id] ?? (MODE_ICON_CHOICES as readonly string[]).find(i => i === pr.id) ?? 'star',
        custom: !MODE_PRESETS[pr.id],
      })),
    // Ids and names are all a mode summary reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namesKey, st.modeIcons],
  );
  const modeName = useCallback((id: string) => modes.find(m => m.id === id)?.name ?? 'Mode', [modes]);

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
    setSt(s => {
      if (s.appliedMode === activeId) return s;
      const preset = presetRef.current(activeId);
      const autoSwitch = s.autoSwitch && s.autoSwitch.to === activeId ? s.autoSwitch : null;
      // A question about switching to where you already are has been answered.
      const ask = s.ask && s.ask.to === activeId ? null : s.ask;
      if (!preset) return { ...s, appliedMode: activeId, autoSwitch, ask };
      const { lighting: _lit, ...audioHalf } = preset;
      return {
        ...s,
        desk: { ...s.desk, ...audioHalf },
        overrides: [],
        accepted: {},
        appliedMode: activeId,
        autoSwitch,
        ask,
      };
    });
  }, [activeId]);

  const setMode = useCallback(
    (mode: string) => {
      setSt(s => ({ ...s, autoSwitch: null, ask: null }));
      selectProfile(mode);
    },
    [selectProfile],
  );

  const undoAutoSwitch = useCallback(() => {
    const a = stRef.current.autoSwitch;
    if (!a) return;
    setSt(s => ({ ...s, autoSwitch: null }));
    selectProfile(a.from);
  }, [selectProfile]);

  // ── Simulated context → the profile's own rules ──────────────────────────
  // A context stands in for a real signal. It no longer picks a profile by
  // itself: it becomes the trigger event it represents and runs through the
  // same arbitration rules the product would (`profileModel.ts`). What moves
  // the profile is one of ITS rules — a Game Link or a Schedule the user set —
  // and those act and say so (with Undo). A signal no rule covers is only
  // Treehouse's guess, and a guess asks.
  const setScenario = useCallback((id: ScenarioId) => {
    const sc = scenarioById(id);
    const prev = scenarioById(stRef.current.scenario);
    const at = sc.at ?? DEMO_NOW;
    const { store, profiles } = profRef.current;
    const nameOf = (pid: string) => profiles.find(pr => pr.id === pid)?.name ?? pid;
    let next = store;
    let via: AutoSwitch['via'];
    let reason = '';

    // Leaving a game is its own event: the game closed.
    if (prev.trigger.kind === 'game' && prev.id !== id) {
      const closed = applyGameClose(next, at);
      if (closed.activeId !== next.activeId) {
        via = closed.source === 'schedule' ? 'schedule' : 'ended';
        reason = `Back from ${nameOf(next.activeId)} · ${prev.trigger.title} closed`;
      }
      next = closed;
    }

    let ask: ProfileAsk | null = null;
    const target = profiles.find(pr => pr.id === sc.mode);
    const t = sc.trigger;
    if (t.kind === 'game' && linkedProfile(next.profiles, t.gameId)) {
      const launched = applyGameLaunch(next, t.gameId);
      if (launched.activeId !== next.activeId) {
        via = 'game';
        reason = `Switched by Game Link · ${sc.modeReason}`;
      }
      next = launched;
    } else if (t.kind === 'schedule' && scheduledProfile(next.profiles, at)) {
      const opened = applyScheduleOpen(next, scheduledProfile(next.profiles, at)!.id);
      if (opened.activeId !== next.activeId) {
        via = 'schedule';
        reason = `Switched by your schedule · ${sc.when.replace(/^Your schedule · /, '')}`;
      }
      next = opened;
    } else if (target && target.id !== next.activeId && sc.ask) {
      ask = {
        to: target.id,
        question: sc.ask,
        reason: `You switched · ${sc.modeReason}`,
        ...(t.kind === 'game' ? { linkGame: { id: t.gameId, title: t.title } } : {}),
      };
    }

    const from = store.activeId;
    const moved = next.activeId !== from;
    setSt(s => ({
      ...s,
      scenario: id,
      dismissed: [],
      accepted: {},
      ask,
      autoSwitch: moved ? { from, to: next.activeId, via, reason } : null,
    }));
    if (next !== store) profRef.current.apply(next);
  }, []);

  const acceptAsk = useCallback(
    (always = false) => {
      const a = stRef.current.ask;
      if (!a) return;
      if (always && a.linkGame) {
        // Turn the guess into a rule: next time this game switches by itself.
        const target = profRef.current.profiles.find(pr => pr.id === a.to);
        if (target) {
          const gameIds = target.gameLink.gameIds.includes(a.linkGame.id)
            ? target.gameLink.gameIds
            : [...target.gameLink.gameIds, a.linkGame.id];
          updateProfile(a.to, { gameLink: { enabled: true, gameIds } });
        }
      }
      setSt(s => ({ ...s, ask: null, autoSwitch: { from: activeId, to: a.to, via: 'asked', reason: a.reason } }));
      selectProfile(a.to);
    },
    [activeId, selectProfile, updateProfile],
  );

  const dismissAsk = useCallback(() => setSt(s => ({ ...s, ask: null })), []);

  const addOverride = (list: ModeOwned[], key?: ModeOwned) => (key && !list.includes(key) ? [...list, key] : list);

  const setLighting = useCallback(
    (ids: DeviceId[], patch: Partial<DeviceState>) => {
      const current = lightingRef.current;
      const targets = ids.length ? ids : (Object.keys(current) as DeviceId[]);
      const next = { ...current } as DeviceStates;
      targets.forEach(id => {
        next[id] = { ...next[id], ...patch };
        // A look for the whole tower puts its zones back on it (towerZones.ts).
        if (clearsZones(patch)) delete next[id].chassis;
      });
      writeLighting(next);
    },
    [writeLighting],
  );

  const replaceLighting = useCallback((states: DeviceStates) => writeLighting(states), [writeLighting]);

  const resetOwned = useCallback((key: ModeOwned) => {
    setSt(s => {
      const preset = presetRef.current(s.appliedMode);
      if (!preset) return s;
      const field = OWNED_KEY[key];
      const value =
        field === 'lighting' ? structuredClone(preset.lighting) : preset[field as 'eq' | 'spatial' | 'micPreset'];
      return { ...s, desk: { ...s.desk, [field]: value }, overrides: s.overrides.filter(o => o !== key) };
    });
  }, []);

  const accept = useCallback((id: SuggestionId, patch: Partial<DeskState>, owned: ModeOwned[] = []) => {
    setSt(s => {
      const before = Object.fromEntries(
        Object.keys(patch).map(k => [k, s.desk[k as keyof DeskState]]),
      ) as Partial<DeskState>;
      return {
        ...s,
        desk: { ...s.desk, ...patch },
        overrides: owned.reduce(addOverride, s.overrides),
        accepted: { ...s.accepted, [id]: { desk: before, overrides: s.overrides } },
      };
    });
  }, []);

  const undoSuggestion = useCallback((id: SuggestionId) => {
    setSt(s => {
      const snap = s.accepted[id];
      if (!snap) return s;
      const accepted = { ...s.accepted };
      delete accepted[id];
      return { ...s, desk: { ...s.desk, ...snap.desk }, overrides: snap.overrides, accepted };
    });
  }, []);

  const createMode = useCallback(
    ({ name, icon }: NewMode) => {
      const id = createProfile(name);
      setSt(s => ({
        ...s,
        modeIcons: { ...s.modeIcons, [id]: icon },
        modeDesks: { ...s.modeDesks, [id]: deskToMode(stRef.current.desk) },
        appliedMode: id,
        overrides: [],
        autoSwitch: null,
      }));
      selectProfile(id);
      return id;
    },
    [createProfile, selectProfile],
  );

  const updateMode = useCallback(
    (id: string, { name, icon }: NewMode, fromDesk: boolean) => {
      updateProfile(id, { name });
      setSt(s => ({
        ...s,
        modeIcons: { ...s.modeIcons, [id]: icon },
        ...(fromDesk ? { modeDesks: { ...s.modeDesks, [id]: deskToMode(stRef.current.desk) } } : {}),
        ...(fromDesk && stRef.current.appliedMode === id ? { overrides: [] } : {}),
      }));
    },
    [updateProfile],
  );

  const deleteMode = useCallback(
    (id: string) => {
      deleteProfile(id);
      setSt(s => {
        const modeDesks = { ...s.modeDesks };
        const modeIcons = { ...s.modeIcons };
        delete modeDesks[id];
        delete modeIcons[id];
        return { ...s, modeDesks, modeIcons };
      });
    },
    [deleteProfile],
  );

  // ── Customizing a mode ────────────────────────────────────────────────────
  // Edits land on the mode itself, active or not. If it IS the active mode the
  // desk follows at once, and the edited values stop counting as overrides —
  // the desk and its mode agree again.
  const saveModeDesk = useCallback(
    (id: string, patch: Partial<ModeDesk>) => {
      const current = presetRef.current(id);
      if (!current) return;
      if (patch.lighting) {
        setOverride(id, 'deskLighting', structuredClone(patch.lighting));
        pushToPanels(id, patch.lighting);
      }
      const next: ModeDesk = { ...current, ...patch, lighting: structuredClone(patch.lighting ?? current.lighting) };
      const same = (a: ModeDesk, b: ModeDesk) =>
        sameLighting(a.lighting, b.lighting) && a.eq === b.eq && a.spatial === b.spatial && a.micPreset === b.micPreset;
      // Light Studio reports its lighting as it loads: an unchanged mode isn't an edit.
      if (same(next, current)) return;
      setSt(s => {
        const modeDesks = { ...s.modeDesks, [id]: next };
        // Edited back to how it shipped: it's the built-in again, not an edit.
        const shipped = MODE_PRESETS[id];
        if (shipped && same(next, shipped)) delete modeDesks[id];
        return { ...s, modeDesks };
      });
      if (id === activeId) {
        const fields = Object.keys(patch);
        setSt(s => ({
          ...s,
          desk: { ...s.desk, ...patch, ...(patch.lighting ? { lighting: structuredClone(patch.lighting) } : {}) },
          overrides: s.overrides.filter(o => !fields.includes(OWNED_KEY[o])),
        }));
      }
    },
    [activeId, setOverride, pushToPanels],
  );

  // What you change is saved to what's running (NGENUITY: "Customized settings
  // are automatically applied"). A value the profile owns goes straight into
  // the active profile — no Changed badge, no Keep/Reset — and the tile says
  // "Saved to Gaming" for a moment. Values the profile does not own (volume,
  // mute, sidetone, DPI, buttons) only change the desk.
  const update = useCallback(
    (patch: Partial<DeskState>, owned?: ModeOwned) => {
      if (!owned) {
        setSt(s => ({ ...s, desk: { ...s.desk, ...patch } }));
        return;
      }
      saveModeDesk(activeId, patch as Partial<ModeDesk>);
      setSt(s => ({ ...s, saved: { key: owned, at: Date.now() } }));
    },
    [saveModeDesk, activeId],
  );

  // The "Saved to …" moment fades on its own.
  useEffect(() => {
    if (!st.saved) return;
    const at = st.saved.at;
    const t = window.setTimeout(() => setSt(s => (s.saved?.at === at ? { ...s, saved: null } : s)), 2400);
    return () => window.clearTimeout(t);
  }, [st.saved]);

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
      // Back to how it shipped means the profile stops overriding the lighting.
      setOverride(id, 'deskLighting', undefined);
      pushToPanels(id, base.lighting);
      setSt(s => {
        const modeDesks = { ...s.modeDesks };
        delete modeDesks[id];
        const { lighting: _lit, ...audioHalf } = base;
        return id === activeId
          ? { ...s, modeDesks, desk: { ...s.desk, ...audioHalf }, overrides: [] }
          : { ...s, modeDesks };
      });
    },
    [activeId, setOverride, pushToPanels],
  );

  const dismiss = useCallback((id: SuggestionId) => {
    setSt(s => (s.dismissed.includes(id) ? s : { ...s, dismissed: [...s.dismissed, id] }));
  }, []);

  // The star and the drag are separate (Quick Controls direction A): the star
  // only marks a tile, the drag only moves one. See pinTile / unpinTile.
  const pin = useCallback((id: TileId) => {
    setSt(s => ({ ...s, pins: pinTile(s.pins, id) }));
  }, []);
  const unpin = useCallback((id: TileId) => {
    setSt(s => ({ ...s, pins: unpinTile(s.pins, id) }));
  }, []);
  // A drag rearranges the front only; what you starred stays starred, and
  // starred tiles reorder among themselves (see arrangeQuickFront).
  const arrangeFront = useCallback((front: TileId[]) => {
    setSt(s => {
      const next = arrangeQuickFront(s.order, s.pins, front);
      const same = (a: TileId[], b: TileId[]) => a.length === b.length && a.every((id, i) => id === b[i]);
      return same(next.order, s.order) && same(next.pins, s.pins) ? s : { ...s, ...next };
    });
  }, []);

  const api = useMemo<PersonalizeApi>(
    () => ({
      ...st,
      desk: { ...st.desk, lighting },
      mode: activeId,
      preset: presetFor(activeId),
      createMode,
      updateMode,
      deleteMode,
      presetFor,
      modes,
      modeName,
      saveModeDesk,
      saveToMode,
      resetModeDesk,
      setMode,
      undoAutoSwitch,
      setScenario,
      acceptAsk,
      dismissAsk,
      update,
      setLighting,
      replaceLighting,
      resetOwned,
      accept,
      undoSuggestion,
      dismiss,
      pin,
      unpin,
      arrangeFront,
    }),
    [
      st,
      lighting,
      activeId,
      presetFor,
      modes,
      modeName,
      createMode,
      updateMode,
      deleteMode,
      saveModeDesk,
      saveToMode,
      resetModeDesk,
      setMode,
      undoAutoSwitch,
      setScenario,
      acceptAsk,
      dismissAsk,
      update,
      setLighting,
      replaceLighting,
      resetOwned,
      accept,
      undoSuggestion,
      dismiss,
      pin,
      unpin,
      arrangeFront,
    ],
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
  const mode = modes.find(m => m.id === p.mode);
  return contextForMode(p.mode, mode?.name ?? p.mode, (mode?.icon as Scenario['icon'] | undefined) ?? 'star');
}

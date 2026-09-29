import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EqBandParam } from '../devices/eqParametric';
import { LIGHT_PRESETS, type LightPreset } from '../devices/lightingData';
import { useProfilesOptional } from './Profiles';
import { DESK_DEFAULT, DESK_OPTIONAL, type DeskDevice } from '../devices/arrangement';

/** `deskDevices` as stored (null / junk → the full desk), narrowed to known ids. */
function deskDevicesOf(v: unknown): DeskDevice[] {
  if (!Array.isArray(v)) return DESK_DEFAULT;
  return DESK_OPTIONAL.filter((d) => v.includes(d));
}
/** Host indices on the desk; never empty (mirrors `deskPcs` in arrangement.ts). */
function deskPcsOf(v: unknown): number[] {
  const d = deskDevicesOf(v);
  const out: number[] = [];
  if (d.includes('macbook')) out.push(0);
  if (d.includes('tower')) out.push(1);
  return out.length ? out : [0];
}

export type Theme = 'dark' | 'light' | 'system';
/** Spacing density. `comfortable` is the design-system default. */
export type Density = 'comfortable' | 'compact';
export type TempUnit = 'C' | 'F';
export interface DisplayArrange {
  mode: 'extend' | 'mirror';
  // Tile top-left as a fraction of the stage box (0–1) when `space` says so.
  // Payloads without the tag predate the shared arrangement and are ignored —
  // they were pixels on whichever stage happened to save them (devices/arrangement.ts).
  positions: Record<string, { left: number; top: number }>;
  space?: 'fraction';
  /**
   * Which end of the desk each computer stands at (2026-09-10, Cindy).
   *
   * NOT a coordinate, on purpose. A computer has no pixels, so it has no place
   * in the space `positions` describes — the cursor never crosses into it and
   * nothing docks against it. What it does have is a SIDE: my tower is at the
   * left end of my desk, or the right. That is the whole of what a person wants
   * to say here, and it is the only part both lenses can honour with their own
   * spacing (the editor packs flush, the desk picture leaves real gaps).
   *
   * Absent = the authored side, which is where the app has always guessed.
   */
  computers?: Record<string, 'left' | 'right'>;
}

/**
 * A user-made equalizer preset. One list holds both kinds — a preset is a
 * preset wherever it is picked — and each editor edits only its own kind.
 * Factory presets are SKU data and never appear here.
 */
export interface SimpleEqPreset {
  kind: 'simple';
  id: string;
  label: string;
  bands: 5 | 10;
  /** Index-aligned with the band set named by `bands`, in dB. */
  gains: number[];
}
export interface ParametricEqPreset {
  kind: 'parametric';
  id: string;
  label: string;
  /** Always the ten fixed bands (see devices/eqParametric.ts). */
  params: EqBandParam[];
}
export type CustomEqPreset = SimpleEqPreset | ParametricEqPreset;

/** Presets saved before there were kinds are simple ones. */
export const normalizeEqPresets = (raw: unknown): CustomEqPreset[] =>
  Array.isArray(raw)
    ? (raw as Partial<CustomEqPreset>[]).map((p) => (p.kind ? (p as CustomEqPreset) : ({ ...p, kind: 'simple' } as SimpleEqPreset)))
    : [];

/**
 * The keyboard Lighting tab's preset library. Unlike EQ presets the factory
 * ones are part of the list — the user duplicates, edits and deletes them in
 * place — so nothing stored means the factory list, and a stored list (even
 * an empty one) is exactly what the user curated. The *picked* preset is a
 * profile value (`lighting.preset`), not part of this.
 */
export const normalizeLightPresets = (raw: unknown): LightPreset[] =>
  Array.isArray(raw) ? (raw as LightPreset[]).filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') : LIGHT_PRESETS;

// KVM routing for a KVM-capable monitor. Shared so the monitor's KVM tab and the
// peripheral device cards agree on which PC currently owns the keyboard + mouse.
// `configured` gates the "set up KVM" discoverability prompt (off until set up).
export interface KvmState {
  configured: boolean;
  activePc: 'pc1' | 'pc2';
  moveKbm: boolean;
}
export const DEFAULT_KVM: KvmState = { configured: false, activePc: 'pc1', moveKbm: true };

// Under-glow: the LED strip on the back of the monitor, not a UI colour. Shared
// (rather than local to the Under-Glow section) because the light is supposed to
// be visible on the product itself — the modal hero's desk map and the Perform
// card both draw a pool of it behind the render, and a control that changes a
// lamp nobody can see is a control that cannot be checked. `color` is a hex,
// not an index into the palette, so a palette edit can never repaint saved state
// into a different colour.
export interface UnderGlowState {
  enabled: boolean;
  /** The colour in force right now — what the hero map and the Perform card
   *  draw. Resolved from `byMode` when the mode changes; kept as its own field
   *  so the surfaces that only draw the lamp need no idea modes exist. */
  color: string;
  /** 0–100, the strip's own brightness (not the screen's). */
  brightness: number;
  /**
   * Colour per mode. The screen says "Screen, audio and under-glow follow the
   * mode", so the lamp is one of the things a mode remembers — pick green in
   * Game and Game stays green, while Work keeps its own. Empty means every mode
   * is still on its default (MODE_GLOW in MonitorTabs.tsx). Written per mode
   * rather than as one shared colour because one shared colour cannot change
   * when the mode changes, which is the behaviour the caption promises.
   */
  byMode: Record<string, string>;
  /**
   * Level per mode, same idea as `byMode` and kept separate rather than folded
   * into it so a payload saved before this existed still loads (the reducer
   * spreads over the default). It exists because Create pins a level as well as
   * a colour, and without somewhere to put the level a mode was standing in,
   * leaving Create would strand its dim value on Game.
   */
  byModeLevel?: Record<string, number>;
}
// Picture: the Display tab's own controls, not the strip on the back of the
// chassis (that's UnderGlowState) and not Calibration / RGB gain, which are
// device-scoped and locked (profile-proposal-2026-07.md, "What a mode
// remembers"). One object rather than four settings because the decision doc
// lists them as one row, and because the card that reports them has room for
// one line, not four (2026-08-24, Cindy).
//
// Brightness IS here as of 2026-08-29, and the rule the last revision was
// waiting for is now stated (Cindy, decision queue):
//
//   THE MODE WINS, AND MATCHING HAPPENS INSIDE THE MODE.
//
// Switching to Game puts this monitor on Game's brightness, and while
// `displaySync` is on every display on the desk goes there with it. That is the
// only combination that keeps BOTH promises the screen already makes — "screen,
// audio and under-glow follow the mode" and "Matched across all displays" — so
// neither sentence has to be edited into a half-truth.
//
// `displaySync` and `displayBrightness` keep their jobs: the automation, and the
// number the desk shares (Personalize's master slider reads and writes it).
// What changed is who OWNS that number while the automation is on — the current
// mode does. A write from either side therefore lands on the mode you are in,
// the same reading `usePicture` already applies to Contrast: turning it up while
// Game is selected IS Game's contrast.
//
// With sync OFF the level is this monitor's alone and still filed under the
// mode, which is the old behaviour minus the amnesia.
export interface DisplayPictureState {
  /**
   * 0–100. Shipped default 80 — the same number `displayBrightness` ships at, so
   * a fresh install reads one level whether or not Match is on.
   */
  brightness: number;
  contrast: number;
  sharpness: number;
  blackStretch: string;
  /** '' = nobody has picked yet; the tab falls back to the SKU's first preset,
   *  the same convention monitor mode uses for '' (monitorMode.tsx). */
  colorPreset: string;
  byMode: Record<string, Partial<Omit<DisplayPictureState, 'byMode'>>>;
}
/** Picture per monitor, keyed by SKU id. */
type PictureStore = Record<string, DisplayPictureState>;
/** Whose picture the pre-2026-09-18 single `displayPicture` blob was. */
const LEGACY_PICTURE_SKU = 'treehouse-32';
export const DEFAULT_DISPLAY_PICTURE: DisplayPictureState = {
  brightness: 80,
  contrast: 55,
  sharpness: 30,
  blackStretch: 'Off',
  colorPreset: '',
  byMode: {},
};
export interface ViewingModeState {
  /**
   * The layout on screen right now — Full Screen / PBP / PIP. Its own field for
   * the same reason `UnderGlowState.color` is: the surfaces that draw the screen
   * need no idea modes exist.
   */
  current: string;
  /**
   * Layout per mode, restored on a MANUAL mode switch only. Empty means that
   * mode has never been told to remember one, and a switch into it leaves the
   * screen alone — the safest reading of "nothing stored", because the
   * alternative is rearranging a desk on the strength of a default.
   */
  byMode: Record<string, string>;
  /**
   * The three answers a DIVIDED screen needs, and the layout alone does not give
   * (2026-08-21): which computer feeds the main pane, how big the inset window
   * is, and which computer the speakers play. `Full Screen` needs none of them,
   * which is why they are optional rather than defaulted here — the card
   * resolves them against the SKU's own `hosts`, so no name is duplicated into
   * this file.
   *
   * NOT in `byMode`, and that is a decision rather than a shortcut. This
   * project's own table sorts settings by what they are ATTACHED to
   * (`profile-proposal-2026-07.md`; Brightness stays outside a mode because it
   * belongs to how bright the ROOM is): which computer sits on the left, and
   * which one the speakers are wired to, are facts about the desk, not about
   * what you are doing at it. The layout is the one thing that changes with the
   * task, and it is already mode-scoped one field up. If a mode ever needs its
   * own source order, the housekeeping is the EQ's (`audioEq`, 2026-08-20):
   * rename, delete, duplicate and Reset all have to carry the value.
   */
  /** Which computer feeds the left pane (PBP) — the other one takes the right. */
  left?: string;
  /** How large the inset window is in PIP: `Small` · `Medium` · `Large`. */
  pipSize?: string;
  /** Which computer the monitor's own speakers play while the screen is split. */
  audioFrom?: string;
}
// Full Screen, and this default is not a guess: it is the state a monitor is in
// before anyone asks for a split, so it is the one value that cannot surprise.
export const DEFAULT_VIEWING_MODE: ViewingModeState = { current: 'Full Screen', byMode: {} };

/**
 * The Audio tab's `EQ preset`, in the same two-field shape as `ViewingModeState`
 * and for the same reason: `current` is what the speakers are doing, `byMode`
 * what each mode restores.
 *
 * Mode-scoped because our own decision says so — `profile-proposal-2026-07.md`
 * "What a mode remembers" lists "Audio EQ / output mode (Game·Music·Video)" on
 * the mode-scoped side, and the window has been PROMISING it since: the note
 * under the mode bar reads "Screen, audio and under-glow follow the mode" on any
 * SKU with speakers (`modeScopeNote`). Audio was the one third of that sentence
 * with nothing behind it.
 *
 * Volume and mute stay out, from the same table: "moment-to-moment, like a TV
 * remote — a mode switch must never jolt loudness". Brightness sits outside for
 * the matching reason (2026-08-11).
 *
 * Restored QUIETLY on a mode switch, unlike the layout, which asks. That split
 * is already recorded above `viewingMode`: the layout question is the one Zone 2
 * control here because a split rearranges the windows you are working in; an EQ
 * curve changes how the next sound is coloured and costs nothing to undo.
 */
export interface AudioEqState {
  current: string;
  byMode: Record<string, string>;
}
/** Empty `current` = whatever the SKU lists first; the tab resolves it. */
export const DEFAULT_AUDIO_EQ: AudioEqState = { current: '', byMode: {} };


// Warm, because the default mode is Game (2026-07-21 colour research). This
// replaces the "first colour = #00c8d7" note from the 2026-07-16 review: cyan
// for Game was the reading that research specifically rejected.
export const DEFAULT_UNDER_GLOW: UnderGlowState = {
  enabled: true,
  // Neutral white, not Game's orange (changed 2026-08-07 with the unselected
  // mode). The orange was only ever defensible while the tab auto-selected Game
  // on first open — the lamp agreed with the pills because both were guessing
  // the same guess. With nothing selected until the user picks, a warm glow
  // would be the product asserting an activity nobody chose, on real hardware.
  // Value = the `White — no colour cast` swatch, so it is a colour the picker
  // can actually show as selected rather than an off-palette default.
  color: '#efefef',
  brightness: 70,
  byMode: {},
};

// ── Schema ───────────────────────────────────────────────────────────────────
// Single source of truth for persisted settings — the React port of
// settings-manager.js. `key` is the localStorage key; `default` the fallback.
// New settings drop in by adding a row here (and an accessor below if desired).
type SettingType = 'string' | 'bool' | 'json' | 'number';

/** How bright the room is, as the monitor's own sensor would report it. */
export type RoomLight = 'off' | 'bright' | 'dim' | 'dark';

/**
 * The level Auto-Brightness settles on for each room (2026-09-23, Cindy: the
 * monitor should read the ROOM, not the clock — a dark room at noon wants the
 * same screen a dark room at night does, and the sensor is already on this
 * hardware, so no location permission and no second schedule beside Chris's).
 * Numbers are a demo's shape, not a calibration: they only have to read as
 * "brighter room, brighter screen" on the slider the Display tab already shows.
 */
export const LEVEL_FOR_ROOM: Record<Exclude<RoomLight, 'off'>, number> = {
  bright: 90,
  dim: 55,
  dark: 30,
};

/** Title-case label, for the one place that says it out loud. */
export const ROOM_LABEL: Record<Exclude<RoomLight, 'off'>, string> = {
  bright: 'Bright',
  dim: 'Dim',
  dark: 'Dark',
};
interface Spec {
  key: string;
  type: SettingType;
  default: unknown;
}
const SCHEMA = {
  theme: { key: 'theme', type: 'string', default: 'dark' },
  accent: { key: 'accent', type: 'string', default: 'cyan' },
  // Spacing density — re-points --gutter (24px → the 12px tablet step) for the
  // whole app. See the density block in shared/tokens.css.
  density: { key: 'density', type: 'string', default: 'comfortable' },
  tempUnit: { key: 'tempUnit', type: 'string', default: 'C' },
  // `activeProfileId` used to live here, when a profile was just a label.
  // Profiles are records now and own their own active state — see
  // state/Profiles.tsx, which reads the old key once to migrate an install.
  powerMode: { key: 'powerMode', type: 'string', default: 'balanced' },
  displayArrange: { key: 'displayArrange', type: 'json', default: null },
  kvm: { key: 'kvm', type: 'json', default: null },
  underGlow: { key: 'underGlow', type: 'json', default: null },
  // The monitor's mode (Game/Create/Work), persisted for one reason: it drives
  // the lamp, and the lamp is persisted. While mode was component state it died
  // with the modal and came back as the first pill, so reopening a monitor left
  // in Create showed "Game" over a white lamp at 10%. The fix in place for that
  // re-applied the mode's colour on mount — which meant OPENING A WINDOW WROTE
  // THE USER'S ACTUAL LIGHT, on a strip that is real hardware. Storing the mode
  // where the lamp already lives removes the mismatch instead of papering over
  // it (critique 2026-08-06).
  // Scope: one value, not one per SKU — the same shape `underGlow` uses, and the
  // two have to agree. Per-display modes means changing both together.
  monitorMode: { key: 'monitorMode', type: 'string', default: '' },
  // The user's own modes, added with "+ Add new preset" and living beside the
  // SKU's built-in three. Phase 1 as of 2026-08-07 (Cindy) — promoted out of the
  // backlog on a design-owner call plus the preset habit gaming users already
  // have, not on the user test the backlog originally made the condition.
  // Names only: what a preset holds is stored the same way a built-in mode's is
  // (keyed by name in `underGlow.byMode` and, once the Display tab is wired,
  // there too), so a preset is not a second kind of object.
  customModes: { key: 'customModes', type: 'json', default: null },
  // Viewing Mode (Full Screen / PBP / PIP) — `current` is what the screen is
  // doing, `byMode` what each mode restores on a manual switch. The same shape
  // `underGlow` uses, for the reason given above it: a preset must not be a
  // second kind of object, so its layout is filed under its name too.
  //
  // Two fields rather than one because the layout on screen and the layout a
  // mode remembers are deliberately allowed to differ: picking PBP shows PBP at
  // once (a direct action is never questioned), and storing it against the mode
  // is a separate confirmed step — `profile-proposal-2026-07.md:63` puts this
  // one control in the Zone 2 class ("Save PBP to Work?") while picture, EQ and
  // under-glow save quietly. Merge them and the confirmation has nothing to ask
  // about, because the write would already have happened.
  viewingMode: { key: 'viewingMode', type: 'json', default: null },
  // Display tab picture controls — mode-scoped, saved quietly (Zone 1), the
  // same byMode shape underGlow and viewingMode already use. Before this they
  // lived in each control's own uncontrolled state, so they reset when the
  // window closed and never followed a mode switch.
  displayPicture: { key: 'displayPicture', type: 'json', default: null },
  // The same picture, one per monitor (2026-09-18). `displayPicture` above was
  // one blob for the whole desk, so turning the OMEN OLED 27 down to 33 turned
  // the Treehouse 32 down with it — against the 08-29 rule that with Match off
  // "the level is this monitor's alone". Keyed by SKU id; the old blob is read
  // once as the Treehouse 32's starting point (`LEGACY_PICTURE_SKU`), because
  // the Treehouse 32 is the only monitor whose modes ever wrote into it.
  displayPictureBySku: { key: 'displayPictureBySku', type: 'json', default: null },
  // Auto-Brightness — 'Off' | 'Ambient' | 'Content'. Shared rather than local
  // because TWO surfaces report the same fact: the Display tab's segmented
  // control and the home card's `Auto` switch beside the brightness slider.
  // Held in each one's own `useState`, they could not agree and neither
  // survived a close — the tab reset to `Ambient` every time it was reopened,
  // so a display someone had put on manual claimed to be automatic again.
  //
  // Default `Ambient` = exactly what both surfaces shipped with, so nothing
  // anyone sees moves with this key. Whether that default is RIGHT is a
  // separate question and deliberately not answered here: every other
  // automation in this file starts off (`displaySync`, `smartActions`,
  // `smartActionsWatch` — the 2026-07-21 call that an automation which moves
  // someone's setup asks first), and this one does not. Flagged for Cindy
  // 2026-08-31 rather than flipped, because flipping it is a product decision
  // and this change is a wiring change.
  autoBrightness: { key: 'autoBrightness', type: 'string', default: 'Ambient' },
  // The same setting, one per monitor (2026-09-18) — a light sensor belongs to
  // the display it sits in, so turning it off on the OMEN OLED 27 must not turn
  // it off on the Treehouse 32. Keyed by SKU id; a monitor with no entry reads
  // `autoBrightness` above, which is what every monitor showed before the split.
  autoBrightnessBySku: { key: 'autoBrightnessBySku', type: 'json', default: null },
  audioEq: { key: 'audioEq', type: 'json', default: null },
  // Personalize → Display. `displaySync` is the automation ("keep every display
  // at the same level"), `displayBrightness` the level it holds them at.
  //
  // Two settings, not one, because they answer different questions: the level
  // exists whether or not the automation is on (it is what the master slider
  // shows), and the automation can be turned off without forgetting the number
  // the user picked. Default OFF follows the 2026-07-21 call — an automation
  // that moves someone's setup asks first, and this one moves every screen on
  // the desk at once.
  displaySync: { key: 'displaySync', type: 'bool', default: false },
  displayBrightness: { key: 'displayBrightness', type: 'number', default: 80 },
  // Eco Mode — the Power card's switch on Settings, shared rather than local
  // because a second tab now reads it (2026-08-20, Cindy).
  //
  // Display's `Estimated draw` row is hidden until this is on. The reasoning is
  // hers and it is the IA's own rule applied to a number: someone who has not
  // asked to spend less is not owed a watt figure, and putting it on screen for
  // everyone was grouping by KIND of data (a read-only fact) rather than by WHEN
  // anyone wants it. Default OFF — the row starts absent.
  ecoMode: { key: 'ecoMode', type: 'bool', default: false },
  // Locks the monitor's own on-screen menu, the one its rear buttons open. It
  // is persisted rather than local for the reason every other setting here is:
  // a switch that forgets itself the moment the modal closes reads as broken,
  // and this one had been a local `useState` since it arrived. Default OFF —
  // the physical buttons are the fallback path when the app is unavailable
  // (`glossary.md`), so the app never takes them away unless asked.
  osdLock: { key: 'osdLock', type: 'bool', default: false },
  // "Switch mode automatically when launching games or apps" — an automation
  // that can put the user in Create, the one mode that takes the colour control
  // away. It shipped as a promo card with only a dismiss X: no on/off, no state,
  // and dismissing it forgot itself by the next open. Default OFF follows the
  // 2026-07-21 call on auto-switch — an automation that moves the user's setup
  // asks first. Not wired to a launcher (nothing here detects an app launch), so
  // it declares intent the way `Auto-switch on input change` does in
  // Connectivity; what changed is that the intent is now the user's and it is
  // remembered.
  smartActions: { key: 'smartActions', type: 'bool', default: false },
  // The Personalize umbrella's own switch — whether the desk-wide layer WATCHES
  // and asks at all. Deliberately NOT `smartActions` above: that value is the
  // monitor window's `Auto-switch by activity` and `monitorMode` consumes it as
  // `autoSwitch`, so sharing the key would make the Personalize card silently
  // drive mode switching. The two layers were separated on 2026-08-07 (umbrella
  // vs one automation under it) and this is that separation in the store.
  // Default off for the same reason every automation here is: the card explains
  // what it watches before it is allowed to watch (2026-07-16 usability review —
  // "어떤 AI가 뭘 가져가는지 설명 없이는 못 켜겠다").
  smartActionsWatch: { key: 'smartActionsWatch', type: 'bool', default: false },
  // A stand-in for the ambient light sensor. The prototype cannot read the real
  // one, and it must NOT read the clock instead: Cindy reviews from the east
  // coast and the team from the west, so a real clock opens the same link in a
  // different state for each of them (2026-09-22). Admin's Testing tools set the
  // room here, so whoever opens the link sees what the person demoing sees.
  // `off` = the prototype makes no claim about the room, which is the default.
  roomLight: { key: 'roomLight', type: 'string', default: 'off' },
  // OLED burn-in protections, by detection name. Shared rather than local
  // because the switches are folded away inside the Display tab's OLED Care card
  // (2026-08-08) and the summary row is the only thing reporting them. Held in a
  // `useState` there, that summary would reset to "All on" every time the tab
  // was left — the card would forget a protection someone deliberately turned
  // off, and say so in the one line that is supposed to answer for them.
  //
  // Stored as the exceptions, not the full set: `null` (the default) means every
  // protection is on, and only a name someone actually turned OFF is written.
  // Protections ship on and are meant to stay on, so the common case costs
  // nothing in storage and a detection added later is on by default instead of
  // silently missing from an old saved map.
  oledProtections: { key: 'oledProtections', type: 'json', default: null },
  // User-made equalizer presets, from the Simple Equalizer modal. Factory
  // presets stay SKU data; these are the ones the user drew.
  eqPresets: { key: 'eqPresets', type: 'json', default: null },
  // The keyboard lighting preset library (factory + user-made, as curated).
  lightPresets: { key: 'lightPresets', type: 'json', default: null },
  // First-boot onboarding: the assembled persona ('' until onboarded) and a flag
  // marking the flow complete. Persona curates defaults; never shown to the user.
  persona: { key: 'persona', type: 'string', default: '' },
  onboarded: { key: 'onboarded', type: 'bool', default: false },
  // A display's own first hour — the state right after it is plugged in. This is
  // NOT app onboarding: Treehouse is already installed and already asked how much
  // guidance this person wants, so arriving hardware must not ask again. The one
  // thing it does ask is where the display sits, because that cannot be inferred
  // and everything else in the display area depends on it. Off by default; the
  // Admin modal turns it on the same way it launches first-boot onboarding.
  monitorFirstHour: { key: 'monitorFirstHour', type: 'bool', default: false },
  // What is on the desk, as HARDWARE (2026-09-08, Cindy): the optional devices
  // present — `pulse-27` (OMEN OLED 27), `macbook` (a laptop = computer AND its
  // screen), `tower` (OMEN 35L). The Treehouse 32 is never listed; it is the
  // subject of this section. null = all three, today's demo desk.
  //
  // This replaces `displayCount` (1–3) and `pcCount` (1–2), which lived here
  // from 2026-08-20/24 to today. A count could not say WHICH two screens, and
  // `arrangement.ts` had decided that on its own (the laptop lid survived, the
  // OMEN went first). Cindy's example at the 2026-09-08 review: two monitors and
  // one monitor + one laptop lid are both "Displays 2" and are different desks.
  // The two numbers still exist for readers — derived from this list in the
  // provider below — so the Gear Switch lock, Viewing Mode's second source and
  // the All displays card did not have to change.
  deskDevices: { key: 'deskDevices', type: 'json', default: null },
  // Wallpaper preset id + the blur (px, 0–60) / opacity (%, 0–100) of the
  // background layer. Ported from vanilla js/theme.js.
  wallpaper: { key: 'wallpaper', type: 'string', default: 'blue' },
  wpBlur: { key: 'wpBlur', type: 'number', default: 44 },
  wpOpacity: { key: 'wpOpacity', type: 'number', default: 100 },
  // Top-nav visibility (ported from vanilla js/settings.js). Labels are hidden
  // by default, so the nav lands icon-only; icons stay. Turning a flag on hides
  // that element, so both on would leave nothing — the Settings UI is the guard.
  hideNavLabels: { key: 'hideNavLabels', type: 'bool', default: true },
  hideNavIcons: { key: 'hideNavIcons', type: 'bool', default: false },
} satisfies Record<string, Spec>;
export type SettingName = keyof typeof SCHEMA;

// ── typed localStorage encode/decode ─────────────────────────────────────────
function decode(raw: string | null, spec: Spec): unknown {
  if (raw === null) return spec.default;
  switch (spec.type) {
    case 'bool':
      return raw === '1' || raw === 'true';
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return spec.default;
      }
    case 'number': {
      const n = Number(raw);
      return Number.isNaN(n) ? spec.default : n;
    }
    default:
      return raw;
  }
}
function encode(value: unknown, spec: Spec): string {
  switch (spec.type) {
    case 'bool':
      return value ? '1' : '0';
    case 'json':
      return JSON.stringify(value);
    default:
      return value == null ? '' : String(value);
  }
}
function readAll(): Record<SettingName, unknown> {
  const out = {} as Record<SettingName, unknown>;
  (Object.keys(SCHEMA) as SettingName[]).forEach((name) => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SCHEMA[name].key);
    } catch {
      /* storage unavailable */
    }
    out[name] = decode(raw, SCHEMA[name]);
  });
  return out;
}

function resolveLight(theme: Theme): boolean {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: light)').matches;
  return theme === 'light';
}

interface SettingsValue {
  /**
   * Generic typed getter/setter — the schema-driven core. `get` returns the
   * value the app is actually running: the active profile's override if it has
   * one, otherwise the stored baseline. `set` always writes the baseline.
   */
  get: <T = unknown>(name: SettingName) => T;
  set: (name: SettingName, value: unknown) => void;
  /** The stored value, ignoring any profile override — what the Settings UI edits. */
  getBaseline: <T = unknown>(name: SettingName) => T;
  /** Is this setting currently taken over by the active profile? */
  isOverridden: (name: SettingName) => boolean;
  // convenience accessors
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: string;
  setAccent: (a: string) => void;
  density: Density;
  setDensity: (d: Density) => void;
  tempUnit: TempUnit;
  setTempUnit: (u: TempUnit) => void;
  powerMode: string;
  setPowerMode: (m: string) => void;
  displayArrange: DisplayArrange | null;
  /** null clears the stored layout — that's what "Reset to default" does. */
  setDisplayArrange: (d: DisplayArrange | null) => void;
  kvm: KvmState;
  setKvm: (k: KvmState) => void;
  underGlow: UnderGlowState;
  setUnderGlow: (u: UnderGlowState) => void;
  /** '' until a mode has been chosen — and it STAYS '' until then (2026-08-07).
   * This used to resolve to the first pill, which made a fresh install claim
   * "you are in Game" and light the desk orange on a choice nobody made. */
  monitorMode: string;
  setMonitorMode: (m: string) => void;
  customModes: string[];
  setCustomModes: (m: string[]) => void;
  viewingMode: ViewingModeState;
  setViewingMode: (v: ViewingModeState) => void;
  /** This monitor's picture — each display keeps its own (see `displayPictureBySku`). */
  pictureFor: (skuId: string) => DisplayPictureState;
  setPictureFor: (skuId: string, v: DisplayPictureState) => void;
  audioEq: AudioEqState;
  setAudioEq: (v: AudioEqState) => void;
  displaySync: boolean;
  setDisplaySync: (on: boolean) => void;
  displayBrightness: number;
  setDisplayBrightness: (v: number) => void;
  ecoMode: boolean;
  setEcoMode: (on: boolean) => void;
  osdLock: boolean;
  /** This monitor's Auto-Brightness source — 'Off' | 'Ambient' | 'Content'. */
  autoBrightnessFor: (skuId: string) => string;
  setAutoBrightnessFor: (skuId: string, v: string) => void;
  setOsdLock: (on: boolean) => void;
  smartActions: boolean;
  setSmartActions: (on: boolean) => void;
  /** The Personalize Smart actions umbrella — watching on/off. Not `smartActions`. */
  smartActionsWatch: boolean;
  setSmartActionsWatch: (on: boolean) => void;
  roomLight: RoomLight;
  setRoomLight: (v: RoomLight) => void;
  /** Names of the OLED protections that are OFF. Absent = on (see SCHEMA). */
  oledProtectionsOff: string[];
  setOledProtectionOff: (name: string, off: boolean) => void;
  eqPresets: CustomEqPreset[];
  setEqPresets: (p: CustomEqPreset[]) => void;
  lightPresets: LightPreset[];
  setLightPresets: (p: LightPreset[]) => void;
  persona: string;
  setPersona: (p: string) => void;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  monitorFirstHour: boolean;
  setMonitorFirstHour: (v: boolean) => void;
  /** Optional hardware on the desk — see SCHEMA.deskDevices. */
  deskDevices: DeskDevice[];
  setDeskDevices: (d: DeskDevice[]) => void;
  /** Derived from `deskDevices` (read-only): computers / screens on the desk. */
  pcCount: number;
  displayCount: number;
  wallpaper: string;
  setWallpaper: (id: string) => void;
  wpBlur: number;
  setWpBlur: (px: number) => void;
  wpOpacity: number;
  setWpOpacity: (pct: number) => void;
  hideNavLabels: boolean;
  setHideNavLabels: (on: boolean) => void;
  hideNavIcons: boolean;
  setHideNavIcons: (on: boolean) => void;
  /** Resolved light/dark (follows the system pref when theme is `system`). */
  isLight: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Schema-driven settings store (React port of settings-manager.js): one typed
 * source of truth persisted to localStorage. Theme drives `html.light`; accent
 * overrides `--accent-color`. Add a SCHEMA row to introduce a new setting.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<SettingName, unknown>>(readAll);

  const set = (name: SettingName, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    try {
      localStorage.setItem(SCHEMA[name].key, encode(value, SCHEMA[name]));
    } catch {
      /* storage full / unavailable */
    }
  };
  // ── Profile resolution ──────────────────────────────────────────────────
  // The active profile's overrides sit on top of the stored baseline: a key the
  // profile doesn't set falls through. Resolution happens here, at the bottom of
  // the provider stack, so every existing `useSettings()` consumer reads the
  // resolved value without knowing profiles exist.
  //
  // Writes always land on the BASELINE. A profile's own values are edited
  // through `useProfiles().setOverride` — which is why the Settings UI needs
  // `isOverridden` to explain why changing a baseline it's overriding does
  // nothing visible.
  //
  // Outside a ProfilesProvider (stories, isolated renders) there are no
  // overrides and every read is the plain baseline.
  const profiles = useProfilesOptional();
  const overrides = (profiles?.activeProfile.overrides ?? {}) as Partial<Record<SettingName, unknown>>;
  const resolve = (name: SettingName) => (name in overrides ? overrides[name] : values[name]);
  const isOverridden = (name: SettingName) => name in overrides;

  const get = <T,>(name: SettingName) => resolve(name) as T;

  const theme = values.theme as Theme;
  const accent = resolve('accent') as string;
  const density = values.density as Density;

  // Resolved light/dark — re-resolves on theme change and (for `system`) when
  // the OS preference flips, so theme-aware UI like the wallpaper layer updates.
  const [isLight, setIsLight] = useState(() => resolveLight(theme));
  useEffect(() => {
    const apply = () => {
      const light = resolveLight(theme);
      setIsLight(light);
      document.documentElement.classList.toggle('light', light);
    };
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    // `cyan` is the design-system default — clear the override so the token wins.
    if (accent === 'cyan') document.documentElement.style.removeProperty('--accent-color');
    else document.documentElement.style.setProperty('--accent-color', `var(--accent-${accent})`);
  }, [accent]);

  useEffect(() => {
    // Comfortable is the token default, so it carries no attribute at all —
    // the absence IS the default, same as accent above.
    if (density === 'compact') document.documentElement.dataset.density = 'compact';
    else delete document.documentElement.dataset.density;
  }, [density]);

  // `byMode` is spread over the default so a payload saved before it existed
  // (2026-08-05) loads as "every mode still on its default" instead of crashing
  // the swatch writes on an undefined map.
  const underGlow = { ...DEFAULT_UNDER_GLOW, ...((values.underGlow as UnderGlowState | null) ?? {}) };
  // Same spread, same reason: a browser that stored a mode before this key
  // existed loads as "no layout remembered anywhere" rather than undefined.
  const viewingMode = {
    ...DEFAULT_VIEWING_MODE,
    ...((values.viewingMode as ViewingModeState | null) ?? {}),
  };
  const pictureStore = (values.displayPictureBySku as PictureStore | null) ?? {};
  const pictureFor = (skuId: string): DisplayPictureState => ({
    ...DEFAULT_DISPLAY_PICTURE,
    ...(pictureStore[skuId] ??
      (skuId === LEGACY_PICTURE_SKU ? ((values.displayPicture as DisplayPictureState | null) ?? {}) : {})),
  });
  // Merged inside the updater, not from `pictureStore`: two monitors can write in
  // the same tick (Match on moves every display at once), and a merge from the
  // render-time copy would let the second write erase the first.
  const setPictureFor = (skuId: string, v: DisplayPictureState) => {
    setValues((prev) => {
      const store = { ...((prev.displayPictureBySku as PictureStore | null) ?? {}), [skuId]: v };
      try {
        localStorage.setItem(SCHEMA.displayPictureBySku.key, encode(store, SCHEMA.displayPictureBySku));
      } catch {
        /* storage full / unavailable */
      }
      return { ...prev, displayPictureBySku: store };
    });
  };
  const audioEq = {
    ...DEFAULT_AUDIO_EQ,
    ...((values.audioEq as AudioEqState | null) ?? {}),
  };
  // The lamp published as two root variables, the same way accent is published
  // above, so every surface that draws the glow (modal hero desk map, Perform
  // card) reads ONE value instead of each keeping its own copy. `--ug-fade` is
  // the transparent share for `color-mix`: 84% at full brightness — the alpha
  // the Perform card's pool was already tuned to (device-card.css) — rising to
  // fully transparent when the strip is off, so "off" needs no second rule.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--ug-color', underGlow.color);
    const fade = underGlow.enabled ? 100 - 16 * (underGlow.brightness / 100) : 100;
    root.setProperty('--ug-fade', `${fade.toFixed(1)}%`);
  }, [underGlow.color, underGlow.brightness, underGlow.enabled]);

  // Stored as the exceptions (see SCHEMA), so an empty list is the healthy state
  // rather than a state nobody has written yet.
  const oledProtectionsOff = (values.oledProtections as string[] | null) ?? [];

  const value: SettingsValue = {
    get,
    set,
    getBaseline: <T,>(name: SettingName) => values[name] as T,
    isOverridden,
    theme,
    setTheme: (t) => set('theme', t),
    accent,
    setAccent: (a) => set('accent', a),
    density,
    setDensity: (d) => set('density', d),
    tempUnit: values.tempUnit as TempUnit,
    setTempUnit: (u) => set('tempUnit', u),
    powerMode: values.powerMode as string,
    setPowerMode: (m) => set('powerMode', m),
    displayArrange: values.displayArrange as DisplayArrange | null,
    setDisplayArrange: (d) => set('displayArrange', d),
    kvm: (values.kvm as KvmState | null) ?? DEFAULT_KVM,
    setKvm: (k) => set('kvm', k),
    underGlow,
    setUnderGlow: (u) => set('underGlow', u),
    monitorMode: values.monitorMode as string,
    setMonitorMode: (m) => set('monitorMode', m),
    customModes: (values.customModes as string[] | null) ?? [],
    setCustomModes: (m) => set('customModes', m),
    viewingMode,
    setViewingMode: (v) => set('viewingMode', v),
    pictureFor,
    setPictureFor,
    audioEq,
    setAudioEq: (v) => set('audioEq', v),
    displaySync: values.displaySync as boolean,
    setDisplaySync: (on) => set('displaySync', on),
    displayBrightness: values.displayBrightness as number,
    setDisplayBrightness: (v) => set('displayBrightness', v),
    ecoMode: values.ecoMode as boolean,
    setEcoMode: (on) => set('ecoMode', on),
    osdLock: values.osdLock as boolean,
    setOsdLock: (on) => set('osdLock', on),
    autoBrightnessFor: (skuId) =>
      ((values.autoBrightnessBySku as Record<string, string> | null) ?? {})[skuId] ??
      (values.autoBrightness as string),
    // Merged inside the updater for the same reason as `setPictureFor`.
    setAutoBrightnessFor: (skuId, v) =>
      setValues((prev) => {
        const store = { ...((prev.autoBrightnessBySku as Record<string, string> | null) ?? {}), [skuId]: v };
        try {
          localStorage.setItem(SCHEMA.autoBrightnessBySku.key, encode(store, SCHEMA.autoBrightnessBySku));
        } catch {
          /* storage full / unavailable */
        }
        return { ...prev, autoBrightnessBySku: store };
      }),
    oledProtectionsOff,
    setOledProtectionOff: (name, off) =>
      set(
        'oledProtections',
        off
          ? [...oledProtectionsOff.filter((n) => n !== name), name]
          : oledProtectionsOff.filter((n) => n !== name),
      ),
    smartActions: values.smartActions as boolean,
    setSmartActions: (on) => set('smartActions', on),
    roomLight: values.roomLight as RoomLight,
    setRoomLight: (v) => set('roomLight', v),
    smartActionsWatch: values.smartActionsWatch as boolean,
    setSmartActionsWatch: (on) => set('smartActionsWatch', on),
    eqPresets: normalizeEqPresets(values.eqPresets),
    setEqPresets: (p) => set('eqPresets', p),
    lightPresets: normalizeLightPresets(values.lightPresets),
    setLightPresets: (p) => set('lightPresets', p),
    persona: values.persona as string,
    setPersona: (p) => set('persona', p),
    onboarded: values.onboarded as boolean,
    setOnboarded: (v) => set('onboarded', v),
    monitorFirstHour: values.monitorFirstHour as boolean,
    setMonitorFirstHour: (v) => set('monitorFirstHour', v),
    deskDevices: deskDevicesOf(values.deskDevices),
    setDeskDevices: (d) => {
      set('deskDevices', d);
      // The two count keys this list replaced (2026-09-08). Cleared so a stale
      // number cannot outlive the axis it belonged to — nothing reads them any
      // more, but a tester grepping localStorage should not find two answers.
      try { localStorage.removeItem('displayCount'); localStorage.removeItem('pcCount'); } catch { /* unavailable */ }
    },
    pcCount: deskPcsOf(values.deskDevices).length,
    displayCount: 1 + Number(deskDevicesOf(values.deskDevices).includes('pulse-27')) + Number(deskDevicesOf(values.deskDevices).includes('macbook')),
    wallpaper: resolve('wallpaper') as string,
    setWallpaper: (id) => set('wallpaper', id),
    wpBlur: resolve('wpBlur') as number,
    setWpBlur: (px) => set('wpBlur', px),
    wpOpacity: resolve('wpOpacity') as number,
    setWpOpacity: (pct) => set('wpOpacity', pct),
    hideNavLabels: values.hideNavLabels as boolean,
    setHideNavLabels: (on) => set('hideNavLabels', on),
    hideNavIcons: values.hideNavIcons as boolean,
    setHideNavIcons: (on) => set('hideNavIcons', on),
    isLight,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}

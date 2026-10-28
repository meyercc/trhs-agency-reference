// ══════════════════════════════════════════════════════════════════════════
// State for the desktop's two parts that have something of their own to do:
// the cooler cap's screen and the OMEN power supply (OpenGSW lcd-diy; both are
// MVP — Robin's 9/8 scope table, Jira GSW-583 and GSW-22694).
//
// Each is one store that every reader shares — the part's window and the PC's
// entry in My Devices — kept across reloads, the way the cap comes back to the
// player's setting after sleep and restarts (lcd-diy.20). The power supply's
// readings are simulated, like every other live number in this prototype.
// ══════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react';
import { DEFAULT_FAN_CURVE, fanSpeedAt, type FanCurvePoint } from '../state/fanCurve';

/** One persisted value with `useState`-like access, shared by every reader. */
function persisted<T extends object>(key: string, initial: T) {
  let value: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    /* storage unavailable — defaults stand */
  }
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const get = () => value;
  const set = (patch: Partial<T>) => {
    value = { ...value, ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((listener) => listener());
  };
  const use = () => [useSyncExternalStore(subscribe, get, get), set] as const;
  return { use, get, set };
}

// ── The cooler cap's screen ────────────────────────────────────────────────
/** What the cap can show (lcd-diy.5). */
export type ScreenContent = 'picture' | 'slideshow' | 'gif' | 'video' | 'clock' | 'vitals';
export const SCREEN_CONTENT_LABEL: Record<ScreenContent, string> = {
  picture: 'Picture',
  slideshow: 'Slideshow',
  gif: 'GIF',
  video: 'Video',
  clock: 'Clock',
  vitals: 'System Vitals',
};

/** What a slot on the cap's readings can hold — System Vitals' numbers
 *  (lcd-diy.29), the same five OGH's themes offer. */
export type ScreenReading = 'cpu' | 'gpu' | 'ram' | 'storage' | 'fan';
export const SCREEN_READING_LABEL: Record<ScreenReading, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  storage: 'Storage',
  fan: 'Fan speed',
};
/** One place on a theme's face and what it shows. A fan reading names its fan
 *  by id from the fan list, so a rename shows on the cap (lcd-diy.13). */
export interface ReadingSlot {
  reading: ScreenReading;
  fanId?: string;
}

/** The designed themes the readings wear (lcd-diy.8). Each has its own places
 *  for readings; OGH's have one to four. Three of OGH's seven are built. */
export type VitalsTheme = 'classic' | 'ring' | 'list';
export const VITALS_THEMES: { id: VitalsTheme; label: string; slots: string[] }[] = [
  { id: 'classic', label: 'Classic', slots: ['Top', 'Bottom'] },
  { id: 'ring', label: 'Ring', slots: ['Centre'] },
  { id: 'list', label: 'List', slots: ['Row 1', 'Row 2', 'Row 3', 'Row 4'] },
];
/** Two-colour tones a theme comes in. Cap art colours, not app tokens: the
 *  cap is a screen of its own. Red leads on a HyperX desktop (lcd-diy.36). */
export const VITALS_TONES: { id: string; label: string; a: string; b: string }[] = [
  { id: 'ice', label: 'Ice', a: '#16b4ff', b: '#ffc400' },
  { id: 'violet', label: 'Violet', a: '#2f7bff', b: '#b05cff' },
  { id: 'lime', label: 'Lime', a: '#c8f000', b: '#ffe81a' },
  { id: 'red', label: 'Red', a: '#ff5a5a', b: '#e0262e' },
];
export const tonesFor = (defaultArt: string) =>
  defaultArt === 'hyperx' ? [VITALS_TONES[3], ...VITALS_TONES.slice(0, 3)] : VITALS_TONES;

export type Rotation = 0 | 90 | 180 | 270;

/** How a picture sits on the round screen (lcd-diy.28): zoom from 100 %, and
 *  the point of the picture at the centre, in %. */
export interface Crop {
  zoom: number;
  x: number;
  y: number;
}

/** What the cap shows: one look. A preset is a named look (OGH's "Available
 *  Presets" and "My LCD Display"); the cap shows one at a time. */
export interface CapLook {
  content: ScreenContent;
  clock: 'digital' | 'analog';
  /** The picture, GIF or video it shows; null is the first in the library. */
  file: string | null;
  crop: Crop;
  theme: VitalsTheme;
  /** A tone id; null is the first tone for this desktop. */
  tone: string | null;
  /** Per theme, what each of its places shows. */
  slots: Record<VitalsTheme, ReadingSlot[]>;
}
export interface CapPreset extends CapLook {
  id: string;
  name: string;
}

const DEFAULT_SLOTS: Record<VitalsTheme, ReadingSlot[]> = {
  classic: [{ reading: 'cpu' }, { reading: 'gpu' }],
  ring: [{ reading: 'cpu' }],
  list: [{ reading: 'cpu' }, { reading: 'gpu' }, { reading: 'ram' }, { reading: 'storage' }],
};
const look = (patch: Partial<CapLook>): CapLook => ({
  content: 'vitals',
  clock: 'digital',
  file: null,
  crop: { zoom: 100, x: 50, y: 50 },
  theme: 'classic',
  tone: null,
  slots: DEFAULT_SLOTS,
  ...patch,
});
export const lookOf = (s: CapLook): CapLook => ({
  content: s.content,
  clock: s.clock,
  file: s.file,
  crop: s.crop,
  theme: s.theme,
  tone: s.tone,
  slots: s.slots,
});

/** The presets a cap comes with: three of OGH's reading themes, both clocks,
 *  and one of each kind of media (lcd-diy.5, lcd-diy.8). */
export const FACTORY_PRESETS: CapPreset[] = [
  { id: 'vitals-classic', name: 'Classic', ...look({ theme: 'classic' }) },
  { id: 'vitals-ring', name: 'Ring', ...look({ theme: 'ring' }) },
  { id: 'vitals-list', name: 'List', ...look({ theme: 'list' }) },
  { id: 'clock-digital', name: 'Digital clock', ...look({ content: 'clock', clock: 'digital' }) },
  { id: 'clock-analog', name: 'Analog clock', ...look({ content: 'clock', clock: 'analog' }) },
  { id: 'picture', name: 'Picture', ...look({ content: 'picture' }) },
  { id: 'slideshow', name: 'Slideshow', ...look({ content: 'slideshow' }) },
  { id: 'gif', name: 'GIF', ...look({ content: 'gif' }) },
  { id: 'video', name: 'Video', ...look({ content: 'video' }) },
];

export interface CoolerCapState extends CapLook {
  // The screen itself — reaches the cap at once.
  on: boolean;
  brightness: number;
  rotation: Rotation;
  // What it shows now (the CapLook fields), and the preset it came from.
  // Picking a preset shows it at once; customizing one is an edit that waits
  // for Apply (lcd-diy#open:2, the user's call 2026-10-19, as OGH's
  // configuration page does).
  activePreset: string | null;
  presets: CapPreset[];
  /** The Power On Effect (lcd-diy.7): one picture, GIF or video at boot. */
  bootKind: 'picture' | 'gif' | 'video';
  /** The file it plays; null is the cap's own default art (lcd-diy.35). */
  bootArt: string | null;
  bootLoop: boolean;
  /** A GIF's size on the screen, % (lcd-diy.28). */
  bootScale: number;
  // What the app puts over it (lcd-diy.6) — settings, at once.
  showEvents: boolean;
  showGame: boolean;
  whilePlaying: boolean;
}

/** The Power On Effect's fields, which its tab edits and applies. */
export const BOOT_KEYS = ['bootKind', 'bootArt', 'bootLoop', 'bootScale'] as const;
export type BootEdit = Partial<Pick<CoolerCapState, (typeof BOOT_KEYS)[number]>>;

const coolerCap = persisted<CoolerCapState>('coolerCap', {
  on: true,
  brightness: 80,
  rotation: 0,
  ...look({}),
  activePreset: 'vitals-classic',
  presets: FACTORY_PRESETS,
  bootKind: 'picture',
  bootArt: null,
  bootLoop: false,
  bootScale: 100,
  showEvents: true,
  showGame: true,
  whilePlaying: false,
});
export const useCoolerCap = coolerCap.use;

/** Show a preset on the cap now. */
export function showCapPreset(id: string) {
  const p = coolerCap.get().presets.find((x) => x.id === id);
  if (p) coolerCap.set({ ...lookOf(p), activePreset: id });
}
/** Save a preset (new ones go first) and show it — what Apply does. */
export function applyCapPreset(preset: CapPreset) {
  const { presets } = coolerCap.get();
  const next = presets.some((x) => x.id === preset.id) ? presets.map((x) => (x.id === preset.id ? preset : x)) : [preset, ...presets];
  coolerCap.set({ presets: next, ...lookOf(preset), activePreset: preset.id });
}
export function duplicateCapPreset(id: string) {
  const { presets } = coolerCap.get();
  const i = presets.findIndex((x) => x.id === id);
  if (i < 0) return;
  const clone = { ...presets[i], id: `cap-${Date.now()}`, name: `${presets[i].name} copy` };
  coolerCap.set({ presets: [...presets.slice(0, i + 1), clone, ...presets.slice(i + 1)] });
}
/** Delete a preset. The one on the cap stays until another is picked, so
 *  the cap never goes blank. */
export function deleteCapPreset(id: string) {
  const { presets, activePreset } = coolerCap.get();
  if (presets.length < 2) return;
  coolerCap.set({ presets: presets.filter((x) => x.id !== id), activePreset: activePreset === id ? null : activePreset });
}

/** The drives System Vitals sees. The cap shows four at most (lcd-diy.42). */
export const DRIVES = [
  { letter: 'C', pct: 62 },
  { letter: 'D', pct: 41 },
  { letter: 'E', pct: 80 },
  { letter: 'F', pct: 12 },
  { letter: 'G', pct: 55 },
  { letter: 'H', pct: 30 },
];
export const CAP_MAX_DRIVES = 4;

/** What the PC is doing, as the cap sees it. Simulated from the lab: the cap
 *  goes dark with the display (lcd-diy.21) and while asleep, plays the Power
 *  On Effect at boot, and always comes back to the player's setting
 *  (lcd-diy.20). Not kept: it is the machine's state, not a choice. */
export type CapPhase = 'awake' | 'display-off' | 'asleep' | 'booting';
let capPhase: CapPhase = 'awake';
const phaseListeners = new Set<() => void>();
const subscribePhase = (l: () => void) => {
  phaseListeners.add(l);
  return () => {
    phaseListeners.delete(l);
  };
};
const phaseSnapshot = () => capPhase;
export function setCapPhase(phase: CapPhase) {
  capPhase = phase;
  phaseListeners.forEach((l) => l());
}
export function useCapPhase(): CapPhase {
  return useSyncExternalStore(subscribePhase, phaseSnapshot, phaseSnapshot);
}

/** An app event drawn over the content for a moment (lcd-diy.6), if the
 *  player lets events show. Simulated from the window's Settings. */
let capEvent: string | null = null;
let eventTimer: number | undefined;
const eventSnapshot = () => capEvent;
export function showCapEvent(text: string, ms = 3000) {
  if (!coolerCap.get().showEvents) return;
  capEvent = text;
  phaseListeners.forEach((l) => l());
  window.clearTimeout(eventTimer);
  eventTimer = window.setTimeout(() => {
    capEvent = null;
    phaseListeners.forEach((l) => l());
  }, ms);
}
export function useCapEvent(): string | null {
  return useSyncExternalStore(subscribePhase, eventSnapshot, eventSnapshot);
}

// ── The OMEN power supply ──────────────────────────────────────────────────
// Built from OGH's PSU design (Figma OMEN-PSU, "VX Design to Dev") adapted to
// Treehouse's device window: a status monitor of eight readings, warning
// levels the player sets, and the supply's own fan.

/** The supply's own fan (lcd-diy.17): Max, Auto, or Manual by a speed or a
 *  curve. Max and Auto only show the speed. */
export type PsuFanMode = 'max' | 'auto' | 'manual';
/** The fan modes in the words the power supply's window gives them. The
 *  Performance page's Power supply card reads them from here too, so a mode is
 *  never named two ways (JY, 2026-10-22). */
export const PSU_FAN_MODE_LABEL: Record<PsuFanMode, string> = { max: 'Max', auto: 'Auto', manual: 'Manual' };

/** The four rails the supply reports, each with its current and voltage. */
export type PsuRail = '12v' | '5v' | '3v3' | '5vsb';
export const PSU_RAILS: { id: PsuRail; label: string; volts: number }[] = [
  { id: '12v', label: '12V', volts: 12 },
  { id: '5v', label: '5V', volts: 5 },
  { id: '3v3', label: '3.3V', volts: 3.3 },
  { id: '5vsb', label: '5V Standby', volts: 5 },
];

/** Where a reading warns: a current per rail, A, and the temperature, °C.
 *  The player sets them (OGH's overflow menu); these stand in for the
 *  supply's own defaults. */
export type PsuWarnLevels = Record<PsuRail, number> & { temp: number };
export const PSU_WARN_DEFAULT: PsuWarnLevels = { '12v': 85, '5v': 20, '3v3': 20, '5vsb': 3, temp: 55 };

export interface PsuSettings {
  /** Tell the player when a reading reaches its warning level (lcd-diy.16). */
  notify: boolean;
  warn: PsuWarnLevels;
  fanMode: PsuFanMode;
  /** The fan may stop when the temperature allows. On by default (GSW-19748). */
  zeroRpm: boolean;
  manualPct: number;
  /** Manual follows the curve instead of the speed. */
  dynamicCurve: boolean;
  curve: FanCurvePoint[];
  /** Clean at power-up or on waking. Off by default (fan-cleaner.32). */
  autoClean: boolean;
  /** When the supply's fan last cleaned, epoch ms. */
  lastCleaned: number | null;
}

const PSU_SETTINGS_DEFAULT: PsuSettings = {
  notify: true,
  warn: { ...PSU_WARN_DEFAULT },
  fanMode: 'auto',
  zeroRpm: true,
  manualPct: 50,
  dynamicCurve: false,
  curve: [...DEFAULT_FAN_CURVE],
  autoClean: false,
  lastCleaned: null,
};
const psuSettings = persisted<PsuSettings>('psuSettings', PSU_SETTINGS_DEFAULT);
// An earlier build kept the curve as a fourth mode.
if ((psuSettings.get().fanMode as string) === 'curve') psuSettings.set({ fanMode: 'manual', dynamicCurve: true });
export const usePsuSettings = psuSettings.use;

/** Put the fan back to its defaults. Cleaning is not a fan setting and stays. */
export function resetPsuFan() {
  const { fanMode, manualPct, curve, zeroRpm, dynamicCurve } = PSU_SETTINGS_DEFAULT;
  psuSettings.set({ fanMode, manualPct, curve: [...curve], zeroRpm, dynamicCurve });
}
/** Set one warning level, or put it back to its default. */
export function setPsuWarn(key: keyof PsuWarnLevels, value?: number) {
  psuSettings.set({ warn: { ...psuSettings.get().warn, [key]: value ?? PSU_WARN_DEFAULT[key] } });
  readings = derive(base);
  readingListeners.forEach((l) => l());
}

export interface PsuReadings {
  /** Total power the supply is delivering, W — the number PSU protection reads. */
  watts: number;
  /** Efficiency, %. */
  efficiency: number;
  tempC: number;
  rails: Record<PsuRail, { amps: number; volts: number }>;
}

export const PSU_MAX_RPM = 2400;

/** What the supply's fan is doing, from its setting and the supply's state.
 *  Lives here so the power supply's window and System Vitals' Power supply
 *  tab say the same speed (JY, 2026-10-22). */
export function fanRpm(s: PsuSettings, r: PsuReadings, capacityW: number): number {
  if (s.fanMode === 'max') return PSU_MAX_RPM;
  if (s.fanMode === 'manual') {
    const pct = s.dynamicCurve ? fanSpeedAt(s.curve, r.tempC) : s.manualPct;
    return Math.round((pct / 100) * PSU_MAX_RPM);
  }
  const load = r.watts / capacityW;
  if (s.zeroRpm && load < 0.3) return 0;
  return Math.round(600 + load * 1600);
}

/** Above this a manual clean is refused (fan-cleaner.41). */
export const PSU_CLEAN_MAX_C = 50;

// ── What the supply is, and how it is found (lcd-diy.38) ────────────────────
/** Two makers build the OMEN supply; both are read the same way. */
export const PSU_MAKERS = ['Great Wall', 'Seasonic'] as const;

/** Facts the machine decides, which the lab lets you flip. Not kept across
 *  reloads and not part of the player's settings. */
export interface PsuLab {
  /** The supply has a USB link, so it can be read and its fan set. A 1000 W
   *  unit has none (lcd-diy more:6). */
  usb: boolean;
  maker: (typeof PSU_MAKERS)[number];
  /** An AMD host keeps the supply's manual clean and has no automatic one
   *  (fan-cleaner.33, an AI ruling). */
  amd: boolean;
  /** Push a reading over its warning level, to see the warning. */
  force: 'none' | 'temp' | 'current';
}
let lab: PsuLab = { usb: true, maker: PSU_MAKERS[0], amd: false, force: 'none' };
const labListeners = new Set<() => void>();
export function setPsuLab(patch: Partial<PsuLab>) {
  lab = { ...lab, ...patch };
  readings = derive(base);
  labListeners.forEach((l) => l());
  readingListeners.forEach((l) => l());
}
export function usePsuLab() {
  return useSyncExternalStore(
    (l) => {
      labListeners.add(l);
      return () => {
        labListeners.delete(l);
      };
    },
    () => lab,
    () => lab,
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const jitter = (v: number, by: number) => v + (Math.random() - 0.5) * by;

type Base = { watts: number; tempC: number; small: Record<'5v' | '3v3' | '5vsb', number> };
// Present from the first read, never a 2 W or 4 W blip (lcd-diy.15).
let base: Base = { watts: 312, tempC: 41, small: { '5v': 4.2, '3v3': 3.1, '5vsb': 0.8 } };

function derive(b: Base): PsuReadings {
  const rails = {
    '12v': { amps: round1((b.watts * 0.92) / 12), volts: round1(jitter(12.05, 0.1)) },
    '5v': { amps: b.small['5v'], volts: round1(jitter(5.02, 0.04)) },
    '3v3': { amps: b.small['3v3'], volts: round1(jitter(3.31, 0.02)) },
    '5vsb': { amps: b.small['5vsb'], volts: round1(jitter(5.01, 0.04)) },
  };
  const r: PsuReadings = {
    watts: b.watts,
    // Efficiency peaks near half load on an 80 Plus Platinum unit.
    efficiency: Math.round(92 - Math.abs(b.watts / 1200 - 0.5) * 8),
    tempC: b.tempC,
    rails,
  };
  const warn = psuSettings.get().warn;
  if (lab.force === 'temp') r.tempC = warn.temp + 3;
  if (lab.force === 'current') r.rails['12v'] = { ...rails['12v'], amps: warn['12v'] + 4 };
  return r;
}
let readings: PsuReadings = derive(base);

/** The last readings, oldest first, for the small charts: a minute at 2 s. */
const HISTORY = 30;
let history: PsuReadings[] = Array.from({ length: HISTORY }, () => derive(base));
const readingListeners = new Set<() => void>();
let ticker: number | undefined;

/** The supply's readings, moving every 2 s while anything is watching — the
 *  same period System Vitals uses. Stops when the last reader goes. */
function subscribeReadings(listener: () => void) {
  readingListeners.add(listener);
  if (ticker === undefined) {
    ticker = window.setInterval(() => {
      const watts = Math.round(clamp(jitter(base.watts, 40), 180, 540));
      base = {
        // A reading of a few watts is the 2 W / 4 W bug, not a real one: keep
        // the last good value (lcd-diy.15).
        watts: watts < 20 ? base.watts : watts,
        tempC: Math.round(clamp(jitter(base.tempC, 2), 36, 48)),
        small: {
          '5v': round1(clamp(jitter(base.small['5v'], 0.6), 2.5, 7)),
          '3v3': round1(clamp(jitter(base.small['3v3'], 0.4), 1.8, 5)),
          '5vsb': round1(clamp(jitter(base.small['5vsb'], 0.1), 0.4, 1.2)),
        },
      };
      readings = derive(base);
      history = [...history.slice(1 - HISTORY), readings];
      readingListeners.forEach((l) => l());
    }, 2000);
  }
  return () => {
    readingListeners.delete(listener);
    if (readingListeners.size === 0 && ticker !== undefined) {
      window.clearInterval(ticker);
      ticker = undefined;
    }
  };
}
const readingsSnapshot = () => readings;
const historySnapshot = () => history;

export function usePsuReadings(): PsuReadings {
  return useSyncExternalStore(subscribeReadings, readingsSnapshot, readingsSnapshot);
}
export function usePsuHistory(): PsuReadings[] {
  return useSyncExternalStore(subscribeReadings, historySnapshot, historySnapshot);
}

/** Which readings are at or over their warning level (lcd-diy.16). */
export type PsuWarnKey = PsuRail | 'temp';
export function psuOver(r: PsuReadings, warn: PsuWarnLevels): PsuWarnKey[] {
  const out: PsuWarnKey[] = [];
  if (r.tempC >= warn.temp) out.push('temp');
  for (const { id } of PSU_RAILS) if (r.rails[id].amps >= warn[id]) out.push(id);
  return out;
}

/** The supply's status in a word, as the PC's entry and the window say it. */
export type PsuStatusWord = 'Good' | 'Running hot' | 'High current' | 'No readings';
export function psuStatusOf(over: PsuWarnKey[], usb: boolean): PsuStatusWord {
  if (!usb) return 'No readings';
  if (over.includes('temp')) return 'Running hot';
  if (over.length) return 'High current';
  return 'Good';
}
/** Read without subscribing: the entry should not re-render every two seconds
 *  to say "Good". */
export function psuStatusWord(): PsuStatusWord {
  return psuStatusOf(psuOver(readings, psuSettings.get().warn), lab.usb);
}

// A clean of the supply's fan, while it runs. It borrows the fan, so whatever
// shows the fan shows the clean, not the fan setting (lcd-diy.18). Not kept
// across reloads: a clean lasts seconds.
let cleaning = false;
const cleaningListeners = new Set<() => void>();
const subscribeCleaning = (listener: () => void) => {
  cleaningListeners.add(listener);
  return () => {
    cleaningListeners.delete(listener);
  };
};
const cleaningSnapshot = () => cleaning;

export function usePsuCleaning(): boolean {
  return useSyncExternalStore(subscribeCleaning, cleaningSnapshot, cleaningSnapshot);
}

/** Run a manual clean. The caller has already checked the supply is cool
 *  enough (fan-cleaner.41). */
export function startPsuClean(ms = 3000) {
  if (cleaning) return;
  cleaning = true;
  cleaningListeners.forEach((l) => l());
  window.setTimeout(() => {
    cleaning = false;
    psuSettings.set({ lastCleaned: Date.now() });
    cleaningListeners.forEach((l) => l());
  }, ms);
}

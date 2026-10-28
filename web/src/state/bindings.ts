/**
 * The bindings registry (TH-452) — every piece of app state a composed widget
 * can show or move, as ONE table.
 *
 * Until TH-450 a card was built from three hand-written vocabularies in
 * `state/overlays.ts` (readings, bound controls, app panels), and the model
 * could only pick from them. This file is the next step: a row per *binding* —
 * what the value is, where it lives, what range or options it has, which device
 * or module it needs, and which presentations can honestly show it — so the
 * parser, the card's sizing, the schema's `enum` and the renderer all read one
 * row. The model composes from these rows; it never invents one.
 *
 * PURE ON PURPOSE. No React, no components, no `Settings.tsx` at runtime (the
 * `SettingName` import is type-only and erased). `state/overlays.ts` imports this
 * file, never the reverse; `widgets/cardMeta.ts` sits on Settings' read path and
 * must stay free of component imports (its own header says why). A measurement
 * script (`web/scripts/measure-nova.mjs`) loads this module in plain Node, which
 * is the practical test of purity.
 *
 * THREE RULES, each paid for already:
 *
 *  1. **Heights are measured, never estimated** (gotcha 49). A row's height is
 *     the item as rendered inside `.wb-card-items` at the card's 301px body
 *     width; `PRESENTATION_HEIGHT` ships only numbers that were read off the
 *     board, and `unmeasured()` names the rest so the suite can refuse them.
 *  2. **Every `match` is a routing decision.** The same regexes that retrieve
 *     candidates for the model are the ones that decide whether a sentence is a
 *     card request at all, and the card builder sits between the overlay and the
 *     layout builders. A row matching "dark" would hijack "make it dark in here".
 *     Specific words, device-qualified where a word is shared.
 *  3. **Options that depend on the SKU are resolved at render**, never copied
 *     here — `optionsFrom` names the feature path and the label map, and the
 *     renderer reads the real device. A static `options` list is only for values
 *     the app itself owns.
 */
import type { SettingName } from './Settings';
import { RECIPE_BINDINGS, type RecipeBlockId } from '../agents/recipeBindings';
import { INPUT_EQ_LABEL, LIGHT_EFFECT_LABEL, MIC_PRESET_LABEL, NOTIFY_LABEL, PATTERN_LABEL, POWER_OFF_LABEL } from '../devices/audioLabels';

/** The device type a binding needs, in the SKU data's own words (`skus.json`). */
export type DeviceNeed = 'monitor' | 'headset' | 'mouse' | 'microphone' | 'keyboard';

/** Where a binding belongs, for retrieval: a sentence about the headset pulls the headset's rows. */
export type Domain = 'system' | 'power' | 'display' | 'lights' | 'headset' | 'microphone' | 'mouse' | 'keyboard' | 'appearance' | 'games' | 'shop' | 'nova' | 'desk';

/** What kind of value it is — this, not the id, decides how it may be shown. */
export type ValueType = 'percent' | 'number' | 'bipolar' | 'bool' | 'enum' | 'color' | 'records' | 'money' | 'count' | 'series';

/**
 * How an item is shown. The model chooses one from the set `COMPATIBLE` allows
 * for the value type; `choice` is further resolved by option count
 * (`choicePresentation`), which is the validator's call, not the model's.
 */
export type Presentation = 'tile' | 'gauge' | 'meter' | 'sparkline' | 'slider' | 'vu' | 'balance' | 'toggle' | 'choice' | 'badge' | 'rows' | 'price';

/** The bespoke controls that keep their own `LiveControl` case rather than a generic presentation. */
export type CustomControlId = 'dpi' | 'eq-preset' | 'fan-curve' | 'lights';
/** The app panels, rendered by `CardBlock` — the app's own, plus each Nova recipe's (agents/recipeBindings.ts). */
export type BlockId = 'recent-games' | 'deals' | 'tokenomics' | 'nova-chat' | RecipeBlockId;

/**
 * Where the value lives and how it is read or written. Each variant is a
 * different hook chain in `controls/BoundItem.tsx`, which is why they are a
 * tagged union here and a component boundary there.
 */
export type Source =
  /** A leaf of the vitals snapshot (`modals/vitalsData.ts`), read-only. `scale` divides, `digits` rounds. */
  | { kind: 'vitals'; path: string; scale?: number; digits?: number }
  /** A 2-minute history series — Phase B, for sparklines. */
  | { kind: 'series'; series: 'cpu' | 'gpu' | 'ram' | 'netUp' | 'netDown' }
  /** A Settings key, through the generic `useSettings().set(name, value)`. */
  | { kind: 'setting'; name: SettingName }
  /** A per-device profile key, through the device's profile bar (`useProfileValue`) — saved to the active profile. */
  | { kind: 'profile'; needs: DeviceNeed; key: string; fallback: number | boolean | string }
  /** The desk's primary display, through the monitor hooks: `useBrightnessLevel`, `usePicture`, `useAutoBrightness` (TH-453). */
  | { kind: 'monitor'; field: 'brightness' | 'contrast' | 'sharpness' | 'blackStretch' | 'colorPreset' | 'autoBrightness' }
  /** A long-tail device field described by `SPEC_SCHEMA` — Phase B. */
  | { kind: 'spec'; needs: string; path: string; shape?: 'range' | 'max' }
  /** A Nova ledger total (`useNova().totals`), read-only, shown with the Tokenomics formatters (TH-453). */
  | { kind: 'nova'; field: 'tokensIn' | 'tokensOut' | 'seconds' | 'cloudCostUsd' | 'localWh' | 'costAvoidedPct' | 'runsToday' | 'tokensToday'; fmt: 'tokens' | 'usd' | 'wh' | 'pct' | 'seconds' | 'int' }
  /** A control with its own bespoke renderer in `LiveControl`. */
  | { kind: 'custom'; control: CustomControlId }
  /** An app panel in `CardBlock`. */
  | { kind: 'block'; block: BlockId };

export interface Option {
  value: string;
  label: string;
}

/**
 * A card item that binds to a registry row (TH-452): the binding id, how it is
 * shown (absent = the row's default), and for a list panel how many rows. Joins
 * `OverlayItem`'s union in `state/overlays.ts`; defined here so the pure modules
 * can speak it without importing the store.
 */
export interface BoundItem {
  kind: 'bound';
  bind: string;
  as?: Presentation;
  count?: number;
  /**
   * Which record a single-record block shows (2026-10-20) — the game a placed
   * Catch Me Up recap was made for. Without it the block picks its own.
   */
  subject?: string;
}

/**
 * Options read off the real device at render time: `path` into `sku.features`
 * (an array of strings, numbers or `{label, value}` rows), `labels` for the
 * string case, `suffix` for the number case ("1000" → "1000 Hz").
 */
export interface OptionsFrom {
  path: string;
  labels?: Record<string, string>;
  suffix?: string;
  /** How many the default SKU offers — for sizing `choice` before a device is known. */
  count: number;
}

export interface Binding {
  /** Stable, kebab-case. The 23 pre-TH-452 ids are kept verbatim, so stored cards need no migration. */
  id: string;
  label: string;
  domain: Domain;
  valueType: ValueType;
  /** Words that name it. Any one matching counts. */
  match: RegExp[];
  /** Only when this ALSO matches — "monitoring" is the mic's only beside the word mic. */
  requires?: RegExp;
  /** Never when this matches — "mic volume" is the headset's mic unless "microphone" is named. */
  unless?: RegExp;
  range?: { min: number; max: number; step?: number };
  unit?: string;
  /** Static choices the app owns. For SKU-dependent choices use `optionsFrom`. */
  options?: readonly Option[];
  optionsFrom?: OptionsFrom;
  /** The VU slider's mark colouring, where the presentation is `vu`. */
  vu?: 'default' | 'reference' | 'peak' | 'clipping';
  /** A bipolar value's two sides, for its head line: `['mic', 'playback']` reads "mic 40%" / "even" / "playback 20%". */
  sides?: readonly [string, string];
  /** Takes the full row even though its form would flow 2-up — the chat panel. */
  wide?: boolean;
  source: Source;
  /** The device type it binds to. Absent = Settings or the app itself. */
  needs?: DeviceNeed;
  /** The module that has to be installed for it to mean anything. */
  module?: string;
  /** Bound through the device's profile bar, so a change is saved to the active profile. */
  profile?: boolean;
  /** The catalog widget that shows the same thing with more room — the "designed one" offer. */
  shownBy?: string;
  /** What it is, for the reply's first sentence — a panel's answer to "the readings you asked for". */
  what?: string;
  /** Retrieval order inside its domain: 1 is the most broadly useful. */
  rank: number;
  /** Per-presentation height overrides, measured, where this row differs from `PRESENTATION_HEIGHT`. */
  height?: Partial<Record<Presentation, number>>;
  /** For list panels: how many rows, with the clamp the renderer applies. */
  count?: { default: number; max: number };
  /** The two-minute history behind a reading, where the stream keeps one — what makes `sparkline` a form it can take (TH-454). */
  series?: 'cpu' | 'gpu' | 'ram' | 'netUp' | 'netDown';
}

// ── Compatibility ─────────────────────────────────────────────────────────────

/**
 * Which presentations can honestly show which value type, and the one used when
 * nobody chose. Read-only sources drop the writable presentations in
 * `allowedFor`. `color`, `series`, `gauge`, `meter`, `sparkline`, `badge` are
 * declared for Phase B; `IMPLEMENTED` is what this build can render.
 */
export const COMPATIBLE: Record<ValueType, { allowed: readonly Presentation[]; default: Presentation }> = {
  percent: { allowed: ['slider', 'tile', 'meter', 'gauge', 'sparkline'], default: 'slider' },
  number: { allowed: ['slider', 'tile', 'meter', 'gauge', 'sparkline'], default: 'slider' },
  bipolar: { allowed: ['balance', 'tile'], default: 'balance' },
  bool: { allowed: ['toggle', 'badge'], default: 'toggle' },
  enum: { allowed: ['choice', 'badge'], default: 'choice' },
  color: { allowed: [], default: 'tile' },
  records: { allowed: ['rows'], default: 'rows' },
  money: { allowed: ['price'], default: 'price' },
  count: { allowed: ['tile'], default: 'tile' },
  series: { allowed: ['sparkline', 'tile'], default: 'sparkline' },
};

/** The presentations writable sources can use; a read-only source never gets one. */
const WRITABLE: ReadonlySet<Presentation> = new Set(['slider', 'vu', 'balance', 'toggle', 'choice']);

/** What this build renders generically. Still to come: badge. */
export const IMPLEMENTED: ReadonlySet<Presentation> = new Set(['tile', 'slider', 'vu', 'balance', 'toggle', 'choice', 'rows', 'price', 'meter', 'gauge', 'sparkline']);

export function isWritable(b: Binding): boolean {
  const k = b.source.kind;
  return k === 'setting' || k === 'profile' || k === 'monitor' || k === 'spec';
}

/**
 * The presentations the model may choose for a binding, in preference order
 * (first = default). A `custom` or `block` source has none — it renders by its
 * own component and the schema offers it as a bare id.
 */
export function allowedFor(b: Binding): Presentation[] {
  if (b.source.kind === 'custom' || b.source.kind === 'block') return [];
  const { allowed, default: def } = COMPATIBLE[b.valueType];
  const writable = isWritable(b);
  // Forms that need more than the value (TH-454): a sparkline needs a history
  // series behind the row; a meter or a gauge needs a scale — a percentage, or
  // a row that declares its range.
  const scaled = b.valueType === 'percent' || !!b.range;
  const list = allowed.filter((p) => IMPLEMENTED.has(p) && (writable || !WRITABLE.has(p)) && (p !== 'sparkline' || !!b.series) && ((p !== 'meter' && p !== 'gauge') || scaled));
  // `vu` is a slider with level marks; offered only where the row asks for it —
  // and then it is the DEFAULT, because a level is what the row is (the headset
  // mic and the gain were level meters in TH-450 and must stay so for stored cards).
  if (b.vu && writable && list.includes('slider')) list.splice(list.indexOf('slider'), 0, 'vu');
  // Read-only numbers default to a tile, not a slider nobody can move.
  const first = writable ? (b.vu ? 'vu' : def) : list.find((p) => !WRITABLE.has(p)) ?? 'tile';
  return [first, ...list.filter((p) => p !== first)];
}

export function defaultPresentation(b: Binding): Presentation | undefined {
  return allowedFor(b)[0];
}

// ── Sizing ────────────────────────────────────────────────────────────────────

/**
 * Pixel heights inside `.wb-card-items` at 301px, measured on the board
 * 2026-10-04 (TH-450) and 2026-10-06 (TH-452). `NaN` = not yet measured; the
 * renderer then uses `FALLBACK_HEIGHT` and `unmeasured()` reports the gap so the
 * suite can fail it. Never type a number here you did not read off the board.
 */
export const PRESENTATION_HEIGHT: Record<Presentation | 'group' | 'chips' | 'dropdown', number> = {
  tile: 37,
  slider: 51, // a long device name + label wraps the head to two lines: +11px — keep labels short
  vu: 47,
  balance: 47,
  toggle: 43,
  choice: NaN, // resolved through `choicePresentation` → group | chips | dropdown
  group: 55,
  // Seven short chips wrap to two rows at 301px: 102px (polling rates, 2026-10-06).
  // Five fit one row and measure less, so this errs tall, which clips late.
  chips: 102,
  dropdown: NaN,
  gauge: 72, // 72px round, in a half cell — `NARROW` (board probe, 2026-10-06, TH-454)
  meter: 40, // the spark head over a 4px bar, full row (board probe, 2026-10-06, TH-454)
  sparkline: 66, // the spark head over a 28px graph, full row (board probe, 2026-10-06, TH-454)
  badge: NaN,
  rows: 38,
  price: NaN,
};
/** The tallest measured one-row control — what an unmeasured presentation is assumed to be, so it clips late rather than early. */
export const FALLBACK_HEIGHT = 89;

/** Presentations that flow 2-up like a stat tile; everything else takes the row. */
export const NARROW: ReadonlySet<Presentation> = new Set(['tile', 'gauge', 'badge']);

/** How a `choice` is drawn, by how many options there are — the validator's sub-choice. */
export function choicePresentation(optionCount: number): 'group' | 'chips' | 'dropdown' {
  return optionCount <= 4 ? 'group' : optionCount <= 10 ? 'chips' : 'dropdown';
}

export function optionCountOf(b: Binding): number {
  return b.options?.length ?? b.optionsFrom?.count ?? 0;
}

/** The measured height of a binding shown a given way, or the fallback. */
export function heightOf(b: Binding, as: Presentation): number {
  const own = b.height?.[as];
  if (own != null && Number.isFinite(own)) return own;
  const key = as === 'choice' ? choicePresentation(optionCountOf(b)) : as;
  const h = PRESENTATION_HEIGHT[key];
  return Number.isFinite(h) ? h : FALLBACK_HEIGHT;
}

/** Every binding × allowed presentation whose height is still `NaN` — the suite asserts this is empty. */
export function unmeasured(): string[] {
  const out: string[] = [];
  for (const b of Object.values(BINDINGS)) {
    for (const as of allowedFor(b)) {
      const key = as === 'choice' ? choicePresentation(optionCountOf(b)) : as;
      const own = b.height?.[as];
      if ((own == null || !Number.isFinite(own)) && !Number.isFinite(PRESENTATION_HEIGHT[key])) out.push(`${b.id}:${as}`);
    }
  }
  return out;
}

// ── Availability ──────────────────────────────────────────────────────────────

/** What the install can bind right now: the desk's device types and the installed modules. */
export interface BindingGate {
  deviceTypes: readonly string[];
  has: (moduleId: string) => boolean;
}

const DEVICE_NOUN: Record<DeviceNeed, string> = { monitor: 'display', headset: 'headset', mouse: 'mouse', microphone: 'microphone', keyboard: 'keyboard' };

/**
 * Why a binding cannot be bound right now, as the clause a reply says — or null.
 * With no gate the answer is "it can": a story or a hand-written script has no
 * snapshot, and refusing everything would be its own wrong answer.
 */
export function bindingAbsence(b: Pick<Binding, 'needs' | 'module'>, gate?: BindingGate | null): string | null {
  if (!gate) return null;
  if (b.needs && !gate.deviceTypes.includes(b.needs)) return `there is no ${DEVICE_NOUN[b.needs]} on this desk`;
  if (b.module && !gate.has(b.module)) return `the ${b.module.charAt(0).toUpperCase()}${b.module.slice(1)} module is not installed`;
  return null;
}

// ── Retrieval vocabulary ──────────────────────────────────────────────────────

/** A sentence about a domain pulls that domain's rows into the candidate set even when no row matched by name. */
// ── Option lists the app owns ─────────────────────────────────────────────────
// Here rather than in the windows that show them, so a registry row and the
// window it mirrors cannot disagree (TH-453). `readonly string[]`, not a tuple:
// the monitor tab indexes `BLACK_STRETCH` by a stored string.

/** The accent colors, in the order the Settings and Profiles windows show them. */
export const ACCENTS: readonly string[] = ['blue', 'indigo', 'purple', 'orange', 'green', 'red', 'yellow'];
/** Black Stretch's four steps, in order — the slider's scale, not a menu. */
export const BLACK_STRETCH: readonly string[] = ['Off', 'Low', 'Medium', 'High'];
/** Auto-Brightness sources — Off, the room's light, or the picture's content. */
export const AUTO_BRIGHTNESS: readonly string[] = ['Off', 'Ambient', 'Content'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const asOptions = (xs: readonly string[]): Option[] => xs.map((v) => ({ value: v, label: cap(v) }));

export const DOMAIN_WORDS: Record<Domain, RegExp> = {
  system: /\b(pc|system|machine|rig|computer|temps?|temperatures?|performance|vitals)\b/i,
  power: /\b(power|battery|eco|watts?)\b/i,
  display: /\b(screen|display|monitor)s?\b/i,
  lights: /\b(lights?|lighting|rgb|glow|leds?)\b/i,
  headset: /\b(headset|headphones?|cans)\b/i,
  microphone: /\b(microphone|mic)\b/i,
  mouse: /\b(mouse|sensor|cursor|aim)\b/i,
  keyboard: /\b(keyboard|keys|keeb)\b/i,
  appearance: /\b(theme|appearance|wallpaper|accent|look)\b/i,
  games: /\b(games?|library|play(ed|ing)?)\b/i,
  shop: /\b(shop|store|deals?|sales?)\b/i,
  nova: /\b(nova|chat|tokens?|tokenomics)\b/i,
  desk: /\b(desk|devices?|peripherals?)\b/i,
};

/** Always offered when the sentence names no domain — the classic corner readout, plus the two most-asked controls. */
export const CORE: readonly string[] = ['fps', 'cpu-temp', 'gpu-temp', 'cpu', 'gpu', 'ram', 'power-mode'];

/** The sentence names the microphone (or "mic") and never the headset. */
export const MIC_NOT_HEADSET = /^(?!.*\bheadset\b)[\s\S]*\b(microphone|mic)\b/i;

// ── The rows ──────────────────────────────────────────────────────────────────

const pct = { min: 0, max: 100 } as const;

/**
 * Phase A rows (TH-452): the vitals readings, every per-device profile key for
 * the headset, mic, mouse and keyboard that a generic control can show, the 23
 * pre-existing ids verbatim, one Settings key (`eco-mode`, so the Settings
 * resolver is exercised before Phase B widens it), and the four app panels.
 *
 * `rank` is retrieval order within the domain; `what` is the reply's phrase for
 * a panel; `shownBy` names the catalog widget that does it with more room.
 */
export const BINDINGS: Record<string, Binding> = Object.fromEntries(
  (
    [
      // ── System readings (vitals snapshot, read-only) ──
      { id: 'fps', label: 'FPS', domain: 'system', valueType: 'number', unit: '', match: [/\b(fps|frame ?rate|frames)\b/i], source: { kind: 'vitals', path: 'fps', digits: 0 }, rank: 1 },
      { id: 'cpu', series: 'cpu', label: 'CPU', domain: 'system', valueType: 'percent', unit: '%', match: [/\bcpu\b(?! ?(temp|temperature|heat|clock|speed))/i], source: { kind: 'vitals', path: 'cpu.usage', digits: 0 }, shownBy: 'cpu', rank: 2 },
      { id: 'cpu-temp', label: 'CPU temp', domain: 'system', valueType: 'number', unit: '°C', range: pct, match: [/\bcpu ?(temp|temperature|heat)\b/i, /\b(temps|temperatures)\b/i], source: { kind: 'vitals', path: 'cpu.temp', digits: 0 }, shownBy: 'thermal', rank: 3 },
      { id: 'gpu', series: 'gpu', label: 'GPU', domain: 'system', valueType: 'percent', unit: '%', match: [/\bgpu\b(?! ?(temp|temperature|heat|clock|memory))/i], source: { kind: 'vitals', path: 'gpu.usage', digits: 0 }, shownBy: 'gpu-status', rank: 4 },
      { id: 'gpu-temp', label: 'GPU temp', domain: 'system', valueType: 'number', unit: '°C', range: pct, match: [/\bgpu ?(temp|temperature|heat)\b/i, /\b(temps|temperatures)\b/i], source: { kind: 'vitals', path: 'gpu.temp', digits: 0 }, shownBy: 'thermal', rank: 5 },
      { id: 'ram', series: 'ram', label: 'RAM', domain: 'system', valueType: 'percent', unit: '%', match: [/\b(ram|memory)\b(?! ?clock)/i], source: { kind: 'vitals', path: 'ram.percent', digits: 0 }, shownBy: 'vitals', rank: 6 },
      { id: 'cpu-speed', label: 'CPU clock', domain: 'system', valueType: 'number', unit: 'GHz', match: [/\bcpu ?(clock|speed|frequency|ghz)\b/i], source: { kind: 'vitals', path: 'cpu.speed', digits: 2 }, shownBy: 'cpu', rank: 7 },
      { id: 'gpu-clock', label: 'GPU clock', domain: 'system', valueType: 'number', unit: 'MHz', match: [/\bgpu ?(clock|speed|frequency|mhz)\b/i, /\bcore clock\b/i], source: { kind: 'vitals', path: 'gpu.clockCore', digits: 0 }, shownBy: 'gpu-status', rank: 8 },
      { id: 'gpu-mem-clock', label: 'Memory clock', domain: 'system', valueType: 'number', unit: 'MHz', match: [/\b(memory|mem|vram) ?clock\b/i], source: { kind: 'vitals', path: 'gpu.clockMemory', digits: 0 }, rank: 9 },
      { id: 'vram-used', label: 'VRAM used', domain: 'system', valueType: 'number', unit: 'GB', match: [/\bvram\b(?! ?clock)/i, /\bgpu ?memory\b/i, /\bvideo ?memory\b/i], source: { kind: 'vitals', path: 'gpu.memUsed', scale: 1024, digits: 1 }, rank: 10 },
      { id: 'ram-used', label: 'RAM used', domain: 'system', valueType: 'number', unit: 'GB', match: [/\b(ram|memory) (used|in use|usage in gb)\b/i], source: { kind: 'vitals', path: 'ram.used', scale: 1e9, digits: 1 }, shownBy: 'vitals', rank: 11 },
      { id: 'ram-free', label: 'RAM free', domain: 'system', valueType: 'number', unit: 'GB', match: [/\b(ram|memory) (free|available|left)\b/i, /\bfree (ram|memory)\b/i], source: { kind: 'vitals', path: 'ram.available', scale: 1e9, digits: 1 }, rank: 12 },
      { id: 'net-down', series: 'netDown', label: 'Download', domain: 'system', valueType: 'number', unit: 'Mbps', match: [/\bdownload( speed)?\b/i, /\b(network|net|internet|wifi|wi-fi|bandwidth)\b/i], source: { kind: 'vitals', path: 'net.down', digits: 0 }, shownBy: 'vitals', rank: 13 },
      { id: 'net-up', series: 'netUp', label: 'Upload', domain: 'system', valueType: 'number', unit: 'Mbps', match: [/\bupload( speed)?\b/i], source: { kind: 'vitals', path: 'net.up', digits: 0 }, shownBy: 'vitals', rank: 14 },
      { id: 'net-link', label: 'Link speed', domain: 'system', valueType: 'number', unit: 'Mbps', match: [/\blink ?speed\b/i, /\bconnection speed\b/i], source: { kind: 'vitals', path: 'net.link', digits: 0 }, rank: 15 },
      { id: 'drive-c-used', label: 'C: used', domain: 'system', valueType: 'percent', unit: '%', match: [/\b(c:|c drive|system drive|boot drive)\b/i, /\b(storage|disk|drive|ssd|nvme|space)\b/i], source: { kind: 'vitals', path: 'storage.0.percent', digits: 0 }, shownBy: 'storage', rank: 16 },
      { id: 'drive-d-used', label: 'D: used', domain: 'system', valueType: 'percent', unit: '%', match: [/\b(d:|d drive|games? drive|second drive)\b/i], source: { kind: 'vitals', path: 'storage.1.percent', digits: 0 }, shownBy: 'storage', rank: 17 },
      { id: 'drive-c-temp', label: 'C: temp', domain: 'system', valueType: 'number', unit: '°C', range: pct, match: [/\b(drive|disk|ssd|nvme) ?temp(erature)?s?\b/i], source: { kind: 'vitals', path: 'storage.0.temp', digits: 0 }, rank: 18 },
      { id: 'drive-d-temp', label: 'D: temp', domain: 'system', valueType: 'number', unit: '°C', range: pct, match: [/\bd:? ?(drive )?temp\b/i], source: { kind: 'vitals', path: 'storage.1.temp', digits: 0 }, rank: 19 },

      // ── Power ──
      { id: 'power-mode', label: 'Power mode', domain: 'power', valueType: 'enum', match: [/\bpower ?modes?\b/i], source: { kind: 'setting', name: 'powerMode' }, options: [{ value: 'performance', label: 'Performance' }, { value: 'balanced', label: 'Balanced' }, { value: 'eco', label: 'Eco' }], shownBy: 'power', rank: 1, height: { choice: 55 } },
      { id: 'fan-curve', label: 'Fan curve', domain: 'power', valueType: 'number', match: [/\b(fan ?curve|fan ?speeds?|fans?)\b/i], source: { kind: 'custom', control: 'fan-curve' }, shownBy: 'fanspeed', rank: 2, height: { tile: 209 } },
      { id: 'eco-mode', label: 'Eco mode', domain: 'power', valueType: 'bool', match: [/\beco ?mode\b/i, /\b(power saving|save power)\b/i], source: { kind: 'setting', name: 'ecoMode' }, rank: 3 },

      // ── Display ──
      { id: 'brightness', label: 'Brightness', domain: 'display', valueType: 'percent', unit: '%', range: pct, match: [/(?<!\b(?:light|lights|lighting|glow|rgb|led|strip|ring)s? |\bauto[- ]?)\bbrightness\b/i, /\b(screen|display|monitor) (level|dimmer)\b/i], source: { kind: 'monitor', field: 'brightness' }, needs: 'monitor', rank: 1 },

      // ── Lights ──
      // "lights" alone is the desk's under-glow; "mic lights", "ring light", "keyboard
      // lights" belong to their devices, so the word is read only when no device
      // precedes it — a lookbehind, not an `unless`, so "my lights and my mic lights"
      // still names both.
      { id: 'lights', label: 'Lights', domain: 'lights', valueType: 'bool', match: [/\b(light ?studio|under ?glow|glow)\b/i, /(?<!\b(?:mic|microphone|ring|keyboard|keeb) )\b(lights?|lighting|rgb|leds?)\b(?! (effect|preset|brightness|mode|theme))/i], source: { kind: 'custom', control: 'lights' }, shownBy: 'lighting', rank: 1, height: { tile: 83 } },

      // ── Headset (profile-bound) ──
      { id: 'volume', label: 'Volume', domain: 'headset', valueType: 'percent', unit: '%', range: pct, match: [/(?<!\b(?:mic|microphone|headphone|headphones) )\b(volume|loudness)\b/i], source: { kind: 'profile', needs: 'headset', key: 'audio.volume', fallback: 62 }, needs: 'headset', profile: true, rank: 1 },
      { id: 'headset-mic', label: 'Mic level', domain: 'headset', valueType: 'percent', unit: '%', range: pct, vu: 'default', match: [/\bheadset mic\b/i, /\bmic (volume|level)\b/i], unless: MIC_NOT_HEADSET, source: { kind: 'profile', needs: 'headset', key: 'audio.micVolume', fallback: 70 }, needs: 'headset', profile: true, rank: 2 },
      { id: 'sidetone', label: 'Mic monitoring', domain: 'headset', valueType: 'bool', match: [/\b(side ?tone|hear (myself|my (own )?voice))\b/i, /\bmonitoring\b/i], unless: MIC_NOT_HEADSET, source: { kind: 'profile', needs: 'headset', key: 'audio.micMonitoring', fallback: false }, needs: 'headset', profile: true, rank: 3 },
      { id: 'eq-preset', label: 'Equalizer', domain: 'headset', valueType: 'enum', match: [/\b(eq|equali[sz]er|bass|treble|sound (profile|preset))\b/i], unless: /\binput eq\b/i, source: { kind: 'custom', control: 'eq-preset' }, needs: 'headset', profile: true, rank: 4, height: { tile: 121 } },
      { id: 'headset-eq', label: 'Equalizer on', domain: 'headset', valueType: 'bool', match: [/\b(eq|equali[sz]er) (on|off|switch|toggle)\b/i], unless: MIC_NOT_HEADSET, source: { kind: 'profile', needs: 'headset', key: 'audio.equalizer', fallback: false }, needs: 'headset', profile: true, rank: 5 },
      { id: 'headset-mic-preset', label: 'Mic preset', domain: 'headset', valueType: 'enum', match: [/\bmic preset\b/i], unless: MIC_NOT_HEADSET, optionsFrom: { path: 'audio.mic.presets', labels: MIC_PRESET_LABEL, count: 4 }, source: { kind: 'profile', needs: 'headset', key: 'audio.micPreset', fallback: 'gaming' }, needs: 'headset', profile: true, rank: 6 },
      { id: 'spatial-power', label: 'Spatial audio', domain: 'headset', valueType: 'bool', match: [/\b(spatial( audio)?|surround|7\.1|3d audio)\b/i], source: { kind: 'profile', needs: 'headset', key: 'spatial.power', fallback: true }, needs: 'headset', profile: true, rank: 7 },
      { id: 'spatial-experience', label: 'Spatial balance', domain: 'headset', valueType: 'bipolar', range: pct, sides: ['performance', 'immersion'], match: [/\b(immersion|spatial (balance|experience)|performance vs immersion)\b/i], source: { kind: 'profile', needs: 'headset', key: 'spatial.experience', fallback: 50 }, needs: 'headset', profile: true, rank: 8 },
      { id: 'spatial-distance', label: 'Spatial distance', domain: 'headset', valueType: 'percent', range: pct, match: [/\b(spatial distance|sound distance|near or far)\b/i], source: { kind: 'profile', needs: 'headset', key: 'spatial.distance', fallback: 50 }, needs: 'headset', profile: true, rank: 9 },
      { id: 'headset-notifications', label: 'Notifications', domain: 'headset', valueType: 'enum', match: [/\b(voice prompts?|notifications?( mode)?|headset (tones?|announcements?))\b/i], optionsFrom: { path: 'notifications.modes', labels: NOTIFY_LABEL, count: 3 }, source: { kind: 'profile', needs: 'headset', key: 'settings.notifications', fallback: 'voice' }, needs: 'headset', profile: true, rank: 10 },
      { id: 'headset-auto-off', label: 'Auto power-off', domain: 'headset', valueType: 'enum', match: [/\b(auto[- ]?(power[- ]?)?off|power[- ]?off timer|sleep timer)\b/i], optionsFrom: { path: 'power.autoPowerOff', labels: POWER_OFF_LABEL, count: 5 }, source: { kind: 'profile', needs: 'headset', key: 'settings.autoPowerOff', fallback: '20min' }, needs: 'headset', profile: true, rank: 11 },

      // ── Microphone (profile-bound) ──
      { id: 'mic-gain', label: 'Gain', domain: 'microphone', valueType: 'percent', unit: '%', range: pct, vu: 'clipping', match: [/\bgain\b/i, /\b(microphone|mic) (volume|level)\b/i], requires: /\bgain\b|^(?!.*\bheadset\b)[\s\S]*\bmicrophone\b/i, source: { kind: 'profile', needs: 'microphone', key: 'audio.gain', fallback: 55 }, needs: 'microphone', profile: true, rank: 1 },
      { id: 'mic-mix', label: 'Monitor mix', domain: 'microphone', valueType: 'bipolar', range: pct, sides: ['mic', 'playback'], match: [/\b(monitor(ing)? mix|mix)\b/i], source: { kind: 'profile', needs: 'microphone', key: 'audio.monitorMix', fallback: 50 }, needs: 'microphone', profile: true, rank: 2 },
      { id: 'mic-headphones', label: 'Headphone volume', domain: 'microphone', valueType: 'percent', unit: '%', range: pct, match: [/\bheadphones? (volume|level|out)\b/i], source: { kind: 'profile', needs: 'microphone', key: 'audio.headphoneVolume', fallback: 0 }, needs: 'microphone', profile: true, rank: 3 },
      { id: 'mic-monitor', label: 'Monitoring', domain: 'microphone', valueType: 'bool', match: [/\bmonitoring\b/i], requires: MIC_NOT_HEADSET, source: { kind: 'profile', needs: 'microphone', key: 'audio.monitoring', fallback: false }, needs: 'microphone', profile: true, rank: 4 },
      { id: 'mic-pattern', label: 'Pickup pattern', domain: 'microphone', valueType: 'enum', match: [/\b(pickup|polar) ?pattern\b/i, /\b(cardioid|omni(directional)?|bidirectional|figure[- ]8)\b/i], optionsFrom: { path: 'audio.pickupPatterns', labels: PATTERN_LABEL, count: 4 }, source: { kind: 'profile', needs: 'microphone', key: 'audio.pickupPattern', fallback: 'cardioid' }, needs: 'microphone', profile: true, rank: 5 },
      { id: 'mic-tap-to-mute', label: 'Tap to mute', domain: 'microphone', valueType: 'bool', match: [/\btap[- ]to[- ]mute\b/i], source: { kind: 'profile', needs: 'microphone', key: 'audio.tapToMute', fallback: true }, needs: 'microphone', profile: true, rank: 6 },
      { id: 'mic-input-eq', label: 'Input EQ', domain: 'microphone', valueType: 'enum', match: [/\binput (eq|equali[sz]er)\b/i, /\bmic (eq|equali[sz]er)\b/i], optionsFrom: { path: 'audio.inputEq', labels: INPUT_EQ_LABEL, count: 4 }, source: { kind: 'profile', needs: 'microphone', key: 'audio.inputEq', fallback: 'flat' }, needs: 'microphone', profile: true, rank: 7 },
      { id: 'mic-effects-preset', label: 'Effects preset', domain: 'microphone', valueType: 'enum', match: [/\b(mic |microphone )?effects? preset\b/i, /\bvoice preset\b/i], optionsFrom: { path: 'effects.presets', labels: MIC_PRESET_LABEL, count: 4 }, source: { kind: 'profile', needs: 'microphone', key: 'effects.preset', fallback: 'streaming' }, needs: 'microphone', profile: true, rank: 8 },
      { id: 'mic-light-effect', label: 'Ring light effect', domain: 'microphone', valueType: 'enum', match: [/\b(ring|mic|microphone) light(ing)? effect\b/i, /\blight(ing)? effect\b/i], requires: MIC_NOT_HEADSET, optionsFrom: { path: 'lighting.effects', labels: LIGHT_EFFECT_LABEL, count: 4 }, source: { kind: 'profile', needs: 'microphone', key: 'lighting.effect', fallback: 'solid' }, needs: 'microphone', profile: true, rank: 9 },
      { id: 'mic-light-brightness', label: 'Ring light brightness', domain: 'microphone', valueType: 'percent', unit: '%', range: pct, match: [/\b(ring|mic|microphone) light(ing)? brightness\b/i, /\blight(ing)? brightness\b/i], requires: MIC_NOT_HEADSET, source: { kind: 'profile', needs: 'microphone', key: 'lighting.brightness', fallback: 80 }, needs: 'microphone', profile: true, rank: 10 },
      { id: 'mic-lights', label: 'Ring light', domain: 'microphone', valueType: 'bool', match: [/\b(ring|mic|microphone) lights?\b/i], source: { kind: 'profile', needs: 'microphone', key: 'lighting.power', fallback: true }, needs: 'microphone', profile: true, rank: 11 },
      { id: 'mic-multicolor', label: 'Multi-color', domain: 'microphone', valueType: 'bool', match: [/\bmulti[- ]?colou?r\b/i], requires: MIC_NOT_HEADSET, source: { kind: 'profile', needs: 'microphone', key: 'lighting.multiColor', fallback: false }, needs: 'microphone', profile: true, rank: 12 },

      // ── Mouse (profile-bound) ──
      { id: 'dpi', label: 'DPI', domain: 'mouse', valueType: 'number', unit: 'DPI', match: [/\b(dpi|cpi|sensitivity)\b/i], source: { kind: 'custom', control: 'dpi' }, needs: 'mouse', profile: true, rank: 1, height: { tile: 89 } },
      { id: 'polling-rate', label: 'Polling rate', domain: 'mouse', valueType: 'enum', match: [/\b(mouse )?polling( rate)?\b/i, /\breport rate\b/i], unless: /\bkeyboard\b/i, optionsFrom: { path: 'sensor.pollingRates', suffix: ' Hz', count: 7 }, source: { kind: 'profile', needs: 'mouse', key: 'sensor.pollingRate', fallback: '1000' }, needs: 'mouse', profile: true, rank: 2 },
      { id: 'lift-off', label: 'Lift-off distance', domain: 'mouse', valueType: 'enum', match: [/\blift[- ]?off( distance)?\b/i, /\blod\b/i], optionsFrom: { path: 'sensor.liftOffDistance', count: 3 }, source: { kind: 'profile', needs: 'mouse', key: 'sensor.liftOffDistance', fallback: '1mm' }, needs: 'mouse', profile: true, rank: 3 },
      { id: 'motion-sync', label: 'Motion sync', domain: 'mouse', valueType: 'bool', match: [/\bmotion ?sync\b/i], source: { kind: 'profile', needs: 'mouse', key: 'sensor.motionSync', fallback: false }, needs: 'mouse', profile: true, rank: 4 },
      { id: 'angle', label: 'Angle', domain: 'mouse', valueType: 'number', unit: '°', range: { min: -30, max: 30 }, match: [/\b(sensor |mouse )?angle( adjustment| tuning)?\b/i], unless: /\bsnapping\b/i, source: { kind: 'profile', needs: 'mouse', key: 'sensor.angle', fallback: 0 }, needs: 'mouse', profile: true, rank: 5 },
      { id: 'angle-snapping', label: 'Angle snapping', domain: 'mouse', valueType: 'bool', match: [/\b(angle )?snapping\b/i], source: { kind: 'profile', needs: 'mouse', key: 'sensor.angleSnapping', fallback: false }, needs: 'mouse', profile: true, rank: 6 },

      // ── Keyboard (profile-bound) ──
      { id: 'keyboard-lights', label: 'Keyboard lights', domain: 'keyboard', valueType: 'bool', match: [/\bkeyboard (lights?|lighting|rgb|backlight)\b/i, /\bbacklight\b/i], source: { kind: 'profile', needs: 'keyboard', key: 'lighting.power', fallback: true }, needs: 'keyboard', profile: true, rank: 1 },
      { id: 'keyboard-light-brightness', label: 'Keyboard brightness', domain: 'keyboard', valueType: 'percent', unit: '%', range: pct, match: [/\bkeyboard (light(ing)? )?brightness\b/i, /\bbacklight brightness\b/i], source: { kind: 'profile', needs: 'keyboard', key: 'lighting.brightness', fallback: 80 }, needs: 'keyboard', profile: true, rank: 2 },
      { id: 'keyboard-polling', label: 'Keyboard polling', domain: 'keyboard', valueType: 'enum', match: [/\bkeyboard polling( rate)?\b/i], options: ['125 Hz', '250 Hz', '500 Hz', '1000 Hz', '2000 Hz', '4000 Hz', '8000 Hz'].map((v) => ({ value: v, label: v })), source: { kind: 'profile', needs: 'keyboard', key: 'settings.pollingRate', fallback: '1000 Hz' }, needs: 'keyboard', profile: true, rank: 3 },
      { id: 'keyboard-control-mode', label: 'Control mode', domain: 'keyboard', valueType: 'enum', match: [/\b(control mode|hardware mode|software mode)\b/i], options: [{ value: 'software', label: 'Software' }, { value: 'hardware', label: 'Hardware' }], source: { kind: 'profile', needs: 'keyboard', key: 'settings.controlMode', fallback: 'software' }, needs: 'keyboard', profile: true, rank: 4 },

      // ── App settings (Settings keys, TH-453) ──
      // Through the generic setter. The four profile-resolved keys (`OVERRIDABLE`)
      // are bound too: when the active profile overrides one, the control locks
      // with the reason, instead of writing a baseline the profile would hide.
      { id: 'theme', label: 'Theme', domain: 'appearance', valueType: 'enum', match: [/\btheme\b/i, /\b(dark|light) (mode|theme)\b/i], options: asOptions(['dark', 'light', 'system']), source: { kind: 'setting', name: 'theme' }, rank: 1, height: { choice: 55 } },
      { id: 'accent', label: 'Accent', domain: 'appearance', valueType: 'enum', match: [/\baccent( colou?r)?\b/i], options: asOptions(ACCENTS), source: { kind: 'setting', name: 'accent' }, rank: 2, height: { choice: 102 } },
      { id: 'density', label: 'Density', domain: 'appearance', valueType: 'enum', match: [/\bdensity\b/i, /\bcompact (mode|layout|spacing)\b/i], options: asOptions(['comfortable', 'compact']), source: { kind: 'setting', name: 'density' }, rank: 3, height: { choice: 55 } },
      // Options are the app's wallpapers, resolved at render: `app/wallpapers.ts`
      // loads images through `import.meta.glob`, which a pure module cannot import.
      { id: 'wallpaper', label: 'Wallpaper', domain: 'appearance', valueType: 'enum', match: [/\bwallpapers?\b(?! (blur|opacity))/i, /\bbackground (image|picture)\b/i], source: { kind: 'setting', name: 'wallpaper' }, rank: 4, height: { choice: 55 } },
      { id: 'wallpaper-blur', label: 'Wallpaper blur', domain: 'appearance', valueType: 'number', range: { min: 0, max: 60, step: 2 }, unit: '', match: [/\b(wallpaper|background) blur\b/i, /\bblur\b/i], source: { kind: 'setting', name: 'wpBlur' }, rank: 5 },
      { id: 'wallpaper-opacity', label: 'Wallpaper opacity', domain: 'appearance', valueType: 'percent', range: { min: 0, max: 100, step: 5 }, unit: '%', match: [/\b(wallpaper|background) opacity\b/i, /\bopacity\b/i], source: { kind: 'setting', name: 'wpOpacity' }, rank: 6 },
      { id: 'temp-unit', label: 'Temperature unit', domain: 'system', valueType: 'enum', match: [/\b(temp(erature)? units?|celsius|fahrenheit|degrees [cf])\b/i], options: [{ value: 'C', label: '\u00b0C' }, { value: 'F', label: '\u00b0F' }], source: { kind: 'setting', name: 'tempUnit' }, rank: 9, height: { choice: 55 } },
      { id: 'display-sync', label: 'Match displays', domain: 'display', valueType: 'bool', match: [/\b(match(ed|ing)? (all )?(my )?(displays|monitors|screens)|display (sync|match)|sync(ed)? (my )?(displays|monitors)|(all )?(displays|monitors) at one level)\b/i], source: { kind: 'setting', name: 'displaySync' }, needs: 'monitor', rank: 6 },
      { id: 'osd-lock', label: 'OSD lock', domain: 'display', valueType: 'bool', match: [/\bosd( lock)?\b/i], source: { kind: 'setting', name: 'osdLock' }, needs: 'monitor', rank: 7 },
      { id: 'pin-nova', label: 'Pin Nova', domain: 'nova', valueType: 'bool', match: [/\b(pin(ned)? nova|nova pinned|keep nova open)\b/i], source: { kind: 'setting', name: 'novaPinned' }, rank: 11 },

      // ── Display picture (monitor hooks, TH-453) ──
      // The same hooks the monitor window's Display tab uses, so a change here is
      // filed under the mode the display is in, exactly as there.
      { id: 'contrast', label: 'Contrast', domain: 'display', valueType: 'percent', unit: '%', range: pct, match: [/\bcontrast\b/i], source: { kind: 'monitor', field: 'contrast' }, needs: 'monitor', rank: 2 },
      { id: 'sharpness', label: 'Sharpness', domain: 'display', valueType: 'percent', unit: '%', range: pct, match: [/\bsharpness\b/i], source: { kind: 'monitor', field: 'sharpness' }, needs: 'monitor', rank: 3 },
      { id: 'black-stretch', label: 'Black stretch', domain: 'display', valueType: 'enum', match: [/\bblack (stretch|levels?)\b/i], options: asOptions(BLACK_STRETCH), source: { kind: 'monitor', field: 'blackStretch' }, needs: 'monitor', rank: 4, height: { choice: 55 } },
      { id: 'color-preset', label: 'Color preset', domain: 'display', valueType: 'enum', match: [/\b(colou?r (preset|profile|space|mode)|srgb|dci-p3|rec\.? ?709)\b/i], optionsFrom: { path: 'color.presets', count: 3 }, source: { kind: 'monitor', field: 'colorPreset' }, needs: 'monitor', rank: 5, height: { choice: 55 } },
      { id: 'auto-brightness', label: 'Auto-brightness', domain: 'display', valueType: 'enum', match: [/\b(auto[- ]?brightness|ambient (light )?sensor|brightness (sensor|source))\b/i], options: asOptions(AUTO_BRIGHTNESS), source: { kind: 'monitor', field: 'autoBrightness' }, needs: 'monitor', rank: 8, height: { choice: 55 } },

      // ── Nova ledger (read-only, TH-453) ──
      // The totals the Tokenomics popover shows, one tile each, with its formatters.
      { id: 'nova-cost', label: 'Cloud cost', domain: 'nova', valueType: 'count', match: [/\bcloud (cost|spend)\b/i], source: { kind: 'nova', field: 'cloudCostUsd', fmt: 'usd' }, rank: 3 },
      { id: 'nova-avoided', label: 'Cost avoided', domain: 'nova', valueType: 'count', unit: '%', match: [/\b(cost|money) (avoided|saved)|savings\b/i], unless: /\b(shop|store|deals?|sales?|discounts?)\b/i, source: { kind: 'nova', field: 'costAvoidedPct', fmt: 'pct' }, rank: 4 },
      { id: 'nova-energy', label: 'Local energy', domain: 'nova', valueType: 'count', match: [/\b(local )?energy|watt[- ]?hours?\b/i], unless: /\b(sav(e|ing|er)|efficien\w*|eco)\b/i, source: { kind: 'nova', field: 'localWh', fmt: 'wh' }, rank: 5 },
      { id: 'nova-tokens-in', label: 'Tokens in', domain: 'nova', valueType: 'count', match: [/\b(input|context|prompt) tokens|tokens? in\b/i], source: { kind: 'nova', field: 'tokensIn', fmt: 'tokens' }, rank: 6 },
      { id: 'nova-tokens-out', label: 'Tokens out', domain: 'nova', valueType: 'count', match: [/\b(output|generated|response) tokens|tokens? out\b/i], source: { kind: 'nova', field: 'tokensOut', fmt: 'tokens' }, rank: 7 },
      { id: 'nova-tokens-today', label: 'Tokens today', domain: 'nova', valueType: 'count', match: [/\btokens? today\b/i], source: { kind: 'nova', field: 'tokensToday', fmt: 'tokens' }, rank: 8 },
      { id: 'nova-runs-today', label: 'Runs today', domain: 'nova', valueType: 'count', match: [/\b(runs?|replies|answers) today\b/i], source: { kind: 'nova', field: 'runsToday', fmt: 'int' }, rank: 9 },
      { id: 'nova-seconds', label: 'Model time', domain: 'nova', valueType: 'count', match: [/\b(model|thinking|compute|inference) time\b/i], source: { kind: 'nova', field: 'seconds', fmt: 'seconds' }, rank: 10 },

      // ── App panels (CardBlock) ──
      {
        id: 'recent-games',
        label: 'Recent games',
        domain: 'games',
        valueType: 'records',
        match: [/\b(recent(ly)?[- ]?(played)?[- ]?games?|last[- ]?played|played[- ]?recently|recently played|games? i(?:'ve| have)? (?:been )?play(?:ed|ing)|what i(?:'ve| have)? (?:been )?play(?:ed|ing))\b/i],
        source: { kind: 'block', block: 'recent-games' },
        what: 'the games you played most recently, newest first',
        shownBy: 'lastplayed',
        count: { default: 3, max: 6 },
        rank: 1,
      },
      { id: 'deals', label: 'Deals', domain: 'shop', valueType: 'records', match: [/\b(deals?|on sale|sales?|discounts?|bargains?)\b/i], source: { kind: 'block', block: 'deals' }, what: 'the store’s deepest savings right now', module: 'shop', shownBy: 'deals', count: { default: 2, max: 4 }, rank: 1 },
      // The Nova recipes' blocks (Catch Me Up's games-drifted-from list and
      // recap, the refund agent's windows and clock): each agent declares its
      // own rows beside its scripts (agents/recipeBindings.ts).
      ...RECIPE_BINDINGS,
      { id: 'tokenomics', label: 'Tokenomics', domain: 'nova', valueType: 'count', match: [/\b(tokenomics|tokens?|token (usage|count|cost|spend)|what nova (has )?cost)\b/i], unless: /\b((input|output|context|prompt|generated|response) tokens|tokens? (in|out|today)|cloud cost|cost avoided|local energy)\b/i, source: { kind: 'block', block: 'tokenomics' }, what: 'what Nova has cost — the cloud-equivalent, the local energy and the share avoided', module: 'nova', rank: 1, height: { tile: 37 } },
      { id: 'nova-chat', label: 'Nova', domain: 'nova', valueType: 'records', match: [/\b(nova('s)? chat|chat|(ask|talk to|message|prompt) nova|nova (prompt|input|composer|box))\b/i], source: { kind: 'block', block: 'nova-chat' }, what: 'Nova itself — the last thing it said and a field to ask the next thing', module: 'nova', rank: 2, wide: true, height: { tile: 74 } },
    ] satisfies Binding[]
  ).map((b) => [b.id, b]),
);

export const BINDING_IDS: readonly string[] = Object.keys(BINDINGS);

export function bindingOf(id: string): Binding | undefined {
  return BINDINGS[id];
}

/** Every binding the install can bind right now, in table order. */
export function availableBindings(gate?: BindingGate | null): Binding[] {
  return Object.values(BINDINGS).filter((b) => !bindingAbsence(b, gate));
}

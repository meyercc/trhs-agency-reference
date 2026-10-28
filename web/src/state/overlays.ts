/**
 * Overlays (TH-438): small HUD cards the person places anywhere on screen and
 * keeps while playing — a frame-rate readout, temperatures, a DPI switcher.
 * Nova builds them from a request (TH-439); this is the model they are built
 * from and the store they live in (Settings `overlays`).
 *
 * An overlay is a titled list of ITEMS: a metric (read from the vitals
 * stream) or a control (the same bound control a Nova reply carries). Its
 * position is a free x/y in window pixels, persisted; hidden is a state, not
 * deletion, so "Place on screen" can bring one back.
 *
 * Since TH-443 that list is ALSO what a custom board widget is, so this file
 * owns the card in both of its homes: `CardSpec` is the shared part and
 * `OverlaySpec` is a card with a position. The VOCABULARY moved to
 * `state/bindings.ts` in TH-452 — one registry row per bindable piece of app
 * state — and the three META tables here are derived views over it for the
 * consumers that predate the registry.
 */
import { RECIPE_BLOCK_IDS } from '../agents/recipeBindings';
import {
  allowedFor,
  BINDINGS,
  bindingAbsence,
  defaultPresentation,
  heightOf,
  NARROW,
  type Binding,
  type BindingGate,
  type BlockId,
  type BoundItem,
  type DeviceNeed,
  type Presentation,
} from './bindings';

export type OverlayMetric = 'fps' | 'cpu' | 'cpu-temp' | 'gpu' | 'gpu-temp' | 'ram';
/**
 * The bound controls a card can carry (TH-450). Every one is the SAME control
 * bound to the SAME state as its home elsewhere in the app — the headset's
 * `audio.volume` through the device's profile bar, the fan curve through
 * Settings — so moving it on a card IS moving it there, and a device-scoped
 * value lands in the active profile's bag for that device (`useProfileValue`).
 *
 * Since TH-452 these three unions name the LEGACY item kinds: cards stored
 * before the registry existed carry them, and the tables below are derived
 * views over the registry rows of the same ids. New items are `bound`.
 */
export type OverlayControl =
  | 'dpi'
  | 'power-mode'
  | 'brightness'
  | 'eq-preset'
  | 'fan-curve'
  | 'volume'
  | 'headset-mic'
  | 'sidetone'
  | 'mic-gain'
  | 'mic-mix'
  | 'mic-headphones'
  | 'mic-monitor'
  | 'lights';
/**
 * App panels a card can hold (TH-450): things that are neither a reading nor a
 * control but are still live state — what you played, what is on sale, what
 * Nova has cost, Nova itself. `count` is how many rows a list block shows.
 */
export type OverlayBlock = BlockId;
/**
 * An item of a card or an overlay. Three legacy kinds (TH-438/443/450) and the
 * registry-bound kind (TH-452): a binding id plus how it is shown. `namedItemsIn`
 * emits only `bound` items now; the legacy kinds keep rendering for stored
 * cards and are aliased onto `bound` in a later phase.
 */
export type OverlayItem =
  | { kind: 'metric'; metric: OverlayMetric }
  | { kind: 'control'; control: OverlayControl }
  | { kind: 'block'; block: OverlayBlock; count?: number; subject?: string }
  | BoundItem;

export type { BoundItem, DeviceNeed, Presentation } from './bindings';

/**
 * What every item has to say about itself, so the parser, the card sizing, the
 * schema enum and the grounding block all read ONE row rather than four
 * hand-kept lists that drift. Since TH-452 this is DERIVED from a `Binding`
 * (`metaForBound`) — the registry is the source, this is its shape for the
 * eight consumers that predate it.
 */
export interface ItemMeta {
  label: string;
  /** Words that name it. Any one matching counts. */
  match: RegExp[];
  /** Only when this ALSO matches — "monitoring" means the mic's only beside the word mic. */
  requires?: RegExp;
  /** Never when this matches — "mic volume" is the headset's mic, unless "microphone" is named. */
  unless?: RegExp;
  /**
   * The item's rendered height in pixels at the card's two-column body width
   * (301px), MEASURED on the board rather than estimated — the first estimate
   * put two sliders in a one-row card and clipped the second by 9px, which is
   * the quiet kind of failure (gotcha 49). For a list block this is ONE row;
   * `cardMeta` multiplies by the count.
   */
  height: number;
  /** Takes the card's full width (controls, list blocks) rather than flowing 2-up (tiles). */
  wide: boolean;
  /** What it is, for the reply's first sentence — a block's answer to "the readings you asked for". */
  what?: string;
  /** Bound through the device's profile bar, so a change is saved to the active profile. */
  profile?: boolean;
  /** The device type it binds to. Absent = Settings or the app itself. */
  needs?: DeviceNeed;
  /** The module that must be installed for it to mean anything. */
  module?: string;
  /** The catalog widget that shows the same thing with more room — the "better" offer. */
  shownBy?: string;
  /** A reading's unit, where it has one. */
  unit?: string;
}

/** How a legacy/bound item of this binding is drawn when nothing chose otherwise. */
export function defaultFormOf(b: Binding): Presentation {
  if (b.source.kind === 'block') return b.count ? 'rows' : 'tile';
  if (b.source.kind === 'custom') return 'tile';
  return defaultPresentation(b) ?? 'tile';
}

/** The `ItemMeta` view of a binding shown a given way. */
export function metaForBound(b: Binding, as?: Presentation): ItemMeta {
  const form = as && allowedFor(b).includes(as) ? as : defaultFormOf(b);
  const wide = b.source.kind === 'custom' || b.wide || !NARROW.has(form);
  return {
    label: b.label,
    match: b.match,
    ...(b.requires ? { requires: b.requires } : {}),
    ...(b.unless ? { unless: b.unless } : {}),
    height: heightOf(b, form),
    wide,
    ...(b.what ? { what: b.what } : {}),
    ...(b.profile ? { profile: true } : {}),
    ...(b.needs ? { needs: b.needs } : {}),
    ...(b.module ? { module: b.module } : {}),
    ...(b.shownBy ? { shownBy: b.shownBy } : {}),
    ...(b.unit != null ? { unit: b.unit } : {}),
  };
}

/** The six readings' tile icons — a presentation detail, so it lives beside the renderer's table, not in the registry. */
const METRIC_ICON: Record<OverlayMetric, 'performance' | 'thermometer' | 'sensor'> = {
  fps: 'performance',
  cpu: 'performance',
  'cpu-temp': 'thermometer',
  gpu: 'performance',
  'gpu-temp': 'thermometer',
  ram: 'sensor',
};

const view = (id: string): ItemMeta => {
  const b = BINDINGS[id];
  if (!b) throw new Error(`overlays: legacy id ${id} has no binding row`);
  return metaForBound(b);
};

export const METRICS: OverlayMetric[] = ['fps', 'cpu', 'cpu-temp', 'gpu', 'gpu-temp', 'ram'];
export const CONTROLS: OverlayControl[] = ['dpi', 'power-mode', 'brightness', 'eq-preset', 'fan-curve', 'volume', 'headset-mic', 'sidetone', 'mic-gain', 'mic-mix', 'mic-headphones', 'mic-monitor', 'lights'];
export const BLOCKS: OverlayBlock[] = ['recent-games', 'deals', 'tokenomics', 'nova-chat', ...RECIPE_BLOCK_IDS];

/** Derived views over the registry (TH-452) — the eight pre-registry consumers read these. */
export const METRIC_META: Record<OverlayMetric, ItemMeta & { unit: string; icon: 'performance' | 'thermometer' | 'sensor' }> = Object.fromEntries(
  METRICS.map((m) => [m, { ...view(m), unit: BINDINGS[m].unit ?? '', icon: METRIC_ICON[m] }]),
) as Record<OverlayMetric, ItemMeta & { unit: string; icon: 'performance' | 'thermometer' | 'sensor' }>;
export const CONTROL_META: Record<OverlayControl, ItemMeta> = Object.fromEntries(CONTROLS.map((c) => [c, view(c)])) as Record<OverlayControl, ItemMeta>;
export const BLOCK_META: Record<OverlayBlock, ItemMeta & { count?: { default: number; max: number } }> = Object.fromEntries(
  BLOCKS.map((b) => [b, { ...view(b), ...(BINDINGS[b].count ? { count: BINDINGS[b].count } : {}) }]),
) as Record<OverlayBlock, ItemMeta & { count?: { default: number; max: number } }>;

/**
 * The shared half: a TITLED LIST of live readings, bound controls and app
 * panels, and nothing about where it sits (TH-443).
 *
 * An overlay is this plus a free position; a custom board widget is this plus
 * the board's own grid placement. Extracting it cost no migration in either
 * direction — every overlay ever stored already satisfied `CardSpec`, because
 * `CardSpec` is the four fields it already had. The placement is what differs,
 * and placement was never shared: the board sizes by `span`/`rows` from the
 * catalog, the overlay by `x`/`y` in window pixels.
 *
 * The point of the extraction is that `OverlayItems` renders a list, not a HUD
 * — so the same spec reads the same way in both homes with one vocabulary and
 * one validator behind it.
 */
export interface CardSpec {
  id: string;
  title: string;
  items: OverlayItem[];
  createdAt: number;
  /**
   * Board columns, where a card needs more than the default two (TH-478):
   * Pick Up Where You Left Off's rows carry a cover, two lines and a button,
   * and at two columns the title wrapped and every row's line was cut to its
   * first clause (measured 2026-10-19). Kept between 2 and 4 on read.
   */
  span?: number;
}

/** A card placed freely over the whole window (TH-438). */
export interface OverlaySpec extends CardSpec {
  /** Window pixels from the top-left. */
  x: number;
  y: number;
  visible: boolean;
}

/**
 * What an item needs from the install, as a gate the pure code can be handed:
 * the desk's device types and the installed modules. `layout.ts`'s
 * `AvailabilityGate` satisfies it structurally; the registry's `BindingGate`
 * is the same shape.
 */
export type ItemGate = BindingGate;

/**
 * Why an item cannot be bound right now, as the clause a reply says — or null
 * when it can. Two absences, the same two the board already honours: the device
 * it binds to is not on this desk, or the module it reads from is not
 * installed. With no gate the answer is "it can".
 */
export function itemAbsence(meta: Pick<ItemMeta, 'needs' | 'module'>, gate?: ItemGate | null): string | null {
  return bindingAbsence(meta, gate);
}

/** Every legacy item the install can bind right now, in table order. */
export function availableItems(gate?: ItemGate | null): { metrics: OverlayMetric[]; controls: OverlayControl[]; blocks: OverlayBlock[] } {
  return {
    metrics: METRICS.filter((m) => !itemAbsence(METRIC_META[m], gate)),
    controls: CONTROLS.filter((c) => !itemAbsence(CONTROL_META[c], gate)),
    blocks: BLOCKS.filter((b) => !itemAbsence(BLOCK_META[b], gate)),
  };
}

/** One item's row — a legacy table view, or the registry row a `bound` item names. */
export function itemMeta(item: OverlayItem): ItemMeta {
  if (item.kind === 'bound') {
    const b = BINDINGS[item.bind];
    // Unknown bindings are dropped by `normalizeItem` before anything renders;
    // reaching here with one is a programming error, not a stored-data case.
    if (!b) return { label: item.bind, match: [], height: heightOf({ height: {} } as Binding, 'tile'), wide: true };
    return metaForBound(b, item.as);
  }
  return item.kind === 'metric' ? METRIC_META[item.metric] : item.kind === 'control' ? CONTROL_META[item.control] : BLOCK_META[item.block];
}

/** The id a `Set` can dedupe on: `fps`, `volume`, `recent-games` — the binding, whatever the form. */
export function itemKey(item: OverlayItem): string {
  return item.kind === 'metric' ? item.metric : item.kind === 'control' ? item.control : item.kind === 'block' ? item.block : item.bind;
}

/** The registry row behind an item, legacy or bound. */
export function bindingOfItem(item: OverlayItem): Binding | undefined {
  return BINDINGS[itemKey(item)];
}

/**
 * A stored or proposed item, made safe — or null when nothing can render it.
 * A legacy kind must name a known id. A `bound` item must name a binding; an
 * `as` the binding does not allow is DROPPED, keeping the item, so a card
 * stored before a presentation was renamed loses the form, never the item.
 */
export function normalizeItem(x: unknown): OverlayItem | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.kind === 'metric') return METRICS.includes(o.metric as OverlayMetric) ? (x as OverlayItem) : null;
  if (o.kind === 'control') return CONTROLS.includes(o.control as OverlayControl) ? (x as OverlayItem) : null;
  if (o.kind === 'block') return BLOCKS.includes(o.block as OverlayBlock) ? (x as OverlayItem) : null;
  if (o.kind === 'bound' && typeof o.bind === 'string') {
    const b = BINDINGS[o.bind];
    if (!b) return null;
    const out: BoundItem = { kind: 'bound', bind: o.bind };
    if (typeof o.as === 'string' && allowedFor(b).includes(o.as as Presentation)) out.as = o.as as Presentation;
    if (b.count && Number.isFinite(o.count)) out.count = o.count as number;
    if (typeof o.subject === 'string' && o.subject.length <= 64) out.subject = o.subject;
    return out;
  }
  return null;
}

/** The items of a stored list, each made safe; bad entries fall out, the list stays. */
function normalizeItems(raw: unknown): OverlayItem[] {
  return Array.isArray(raw) ? raw.map(normalizeItem).filter((i): i is OverlayItem => !!i) : [];
}

/**
 * How many rows a list item shows, clamped to what it can. Stored as asked for,
 * so a card that said "my 3 games" still says three after a reload — but a
 * hand-edited 40 does not render forty rows. 0 for an item that is not a list.
 */
export function blockCount(item: OverlayItem): number {
  const c = bindingOfItem(item)?.count;
  if (!c) return 0;
  const asked = item.kind === 'block' || item.kind === 'bound' ? item.count : undefined;
  const n = Number.isFinite(asked) ? Math.round(asked as number) : c.default;
  return Math.max(1, Math.min(c.max, n));
}

/** How many 2-up tile slots a narrow item spends: the tokenomics panel is three tiles. */
export function narrowUnits(item: OverlayItem): number {
  return itemKey(item) === 'tokenomics' ? 3 : 1;
}

/** A stored list, or nothing — one bad entry drops that entry, not the list. */
export function normalizeOverlays(raw: unknown): OverlaySpec[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlaySpec[] = [];
  for (const o of raw as Partial<OverlaySpec>[]) {
    if (!o || typeof o.id !== 'string' || !Array.isArray(o.items)) continue;
    const items = normalizeItems(o.items);
    if (!items.length) continue;
    out.push({
      id: o.id,
      title: typeof o.title === 'string' && o.title ? o.title : titleFor(items),
      items,
      x: Number.isFinite(o.x) ? (o.x as number) : 24,
      y: Number.isFinite(o.y) ? (o.y as number) : 96,
      visible: o.visible !== false,
      createdAt: Number.isFinite(o.createdAt) ? (o.createdAt as number) : 0,
    });
  }
  return out;
}

/** Every item's label, in order — what both titles are built on. */
export function labelsFor(items: OverlayItem[]): string[] {
  return items.map((i) => itemMeta(i).label);
}

/** "FPS", "FPS + GPU temp", "DPI + 2 more" — the OVERLAY title's stem. */
export function headFor(items: OverlayItem[]): string {
  const names = labelsFor(items);
  return names.length <= 2 ? names.join(' + ') : `${names[0]} + ${names.length - 1} more`;
}

/**
 * A card's default title. Three labels rather than the overlay's two, because
 * this one is a WIDGET HEADER and has to stand on its own on the board — "FPS +
 * 2 more" is a fine name for a floating readout you just placed and a poor one
 * for a card you will see every day. Past three it collapses, or it outgrows
 * `.w-label` and ellipses to nothing.
 */
export function cardTitleFor(items: OverlayItem[]): string {
  const names = labelsFor(items);
  return names.length <= 3 ? names.join(' + ') : `${names.slice(0, 2).join(' + ')} + ${names.length - 2} more`;
}

/** "FPS overlay", "FPS + GPU temp overlay", "DPI overlay". */
export function titleFor(items: OverlayItem[]): string {
  return `${headFor(items)} overlay`;
}

export function newOverlay(items: OverlayItem[], title?: string): OverlaySpec {
  return { id: `ov-${Date.now().toString(36)}`, title: title ?? titleFor(items), items, x: 24, y: 96, visible: true, createdAt: Date.now() };
}

// ── Custom board widgets (TH-443) ────────────────────────────────────────────

/**
 * A custom card's id prefix. It is a prefix rather than a flag because the id
 * is the only thing a `BoardItem` carries, and the board has to answer "is this
 * one of mine?" from the id alone — in `normalizeLayout`, which is pure, and in
 * the drag code, which never sees the spec.
 */
export const CARD_PREFIX = 'card-';
export const isCardId = (id: string): boolean => id.startsWith(CARD_PREFIX);

/**
 * The cap on the store, and it is deliberately the BOARD's cap (`MAX_ITEMS`)
 * rather than a smaller, tidier number.
 *
 * A cap that could evict a card still on the board would be a silently
 * vanishing widget: `normalizeLayout` drops an id whose spec it cannot see, and
 * that read runs on every mount. At 16 that is impossible — the board itself
 * cannot hold more than 16 items — so eviction can only ever reach a card that
 * is off the board, in the picker's "Custom" group.
 *
 * Newest win, because the oldest card is the one least likely to be missed and
 * because `upsertCard` appends.
 */
export const MAX_CARDS = 16;

/** A stored list, or nothing — one bad entry drops that entry, not the list. */
export function normalizeCards(raw: unknown): CardSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: CardSpec[] = [];
  const seen = new Set<string>();
  for (const c of raw as Partial<CardSpec>[]) {
    if (!c || typeof c.id !== 'string' || !isCardId(c.id) || seen.has(c.id) || !Array.isArray(c.items)) continue;
    const items = normalizeItems(c.items);
    if (!items.length) continue;
    seen.add(c.id);
    out.push({
      id: c.id,
      title: typeof c.title === 'string' && c.title ? c.title : cardTitleFor(items),
      items,
      createdAt: Number.isFinite(c.createdAt) ? (c.createdAt as number) : 0,
      ...(Number.isInteger(c.span) && (c.span as number) > 2 ? { span: Math.min(4, c.span as number) } : {}),
    });
  }
  // The tail, not the head: see `MAX_CARDS`.
  return out.length > MAX_CARDS ? out.slice(-MAX_CARDS) : out;
}

/**
 * Minted once, where the reply is built — so pressing "Add to dashboard" twice
 * re-adds the same card rather than making two, exactly as `newOverlay` does.
 * The title carries no "overlay" suffix: on the board the shell's header IS the
 * title, and "FPS + GPU temp overlay" sitting in a widget header is a lie.
 */
export function newCard(items: OverlayItem[], title?: string): CardSpec {
  return { id: `${CARD_PREFIX}${Date.now().toString(36)}`, title: title ?? cardTitleFor(items), items, createdAt: Date.now() };
}


/** Where in the sentence an item was named — `leftoverWords` needs the span, not just the item. */
export interface NamedItem {
  item: OverlayItem;
  at: number;
  end: number;
}

/**
 * Every binding the text names, with where it was named. One row per registry
 * entry, so adding a control is adding a row, not a probe (TH-450); since
 * TH-452 every hit is a `bound` item at the binding's default form.
 *
 * Earliest mention first, one of each. The `unless`/`requires` gates are how
 * two devices share a word — "monitoring" is the headset's sidetone unless the
 * sentence is about the mic — and the metric lookaheads are how "cpu temp" is
 * not also "cpu".
 */
export function namedItemsIn(text: string): NamedItem[] {
  const found: NamedItem[] = [];
  for (const b of Object.values(BINDINGS)) {
    if (b.requires && !b.requires.test(text)) continue;
    if (b.unless && b.unless.test(text)) continue;
    let best: RegExpExecArray | null = null;
    for (const re of b.match) {
      const m = new RegExp(re.source, re.flags.replace('g', '')).exec(text);
      if (m && (!best || m.index < best.index)) best = m;
    }
    if (!best) continue;
    const item: BoundItem = { kind: 'bound', bind: b.id };
    if (b.count) item.count = countNear(text, best.index) ?? b.count.default;
    found.push({ item, at: best.index, end: best.index + best[0].length });
  }
  found.sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  return found.filter((f) => {
    const k = itemKey(f.item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The items alone — what the builders and the overlay parser read. */
export function itemsNamedIn(text: string): OverlayItem[] {
  return namedItemsIn(text).map((f) => f.item);
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
/** How far back from a block's name a count may sit: "my 3 most recently played games". */
const COUNT_WINDOW = 40;
/** A conjunction between a number and a block's name means the number was someone else's. */
const COUNT_STOP = new Set(['and', 'plus', 'with', 'also', 'then', 'or']);

/**
 * A count named just before `at` — "3 games", "three recent games", "top 5
 * deals" — or null. Digits or the small number words; nothing past eight,
 * because a card is not a list.
 */
export function countNear(text: string, at: number): number | null {
  const before = text.slice(Math.max(0, at - COUNT_WINDOW), at);
  const words = before.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    // "3 games and deals": the three belongs to the games, not the deals.
    if (COUNT_STOP.has(w)) return null;
    if (/^\d+$/.test(w)) return Number(w);
    if (w in NUMBER_WORDS) return NUMBER_WORDS[w];
  }
  return null;
}

/** The classic corner readout: frame rate and both temperatures. */
const DEFAULT_OVERLAY_ITEMS: OverlayItem[] = [
  { kind: 'bound', bind: 'fps' },
  { kind: 'bound', bind: 'cpu-temp' },
  { kind: 'bound', bind: 'gpu-temp' },
];

/**
 * What a request is asking for. "overlay" or "hud" must be in it; then every
 * metric and control it names. Nothing named means the classic corner readout.
 * Returns null when the text is not about an overlay at all.
 */
export function parseOverlayRequest(text: string): OverlayItem[] | null {
  if (!/\b(overlay|hud)\b/i.test(text)) return null;
  const items = itemsNamedIn(text);
  return items.length ? items : DEFAULT_OVERLAY_ITEMS;
}

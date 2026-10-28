/**
 * What a legal board layout IS — the one place that answers it.
 *
 * Pure: no React, no storage, no DOM. That is the point. These numbers used to
 * live inside `WidgetBoard.tsx`, so nothing could validate a layout without
 * importing a component, and the board's render site and `pack.ts` each had
 * their own idea of a legal size (which is how a stored span of 8 grew implicit
 * column tracks on a six-column grid — see `cellSize` in `pack.ts`).
 *
 * It exists now because a layout is about to arrive from somewhere other than
 * the board's own pointer code: Nova writes one (TH-442). Everything a drag can
 * produce is already legal by construction; an arbitrary array is not, and two
 * of the illegal shapes **freeze the tab with nothing thrown** rather than
 * failing visibly. `normalizeLayout` is the boundary, not a politeness pass.
 */
import { DEVICE_WIDGET_SKU, META_BY_ID, type BoardItem, type WidgetMeta } from './catalog';
import { WIDGET_MODULE } from '../modules/registry';
import { isOnDesk } from '../devices/connectedDevices';
import type { DeskDevice } from '../devices/arrangement';
import { cellSize } from './pack';
import type { MvpScope } from '../state/Settings';

/**
 * Board widgets that belong to what an MVP scope leaves out. June 2027 has no
 * OMEN hardware control (deck "Treehouse MVP Modules June 2027", slide 7), so
 * the Power Mode widget waits behind full scope the way the Performance page's card
 * does. Hidden, never deleted: switching back brings it back where it was.
 */
export const SCOPE_HIDDEN_WIDGETS: Record<MvpScope, ReadonlySet<string>> = {
  june27: new Set(['power']),
  full: new Set(),
};

export const COLS = 6;
/**
 * A wide PAGE grows by whole widgets (Chris, 2026-10-21): eight tracks where
 * eight of the 1100 grid's fit, ten where ten do (`W.board8` / `W.board10`,
 * app/breakpoints.ts — the same named widths shell.css grows the cap by). The
 * track never changes width, so every card keeps the size it was drawn at.
 * Replaces TH-440's eight-column band with slots beside the carousel.
 */
export const COLS_8 = 8;
export const COLS_10 = 10;
/** The widest the board gets: the cap a stored span is clamped against. */
export const COLS_MAX = COLS_10;
/**
 * The hero carousel's cell on the board (Chris, 2026-10-21): the 1100 grid's
 * six columns wide and two rows tall (344px), top-left, so the columns a wider
 * page adds pack widgets BESIDE it — a 2×2 widget at eight, a device card and
 * a one-row card at ten. Everything else flows around it first-fit.
 */
export const HERO_SPAN = COLS;
export const HERO_ROWS = 2;
/**
 * A compact page (2026-10-20): every span is at least MIN_SPAN, so two columns
 * is a phone's list of full-width widgets. A stored span wider than the page
 * is clamped by `cellSize` when drawn and kept as stored, the way a wide span
 * already survives a 1440 window. A medium page keeps the six: at 768 the
 * span-3 cards are a two-up that already read well, and four columns would
 * leave a hole beside each of them.
 */
export const COLS_COMPACT = 2;
export const MIN_SPAN = 2;
export const MAX_ROWS = 3;
/** The "Add a widget" cell. */
export const ADD_SPAN = 2;
/**
 * A board longer than this is not a dashboard, it is a list. The catalog is 27
 * ids, so this is also the guard against an array that repeats until it is
 * megabytes — a stored layout is parsed on every mount.
 */
export const MAX_ITEMS = 16;

/**
 * The three absences the board already honours, as data rather than as hooks,
 * so the board, the validator and the schema builder cannot disagree about what
 * is renderable. Mirrors `shownItems` in `WidgetBoard.tsx`.
 */
export interface AvailabilityGate {
  /** `useModules().has` */
  has: (moduleId: string) => boolean;
  /** `useSettings().deskDevices` */
  desk: readonly DeskDevice[];
  /** `(sku) => useDeviceSim().simState(sku).connected` */
  connected: (sku: string) => boolean;
  /**
   * The device TYPES on the desk (`headset`, `microphone`, …), for the card
   * items that bind to one (TH-450). `LiveControl` resolves "the headset" as the
   * first of its type on the desk roster regardless of the sim's plugged-in
   * state, so this is the roster's types, not the connected ones.
   */
  deviceTypes: readonly string[];
  /** `useSettings().mvpScope`; absent means nothing is out of scope. */
  scope?: MvpScope;
}

/**
 * Everything the pure functions below need to know about the install. TWO
 * independent halves, and keeping them apart is load-bearing:
 *
 *  - `cards` is VOCABULARY. A `card-*` id has no `RENDERERS` entry and no
 *    `META_BY_ID` row, so without this map nothing can size it, name it or even
 *    recognise it — and `normalizeLayout` would silently drop every custom card
 *    on the board's own read path, i.e. on every mount. It therefore belongs on
 *    every path, including the ones that must not gate.
 *  - `gate` is AVAILABILITY, and it is the half that is sometimes absent. Pass
 *    it on the Nova path, where an unavailable id must never be *offered*; omit
 *    it on the board's read path, where an unavailable id must be **kept** so
 *    reinstalling its module brings the widget back at its saved position.
 *
 * They used to be one flat object, which made "omit the context" mean both
 * things at once — and the second one arrived (TH-443) needing only the first.
 */
export interface LayoutContext {
  /** Custom card ids → their meta (TH-443), from `cardMetas()`. */
  cards?: ReadonlyMap<string, WidgetMeta>;
  gate?: AvailabilityGate;
}

/**
 * The size and name of an id, whether the catalog owns it or a custom card does.
 * One lookup, so a `card-*` id is a first-class board citizen rather than a
 * special case at each of the eight places that ask.
 */
export function metaFor(id: string, ctx?: LayoutContext): WidgetMeta | undefined {
  return META_BY_ID[id] ?? ctx?.cards?.get(id);
}

/** Does this id have something to render at all? */
export function isKnownWidget(id: string, ctx?: LayoutContext): boolean {
  return !!metaFor(id, ctx);
}

/**
 * What to call it — in prose, in an `aria-label`, in a diagram cell. Never an
 * id: the three board aria-labels used to fall back to the literal word
 * "widget", so a custom card's remove button said "Remove widget".
 */
export function nameFor(id: string, ctx?: LayoutContext): string {
  return metaFor(id, ctx)?.name ?? 'widget';
}

/**
 * Is this widget renderable RIGHT NOW? Three independent absences, each of which
 * hides a card without deleting it: its module was removed, its device was taken
 * off this desk by the Admin row, or its device is on the desk but unplugged.
 *
 * With no `gate` the question is only "is it known" — see `LayoutContext`. A
 * custom card has neither a module nor a device, so it is always available.
 */
export function isWidgetAvailable(id: string, ctx: LayoutContext): boolean {
  if (!isKnownWidget(id, ctx)) return false;
  const gate = ctx.gate;
  if (!gate) return true;
  if (gate.scope && SCOPE_HIDDEN_WIDGETS[gate.scope].has(id)) return false;
  const mod = WIDGET_MODULE[id];
  if (mod && !gate.has(mod)) return false;
  const sku = DEVICE_WIDGET_SKU[id];
  return !sku || (isOnDesk(sku, gate.desk) && gate.connected(sku));
}

/**
 * The ids a proposal may name, in catalog order. This feeds the JSON-schema
 * `enum`, which is why it matters that it is narrowed: inside an `enum` an
 * invalid id is not unlikely, it is impossible — the decoder cannot emit one.
 * Offering an unavailable id instead produces a card that renders as nothing.
 */
export function availableWidgetIds(ctx: LayoutContext): string[] {
  const ids = Object.keys(META_BY_ID).filter((id) => isWidgetAvailable(id, ctx));
  for (const id of ctx.cards?.keys() ?? []) if (isWidgetAvailable(id, ctx)) ids.push(id);
  return ids;
}

/**
 * A stored or model-shaped list → a renderable one. One bad entry drops that
 * entry, not the list (`normalizeOverlays` is the house idiom).
 *
 * **Never throws, and never returns an item that could hang the packer.** Size
 * goes through `cellSize`, which coerces rather than clamps, because
 * `Math.min(NaN, cols)` is NaN and a NaN span makes `pack.ts`'s unbounded row
 * loop spin forever with nothing logged.
 *
 * `ctx` carries two independent halves and the gating one is optional — see
 * `LayoutContext`. Pass `cards` on EVERY path (a `card-*` id is unknown without
 * it, and an unknown id is dropped); add `gate` only on the Nova path, where an
 * unavailable id must never be offered.
 */
export function normalizeLayout(raw: unknown, ctx?: LayoutContext): BoardItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardItem[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    // A stored `slot` (TH-440's band, retired 2026-10-21) is simply not read:
    // the card is a board card, at its position. Old boards load unchanged.
    const { id, span, rows } = entry as Partial<BoardItem>;
    if (typeof id !== 'string' || !isKnownWidget(id, ctx)) continue;
    // Duplicates are the nastiest shape: `pack.ts` keys `cells` by id, so the
    // second occurrence overwrites the first's placement while both footprints
    // stay reserved, React sees two children with one key, and dragging either
    // one deletes its twin. First occurrence wins (as `seedBoard` already does).
    if (seen.has(id)) continue;
    // Gated only where a gate was given: on the read path an unavailable widget
    // is KEPT, hidden by the board, and comes back at this position.
    if (ctx?.gate && !isWidgetAvailable(id, ctx)) continue;

    const meta = metaFor(id, ctx);
    // Clamped against the WIDEST board, not the current one: a span resized at
    // ten columns must survive a reload on a narrower page, where `cellSize`
    // clamps it when drawn and keeps it as stored.
    const size = cellSize(
      { span: span ?? meta?.span ?? MIN_SPAN, rows: rows ?? meta?.rows ?? 1 },
      COLS_MAX,
    );
    const item: BoardItem = { id, span: Math.max(MIN_SPAN, size.span), rows: Math.min(size.rows, MAX_ROWS) };

    seen.add(id);
    out.push(item);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Nova's proposal merged onto the board that exists — never an assignment.
 *
 * `WidgetBoard` hides rather than deletes a widget whose module was removed or
 * whose device is away, and promises that reinstalling brings it back AT ITS
 * SAVED POSITION. Twelve of the 27 catalog ids can be invisible at once, and a
 * model is only ever shown the visible ones — so assigning its proposal would
 * silently delete the rest, and the promise with them.
 *
 * So: the proposal is the new visible order, and every currently-invisible
 * item is kept.
 */
export function applyLayout(prev: readonly BoardItem[], next: readonly BoardItem[], ctx: LayoutContext): BoardItem[] {
  const proposal = normalizeLayout(next, ctx);
  const proposed = new Set(proposal.map((i) => i.id));
  // Kept, in their original relative order, after the proposal.
  const hidden = prev.filter((i) => !proposed.has(i.id) && !isWidgetAvailable(i.id, ctx));
  // Ungated — the whole point is to keep the hidden ones — but still carrying
  // the card vocabulary, or the merge would drop every custom card it kept.
  return normalizeLayout([...proposal, ...hidden], { cards: ctx.cards });
}

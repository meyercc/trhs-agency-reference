/**
 * What a custom card IS to the board (TH-443) — its name, its category and its
 * footprint — derived from the spec rather than stored beside it.
 *
 * Pure, and deliberately separate from `CustomWidget.tsx`: `state/Settings.tsx`
 * needs these sizes on its `boardLayout` read path, and a module that imported
 * the component would drag `OverlayHost` — which calls `useSettings()` — into
 * Settings' own import graph. The one runtime import is the vocabulary tables
 * in `state/overlays.ts`, which Settings already imports.
 *
 * Derived, not stored, because a stored size would be a second source of truth
 * for something already implied: a card's height follows from what it holds,
 * and if the person resizes it the board records that on the `BoardItem`,
 * where every other widget's resize is recorded.
 */
import { blockCount, itemMeta, narrowUnits, type CardSpec, type OverlayItem } from '../state/overlays';
import type { WidgetMeta } from './catalog';

/** The `.wb-pick` group a custom card is offered in. */
export const CARD_CAT = 'Custom';

/**
 * Two columns wide, which is the board's minimum (`MIN_SPAN`) and the size the
 * card was designed against: `.wb-card-items` lays the tiles out 2-up, so two
 * readings fill one row and the card is square-ish at any `cols`.
 */
export const CARD_SPAN = 2;
/**
 * The card body's geometry, measured on the board 2026-10-04 (TH-450). The
 * `.w` shell is 160px a row with 24px padding, a 19px header and its 11px
 * margin, so the body has 80px in a one-row card; each further row adds the
 * 160px row plus the 24px grid gap. Items sit 8px apart (`.wb-card-items`
 * gap); list rows 2px apart (`.cb-list`). A stat tile is 37px and flows 2-up.
 */
const BODY_FIRST_ROW = 80;
const BODY_PER_EXTRA_ROW = 184;
const ITEM_GAP = 8;
const LIST_ROW_GAP = 2;
const TILE = 37;
/** The board's own ceiling (`layout.ts` MAX_ROWS); past it the body clips. */
const MAX_CARD_ROWS = 3;

/**
 * How tall the body renders, in pixels — NOT the number of items. Narrow items
 * (metrics, the tokenomics tiles) flow 2-up; a wide one (a control, a list
 * block) takes the full width at its measured height, a list block once per
 * row it shows.
 */
export function bodyHeight(spec: CardSpec): number {
  return bodyHeightOf(spec.items);
}

/** The same, for a list of items — what `fitToRows` trims against. */
export function bodyHeightOf(items: readonly OverlayItem[]): number {
  let narrow = 0;
  let wide = 0;
  let wideCount = 0;
  for (const item of items) {
    const meta = itemMeta(item);
    if (!meta.wide) {
      // The tokenomics panel is three tiles, so it spends three narrow units.
      narrow += narrowUnits(item);
      continue;
    }
    const rows = Math.max(1, blockCount(item));
    wide += rows * meta.height + (rows - 1) * LIST_ROW_GAP;
    wideCount++;
  }
  const tileRows = Math.ceil(narrow / 2);
  const blocks = wideCount + tileRows;
  return wide + tileRows * TILE + Math.max(0, blocks - 1) * ITEM_GAP;
}

/** The tallest body a card can have: three board rows (`layout.ts` MAX_ROWS). Past it the body clips, silently. */
export const MAX_BODY_PX = BODY_FIRST_ROW + (MAX_CARD_ROWS - 1) * BODY_PER_EXTRA_ROW;

/**
 * Items that fit in three rows (TH-452). The model may propose six items with a
 * 209px fan curve among them; `boardRowsFor` clamps at three rows and the body
 * clips without a word, so the tail is dropped until the body fits. The first
 * `keep` items — what the person's own sentence named — are never dropped.
 */
export function fitToRows(items: readonly OverlayItem[], keep = 0): OverlayItem[] {
  const out = [...items];
  while (out.length > Math.max(1, keep) && bodyHeightOf(out) > MAX_BODY_PX) out.pop();
  return out;
}

/** Board rows for a body of `px`. */
export function boardRowsFor(px: number): number {
  if (px <= BODY_FIRST_ROW) return 1;
  return Math.min(MAX_CARD_ROWS, 1 + Math.ceil((px - BODY_FIRST_ROW) / BODY_PER_EXTRA_ROW));
}

export function cardMeta(spec: CardSpec): WidgetMeta {
  return {
    id: spec.id,
    name: spec.title,
    cat: CARD_CAT,
    span: spec.span ?? CARD_SPAN,
    rows: boardRowsFor(bodyHeight(spec)),
  };
}

/**
 * The card vocabulary as the board, the validator and the schema builder all
 * want it: id → meta, so `metaFor` can answer for a `card-*` id exactly the way
 * `META_BY_ID` answers for a catalog one.
 */
export function cardMetas(cards: readonly CardSpec[]): Map<string, WidgetMeta> {
  return new Map(cards.map((c) => [c.id, cardMeta(c)]));
}

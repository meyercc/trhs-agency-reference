/**
 * Did I Just Waste My Money's board blocks (TH-484), as binding rows — the
 * pure half of its recipe. Spread into `BINDINGS` through
 * `agents/recipeBindings.ts`, so this file must stay loadable in plain Node:
 * no components, no `data/refunds.ts` (the renderer reads it,
 * `nova/refundRecipe.tsx`).
 */
import type { Binding } from '../state/bindings';

export const REFUND_BLOCKS = ['refunds', 'refund-watch'] as const;
export type RefundBlockId = (typeof REFUND_BLOCKS)[number];

export const REFUND_BINDINGS: Binding[] = [
  {
    id: 'refunds',
    label: 'Refund windows',
    domain: 'games',
    valueType: 'records',
    // The LIST — plural, or "what can I return". The one-clock monitor below
    // takes the singular, so "refund window overlay" is that and not both.
    match: [/\b(refund windows|return windows|refunds|(everything|what) (i )?(can|could) (still )?(return|refund)|still refundable)\b/i],
    source: { kind: 'block', block: 'refunds' },
    what: 'your recent purchases and how long each store still lets you refund them — playtime and days left, with Refund on each',
    count: { default: 3, max: 3 },
    rank: 2,
    height: { rows: 64 }, // Catch Me Up's row: same cover and two-line clamp — re-measured on the board for TH-484
  },
  {
    id: 'refund-watch',
    label: 'Refund window',
    domain: 'games',
    valueType: 'records',
    match: [/\b(refund (window|timer|clock|countdown)(?!s)|time left (to|for) (a )?(refund|return)|minutes? left to refund)\b/i],
    source: { kind: 'block', block: 'refund-watch' },
    what: 'the refund window that matters now — the game you are playing, or the one closing soonest — with playtime and days left, live',
    // One clock, so a count of one: a records block is sized as count × its
    // `rows` height, and without a count it was sized as nothing.
    count: { default: 1, max: 1 },
    rank: 2,
    height: { rows: 203 }, // measured on the board 2026-10-20 at span 2: the bare card (cover row + two meters) — two board rows
  },
];

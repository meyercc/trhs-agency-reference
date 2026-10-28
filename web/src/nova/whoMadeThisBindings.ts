/**
 * Who Made This's board block (docs/who-made-this-demo-plan.md), as a binding
 * row — the pure half of its recipe. Spread into `BINDINGS` through
 * `agents/recipeBindings.ts`, so this file must stay loadable in plain Node:
 * no components, no `data/credits.ts` (the renderer reads it,
 * `nova/whoMadeThisRecipe.tsx`).
 */
import type { Binding } from '../state/bindings';

export const WHO_MADE_THIS_BLOCKS = ['credits'] as const;
export type WhoMadeThisBlockId = (typeof WHO_MADE_THIS_BLOCKS)[number];

export const WHO_MADE_THIS_BINDINGS: Binding[] = [
  {
    id: 'credits',
    label: 'Cast & crew',
    domain: 'games',
    valueType: 'records',
    // The placed version only. "Who's in X" and "who made X" are REPLIES, so
    // this takes the card words — "cast and crew overlay", "credits widget".
    match: [/\b((cast (and|&) crew|credits|who made (it|this)) (as an? )?(widget|overlay|card|hud))\b/i],
    source: { kind: 'block', block: 'credits' },
    what: 'one game’s cast and crew, kept in view — the voices and who they play, and the people behind it',
    count: { default: 1, max: 1 },
    rank: 3,
    height: { rows: 257 }, // measured on the board 2026-10-26 at span 2: the summary (cover row, two cast rows, the crew line) — two board rows
  },
];

/**
 * Catch Me Up's board blocks (TH-478), as binding rows — the pure half of its
 * recipe. `state/bindings.ts` spreads these into `BINDINGS` through
 * `agents/recipeBindings.ts`, so this file must stay loadable in plain Node
 * (measure-nova.mjs): no components, no `data/catchUp.ts` (its rows are read
 * in the renderer, `nova/catchUpRecipe.tsx`).
 */
import type { Binding } from '../state/bindings';

export const CATCH_UP_BLOCKS = ['catch-up', 'catch-up-recap'] as const;
export type CatchUpBlockId = (typeof CATCH_UP_BLOCKS)[number];

export const CATCH_UP_BINDINGS: Binding[] = [
  // The games you drifted from, each with its days away, a spoiler-safe line and Resume.
  {
    id: 'catch-up',
    label: 'Pick up where you left off',
    domain: 'games',
    valueType: 'records',
    match: [/\b(catch(?:es)? me up|caught up|(?:where )?i left off|drifted (?:away )?from|games? i haven['’]?t played)\b/i],
    source: { kind: 'block', block: 'catch-up' },
    what: 'the games you have drifted from — how long it has been, where you were and what changed, with Resume on each',
    count: { default: 3, max: 3 },
    rank: 2,
    height: { rows: 64 }, // a cover-height row, two-line clamp — board probe 2026-10-19 at 250 and 211px wide
  },
  {
    id: 'catch-up-recap',
    label: 'Catch me up',
    domain: 'games',
    valueType: 'records',
    // One game's recap. Its own phrasings only, so "catch me up on X" (a
    // REPLY) and "everything I've drifted from" (the list card) stay theirs.
    match: [/\b(recap (card|widget|overlay)|(catch[- ]me[- ]up|recap) (as an? )?(widget|overlay|card))\b/i],
    source: { kind: 'block', block: 'catch-up-recap' },
    what: 'one game’s spoiler-safe recap, kept in view — where you were, what is next and what changed',
    count: { default: 1, max: 1 },
    rank: 3,
    height: { rows: 231 }, // measured on the board 2026-10-20 at span 2: the summary recap — two board rows
  },
];

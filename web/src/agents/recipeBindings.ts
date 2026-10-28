/**
 * The board blocks every Nova recipe brings, as binding rows — layer 1 of 3 of
 * an agent's recipe (see `agents/recipes.tsx` for the map). Pure data, loadable
 * in plain Node: `state/bindings.ts` spreads `RECIPE_BINDINGS` into its table,
 * and `measure-nova.mjs` loads that table without a browser.
 *
 * Adding an agent with blocks: its own `<agent>Bindings.ts` beside its scripts,
 * then one line in each list here. `verify-agents` fails if a block declared
 * here has no renderer in the agent's UI recipe, or the other way round.
 */
import type { Binding } from '../state/bindings';
import { CATCH_UP_BINDINGS, CATCH_UP_BLOCKS, type CatchUpBlockId } from '../nova/catchUpBindings';
import { REFUND_BINDINGS, REFUND_BLOCKS, type RefundBlockId } from '../nova/refundBindings';
import { WHO_MADE_THIS_BINDINGS, WHO_MADE_THIS_BLOCKS, type WhoMadeThisBlockId } from '../nova/whoMadeThisBindings';

export type RecipeBlockId = CatchUpBlockId | RefundBlockId | WhoMadeThisBlockId;

/** Block ids per agent — the dashboard pieces each recipe owns. */
export const RECIPE_BLOCKS: Record<string, readonly RecipeBlockId[]> = {
  'catch-me-up': CATCH_UP_BLOCKS,
  'did-i-just-waste-my-money': REFUND_BLOCKS,
  'who-made-this': WHO_MADE_THIS_BLOCKS,
};

export const RECIPE_BLOCK_IDS: readonly RecipeBlockId[] = Object.values(RECIPE_BLOCKS).flat();

export const RECIPE_BINDINGS: Binding[] = [...CATCH_UP_BINDINGS, ...REFUND_BINDINGS, ...WHO_MADE_THIS_BINDINGS];

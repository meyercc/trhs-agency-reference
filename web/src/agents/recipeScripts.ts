/**
 * How a sentence reaches a Nova recipe — layer 2 of 3 of an agent's recipe
 * (see `agents/recipes.tsx` for the map). `send()` (state/Nova.tsx) asks
 * `recipeScriptFor` before the card/layout builders and the model, so a
 * recipe's lines are always its own scripted, checked reply.
 *
 * Kept apart from the UI layer on purpose: state/Nova imports this, and the
 * UI layer imports the demo resets, which import state/Nova — one file for
 * both would be an import cycle.
 *
 * ORDER IS PRIORITY: the first recipe whose `scriptFor` answers wins. Catch Me
 * Up comes first (its press-demo lines must never reach anything else); the
 * refund agent's "Catch Me Up still answers its line" check relies on it.
 */
import type { NovaScript } from '../nova/scripts';
import { catchUpScripts } from '../nova/catchUp';
import { refundScripts } from '../nova/refunds';
import { whoMadeThisScripts } from '../nova/whoMadeThis';
import { autocastScripts } from '../nova/autocast';
import type { AutocastSnapshot } from '../state/Autocast';

/** What a recipe's scripts may read from the running app. */
export interface RecipeCtx {
  /** Minutes played of a game, live (state/Playtime) — the refund agent's clock. */
  playedMin: (gameId: string) => number;
  /**
   * Added from Forge (state/Agents `has`)? A recipe that is not added does not
   * answer — Forge's Add / Remove is the switch (Chris, 2026-10-26).
   */
  added: (agentId: string) => boolean;
  /** Where Autocast's session is (state/Autocast.tsx `snapshotOf`) — its scripts answer by phase, with the real figures (TH-509). */
  autocast: AutocastSnapshot;
}

export interface RecipeScripts {
  /** The agent's registry id (`AGENT_BY_ID`). */
  id: string;
  /** The scripted reply for a line, or null to let the next recipe try. */
  scriptFor: (text: string, ctx: RecipeCtx) => NovaScript | null;
  /**
   * What NOVA says — as Nova, no `agentId` — when a line belongs to this
   * recipe and it is NOT added (TH-509): the pitch, pointing at Forge, and
   * the consent that adds it. Forge's Add stays the switch: nothing answers
   * AS the agent until it is added. Tried in the same priority loop.
   */
  pitchFor?: (text: string, ctx: RecipeCtx) => NovaScript | null;
  /**
   * Lines it must answer as itself — the demo's own. verify-agents types each
   * one into Nova and checks this agent is who replies, through every recipe
   * listed before it.
   */
  examples: string[];
}

export const RECIPE_SCRIPTS: readonly RecipeScripts[] = [catchUpScripts, refundScripts, whoMadeThisScripts, autocastScripts];

/** The first ADDED recipe's reply to `text` — or a not-added one's pitch — or null. */
export function recipeScriptFor(text: string, ctx: RecipeCtx): NovaScript | null {
  for (const r of RECIPE_SCRIPTS) {
    const s = ctx.added(r.id) ? r.scriptFor(text, ctx) : r.pitchFor?.(text, ctx) ?? null;
    if (s) return s;
  }
  return null;
}

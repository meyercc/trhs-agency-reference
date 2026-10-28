/**
 * The Nova recipe manifest (2026-10-26). A recipe is an agent that has been
 * BUILT — Nova answers as it with scripted, checked replies — as opposed to an
 * agent that only has a catalog entry and a persona. Every recipe is listed in
 * the Forge store, and Forge's Add / Remove is its switch (Chris, 2026-10-26):
 * removed there, it stops answering (agents/recipeScripts.ts reads `added`),
 * its entry points elsewhere disappear and its watcher stands down. The built
 * stories are added on a first run (`addedByDefault` in the registry).
 *
 * An agent's recipe is three layers, each one line in its own list, because
 * each is imported somewhere the others cannot be:
 *
 *   1. Blocks  agents/recipeBindings.ts — its board blocks as binding rows.
 *              Pure data; state/bindings.ts spreads them (plain-Node loadable).
 *   2. Routing agents/recipeScripts.ts — `scriptFor(text, ctx)`; state/Nova
 *              asks it first, in list order.
 *   3. UI      this file — the cards its replies draw, its block renderers,
 *              its demo reset, and any watcher that speaks first.
 *
 * And outside the recipe, as for every agent: a registry entry
 * (agents/registry.ts, with the Forge `type`), a persona (nova/personas.ts),
 * and a Forge listing (forge/listings.ts). `scripts/verify-agents.mjs` checks
 * all of it lines up. The `nova-agent` skill has the steps.
 */
import type { ComponentType } from 'react';
import type { OverlayItem } from '../state/overlays';
import type { GameAction, GameActionCtx } from './gameActions';
import type { RecipeBlockId } from './recipeBindings';
import { catchUpRecipe } from '../nova/catchUpRecipe';
import { refundRecipe } from '../nova/refundRecipe';
import { whoMadeThisRecipe } from '../nova/whoMadeThisRecipe';
import { autocastRecipe } from '../nova/autocastRecipe';
import type { StatusTone } from '../components';

export type RecipeBlockItem = Extract<OverlayItem, { kind: 'block' }>;

export interface RecipeDemo {
  /** `#/?demo=<id>` runs the reset. */
  id: string;
  /** The button in Nova's settings popover. */
  label: string;
  /** What the reset leaves, under the button. */
  note: string;
  /** Where the button takes you after resetting. */
  landing: string;
  /** A hook returning the reset. Called unconditionally, in manifest order. */
  useReset: () => () => void;
}

export interface AgentRecipe {
  /** The agent's registry id (`AGENT_BY_ID`), as its scripts' `agentId`. */
  id: string;
  /** The cards its replies draw, by the name an `agent-card` step gives. Props are the step's JSON. */
  cards: Record<string, ComponentType<any>>;
  /** A renderer for each block it declares in agents/recipeBindings.ts. */
  blocks: Partial<Record<RecipeBlockId, ComponentType<{ item: RecipeBlockItem }>>>;
  demo?: RecipeDemo;
  /** Mounted once in AppShell, always: watchers that let the agent speak first. */
  watchers?: ComponentType[];
  /**
   * The rows it adds to a game's detail panel (TH-504; agents/gameActions.ts):
   * none when the game is not one it knows. Shown only while the agent is
   * added from Forge — the panel applies the gate.
   */
  gameActions?: (ctx: GameActionCtx) => GameAction[];
  /**
   * A word on the Nova panel's status line while the agent is mid-story
   * (TH-509: "Autocast · recording 12:34"). A hook, called unconditionally in
   * manifest order; null when there is nothing to say.
   */
  useStatus?: () => { text: string; tone: StatusTone } | null;
}

/**
 * Read at render time, never at module load: the UI layer sits in an import
 * cycle (a demo reset reaches the widget catalog, which reaches CardBlock,
 * which reads this), so a top-level `const RECIPES = [catchUpRecipe, …]` could
 * run before those modules finish and throw. Functions defer the read.
 */
export function recipes(): readonly AgentRecipe[] {
  return [catchUpRecipe, refundRecipe, whoMadeThisRecipe, autocastRecipe];
}

export function recipeById(id: string): AgentRecipe | undefined {
  return recipes().find((r) => r.id === id);
}

/** A recipe block's renderer — CardBlock's fallthrough. */
export function recipeBlockRender(block: string): ComponentType<{ item: RecipeBlockItem }> | undefined {
  for (const r of recipes()) {
    const C = r.blocks[block as RecipeBlockId];
    if (C) return C;
  }
  return undefined;
}

export function recipeWatchers(): ComponentType[] {
  return recipes().flatMap((r) => r.watchers ?? []);
}

export function recipeDemos(): RecipeDemo[] {
  return recipes().flatMap((r) => (r.demo ? [r.demo] : []));
}

/**
 * Every recipe's demo reset, by demo id. Calls each `useReset` in manifest
 * order on every render — the list is fixed, so the hook order never changes.
 */
/** Every recipe's status line, in manifest order — the panel shows the first. Fixed list, stable hook order. */
export function useRecipeStatuses(): { text: string; tone: StatusTone }[] {
  const out: { text: string; tone: StatusTone }[] = [];
  for (const r of recipes()) {
    const s = r.useStatus?.() ?? null;
    if (s) out.push(s);
  }
  return out;
}

export function useRecipeDemoResets(): Record<string, () => void> {
  const out: Record<string, () => void> = {};
  for (const d of recipeDemos()) out[d.id] = d.useReset();
  return out;
}

/**
 * What every Nova recipe's scripts and demo reset share, so a new agent
 * composes these instead of copying them from the last one (Catch Me Up and
 * the refund agent had a copy each). No React and no store: scripts and
 * resets both import it.
 */
import { GAMES } from '../data/games';
import { newCard, newOverlay, type OverlayItem } from '../state/overlays';
import type { AgentCardRef, NovaScript, ScriptStep } from '../nova/scripts';

/** A game's display title from its catalog id (the id itself if unknown). */
export function titleOf(gameId: string): string {
  return GAMES.find((g) => g.id === gameId)?.title ?? gameId;
}

/** A step that shows one of the recipe's own cards in the reply. */
export function agentCardStep(agent: string, card: string, props: AgentCardRef['props'], delay?: number): ScriptStep {
  return { control: 'agent-card', agentCard: { agent, card, props }, ...(delay != null ? { delay } : {}) };
}

/**
 * Keep it in view (Chris, 2026-10-20): "Add to dashboard" and "Show as overlay"
 * for the same items, minted once per reply so pressing a chip twice re-adds
 * the same card instead of making two.
 */
export function keepInViewOffers(items: OverlayItem[], title: string, delay?: number): ScriptStep[] {
  return [
    { offer: { type: 'addCard', spec: newCard(items, title) }, label: 'Add to dashboard', ...(delay != null ? { delay } : {}) },
    { offer: { type: 'placeOverlay', spec: newOverlay(items, title) }, label: 'Show as overlay' },
  ];
}

/** The fields a scripted recipe reply always sets. */
export function recipeScript(agent: string, id: string, logText: string, steps: ScriptStep[]): NovaScript {
  return { id, kind: 'phrase', match: [], agentId: agent, logText, steps };
}

type CardLike = { title: string; items: readonly { kind: string; bind?: string; block?: string }[] };

/**
 * A card or overlay a rehearsal built: titled as the recipe's finale, or
 * holding one of the recipe's blocks — by what it holds, so a renamed one
 * still goes when the demo resets.
 */
export function isRehearsal(c: CardLike, title: string, blocks: readonly string[]): boolean {
  return c.title === title || c.items.some((i) => blocks.includes(i.bind ?? '') || blocks.includes(i.block ?? ''));
}

/**
 * Who Made This's UI recipe (docs/who-made-this-demo-plan.md) — layer 3 of its
 * recipe (agents/recipes.tsx): the credits and person cards its replies draw,
 * its one board block, and the demo reset. Its scripts are
 * `nova/whoMadeThis.ts`; its binding row `nova/whoMadeThisBindings.ts`.
 */
import { CREDITS_BY_ID, HERO_CREDITS } from '../data/credits';
import { useWhoMadeThisDemoReset } from '../demo/whoMadeThisDemo';
import type { AgentRecipe, RecipeBlockItem } from '../agents/recipes';
import { CreditsCard } from './CreditsCard';
import { PersonCard } from './PersonCard';
import { WHO_MADE_THIS_AGENT } from './whoMadeThis';

/** The cast & crew summary, placed — for the game it was made for. */
function CreditsBlock({ item }: { item: RecipeBlockItem }) {
  return (
    <div className="cb-block" data-block="credits">
      <CreditsCard gameId={item.subject ?? HERO_CREDITS.gameId} section="summary" bare />
    </div>
  );
}

export const whoMadeThisRecipe: AgentRecipe = {
  id: WHO_MADE_THIS_AGENT,
  cards: { credits: CreditsCard, person: PersonCard },
  blocks: { credits: CreditsBlock },
  demo: {
    id: 'who-made-this',
    label: 'Reset Who Made This demo',
    note: 'Play held on the Cyberpunk 2077 slide, Nova unpinned with the model off, no rehearsal cards.',
    // `?playing=` holds the hero on that slide (TH-478), so the rail button asks about the demo's game.
    landing: `/play?playing=${HERO_CREDITS.gameId}`,
    useReset: useWhoMadeThisDemoReset,
  },
  // The game panel's row (TH-504): the hero rail's line, answered with the
  // people — cast first, then the crew.
  gameActions: ({ game, ask, pinNova }) => {
    if (!CREDITS_BY_ID[game.id] || !ask) return [];
    return [
      {
        id: 'who-made-this:credits',
        label: "Who's in this?",
        description: 'The voice cast, and who made it',
        icon: 'microphone',
        kind: 'button',
        onPress: () => {
          pinNova();
          ask(`Who made ${game.title}?`);
        },
      },
    ];
  },
};

/**
 * Catch Me Up's UI recipe (TH-478) — layer 3 of its recipe (agents/recipes.tsx):
 * the recap card its replies draw, its two board blocks, and the press demo's
 * reset. Its scripts are `nova/catchUp.ts`; its binding rows
 * `nova/catchUpBindings.ts`.
 */
import { Button, ListItem } from '../components';
import { CATCH_UP, CATCH_UP_BY_ID, daysAway } from '../data/catchUp';
import { GAMES, type Game } from '../data/games';
import { useCatchUpDemoReset } from '../demo/catchUpDemo';
import { useNova } from '../state/Nova';
import { blockCount } from '../state/overlays';
import type { AgentRecipe, RecipeBlockItem } from '../agents/recipes';
import { CATCH_UP_AGENT } from './catchUp';
import { RecapCard } from './RecapCard';

/**
 * The games you drifted from, each with its days away, a spoiler-safe line and
 * Resume.
 *
 * A list, not a listbox like CardBlock's `GameRows`: each row holds its own
 * button, and a button inside an option is an interactive control nested in
 * another. So the rows are plain list items, out of the tab order, and Resume
 * is the control — a pointer on the row resumes too, as a larger target for
 * the same act.
 */
function CatchUpBlock({ item }: { item: RecipeBlockItem }) {
  const { perform } = useNova();
  const rows = CATCH_UP.slice(0, blockCount(item))
    .map((e) => ({ e, g: GAMES.find((g) => g.id === e.gameId) }))
    .filter((r): r is { e: (typeof CATCH_UP)[number]; g: Game } => !!r.g);
  const resume = (g: Game) => perform({ type: 'resumeGame', gameId: g.id }, `Resume ${g.title}`);
  return (
    <div className="cb-block cb-list" role="list" aria-label="Pick up where you left off" data-block="catch-up">
      {rows.map(({ e, g }) => {
        const updates = e.changes.length;
        return (
          <ListItem
            key={g.id}
            className="cb-catchup-row"
            role="listitem"
            tabIndex={undefined}
            leading={<img className="cb-cover cb-catchup-cover" src={g.art} alt="" />}
            label={g.title}
            description={`${daysAway(e)} days away${updates ? ` · ${updates} new` : ''}. ${e.oneLiner}`}
            trailing={
              <Button
                size="sm"
                aria-label={`Resume ${g.title}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  resume(g);
                }}
                onPointerDown={(ev) => ev.stopPropagation()}
              >
                Resume
              </Button>
            }
            onClick={() => resume(g)}
          />
        );
      })}
    </div>
  );
}

/** The summary recap, placed — for the game it was made for. */
function RecapBlock({ item }: { item: RecipeBlockItem }) {
  return (
    <div className="cb-block" data-block="catch-up-recap">
      <RecapCard gameId={item.subject ?? CATCH_UP[0].gameId} section="summary" bare />
    </div>
  );
}

export const catchUpRecipe: AgentRecipe = {
  id: CATCH_UP_AGENT,
  cards: { recap: RecapCard },
  blocks: { 'catch-up': CatchUpBlock, 'catch-up-recap': RecapBlock },
  demo: {
    id: 'catch-up',
    label: 'Reset Catch Me Up demo',
    note: 'Home on Work, Last Played in view, the model off, and the Night City profile ready for Resume.',
    landing: '/',
    useReset: useCatchUpDemoReset,
  },
  // The game panel's row (TH-504): the same line Last Played's button sends.
  gameActions: ({ game, ask, pinNova }) => {
    const e = CATCH_UP_BY_ID[game.id];
    if (!e || !ask) return [];
    return [
      {
        id: 'catch-me-up:recap',
        label: 'Catch me up',
        description: `${daysAway(e)} days away — where you were, spoiler-safe`,
        icon: 'hourglass',
        kind: 'button',
        onPress: () => {
          pinNova();
          ask(`Catch me up on ${game.title}`);
        },
      },
    ];
  },
};

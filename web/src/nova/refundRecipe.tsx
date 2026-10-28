/**
 * Did I Just Waste My Money's UI recipe (TH-484) — layer 3 of its recipe
 * (agents/recipes.tsx): the refund card its replies draw, its two board
 * blocks, the demo reset, and the watch that lets it speak first. Its scripts
 * are `nova/refunds.ts`; its binding rows `nova/refundBindings.ts`.
 */
import { Button, ListItem } from '../components';
import { GAMES, type Game } from '../data/games';
import { PURCHASES, STORES, fmtMinutes, windowFor } from '../data/refunds';
import { RefundWatch } from '../app/RefundWatch';
import { useRefundDemoReset } from '../demo/refundDemo';
import { useNova } from '../state/Nova';
import { blockCount } from '../state/overlays';
import { usePlaytime } from '../state/Playtime';
import { useSettings } from '../state/Settings';
import type { AgentRecipe, RecipeBlockItem } from '../agents/recipes';
import { RefundCard, RefundWatchCard } from './RefundCard';
import { REFUND_AGENT } from './refunds';

/**
 * Refund windows: recent purchases, each with what its store's rule leaves
 * you. Live — it reads the playtime clock, so a game being played counts down
 * here too. The state is words in the description ("17 min of playtime
 * left"), never only a colour. Refund pins Nova and asks the agent for that
 * game's steps, as Last Played's "Catch me up" does.
 */
function RefundsBlock({ item }: { item: RecipeBlockItem }) {
  const { send } = useNova();
  const { setNovaPinned } = useSettings();
  const { playedMin } = usePlaytime();
  const rows = PURCHASES.slice(0, blockCount(item))
    .map((p) => ({ p, g: GAMES.find((g) => g.id === p.gameId), w: windowFor(p, playedMin(p.gameId)) }))
    .filter((r): r is { p: (typeof PURCHASES)[number]; g: Game; w: ReturnType<typeof windowFor> } => !!r.g);
  const refund = (g: Game) => {
    setNovaPinned(true);
    send(`How do I refund ${g.title}?`);
  };
  return (
    <div className="cb-block cb-list" role="list" aria-label="Refund windows" data-block="refunds">
      {rows.map(({ p, g, w }) => {
        const rule = STORES[p.store];
        // Only the limit that will close it first — the row is one line at
        // three columns; the agent's own card carries both.
        const left = !w.open
          ? 'window closed'
          : w.closesBy === 'playtime' && w.minutesLeft != null
            ? `${fmtMinutes(w.minutesLeft)} of playtime left`
            : `${w.daysLeft} ${w.daysLeft === 1 ? 'day' : 'days'} left`;
        return (
          <ListItem
            key={g.id}
            className="cb-catchup-row"
            role="listitem"
            tabIndex={undefined}
            leading={<img className="cb-cover cb-catchup-cover" src={g.art} alt="" />}
            label={g.title}
            description={`${rule.short} · ${left}`}
            data-refund={g.id}
            trailing={
              w.open ? (
                <Button
                  size="sm"
                  aria-label={`How to refund ${g.title}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    refund(g);
                  }}
                  onPointerDown={(ev) => ev.stopPropagation()}
                >
                  Refund
                </Button>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}

/** The agent's own card, frameless — one look on the board and in the HUD. */
function WatchBlock() {
  return (
    <div className="cb-block" data-block="refund-watch">
      <RefundWatchCard />
    </div>
  );
}

export const refundRecipe: AgentRecipe = {
  id: REFUND_AGENT,
  cards: { refund: RefundCard },
  blocks: { refunds: RefundsBlock, 'refund-watch': WatchBlock },
  demo: {
    id: 'refund',
    label: 'Reset refund demo',
    note: 'The agent added, Monster Hunter Wilds at 1 h 43 min played on Steam, nothing playing, the model off.',
    landing: '/play',
    useReset: useRefundDemoReset,
  },
  watchers: [RefundWatch],
};

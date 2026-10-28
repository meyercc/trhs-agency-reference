import { Button, GameTile, LeadTile } from '../components';
import { SectionHeader } from './SectionHeader';
import { RECENT, RECENT_ACTIVITY, daysAgoLabel, type Game } from '../data/games';
import { PURCHASE_BY_ID } from '../data/refunds';
import { useOpenGame } from '../app/gamePanelRequest';
import { useLaunchGame } from '../state/launchGame';
import { usePlaytimeOptional } from '../state/Playtime';

/** "9 hours" / "1 hour" / "43 min" — playtime as the lead tile says it. */
function playTime(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.round(min / 60);
  return `${h} ${h === 1 ? 'hour' : 'hours'}`;
}

/**
 * "Featured" — the third top of the Play page (TH-506; Figma scratchpad-2026
 * 279:14859), chosen in Admin → Play layout. Jump Back In's claim — these are
 * the games you were last in — with an order to it: the most recent leads as
 * one wide tile spanning three columns, saying when you last played and for
 * how long, and the next three follow as covers. Six columns, one height.
 *
 * Recency is `RECENT` (data/games.ts), the one list that claims it. A press
 * opens the game's detail panel and Play launches, as everywhere (TH-504).
 */
export function FeaturedRecent() {
  const [lead, ...rest] = RECENT;
  const next = rest.slice(0, 3);
  const openGame = useOpenGame();
  const launch = useLaunchGame();
  const playtime = usePlaytimeOptional();
  // A tracked purchase's minutes are live (the refund card's clock); the rest are the fixture's.
  const minutesOf = (g: Game) => (PURCHASE_BY_ID[g.id] && playtime ? playtime.playedMin(g.id) : (RECENT_ACTIVITY[g.id]?.playedMin ?? 0));
  const activity = RECENT_ACTIVITY[lead.id];
  return (
    <section className="frc" aria-label="Recently played">
      <SectionHeader
        label="Recently Played"
        action={
          <Button onClick={() => document.getElementById('my-games')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Go to Library
          </Button>
        }
      />
      <div className="frc-grid">
        <LeadTile
          className="frc-lead"
          cover={lead.art}
          title={lead.title}
          aria-label={`${lead.title} details`}
          facts={[
            ...(activity ? [{ label: 'Last played', value: daysAgoLabel(activity.daysAgo) }] : []),
            { label: 'Play time', value: playTime(minutesOf(lead)) },
          ]}
          onClick={() => openGame(lead.id)}
          onPlay={() => launch(lead.id)}
          data-game={lead.id}
        />
        {next.map((g) => (
          <GameTile key={g.id} cover={g.art} aria-label={g.title} glow onClick={() => openGame(g.id)} onPlay={() => launch(g.id)} />
        ))}
      </div>
    </section>
  );
}

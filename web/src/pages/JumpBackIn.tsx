import { Button, GameTile } from '../components';
import { SectionHeader } from './SectionHeader';
import { RECENT } from '../data/games';
import { useOpenGame } from '../app/gamePanelRequest';
import { useLaunchGame } from '../state/launchGame';

/**
 * "Jump Back In" — the alternate top of the Play page (Figma scratchpad-2026
 * 207:8904), shown instead of the full-bleed `PlayHero` when Admin → Play
 * layout is set to it.
 *
 * Where the hero gives one game the whole viewport and hides the rest behind a
 * rail, this gives four equal covers you can read at a glance. It is the same
 * claim — these are the games you were last in — made as a grid rather than a
 * slideshow, so it sits in the normal content flow and needs none of the hero's
 * fixed positioning or scroll spacer.
 *
 * Which four: the first four INSTALLED games. Catalog order is this project's
 * existing stand-in for recency (the Play library's default "recent" sort reads
 * the same order), so the set is derived rather than a second hand-written list
 * that would drift from the library.
 */

// Figma's row is four 280px tiles with 24px gutters. The width comes from the
// grid, not the tile: `.ds-tile-art` already holds the 2:3 cover ratio, which
// 280 x 419 is (280 x 1.5 = 420).
const COUNT = 4;

export function JumpBackIn() {
  const games = RECENT.slice(0, COUNT);
  // A tile opens the game's detail panel; its ▶ launches (TH-504) — the
  // library's rule, so a cover means the same thing wherever it is.
  const openGame = useOpenGame();
  const launch = useLaunchGame();
  return (
    <section className="jbi" aria-label="Jump Back In">
      <SectionHeader
        label="Jump Back In"
        action={
          <Button
            onClick={() => document.getElementById('my-games')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Go to Library
          </Button>
        }
      />
      <div className="jbi-grid">
        {games.map((g) => (
          <GameTile
            key={g.id}
            cover={g.art}
            name={g.title}
            aria-label={g.title}
            size="lg"
            glow
            platform="platform-steam"
            onClick={() => openGame(g.id)}
            onPlay={() => launch(g.id)}
          />
        ))}
      </div>
    </section>
  );
}

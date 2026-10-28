/**
 * What an Autocast clip is drawn from (TH-509): a game's art and a crop. The
 * clips are simulated — stills of the game's own art, framed per clip and
 * panned when played — so a clip is stored as the art it was cut from
 * (state/Gallery.tsx) and resolved here, where the assets live.
 */
import cyberHero from '../../../Assets/game-hero/cyberpunk-hero.webp';
import eldenHero from '../../../Assets/game-hero/eldenring-hero.webp';
import lolHero from '../../../Assets/game-hero/leagueoflegends-hero.webp';
import mhHero from '../../../Assets/game-hero/monsterhunterwilds-hero.webp';
import { CROPS, MOMENTS } from '../data/autocast';
import { GAMES } from '../data/games';
import type { AutocastClip, AutocastSession } from '../state/Autocast';
import type { UserClip } from '../state/Gallery';

const HEROES: Record<string, string> = { cyberpunk: cyberHero, eldenring: eldenHero, leagueoflegends: lolHero, monsterhunterwilds: mhHero };

/** The picture a clip shows: the game's hero art, or its cover where there is no hero. */
export function clipArt(gameId: string, art: 'hero' | 'cover'): string | undefined {
  const cover = GAMES.find((g) => g.id === gameId)?.art;
  return art === 'hero' ? (HEROES[gameId] ?? cover) : (cover ?? HEROES[gameId]);
}

/** The frame as CSS: the art at the crop's start. */
export function clipFrameStyle(gameId: string, clip: { art: 'hero' | 'cover'; crop: { from: string; size: number } }): React.CSSProperties {
  const src = clipArt(gameId, clip.art);
  return src ? { backgroundImage: `url(${src})`, backgroundSize: `auto ${clip.crop.size}%`, backgroundPosition: clip.crop.from } : {};
}

/** The approved clips of a session, as the Gallery keeps them. */
export function toUserClips(s: AutocastSession, clips: AutocastClip[] = s.clips): UserClip[] {
  if (!s.plan || !s.gameId) return [];
  const title = GAMES.find((g) => g.id === s.gameId)?.title ?? s.gameId;
  const at = s.finishedAt ?? Date.now();
  return clips
    .filter((c) => c.status === 'approved')
    .map((c) => ({
      id: `autocast-${s.armedAt}-${c.moment}`,
      gameId: s.gameId!,
      title,
      label: MOMENTS[c.moment].label,
      caption: MOMENTS[c.moment].caption,
      seconds: s.plan!.seconds,
      aspect: s.plan!.aspect,
      media: { art: c.art, crop: CROPS[c.crop] },
      at,
    }));
}

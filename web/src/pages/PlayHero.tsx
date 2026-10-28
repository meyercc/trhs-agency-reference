import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Icon } from '../components';
import { useProfilesOptional } from '../state/Profiles';
import { usePlaytimeOptional } from '../state/Playtime';
import { useLaunchGame } from '../state/launchGame';
import { useAgents } from '../state/Agents';
import { useNovaAsk } from '../state/novaAsk';
import { useSettings } from '../state/Settings';
import { CREDITS_BY_ID } from '../data/credits';
import { WHO_MADE_THIS_AGENT } from '../nova/whoMadeThis';
import { PURCHASE_BY_ID, fmtMinutes } from '../data/refunds';

// Hero games (the "recently played" rail). Each carries its full-bleed hero art,
// a square thumb for the rail, the wordmark logo, and a friends-playing count.
import lolHero from '../../../Assets/game-hero/leagueoflegends-hero.webp';
import cyberHero from '../../../Assets/game-hero/cyberpunk-hero.webp';
import mhHero from '../../../Assets/game-hero/monsterhunterwilds-hero.webp';
import erHero from '../../../Assets/game-hero/eldenring-hero.webp';
import rdrHero from '../../../Assets/game-hero/reddead2-hero.webp';
import lolThumb from '../../../Assets/games/leagueoflegends.webp';
import cyberThumb from '../../../Assets/games/cyberpunk.webp';
import mhThumb from '../../../Assets/games/monsterhunterwilds.webp';
import erThumb from '../../../Assets/games/eldenring.webp';
import rdrThumb from '../../../Assets/games/redead2.webp';
import lolLogo from '../../../Assets/game-logos/league-of-legends.png';
import cyberLogo from '../../../Assets/game-logos/cyberpunk-2077.png';
import mhLogo from '../../../Assets/game-logos/monster-hunter-wilds.png';
import erLogo from '../../../Assets/game-logos/elden-ring.png';
import rdrLogo from '../../../Assets/game-logos/red-dead-2.png';

interface HeroGame {
  key: string;
  /** The catalog id (data/games.ts), where the game is in it — what `?playing=` names. */
  gameId?: string;
  art: string;
  thumb: string;
  logo: string;
  alt: string;
  friends: number;
}

const GAMES: HeroGame[] = [
  { key: 'lol', art: lolHero, thumb: lolThumb, logo: lolLogo, alt: 'League of Legends', friends: 12 },
  { key: 'cyberpunk', gameId: 'cyberpunk', art: cyberHero, thumb: cyberThumb, logo: cyberLogo, alt: 'Cyberpunk 2077', friends: 4 },
  { key: 'mhwilds', gameId: 'monsterhunterwilds', art: mhHero, thumb: mhThumb, logo: mhLogo, alt: 'Monster Hunter Wilds', friends: 2 },
  { key: 'eldenring', gameId: 'eldenring', art: erHero, thumb: erThumb, logo: erLogo, alt: 'Elden Ring', friends: 8 },
  { key: 'rdr2', gameId: 'reddead2', art: rdrHero, thumb: rdrThumb, logo: rdrLogo, alt: 'Red Dead Redemption 2', friends: 0 },
];

const AVATARS = [
  { initials: 'AK', bg: '#a855f7' },
  { initials: 'MR', bg: '#22c55e' },
  { initials: 'JS', bg: '#ef4444' },
  { initials: 'LT', bg: '#0078d7' },
  { initials: 'RP', bg: '#eab308' },
];

// Friends-playing block is parked, not removed — restore by flipping this.
const SHOW_FRIENDS = false;

/**
 * Play hero — a fixed, full-bleed game slideshow behind the page, with a glassy
 * rail of recently-played thumbnails that switch the slide (autoplay, 6s) and a
 * scroll-driven fade so content rises over it. Renders a fragment so the rail
 * positions against the `.play-page` container.
 */
export function PlayHero() {
  const [active, setActive] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();
  // `?playing=<gameId>` (TH-478): a game was just resumed. Its slide holds —
  // a slideshow rotating away from the game you launched would read as the
  // launch not having happened.
  const [params] = useSearchParams();
  const playing = params.get('playing');
  const held = useRef(false);
  const profiles = useProfilesOptional();
  const playtime = usePlaytimeOptional();
  // Play (dead until TH-484) — the one launch every Play uses.
  const launch = useLaunchGame();
  // The Play entry point to Who Made This (docs/who-made-this-demo-plan.md):
  // Nova opens beside the page and is asked, as Last Played's "Catch me up".
  // Only while the agent is added from Forge — removed there, the button goes.
  const ask = useNovaAsk();
  const { setNovaPinned } = useSettings();
  const { has: added } = useAgents();

  const start = useCallback(() => {
    clearInterval(timer.current);
    if (held.current) return;
    timer.current = setInterval(() => setActive((a) => (a + 1) % GAMES.length), 6000);
  }, []);
  useEffect(() => {
    start();
    return () => clearInterval(timer.current);
  }, [start]);
  useEffect(() => {
    const i = GAMES.findIndex((s) => s.gameId && s.gameId === playing);
    held.current = i >= 0;
    if (i >= 0) {
      clearInterval(timer.current);
      setActive(i);
    }
  }, [playing]);
  const pick = (i: number) => {
    held.current = false; // browsing the rail lets go of the resumed game
    setActive(i);
    start(); // a manual pick restarts the autoplay clock
  };

  // Pause autoplay when the tab is hidden.
  useEffect(() => {
    const onVis = () => (document.hidden ? clearInterval(timer.current) : start());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [start]);

  // Scroll-driven fade — set opacity imperatively to avoid re-rendering on scroll.
  useEffect(() => {
    const FADE = 420;
    const onScroll = () => {
      const fade = Math.max(0, 1 - window.scrollY / FADE);
      if (heroRef.current) heroRef.current.style.opacity = fade.toFixed(3);
      if (railRef.current) {
        railRef.current.style.opacity = fade.toFixed(3);
        railRef.current.classList.toggle('faded', fade < 0.05);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const g = GAMES[active];
  // Claimed only when it is true: the slide is the resumed game AND the active
  // profile is the one that game's launch put there. Opening the URL alone
  // shows the game, never a profile change that did not happen.
  const ap = profiles?.activeProfile;
  const nowPlaying = !!playing && g.gameId === playing && profiles?.source === 'game' && !!ap?.gameLink.enabled && ap.gameLink.gameIds.includes(playing) ? ap : null;

  return (
    <>
      <div className="play-hero" ref={heroRef}>
        {GAMES.map((s, i) => (
          <div className={'play-hero-slide' + (i === active ? ' active' : '')} key={s.key} data-slide={s.key}>
            <div className="play-hero-art" style={{ backgroundImage: `url(${s.art})` }} />
          </div>
        ))}
      </div>

      <div className="play-scroll-spacer" aria-hidden="true" />

      <aside className="play-hero-rail" ref={railRef}>
        <div className="play-rail-card">
          <div className="play-rail-thumbs">
            {GAMES.map((s, i) => (
              <button key={s.key} type="button" className={'play-rail-thumb' + (i === active ? ' active' : '')} title={s.alt} aria-label={s.alt} aria-current={i === active} onClick={() => pick(i)}>
                <img src={s.thumb} alt="" />
              </button>
            ))}
          </div>

          <div className="play-rail-logo">
            <img key={g.key} src={g.logo} alt={g.alt} />
          </div>

          <div className="play-rail-footer">
            {/* Friends block hidden for now (2026-08-10) — markup kept for
                when the social layer returns; flip SHOW_FRIENDS to restore. */}
            {SHOW_FRIENDS && (
            <div className="play-rail-friends-block">
              <div className="play-rail-friend-line">
                <span className="play-rail-friend-dot" />
                <span className="play-rail-friend-count">
                  {g.friends > 0 ? (
                    <>
                      <strong>
                        {g.friends} friend{g.friends === 1 ? '' : 's'}
                      </strong>{' '}
                      playing
                    </>
                  ) : (
                    <>
                      <strong>No friends</strong> playing right now
                    </>
                  )}
                </span>
              </div>
              <div className="play-rail-avatars">
                {AVATARS.map((a) => (
                  <span key={a.initials} className="play-rail-avatar" style={{ background: a.bg }}>
                    {a.initials}
                  </span>
                ))}
                <span className="play-rail-avatar more">+7</span>
              </div>
            </div>
            )}
            {/* Two honest reasons to say "Now playing": the game's linked profile
                really applied (TH-478), or it is a recent purchase whose playtime
                the refund agent tracks, so the minutes are real (TH-484). A game
                with neither gets no badge — it would be claiming something. */}
            {(() => {
              const tracked = !!playtime && !!g.gameId && playtime.playing === g.gameId && !!PURCHASE_BY_ID[g.gameId];
              if (!nowPlaying && !tracked) return null;
              return (
                <Badge variant="status" tone="positive" className="play-rail-now" role="status">
                  {`Now playing${tracked ? ` · ${fmtMinutes(playtime!.playedMin(g.gameId!))} played` : ''}${nowPlaying ? ` · ${nowPlaying.name} profile applied` : ''}`}
                </Badge>
              );
            })()}
            <div className="play-rail-actions">
              <Button
                onClick={() => document.getElementById('my-games')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Go to My Games
              </Button>
              {ask && added(WHO_MADE_THIS_AGENT) && g.gameId && CREDITS_BY_ID[g.gameId] && (
                <Button
                  aria-label={`Who made ${g.alt}?`}
                  onClick={() => {
                    setNovaPinned(true);
                    ask(`Who made ${g.alt}?`);
                  }}
                >
                  Who made this?
                </Button>
              )}
              <Button variant="accent" aria-label={`Play ${g.alt}`} disabled={!g.gameId} onClick={() => g.gameId && launch(g.gameId)}>
                <Icon name="play-fill" size={16} />
                Play
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

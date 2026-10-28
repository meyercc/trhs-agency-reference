import { useNavigate } from 'react-router-dom';
import { Button, GameTile, Icon } from '../components';
import { useOpenGame } from '../app/gamePanelRequest';
import { useAgents } from '../state/Agents';
import { useModules } from '../state/Modules';
import { useNovaAsk } from '../state/novaAsk';
import { useSettings } from '../state/Settings';
import { CATCH_UP_BY_ID, daysAway } from '../data/catchUp';
import { gameArt } from './gameArt';
import cyberpunkBg from '../../../Assets/games/16-9/cyberpunk-2077-cover.webp';
import './widgets.css';

// The last-played game (static, like the other content widgets). The wide
// key-art fills the card; the game's cover art is the foreground tile. Swap
// this const to feature a different game (see Assets/game-hero for key art).
// How long ago comes from the Catch Me Up fixture (TH-478), which owns the
// demo's fixed "now" — so the card and Nova's recap can never disagree.
const LAST_PLAYED = {
  gameId: 'cyberpunk',
  title: 'Cyberpunk 2077',
  cover: 'cyberpunk.webp',
  background: cyberpunkBg,
};

function whenOf(gameId: string): string {
  const e = CATCH_UP_BY_ID[gameId];
  if (!e) return 'Today';
  const n = daysAway(e);
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`;
}

/** "Last Played" — the last game you played, over its key art. New Gaming widget. */
export function LastPlayedWidget() {
  const navigate = useNavigate();
  const { has } = useModules();
  // The store is a leaf (react only), so the catalog may read it. The button
  // goes with the agent when it is removed from Forge (Chris, 2026-10-26);
  // the id is `CATCH_UP_AGENT` (nova/catchUp.ts), not imported — gotcha 51.
  const { has: added } = useAgents();
  const { setNovaPinned } = useSettings();
  // Not `useNova`: this file is under the widget catalog (gotcha 51).
  const ask = useNovaAsk();
  const play = () => navigate('/play');
  // The cover opens the game's detail panel (TH-504), as a library tile does;
  // the ▶ beside it is the way to Play. A leaf import (gamePanelRequest.ts).
  const openGame = useOpenGame();
  // The Home entry point to Catch Me Up: Nova opens beside the board and is
  // asked the question, so the recap arrives without anything being typed.
  const catchUp = () => {
    setNovaPinned(true);
    ask?.(`Catch me up on ${LAST_PLAYED.title}`);
  };
  return (
    <div className="w wg-lastplayed" style={{ border: 'none' }}>
      {/* Own layer so the slow zoom animates via GPU-composited `transform`
          (cheap) rather than repainting `background-size` every frame. */}
      <div className="wg-lp-bg" style={{ backgroundImage: `url('${LAST_PLAYED.background}')` }} aria-hidden="true" />
      <div className="wg-lp-scrim" aria-hidden="true" />
      <div className="wg-lp-content">
        <GameTile
          className="wg-lp-tile"
          size="sm"
          cover={gameArt(LAST_PLAYED.cover)}
          playable={false}
          aria-label={`${LAST_PLAYED.title} details`}
          onClick={() => openGame(LAST_PLAYED.gameId)}
        />
        <div className="wg-lp-meta">
          <div className="wg-lp-title">{LAST_PLAYED.title}</div>
          <div className="wg-lp-sub">Last played: {whenOf(LAST_PLAYED.gameId)}</div>
          <div className="wg-lp-actions">
            <button
              type="button"
              className="ds-btn-icon accent wg-lp-play"
              aria-label={`Play ${LAST_PLAYED.title}`}
              onClick={play}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Icon name="play-fill" />
            </button>
            {has('nova') && added('catch-me-up') && ask && (
              <Button size="sm" onImage onClick={catchUp} onPointerDown={(e) => e.stopPropagation()}>
                Catch me up
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

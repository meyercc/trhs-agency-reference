import { useNavigate } from 'react-router-dom';
import { GameTile, Icon } from '../components';
import { gameArt } from './gameArt';
import cyberpunkBg from '../../../Assets/games/16-9/cyberpunk-2077-cover.webp';
import './widgets.css';

// The last-played game (static, like the other content widgets). The wide
// key-art fills the card; the game's cover art is the foreground tile. Swap
// this const to feature a different game (see Assets/game-hero for key art).
const LAST_PLAYED = {
  title: 'Cyberpunk 2077',
  cover: 'cyberpunk.webp',
  background: cyberpunkBg,
  when: 'Today',
};

/** "Last Played" — the last game you played, over its key art. New Gaming widget. */
export function LastPlayedWidget() {
  const navigate = useNavigate();
  const play = () => navigate('/play');
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
          aria-label={LAST_PLAYED.title}
          onClick={play}
        />
        <div className="wg-lp-meta">
          <div className="wg-lp-title">{LAST_PLAYED.title}</div>
          <div className="wg-lp-sub">Last played: {LAST_PLAYED.when}</div>
          <button
            type="button"
            className="ds-btn-icon accent wg-lp-play"
            aria-label={`Play ${LAST_PLAYED.title}`}
            onClick={play}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Icon name="play-fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

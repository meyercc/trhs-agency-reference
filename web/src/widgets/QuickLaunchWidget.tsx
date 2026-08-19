import { useNavigate } from 'react-router-dom';
import { WidgetShell } from '../components';
import { gameArt } from './gameArt';
import './widgets.css';

const GAMES = ['cyberpunk.webp', 'monsterhunterwilds.webp', 'counterstrike2.webp', 'valorant.webp', 'eldenring.webp'];

/** Most-played game tiles for one-click launch. Ported from vanilla `w-quicklaunch`. */
export function QuickLaunchWidget() {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Quick Launch" action={{ label: 'Library', onClick: () => navigate('/play') }}>
      <div className="wg-tiles" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 'var(--gutter-sm)' }}>
        {GAMES.map((g) => (
          <button
            key={g}
            type="button"
            aria-label={`Launch ${g.replace(/\.\w+$/, '')}`}
            className="wg-tile"
            style={{ backgroundImage: `url('${gameArt(g)}')`, cursor: 'pointer', padding: 0 }}
            onClick={() => navigate('/play')}
          />
        ))}
      </div>
    </WidgetShell>
  );
}

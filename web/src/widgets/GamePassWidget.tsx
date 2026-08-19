import { useNavigate } from 'react-router-dom';
import { WidgetShell, Badge } from '../components';
import { gameArt } from './gameArt';
import './widgets.css';

const GAMES = [
  { art: 'Halo Campaign Evolved.webp', name: 'Halo: Campaign Evolved', sub: 'Xbox · Campaign' },
  { art: 'Gears of War Reloaded.webp', name: 'Gears of War: Reloaded', sub: 'Xbox · Remaster' },
  { art: 'Forza Horizon 6.jpeg', name: 'Forza Horizon 6', sub: 'Xbox · Racing' },
];

/** Recently-added Game Pass titles. Ported from vanilla `w-gamepass`. */
export function GamePassWidget() {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Game Pass" action={{ label: 'Browse', onClick: () => navigate('/shop') }}>
      <div className="wg-list" style={{ marginTop: 'var(--gutter-xs)' }}>
        {GAMES.map((g) => (
          <div className="wg-list-row" key={g.name}>
            <div className="wg-thumb" style={{ width: 34, height: 46, backgroundImage: `url('${gameArt(g.art)}')` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wg-list-name">{g.name}</div>
              <div className="wg-list-sub">{g.sub}</div>
            </div>
            <Badge variant="new">NEW</Badge>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

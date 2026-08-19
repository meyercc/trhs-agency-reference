import { useNavigate } from 'react-router-dom';
import { WidgetShell, Badge } from '../components';
import { gameArt } from './gameArt';
import './widgets.css';

const DEALS = [
  { art: 'eldenring.webp', name: 'Elden Ring', disc: '−65%', now: '$10.49', was: '$59.99' },
  { art: 'cyberpunk.webp', name: 'Cyberpunk 2077', disc: '−50%', now: '$29.99', was: '$59.99' },
];

/** Featured store sale prices. Ported from vanilla `w-deals`. */
export function DealsWidget() {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Today's Deals" action={{ label: 'Shop', onClick: () => navigate('/shop') }}>
      <div style={{ display: 'flex', gap: 'var(--gutter-sm)', marginTop: 'var(--gutter-sm)' }}>
        {DEALS.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => navigate('/shop')}
            style={{ flex: 1, padding: 0, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <div className="wg-tile" style={{ backgroundImage: `url('${gameArt(d.art)}')` }}>
              <span style={{ position: 'absolute', top: 'var(--gutter-xs)', right: 'var(--gutter-xs)' }}>
                <Badge variant="sale">{d.disc}</Badge>
              </span>
            </div>
            <div style={{ marginTop: 'var(--gutter-xs)', fontSize: 'var(--text-caption)', color: 'var(--text-primary)' }}>{d.name}</div>
            <div style={{ display: 'flex', gap: 'var(--gutter-xs)', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: 'var(--green)' }}>{d.now}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-nano)', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                {d.was}
              </span>
            </div>
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}

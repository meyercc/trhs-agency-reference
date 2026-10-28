import { useNavigate } from 'react-router-dom';
import { WidgetShell, Badge, Price } from '../components';
import { dealsOf, discountLabel, priceLabel } from '../data/games';
import './widgets.css';

/**
 * Featured store sale prices. Ported from vanilla `w-deals`; since TH-450 the
 * two deals come from `dealsOf`, the same list the Shop page prices and a
 * composed card's deals block shows — this used to carry its own two rows,
 * one of which said "−65%" on a game the Shop priced at −82%.
 */
export function DealsWidget() {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Today's Deals" action={{ label: 'Shop', onClick: () => navigate('/shop') }}>
      <div style={{ display: 'flex', gap: 'var(--gutter-sm)', marginTop: 'var(--gutter-sm)' }}>
        {dealsOf(2).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => navigate('/shop')}
            style={{ flex: 1, padding: 0, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <div className="wg-tile" style={{ backgroundImage: `url('${d.art}')` }}>
              <span style={{ position: 'absolute', top: 'var(--gutter-xs)', right: 'var(--gutter-xs)' }}>
                <Badge variant="sale">{discountLabel(d)}</Badge>
              </span>
            </div>
            <div style={{ marginTop: 'var(--gutter-xs)', fontSize: 'var(--text-caption)', color: 'var(--text-primary)' }}>{d.title}</div>
            <Price now={priceLabel(d.price)} was={priceLabel(d.was)} />
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}

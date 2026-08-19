import { Card, Badge } from '../components';
import { SectionHeader } from './SectionHeader';
import { GAMES, priceLabel, type Game } from '../data/games';
import bundle from '../../../Assets/shop/mysterystarbundle.webp';
import './pages.css';

const newReleases = ['monsterhunterwilds', 'deathstranding2', 'civ7', 'kingdomcome2'];
const onSale = GAMES.filter((g) => g.was);
const free = GAMES.filter((g) => g.price === 0);

function discount(g: Game): string {
  if (!g.was || g.price == null) return '';
  return `−${Math.round((1 - g.price / g.was) * 100)}%`;
}

export function Shop() {
  const releases = newReleases.map((id) => GAMES.find((g) => g.id === id)!).filter(Boolean);
  return (
    <div>
      <h1 className="ds-text-title-1 page-title">Shop</h1>
      <p className="ds-text-body page-sub">Discover something new.</p>

      <Card
        orientation="overlay"
        art={bundle}
        artAlt="Mystery Star Bundle"
        title="Mystery Star Bundle"
        meta="6 games · limited time"
        price="$14.99"
        badge={<Badge variant="sale">−50%</Badge>}
      />

      <SectionHeader label="New Releases" />
      <div className="pg-grid">
        {releases.map((g) => (
          <Card key={g.id} art={g.art} artAlt={g.title} title={g.title} meta={g.genre} price={priceLabel(g.price)} />
        ))}
      </div>

      <SectionHeader label="Weekly Deals" count={`${onSale.length} on sale`} />
      <div className="pg-grid">
        {onSale.map((g) => (
          <Card
            key={g.id}
            art={g.art}
            artAlt={g.title}
            title={g.title}
            meta={g.genre}
            price={priceLabel(g.price)}
            origPrice={priceLabel(g.was)}
            badge={<Badge variant="sale">{discount(g)}</Badge>}
          />
        ))}
      </div>

      <SectionHeader label="Free to Play" />
      <div className="pg-grid">
        {free.map((g) => (
          <Card key={g.id} art={g.art} artAlt={g.title} title={g.title} meta={g.genre} price="Free" />
        ))}
      </div>
    </div>
  );
}

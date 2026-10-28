import { useNavigate } from 'react-router-dom';
import { Carousel } from '../components';
import { WidgetBoard } from '../widgets';
import { HOME_SLIDES } from './homeSlides';
import { useSettings } from '../state/Settings';
import { AdSlot } from '../ads/AdSlot';
import './pages.css';

export function Home() {
  const navigate = useNavigate();
  const { adPlacement, adUnlocked } = useSettings();
  // Wire the shop-bound CTAs to the Shop route (the rest are promo placeholders).
  const slides = HOME_SLIDES.map((s) =>
    s.primary && (s.primary.label === 'Shop Now' || s.primary.label === 'Browse Deals')
      ? { ...s, primary: { ...s.primary, onClick: () => navigate('/shop') } }
      : s,
  );

  // The board renders the carousel as its hero, in its 1100px box and
  // left-aligned on a wide page while the grid below grows by whole widgets
  // (2026-10-21). The ad placement that belongs to this page sits between the
  // hero and the grid, as it always has.
  return (
    <div>
      <WidgetBoard
        hero={<Carousel slides={slides} className="home-carousel" />}
        between={
          adUnlocked && adPlacement === 'banner-below-carousel' ? (
            <div className="ad-inline">
              <AdSlot size="banner" />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

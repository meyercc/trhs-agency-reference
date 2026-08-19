import { useNavigate } from 'react-router-dom';
import { Carousel } from '../components';
import { WidgetBoard } from '../widgets';
import { HOME_SLIDES } from './homeSlides';
import './pages.css';

export function Home() {
  const navigate = useNavigate();
  // Wire the shop-bound CTAs to the Shop route (the rest are promo placeholders).
  const slides = HOME_SLIDES.map((s) =>
    s.primary && (s.primary.label === 'Shop Now' || s.primary.label === 'Browse Deals')
      ? { ...s, primary: { ...s.primary, onClick: () => navigate('/shop') } }
      : s,
  );

  return (
    <div>
      <Carousel slides={slides} className="home-carousel" />
      {/*<h1 className="ds-text-title-1 page-title">Dashboard</h1>
      <p className="ds-text-body page-sub">Drag a widget's header to move it · hover the corner to resize.</p>*/}
      <WidgetBoard />
    </div>
  );
}

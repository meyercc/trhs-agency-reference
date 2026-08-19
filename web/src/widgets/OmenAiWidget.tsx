import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WidgetShell, Badge } from '../components';
import { gameArt } from './gameArt';
import './widgets.css';

const SLIDES = [
  { art: 'cyberpunk.webp', name: 'Cyberpunk 2077', boost: 18, points: '2,25 14,21 26,17 38,13 50,10 62,8 74,5 86,3 98,1' },
  { art: 'monsterhunterwilds.webp', name: 'Monster Hunter Wilds', boost: 22, points: '2,26 14,22 26,18 38,13 50,9 62,6 74,4 86,2 98,1' },
  { art: 'eldenringnightreign.webp', name: 'Elden Ring Nightreign', boost: 15, points: '2,24 14,22 26,19 38,16 50,13 62,11 74,8 86,6 98,4' },
];

/** Per-game AI tuning slideshow with FPS boost. Ported from vanilla `w-omenai`. */
export function OmenAiWidget() {
  const [, setParams] = useSearchParams();
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);
  const s = SLIDES[i];
  return (
    <WidgetShell title="OMEN AI" action={{ label: 'Configure', onClick: () => setParams({ modal: 'omenai' }) }}>
      <div className="wg-ai-hdr">
        <div className="wg-thumb" style={{ width: 36, height: 36, backgroundImage: `url('${gameArt(s.art)}')` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wg-list-name">{s.name}</div>
          <div className="wg-list-sub">OMEN AI profile active</div>
        </div>
        <Badge variant="status" tone="positive">
          LATEST
        </Badge>
      </div>
      <div className="wg-ai-fps">
        <span className="wg-ai-fps-val">+{s.boost}</span>
        <span className="wg-unit">FPS avg boost</span>
      </div>
      <svg viewBox="0 0 100 28" fill="none" preserveAspectRatio="none" style={{ width: '100%', height: 24, marginTop: 'var(--gutter-xs)' }}>
        <polyline points={s.points} fill="none" stroke="var(--accent-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </WidgetShell>
  );
}

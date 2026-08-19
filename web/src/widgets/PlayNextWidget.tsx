import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WidgetShell, Button } from '../components';
import { gameArt } from './gameArt';
import './widgets.css';

const POOL = ['cyberpunk.webp', 'eldenring.webp', 'blackmythwukong.webp', 'monsterhunterwilds.webp', 'counterstrike2.webp', 'valorant.webp'];

function pick(seed: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 3; i++) out.push(POOL[(seed + i) % POOL.length]);
  return out;
}

/** Recommendation tiles with a shuffle. Ported from vanilla `w-playnext`. */
export function PlayNextWidget() {
  const navigate = useNavigate();
  const [seed, setSeed] = useState(0);
  const picks = pick(seed);
  return (
    <WidgetShell title="What to Play Next" action={{ label: 'Library', onClick: () => navigate('/play') }}>
      <div className="wg-tiles" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 'var(--gutter-sm)' }}>
        {picks.map((g, i) => (
          <button
            key={g + i}
            type="button"
            aria-label={`Play ${g.replace(/\.\w+$/, '')}`}
            className="wg-tile"
            style={{ backgroundImage: `url('${gameArt(g)}')`, cursor: 'pointer', padding: 0 }}
            onClick={() => navigate('/play')}
          />
        ))}
      </div>
      <div className="wg-foot" style={{ justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={() => setSeed((s) => s + 1)}>
          Shuffle
        </Button>
      </div>
    </WidgetShell>
  );
}

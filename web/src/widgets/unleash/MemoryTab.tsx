import { useState } from 'react';
import { Collapse, TierBadge } from './shared';

const OPTIONS = [
  { turbo: false, label: 'Default', speed: '2400 MT/s', sub: 'Factory default, maximum compatibility' },
  { turbo: true, label: 'Turbo', speed: '2933 MT/s', sub: 'Boosts bandwidth-intensive performance', warn: '⚠ Restart required' },
];

export function MemoryTab({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [turbo, setTurbo] = useState(true);

  return (
    <Collapse
      title="Memory Speed"
      badge={<TierBadge tier="L3" />}
      summary={turbo ? 'Turbo · 2933 MT/s' : 'Default · 2400 MT/s'}
      defaultOpen={defaultOpen}
    >
      <div className="ut-collapse-stack">
        <p className="ut-srow-note">Turbo mode raises memory speed from 2400 MT/s to 2933 MT/s. Restart required to take effect.</p>
        <div className="ut-tiles">
          {OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              className={'power-mode-btn ut-tile' + (turbo === o.turbo ? ' active unleash-mode' : '')}
              onClick={() => setTurbo(o.turbo)}
            >
              <span className="power-mode-label">{o.label}</span>
              <span className="ut-tile-speed">{o.speed}</span>
              <span className="ut-row-meta">{o.sub}</span>
              {o.warn && <span className="ut-tile-warn">{o.warn}</span>}
            </button>
          ))}
        </div>
      </div>
    </Collapse>
  );
}

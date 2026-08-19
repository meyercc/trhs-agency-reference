import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WidgetShell, ToggleButtonGroup, Slider, Toggle } from '../components';
import './widgets.css';

/** RGB effect + speed/brightness + sync. Ported from vanilla `w-lighting`. */
export function LightingWidget() {
  const [, setParams] = useSearchParams();
  const [effect, setEffect] = useState('wave');
  const [speed, setSpeed] = useState(1);
  const [bright, setBright] = useState(70);
  const [sync, setSync] = useState(true);
  return (
    <WidgetShell title="Lighting" action={{ label: 'Light Studio', onClick: () => setParams({ device: 'mouse' }) }}>
      <div style={{ marginTop: 'var(--gutter-sm)', display: 'grid', gap: 'var(--gutter-sm)' }}>
        <ToggleButtonGroup
          aria-label="Effect"
          value={effect}
          onChange={setEffect}
          options={[
            { label: 'Wave', value: 'wave' },
            { label: 'Rainbow', value: 'rainbow' },
            { label: 'Solid', value: 'solid' },
            { label: 'Pulse', value: 'pulse' },
            { label: 'Reactive', value: 'reactive' },
          ]}
        />
        <div className="wg-foot" style={{ margin: 0 }}>
          <span>Speed</span>
          <span style={{ color: 'var(--text-dim)' }}>{speed.toFixed(1)}×</span>
        </div>
        <Slider min={0.2} max={3} step={0.1} value={speed} onChange={setSpeed} aria-label="Speed" />
        <div className="wg-foot" style={{ margin: 0 }}>
          <span>Brightness</span>
          <span style={{ color: 'var(--text-dim)' }}>{bright}%</span>
        </div>
        <Slider value={bright} onChange={setBright} aria-label="Brightness" />
        <div className="wg-foot" style={{ margin: 0 }}>
          <span>Sync All</span>
          <Toggle checked={sync} onChange={setSync} aria-label="Sync all" />
        </div>
      </div>
    </WidgetShell>
  );
}

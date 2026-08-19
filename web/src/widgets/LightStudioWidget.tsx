import { useState } from 'react';
import { WidgetShell, Toggle, Slider } from '../components';

export function LightStudioWidget() {
  const [on, setOn] = useState(true);
  const [brightness, setBrightness] = useState(80);
  return (
    <WidgetShell title="Light Studio">
      <div style={{ marginTop: 'var(--gutter-sm)', display: 'grid', gap: 'var(--gutter-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-dim)' }}>Lights</span>
          <Toggle checked={on} onChange={setOn} aria-label="Lights" />
        </div>
        <Slider value={brightness} onChange={setBrightness} aria-label="Brightness" />
      </div>
    </WidgetShell>
  );
}

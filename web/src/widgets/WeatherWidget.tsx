import { useState } from 'react';
import { WidgetShell, ToggleButtonGroup } from '../components';
import './widgets.css';

const CONDITIONS: Record<string, { emoji: string; temp: number; label: string }> = {
  clear: { emoji: '☀️', temp: 78, label: 'Clear' },
  cloudy: { emoji: '⛅', temp: 72, label: 'Partly Cloudy' },
  rain: { emoji: '🌧️', temp: 61, label: 'Rain' },
  snow: { emoji: '❄️', temp: 28, label: 'Snow' },
};

/** Theme-reactive weather. Ported from vanilla `w-weather`. */
export function WeatherWidget() {
  const [cond, setCond] = useState('cloudy');
  const c = CONDITIONS[cond];
  return (
    <WidgetShell title="Weather">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gutter)', marginTop: 'var(--gutter-sm)' }}>
        <span style={{ fontSize: 34, lineHeight: 1 }}>{c.emoji}</span>
        <div style={{ flex: 1 }}>
          <div className="wg-stat wg-stat-md" style={{ color: 'var(--text-primary)' }}>
            {c.temp}°
          </div>
          <div className="wg-list-sub">{c.label} · New York</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="wg-list-sub">💧 45%</div>
          <div className="wg-list-sub">💨 8 mph</div>
        </div>
      </div>
      <div style={{ marginTop: 'var(--gutter-sm)' }}>
        <ToggleButtonGroup
          aria-label="Weather condition"
          value={cond}
          onChange={setCond}
          options={[
            { label: 'Clear', value: 'clear' },
            { label: 'Cloudy', value: 'cloudy' },
            { label: 'Rain', value: 'rain' },
            { label: 'Snow', value: 'snow' },
          ]}
        />
      </div>
    </WidgetShell>
  );
}

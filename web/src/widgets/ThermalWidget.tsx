import { useNavigate } from 'react-router-dom';
import { WidgetShell } from '../components';
import { useSettings } from '../state/Settings';
import { toUnit } from '../state/units';
import './widgets.css';

const UNIT_NAME = { C: 'Celsius', F: 'Fahrenheit' } as const;

/** 4-cell fan/temp grid + thermal profile. Ported from vanilla `w-thermal`. */
export function ThermalWidget() {
  const navigate = useNavigate();
  const { tempUnit } = useSettings();
  const cells = [
    { label: 'CPU Fan', val: '2,840', sub: 'RPM', color: 'var(--cyan)', pct: 72 },
    { label: 'GPU Fan', val: '3,120', sub: 'RPM', color: 'var(--purple)', pct: 80 },
    { label: 'CPU Temp', val: `${toUnit(72, tempUnit)}°`, sub: UNIT_NAME[tempUnit], color: 'var(--orange)', pct: 60 },
    { label: 'GPU Temp', val: `${toUnit(61, tempUnit)}°`, sub: UNIT_NAME[tempUnit], color: 'var(--green)', pct: 48 },
  ];
  return (
    <WidgetShell title="Thermal" action={{ label: 'Fan Control', onClick: () => navigate('/perform') }}>
      <div className="wg-grid4" style={{ marginTop: 'var(--gutter-sm)' }}>
        {cells.map((c) => (
          <div className="wg-cell" key={c.label}>
            <div className="wg-bar">
              <div className="wg-bar-fill" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
            <div className="wg-val" style={{ color: c.color }}>
              {c.val}
            </div>
            <div className="wg-sub">{c.sub}</div>
            <div className="wg-sub" style={{ color: 'var(--text-muted)' }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>
      <div className="wg-foot">
        <span>Thermal profile</span>
        <span style={{ color: 'var(--cyan)' }}>Custom</span>
      </div>
    </WidgetShell>
  );
}

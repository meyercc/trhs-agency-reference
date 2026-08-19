import { useNavigate } from 'react-router-dom';
import { WidgetShell } from '../components';
import './widgets.css';

const FANS = [
  { label: 'CPU Fan', rpm: '2,840', color: 'var(--cyan)' },
  { label: 'GPU Fan', rpm: '3,120', color: 'var(--purple)' },
];

/** Dual CPU/GPU fan RPM. Ported from vanilla `w-fanspeed`. */
export function FanSpeedWidget() {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Fan Speed" action={{ label: 'Fan Control', onClick: () => navigate('/perform') }}>
      <div className="wg-dual" style={{ marginTop: 'var(--gutter-sm)' }}>
        {FANS.map((f) => (
          <div className="wg-dual-cell" key={f.label}>
            <div className="wg-stat wg-stat-md" style={{ color: f.color }}>
              {f.rpm}
            </div>
            <div className="wg-sub">RPM</div>
            <div className="wg-sub" style={{ color: 'var(--text-muted)' }}>
              {f.label}
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

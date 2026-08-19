import { useNavigate } from 'react-router-dom';
import { WidgetShell } from '../components';
import { useSettings } from '../state/Settings';
import { formatTemp } from '../state/units';
import './widgets.css';

/** CPU load + temp + sparkline. Ported from vanilla `w-cpu`. */
export function CpuWidget() {
  const navigate = useNavigate();
  const { tempUnit } = useSettings();
  return (
    <WidgetShell title="CPU" action={{ label: 'Undervolt', onClick: () => navigate('/perform') }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--gutter-xs)', marginTop: 'var(--gutter-xs)' }}>
        <span className="wg-stat wg-stat-md">25</span>
        <span className="wg-unit">% load</span>
        <span className="wg-badge">{formatTemp(72, tempUnit)}</span>
      </div>
      <svg viewBox="0 0 100 22" fill="none" preserveAspectRatio="none" style={{ width: '100%', height: 22, margin: 'var(--gutter-xs) 0' }}>
        <path d="M0,17 L12,13 L24,15 L36,9 L48,11 L60,6 L72,9 L84,4 L100,6" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0,17 L12,13 L24,15 L36,9 L48,11 L60,6 L72,9 L84,4 L100,6 L100,22 L0,22Z" fill="var(--cyan-dim)" />
      </svg>
      <div className="wg-sub" style={{ textTransform: 'none', letterSpacing: 0 }}>
        Intel i9-13900K · 5.6 GHz boost
      </div>
    </WidgetShell>
  );
}

import { useSearchParams } from 'react-router-dom';
import { WidgetShell, Badge } from '../components';
import './widgets.css';

/** Booster dashboard widget — ported from vanilla `w-booster`. Opens the Booster
 *  modal via `?modal=booster` (Configure link). */
export function BoosterWidget() {
  const [, setParams] = useSearchParams();
  return (
    <WidgetShell
      title="Booster"
      badge={
        <Badge variant="status" tone="positive">
          ACTIVE
        </Badge>
      }
      action={{ label: 'Configure →', onClick: () => setParams({ modal: 'booster' }) }}
    >
      <div className="wbst-head">
        <div className="wbst-number">2,123,154</div>
        <div className="wbst-caption">sessions boosted today</div>
      </div>

      <div className="wbst-stats">
        <div className="wbst-stat">
          <div className="wbst-stat-val">
            1.2 <span className="wbst-stat-unit">GB</span>
          </div>
          <div className="wbst-stat-lbl">avg freed</div>
        </div>
        <div className="wbst-stat">
          <div className="wbst-stat-val">
            4 <span className="wbst-stat-unit">min</span>
          </div>
          <div className="wbst-stat-lbl">since last boost</div>
        </div>
      </div>

      <div className="wbst-ram">
        <div className="wbst-ram-hdr">
          <span className="wbst-ram-hdr-label">RAM</span>
          <span className="wbst-ram-hdr-val">6.4 GB free · 32 GB total</span>
        </div>
        <div className="wbst-ram-track">
          <div className="wbst-ram-fill" />
        </div>
      </div>
    </WidgetShell>
  );
}

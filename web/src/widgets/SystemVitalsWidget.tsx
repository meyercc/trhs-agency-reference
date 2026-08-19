import { useSearchParams } from 'react-router-dom';
import { WidgetShell } from '../components';
import { useSettings } from '../state/Settings';
import { toUnit } from '../state/units';
import { Gauge, NetArrow } from './Gauge';
import './vitals.css';

// A CPU/GPU gauge cell with a temperature badge (green < 80 °C, else orange).
function TempCell({ load, label, tempC }: { load: number; label: string; tempC: number }) {
  const { tempUnit } = useSettings();
  return (
    <div className="wv-cell">
      <Gauge value={load} />
      <div className="vital-label">{label}</div>
      <div className={'gauge-temp-badge ' + (tempC >= 80 ? 'orange' : 'green')}>
        {toUnit(tempC, tempUnit)}°{tempUnit}
      </div>
    </div>
  );
}

export function SystemVitalsWidget() {
  const [, setParams] = useSearchParams();
  return (
    <WidgetShell
      className="wv-widget"
      title="System Vitals"
      action={{ label: 'Full Details →', onClick: () => setParams({ modal: 'vitals' }) }}
    >
      <div className="wv-gauges">
        <TempCell load={48} label="CPU" tempC={59} />
        <TempCell load={36} label="GPU" tempC={60} />
        <div className="wv-cell">
          <Gauge value={54} />
          <div className="vital-label">RAM</div>
          <div className="gauge-temp-badge ram">18.7 GB</div>
        </div>
        <div className="wv-cell">
          <div className="wv-net">
            <div className="wv-net-row">
              <NetArrow />
              <span className="net-speed">1.4</span>
              <span className="net-unit">Mbps</span>
              <div className="net-minibar">
                <div className="net-minibar-fill" style={{ width: '18%', background: 'var(--green)' }} />
              </div>
            </div>
            <div className="wv-net-row">
              <NetArrow down />
              <span className="net-speed">99.2</span>
              <span className="net-unit">Mbps</span>
              <div className="net-minibar">
                <div className="net-minibar-fill" style={{ width: '72%', background: 'var(--cyan)' }} />
              </div>
            </div>
          </div>
          <div className="vital-label wv-net-label">Network</div>
        </div>
      </div>
    </WidgetShell>
  );
}

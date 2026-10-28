import { useState } from 'react';
import { Button, Checkbox, FanCurve, Separator, ToggleButtonGroup } from '../../components';
import { useSettings } from '../../state/Settings';
import { DEFAULT_FAN_CURVE } from '../../state/fanCurve';
import { Collapse, SliderRow } from './shared';

// The curve itself is the design system's FanCurve, bound to Settings — the
// same eight points the Performance card draws and a Nova reply can carry
// (TH-436). This file keeps the chrome around it: the dynamic toggle, the
// reference-temperature choice, the live readout, the note and Reset.
const CURR = 43;

function FanCurveEditor({ refTemp, onRefTempChange }: { refTemp: string; onRefTempChange: (t: string) => void }) {
  const { fanCurve, setFanCurve } = useSettings();
  const [dynamic, setDynamic] = useState(true);

  return (
    <div className="ut-fc">
      <div className="ut-fc-head">
        <Checkbox checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} label="Dynamic fan curve" />
        <div className="ut-fc-ref">
          <span className="ut-row-meta">Reference Temp</span>
          <ToggleButtonGroup
            options={[{ label: 'CPU', value: 'CPU' }, { label: 'GPU', value: 'GPU' }]}
            value={refTemp}
            onChange={onRefTempChange}
            aria-label="Reference temperature source"
          />
        </div>
      </div>
      <div className="ut-fc-live">
        <i aria-hidden="true" />
        <span className="ut-fc-live-val">{refTemp}: {CURR}°C</span>
        <span className="ut-row-meta">Live reference temperature</span>
      </div>
      <FanCurve points={fanCurve} onChange={setFanCurve} liveTemp={CURR} aria-label="Fan curve" />
      <div className="ut-fc-foot">
        <span className="ut-srow-note">System retains absolute thermal protection limits. Fan speed may exceed manual settings when required.</span>
        <Button size="sm" onClick={() => setFanCurve(DEFAULT_FAN_CURVE)}>Reset to Default</Button>
      </div>
    </div>
  );
}

export function ThermalTab({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [fanMode, setFanMode] = useState('manual');
  const [refTemp, setRefTemp] = useState('CPU');
  const [chassisTemp, setChassisTemp] = useState(54);
  const [maxBattery, setMaxBattery] = useState(25);

  return (
    <Collapse
      title="Thermal & Fan Control"
      summary={`${fanMode.toUpperCase()} · Chassis ${chassisTemp}°C · Battery ${maxBattery}%`}
      defaultOpen={defaultOpen}
    >
      <div className="ut-collapse-stack">
        <div className="ut-subsection">
          <span className="ut-row-label">Fan Control</span>
          <ToggleButtonGroup
            className="ut-tabs"
            options={[
              { label: 'MAX', value: 'max' },
              { label: 'AUTO', value: 'auto' },
              { label: 'MANUAL', value: 'manual' },
            ]}
            value={fanMode}
            onChange={setFanMode}
            aria-label="Fan mode"
          />
          {fanMode === 'max' && <p className="ut-srow-note">All fans run at maximum RPM. Louder, suited for short-term extreme loads.</p>}
          {fanMode === 'auto' && (
            <>
              <p className="ut-srow-note">System automatically adjusts fan speed based on real-time temperature, balancing cooling and noise.</p>
              <div className="ut-row ut-rpm-row">
                <span className="ut-row-meta">System fan</span>
                <span>
                  <span className="fan-rpm-val">2,840</span>
                  <span className="fan-rpm-unit">RPM</span>
                </span>
              </div>
            </>
          )}
          {fanMode === 'manual' && <FanCurveEditor refTemp={refTemp} onRefTempChange={setRefTemp} />}
        </div>

        <Separator />

        <div className="ut-subsection">
          <h4 className="ut-group-title">System Temperature &amp; Battery Limits</h4>
          <SliderRow
            label="Chassis Temperature Limit"
            min={49}
            max={65}
            value={chassisTemp}
            onChange={setChassisTemp}
            unit="°C"
            note="Chassis surface temperature cap — system will throttle to protect when exceeded"
          />
          <SliderRow
            label="Max Battery Drain"
            min={10}
            max={40}
            value={maxBattery}
            onChange={setMaxBattery}
            unit="%"
            note="Maximum battery discharge rate allowed under heavy load"
          />
        </div>
      </div>
    </Collapse>
  );
}

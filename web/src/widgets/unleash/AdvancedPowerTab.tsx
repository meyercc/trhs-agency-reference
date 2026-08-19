import { useState } from 'react';
import { Separator, ToggleButtonGroup } from '../../components';
import { Collapse, SliderRow, TierBadge } from './shared';

const LLC_DESC = (llc: number) =>
  llc <= 2
    ? 'Low — minimal Vdroop compensation, power-save priority, not recommended for OC'
    : llc >= 4
      ? 'High — strong Vdroop compensation, OC stability priority, elevated voltage'
      : 'Mid — balanced compensation (recommended default)';

export function AdvancedPowerTab({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [peak, setPeak] = useState(150);
  const [iccMax, setIccMax] = useState(160);
  const [llc, setLlc] = useState('3');

  return (
    <Collapse
      title="Advanced Power"
      badge={<TierBadge tier="L4" />}
      summary={`Peak ${peak}W · IccMax ${iccMax}A · LLC ${llc}`}
      defaultOpen={defaultOpen}
    >
      <div className="ut-collapse-stack">
        <div className="ut-banner warn">
          <span className="ut-banner-title">System Electrical Limits</span>
          <span className="ut-banner-copy">
            These parameters directly control hardware electrical safety limits. Unsafe values may cause system crashes
            and will not self-correct.
          </span>
        </div>

        <div className="ut-subsection">
          <h4 className="ut-group-title">Peak Power Limit</h4>
          <SliderRow
            label="Peak Power Limit"
            sub="Instantaneous electrical peak (millisecond scale)"
            min={100}
            max={300}
            value={peak}
            onChange={setPeak}
            unit="W"
            note="Removing this limit may trigger VRM thermal protection — confirm cooling capacity before adjusting"
          />
        </div>

        <Separator />

        <div className="ut-subsection">
          <h4 className="ut-group-title">Current &amp; Voltage Stability</h4>
          <SliderRow
            label="IccMax"
            sub="Maximum CPU current"
            min={100}
            max={300}
            value={iccMax}
            onChange={setIccMax}
            unit="A"
            note="Raising this removes current protection; excessive values may damage the VRM"
          />
          <Separator />
          <div className="ut-srow">
            <div className="ut-srow-head">
              <span className="ut-row-label">Load Line Calibration</span>
              <span className="ds-slider-value">LLC {llc}</span>
            </div>
            <ToggleButtonGroup
              className="ut-tabs"
              options={['1', '2', '3', '4', '5'].map((n) => ({ label: n, value: n }))}
              value={llc}
              onChange={setLlc}
              aria-label="Load line calibration"
            />
            <div className="ut-srow-note">{LLC_DESC(Number(llc))}</div>
          </div>
        </div>
      </div>
    </Collapse>
  );
}

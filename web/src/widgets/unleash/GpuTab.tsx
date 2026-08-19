import { useState } from 'react';
import { ToggleButtonGroup } from '../../components';
import { Collapse, SliderRow, BenchmarkRow, TierBadge } from './shared';

export function GpuTab({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [mode, setMode] = useState('auto');
  const [core, setCore] = useState(53);
  const [mem, setMem] = useState(72);

  const summary =
    mode === 'manual' ? `Manual · Core +${core} MHz · Mem +${mem} MHz` : mode === 'auto' ? 'Auto' : 'Off';

  return (
    <Collapse title="GPU Overclocking" badge={<TierBadge tier="L3" />} summary={summary} defaultOpen={defaultOpen}>
      <div className="ut-collapse-stack">
        <div className="ut-subsection">
          <span className="ut-row-meta">Auto follows Performance Mode automatically — no manual management needed</span>
          <ToggleButtonGroup
            className="ut-tabs"
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Manual', value: 'manual' },
              { label: 'Off', value: 'off' },
            ]}
            value={mode}
            onChange={setMode}
            aria-label="GPU overclocking mode"
          />
          {mode === 'manual' && (
            <>
              <SliderRow
                label="Core Clock Offset"
                sub="Base: 1800 MHz"
                min={0}
                max={150}
                value={core}
                onChange={setCore}
                unit=" MHz"
                note={`Adjusted max: ${1800 + core} MHz`}
              />
              <SliderRow
                label="Memory Clock Offset"
                sub="Base: 1800 MHz"
                min={0}
                max={150}
                value={mem}
                onChange={setMem}
                unit=" MHz"
                note={`Adjusted max: ${1800 + mem} MHz`}
              />
            </>
          )}
        </div>
        <BenchmarkRow kind="gpu" title="GPU Benchmark" desc="Benchmark overall GPU performance under current settings" />
      </div>
    </Collapse>
  );
}

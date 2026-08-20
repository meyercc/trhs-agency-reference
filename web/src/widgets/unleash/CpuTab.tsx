import { useState } from 'react';
import { Separator } from '../../components';
import { Collapse, SliderRow, BenchmarkRow, TierBadge } from './shared';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const CO_DELTAS = [3, 2, 1, 0, -2, -2, -3, -3];

export function CpuTab({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [boost, setBoost] = useState(100);
  const [coGlobal, setCoGlobal] = useState(15);
  const [coCores, setCoCores] = useState(CO_DELTAS.map((d) => clamp(15 + d, 0, 30)));
  const coAvg = Math.round(coCores.reduce((a, b) => a + b, 0) / coCores.length);

  const handleGlobalCO = (v: number) => {
    setCoGlobal(v);
    setCoCores(CO_DELTAS.map((d) => clamp(v + d, 0, 30)));
  };
  const setCore = (i: number, val: number) =>
    setCoCores((prev) => prev.map((p, idx) => (idx === i ? val : p)));

  return (
    <>
    <Collapse
      title="CPU Boost Control"
      badge={<TierBadge tier="L3" />}
      summary={`Boost +${boost} MHz · CO −${coAvg}`}
      defaultOpen={defaultOpen}
    >
        <div className="ut-collapse-stack">
          <div className="ut-subsection">
            <h4 className="ut-group-title">Frequency</h4>
            <SliderRow
              label="Max Boost Override"
              min={0}
              max={200}
              value={boost}
              onChange={setBoost}
              unit=" MHz"
              showRange
              note="Applied on top of PBO's target frequency"
            />
          </div>
          <Separator />
          <div className="ut-subsection">
            <h4 className="ut-group-title">Voltage Offset</h4>
            <SliderRow
              label="Curve Optimizer — All Cores"
              sub="Positive = undervolt"
              min={0}
              max={30}
              value={coGlobal}
              onChange={handleGlobalCO}
              showRange
              note="Undervolting reduces heat, allowing boost to be sustained longer"
            />
          </div>
          <Collapse
            title="Per-Core Tuning"
            badge={<TierBadge tier="L4" />}
            summary={coCores.map((v, i) => `C${i + 1}:${v}`).join(' · ')}
          >
            <p className="ut-srow-note">
              Fine-tune individual cores on top of the all-core baseline. Silicon quality varies between cores, so each
              has its own stability limit.
            </p>
            <div className="ut-cores">
              {coCores.map((v, i) => (
                <SliderRow
                  key={i}
                  label={`Core ${i + 1}`}
                  min={0}
                  max={30}
                  value={v}
                  onChange={(val) => setCore(i, val)}
                  format={(val) => `+${val}`}
                />
              ))}
            </div>
          </Collapse>
        </div>
      </Collapse>
    <BenchmarkRow kind="cpu" title="CPU Benchmark" desc="Benchmark overall CPU performance under current settings" />
    </>
  );
}

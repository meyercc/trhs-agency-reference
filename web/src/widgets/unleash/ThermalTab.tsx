import { useRef, useState } from 'react';
import { Button, Checkbox, Separator, ToggleButtonGroup } from '../../components';
import { Collapse, SliderRow } from './shared';

// Fan-curve geometry (spec) — rendered in the existing `.fan-curve-svg` visual
// language from PowerThermal: cyan stroke, soft area fill, hairline grid.
const W = 340, H = 210;
const PAD = { l: 40, r: 16, t: 18, b: 30 };
const T_MIN = 50, T_MAX = 90;
const CURR = 43;
const DEFAULT_CURVE = [
  { t: 50, r: 20 }, { t: 55, r: 25 }, { t: 60, r: 32 }, { t: 65, r: 42 },
  { t: 70, r: 55 }, { t: 75, r: 68 }, { t: 80, r: 80 }, { t: 90, r: 95 },
];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const tToX = (t: number) => PAD.l + ((t - T_MIN) / (T_MAX - T_MIN)) * (W - PAD.l - PAD.r);
const rToY = (r: number) => PAD.t + ((100 - r) / 100) * (H - PAD.t - PAD.b);
const yToR = (y: number) => clamp(Math.round(100 - ((y - PAD.t) / (H - PAD.t - PAD.b)) * 100), 0, 100);

function FanCurveEditor({ refTemp, onRefTempChange }: { refTemp: string; onRefTempChange: (t: string) => void }) {
  const [points, setPoints] = useState(DEFAULT_CURVE);
  const [dynamic, setDynamic] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = W / rect.width, sy = H / rect.height;
    const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
    let ci = -1, md = 18;
    points.forEach((p, i) => {
      const d = Math.hypot(tToX(p.t) - mx, rToY(p.r) - my);
      if (d < md) { md = d; ci = i; }
    });
    if (ci === -1) return;
    const move = (ev: PointerEvent) => {
      const r2 = svg.getBoundingClientRect();
      const y = (ev.clientY - r2.top) * sy;
      setPoints((prev) => prev.map((p, i) => (i === ci ? { ...p, r: yToR(y) } : p)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${tToX(p.t)} ${rToY(p.r)}`).join(' ');
  const area = `${line} L ${tToX(points[points.length - 1].t)} ${H - PAD.b} L ${tToX(points[0].t)} ${H - PAD.b} Z`;
  const cx = tToX(CURR > T_MIN ? CURR : T_MIN);

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
      <div className="ut-fc-plot">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ut-fc-svg" onPointerDown={onPointerDown}>
          {[0, 25, 50, 75, 100].map((r) => (
            <line key={r} x1={PAD.l} y1={rToY(r)} x2={W - PAD.r} y2={rToY(r)} className="ut-fc-grid" />
          ))}
          {Array.from({ length: 5 }, (_, i) => T_MIN + i * 10).map((t) => (
            <line key={t} x1={tToX(t)} y1={PAD.t} x2={tToX(t)} y2={H - PAD.b} className="ut-fc-grid" />
          ))}
          {['Min', '25%', '50%', '75%', 'Max'].map((l, i) => (
            <text key={l} x={PAD.l - 6} y={rToY(i * 25) + 3} textAnchor="end" className="ut-fc-tick">{l}</text>
          ))}
          {Array.from({ length: 5 }, (_, i) => T_MIN + i * 10).map((t) => (
            <text key={t} x={tToX(t)} y={H - PAD.b + 13} textAnchor="middle" className="ut-fc-tick">{t}°</text>
          ))}
          <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 4} textAnchor="middle" className="ut-fc-axis">Temperature (°C)</text>
          <text x={10} y={PAD.t + (H - PAD.t - PAD.b) / 2} textAnchor="middle" className="ut-fc-axis" transform={`rotate(-90 10 ${PAD.t + (H - PAD.t - PAD.b) / 2})`}>Fan Speed</text>
          <path d={area} className="ut-fc-area" />
          <path d={line} className="ut-fc-line" />
          {points.map((p, i) => (
            <circle key={i} cx={tToX(p.t)} cy={rToY(p.r)} r={5.5} className="ut-fc-point" />
          ))}
        </svg>
      </div>
      <div className="ut-fc-foot">
        <span className="ut-srow-note">System retains absolute thermal protection limits. Fan speed may exceed manual settings when required.</span>
        <Button size="sm" onClick={() => setPoints(DEFAULT_CURVE)}>Reset to Default</Button>
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

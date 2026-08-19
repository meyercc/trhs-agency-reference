import { useState } from 'react';
import { ReorderableSections, type ReorderableSectionData, Toggle } from '../components';
import { SectionHeader } from './SectionHeader';
import { MonitoringBar, Maintenance, DeviceWidget } from '../widgets';
import { SimRig } from '../widgets/perform3/SimRig';
import { OmenAiHeader, OmenAiIcon } from '../widgets/perform3/OmenAiHeader';
import { EnvelopeBlock } from '../widgets/perform3/EnvelopeBlock';
import { OptimizersBlock } from '../widgets/perform3/OptimizersBlock';
import {
  MACHINES,
  formOf,
  arbitrateManualOverride,
  type AiState,
  type MachineId,
  type ModeChangeEvent,
  type PowerMode,
} from '../widgets/perform3/machine';
import './pages.css';
import './perform-v3.css';

// ── PerformV3 (#/perform-v3) — performance-page-ia-spec.md implementation ──
// Parallel page; Perform and PerformV2 untouched. Page order is the team's
// standing decision, NOT the spec's four-block order: Monitor stays on top
// (the spec's unconditional-vitals invariant is satisfied — it renders in
// every form), Maintenance (cleaners) and My Devices stay at the bottom. The
// redesigned zone is the middle: OMEN AI + envelope + optimizers, rendered in
// one of three forms determined by machine capability × AI state (machine.ts).

const DEVICES = ['haste-3-pro', 'pulse-27', 'origins-65', 'cloud-iii'];

/** what the AI would set on this machine when turned on (demo data) */
const AI_DEMO_EVENT: ModeChangeEvent = { mode: 'performance', source: 'omen_ai', game: 'Cyberpunk 2077' };

export function PerformV3() {
  const [machine, setMachine] = useState<MachineId>('hp-nova');
  const [ai, setAi] = useState<AiState>('v2');
  // Attribution is recorded on every change, in every form including Form 0 —
  // the single load-bearing data dependency (machine.ts).
  const [current, setCurrent] = useState<ModeChangeEvent>(AI_DEMO_EVENT);

  const form = formOf(machine, ai);
  const profile = MACHINES[machine];
  /** the engine this machine gets when the AI is on (its matrix-row ceiling) */
  const engineOn = profile.aiStates.find((s) => s !== 'off') ?? 'off';

  const selectMachine = (m: MachineId) => {
    setMachine(m);
    // keep the cell real: clamp AI state to the new machine's row
    if (!MACHINES[m].aiStates.includes(ai)) setAi(MACHINES[m].aiStates.includes('v2') ? 'v2' : 'v1');
  };

  const userSelectMode = (mode: PowerMode) => {
    // TODO(arbitration-semantics): response to a manual change while the AI
    // is active is undefined — for now the knob is only re-signed.
    setCurrent(arbitrateManualOverride({ mode, source: 'user' }));
  };

  const toggleAi = (on: boolean) => {
    setAi(on ? engineOn : 'off');
    if (on) setCurrent(AI_DEMO_EVENT); // demo: the AI immediately sets its launch-time mode
  };

  // ── middle zone, by form ──
  const middle =
    form === 'form0' ? (
      // Form 0 — independent peers: performance control and OMEN AI side by
      // side, no header, no attribution UI. MVP ships in this form.
      <div className="pv3-peers">
        <EnvelopeBlock machine={machine} form={form} current={current} onSelect={userSelectMode} />
        <div className="ds-feature-card pv3-ai-peer">
          <div className="pv3-block-head">
            <div className="ds-feature-card-icon">
              <OmenAiIcon />
            </div>
            <Toggle checked={false} onChange={() => toggleAi(true)} aria-label="OMEN AI" />
          </div>
          <div className="ds-feature-card-title">OMEN AI</div>
          <div className="ds-feature-card-sub">
            Turn on to let OMEN AI manage optimization on this machine.
          </div>
        </div>
      </div>
    ) : (
      // Form 1 / Form 2 — AI header on top; envelope (where capability
      // exists) with attribution; optimizers per engine version.
      <div className="pv3-stack">
        <OmenAiHeader machine={machine} ai={ai} form={form} onToggle={toggleAi} />
        <EnvelopeBlock machine={machine} form={form} current={current} onSelect={userSelectMode} />
        <OptimizersBlock key={ai} ai={ai} />
      </div>
    );

  const sections: ReorderableSectionData[] = [
    {
      id: 'monitor',
      header: <SectionHeader label="Monitor" />,
      children: <MonitoringBar />,
    },
    {
      id: 'performance',
      header: <SectionHeader label="Performance" />,
      children: middle,
    },
    {
      id: 'maintenance',
      header: <SectionHeader label="Maintenance" />,
      children: <Maintenance />,
    },
    {
      id: 'devices',
      header: <SectionHeader label="My Devices" count={`${DEVICES.length} connected`} />,
      children: (
        <div className="pg-grid pg-grid-wide">
          {DEVICES.map((id) => (
            <DeviceWidget key={id} skuId={id} />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="ds-text-title-1 page-title">Perform</h1>
      <p className="ds-text-body page-sub">OMEN AI as top-level entry — IA spec preview.</p>
      <SimRig machine={machine} ai={ai} onMachine={selectMachine} onAi={setAi} lastEvent={current} />
      <ReorderableSections sections={sections} storageKey="perform-v3-sections" />
    </div>
  );
}

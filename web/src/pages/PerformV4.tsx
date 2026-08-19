import { useEffect, useState } from 'react';
import { Backdrop, ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { MonitoringBar, Maintenance, DeviceWidget } from '../widgets';
import { MatrixRig, matrixForm, type Era, type Laptop } from '../widgets/perform4/MatrixRig';
import { OmenAiHeader } from '../widgets/perform3/OmenAiHeader';
import { OptimizersBlock } from '../widgets/perform3/OptimizersBlock';
import { OmenAiCard } from '../widgets/perform4/OmenAiCard';
import { EnvelopeCard } from '../widgets/perform4/EnvelopeCard';
import { UnleashModal } from '../widgets/perform4/UnleashModal';
import {
  arbitrateManualOverride,
  type AiState,
  type MachineId,
  type ModeChangeEvent,
  type PowerMode,
} from '../widgets/perform3/machine';
import './pages.css';
import './perform-v3.css';
import './perform-v4.css';

// ── PerformV4 (#/perform-v4) — the layout-grammar iteration over V3 ──
// Same IA-spec machinery (machine.ts: capability table, formOf, attribution),
// different composition. The grammar rules this page embodies:
//   · Grids don't carry governance — marks do. Today's coupling (one shared
//     write point) is expressed by the signature badge alone, so the AI card
//     is layout-free and the middle zone can be an uneven composition.
//   · A state-height card owns its row: the power envelope is the page's one
//     anchor, licensed to carry Unleashed's inline L3; it never pairs
//     side-by-side.
//   · Form upgrades are device upgrades, not layout demolitions: Form 1 morphs
//     the AI card into a docked strip above what it manages (capture styling);
//     Form 2 absorbs the AI as a peer tile inside the mode row (Armoury Crate
//     inversion) — manual modes become the escape hatch, override stays one
//     tap away in the same location.

const DEVICES = ['haste-3-pro', 'pulse-27', 'origins-65', 'cloud-iii'];

/** what the AI would set on this machine when turned on (demo data) */
const AI_DEMO_EVENT: ModeChangeEvent = { mode: 'performance', source: 'omen_ai', game: 'Cyberpunk 2077' };

export function PerformV4() {
  const [laptop, setLaptop] = useState<Laptop>('hp');
  const [era, setEra] = useState<Era>('v2');
  const [aiOn, setAiOn] = useState(true);
  const [current, setCurrent] = useState<ModeChangeEvent>(AI_DEMO_EVENT);
  const [tuningOpen, setTuningOpen] = useState(false);

  useEffect(() => {
    if (!tuningOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTuningOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tuningOpen]);

  // The matrix drives everything: the page depends on ONE variable (the
  // laptop); the era decides how far the AI has advanced on it. The page's
  // own AI toggle can always drop the presentation back to Form 0.
  const form = aiOn ? matrixForm(laptop, era) : 'form0';
  const hasEnvelope = laptop === 'hp';
  // v1 is HP-only (the cohort mechanism is bound to HP models): a non-HP
  // machine in the V1 era has no OMEN AI at all — monitoring + manual tools.
  const aiExists = !(laptop === 'non-hp' && era === 'v1');

  // legacy prop mapping for the perform3 components (scope copy, badges)
  const machine: MachineId = laptop === 'hp' ? 'hp-nova' : 'third-party';
  const ai: AiState = !aiOn ? 'off' : era === 'v1' ? 'v1' : era === 'v3' && laptop === 'hp' ? 'thermal' : 'v2';
  const optimizerEngine: AiState = era === 'v1' ? 'v1' : 'v2';

  const userSelectMode = (mode: PowerMode) => {
    // TODO(arbitration-semantics): manual change while AI is active — response
    // undefined; for now the knob is only re-signed.
    setCurrent(arbitrateManualOverride({ mode, source: 'user' }));
  };

  const toggleAi = (on: boolean) => {
    setAiOn(on);
    if (on) setCurrent(AI_DEMO_EVENT);
  };

  // ── middle zone ──
  // Row 1: uneven pair — AI card (1/3) beside Optimization (2/3). In Form 1+
  // the AI card morphs into the docked strip, so Optimization takes the row.
  // Row 2: the envelope anchor, solo, full width (absent on 3rd-party — the
  // slot simply doesn't exist).
  const middle = (
    <div className="pv4-zone">
      {form === 'form0' ? (
        aiExists ? (
          <div className="pv4-row">
            <OmenAiCard machine={machine} ai={ai} onToggle={toggleAi} />
            <OptimizersBlock key={optimizerEngine} ai={optimizerEngine} />
          </div>
        ) : (
          // non-HP × V1: no OMEN AI at all — monitoring + manual tools only.
          <OptimizersBlock key={optimizerEngine} ai={optimizerEngine} />
        )
      ) : (
        <OptimizersBlock key={optimizerEngine} ai={optimizerEngine} />
      )}

      {form !== 'form0' && (
        <div className="pv4-dock">
          <OmenAiHeader machine={machine} ai={ai} form={form} onToggle={toggleAi} />
          {hasEnvelope && (
            <EnvelopeCard
              form={form}
              current={current}
              onSelect={userSelectMode}
              onDelegate={() => setCurrent(AI_DEMO_EVENT)}
              onOpenTuning={() => setTuningOpen(true)}
            />
          )}
        </div>
      )}
      {form === 'form0' && hasEnvelope && (
        <EnvelopeCard form={form} current={current} onSelect={userSelectMode} onOpenTuning={() => setTuningOpen(true)} />
      )}
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
      <p className="ds-text-body page-sub">Layout grammar preview — marks carry governance, the envelope anchors.</p>
      <MatrixRig laptop={laptop} era={era} onLaptop={setLaptop} onEra={setEra} lastEvent={current} />
      <ReorderableSections sections={sections} storageKey="perform-v4-sections" />
      {tuningOpen && (
        <>
          <Backdrop onClick={() => setTuningOpen(false)} />
          <UnleashModal onClose={() => setTuningOpen(false)} />
        </>
      )}
    </div>
  );
}

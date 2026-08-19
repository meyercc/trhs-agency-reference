import { useRef, useState } from 'react';
import { ToggleButtonGroup } from '../../components';
import { MACHINES, formOf, type MachineId, type AiState, type ModeChangeEvent } from './machine';

// ── Simulator rig (prototype-only, not product UI) ──
// Floating panel, draggable anywhere on the page (grab the header row).
// Picks a cell of the machine × AI-state matrix so the three page forms can
// be demoed live, and surfaces the attribution log to show the "recorded
// from Form 0" invariant. Deliberately styled as scaffolding (dashed border,
// mono type) so it never reads as product UI.

const FORM_LABEL: Record<string, string> = {
  form0: 'Form 0 — independent peers',
  form1: 'Form 1 — header + attribution',
  form2: 'Form 2 — nesting complete (frame only)',
};

const MACHINE_SHORT: Record<MachineId, string> = {
  'hp-old': 'HP old',
  'hp-nova': 'Nova Lake+',
  'third-party': '3rd-party',
};

const AI_LABEL: Record<AiState, string> = {
  off: 'AI off',
  v1: 'v1 engine',
  v2: '2.0 engine',
  thermal: '3.0 thermal',
};

export interface SimRigProps {
  machine: MachineId;
  ai: AiState;
  onMachine: (m: MachineId) => void;
  onAi: (a: AiState) => void;
  lastEvent: ModeChangeEvent | null;
}

export function SimRig({ machine, ai, onMachine, onAi, lastEvent }: SimRigProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const profile = MACHINES[machine];
  const form = formOf(machine, ai);

  const onDragStart = (e: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
      const w = rect.width;
      const h = rect.height;
      setPos({
        x: Math.min(Math.max(ev.clientX - dx, 0), window.innerWidth - w),
        y: Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - h),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={panelRef}
      className="pv3-rig"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
    >
      <div className="pv3-rig-head" onPointerDown={onDragStart}>
        <span className="pv3-rig-tag">Simulator</span>
        <span className="pv3-rig-form">{FORM_LABEL[form]}</span>
      </div>
      <div className="pv3-rig-row">
        <span className="pv3-rig-label">Machine</span>
        <ToggleButtonGroup
          options={(Object.keys(MACHINES) as MachineId[]).map((id) => ({ label: MACHINE_SHORT[id], value: id }))}
          value={machine}
          onChange={(v) => onMachine(v as MachineId)}
          aria-label="Simulated machine"
        />
      </div>
      <div className="pv3-rig-row">
        <span className="pv3-rig-label">OMEN AI</span>
        <ToggleButtonGroup
          options={profile.aiStates.map((s) => ({ label: AI_LABEL[s], value: s }))}
          value={ai}
          onChange={(v) => onAi(v as AiState)}
          aria-label="Simulated AI state"
        />
      </div>
      <div className="pv3-rig-foot">
        <span>{profile.sub}</span>
        <span className="pv3-rig-log">
          {lastEvent
            ? `attribution → mode=${lastEvent.mode} · source=${lastEvent.source}${lastEvent.game ? ` · ${lastEvent.game}` : ''}`
            : 'attribution → (no mode change yet)'}
        </span>
      </div>
    </div>
  );
}

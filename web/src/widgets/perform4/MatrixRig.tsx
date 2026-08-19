import { useRef, useState } from 'react';
import { ToggleButtonGroup } from '../../components';
import type { Form, ModeChangeEvent } from '../perform3/machine';

// ── Matrix rig (prototype-only, not product UI) ──
// The V4 simulator, restructured to the review matrix: the page depends on
// ONE variable — the laptop (HyperX gear adds its own sections elsewhere and
// never changes this page). Two rows (has / hasn't an OMEN·HP laptop) ×
// three eras (V1 MVP / 2.0 Integration / 3.0 TBD); each cell carries its
// matrix title and one of three states (separate / AI leads / AI manages
// hardware), which is what drives the page form.

export type Laptop = 'hp' | 'non-hp';
export type Era = 'v1' | 'v2' | 'v3';
export type CellState = 'separate' | 'leads' | 'hardware';

const CELLS: Record<Laptop, Record<Era, { title: string; state: CellState }>> = {
  hp: {
    v1: { title: 'Side by side', state: 'separate' },
    v2: { title: 'OMEN AI leads the page', state: 'leads' },
    v3: { title: 'AI starts taking over hardware', state: 'hardware' },
  },
  'non-hp': {
    v1: { title: 'Monitoring + manual tools', state: 'separate' },
    v2: { title: 'OMEN AI leads, software only', state: 'leads' },
    v3: { title: 'Stays at the 2.0 experience', state: 'leads' },
  },
};

const STATE_LABEL: Record<CellState, string> = {
  separate: 'Separate features — user drives everything',
  leads: 'OMEN AI leads — controls stay visible',
  hardware: 'OMEN AI begins managing hardware settings',
};

const FORM_OF_STATE: Record<CellState, Form> = { separate: 'form0', leads: 'form1', hardware: 'form2' };

export function matrixCell(laptop: Laptop, era: Era) {
  return CELLS[laptop][era];
}
export function matrixForm(laptop: Laptop, era: Era): Form {
  return FORM_OF_STATE[CELLS[laptop][era].state];
}

const LAPTOP_SUB: Record<Laptop, string> = {
  hp: 'with or without HyperX gear — gear never changes this page',
  'non-hp': 'HyperX gear only, or neither',
};

export interface MatrixRigProps {
  laptop: Laptop;
  era: Era;
  onLaptop: (l: Laptop) => void;
  onEra: (e: Era) => void;
  lastEvent: ModeChangeEvent | null;
}

export function MatrixRig({ laptop, era, onLaptop, onEra, lastEvent }: MatrixRigProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cell = matrixCell(laptop, era);

  const onDragStart = (e: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
      setPos({
        x: Math.min(Math.max(ev.clientX - dx, 0), window.innerWidth - rect.width),
        y: Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - rect.height),
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
        <span className="pv4-rig-state" data-state={cell.state}>
          <i aria-hidden="true" />
          {STATE_LABEL[cell.state]}
        </span>
      </div>
      <div className="pv3-rig-row">
        <span className="pv3-rig-label">Laptop</span>
        <ToggleButtonGroup
          options={[
            { label: 'OMEN / HP laptop', value: 'hp' },
            { label: 'No HP laptop', value: 'non-hp' },
          ]}
          value={laptop}
          onChange={(v) => onLaptop(v as Laptop)}
          aria-label="Simulated laptop"
        />
      </div>
      <div className="pv3-rig-row">
        <span className="pv3-rig-label">OMEN AI</span>
        <ToggleButtonGroup
          options={[
            { label: 'V1 (MVP)', value: 'v1' },
            { label: '2.0 (Integration)', value: 'v2' },
            { label: '3.0 (TBD)', value: 'v3' },
          ]}
          value={era}
          onChange={(v) => onEra(v as Era)}
          aria-label="OMEN AI era"
        />
      </div>
      <div className="pv3-rig-foot">
        <span>
          <strong className="pv4-rig-cell">{cell.title}</strong> · {LAPTOP_SUB[laptop]}
        </span>
        <span className="pv3-rig-log">
          {lastEvent
            ? `attribution → mode=${lastEvent.mode} · source=${lastEvent.source}${lastEvent.game ? ` · ${lastEvent.game}` : ''}`
            : 'attribution → (no mode change yet)'}
        </span>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Toggle, ToggleButtonGroup } from '../../components';
import { TypologyLegend } from './TypologyTag';
import { matrixCell, type CellState, type Era, type Laptop } from '../perform4/MatrixRig';
import type { ModeChangeEvent } from '../perform3/machine';

// ── ShowcaseRig (PerformV5, prototype-only) ──
// One control surface, not two: the V4 simulator (laptop × era) AND the
// showcase toggles (annotate / spotlight) folded into a single draggable panel.
// Reuses the real `.pv3-rig` / `.pv4-rig-*` styling; MatrixRig itself is left
// untouched (V4 unchanged).

const STATE_LABEL: Record<CellState, string> = {
  separate: 'Separate features — user drives everything',
  leads: 'OMEN AI leads — controls stay visible',
  hardware: 'OMEN AI begins managing hardware settings',
};

/**
 * Page scope, superset of the OMEN AI era. `v0` exists because the MVP moved
 * (2026-08-06): baseline Treehouse = hardware enablement, and the optimizer
 * family — OMEN AI, Booster, Network Booster — is read as outside it
 * (design-lead judgement, not ratified). 0.0 shows the page without the
 * family; 1.0 and 2.0 are the existing eras, unchanged.
 */
export type Scope = 'v0' | 'v1' | 'v2';

export interface ShowcaseRigProps {
  // simulator axes (identical to MatrixRig)
  laptop: Laptop;
  era: Era;
  onLaptop: (l: Laptop) => void;
  onEra: (e: Era) => void;
  /**
   * Optional three-value scope (0.0 / 1.0 / 2.0). When provided it REPLACES
   * the two-value era row — the row's subject widens from "which OMEN AI"
   * to "which page scope". Callers that don't pass it (V5/V6) render exactly
   * as before.
   */
  scope?: Scope;
  onScope?: (s: Scope) => void;
  /** OMEN AI enablement — scaffolding so all enablement states are reviewable
   *  (the real on/off will live in the Settings modal, pending Chris) */
  aiOn: boolean;
  onAiOn: (b: boolean) => void;
  /** the optimizer family's shared trigger — a game session. Scaffolding so
   *  Optimizing / Idle are both reviewable; resting default is no game. */
  session: boolean;
  onSession: (b: boolean) => void;
  lastEvent: ModeChangeEvent | null;
  // showcase toggles
  annotate: boolean;
  onAnnotate: (b: boolean) => void;
  spotlight: boolean;
  onSpotlight: (b: boolean) => void;
}

export function ShowcaseRig(props: ShowcaseRigProps) {
  const { laptop, era, onLaptop, onEra, lastEvent } = props;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [folded, setFolded] = useState(false);
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

  const toggles: { label: string; status: 'draft' | 'open'; meta: string; checked: boolean; onChange: (b: boolean) => void }[] = [
    { label: 'Annotate', status: 'draft', meta: 'Teaching overlay', checked: props.annotate, onChange: props.onAnnotate },
    { label: 'Spotlight anchor', status: 'draft', meta: 'G12 · frame signal', checked: props.spotlight, onChange: props.onSpotlight },
  ];

  return (
    <div
      ref={panelRef}
      className={'pv3-rig pv5-rig' + (folded ? ' pv5-rig-folded' : '')}
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
    >
      {/* the whole title bar is the drag handle */}
      <div className="pv3-rig-head" onPointerDown={onDragStart}>
        <span className="pv5-rig-grip" aria-hidden="true">⠿</span>
        <span className="pv3-rig-tag">Simulator</span>
        <span className="pv4-rig-state" data-state={cell.state}>
          <i aria-hidden="true" />
          {STATE_LABEL[cell.state]}
        </span>
        <button
          type="button"
          className="pv5-rig-fold"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setFolded((f) => !f)}
          aria-label={folded ? 'Expand simulator' : 'Collapse simulator'}
        >
          {folded ? '▸' : '▾'}
        </button>
      </div>

      {!folded && (
        <>
      <div className="pv5-rig-proposal">
        <strong>PROPOSAL · not ratified</strong> — ratified pieces built directly, the draft typology (G9–G14) demonstrated.
        The toggles below are open decisions, not decided here.
      </div>

      <div className="pv3-rig-row">
        <span className="pv3-rig-label">Laptop</span>
        <ToggleButtonGroup
          options={[
            { label: 'HyperX Laptop', value: 'hp' },
            { label: 'No HyperX Laptop', value: 'non-hp' },
          ]}
          value={laptop}
          onChange={(v) => onLaptop(v as Laptop)}
          aria-label="Simulated laptop"
        />
      </div>
      {props.scope && props.onScope ? (
        <div className="pv3-rig-row">
          <span className="pv3-rig-label">Scope</span>
          <ToggleButtonGroup
            options={[
              // "MVP is not a proper word" (owner, 8/11): MVP = the actual
              // release (~2028). The end-of-October hardware-enablement state
              // is 0.5 in the team's numbering — label follows team language.
              { label: '0.5', value: 'v0' },
              { label: '1.0', value: 'v1' },
              { label: '2.0', value: 'v2' },
            ]}
            value={props.scope}
            onChange={(v) => props.onScope!(v as Scope)}
            aria-label="Page scope"
          />
        </div>
      ) : (
        <div className="pv3-rig-row">
          <span className="pv3-rig-label">OMEN AI</span>
          <ToggleButtonGroup
            options={[
              { label: '1.0 (MVP)', value: 'v1' },
              { label: '2.0', value: 'v2' },
            ]}
            value={era}
            onChange={(v) => onEra(v as Era)}
            aria-label="OMEN AI era"
          />
        </div>
      )}
      {/* Enablement is an OMEN AI fact — at 0.0 there is no OMEN AI to enable. */}
      {props.scope !== 'v0' && (
        <div className="pv3-rig-row">
          <span className="pv3-rig-label">Enablement</span>
          <ToggleButtonGroup
            options={[
              { label: 'Enabled', value: 'on' },
              { label: 'Disabled', value: 'off' },
            ]}
            value={props.aiOn ? 'on' : 'off'}
            onChange={(v) => props.onAiOn(v === 'on')}
            aria-label="OMEN AI enablement"
          />
        </div>
      )}
      <div className="pv3-rig-row">
        <span className="pv3-rig-label">Session</span>
        <ToggleButtonGroup
          options={[
            { label: 'No game', value: 'off' },
            { label: 'In game', value: 'on' },
          ]}
          value={props.session ? 'on' : 'off'}
          onChange={(v) => props.onSession(v === 'on')}
          aria-label="Game session"
        />
      </div>

      {/* V7 (scope present): the framework-showcase apparatus is retired — no
          legend, no annotate; spotlight survives as a plain row. V5/V6 keep
          the original section untouched. */}
      {props.scope ? (
        <div className="pv3-rig-row">
          <span className="pv3-rig-label">Spotlight</span>
          <Toggle checked={props.spotlight} onChange={props.onSpotlight} aria-label="Spotlight anchor" />
        </div>
      ) : (
        <div className="pv5-rig-div">
          <span className="pv5-rig-sectlabel">Framework showcase</span>
          <TypologyLegend />
          <div className="pv5-rig-toggles">
            {toggles.map((t) => (
              <label className="pv5-ctrl-row" key={t.label}>
                <Toggle checked={t.checked} onChange={t.onChange} aria-label={t.label} />
                <span className="pv5-ctrl-text">
                  <span className="pv5-ctrl-label">{t.label}</span>
                  <span className={`pv5-ctrl-meta pv5-status pv5-status--${t.status}`}>{t.meta}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="pv3-rig-foot">
        <span>
          <strong className="pv4-rig-cell">{cell.title}</strong>
        </span>
        <span className="pv3-rig-log">
          {lastEvent
            ? `attribution → mode=${lastEvent.mode} · source=${lastEvent.source}${lastEvent.game ? ` · ${lastEvent.game}` : ''}`
            : 'attribution → (no mode change yet)'}
        </span>
      </div>
        </>
      )}
    </div>
  );
}

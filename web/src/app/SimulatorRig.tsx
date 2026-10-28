import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../pages/perform-v3.css';
import '../pages/perform-v5.css';
import './simulator-rig.css';
import { ToggleButtonGroup } from '../components';
import { useSettings, type MvpScope, type OmenAiLevel, type PcLayout } from '../state/Settings';
import { useRegisteredRigRows } from './simulatorRows';
import { pcDeviceTabs } from '../devices/deviceTabs';
import { isPcType, partsOf } from '../devices/pcDirectory';
import { getResolvedSku } from '../devices/skus';
import { matrixCell, type CellState, type Era, type Laptop } from '../widgets/perform4/MatrixRig';

/**
 * The Simulator (prototype-only): one rig on every page, above the pages and
 * the PC's modal, so the review's switches are always at hand (JY,
 * 2026-10-21). The Performance page's rig shell (widgets/perform5/ShowcaseRig
 * — the draggable title bar, the fold, one switch a row), with four rows of
 * product state, always:
 *
 *   Machine   Desktop · Laptop · Not a HyperX PC — which machine the app runs
 *             on; the last is the laptop as a PC not made by HP (no power
 *             envelope, OMEN AI still there). An open PC page swaps to the
 *             other machine, on the same tab where it has one.
 *   Scope     June 2027 · Full — the product scope
 *   OMEN AI   Off · 1.0 · 2.0 — off, side by side with the player's controls,
 *             or leading the page
 *   Session   No game · In game — the optimizer family's trigger
 *
 * While the desktop's PC page is open a fifth row sits under them, PC layout:
 * Stacked · Full-screen — the tower above the panel (today's), or filling the
 * window with the panel and the cap's preview floating over it (a trial, JY
 * 2026-10-22). It is only there when it can change something: the laptop's
 * page has one layout.
 *
 * The title bar says what Machine × OMEN AI makes of the page (the matrix
 * the Performance explorations were built on). Pages may register rows of
 * their own (simulatorRows.tsx); none does today. Where it was dragged and
 * whether it is folded are remembered.
 */

const DESKTOP = 'forge-45l';
const LAPTOP = 'hx-omen-16-valorant';
/** The other notebook (OMEN Max 16: four keyboard zones as its design opens them, a U-shaped bar, a four-region logo). */
const PERKEY = 'omen-max-16';
const KEY = 'simRig';

const STATE_LABEL: Record<CellState, string> = {
  separate: 'Separate features — user drives everything',
  leads: 'OMEN AI leads — controls stay visible',
  hardware: 'OMEN AI begins managing hardware settings',
};

interface Kept {
  pos?: { x: number; y: number };
  folded?: boolean;
}
function readKept(): Kept {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Kept;
  } catch {
    return {};
  }
}
function keep(patch: Kept) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readKept(), ...patch }));
  } catch {
    /* no storage: the rig forgets on reload */
  }
}

export function SimulatorRig() {
  const { thisPc, setThisPc, nonHpPc, setNonHpPc, mvpScope, setMvpScope, omenAi, setOmenAi, gameSession, setGameSession, pcLayout, setPcLayout } = useSettings();
  const [params, setParams] = useSearchParams();
  const pages = useRegisteredRigRows();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => readKept().pos ?? null);
  const [folded, setFolded] = useState(() => readKept().folded ?? false);
  const panelRef = useRef<HTMLDivElement>(null);

  const onDragStart = (e: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    let last: { x: number; y: number } | null = null;
    const move = (ev: PointerEvent) => {
      last = {
        x: Math.min(Math.max(ev.clientX - dx, 0), window.innerWidth - rect.width),
        y: Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - rect.height),
      };
      setPos(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (last) keep({ pos: last });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const fold = () => {
    setFolded((f) => {
      keep({ folded: !f });
      return !f;
    });
  };

  // The PC page open right now, if one is.
  const openSku = params.get('sku');
  const openPc = openSku && isPcType(getResolvedSku(openSku)?.type) ? openSku : null;
  const machine = nonHpPc ? 'non-hp' : thisPc === LAPTOP ? LAPTOP : thisPc === PERKEY ? PERKEY : DESKTOP;

  const switchMachine = (v: string) => {
    const id = v === 'non-hp' ? LAPTOP : v;
    setNonHpPc(v === 'non-hp');
    if (id !== thisPc) setThisPc(id);
    if (!openPc || openPc === id) return;
    const other = getResolvedSku(id);
    const next = new URLSearchParams(params);
    next.set('sku', id);
    // The same tab where the other machine has it; its first tab otherwise.
    const tab = params.get('tab');
    const tabs = other ? pcDeviceTabs(other, mvpScope, partsOf(other.id, mvpScope).map((p) => p.type)) : [];
    if (tab && tabs.some((t) => t.id === tab)) next.set('tab', tab);
    else next.delete('tab');
    next.delete('part');
    setParams(next, { replace: true });
  };
  // What Machine × OMEN AI makes of the page, for the title bar.
  const laptop: Laptop = nonHpPc ? 'non-hp' : 'hp';
  const era: Era = omenAi === 'v2' ? 'v2' : 'v1';
  const cell = omenAi === 'off' ? null : matrixCell(laptop, era);

  return (
    <div
      ref={panelRef}
      className={'pv3-rig pv5-rig sim-rig' + (folded ? ' pv5-rig-folded' : '')}
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      data-testid="sim-rig"
    >
      <div className="pv3-rig-head" onPointerDown={onDragStart}>
        <span className="pv5-rig-grip" aria-hidden="true">⠿</span>
        <span className="pv3-rig-tag">Simulator</span>
        <span className="pv4-rig-state" data-state={cell?.state ?? 'off'}>
          <i aria-hidden="true" />
          {cell ? STATE_LABEL[cell.state] : 'OMEN AI off — the player drives everything'}
        </span>
        <button type="button" className="pv5-rig-fold" onPointerDown={(e) => e.stopPropagation()} onClick={fold} aria-label={folded ? 'Expand simulator' : 'Collapse simulator'}>
          {folded ? '▸' : '▾'}
        </button>
      </div>
      {!folded && (
        <>
          <div className="pv3-rig-row">
            <span className="pv3-rig-label">Machine</span>
            <ToggleButtonGroup
              options={[
                { label: 'Desktop', value: DESKTOP },
                { label: 'Laptop', value: LAPTOP },
                { label: 'OMEN Max 16', value: PERKEY },
                { label: 'Not a HyperX PC', value: 'non-hp' },
              ]}
              value={machine}
              onChange={switchMachine}
              aria-label="Machine"
            />
          </div>
          <div className="pv3-rig-row">
            <span className="pv3-rig-label">Scope</span>
            <ToggleButtonGroup
              options={[
                { label: 'June 2027', value: 'june27' },
                { label: 'Full', value: 'full' },
              ]}
              value={mvpScope}
              onChange={(v) => setMvpScope(v as MvpScope)}
              aria-label="Product scope"
            />
          </div>
          <div className="pv3-rig-row">
            <span className="pv3-rig-label">OMEN AI</span>
            <ToggleButtonGroup
              options={[
                { label: 'Off', value: 'off' },
                { label: '1.0', value: 'v1' },
                { label: '2.0', value: 'v2' },
              ]}
              value={omenAi}
              onChange={(v) => setOmenAi(v as OmenAiLevel)}
              aria-label="OMEN AI"
            />
          </div>
          <div className="pv3-rig-row">
            <span className="pv3-rig-label">Session</span>
            <ToggleButtonGroup
              options={[
                { label: 'No game', value: 'off' },
                { label: 'In game', value: 'on' },
              ]}
              value={gameSession ? 'on' : 'off'}
              onChange={(v) => setGameSession(v === 'on')}
              aria-label="Game session"
            />
          </div>
          {openPc === DESKTOP && (
            <div className="pv3-rig-row">
              <span className="pv3-rig-label">PC layout</span>
              <ToggleButtonGroup
                options={[
                  { label: 'Stacked', value: 'stacked' },
                  { label: 'Full-screen', value: 'full' },
                ]}
                value={pcLayout}
                onChange={(v) => setPcLayout(v as PcLayout)}
                aria-label="PC layout"
              />
            </div>
          )}
          {pages.map((p) => (
            <div key={p.id} className="pv5-rig-div sim-rig-page" data-page={p.id}>
              {p.rows}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

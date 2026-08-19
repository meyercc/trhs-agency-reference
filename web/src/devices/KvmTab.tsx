import { useState } from 'react';
import {
  Dropdown,
  Toggle,
  ToggleButtonGroup,
  Button,
  Icon,
  Ng3Grid,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
} from '../components';
import { useSettings } from '../state/Settings';
import type { Features } from './skus';
import './kvm.css';

type Pc = 'pc1' | 'pc2';

// The shared keyboard + mouse live on the monitor's USB hub and follow the KVM
// switch. These are the user's actual connected HyperX peripherals (see
// connectedDevices.ts) — so the routing here is what makes their cards read as
// "on PC 1" vs "handed off to PC 2".
const SHARED = { keyboard: 'Alloy Origins 65', mouse: 'Pulsefire Saga Pro' };

/**
 * Input / KVM tab for KVM-capable monitors (features.connectivity.kvm). Models
 * what a device-centric IA doesn't yet: two source computers and a shared
 * keyboard+mouse that follow the active input. Presentational state only —
 * consistent with the other device-modal tabs.
 */
export function MonitorKvmTab({ features }: { features: Features }) {
  const conn = features.connectivity || {};
  const inputs: string[] = Array.isArray(conn.inputs) ? conn.inputs : ['DisplayPort 1.4', 'USB-C (DP+PD 65W)'];

  // Routing lives in shared Settings so the peripheral device cards can read it
  // (a keyboard/mouse routed to PC 2 reads "handed off", not "connected").
  const { kvm, setKvm } = useSettings();
  const active = kvm.activePc;
  const moveKbm = kvm.moveKbm;
  const setActive = (pc: Pc) => setKvm({ ...kvm, activePc: pc, configured: true });
  const setMoveKbm = (v: boolean) => setKvm({ ...kvm, moveKbm: v, configured: true });

  const [view, setView] = useState('single');
  // OFF by default per the monitor-section call (2026-07-21): switching input
  // is something the user triggers, not something that fires itself.
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [hotkey, setHotkey] = useState('Ctrl ×2');
  const [src1, setSrc1] = useState(inputs.find((i) => /displayport/i.test(i)) || inputs[0]);
  const [src2, setSrc2] = useState(inputs.find((i) => /usb-c/i.test(i)) || inputs[1] || inputs[0]);

  const PCS: Record<Pc, { name: string; src: string }> = {
    pc1: { name: 'Gaming PC', src: src1 },
    pc2: { name: 'Work Laptop', src: src2 },
  };
  const other: Pc = active === 'pc1' ? 'pc2' : 'pc1';
  const pbp = view !== 'single';

  return (
    <div className="kvm">
      {!kvm.configured && (
        <div className="kvm-setup" role="status">
          <Icon name="info" size={15} />
          <div className="kvm-setup-text">
            <b>Second PC detected on USB-C.</b> Set up KVM to share this display, keyboard, and mouse across both computers.
          </div>
          <Button size="sm" variant="accent" onClick={() => setKvm({ ...kvm, configured: true })}>
            Set up KVM
          </Button>
        </div>
      )}

      <Ng3Grid className="kvm-grid">
        {/* ── routing canvas ─────────────────────────────── */}
        <Ng3Section className="kvm-col-stage">
          <div className="kvm-status">
            <span className="kvm-status-led" aria-hidden="true" />
            <span>
              KVM active · {moveKbm ? 'keyboard + mouse' : 'display only'} on <b>{PCS[active].name}</b>
            </span>
          </div>
          <div className="kvm-stage">
        <div className={'kvm-monitor' + (pbp ? ' pbp' : '')}>
          <span className="kvm-mon-cap">This display · OMEN OLED 27</span>
          {pbp ? (
            <div className="kvm-mon-split">
              <span className={active === 'pc1' ? 'on' : ''}>{PCS.pc1.name}</span>
              <span className={active === 'pc2' ? 'on' : ''}>{PCS.pc2.name}</span>
            </div>
          ) : (
            <div className="kvm-mon-screen">{PCS[active].name}</div>
          )}
        </div>

        <div className="kvm-sources" role="group" aria-label="Source computers">
          {(['pc1', 'pc2'] as Pc[]).map((pc) => (
            <button
              key={pc}
              type="button"
              className={'kvm-src' + (active === pc ? ' active' : '')}
              aria-pressed={active === pc}
              onClick={() => setActive(pc)}
            >
              <span className="kvm-src-top">
                <span className="kvm-src-dot" aria-hidden="true" />
                <span className="kvm-src-name">{PCS[pc].name}</span>
              </span>
              <span className="kvm-src-in">{PCS[pc].src}</span>
              <span className="kvm-src-badge">{active === pc ? (moveKbm ? 'Displayed + controlled' : 'Displayed') : 'Switch here'}</span>
            </button>
          ))}
        </div>

            <div className={'kvm-route to-' + active + (moveKbm ? '' : ' idle')}>
              <Icon name="devices" size={14} />
              <span className="kvm-route-what">
                {SHARED.keyboard} + {SHARED.mouse}
              </span>
              <span className="kvm-route-arrow" aria-hidden="true" />
              <span className="kvm-route-to">{moveKbm ? PCS[active].name : 'stays on host PC'}</span>
            </div>
          </div>
        </Ng3Section>

        {/* ── view + sources ─────────────────────────────── */}
        <Ng3Section>
          <Ng3Field>
            <Ng3Label strong>View</Ng3Label>
            <ToggleButtonGroup
              aria-label="View mode"
              value={view}
              onChange={setView}
              options={[
                { label: 'Single', value: 'single' },
                { label: 'PBP', value: 'pbp' },
                { label: 'PIP', value: 'pip' },
              ]}
            />
          </Ng3Field>
          <Ng3Field>
            <Ng3Label strong>Sources</Ng3Label>
            <Ng3Row>
              <Ng3Label plain>PC 1 · {PCS.pc1.name}</Ng3Label>
              <Dropdown aria-label="PC 1 input" value={src1} onChange={setSrc1} options={inputs.map((i) => ({ label: i, value: i }))} />
            </Ng3Row>
            <Ng3Row>
              <Ng3Label plain>PC 2 · {PCS.pc2.name}</Ng3Label>
              <Dropdown aria-label="PC 2 input" value={src2} onChange={setSrc2} options={inputs.map((i) => ({ label: i, value: i }))} />
            </Ng3Row>
          </Ng3Field>
        </Ng3Section>

        {/* ── switching ──────────────────────────────────── */}
        <Ng3Section>
          <Ng3Label strong>Switching</Ng3Label>
          <Ng3Row>
            <Ng3Label plain>Move keyboard &amp; mouse with display</Ng3Label>
            <Toggle checked={moveKbm} onChange={setMoveKbm} aria-label="Move keyboard and mouse with display" />
          </Ng3Row>
          <Ng3Row>
            <Ng3Label plain>Auto-switch on input change</Ng3Label>
            <Toggle checked={autoSwitch} onChange={setAutoSwitch} aria-label="Auto-switch on input change" />
          </Ng3Row>
          <Ng3Row>
            <Ng3Label plain>Switch hotkey</Ng3Label>
            <Dropdown
              aria-label="Switch hotkey"
              value={hotkey}
              onChange={setHotkey}
              options={[
                { label: 'Ctrl ×2', value: 'Ctrl ×2' },
                { label: 'Scroll Lock ×2', value: 'Scroll Lock ×2' },
                { label: 'Ctrl + Alt + K', value: 'Ctrl + Alt + K' },
              ]}
            />
          </Ng3Row>
          <div className="kvm-switch">
            <Button size="sm" variant="accent" onClick={() => setActive(other)}>
              Switch to {PCS[other].name}
            </Button>
            <p className="kvm-caveat">
              <Icon name="info" size={13} />
              <span>
                Switching moves your keyboard &amp; mouse to <b>{PCS[other].name}</b>. Use the monitor’s KVM button or the{' '}
                <b style={{ whiteSpace: 'nowrap' }}>{hotkey}</b> hotkey to switch back.
              </span>
            </p>
            <p className="kvm-persist">
              <Icon name="info" size={12} />
              <span>Saved to the monitor — your KVM setup applies even on a PC that doesn’t have Treehouse.</span>
            </p>
          </div>
        </Ng3Section>
      </Ng3Grid>
    </div>
  );
}

// ── Personalize › Lighting (modal) ───────────────────────────────────────────
// The Lighting tile only shows each device at a glance; changing color, effect,
// brightness or speed happens here, on the 3D desk (`?modal=lighting`, optionally
// `&device=<id>` to open with that device selected). Same shell as Modes and
// System Vitals.
import { lazy, Suspense } from 'react';
import { Badge, Button, ModalShell, Toggle } from '../../components';
import { useModules } from '../../state/Modules';
import { DEVICE_IDS, type DeviceId } from '../../lightstudio/lighting';
import { presetNamed } from '../../lightstudio/presets';
import { lightingSummary } from './model';
import { usePersonalize } from './state';
// Header and panel are System Vitals' (.vm-*); the actions are Modes'.
import '../../modals/vitals-modal.css';
import './lighting-modal.css';

const LightStudio = lazy(() => import('../../lightstudio/LightStudio').then((m) => ({ default: m.LightStudio })));

/** Lights on/off for the whole desk. Off ≠ disabled (TH-342): turning back on
 *  restores the mode's effect, never a dark "on". */
export function useLightsPower() {
  const p = usePersonalize();
  const lit = p.desk.lighting;
  const on = lit.keyboard.effect !== 'off';
  const setOn = (next: boolean) => {
    if (!next) return p.setLighting([], presetNamed('Off'));
    // Back on: the mode's own lighting, or White when the mode keeps lights off.
    const mode = p.preset?.lighting.keyboard;
    const look = mode && mode.effect !== 'off' ? { color: mode.color, effect: mode.effect, preset: mode.preset } : presetNamed('White');
    p.setLighting([], { ...look, brightness: Math.max(lit.keyboard.brightness, 20) });
  };
  return { on, setOn };
}

export function LightingModal({ onClose, device }: { onClose: () => void; device?: string }) {
  const p = usePersonalize();
  const { has } = useModules();
  const { on, setOn } = useLightsPower();
  const modeName = p.modeName(p.mode);
  const overridden = p.overrides.includes('lighting');
  const initial = DEVICE_IDS.includes(device as DeviceId) ? [device as DeviceId] : undefined;

  return (
    <ModalShell title="Lighting" onClose={onClose} className="vm-shell mm-shell">
      <div className="vitals-modal">
        {/* One fixed-height panel: a slim status row, then the studio filling the
            rest — the desk and its controls are always on screen together. */}
        <div className="vm-panel lm-panel">
          <div className="vm-detail-header lm-status">
            <div className="vm-detail-info">
              {/* One line: the modal title already says Lighting. */}
              <div className="mm-sub lm-status-line">
                <Badge variant="status" tone={overridden ? 'neutral' : 'info'}>
                  {overridden ? 'Changed' : modeName}
                </Badge>
                {lightingSummary(p.desk.lighting)} ·{' '}
                {overridden
                  ? `You changed this. Reset puts back what ${modeName} shipped with.`
                  : p.desk.gameSync
                    ? 'Synced with Valorant — lighting follows the game while it runs.'
                    : 'Changes stay on this desk. Lighting does not follow the profile yet.'}
              </div>
            </div>
            <div className="mm-actions">
              {overridden && (
                <Button variant="ghost" size="sm" onClick={() => p.resetOwned('lighting')}>
                  Reset
                </Button>
              )}
              <label className="mm-power">
                Lights
                <Toggle checked={on} onChange={setOn} aria-label="Desk lighting" />
              </label>
            </div>
          </div>

          {has('lightstudio') ? (
            <Suspense fallback={<div className="mm-loading">Loading desk…</div>}>
              <LightStudio states={p.desk.lighting} onStatesChange={p.replaceLighting} initialSelected={initial} />
            </Suspense>
          ) : (
            <p className="mm-sub">Install the Light Studio module to edit lighting on a 3D desk.</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

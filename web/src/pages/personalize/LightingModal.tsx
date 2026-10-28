// ── Personalize › Lighting (modal) ───────────────────────────────────────────
// The Lighting tile shows the desk at a glance; this window lists the devices
// that have lights and opens each one's own window at its Lights tab
// (`?modal=lighting`). One device's lighting has one home, its window
// (lighting.19); the whole-desk editor (Light Studio) is not relied on
// (Chris, 2026-10-21), so this is a list of doors, not a second editor. Same
// shell as System Vitals; the status row and the Lights switch are the
// profile's, as before.
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Icon, ListItem, ModalShell, Toggle } from '../../components';
import { LIT_DEVICE_IDS, LABELS, type DeviceId } from '../../lightstudio/lighting';
import { presetNamed } from '../../lightstudio/presets';
import { useChassisMachine } from '../../lightstudio/ChassisLights';
import { zonesOf } from '../../lightstudio/towerZones';
import { deviceCardModel } from '../../widgets/DeviceCard';
import { deskDeviceIds } from '../../devices/connectedDevices';
import { getResolvedSku } from '../../devices/skus';
import { capsOf } from '../../devices/pcLighting';
import { useSettings } from '../../state/Settings';
import { useDeviceSim } from '../../state/DeviceSim';
import { DESK_SKU, lightingSummary } from './model';
import { usePersonalize } from './state';
import { deviceLook, useLookReader } from './looks';
// Header and panel are System Vitals' (.vm-*); the actions are Modes'.
import '../../modals/vitals-modal.css';
import './lighting-modal.css';

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

/** One lit device, as a row: what it is, what it wears, where its window is. */
interface LitRow {
  key: string;
  sku: string;
  name: string;
  subtitle: string;
  image?: string;
  /** The look's first colour, for the swatch when there is no picture. */
  swatch: string | null;
  description: string;
  /** The window's tab. */
  tab: string;
}

/** The devices with lights on this desk, in the desk's order; This PC first
 *  when it has lights of its own (its tower, or a notebook's built-in keyboard). */
function useLitRows(): LitRow[] {
  const p = usePersonalize();
  const { deskDevices, thisPc } = useSettings();
  const { simState } = useDeviceSim();
  const lit = p.desk.lighting;
  const rows: LitRow[] = [];

  // What a row says is what the 3D overview's label says (looks.ts): the
  // tower's own per-part lighting counts, not only the desk's copy of it
  // (JY, 2026-10-21).
  const zones = zonesOf(useChassisMachine());
  const wear = (id: DeviceId): { description: string; swatch: string | null } => {
    const look = deviceLook(id, lit, zones);
    if (look.off) return { description: 'Off', swatch: null };
    return { description: look.brightness == null ? look.name : `${look.name} · ${look.brightness}%`, swatch: look.swatch };
  };

  // The notebook's built-in keyboard: its lighting lives in its own window
  // (LaptopLights), not in the desk's lighting, so the row names the window.
  const pc = getResolvedSku(thisPc);
  if (pc?.type === 'notebook' && capsOf(pc.features).keyboard !== 'none') {
    const caps = capsOf(pc.features);
    const parts = ['keyboard', caps.bar !== 'none' ? 'light bar' : null, caps.logo !== 'none' ? 'logo' : null].filter(Boolean).join(', ');
    rows.push({
      key: 'built-in-keyboard',
      sku: pc.id,
      name: 'Built-in keyboard',
      subtitle: pc.name,
      image: deviceCardModel(pc.id)?.image,
      swatch: null,
      description: `Zones on the ${parts} · set in its own window`,
      tab: 'lighting',
    });
  }

  const onDesk = new Set(deskDeviceIds(deskDevices));
  LIT_DEVICE_IDS.forEach((id) => {
    const sku = DESK_SKU[id];
    if (id === 'tower') {
      // The tower is on the desk by Admin's say, never unplugged.
      if (!deskDevices.includes('tower')) return;
    } else if (!onDesk.has(sku) || !simState(sku).connected) return;
    const model = deviceCardModel(sku);
    rows.push({
      key: id,
      sku,
      name: model?.name ?? LABELS[id],
      subtitle: model?.subtitle ?? '',
      image: model?.image,
      ...wear(id),
      tab: 'lighting',
    });
  });
  // This PC's rows first: the tower (or the notebook) leads, as it does in the device list.
  const i = rows.findIndex((r) => r.key === 'tower');
  if (i > 0) rows.unshift(...rows.splice(i, 1));
  return rows;
}

export function LightingModal({ onClose }: { onClose: () => void; device?: string }) {
  const p = usePersonalize();
  const { on, setOn } = useLightsPower();
  const [params, setParams] = useSearchParams();
  const rows = useLitRows();
  const read = useLookReader(p.desk.lighting);
  const modeName = p.modeName(p.mode);
  const overridden = p.overrides.includes('lighting');

  // A row opens the device's own window in this window's place.
  const openRow = (r: LitRow) => {
    const next = new URLSearchParams(params);
    next.delete('modal');
    next.delete('device');
    next.set('sku', r.sku);
    next.set('tab', r.tab);
    setParams(next);
  };

  return (
    <ModalShell title="Lighting" onClose={onClose} className="vm-shell mm-shell lm-shell" width="narrow">
      <div className="vitals-modal">
        <div className="vm-panel lm-panel">
          <div className="vm-detail-header lm-status">
            <div className="vm-detail-info">
              {/* One line: the modal title already says Lighting. */}
              <div className="mm-sub lm-status-line">
                <Badge variant="status" tone={overridden ? 'neutral' : 'info'}>
                  {overridden ? 'Changed' : modeName}
                </Badge>
                {lightingSummary(p.desk.lighting, read)} ·{' '}
                {overridden
                  ? `You changed this. Save it to ${modeName}, or reset to what ${modeName} sets.`
                  : p.desk.gameSync
                    ? 'Synced with Valorant — lighting follows the game while it runs.'
                    : `Saved in the ${modeName} profile.`}
              </div>
            </div>
            <div className="mm-actions">
              {overridden && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => p.resetOwned('lighting')}>
                    Reset
                  </Button>
                  <Button size="sm" onClick={() => p.saveToMode('lighting')}>
                    Save to {modeName}
                  </Button>
                </>
              )}
              <label className="mm-power">
                Lights
                <Toggle checked={on} onChange={setOn} aria-label="Desk lighting" />
              </label>
            </div>
          </div>

          {/* The devices with lights, each a door to its own window. */}
          <p className="mm-sub lm-lead">Each device's lights are set in its own window.</p>
          <div className="lm-list" role="list" aria-label="Devices with lights">
            {rows.map((r) => (
              <ListItem
                key={r.key}
                role="listitem"
                className="lm-row"
                data-device={r.key}
                label={r.name}
                description={
                  <>
                    {r.subtitle && <span className="lm-row-sub">{r.subtitle} · </span>}
                    {r.description}
                  </>
                }
                leading={
                  r.image ? (
                    <span className="lm-row-img" style={{ backgroundImage: `url(${r.image})` }} aria-hidden="true" />
                  ) : (
                    <span className="lm-row-swatch" style={{ background: r.swatch ?? 'transparent' }} aria-hidden="true" />
                  )
                }
                trailing={<Icon name="chevron-right" size={12} />}
                onClick={() => openRow(r)}
              />
            ))}
            {rows.length === 0 && <p className="mm-sub">No device on this desk has lights the app can set.</p>}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

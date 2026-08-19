import './device-sim-hud.css';
import { Button, Icon } from '../components';
import { useDeviceSim, SIM_DEVICE_IDS } from '../state/DeviceSim';
import { useDeviceProfiles } from '../state/DeviceProfiles';
import { getResolvedSku } from './skus';
import { slotLabel } from './onboard';

/**
 * The device simulator HUD — the hardware's half of the onboard-profile
 * conversation, floated above the app so the physical acts (the profile
 * button, unplugging, coming back) can be performed *while watching the app
 * react*. Toggled from the Admin modal (`?modal=admin`); an admin/testing
 * surface, not product UI.
 *
 * Each row is one device with onboard memory. "Press profile button" is the
 * real button on the hardware: it cycles slots whether or not the app is
 * looking, exactly like the physical one. "Unplug" takes the device away —
 * presses while away are invisible to the app until "Plug in", when the app
 * reconciles what the device reports against what the profile wants.
 */
export function DeviceSimHud() {
  const { hudOpen, setHudOpen, simState, pressProfileButton, disconnect, reconnect } = useDeviceSim();
  const { deviceState } = useDeviceProfiles();
  if (!hudOpen) return null;

  return (
    <aside className="sim-hud" aria-label="Device simulator">
      <div className="sim-hud-head">
        <span className="sim-hud-title">Device simulator</span>
        <button
          type="button"
          className="sim-hud-close"
          aria-label="Hide device simulator"
          onClick={() => setHudOpen(false)}
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {SIM_DEVICE_IDS.map((id) => {
        const sku = getResolvedSku(id);
        if (!sku) return null;
        const sim = simState(id);
        const activeSlot = deviceState(id).activeSlot;
        // The hardware's own truth: away it runs deviceSlot; at the PC it is
        // either on a slot or software-driven with deviceSlot as its fallback.
        const stateLine = !sim.connected
          ? `Away · on ${slotLabel(sim.deviceSlot)}`
          : activeSlot != null
            ? `Connected · on ${slotLabel(activeSlot)}`
            : `Connected · software-driven, falls back to ${slotLabel(sim.deviceSlot)}`;

        return (
          <div className="sim-hud-row" key={id}>
            <div className="sim-hud-meta">
              <span className="sim-hud-name">{sku.name}</span>
              <span className={'sim-hud-state' + (sim.connected ? '' : ' away')}>{stateLine}</span>
            </div>
            <div className="sim-hud-actions">
              <Button
                size="sm"
                onClick={() => pressProfileButton(id)}
                aria-label={`Press the profile button on the ${sku.name}`}
              >
                <Icon name="devices" size={14} />
                Profile button
              </Button>
              <Button size="sm" onClick={() => (sim.connected ? disconnect(id) : reconnect(id))}>
                {sim.connected ? 'Unplug' : 'Plug in'}
              </Button>
            </div>
          </div>
        );
      })}
    </aside>
  );
}

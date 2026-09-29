import './device-sim-hud.css';
import { Button, Icon, Slider } from '../components';
import { useDeviceSim, SIM_DEVICE_IDS, hasProfileButton, hasBattery, skuBattery } from '../state/DeviceSim';
import { useDeviceProfiles } from '../state/DeviceProfiles';
import { getResolvedSku } from './skus';
import { useSettings } from '../state/Settings';
import { isOnDesk } from './connectedDevices';
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
  const { hudOpen, setHudOpen, simState, pressProfileButton, disconnect, reconnect, setBattery, batteryOf } =
    useDeviceSim();
  const { deviceState } = useDeviceProfiles();
  const { deskDevices } = useSettings();
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

      {/* Only what is on this desk — a device the Admin row took off the desk
          has nothing to unplug (2026-09-18, same roster as the home board). */}
      {SIM_DEVICE_IDS.filter((id) => isOnDesk(id, deskDevices)).map((id) => {
        const sku = getResolvedSku(id);
        if (!sku) return null;
        const sim = simState(id);
        const activeSlot = deviceState(id).activeSlot;
        // What this piece of hardware can actually be made to do. A display has
        // no profile button and no battery, so it is offered neither — the row
        // shrinks to the one act it does have (2026-09-01). Offering a dead
        // control on a testing surface is the same lie as offering one in the
        // product, and this is the screen we check that lie from.
        const slots = hasProfileButton(id);
        const battery = hasBattery(id);
        // Slot talk only for devices that have slots. For the rest the honest
        // sentence is the short one.
        const stateLine = !slots
          ? sim.connected
            ? 'Connected'
            : 'Away'
          : !sim.connected
            ? `Away · on ${slotLabel(sim.deviceSlot)}`
            : activeSlot != null
              ? `Connected · on ${slotLabel(activeSlot)}`
              : `Connected · software-driven, falls back to ${slotLabel(sim.deviceSlot)}`;
        const level = batteryOf(id);
        const shipped = skuBattery(id);

        return (
          <div className="sim-hud-row" key={id}>
            <div className="sim-hud-meta">
              <span className="sim-hud-name">{sku.name}</span>
              <span className={'sim-hud-state' + (sim.connected ? '' : ' away')}>{stateLine}</span>
            </div>
            <div className="sim-hud-actions">
              {slots && (
                <Button
                  size="sm"
                  onClick={() => pressProfileButton(id)}
                  aria-label={`Press the profile button on the ${sku.name}`}
                >
                  <Icon name="devices" size={14} />
                  Profile button
                </Button>
              )}
              <Button size="sm" onClick={() => (sim.connected ? disconnect(id) : reconnect(id))}>
                {sim.connected ? 'Unplug' : 'Plug in'}
              </Button>
            </div>
            {/* Battery gets its own line rather than a third button: it is a
                value, not an act, and the number has to be readable while it is
                being dragged. `Reset` hands the device back to the registry —
                without it the tester has to remember what it shipped at. */}
            {battery && level != null && (
              <div className="sim-hud-battery">
                <span className="sim-hud-batt-lbl">Battery</span>
                <Slider
                  min={0}
                  max={100}
                  value={level}
                  onChange={(v) => setBattery(id, v)}
                  aria-label={`Battery level on the ${sku.name}`}
                />
                <span className="sim-hud-batt-pct">{level}%</span>
                {shipped != null && level !== shipped && (
                  <button
                    type="button"
                    className="sim-hud-batt-reset"
                    onClick={() => setBattery(id, null)}
                    title={`Back to the ${shipped}% this device ships at`}
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

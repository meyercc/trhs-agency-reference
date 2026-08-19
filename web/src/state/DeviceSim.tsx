import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useDeviceProfiles } from './DeviceProfiles';
import { CONNECTED_DEVICE_IDS } from '../devices/connectedDevices';
import { getResolvedSku } from '../devices/skus';
import { onboardSlotCount } from '../devices/onboard';

/**
 * The simulated **device side** of the onboard-profile model (`?modal=admin` →
 * Device simulator). The app's store records what the app believes; this store
 * is the hardware's own truth, so the two can disagree — which is the point.
 *
 * Per device it keeps:
 *   • `connected` — whether the device is at this PC right now.
 *   • `deviceSlot` — the onboard slot the hardware is on. A device is *always*
 *     on some slot when the app isn't driving it; `activeSlot: null` in the app
 *     store just means the software profile is overriding it live. This is the
 *     slot it falls back to (and takes to the Xbox) the moment it leaves.
 *   • `slotAtDisconnect` — what it was on when it left, so reconnect can tell
 *     "came back changed" from "came back as it left". Only disagreements
 *     speak; a device that returns unchanged reconciles silently.
 *
 * Who wins when they disagree — one principle: **the device is the truth about
 * what it is running; the only thing that ever overrides a device-side switch
 * is a rule the user explicitly authored (a binding), and only at its declared
 * moments — profile switch and reconnect.** Everything else just reports the
 * truth and offers a one-click way back. Nothing here ever writes a slot's
 * contents: switching slots is cheap activation, never a flash write.
 */

export interface DeviceSimState {
  connected: boolean;
  deviceSlot: number;
  slotAtDisconnect: number;
}

interface SimStore {
  byDevice: Record<string, DeviceSimState>;
  /** The floating simulator panel (toggled from the Admin modal). */
  hudOpen: boolean;
}

const STORAGE_KEY = 'device-sim';
const DEFAULT_SIM: DeviceSimState = { connected: true, deviceSlot: 0, slotAtDisconnect: 0 };

function load(): SimStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { byDevice: {}, hudOpen: false, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt / private-mode */
  }
  return { byDevice: {}, hudOpen: false };
}

function persist(store: SimStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

/** The devices the simulator covers: connected devices with onboard memory. */
export const SIM_DEVICE_IDS = CONNECTED_DEVICE_IDS.filter((id) => {
  const sku = getResolvedSku(id);
  return sku ? onboardSlotCount(sku) > 0 : false;
});

interface Ctx {
  simState: (deviceId: string) => DeviceSimState;
  hudOpen: boolean;
  setHudOpen: (open: boolean) => void;
  /** The physical profile button: cycle to the next slot. Silent while away. */
  pressProfileButton: (deviceId: string) => void;
  /** Unplug — the device keeps running its current slot, out of the app's sight. */
  disconnect: (deviceId: string) => void;
  /** Plug back in — reconcile what it reports against what the profile wants. */
  reconnect: (deviceId: string) => void;
}

const DeviceSimContext = createContext<Ctx | null>(null);

export function DeviceSimProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<SimStore>(load);
  const profiles = useDeviceProfiles();

  const update = (next: (s: SimStore) => SimStore) => {
    setStore((s) => {
      const out = next(s);
      persist(out);
      return out;
    });
  };

  const simOf = (s: SimStore, id: string): DeviceSimState => s.byDevice[id] ?? DEFAULT_SIM;

  // Picking a slot in the bar while the device is here moves the hardware too —
  // selecting a slot IS switching the device to it. Returning to the software
  // profile (activeSlot: null) leaves deviceSlot — that's the fallback the
  // device keeps for when it's away.
  useEffect(() => {
    update((s) => {
      let changed = false;
      const byDevice = { ...s.byDevice };
      for (const id of SIM_DEVICE_IDS) {
        const active = profiles.deviceState(id).activeSlot;
        const sim = simOf(s, id);
        if (sim.connected && active != null && sim.deviceSlot !== active) {
          byDevice[id] = { ...sim, deviceSlot: active };
          changed = true;
        }
      }
      return changed ? { ...s, byDevice } : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.store.byDevice]);

  // Switching software profiles no longer touches onboard slots: a software
  // profile has no opinion about which slot a device runs, so a device on
  // Slot 2 stays on Slot 2 across a profile switch. (This is where bindings
  // used to assert.)

  const value = useMemo<Ctx>(
    () => ({
      simState: (id) => simOf(store, id),
      hudOpen: store.hudOpen,
      setHudOpen: (open) => update((s) => ({ ...s, hudOpen: open })),

      pressProfileButton: (id) => {
        const sku = getResolvedSku(id);
        const count = sku ? onboardSlotCount(sku) : 0;
        if (count === 0) return;
        const sim = simOf(store, id);
        const next = (sim.deviceSlot + 1) % count;
        update((s) => ({ ...s, byDevice: { ...s.byDevice, [id]: { ...simOf(s, id), deviceSlot: next } } }));
        // Connected: the app sees it happen and follows — the device is the
        // truth about what it's running, so the bar moves to the slot the
        // button landed on and says the switch came from the device.
        if (sim.connected) profiles.deviceSwitched(id, next, 'device');
      },

      disconnect: (id) =>
        update((s) => {
          const sim = simOf(s, id);
          return {
            ...s,
            byDevice: {
              ...s.byDevice,
              [id]: { ...sim, connected: false, slotAtDisconnect: sim.deviceSlot },
            },
          };
        }),

      reconnect: (id) => {
        const sim = simOf(store, id);
        if (sim.connected) return;
        const reported = sim.deviceSlot;
        const deviceSlot = reported;
        if (reported !== sim.slotAtDisconnect) {
          // It was switched while away: the device's own switch stands, and
          // the bar teaches what happened. Nothing overrules a device now.
          profiles.deviceSwitched(id, reported, 'reconnect');
        }
        // Unchanged: it came back exactly as it left — nothing to say.
        update((s) => ({
          ...s,
          byDevice: {
            ...s.byDevice,
            [id]: { ...simOf(s, id), connected: true, deviceSlot, slotAtDisconnect: deviceSlot },
          },
        }));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, profiles.store],
  );

  return <DeviceSimContext.Provider value={value}>{children}</DeviceSimContext.Provider>;
}

export function useDeviceSim(): Ctx {
  const ctx = useContext(DeviceSimContext);
  if (!ctx) throw new Error('useDeviceSim must be used inside <DeviceSimProvider>');
  return ctx;
}

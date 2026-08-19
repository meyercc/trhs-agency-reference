import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Onboard (on-device) profile state.
 *
 * There is exactly one thing here: **activeSlot**, what the device is running.
 * `null` means the software profile drives it. Selecting a slot in the profile
 * bar *is* switching the device to it, so what you are looking at and what the
 * device is running are the same fact — the bar derives its scope from this.
 *
 * Changed by the app (the bar) or by the device itself (its physical profile
 * button, or coming back from time away on a different slot). `slotSource`
 * records which, so the bar can teach how the state came to be rather than
 * pretending a device-side act was its own.
 *
 * Activation is cheap and never writes. Onboard memory is flash with finite
 * write cycles, so only the explicit Save button writes.
 */

export type ProfileScope = 'software' | number;

/** The settings a slot holds. Opaque here — the panels own their own shapes. */
export type SlotSettings = Record<string, unknown>;

/**
 * Who last put the device on its active slot. The app's own acts need no
 * explanation; a device-side switch or a reconnect adoption gets a note in the
 * profile bar saying how the state came to be.
 */
export type SlotSource = 'app' | 'device' | 'reconnect';

interface DeviceOnboardState {
  /** Saved contents per slot index. Missing = never written, shows defaults. */
  slots: Record<number, SlotSettings>;
  /** Slot the device is running, or null when the software profile drives it. */
  activeSlot: number | null;
  /** Provenance of the current activeSlot (default 'app'). */
  slotSource?: SlotSource;
}

interface Store {
  byDevice: Record<string, DeviceOnboardState>;
}

const STORAGE_KEY = 'device-onboard';

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Only byDevice is read, so state persisted by the retired binding model
    // is dropped on the way in rather than carried around.
    if (raw) return { byDevice: JSON.parse(raw).byDevice ?? {} };
  } catch {
    /* ignore corrupt / private-mode */
  }
  return { byDevice: {} };
}

function persist(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

const EMPTY_DEVICE: DeviceOnboardState = { slots: {}, activeSlot: null };

interface Ctx {
  store: Store;
  deviceState: (deviceId: string) => DeviceOnboardState;
  /** Write the working copy into a slot. The ONLY path that touches flash. */
  saveSlot: (deviceId: string, slot: number, settings: SlotSettings) => void;
  /** Make a stored slot the one the device runs. Cheap — no write. */
  activateSlot: (deviceId: string, slot: number | null) => void;
  /**
   * The device switched itself (its physical profile button, or coming back
   * from time away on a different slot). Same cheap activation, but recorded
   * with its provenance so the UI can say how the state came to be — the app
   * never pretends a device-side act was its own.
   */
  deviceSwitched: (deviceId: string, slot: number, source: 'device' | 'reconnect') => void;
  reset: () => void;
}

const DeviceProfilesContext = createContext<Ctx | null>(null);

export function DeviceProfilesProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(load);

  const update = useCallback((next: (s: Store) => Store) => {
    setStore((s) => {
      const out = next(s);
      persist(out);
      return out;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      store,
      deviceState: (deviceId) => store.byDevice[deviceId] ?? EMPTY_DEVICE,
      saveSlot: (deviceId, slot, settings) =>
        update((s) => {
          const dev = s.byDevice[deviceId] ?? EMPTY_DEVICE;
          return {
            ...s,
            byDevice: {
              ...s.byDevice,
              // Saving also makes it what the device is running — you can't
              // meaningfully save a slot you're editing and not be on it.
              [deviceId]: {
                ...dev,
                slots: { ...dev.slots, [slot]: settings },
                activeSlot: slot,
                slotSource: 'app',
              },
            },
          };
        }),
      activateSlot: (deviceId, slot) =>
        update((s) => {
          const dev = s.byDevice[deviceId] ?? EMPTY_DEVICE;
          return {
            ...s,
            byDevice: {
              ...s.byDevice,
              [deviceId]: { ...dev, activeSlot: slot, slotSource: 'app' },
            },
          };
        }),
      deviceSwitched: (deviceId, slot, source) =>
        update((s) => {
          const dev = s.byDevice[deviceId] ?? EMPTY_DEVICE;
          return {
            ...s,
            byDevice: {
              ...s.byDevice,
              [deviceId]: { ...dev, activeSlot: slot, slotSource: source },
            },
          };
        }),
      reset: () => update(() => ({ byDevice: {} })),
    }),
    [store, update],
  );

  return <DeviceProfilesContext.Provider value={value}>{children}</DeviceProfilesContext.Provider>;
}

export function useDeviceProfiles(): Ctx {
  const ctx = useContext(DeviceProfilesContext);
  if (!ctx) throw new Error('useDeviceProfiles must be used inside <DeviceProfilesProvider>');
  return ctx;
}

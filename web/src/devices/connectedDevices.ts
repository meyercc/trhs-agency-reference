import type { DeskDevice } from './arrangement';

// The set of "connected" devices shown in the global Devices panel (opened from
// the main nav). Single source of truth — one representative SKU per device the
// user owns. Order = the left→right tab order in the panel.
//
// ⚠️ This is the FULL inventory, not what is on the desk. Read `deskDeviceIds`
// below for that — every surface that lists devices does.
export const CONNECTED_DEVICE_IDS = [
  'saga-pro', // mouse    — HyperX Pulsefire Saga Pro
  'origins-65', // keyboard — HyperX Alloy Origins 65
  'cloud-iii', // headset  — HyperX Cloud III
  'treehouse-32', // monitor  — Treehouse 32 (the main display; concept SKU)
  'pulse-27', // monitor  — OMEN OLED 27
  'solocast-2-pro', // mic      — SoloCast 2 Pro
];

/**
 * Devices that are only on SOME desks, keyed to the Admin row entry that brings
 * them (`deskDevices`, Settings). Everything not listed here is on every desk.
 */
const DESK_OPTIONAL_SKU: Record<string, DeskDevice> = { 'pulse-27': 'pulse-27' };

/**
 * The devices on THIS desk — the one answer every device list reads (2026-09-18,
 * Cindy: "admin 설정값이랑 실제 디자인이 매칭이 안되는 문제. 한군데만 고치면
 * 어떻게 하니?").
 *
 * Three places used to decide "what is on the desk" on their own: the Admin
 * row (the monitor window's desk, the DESK card, Gear Switch), the Device
 * simulator (the home board, My Devices) and the SKU's two computer names. So
 * turning the OMEN OLED 27 off in Admin took it out of the desk picture and
 * left its card on the home board and its tab in My Devices. This filter is
 * the Admin half; the simulator's `connected` still layers on top of it —
 * a device that is on the desk can be unplugged, a device that is not on the
 * desk is not listed at all (it was never there to unplug).
 *
 * Takes the roster as an argument rather than reading storage: components pass
 * `useSettings().deskDevices`, which is what makes them re-render on a change.
 */
export function deskDeviceIds(desk: readonly DeskDevice[]): string[] {
  return CONNECTED_DEVICE_IDS.filter((id) => isOnDesk(id, desk));
}

/** Whether one device is on this desk — the same answer as `deskDeviceIds`. */
export function isOnDesk(id: string, desk: readonly DeskDevice[]): boolean {
  return !(id in DESK_OPTIONAL_SKU) || desk.includes(DESK_OPTIONAL_SKU[id]);
}

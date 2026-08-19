// ══════════════════════════════════════════════════════════════════════════
// Onboard (on-device) profile capability.
//
// Two different things can hold a device's settings:
//
//   • the **software profile** — app-level, spans every connected device, and
//     can drive features that only exist while Treehouse is running (layered
//     lighting, spatial audio, advanced EQ curves).
//   • an **onboard slot** — a memory location on the device itself. It holds
//     only the subset of settings the hardware can execute on its own, and it
//     is what the device runs when it's plugged into something that isn't this
//     PC (a console, a work laptop).
//
// They are NOT peers: a software profile is a setup, an onboard slot is a
// storage location. The UI leans on that distinction rather than hiding it.
//
// Naming: "onboard" throughout — code, labels, and copy. It says where the
// settings live and matches the industry term. Avoid "hardware profile", which
// reads as "a profile describing my hardware".
// ══════════════════════════════════════════════════════════════════════════
import type { ResolvedSku } from './skus';

/**
 * How many onboard slots a device exposes. Sourced from the SKU's resolved
 * features (`onboard.slots`, defaulted per type in peripheral-defaults.json),
 * so a SKU can override it and the long-tail types correctly report zero.
 */
export function onboardSlotCount(sku: ResolvedSku): number {
  const n = sku.features?.onboard?.slots;
  return typeof n === 'number' && n > 0 ? n : 0;
}

/** Does this device have onboard profiles at all? Drives showing the bar. */
export const hasOnboard = (sku: ResolvedSku): boolean => onboardSlotCount(sku) > 0;

/** Display name for a slot index (0-based). Slots are numbered, not named. */
export const slotLabel = (i: number): string => `Slot ${i + 1}`;

/**
 * What the user is currently looking at in a device panel.
 * `'software'` = the active software profile; a number = that onboard slot.
 */
export type ProfileScope = 'software' | number;

export const isOnboardScope = (s: ProfileScope): s is number => typeof s === 'number';

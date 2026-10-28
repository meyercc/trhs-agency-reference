import type { TempUnit } from '../../state/Settings';
import { formatTemp } from '../../state/units';

/**
 * The System Vitals numbers, in one place. The Performance page's readout, the
 * PC page's Performance tab and the CPU line in My Devices all read these, so
 * the three cannot disagree (JY, 2026-10-21). Simulated: the prototype has no
 * sensors. Temperatures are Celsius; show them through `toUnit` / `formatTemp`.
 */
export const VITALS = {
  cpu: { load: 44, tempC: 58 },
  gpu: { load: 37, tempC: 60 },
  ram: { load: 54, label: '18.7 GB' },
} as const;

/** The CPU temperature as the directory's System Vitals row reads it, in the player's unit. */
export function cpuReading(unit: TempUnit): string {
  return `CPU ${formatTemp(VITALS.cpu.tempC, unit)}`;
}

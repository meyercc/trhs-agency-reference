import type { TempUnit } from './Settings';

/** Convert a Celsius base value to the chosen unit (rounded). */
export function toUnit(celsius: number, unit: TempUnit): number {
  return unit === 'F' ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius);
}

/** Format a Celsius base value with its degree symbol, e.g. "45°C". */
export function formatTemp(celsius: number, unit: TempUnit): string {
  return `${toUnit(celsius, unit)}°${unit}`;
}

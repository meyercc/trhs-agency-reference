/** Small formatters the Nova surfaces share. No locale work: the app is en-US. */

/** 842 → "842", 12 400 → "12.4k", 1 180 000 → "1.18M". */
export function fmtTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** USD with the precision the size warrants: $0.0031, $0.42, $12.80. */
export function fmtUsd(n: number): string {
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Energy: 2.5 mWh, 0.42 Wh, 12.3 Wh, 1.2 kWh. A reply at "instant" demo
 * speed takes milliseconds and draws milliwatt-hours — shown as such rather
 * than rounded to a zero that reads as "nothing happened".
 */
export function fmtWh(wh: number): string {
  if (wh === 0) return '0 Wh';
  if (wh < 0.0001) return '<0.1 mWh';
  if (wh < 0.1) return `${(wh * 1000).toFixed(1)} mWh`;
  if (wh < 1) return `${wh.toFixed(2)} Wh`;
  if (wh < 1000) return `${wh.toFixed(1)} Wh`;
  return `${(wh / 1000).toFixed(2)} kWh`;
}

/** Local-calendar day key, YYYY-MM-DD — the ledger's per-day bucket. */
export function dayKey(at: number): string {
  const d = new Date(at);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function startOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY = 86_400_000;

/** "Just now" · "5m ago" · "2h ago" · "Yesterday" · "Mon" · "Sep 28". */
export function relTime(at: number, now = Date.now()): string {
  const diff = now - at;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const today = startOfToday(now);
  if (at >= today) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (at >= today - DAY) return 'Yesterday';
  if (at >= today - 6 * DAY) return new Date(at).toLocaleDateString('en-US', { weekday: 'short' });
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Which rail group a timestamp belongs in. */
export function dayGroup(at: number, now = Date.now()): 'Today' | 'Yesterday' | 'Earlier' {
  const today = startOfToday(now);
  if (at >= today) return 'Today';
  if (at >= today - DAY) return 'Yesterday';
  return 'Earlier';
}

/**
 * Token estimate when the model did not report usage — roughly four
 * characters per token for English prose. Marked `estimated` wherever it is
 * shown, so nobody mistakes it for a count.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

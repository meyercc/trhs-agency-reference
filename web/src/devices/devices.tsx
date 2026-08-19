// Legacy `?device=<id>` aliases → real SKU ids, so older deep links (and the
// Perform page's first openers) keep working now that the modal is SKU-driven.
// New links should use `?sku=<id>` against configurator/skus.json directly.
export const LEGACY_DEVICE_TO_SKU: Record<string, string> = {
  mouse: 'haste-3-pro',
  monitor: 'pulse-27',
};

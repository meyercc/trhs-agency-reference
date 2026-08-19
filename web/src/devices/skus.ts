// ══════════════════════════════════════════════════════════════════════════
// SKU data layer — the React-side port of js/sku-renderer.js's registry logic.
// Loads the same configurator/skus.json + peripheral-defaults.json, deep-merges
// a SKU's features over its type defaults, and exposes lookups + helpers so the
// device modal can render any of the 89 SKUs from data instead of hardcoding.
// ══════════════════════════════════════════════════════════════════════════
import skusJson from '../../../configurator/skus.json';
import defaultsJson from '../../../configurator/peripheral-defaults.json';

// The JSON is loosely shaped; features differ per device type. We keep the
// feature blob as an open record and read known paths in the type renderers.
export type Features = Record<string, any>;

export interface Colorway {
  id: string;
  label?: string;
  image: string;
  default?: boolean;
}

export interface SkuLinks {
  figma?: { title?: string; url: string }[];
  swpd?: string;
}

export interface Sku {
  id: string;
  name: string;
  type: string;
  status?: string;
  notes?: string;
  codenames?: string[];
  /** Component SKUs (a webcam, a GPU) name the system they belong to. */
  partOf?: string;
  links?: SkuLinks;
  colorways?: Colorway[];
  features?: Features;
}

export interface ResolvedSku extends Sku {
  /** type defaults deep-merged with the SKU's own feature overrides */
  features: Features;
}

const SKUS = (Array.isArray(skusJson) ? skusJson : []) as unknown as Sku[];
const DEFAULTS = (defaultsJson || {}) as unknown as Record<string, Features>;

// ── device images (all colorways) resolved to bundled URLs ────────────────
// import.meta.glob lets us map every Assets/devices/ hero to a URL up front, so
// colorway swaps and per-SKU heroes resolve by filename without 105 imports.
// webp is the norm; png is allowed for renders we can't re-encode to webp here
// (e.g. treehouse-32.png — the reframed concept-monitor render, 2026-07-23).
const IMG = import.meta.glob('../../../Assets/devices/*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function deviceImageUrl(file?: string | null): string | undefined {
  if (!file) return undefined;
  const key = Object.keys(IMG).find((k) => k.endsWith('/' + file));
  return key ? IMG[key] : undefined;
}

// ── deep merge (SKU `false` explicitly disables a default-on feature) ──────
function deepMerge(base: any, overrides: any): any {
  if (overrides === false) return false;
  if (overrides == null) return base;
  if (typeof base !== 'object' || base === null) return overrides;
  if (typeof overrides !== 'object') return overrides;
  if (Array.isArray(base) || Array.isArray(overrides)) return overrides;
  const out: Record<string, any> = { ...base };
  for (const key of Object.keys(overrides)) out[key] = deepMerge(base[key], overrides[key]);
  return out;
}

/** Walk a dot-path; a `false` anywhere along the way disables the subtree. */
export function resolvePath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  let cur = obj;
  for (const key of path.split('.')) {
    if (cur === false) return false;
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Merge a SKU's features over its type defaults — the renderer reads this. */
export function resolveSku(sku: Sku): ResolvedSku {
  const typeDefaults = DEFAULTS[sku.type] || {};
  const merged = deepMerge(typeDefaults, sku.features || {});
  return { ...sku, features: merged || {} };
}

// ── lookups ───────────────────────────────────────────────────────────────
export function getSku(id: string): Sku | undefined {
  return SKUS.find((s) => s.id === id);
}
export function getResolvedSku(id: string): ResolvedSku | undefined {
  const sku = getSku(id);
  return sku ? resolveSku(sku) : undefined;
}
export const allSkus = SKUS;
export function skusByType(type: string): Sku[] {
  return SKUS.filter((s) => s.type === type);
}

// ── hero image: default colorway, else the SKU-id image ───────────────────
export function heroImageFile(sku: Sku): string | undefined {
  if (Array.isArray(sku.colorways) && sku.colorways.length) {
    const def = sku.colorways.find((c) => c.default) || sku.colorways[0];
    if (def?.image) return def.image;
  }
  return sku.id ? sku.id + '.webp' : undefined;
}

// ── connection status (mirror sku-renderer's wired/wireless label) ────────
export interface ConnStatus {
  wireless: boolean;
  label: string;
  batteryLevel: number | null;
  charging: boolean;
}
export function connectionStatus(features: Features): ConnStatus {
  const connectivity = features?.connectivity;
  const wireless = connectivity === 'wireless' || connectivity === 'dual';
  const power = features?.power && typeof features.power === 'object' ? features.power : {};
  const level = typeof power.batteryLevel === 'number' ? power.batteryLevel : null;
  const charging = !!power.charging;
  if (!wireless) return { wireless: false, label: 'Connected · USB', batteryLevel: null, charging: false };
  let label = 'Wireless';
  if (level != null) label += ' · ' + Math.round(level) + '%';
  if (charging) label += ' · Charging';
  return { wireless: true, label, batteryLevel: level, charging };
}

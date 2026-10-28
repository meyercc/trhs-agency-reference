import type { AdPlacement } from '../state/Settings';

// ── Advertising concepts (2026-09-29) ─────────────────────────────────────────
// Placements to compare, not a product decision: every one is OFF unless Admin
// turns it on, and nothing here ships a real ad. The sizes are IAB standard
// units — a 300×250 medium rectangle and a 728×90 leaderboard — which is why
// they are fixed pixel dimensions rather than design tokens: an ad network
// dictates them, the design scale does not. They live in ads.css as
// `--ad-*` custom properties so the whole system has one copy.

/** The ad unit a placement shows. */
export type AdSize = 'tile' | 'banner';

/**
 * Pixel dimensions per unit — for the placeholder caption only. The RENDERED
 * size comes from the `--ad-*` custom properties in ads.css, so these are a
 * second copy of the same four numbers: change a unit there and here together.
 * verify-ads.mjs asserts both the rendered box and the caption, so the two
 * cannot drift apart unnoticed.
 */
export const AD_DIMENSIONS: Record<AdSize, { w: number; h: number }> = {
  tile: { w: 300, h: 250 },
  banner: { w: 728, h: 90 },
};

export interface AdOption {
  value: AdPlacement;
  label: string;
  /** Which unit the placement shows; `none` shows nothing. */
  size?: AdSize;
  /** Where it renders. Fixed placements follow every page; inline ones belong to one. */
  where: 'none' | 'fixed' | 'home';
}

/** The Admin dropdown, in the order the concepts were named. */
export const AD_OPTIONS: AdOption[] = [
  { value: 'none', label: 'No ads', where: 'none' },
  { value: 'bottom-left-tile', label: 'Bottom Left Tile', size: 'tile', where: 'fixed' },
  { value: 'bottom-banner', label: 'Bottom Banner', size: 'banner', where: 'fixed' },
  { value: 'banner-below-carousel', label: 'Banner Below Carousel', size: 'banner', where: 'home' },
];

export const AD_OPTION_BY_VALUE: Record<AdPlacement, AdOption> = Object.fromEntries(
  AD_OPTIONS.map((o) => [o.value, o]),
) as Record<AdPlacement, AdOption>;

/** The placeholder caption: the unit's size, e.g. `300x250`. */
export const adLabel = (size: AdSize) => `${AD_DIMENSIONS[size].w}x${AD_DIMENSIONS[size].h}`;

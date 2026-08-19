// ══════════════════════════════════════════════════════════════════════════
// Module registry — the single source of truth for the Module Browser/store.
// Architecturally, nearly every feature is an optional *module*: installing or
// removing one adds/removes its surfaces across the app (widgets, nav tabs,
// feature modals, Perform cards). The registry declares each module + which
// surfaces belong to it; the ModulesProvider owns install state; consumers gate
// their own rendering via useModules().has(id) + the *_MODULE maps below.
//
// Add a module → add a MODULES entry + map its surfaces here, then gate the
// surface at its render site (`useModules().has(id)`).
// ══════════════════════════════════════════════════════════════════════════
import type { IconName } from '../components';

export type ModuleCategory = 'performance' | 'personalization' | 'play' | 'shop';

export interface ModuleDef {
  id: string;
  name: string;
  category: ModuleCategory;
  icon: IconName;
  /** Short one-liner shown on cards. */
  tagline: string;
  /** Longer benefits copy shown on the detail / What's New hero. */
  description: string;
  /** Surfaces this module adds — shown as "Includes" on the detail page. */
  features: string[];
  /** What removing the module hides — shown in the remove confirmation. */
  removeEffects: string[];
  /** Surfaced under "Recommended" on the What's New landing. */
  recommended?: boolean;
  /** Surfaced under "New" on the What's New landing. */
  isNew?: boolean;
  /** Installable, but its in-app feature is still being built. */
  comingSoon?: boolean;
  /** Defaults to true — set false to ship uninstalled. */
  defaultInstalled?: boolean;
}

// ── Category metadata (drives the left nav, in order) ──────────────────────
export interface CategoryDef {
  id: ModuleCategory;
  label: string;
  icon: IconName;
}
export const CATEGORIES: CategoryDef[] = [
  { id: 'performance', label: 'Performance', icon: 'performance' },
  { id: 'personalization', label: 'Personalization', icon: 'lights' },
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
];

// ── Modules ────────────────────────────────────────────────────────────────
export const MODULES: ModuleDef[] = [
  // Performance
  {
    id: 'omenai',
    name: 'OMEN AI',
    category: 'performance',
    icon: 'ai',
    tagline: 'Adaptive, per-game AI performance tuning.',
    description:
      'OMEN AI learns the best CPU/GPU configuration for each game and tunes your machine automatically. Get the dashboard widget, the Optimizer card, and the full profiles experience.',
    features: ['Dashboard widget', 'Optimizer card in Perform', 'Per-game AI profiles modal'],
    removeEffects: [
      'The OMEN AI dashboard widget is removed',
      'The OMEN AI card in Perform → Optimizer is hidden',
      'The OMEN AI configuration modal is disabled',
    ],
    recommended: true,
  },
  {
    id: 'booster',
    name: 'Booster',
    category: 'performance',
    icon: 'lightning',
    tagline: 'One-click system optimization scan + boost.',
    description:
      'Free up memory, quiet background processes, and squeeze out extra frames with a single scan-and-boost. Includes the dashboard widget and the Optimizer card.',
    features: ['Dashboard widget', 'Optimizer card in Perform', 'Scan + Boost modal'],
    removeEffects: [
      'The Booster dashboard widget is removed',
      'The Booster card in Perform → Optimizer is hidden',
      'The Booster modal is disabled',
    ],
    recommended: true,
  },
  {
    id: 'cleaner',
    name: 'System Cleaner',
    category: 'performance',
    icon: 'sparks',
    tagline: 'Reclaim disk space from temp + junk files.',
    description:
      'Scan for reclaimable space — temp files, caches, and leftovers — and clean it in one pass. Lives in Perform → Maintenance.',
    features: ['System Cleaner card in Perform → Maintenance'],
    removeEffects: ['The System Cleaner card in Perform → Maintenance is hidden'],
  },
  {
    id: 'fancleaner',
    name: 'Fan Cleaner',
    category: 'performance',
    icon: 'refresh',
    tagline: 'Fan health monitoring + a dust-removal guide.',
    description:
      'Keep an eye on fan health and run the guided dust-removal routine to keep thermals in check. Lives in Perform → Maintenance.',
    features: ['Fan Cleaner card in Perform → Maintenance'],
    removeEffects: ['The Fan Cleaner card in Perform → Maintenance is hidden'],
  },
  {
    id: 'vitals',
    name: 'System Vitals',
    category: 'performance',
    icon: 'heartbeat',
    tagline: 'Live CPU, GPU, memory, and thermal monitoring.',
    description:
      'Keep an eye on every core, clock, and temperature — a live vitals widget on your dashboard, the monitoring bar on Perform, and a full-details modal with per-component history.',
    features: [
      'System Vitals dashboard widget',
      'Monitoring bar on Perform',
      'Full System Vitals modal (6 tabs)',
    ],
    removeEffects: [
      'The System Vitals dashboard widget is removed',
      'The Monitoring bar on the Perform page is hidden',
      'The full System Vitals modal is disabled',
    ],
  },
  // Personalization
  {
    id: 'lightstudio',
    name: 'Light Studio',
    category: 'personalization',
    icon: 'lights',
    tagline: 'Live 3D device viewport with inline RGB controls.',
    description:
      'A full 3D rendering of your connected devices with lighting controls right on the model — pick colors, effects, and brightness with no menus. Includes the dashboard widget.',
    features: ['Light Studio section on Personalize', '3D device desk + inline RGB controls', 'Dashboard widget'],
    removeEffects: [
      'The Light Studio section on Personalize is hidden',
      'The Light Studio dashboard widget is removed',
    ],
    isNew: true,
  },
  // Play
  {
    id: 'gallery',
    name: 'Gallery',
    category: 'play',
    icon: 'image',
    tagline: 'Community screenshots, clips, and your captures.',
    description:
      'Browse community screenshots and clips, and keep your best captures front and center with gallery highlights and widgets.',
    features: ['Gallery on the Play page', 'Community screenshots & clips'],
    removeEffects: ['The Gallery row on the Play page is hidden'],
    isNew: true,
  },
  // Shop
  {
    id: 'shop',
    name: 'Shop',
    category: 'shop',
    icon: 'shop',
    tagline: 'Game store, deals, pricing, and the Shop tab.',
    description:
      'Browse, compare, and buy PC games without leaving the hub. Adds the Shop tab, curated deal widgets on your dashboard, and store search results.',
    features: ['Shop tab in the main nav', "Today's Deals dashboard widget", 'Store search results'],
    removeEffects: [
      'The Shop tab is hidden from the main navigation',
      "The Today's Deals widget is removed from your dashboard",
      'Store-related search results no longer appear',
    ],
  },
];

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const MODULES_BY_CATEGORY = (cat: ModuleCategory): ModuleDef[] => MODULES.filter((m) => m.category === cat);

// ── Surface → module maps (gate the surface with useModules().has(id)) ──────
/** Dashboard widget id → module id (widgets that belong to a module). */
export const WIDGET_MODULE: Record<string, string> = {
  omenai: 'omenai',
  booster: 'booster',
  deals: 'shop',
  light: 'lightstudio',
  vitals: 'vitals',
};
/** Nav tab id → module id (tabs gated behind a module). */
export const NAV_MODULE: Record<string, string> = {
  shop: 'shop',
};
/** Feature-modal id (?modal=) → module id (modals gated behind a module). */
export const MODAL_MODULE: Record<string, string> = {
  omenai: 'omenai',
  booster: 'booster',
  vitals: 'vitals',
};

// ══════════════════════════════════════════════════════════════════════════
// App Atlas data — the curated map of every user-facing surface (pages, modals,
// panels) and how they connect. This is a hand-authored architecture doc, not
// an auto-scrape: the edges encode *intent* (what launches what), which is what
// makes it a teaching artifact. Seeded from the real deep-link wiring:
//   pages/*  →  setParams({ modal|sku })  ·  navigate('/…')  ·  nav items
// Update this file when you add a surface or a launch path.
// ══════════════════════════════════════════════════════════════════════════

export type SurfaceKind = 'page' | 'feature-modal' | 'device-modal' | 'panel' | 'alt';

// A `type` (not interface) so it satisfies React Flow's `Record<string, unknown>`
// node-data constraint (type aliases get an implicit index signature).
export type SurfaceNodeData = {
  title: string;
  kind: SurfaceKind;
  /** One-line "what is this" for newcomers. */
  blurb: string;
  /** Hash-router target this surface lives at (params included). */
  hash: string;
  /** Source file(s), shown in the node footer as a pointer into the code. */
  source: string;
  /** Reachable from anywhere in the app shell (nav / profile menu). */
  global?: boolean;
};

export interface AtlasNode {
  id: string;
  position: { x: number; y: number };
  data: SurfaceNodeData;
}

export type EdgeKind = 'nav' | 'opens-feature' | 'opens-device' | 'alt';

export interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  /** Which handles to route through (t/b/l/r). Defaults chosen per kind. */
  from?: 'b' | 'r';
  to?: 't' | 'l';
}

// ── Layout bands ──────────────────────────────────────────────────────────
// Band 1 (y=0):    Pages — the top-nav tabs, left→right in nav order, then the
//                  Devices panel (the 6th nav item) at the far right.
// Band 2 (y=520):  Feature modals — hang below the pages that launch them.
// Right column:    Device modals — under the Devices panel that opens them.
const PAGE_Y = 0;
const MODAL_Y = 520;
const DEVICE_X = 2360;

export const ATLAS_NODES: AtlasNode[] = [
  // ── Pages (app shell) ──
  {
    id: 'home',
    position: { x: 0, y: PAGE_Y },
    data: {
      title: 'Dashboard',
      kind: 'page',
      blurb: 'Home board of draggable widgets — the launch hub for most modals.',
      hash: '#/',
      source: 'pages/Home.tsx',
    },
  },
  {
    id: 'play',
    position: { x: 1380, y: PAGE_Y },
    data: {
      title: 'Play',
      kind: 'page',
      blurb: 'Game library / launcher.',
      hash: '#/play',
      source: 'pages/Play.tsx',
    },
  },
  {
    id: 'perform',
    position: { x: 460, y: PAGE_Y },
    data: {
      title: 'Perform',
      kind: 'page',
      blurb: 'System monitoring, optimizer, power & thermal, and maintenance.',
      hash: '#/perform',
      source: 'pages/Perform.tsx',
    },
  },
  {
    id: 'personalize',
    position: { x: 920, y: PAGE_Y },
    data: {
      title: 'Personalize',
      kind: 'page',
      blurb: 'Appearance (theme/accent/wallpaper) and lighting.',
      hash: '#/personalize',
      source: 'pages/Personalize.tsx',
    },
  },
  {
    id: 'shop',
    position: { x: 1840, y: PAGE_Y },
    data: {
      title: 'Shop',
      kind: 'page',
      blurb: 'Store — deals, Game Pass, featured.',
      hash: '#/shop',
      source: 'pages/Shop.tsx',
    },
  },
  {
    id: 'metro',
    position: { x: 0, y: 960 },
    data: {
      title: 'Metro',
      kind: 'alt',
      blurb: 'Experimental full-screen panorama dashboard (outside the app shell).',
      hash: '#/metro',
      source: 'metro/MetroDashboard.tsx',
    },
  },

  // ── Devices panel (global nav flyout) ──
  {
    id: 'devices',
    position: { x: DEVICE_X, y: PAGE_Y },
    data: {
      title: 'Devices Panel',
      kind: 'panel',
      blurb:
        'Global "My Devices" flyout, opened from the main nav. Device icons across the top swap the hero; feature shortcuts deep-link into each device modal.',
      hash: '#/?devices=1',
      source: 'app/DevicePanel.tsx',
      global: true,
    },
  },

  // ── Module Browser / store (global nav button) ──
  {
    id: 'modules',
    position: { x: 560, y: 960 },
    data: {
      title: 'Module Browser',
      kind: 'feature-modal',
      blurb:
        'Module store, opened from the persistent nav button. Install/remove optional modules — removing one hides its surfaces app-wide (nav tabs, widgets, cards).',
      hash: '#/?modal=modules',
      source: 'modules/ModuleBrowserModal.tsx',
      global: true,
    },
  },

  // ── Feature modals (?modal=) ──
  {
    id: 'omenai',
    position: { x: 300, y: MODAL_Y },
    data: {
      title: 'OMEN AI',
      kind: 'feature-modal',
      blurb: 'Per-game AI performance profiles.',
      hash: '#/?modal=omenai',
      source: 'modals/OmenAiModal.tsx',
    },
  },
  {
    id: 'booster',
    position: { x: 760, y: MODAL_Y },
    data: {
      title: 'Booster',
      kind: 'feature-modal',
      blurb: 'One-click system optimization scan + boost.',
      hash: '#/?modal=booster',
      source: 'modals/BoosterModal.tsx',
    },
  },
  {
    id: 'vitals',
    position: { x: 1220, y: MODAL_Y },
    data: {
      title: 'System Vitals',
      kind: 'feature-modal',
      blurb: 'Full-details charts: CPU/GPU/RAM/Network/Storage.',
      hash: '#/?modal=vitals',
      source: 'modals/VitalsModal.tsx',
    },
  },
  {
    id: 'settings',
    position: { x: 1680, y: MODAL_Y },
    data: {
      title: 'Settings',
      kind: 'feature-modal',
      blurb: 'App preferences (nav visibility, …). Opened from the profile menu.',
      hash: '#/?modal=settings',
      source: 'modals/SettingsModal.tsx',
      global: true,
    },
  },

  // ── Device modals (?sku=) — one node per canvas family, representative SKU ──
  {
    id: 'dev-mouse',
    position: { x: DEVICE_X, y: 520 },
    data: {
      title: 'Mouse Modal',
      kind: 'device-modal',
      blurb: 'Full-canvas DeviceCanvas + Ng3 panel. Renderer for type=mouse.',
      hash: '#/?sku=saga-pro',
      source: 'devices/DeviceCanvas.tsx',
    },
  },
  {
    id: 'dev-keyboard',
    position: { x: DEVICE_X, y: 900 },
    data: {
      title: 'Keyboard Modal',
      kind: 'device-modal',
      blurb: 'Full-canvas KeyboardCanvas (Lighting / Keys / Settings). type=keyboard.',
      hash: '#/?sku=origins-65',
      source: 'devices/KeyboardCanvas.tsx',
    },
  },
  {
    id: 'dev-generic',
    position: { x: DEVICE_X, y: 1280 },
    data: {
      title: 'Spec Canvas',
      kind: 'device-modal',
      blurb: 'Schema-driven NG3 canvas for the long tail (webcam / trackpad / notebook I-O / desktop components).',
      hash: '#/?sku=forge-45l-gpu',
      source: 'devices/SpecCanvas.tsx',
    },
  },
];

export const ATLAS_EDGES: AtlasEdge[] = [
  // ── Top-nav (page ↔ page ↔ Devices), left→right in nav order ──
  { id: 'n1', source: 'home', target: 'perform', kind: 'nav', from: 'r', to: 'l' },
  { id: 'n2', source: 'perform', target: 'personalize', kind: 'nav', from: 'r', to: 'l' },
  { id: 'n3', source: 'personalize', target: 'play', kind: 'nav', from: 'r', to: 'l' },
  { id: 'n4', source: 'play', target: 'shop', kind: 'nav', from: 'r', to: 'l' },
  { id: 'n5', source: 'shop', target: 'devices', kind: 'nav', label: 'nav item', from: 'r', to: 'l' },

  // ── Alt dashboard ──
  { id: 'a1', source: 'home', target: 'metro', kind: 'alt', label: 'Metro button', from: 'b', to: 't' },

  // ── Feature modals — who opens them ──
  { id: 'f1', source: 'home', target: 'omenai', kind: 'opens-feature', label: 'OMEN AI widget', from: 'b', to: 't' },
  { id: 'f2', source: 'home', target: 'booster', kind: 'opens-feature', label: 'Booster widget', from: 'b', to: 't' },
  { id: 'f3', source: 'home', target: 'vitals', kind: 'opens-feature', label: 'Vitals widget', from: 'b', to: 't' },
  { id: 'f4', source: 'perform', target: 'omenai', kind: 'opens-feature', label: 'Optimizer', from: 'b', to: 't' },
  { id: 'f5', source: 'perform', target: 'booster', kind: 'opens-feature', label: 'Optimizer', from: 'b', to: 't' },
  { id: 'f6', source: 'perform', target: 'vitals', kind: 'opens-feature', label: 'Monitoring bar', from: 'b', to: 't' },
  { id: 'f7', source: 'home', target: 'settings', kind: 'opens-feature', label: 'Profile menu (global)', from: 'b', to: 't' },
  { id: 'f8', source: 'home', target: 'modules', kind: 'opens-feature', label: 'Modules button (global)', from: 'b', to: 't' },

  // ── Device modals — the Devices panel is the primary launcher (a shortcut per
  //    feature); the Dashboard's device widgets are a secondary launcher. ──
  { id: 'd1', source: 'devices', target: 'dev-mouse', kind: 'opens-device', label: 'mouse shortcut', from: 'b', to: 'l' },
  { id: 'd2', source: 'devices', target: 'dev-keyboard', kind: 'opens-device', label: 'keyboard shortcut', from: 'b', to: 'l' },
  { id: 'd3', source: 'devices', target: 'dev-generic', kind: 'opens-device', label: 'monitor / headset / mic', from: 'b', to: 'l' },
  { id: 'd4', source: 'home', target: 'dev-mouse', kind: 'opens-device', label: 'device widget', from: 'r', to: 'l' },
  { id: 'd5', source: 'home', target: 'dev-generic', kind: 'opens-device', label: 'device widget', from: 'r', to: 'l' },
];

// ── Legend / edge styling ─────────────────────────────────────────────────
export const EDGE_STYLE: Record<EdgeKind, { color: string; label: string; dashed?: boolean }> = {
  nav: { color: 'var(--text-muted)', label: 'Top nav', dashed: true },
  'opens-feature': { color: 'var(--accent-color)', label: 'Opens feature modal' },
  'opens-device': { color: '#f6a13c', label: 'Opens device modal' },
  alt: { color: '#b38cf0', label: 'Alt dashboard' },
};

export const KIND_LABEL: Record<SurfaceKind, string> = {
  page: 'Page',
  'feature-modal': 'Feature modal',
  'device-modal': 'Device modal',
  panel: 'Panel',
  alt: 'Alt view',
};

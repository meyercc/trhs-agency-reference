// ══════════════════════════════════════════════════════════════════════════
// Tracker features — every user-facing feature, grouped by the page it lives on,
// for treehouse-tracker (the status site). Its `npm run sync:prototype` imports
// this file and snapshots it, so this is where the tracker's structure comes from.
//
// App pages are hand-authored, like atlasData.ts: when you add a section, card or
// URL-openable modal, add it here. Device pages are computed from deviceTabs(),
// so a new device tab appears in the tracker without touching this file.
//
// Each `hash` is a deep link the tracker loads in a scaled iframe. `?section=`
// (app/useSectionParam) scrolls to a `data-section`, `data-widget` or
// `data-feature` target. Keep this file free of React and CSS imports: it runs
// under Node as well as Vite.
// ══════════════════════════════════════════════════════════════════════════

import { deviceTabs } from '../devices/deviceTabs';
import { getResolvedSku, type ResolvedSku } from '../devices/skus';
import { capsOf } from '../devices/pcLighting';

export type TrackedPageKind = 'app' | 'device' | 'app-wide';

export interface TrackedFeature {
  /** Stable within its page; the tracker keys status by `<pageId>/<featureId>`. */
  id: string;
  title: string;
  /** Hash-router deep link, params included. */
  hash: string;
  /** File that renders it, relative to web/src. */
  source: string;
  /**
   * CSS selector for the feature's own region, when the deep link doesn't name one (a comma list
   * covers a region split across siblings). The tracker's
   * UX assessment reads this region; `?section=` targets, `?modal=` (.modal-shell), `?sku=`
   * (.dc-canvas) and `?devices=1` (.device-panel) are found without it.
   */
  root?: string;
  /**
   * Selector to click once after loading, for screens reachable only from a button (no deep link).
   * The tracker uses it to reach the screen, not to test the control.
   */
  open?: string;
  /** Module that must be installed for it to render (modules/registry.ts). */
  module?: string;
  /** Anything a reviewer should know: what the link can't reach, gating, variants. */
  note?: string;
}

export interface TrackedPage {
  id: string;
  title: string;
  kind: TrackedPageKind;
  hash: string;
  source: string;
  module?: string;
  note?: string;
  features: TrackedFeature[];
}

// ── App pages (the top nav, in nav order) ─────────────────────────────────

const HOME: TrackedPage = {
  id: 'home',
  title: 'Home',
  kind: 'app',
  hash: '#/',
  source: 'pages/Home.tsx',
  note: 'A widget board. The layout is editable and saved, so it shows the default board only on clean storage.',
  features: [
    { id: 'carousel', title: 'Carousel', hash: '#/', root: '.home-carousel', source: 'pages/homeSlides.tsx', note: 'Auto-advances on a timer.' },
    { id: 'dev-treehouse', title: 'Treehouse 32 widget', hash: '#/?section=dev-treehouse', source: 'widgets/DeviceWidget.tsx' },
    { id: 'dev-mouse', title: 'Mouse widget', hash: '#/?section=dev-mouse', source: 'widgets/DeviceWidget.tsx' },
    { id: 'dev-monitor', title: 'Monitor widget', hash: '#/?section=dev-monitor', source: 'widgets/DeviceWidget.tsx', note: 'Hidden when pulse-27 is not on the desk.' },
    { id: 'dev-headset', title: 'Headset widget', hash: '#/?section=dev-headset', source: 'widgets/DeviceWidget.tsx' },
    { id: 'dev-laptop', title: 'Laptop widget', hash: '#/?section=dev-laptop', source: 'widgets/DeviceWidget.tsx' },
    { id: 'lastplayed', title: 'Last Played', hash: '#/?section=lastplayed', source: 'widgets/LastPlayedWidget.tsx' },
    { id: 'widget-picker', title: 'Add a widget', hash: '#/', open: '.wb-add', root: '.wb-pick', source: 'widgets/WidgetPicker.tsx', note: 'Opens from "Add a widget" under the board; not URL-openable.' },
  ],
};

const PERFORM: TrackedPage = {
  id: 'perform',
  title: 'Performance',
  kind: 'app',
  hash: '#/perform',
  source: 'pages/PerformV7.tsx',
  note: "The cards' modals (Unleash, Network Booster, Booster, OMEN AI, Cleaner, Vitals) open from page state and can't be deep-linked.",
  features: [
    { id: 'system-vitals', title: 'System Vitals', hash: '#/perform?section=system-vitals', source: 'pages/PerformV7.tsx' },
    { id: 'top-processes', title: 'Top Processes', hash: '#/perform?section=top-processes', source: 'widgets/perform5/TopProcessesCard.tsx' },
    { id: 'power-mode', title: 'Power Mode', hash: '#/perform?section=power-mode', source: 'widgets/perform5/PowerModeCard.tsx' },
    { id: 'omen-ai', title: 'OMEN AI', hash: '#/perform?section=omen-ai', source: 'pages/PerformV7.tsx' },
    { id: 'booster', title: 'Booster', hash: '#/perform?section=booster', source: 'pages/PerformV7.tsx' },
    { id: 'network-booster', title: 'Network Booster', hash: '#/perform?section=network-booster', source: 'pages/PerformV7.tsx' },
    { id: 'system-cleaner', title: 'System Cleaner', hash: '#/perform?section=system-cleaner', source: 'pages/PerformV7.tsx' },
    { id: 'fan-cleaner', title: 'Fan Cleaner', hash: '#/perform?section=fan-cleaner', source: 'pages/PerformV7.tsx' },
  ],
};

const PERSONALIZE: TrackedPage = {
  id: 'personalize',
  title: 'Personalize',
  kind: 'app',
  hash: '#/personalize',
  source: 'pages/Personalize.tsx',
  note: 'Defaults to the "Playing Valorant" scenario; `?context=valorant|meeting|late|stream` switches it (and is saved).',
  features: [
    { id: 'context-strip', title: 'Context strip', hash: '#/personalize', root: '.qc-strip', source: 'pages/Personalize.tsx' },
    { id: 'suggestion', title: 'Suggestion', hash: '#/personalize', root: '.qc-suggestions', source: 'pages/personalize/tiles.tsx', note: 'Gone once suggestions are dismissed (saved).' },
    { id: 'profiles', title: 'Profiles', hash: '#/personalize?section=profiles', source: 'widgets/ProfilesManager.tsx' },
    { id: 'lighting', title: 'Lighting', hash: '#/personalize?section=lighting', source: 'pages/personalize/tiles.tsx', note: 'Lazy-loads a 3D desk.' },
    { id: 'lighting-studio', title: 'Lighting studio', hash: '#/personalize?modal=lighting', source: 'modals/FeatureModalHost.tsx', note: 'The modal the Lighting tile opens.' },
    { id: 'quick-controls', title: 'Quick controls', hash: '#/personalize?section=controls', source: 'pages/Personalize.tsx' },
    { id: 'devices', title: 'Devices', hash: '#/personalize?section=devices', source: 'pages/personalize/DeskSection.tsx' },
    { id: 'display', title: 'Display', hash: '#/personalize?section=display', source: 'widgets/DeskWidget.tsx', module: 'desk', note: 'Desk, All monitors and Smart actions widgets.' },
    { id: 'everything-else', title: 'Everything else', hash: '#/personalize?section=everything', source: 'pages/Personalize.tsx' },
  ],
};

const PLAY: TrackedPage = {
  id: 'play',
  title: 'Play',
  kind: 'app',
  hash: '#/play',
  source: 'pages/Play.tsx',
  features: [
    { id: 'hero', title: 'Hero', hash: '#/play', root: '.play-hero, .play-hero-rail', source: 'pages/PlayHero.tsx', note: 'Fixed behind the page, so it shows under every section. Admin can swap it for Jump Back In.' },
    { id: 'my-games', title: 'My Games', hash: '#/play?section=library', source: 'pages/PlayLibrary.tsx' },
    { id: 'gallery', title: 'Gallery', hash: '#/play?section=gallery', source: 'pages/GallerySection.tsx', module: 'gallery' },
  ],
};

const SHOP: TrackedPage = {
  id: 'shop',
  title: 'Shop',
  kind: 'app',
  hash: '#/shop',
  source: 'pages/Shop.tsx',
  module: 'shop',
  features: [
    { id: 'featured-bundle', title: 'Featured bundle', hash: '#/shop', root: '.ds-card.overlay', source: 'pages/Shop.tsx' },
    { id: 'new-releases', title: 'New Releases', hash: '#/shop?section=new-releases', source: 'pages/Shop.tsx' },
    { id: 'weekly-deals', title: 'Weekly Deals', hash: '#/shop?section=weekly-deals', source: 'pages/Shop.tsx' },
    { id: 'free-to-play', title: 'Free to Play', hash: '#/shop?section=free-to-play', source: 'pages/Shop.tsx' },
  ],
};

const NOVA: TrackedPage = {
  id: 'nova',
  title: 'Nova',
  kind: 'app',
  hash: '#/nova',
  source: 'pages/Nova.tsx',
  module: 'nova',
  note: 'Nova ships uninstalled; until it is installed (Modules › Performance › Nova) the route redirects to Home.',
  features: [
    { id: 'chat', title: 'Chat', hash: '#/nova', root: '.nova-chat', source: 'pages/Nova.tsx', module: 'nova', note: 'Conversation and context rails collapse below 900px / 1024px.' },
    { id: 'composer', title: 'Composer', hash: '#/nova', root: '.nova-compose', source: 'nova/', module: 'nova' },
    { id: 'agents', title: 'Agents', hash: '#/nova?view=agents', root: '.nova-agents', source: 'pages/Nova.tsx', module: 'nova', note: 'Stats, tokens per day, recent activity and the agent catalog.' },
  ],
};

// ── App-wide surfaces (no page of their own) ──────────────────────────────

const APP_WIDE: TrackedPage = {
  id: 'app-wide',
  title: 'App-wide',
  kind: 'app-wide',
  hash: '#/',
  source: 'app/AppShell.tsx',
  note: 'Surfaces reachable from anywhere. Admin is left out: opening it writes state.',
  features: [
    { id: 'devices-panel', title: 'Devices panel', hash: '#/?devices=1', source: 'app/AppShell.tsx' },
    { id: 'settings', title: 'Settings', hash: '#/?modal=settings', source: 'modals/FeatureModalHost.tsx' },
    { id: 'profiles', title: 'Profiles', hash: '#/?modal=profiles', source: 'modals/FeatureModalHost.tsx' },
    { id: 'modules', title: 'Modules', hash: '#/?modal=modules', source: 'modals/FeatureModalHost.tsx' },
    { id: 'agents', title: 'Agents', hash: '#/?modal=agents', source: 'modals/FeatureModalHost.tsx' },
    { id: 'onboarding', title: 'Onboarding', hash: '#/onboarding', root: '.onb', source: 'onboarding/Onboarding.tsx' },
    { id: 'metro', title: 'Metro dashboard', hash: '#/metro', root: '.metro-grid', source: 'metro/MetroDashboard.tsx' },
  ],
};

// ── Device pages (computed from deviceTabs) ───────────────────────────────

/** Which canvas DeviceModalHost renders for a SKU (mirrors its routing). */
function canvasFor(sku: ResolvedSku): string {
  switch (sku.type) {
    case 'mouse': return 'devices/DeviceCanvas.tsx';
    case 'keyboard': return 'devices/KeyboardCanvas.tsx';
    case 'headset': return 'devices/HeadsetCanvas.tsx';
    case 'monitor': return 'devices/MonitorCanvas.tsx';
    case 'microphone': return 'devices/MicCanvas.tsx';
    default:
      return sku.type === 'notebook' && capsOf(sku.features ?? {}).keyboard !== 'none'
        ? 'devices/LaptopCanvas.tsx'
        : 'devices/SpecCanvas.tsx';
  }
}

function sku(id: string): ResolvedSku {
  const found = getResolvedSku(id);
  if (!found) throw new Error(`trackerFeatures: unknown SKU "${id}"`);
  return found;
}

/** One feature per tab of a SKU. `prefix` keeps ids unique when a page shows two modal shapes. */
function tabFeatures(id: string, prefix = '', note?: string): TrackedFeature[] {
  const s = sku(id);
  return deviceTabs(s).map((tab) => ({
    id: prefix + tab.id,
    title: tab.title,
    hash: `#/?sku=${id}&tab=${tab.id}`,
    source: canvasFor(s),
    ...(note ? { note } : {}),
  }));
}

/** Component SKUs (a GPU, a webcam) open their own spec sheet; one feature each. */
function componentFeatures(ids: string[]): TrackedFeature[] {
  return ids.map((id) => {
    const s = sku(id);
    return {
      id: s.type.replace(/^(desktop|notebook)-/, ''),
      title: s.name.split(' — ')[1] ?? s.name,
      hash: `#/?sku=${id}`,
      source: canvasFor(s),
      note: `Component of ${s.name.split(' — ')[0]}.`,
    };
  });
}

function devicePage(id: string, title: string, skuId: string, extra: Partial<TrackedPage> = {}, features = tabFeatures(skuId)): TrackedPage {
  return {
    id,
    title,
    kind: 'device',
    hash: `#/?sku=${skuId}`,
    source: canvasFor(sku(skuId)),
    note: `Shown with ${sku(skuId).name}, a SKU that has every tab for this type.`,
    ...extra,
    features,
  };
}

// Representative SKUs: each turns on every tab its type can have.
const DEVICES: TrackedPage[] = [
  devicePage('keyboard', 'Keyboard', 'origins-65'),
  devicePage('mouse', 'Mouse', 'saga-pro'),
  devicePage('headset', 'Headset', 'cloud-iii'),
  devicePage('microphone', 'Microphone', 'quadcast-2-s'),
  devicePage('monitor', 'Monitor (Display)', 'treehouse-32'),
  devicePage('desktop', 'Desktop PC', 'forge-45l', {}, [
    ...tabFeatures('forge-45l'),
    ...componentFeatures(['forge-45l-gpu', 'forge-45l-cpu-cooling', 'forge-45l-ram', 'forge-45l-psu', 'forge-45l-lighting']),
  ]),
  devicePage(
    'laptop',
    'Laptop PC',
    'hx-omen-16-valorant',
    { note: 'Laptops open one of two modals: per-zone RGB laptops get the full canvas, the rest a spec sheet (shown with OMEN Max 16).' },
    [
      ...tabFeatures('hx-omen-16-valorant'),
      ...tabFeatures('omen-max-16', 'spec-', 'Spec-sheet laptops (no per-zone RGB).'),
      ...componentFeatures(['omen-max-16-display', 'omen-max-16-trackpad', 'omen-max-16-webcam', 'omen-max-16-audio', 'omen-max-16-io']),
    ],
  ),
];

export const TRACKER_PAGES: TrackedPage[] = [HOME, PERFORM, PERSONALIZE, PLAY, SHOP, NOVA, ...DEVICES, APP_WIDE];

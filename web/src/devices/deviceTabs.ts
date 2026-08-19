// ══════════════════════════════════════════════════════════════════════════
// The device modal's tab list — one source of truth per SKU type.
//
// Every canvas (mouse / keyboard / headset / monitor / mic) and the generic
// SpecCanvas render their tool tabs from here, and `deviceCardModel` derives
// the board widget's shortcut buttons from the same call. So a card shortcut
// can never point at a tab the modal doesn't have.
// ══════════════════════════════════════════════════════════════════════════
import type { IconName } from '../components';
import type { ResolvedSku } from './skus';
import { SPEC_SCHEMA, tabVisible } from './specSchema';

export interface DeviceTab {
  id: string;
  icon: IconName;
  /** Caps panel title — also the tab's accessible name. */
  title: string;
}

const MOUSE_TABS: DeviceTab[] = [
  { id: 'buttons', icon: 'buttons', title: 'Buttons' },
  { id: 'sensor', icon: 'sensor', title: 'Sensor' },
  { id: 'settings', icon: 'settings', title: 'Settings' },
];

const KEYBOARD_TABS: DeviceTab[] = [
  { id: 'lighting', icon: 'lights', title: 'Lights' },
  { id: 'keys', icon: 'keys', title: 'Keys & Macros' },
  { id: 'settings', icon: 'settings', title: 'Settings' },
];

/**
 * Tabs for a SKU, feature-gated exactly as the canvas that renders it.
 * Spec-sheet types resolve through `SPEC_SCHEMA`, where a tab appears only
 * when at least one of its fields has data on this SKU (`tabVisible`).
 */
export function deviceTabs(sku: ResolvedSku): DeviceTab[] {
  const f = sku.features;
  switch (sku.type) {
    case 'mouse':
      return MOUSE_TABS;
    case 'keyboard':
      return KEYBOARD_TABS;
    case 'headset': {
      const tabs: DeviceTab[] = [{ id: 'audio', icon: 'audio', title: 'Audio' }];
      if (f.spatial !== false) tabs.push({ id: 'spatial', icon: 'spatial-audio', title: 'Spatial Audio' });
      tabs.push({ id: 'settings', icon: 'settings', title: 'Settings' });
      return tabs;
    }
    case 'monitor': {
      // Monitor 5-tab IA — task-oriented, owned by the monitor section (Cindy).
      // Replaces the generic Display/Color/KVM/Settings scaffold: Color folds
      // into Display (presets + gain + HDR/gamut are one job), KVM folds into
      // Connectivity (Gear Switch), and Settings becomes Utilities.
      // Decision trail: design-assets/replay-plan-2026-07-30.md §2 (plan C).
      // Overview is the modes tab (mode picker + Smart Actions). The display
      // roster it also used to carry is the canvas hero now, shown on every
      // tab — so a monitor without `modes` has nothing left to put here, and
      // the tab is gated like Audio rather than filled with an invented
      // Game/Work/Create the hardware never had.
      const tabs: DeviceTab[] = [];
      if (Array.isArray(f.modes) && f.modes.length > 0)
        tabs.push({ id: 'overview', icon: 'devices', title: 'Overview' });
      if (f.connectivity !== false) tabs.push({ id: 'connectivity', icon: 'bolt', title: 'Connectivity' });
      if (f.display !== false) tabs.push({ id: 'display', icon: 'brightness', title: 'Display' });
      tabs.push({ id: 'utilities', icon: 'settings', title: 'Utilities' });
      if (f.audio?.speakers) tabs.push({ id: 'audio', icon: 'audio', title: 'Audio' });
      return tabs;
    }
    case 'microphone': {
      const tabs: DeviceTab[] = [];
      if (f.audio !== false) tabs.push({ id: 'audio', icon: 'mic', title: 'Audio' });
      if (f.effects !== false) tabs.push({ id: 'effects', icon: 'eq', title: 'Effects' });
      if (f.lighting !== false) tabs.push({ id: 'lighting', icon: 'lights', title: 'Lighting' });
      tabs.push({ id: 'settings', icon: 'settings', title: 'Settings' });
      return tabs;
    }
    default:
      return (SPEC_SCHEMA[sku.type] ?? []).filter((t) => tabVisible(f, t));
  }
}

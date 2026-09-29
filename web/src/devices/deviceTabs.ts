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
  /**
   * How wide the panel sits for this tab. Omitted = `full`. A sparse tab reads
   * better held in than stretched across the full measure; the steps themselves
   * live on `.ds-ng3-panel`, so a tab declares intent rather than a number.
   */
  width?: 'full' | 'narrow';
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
/**
 * Which hero a monitor tab shows, so callers that switch SKUs (e.g. clicking
 * another display on the desk map) can pick a tab that keeps the SAME hero
 * kind rather than one that happens to share an id. Single source of truth —
 * MonitorCanvas's `active.id === 'connectivity' && f.xray` check calls this
 * too, so the two can't drift apart.
 */
export function monitorHeroIsDeskMap(sku: ResolvedSku, tabId: string): boolean {
  return !(tabId === 'connectivity' && !!sku.features.xray);
}

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
      // Two short columns against Audio's three dense ones — it does not need
      // the full measure to be legible.
      tabs.push({ id: 'settings', icon: 'settings', title: 'Settings', width: 'narrow' });
      return tabs;
    }
    case 'monitor': {
      // Monitor tab IA — a CLOSED set, owned by the monitor section (Cindy).
      // Two families and nothing else (2026-08-18, Cindy):
      //   · what a mode remembers — the three sensory outputs: Display
      //     (screen), Lights (glow), Audio (sound). A monitor has no fourth
      //     channel toward the person, so this half cannot grow.
      //   · the device itself — Connectivity (its relations to computers and
      //     gear) and Settings (managing the device).
      // A new feature is triaged in that order: does its value change per
      // mode? → one of the three outputs. Is it about another machine? →
      // Connectivity. Else → Settings. Only if all three fail may a new tab
      // be DISCUSSED, and it costs one of these five (swap, not append) —
      // the strip is icon-only 24px, and the task-oriented IA is the
      // differentiator this list carries (project-context.md:147).
      //
      // ⚠️ THE TWO FAMILIES ARE THE ENTRANCE TEST, NOT THE ORDER (2026-08-19,
      // Cindy). They decide WHICH tab a new feature lands in; they do not
      // decide what sits next to what. Reading them as a seating chart is
      // what put Audio beside Lights and pushed Connectivity down — do not
      // re-derive the order from them.
      //
      // Overview retired 2026-08-18 (Cindy): after the mode chips moved to
      // the bar above the hero (2026-08-07) it held a single toggle. Its
      // Automation row lives in Settings → Modes & Presets; the first-hour
      // card opens the Display tab.
      //
      // ORDER = this product's priority (2026-08-19, Cindy). Two fixed ends
      // borrowed from the family grammar every sibling canvas uses — primary
      // capability first (mouse Buttons, keyboard Lights, headset Audio —
      // here Display, and it is the tab the modal opens on), settings-shaped
      // tab last. Between them the strip ranks by weight to Mark:
      //   2. Connectivity — "two computers, one desk" is this monitor's
      //      headline, and the room you re-enter whenever the desk changes
      //      (a machine added, an input swapped, Viewing Mode). Lights and
      //      Audio are set once and then remembered by the mode.
      //   3. Lights · 4. Audio — the remembered outputs.
      // Siblings prove the middle is free: the headset seats Spatial Audio
      // second, the mic seats Lighting third. The `utilities` id stays as
      // plumbing (deep links, card shortcuts derive from it); the LABEL is
      // the family word, Settings. Decision trail:
      // design-assets/replay-plan-2026-07-30.md §2 plan C, amended 2026-08-18
      // and 2026-08-19; invariant #22 carries the order string.
      const tabs: DeviceTab[] = [];
      if (f.display !== false) tabs.push({ id: 'display', icon: 'brightness', title: 'Display' });
      if (f.connectivity !== false) tabs.push({ id: 'connectivity', icon: 'bolt', title: 'Connectivity' });
      // Lights: the tab every other device already has, brought in whole
      // (Chris, 1:1 2026-08-11) — it appears exactly where a display has a
      // light to drive.
      if (f.underGlow) tabs.push({ id: 'lighting', icon: 'lights', title: 'Lights' });
      if (f.audio?.speakers) tabs.push({ id: 'audio', icon: 'audio', title: 'Audio' });
      tabs.push({ id: 'utilities', icon: 'settings', title: 'Settings' });
      return tabs;
    }
    case 'microphone': {
      const tabs: DeviceTab[] = [];
      // A multi-pattern mic's Audio tab carries the pattern list beside its
      // controls and needs the full measure; a single-pattern one (the SoloCast
      // control panel, Figma Audio 13953:597433) reads better held in.
      const patterns = Array.isArray(f.audio?.pickupPatterns) ? f.audio.pickupPatterns.length : 0;
      if (f.audio !== false) tabs.push({ id: 'audio', icon: 'mic', title: 'Audio', width: patterns > 1 ? 'full' : 'narrow' });
      if (f.effects !== false) tabs.push({ id: 'effects', icon: 'eq', title: 'Effects' });
      if (f.lighting !== false) tabs.push({ id: 'lighting', icon: 'lights', title: 'Lights' });
      // One card, sometimes two — held in, like the headset's (Figma Device Settings 12065:12944).
      tabs.push({ id: 'settings', icon: 'settings', title: 'Settings', width: 'narrow' });
      return tabs;
    }
    default:
      return (SPEC_SCHEMA[sku.type] ?? []).filter((t) => tabVisible(f, t));
  }
}

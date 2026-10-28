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
import type { MvpScope } from '../state/Settings';
import { SPEC_SCHEMA, tabVisible } from './specSchema';
import { capsOf } from './pcLighting';

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

// Lights joined the mouse on 2026-10-01 (Kristy): the Pulsefire has an RGB
// zone, the desk in Personalize lights it, and a panel that could not set it
// left the desk's mouse color with no home. Buttons stays first — it is the
// tab the modal opens on, and the hero's callouts belong to it.
const MOUSE_TABS: DeviceTab[] = [
  { id: 'buttons', icon: 'buttons', title: 'Buttons' },
  { id: 'sensor', icon: 'sensor', title: 'Sensor' },
  { id: 'lighting', icon: 'lights', title: 'Lights' },
  // `narrow` like every other device's Settings tab: three short panels read
  // better held in than stretched, and the mouse's measure is pinned to the
  // Figma frame in device-canvas.css.
  { id: 'settings', icon: 'settings', title: 'Settings', width: 'narrow' },
];

const KEYBOARD_TABS: DeviceTab[] = [
  { id: 'lighting', icon: 'lights', title: 'Lights' },
  { id: 'keys', icon: 'keys', title: 'Keys & Macros' },
  // Two short columns, like the headset's and the mic's — and like the notebook
  // below, which copies this very tab set and has been `narrow` all along.
  { id: 'settings', icon: 'settings', title: 'Settings', width: 'narrow' },
];

// A notebook is the keyboard's tab set with one tab in front of it. The machine
// IS the computer, so the first thing the modal owes you is how it is running —
// and the deep work on that lives on the Performance page, not in a modal, so
// this tab is a glance plus the door to it rather than a second control surface.
// Lights and Keys & Macros follow the keyboard verbatim because the built-in
// board is the one peripheral a laptop always has.
const NOTEBOOK_TABS: DeviceTab[] = [
  { id: 'vitals', icon: 'performance', title: 'Performance' },
  { id: 'lighting', icon: 'lights', title: 'Lights' },
  { id: 'keys', icon: 'keys', title: 'Keys & Macros' },
  // One card, like the headset's and the mic's — held in rather than stretched.
  { id: 'settings', icon: 'settings', title: 'Settings', width: 'narrow' },
];

/**
 * This PC's page: the PC as a device
 * like any other, its tabs the rows of its directory in My Devices (the user's
 * arrangement, 2026-10-21):
 *
 *   desktop   Performance · LCD cooler cap · Chassis lighting · Power supply
 *   notebook  Performance · Lighting · Macro
 *
 * Performance is a glance that hands over to the Performance page. The cooler
 * cap's tab appears only where the registry gives the PC a cap; the Macro tab
 * only where the notebook has dedicated macro keys (keys-macros.7); the
 * notebook's Lighting only for a zone-lit keyboard. Settings is not a tab: the
 * machine's facts, its firmware and the support doors are the This PC button
 * (AboutPcModal). The power supply's tab shows its window's Status while
 * that window is redone to its Figma (JY, 2026-10-21). Under June 2027,
 * lighting and the parts' hardware control go, as everywhere else.
 *
 * The ids stay what the doors already use: `vitals` is Performance, and both
 * machines' lighting is `lighting` (Personalize's desk opens the tower with
 * `tab=lighting`), so no deep link breaks.
 */
export function pcDeviceTabs(sku: ResolvedSku, scope: MvpScope, parts: readonly string[]): DeviceTab[] {
  const june = scope === 'june27';
  const tabs: DeviceTab[] = [{ id: 'vitals', icon: 'performance', title: 'Performance' }];
  if (june) return tabs;
  const kb = sku.features.keyboard as { rgbZones?: unknown; macroKeys?: unknown } | undefined;
  if (sku.type === 'notebook') {
    // A lit keyboard of any kind: one zone, four, or per key (capsOf).
    if (capsOf(sku.features).keyboard !== 'none') tabs.push({ id: 'lighting', icon: 'lights', title: 'Lighting' });
    if (typeof kb?.macroKeys === 'number' && kb.macroKeys > 0) tabs.push({ id: 'macros', icon: 'keys', title: 'Macro' });
    return tabs;
  }
  if (parts.includes('desktop-cooler-cap')) tabs.push({ id: 'cooler-cap', icon: 'brightness', title: 'LCD cooler cap' });
  tabs.push({ id: 'lighting', icon: 'lights', title: 'Chassis lighting' });
  if (parts.includes('desktop-psu')) tabs.push({ id: 'psu', icon: 'bolt', title: 'Power supply' });
  return tabs;
}

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

/**
 * `scope` is the product scope being shown. Only the power supply reads it:
 * under `june27` it is the plain spec sheet again, because its Status and Fan
 * tabs are OMEN hardware control, which that scope leaves out. Callers that
 * omit it get the full-scope tabs (the two part canvases, which only open under it).
 */
export function deviceTabs(sku: ResolvedSku, scope: MvpScope = 'full'): DeviceTab[] {
  const f = sku.features;
  switch (sku.type) {
    case 'mouse':
      return MOUSE_TABS;
    case 'keyboard':
      return KEYBOARD_TABS;
    case 'notebook':
      // Same gate as the modal host: only a notebook with a lit keyboard (one
      // zone, four, or per key) gets the control tabs. Without this the card's
      // shortcuts would point at tabs the spec sheet does not render — the
      // coupling this file exists to prevent.
      if (capsOf(f).keyboard !== 'none') return NOTEBOOK_TABS;
      // No zones declared → this notebook is a spec sheet, same as the default
      // branch. (`break` here would fall out of the switch and return undefined,
      // which the spec canvas would then try to map over.)
      return (SPEC_SCHEMA[sku.type] ?? []).filter((t) => tabVisible(f, t));
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
    // The two parts of a desktop with something of their own to do (OpenGSW
    // lcd-diy) have windows of their own instead of spec sheets. The power
    // supply keeps its sheet as the last tab, drawn from the same schema.
    // Short columns are held in, like the headset's Settings; the fan curve
    // needs the full measure.
    case 'desktop-psu':
      // June 2027 leaves out OMEN hardware control: the sheet alone, as before.
      if (scope === 'june27') return (SPEC_SCHEMA[sku.type] ?? []).filter((t) => tabVisible(f, t));
      // Status and Fan, then the Settings card every peripheral ends with;
      // the spec sheet's facts sit on that card.
      return [
        { id: 'status', icon: 'heartbeat', title: 'Status' },
        { id: 'fan', icon: 'breeze', title: 'Fan' },
        { id: 'settings', icon: 'settings', title: 'Settings', width: 'narrow' },
      ];
    case 'desktop-cooler-cap':
      // The cap has no window of its own any more: these are the views its
      // tab on the PC's page switches between (CapActions; JY, 2026-10-22).
      return [
        { id: 'display', icon: 'brightness', title: 'Display' },
        { id: 'boot', icon: 'media-play', title: 'Power On', width: 'narrow' },
        { id: 'settings', icon: 'settings', title: 'Settings' },
      ];
    case 'desktop':
      // The tower's own RGB, the same Lights tab as every lit device
      // (2026-10-01): it is what the desk in Personalize lights, and the
      // tower's spec tabs had nowhere to set it.
      return [...(SPEC_SCHEMA[sku.type] ?? []).filter((t) => tabVisible(f, t)), { id: 'lighting', icon: 'lights', title: 'Lights' }];
    default:
      return (SPEC_SCHEMA[sku.type] ?? []).filter((t) => tabVisible(f, t));
  }
}

import React from 'react';
import { SystemVitalsWidget } from './SystemVitalsWidget';
import { PowerModeWidget } from './PowerModeWidget';
import { ActiveProfileWidget } from './ActiveProfileWidget';
import { LightStudioWidget } from './LightStudioWidget';
import { DeviceWidget } from './DeviceWidget';
import { useSettings } from '../state/Settings';
import { CpuWidget } from './CpuWidget';
import { CpuStatusWidget, GpuStatusWidget } from './ComponentStatusWidget';
import { ThermalWidget } from './ThermalWidget';
import { FanSpeedWidget } from './FanSpeedWidget';
import { StorageWidget } from './StorageWidget';
import { QuickLaunchWidget } from './QuickLaunchWidget';
import { GamePassWidget } from './GamePassWidget';
import { DealsWidget } from './DealsWidget';
import { PlayNextWidget } from './PlayNextWidget';
import { LastPlayedWidget } from './LastPlayedWidget';
import { OmenAiWidget } from './OmenAiWidget';
import { BoosterWidget } from './BoosterWidget';
import { AppearanceWidget } from './AppearanceWidget';
import { LightingWidget } from './LightingWidget';

/**
 * Board device cards, one per device in `CONNECTED_DEVICE_IDS`. Keeping the
 * widget→SKU mapping here (rather than a parallel list per consumer) is what
 * stops the board and the onboarding seeding from drifting apart — the two
 * used to disagree, so a connected keyboard and mic had no card to seed.
 */
export const DEVICE_WIDGET_SKU: Record<string, string> = {
  'dev-mouse': 'saga-pro',
  'dev-keyboard': 'origins-65',
  'dev-headset': 'cloud-iii',
  'dev-monitor': 'pulse-27',
  'dev-mic': 'solocast-2-pro',
  'dev-treehouse': 'treehouse-32',
  'dev-laptop': 'hx-omen-16-valorant',
};

/**
 * The board's card for the computer the app runs on. Its widget id is still
 * `dev-laptop` — saved board layouts and the onboarding seed know it by that —
 * but the card follows Admin's This PC, so the desktop is a card too.
 */
function ThisPcWidget() {
  const { thisPc } = useSettings();
  return <DeviceWidget key={thisPc} skuId={thisPc} />;
}

/** Render function for each widget id. */
export const RENDERERS: Record<string, () => React.ReactNode> = {
  vitals: () => <SystemVitalsWidget />,
  profile: () => <ActiveProfileWidget />,
  power: () => <PowerModeWidget />,
  light: () => <LightStudioWidget />,
  cpu: () => <CpuWidget />,
  'cpu-status': () => <CpuStatusWidget />,
  'gpu-status': () => <GpuStatusWidget />,
  thermal: () => <ThermalWidget />,
  fanspeed: () => <FanSpeedWidget />,
  storage: () => <StorageWidget />,
  quicklaunch: () => <QuickLaunchWidget />,
  gamepass: () => <GamePassWidget />,
  deals: () => <DealsWidget />,
  playnext: () => <PlayNextWidget />,
  lastplayed: () => <LastPlayedWidget />,
  omenai: () => <OmenAiWidget />,
  booster: () => <BoosterWidget />,
  appearance: () => <AppearanceWidget />,
  lighting: () => <LightingWidget />,
  ...Object.fromEntries(
    Object.entries(DEVICE_WIDGET_SKU).map(([id, skuId]) => [id, () => <DeviceWidget skuId={skuId} />]),
  ),
  'dev-laptop': () => <ThisPcWidget />,
};

export interface WidgetMeta {
  id: string;
  name: string;
  cat: string;
  span: number;
  rows: number;
}

/** Every available widget, its category, and its default size on the board. */
export const CATALOG: WidgetMeta[] = [
  { id: 'vitals', name: 'System Vitals', cat: 'Performance', span: 4, rows: 2 },
  { id: 'cpu-status', name: 'Processor', cat: 'Performance', span: 3, rows: 1 },
  { id: 'gpu-status', name: 'Graphics', cat: 'Performance', span: 3, rows: 1 },
  { id: 'cpu', name: 'CPU', cat: 'Performance', span: 2, rows: 1 },
  { id: 'thermal', name: 'Thermal', cat: 'Performance', span: 2, rows: 2 },
  { id: 'fanspeed', name: 'Fan Speed', cat: 'Performance', span: 2, rows: 1 },
  { id: 'storage', name: 'Storage', cat: 'Performance', span: 3, rows: 2 },
  { id: 'omenai', name: 'OMEN AI', cat: 'Performance', span: 2, rows: 2 },
  { id: 'booster', name: 'Booster', cat: 'Performance', span: 2, rows: 2 },
  { id: 'power', name: 'Power Mode', cat: 'Personalize', span: 3, rows: 1 },
  { id: 'profile', name: 'Active Profile', cat: 'Personalize', span: 2, rows: 1 },
  { id: 'light', name: 'Light Studio', cat: 'Personalize', span: 3, rows: 1 },
  { id: 'lighting', name: 'Lighting', cat: 'Personalize', span: 2, rows: 2 },
  { id: 'appearance', name: 'Appearance', cat: 'Personalize', span: 2, rows: 1 },
  { id: 'quicklaunch', name: 'Quick Launch', cat: 'Gaming', span: 3, rows: 1 },
  { id: 'lastplayed', name: 'Last Played', cat: 'Gaming', span: 4, rows: 2 },
  { id: 'playnext', name: 'What to Play Next', cat: 'Gaming', span: 3, rows: 1 },
  { id: 'gamepass', name: 'Game Pass', cat: 'Gaming', span: 2, rows: 2 },
  { id: 'deals', name: "Today's Deals", cat: 'Gaming', span: 2, rows: 2 },
  { id: 'dev-mouse', name: 'Pulsefire Saga Pro', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-keyboard', name: 'Alloy Origins 65', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-headset', name: 'Cloud III', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-monitor', name: 'OMEN OLED 27', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-mic', name: 'SoloCast 2 Pro', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-laptop', name: 'This PC', cat: 'Devices', span: 3, rows: 2 },
  // Standard (3×2) is the decided default for the rich monitor card
  { id: 'dev-treehouse', name: 'Treehouse 32', cat: 'Devices', span: 3, rows: 2 },
];

export const META_BY_ID: Record<string, WidgetMeta> = Object.fromEntries(CATALOG.map((m) => [m.id, m]));

export interface BoardItem {
  id: string;
  span: number;
  rows: number;
}

/**
 * The default board layout (subset + order of the catalog) — what someone sees
 * on a first landing, before they have curated anything.
 *
 * Laid out by Chris (2026-10-26) so a first look reads organized: the two
 * headline devices beside the hero, Last Played leading a row of the
 * peripherals, then the monitor and the processor as a short row. Each card
 * at its size here, not the catalog's (a device card is 2×2 on this board).
 * The rest of the catalog is one click away in the widget gallery. A saved
 * layout in localStorage always wins over this.
 */
export const DEFAULT_LAYOUT: BoardItem[] = [
  { id: 'dev-laptop', span: 2, rows: 2 },
  { id: 'dev-headset', span: 2, rows: 2 },
  { id: 'lastplayed', span: 4, rows: 2 },
  { id: 'dev-mouse', span: 2, rows: 2 },
  { id: 'dev-keyboard', span: 2, rows: 2 },
  { id: 'dev-mic', span: 2, rows: 2 },
  { id: 'dev-monitor', span: 2, rows: 1 },
  { id: 'cpu-status', span: 2, rows: 1 },
];

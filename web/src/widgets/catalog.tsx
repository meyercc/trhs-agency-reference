import React from 'react';
import { SystemVitalsWidget } from './SystemVitalsWidget';
import { PowerModeWidget } from './PowerModeWidget';
import { ActiveProfileWidget } from './ActiveProfileWidget';
import { LightStudioWidget } from './LightStudioWidget';
import { DeviceWidget } from './DeviceWidget';
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
import { WeatherWidget } from './WeatherWidget';
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
  'dev-mic': 'quadcast-2-s',
  'dev-treehouse': 'treehouse-32',
};

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
  weather: () => <WeatherWidget />,
  appearance: () => <AppearanceWidget />,
  lighting: () => <LightingWidget />,
  ...Object.fromEntries(
    Object.entries(DEVICE_WIDGET_SKU).map(([id, skuId]) => [id, () => <DeviceWidget skuId={skuId} />]),
  ),
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
  { id: 'weather', name: 'Weather', cat: 'Personalize', span: 2, rows: 1 },
  { id: 'quicklaunch', name: 'Quick Launch', cat: 'Gaming', span: 3, rows: 1 },
  { id: 'lastplayed', name: 'Last Played', cat: 'Gaming', span: 4, rows: 2 },
  { id: 'playnext', name: 'What to Play Next', cat: 'Gaming', span: 3, rows: 1 },
  { id: 'gamepass', name: 'Game Pass', cat: 'Gaming', span: 2, rows: 2 },
  { id: 'deals', name: "Today's Deals", cat: 'Gaming', span: 2, rows: 2 },
  { id: 'dev-mouse', name: 'Pulsefire Saga Pro', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-keyboard', name: 'Alloy Origins 65', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-headset', name: 'Cloud III', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-monitor', name: 'OMEN OLED 27', cat: 'Devices', span: 3, rows: 2 },
  { id: 'dev-mic', name: 'QuadCast 2 S', cat: 'Devices', span: 3, rows: 2 },
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
 * Deliberately small: the four device cards plus what you last played. The rest
 * of the catalog is not gone, it is one click away in the widget gallery, and
 * a board that starts sparse reads as something to build rather than something
 * to prune. A saved layout in localStorage always wins over this.
 */
export const DEFAULT_LAYOUT: BoardItem[] = [
  'dev-treehouse',
  'dev-mouse',
  'dev-monitor',
  'dev-headset',
  'lastplayed',
].map((id) => ({ id, span: META_BY_ID[id].span, rows: META_BY_ID[id].rows }));

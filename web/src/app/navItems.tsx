// The main nav's items — one list, read by the nav itself (AppShell) and by
// anything that previews it (Settings › Navigation), so a preview can never
// show a different set or order than the real nav.
import { Icon, type MenuItem } from '../components';
import { useModules } from '../state/Modules';
import { NAV_MODULE } from '../modules/registry';

/** Routed page tabs, in nav order. Devices (a flyout toggle) follows them. */
export const NAV_TABS: MenuItem[] = [
  { id: 'home', label: 'Home', to: '/', end: true, icon: <Icon name="home" /> },
  // `shortLabel` is what the bottom tab bar prints (Menu `variant="bar"`): a
  // 66px slot on a 375 phone clips "Performance" at the 12px floor.
  { id: 'perform', label: 'Performance', shortLabel: 'Perform', to: '/perform', icon: <Icon name="performance" /> },
  { id: 'personalize', label: 'Personalize', shortLabel: 'Style', to: '/personalize', icon: <Icon name="profile" /> },
  { id: 'play', label: 'Play', to: '/play', icon: <Icon name="play" /> },
  { id: 'shop', label: 'Shop', to: '/shop', icon: <Icon name="shop" /> },
  // Nova left the nav (Chris, 2026-10-20; it joined in TH-428): its door is
  // the chat button beside the account menu, and the full page is reached from
  // the sidebar — its expand button, or dragging it wide.
];

/** The Devices toggle that closes the nav. */
export const DEVICES_ITEM: MenuItem = { id: 'devices', label: 'Devices', icon: <Icon name="devices" /> };

/** Page tabs minus any gated behind a removed module (e.g. Shop → shop module). */
export function useVisibleNavTabs(): MenuItem[] {
  const { has } = useModules();
  return NAV_TABS.filter((t) => {
    const mod = NAV_MODULE[t.id];
    return !mod || has(mod);
  });
}

import { useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { Menu, Icon, IconButton, Tooltip, type MenuItem } from '../components';
import { DeviceModalHost } from '../devices/DeviceModalHost';
import { DeviceSimHud } from '../devices/DeviceSimHud';
import { FeatureModalHost } from '../modals/FeatureModalHost';
import { useSettings } from '../state/Settings';
import { useModules } from '../state/Modules';
import { NAV_MODULE } from '../modules/registry';
import { ProfileMenu } from './ProfileMenu';
import { HyperXLogo } from './HyperXLogo';
import { DevicePanel } from './DevicePanel';
import { WallpaperLayer } from './WallpaperLayer';
import './shell.css';

const TABS: MenuItem[] = [
  { id: 'home', label: 'Home', to: '/', end: true, icon: <Icon name="home" /> },
  { id: 'perform', label: 'Performance', to: '/perform', icon: <Icon name="performance" /> },
  { id: 'personalize', label: 'Personalize', to: '/personalize', icon: <Icon name="profile" /> },
  { id: 'play', label: 'Play', to: '/play', icon: <Icon name="play" /> },
  { id: 'shop', label: 'Shop', to: '/shop', icon: <Icon name="shop" /> },
];

export function AppShell() {
  const { hideNavLabels, hideNavIcons } = useSettings();
  const { has } = useModules();
  // Deep-linkable open state: `?devices=1` opens it on load (used by the App
  // Atlas preview + shareable links). After mount it's plain local state, so it
  // persists across page navigation (page NavLinks drop the query string).
  const [searchParams, setSearchParams] = useSearchParams();
  const [devicesOpen, setDevicesOpen] = useState(() => searchParams.get('devices') === '1');

  const openModules = () => {
    const p = new URLSearchParams(searchParams);
    p.set('modal', 'modules');
    setSearchParams(p);
  };

  // Esc closes the Devices flyout.
  useEffect(() => {
    if (!devicesOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDevicesOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [devicesOpen]);

  // Page tabs, minus any gated behind a removed module (e.g. Shop → shop module).
  const visibleTabs = TABS.filter((t) => {
    const mod = NAV_MODULE[t.id];
    return !mod || has(mod);
  });

  // Main nav = routed page tabs + the Devices toggle (opens the flyout).
  const navItems: MenuItem[] = [
    ...visibleTabs,
    {
      id: 'devices',
      label: 'Devices',
      icon: <Icon name="devices" />,
      active: devicesOpen,
      onClick: () => setDevicesOpen((o) => !o),
    },
  ];

  return (
    <div className={'shell' + (devicesOpen ? ' devices-open' : '')}>
      <WallpaperLayer />
      <nav className="shell-nav">
        <div className="shell-brand">
          <HyperXLogo />
        </div>
        <Menu
          items={navItems}
          orientation="horizontal"
          hideLabels={hideNavLabels}
          hideIcons={hideNavIcons}
          tooltips
          aria-label="Main"
        />
        <div className="shell-util">
          {/* Module Browser — icon-only, named by the same DS tooltip the nav uses. */}
          <Tooltip content="Module Browser" placement="bottom">
            <IconButton label="Module Browser" onClick={openModules}>
              <Icon name="puzzle" size={16} />
            </IconButton>
          </Tooltip>
          <ProfileMenu />
        </div>
      </nav>
      <div className="shell-scroll">
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
      <DevicePanel open={devicesOpen} onClose={() => setDevicesOpen(false)} />
      <DeviceModalHost />
      <FeatureModalHost />
      {/* Admin/testing: the hardware side of the onboard-profile model, floated
          above the canvases so device-side acts can be watched live. */}
      <DeviceSimHud />
    </div>
  );
}

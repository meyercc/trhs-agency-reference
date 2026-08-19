import { useState } from 'react';
import './device-canvas.css';
import './monitor-canvas.css';
import { Icon, Ng3Panel } from '../components';
import { type ResolvedSku, connectionStatus } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileScopeBody, useDeviceProfileBar } from './ProfileBar';
import { DisplayArrange } from './DisplayArrange';
import {
  OverviewTab,
  ConnectivityTab,
  DisplayTab,
  UtilitiesTab,
  AudioTab,
} from './monitor/MonitorTabs';
import { XrayHero } from './monitor/XrayCard';

/**
 * Full-canvas monitor modal on the Ng3Panel canvas. The hero is the
 * interactive multi-display arrangement (DisplayArrange, shared via
 * Settings.displayArrange) — the monitor's equivalent of the keyboard's
 * interactive hero, and the surface the Perform desk map writes to.
 *
 * Tabs come from `deviceTabs` and their bodies live in monitor/MonitorTabs:
 * Overview · Connectivity · Display · Utilities · Audio — the monitor section's
 * task-oriented IA (Cindy). The hero stays the arrangement on every tab: a
 * photo hero would take the arrangement surface away from the very monitor most
 * likely to own it (parked with Chris, 1:1 2026-07-30).
 *
 * Content strategy ("columns + section scroll"): every tab redistributes its
 * vertical stack into the shared Ng3Grid columns at panel width; long lists
 * scroll inside their section (Ng3Scroll) — the panel itself never scrolls.
 */

export function MonitorCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const f = sku.features;
  const profile = useDeviceProfileBar(sku);
  const tabs = deviceTabs(sku);

  const [tabId, setTabId] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id,
  );
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];

  const conn = connectionStatus(f);
  const refresh = f.display?.refreshRate;

  return (
    <div className="dc-canvas mc-canvas" role="dialog" aria-label={sku.name}>
      {/* Status chips */}
      <div className="dc-status">
        <div className="dc-chip">
          <span className="dc-chip-dot dc-chip-dot-on" aria-hidden="true" />
          <span className="dc-chip-val">{conn.wireless ? 'Wireless' : 'Connected · USB'}</span>
        </div>
        {refresh && (
          <div className="dc-chip">
            <span className="dc-chip-val">{refresh} Hz</span>
          </div>
        )}
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      <ProfileBar state={profile} />

      {/* Hero — per tab: Connectivity shows the back of the display (its ports
          are the subject), every other tab shows the shared arrangement. */}
      <div className="dc-hero mc-hero">
        {active.id === 'connectivity' && f.xray ? (
          <XrayHero skuName={sku.name} />
        ) : (
          <div className="mc-arrange">
            <DisplayArrange currentSku={sku.id} />
          </div>
        )}
      </div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap mc-panel-wrap">
        <Ng3Panel
          header={active.title}
          tools={tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={['ds-ng3-tool', t.id === active.id ? 'active' : ''].filter(Boolean).join(' ')}
              aria-label={t.title}
              aria-pressed={t.id === active.id}
              onClick={() => setTabId(t.id)}
            >
              <Icon name={t.icon} />
            </button>
          ))}
          actions={
            <button type="button" className="ds-ng3-action" aria-label="Duplicate">
              <Icon name="duplicate" />
            </button>
          }
          bare
        >
          <ProfileScopeBody state={profile}>
          {active.id === 'overview' ? (
            <OverviewTab features={f} />
          ) : active.id === 'connectivity' ? (
            <ConnectivityTab features={f} />
          ) : active.id === 'display' ? (
            <DisplayTab features={f} />
          ) : active.id === 'audio' ? (
            <AudioTab features={f} />
          ) : (
            <UtilitiesTab sku={sku} />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

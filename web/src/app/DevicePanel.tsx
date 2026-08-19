import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components';
import { deviceCardModel, type DeviceCardModel } from '../widgets/DeviceCard';
import { CONNECTED_DEVICE_IDS } from '../devices/connectedDevices';
import { useSettings } from '../state/Settings';
import { useDeviceSim } from '../state/DeviceSim';
import './device-panel.css';

/**
 * Global "My Devices" flyout, opened from the main nav (replaces the old
 * Perform-page device cards). Device icons run across the top; picking one
 * swaps the hero below; each feature shortcut deep-links into that device's
 * modal at the right tab (`?sku=<id>&tab=<feature>`). Device data comes from the
 * shared SKU registry via `deviceCardModel`, so shortcuts always match the modal.
 */
export function DevicePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [params, setParams] = useSearchParams();
  const models = useMemo(
    () => CONNECTED_DEVICE_IDS.map((id) => deviceCardModel(id)).filter(Boolean) as DeviceCardModel[],
    [],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(models[0]?.skuId);
  const selected = models.find((m) => m.skuId === selectedId) ?? models[0];

  // "My Devices" is inventory, not just what's live right now — a device that
  // is unplugged (device simulator) stays listed and says so, exactly like the
  // KVM "handed off" state below. Hiding it would make the state invisible.
  const { simState } = useDeviceSim();
  const selectedConnected = selected ? simState(selected.skuId).connected : true;

  // KVM: a routed-away keyboard/mouse reads "handed off"; an un-set-up KVM
  // monitor gets a "Set up KVM" prompt (Beats 5 and 1 from the KVM journey).
  const { kvm } = useSettings();
  const kvmAway =
    kvm.configured && kvm.moveKbm && kvm.activePc === 'pc2' && (selected?.skuId === 'origins-65' || selected?.skuId === 'saga-pro');

  // Open the selected device's modal (optionally at a feature tab). The panel
  // stays open behind the modal so it's still there when the modal is dismissed.
  const openModal = (tab?: string) => {
    if (!selected) return;
    const p = new URLSearchParams(params);
    p.set('sku', selected.skuId);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    setParams(p);
  };

  return (
    <aside
      className={'ds-panel device-panel' + (open ? ' open' : '')}
      aria-label="My Devices"
      aria-hidden={!open}
    >
      <div className="ds-panel-header">
        <span className="ds-panel-title">My Devices</span>
        <button className="ds-panel-close" onClick={onClose} title="Close" aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      <div className="ds-panel-body">
        {/* Device icons across the top — click to swap the view below. */}
        <div className="devp-tabs" role="tablist" aria-label="Connected devices">
          {models.map((m) => {
            const conn = simState(m.skuId).connected;
            return (
              <button
                key={m.skuId}
                type="button"
                role="tab"
                aria-selected={selected?.skuId === m.skuId}
                className={'devp-tab' + (selected?.skuId === m.skuId ? ' active' : '') + (conn ? '' : ' offline')}
                title={conn ? m.name : `${m.name} (disconnected)`}
                onClick={() => setSelectedId(m.skuId)}
              >
                {m.image ? <img src={m.image} alt="" /> : <Icon name="devices" size={20} aria-hidden />}
              </button>
            );
          })}
        </div>

        {selected && (
          <>
            {/* Hero image — click opens the full device modal. */}
            <button
              type="button"
              className={'devp-hero' + (selectedConnected ? '' : ' offline')}
              onClick={() => openModal()}
              title={`Open ${selected.name}`}
            >
              {selected.image ? (
                <img className="devp-hero-img" src={selected.image} alt={selected.name} />
              ) : (
                <Icon name="devices" size={48} aria-hidden />
              )}
            </button>

            <div className="devp-meta">
              <div className="devp-name">{selected.name}</div>
              <div className="devp-status">
                {/* No battery reading from a device that isn't here. */}
                {selected.batteryPct != null && selectedConnected && (
                  <span className="devp-badge">
                    <Icon name="battery" size={12} aria-hidden /> {selected.batteryPct}%
                  </span>
                )}
                <span className="devp-badge">{selected.subtitle}</span>
                {kvmAway ? (
                  <span className="devp-badge handed-off">
                    <Icon name="devices" size={11} aria-hidden /> On Work Laptop
                  </span>
                ) : selectedConnected ? (
                  <span className="devp-badge connected">Connected</span>
                ) : (
                  <span className="devp-badge offline">Disconnected</span>
                )}
              </div>
            </div>

            {selected.skuId === 'pulse-27' && !kvm.configured && (
              <button type="button" className="devp-kvm-cta" onClick={() => openModal('kvm')}>
                <Icon name="devices" size={14} aria-hidden />
                <span>
                  <b>Set up KVM</b> — share this display with a second PC
                </span>
                <Icon name="chevron-right" size={14} aria-hidden />
              </button>
            )}

            {/* Feature shortcuts — each opens where it belongs (the device modal). */}
            {selected.shortcuts.length > 0 && (
              <div className="devp-features">
                <div className="devp-features-label">Shortcuts</div>
                {selected.shortcuts.map((s) => (
                  <button key={s.tab} type="button" className="devp-feature" onClick={() => openModal(s.tab)}>
                    <span className="devp-feature-icon">
                      <Icon name={s.icon} size={16} aria-hidden />
                    </span>
                    <span className="devp-feature-label">{s.label}</span>
                    <span className="devp-feature-chev" aria-hidden>
                      ›
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

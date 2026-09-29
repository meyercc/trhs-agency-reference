import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components';
import { deviceCardModel, type DeviceCardModel } from '../widgets/DeviceCard';
import { deskDeviceIds } from '../devices/connectedDevices';
import { activePcName, deskPcNames } from '../devices/arrangement';
import { getResolvedSku } from '../devices/skus';
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
export function DevicePanel({
  open,
  focusSku,
  onClose,
}: {
  open: boolean;
  /** Select this device on open — set when the Devices nav closes that device's
      modal, so the panel continues from what you were looking at. */
  focusSku?: string;
  onClose: () => void;
}) {
  const [params, setParams] = useSearchParams();
  // What is on THIS desk (Admin), not the whole inventory — a display the Admin
  // row took off the desk has no tab here, the same way it has no card on the
  // home board and no tile in the desk picture (2026-09-18).
  const { kvm, setKvm, deskDevices, pcCount } = useSettings();
  const models = useMemo(
    () => deskDeviceIds(deskDevices).map((id) => deviceCardModel(id)).filter(Boolean) as DeviceCardModel[],
    [deskDevices],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(models[0]?.skuId);
  useEffect(() => {
    if (focusSku && models.some((m) => m.skuId === focusSku)) setSelectedId(focusSku);
  }, [focusSku, models]);
  const selected = models.find((m) => m.skuId === selectedId) ?? models[0];

  // "My Devices" is inventory, not just what's live right now — a device that
  // is unplugged (device simulator) stays listed and says so, exactly like the
  // KVM "handed off" state below. Hiding it would make the state invisible.
  const { simState, batteryOf } = useDeviceSim();
  const selectedConnected = selected ? simState(selected.skuId).connected : true;

  // KVM: a routed-away keyboard/mouse reads "handed off"; the Treehouse 32
  // gets a `Gear Switch` line once a second computer is on the desk. The OMEN
  // OLED 27 gets no prompt (2026-09-22): on this desk it is the MacBook's own
  // screen and the switch is the Treehouse 32 (chris-decisions, 07-29), which
  // is why its Connectivity tab holds Gear Switch in the one-computer state
  // whatever Admin says — a `Set up KVM` call to action here contradicted that
  // tab, showed on one-computer desks, and pointed at a `kvm` tab the window
  // no longer has (flow audit 09-21).
  // Gear Switch hosts come from the SKU, so a second dual-PC display needs no
  // edit here — and the names match the Connectivity tab's Active Computer
  // control exactly, because both read this one field.
  const gearOf = (skuId: string) => {
    const g = getResolvedSku(skuId)?.features.gearSwitch as { hosts?: unknown } | undefined;
    const hosts = Array.isArray(g?.hosts) ? (g.hosts as string[]) : [];
    return hosts.length === 2 ? hosts : null;
  };
  // Read from the display that does the switching, not from whatever is
  // selected: the peripherals' "handed off" badge below has to name the same
  // computer this row is sending them to, and only the monitor carries the
  // names. One source, so the panel cannot contradict itself.
  const gearHosts = models.reduce<string[] | null>((found, m) => found ?? gearOf(m.skuId), null);
  // Named from the DESK, not the SKU's pair: the SKU always lists two computers,
  // and reading it straight put `To OMEN 35L` on a MacBook-only desk (2026-09-18).
  const gearActive = gearHosts ? activePcName(kvm.activePc) : null;
  const gearOther = gearHosts ? deskPcNames().find((n) => n !== gearActive) ?? null : null;
  // Nothing to switch, and no "second PC found", with one computer on the desk —
  // the Connectivity tab's Gear Switch card says the same thing (`pcCount < 2`).
  const selectedHasGear = !!(selected && gearOf(selected.skuId)) && pcCount > 1;
  const kvmAway =
    // "Handed off" needs somewhere to hand off FROM: on a one-computer desk the
    // keyboard is simply on that computer, even when it is the tower (pc2).
    pcCount > 1 && kvm.configured && kvm.moveKbm && kvm.activePc === 'pc2' && (selected?.skuId === 'origins-65' || selected?.skuId === 'saga-pro');

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
                    {/* The simulated level when one is dialled in, else the
                        SKU's — the same answer the home card gives, so the two
                        places a person reads a battery cannot disagree. */}
                    <Icon name="battery" size={12} aria-hidden /> {batteryOf(selected.skuId)}%
                  </span>
                )}
                <span className="devp-badge">{selected.subtitle}</span>
                {kvmAway ? (
                  <span className="devp-badge handed-off">
                    {/* The host name comes from the same field the switch row above
                        reads. It was the literal "Work Laptop" until 2026-08-20, which
                        named a different computer than the row one tap away — the two
                        strings describe ONE piece of state (`kvm.activePc`). The
                        monitor modal's own KVM tab still carries its own pair of names;
                        reconciling those is a Chris item, noted in the outbound. */}
                    <Icon name="devices" size={11} aria-hidden /> On {gearActive ?? 'Work Laptop'}
                  </span>
                ) : selectedConnected ? (
                  <span className="devp-badge connected">Connected</span>
                ) : (
                  <span className="devp-badge offline">Disconnected</span>
                )}
              </div>
            </div>

            {/* ── The one action this monitor earns a row for ────────────────
                Handing the keyboard and mouse to the other computer is the
                thing Mark does several times a day; everything else on this
                display is set once and then remembered by the mode. Today it
                costs a trip into Connectivity → Active Computer, so it is the
                only item here that is a shortcut in the literal sense — the
                rows below are places, not actions, which is why they lost the
                "Shortcuts" heading (2026-08-20, Cindy).
                No new engine: this writes the same shared `kvm` state the
                Connectivity tab writes (MonitorTabs.tsx, Active Computer), so
                the mouse and keyboard entries in this very panel re-read
                "handed off" the moment it is pressed. Wording is that tab's
                sentence, cut to the row's width — not a second phrasing.
                Treatment reuses the panel's existing action row (.devp-kvm-cta
                below) rather than inventing a second kind of button. */}
            {selectedHasGear &&
              (kvm.configured ? (
                <button
                  type="button"
                  className="devp-kvm-cta devp-action"
                  onClick={() => setKvm({ ...kvm, activePc: kvm.activePc === 'pc2' ? 'pc1' : 'pc2' })}
                >
                  <Icon name="devices" size={14} aria-hidden />
                  <span>
                    {/* Copy is cut to the slot, not to taste: at this row's width the
                        title has 219px and copy-rules.md budgets English at 60% of it
                        (measured 2026-08-20 — "Switch to <second computer>" ran 84%, no
                        room left for translation). Splitting the verb from the
                        destination puts both under budget (57% / 48%) AND parks the
                        variable-length half — the host name is SKU data — on the line
                        with the most headroom. What actually moves is not spelled out
                        here; the keyboard and mouse rows in this same panel say it
                        better by flipping to "handed off" the moment this is pressed. */}
                    <b>Switch computer</b>
                    <span className="devp-action-sub">To {gearOther}</span>
                  </span>
                  <Icon name="chevron-right" size={14} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className="devp-kvm-cta devp-action"
                  onClick={() => openModal('connectivity')}
                >
                  <Icon name="devices" size={14} aria-hidden />
                  <span>
                    {/* Before it is on, this row POINTS at the feature instead of
                        switching it on — the same move the KVM prompt below makes.
                        A flyout should not silently enable hardware behaviour; it
                        should hand you to the card where `Turn on` lives with its
                        one-line explanation. That also lets the label name the
                        feature rather than the verb, which is what fits (41% / 46%). */}
                    <b>Gear Switch</b>
                    <span className="devp-action-sub">Second PC found</span>
                  </span>
                  <Icon name="chevron-right" size={14} aria-hidden />
                </button>
              ))}

            {/* Where you can go on this device — one row per tab of its modal,
                straight from `deviceTabs`, so this list cannot offer a room the
                modal does not have. Deliberately unlabelled: it used to read
                "Shortcuts", but a list of every tab is a table of contents, and
                the modal already draws that as its tab strip. The word moved up
                to the action row, which earns it (2026-08-20, Cindy). */}
            {selected.shortcuts.length > 0 && (
              <div className="devp-features">
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

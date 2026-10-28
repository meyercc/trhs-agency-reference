import { useSearchParams } from 'react-router-dom';
import { DeviceCard, deviceCardModel } from './DeviceCard';
import { useSettings } from '../state/Settings';
import { useDeviceSim } from '../state/DeviceSim';
import { activePcName } from '../devices/arrangement';
import { isPcType, partsOf } from '../devices/pcDirectory';
import { pcDeviceTabs } from '../devices/deviceTabs';
import { getResolvedSku } from '../devices/skus';
import { DeskDeviceCard, isDeskDevice, useOnHome } from '../pages/personalize/DeskSection';

// The shared keyboard + mouse on the KVM monitor's hub — they follow the switch.
const KVM_PERIPHERALS = new Set(['origins-65', 'saga-pro']);

/**
 * Dashboard device widget — the rich `.w-devcard` design (battery, name,
 * subtitle, per-tab shortcuts, photo). Opens the device modal via `?sku=<id>`;
 * shortcuts deep-link to a tab via `?tab=<id>`. The card for This PC opens the
 * PC's page the same way, its shortcuts the tabs of that page. Presentation lives in the shared
 * <DeviceCard>, so the Metro dashboard renders the exact same widget.
 */
export function DeviceWidget({ skuId }: { skuId: string }) {
  const [params, setParams] = useSearchParams();
  const { kvm, pcCount, thisPc, mvpScope } = useSettings();
  // The battery the simulator is holding this device at, else the SKU's own.
  // Applied HERE rather than inside <DeviceCard> for the reason `routedAway`
  // already is: the card is a shared presentational component, and live desk
  // state is resolved by whoever is placing it (rule 11 — the card itself stays
  // out of per-device behaviour).
  const { batteryOf } = useDeviceSim();
  const homeSwitch = useOnHome(skuId);
  const model = deviceCardModel(skuId);
  if (!model) return null;
  // This PC's card points at the tabs of the PC's own page (pcDeviceTabs), not
  // at the notebook window the registry's type gives it; a shortcut can then
  // never name a tab the page does not have.
  const pcSku = isPcType(model.type) && skuId === thisPc ? getResolvedSku(skuId) : undefined;
  if (pcSku) {
    model.shortcuts = pcDeviceTabs(pcSku, mvpScope, partsOf(pcSku.id, mvpScope).map((p) => p.type)).map((t) => ({ tab: t.id, label: t.title, icon: t.icon }));
  }

  // Beat 5 — a KVM'd keyboard/mouse routed to PC 2 reads "handed off", not connected.
  // Named from the desk (it was the literal 'Work Laptop', a computer this desk
  // does not have — 2026-09-18), and only on a two-computer desk: with one
  // computer the keyboard has nowhere to have been handed off from.
  const routedAway =
    pcCount > 1 && kvm.configured && kvm.moveKbm && kvm.activePc === 'pc2' && KVM_PERIPHERALS.has(skuId)
      ? activePcName(kvm.activePc)
      : undefined;

  const open = (tab?: string) => {
    const p = new URLSearchParams(params);
    p.set('sku', skuId);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    setParams(p);
  };

  // The board card keeps the ORIGINAL device-widget shape — the photo that
  // resizes and repositions with the card — and carries the controls the
  // person chose, which `scope="home"` draws Home's way and remembers
  // separately from Personalize's (Chris, 2026-10-13). Personalize's own
  // content sizing on a board cell is what left the keyboard a thumbnail in
  // a narrow cell (TH-440's slot, then).
  // Peripherals only. A display keeps its RICH face here (Cindy's: preset,
  // input, the brightness row) — and controls replace that face rather than
  // joining it, which turned the monitor photos into thumbnails when every
  // desk device took this path.
  if (isDeskDevice(skuId) && !model.rich) return <DeskDeviceCard skuId={skuId} scope="home" routedAway={routedAway} />;

  return (
    <DeviceCard
      model={{ ...model, batteryPct: batteryOf(skuId) }}
      routedAway={routedAway}
      homeSwitch={homeSwitch}
      onOpen={() => open()}
      onShortcut={(tab) => open(tab)}
    />
  );
}

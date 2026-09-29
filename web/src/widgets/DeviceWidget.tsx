import { useSearchParams } from 'react-router-dom';
import { DeviceCard, deviceCardModel } from './DeviceCard';
import { useSettings } from '../state/Settings';
import { useDeviceSim } from '../state/DeviceSim';
import { activePcName } from '../devices/arrangement';

// The shared keyboard + mouse on the KVM monitor's hub — they follow the switch.
const KVM_PERIPHERALS = new Set(['origins-65', 'saga-pro']);

/**
 * Dashboard device widget — the rich `.w-devcard` design (battery, name,
 * subtitle, per-tab shortcuts, photo). Opens the device modal via `?sku=<id>`;
 * shortcuts deep-link to a tab via `?tab=<id>`. Presentation lives in the shared
 * <DeviceCard>, so the Metro dashboard renders the exact same widget.
 */
export function DeviceWidget({ skuId }: { skuId: string }) {
  const [params, setParams] = useSearchParams();
  const { kvm, pcCount } = useSettings();
  // The battery the simulator is holding this device at, else the SKU's own.
  // Applied HERE rather than inside <DeviceCard> for the reason `routedAway`
  // already is: the card is a shared presentational component, and live desk
  // state is resolved by whoever is placing it (rule 11 — the card itself stays
  // out of per-device behaviour).
  const { batteryOf } = useDeviceSim();
  const model = deviceCardModel(skuId);
  if (!model) return null;

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

  return (
    <DeviceCard
      model={{ ...model, batteryPct: batteryOf(skuId) }}
      routedAway={routedAway}
      onOpen={() => open()}
      onShortcut={(tab) => open(tab)}
    />
  );
}

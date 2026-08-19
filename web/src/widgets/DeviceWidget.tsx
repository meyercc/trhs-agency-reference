import { useSearchParams } from 'react-router-dom';
import { DeviceCard, deviceCardModel } from './DeviceCard';
import { useSettings } from '../state/Settings';

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
  const { kvm } = useSettings();
  const model = deviceCardModel(skuId);
  if (!model) return null;

  // Beat 5 — a KVM'd keyboard/mouse routed to PC 2 reads "handed off", not connected.
  const routedAway =
    kvm.configured && kvm.moveKbm && kvm.activePc === 'pc2' && KVM_PERIPHERALS.has(skuId) ? 'Work Laptop' : undefined;

  const open = (tab?: string) => {
    const p = new URLSearchParams(params);
    p.set('sku', skuId);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    setParams(p);
  };

  return <DeviceCard model={model} routedAway={routedAway} onOpen={() => open()} onShortcut={(tab) => open(tab)} />;
}

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backdrop } from '../components';
import { useSettings } from '../state/Settings';
import { SpecCanvas } from './SpecCanvas';
import { DeviceCanvas } from './DeviceCanvas';
import { KeyboardCanvas } from './KeyboardCanvas';
import { HeadsetCanvas } from './HeadsetCanvas';
import { MonitorCanvas } from './MonitorCanvas';
import { MicCanvas } from './MicCanvas';
import { LaptopCanvas } from './LaptopCanvas';
import { PsuCanvas } from './PsuCanvas';
import { isCapView } from './CoolerCapCanvas';
import { DesktopCanvas } from './DesktopCanvas';
import { getResolvedSku, resolveSku, type Sku } from './skus';
import { skuTypeInScope } from './pcDirectory';
import { LEGACY_DEVICE_TO_SKU } from './devices';
import { capsOf } from './pcLighting';
import { CHASSIS_ZONES } from '../lightstudio/towerZones';

// Decode a `?spec=<b64 json>` share link (produced by the configurator's
// "Copy share link") into a resolved SKU — previews a spec with no commit.
function decodeSpec(b64: string | null): ReturnType<typeof resolveSku> | undefined {
  if (!b64) return undefined;
  try {
    const sku = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Sku;
    if (!sku || !sku.type) return undefined;
    return resolveSku({ ...sku, id: sku.id || 'spec-preview', name: sku.name || 'Spec preview' });
  } catch {
    return undefined;
  }
}

/**
 * Renders the device modal driven by `?sku=<id>` (against configurator/skus.json),
 * so it overlays whatever route you're on and is deep-linkable (mirrors the
 * prototype's `?sku=` behavior). `?device=<id>` is still honored as a legacy
 * alias. Mounted once at the app shell level.
 */
export function DeviceModalHost() {
  const [params, setParams] = useSearchParams();
  const { mvpScope } = useSettings();
  const skuId = params.get('sku') || LEGACY_DEVICE_TO_SKU[params.get('device') || ''];
  const sku = (skuId ? getResolvedSku(skuId) : undefined) ?? decodeSpec(params.get('spec'));
  const initialTab = params.get('tab') || undefined;

  const close = () => {
    const p = new URLSearchParams(params);
    p.delete('sku');
    p.delete('device');
    p.delete('spec');
    p.delete('tab');
    p.delete('zone');
    p.delete('psu');
    p.delete('cap');
    setParams(p, { replace: true });
  };

  // The cooler cap's own address opens the PC's page at its tab, on the view
  // its `tab=` named: one place for the cap, whichever door (JY, 2026-10-22;
  // lcd-diy.25). The address is rewritten, so it names where you are.
  // Under June 2027 the cap is not a part of the PC, and its address opens nothing.
  const capOf = sku?.type === 'desktop-cooler-cap' && skuTypeInScope(sku.type, mvpScope) ? sku.partOf : undefined;
  const capView = params.get('cap');
  useEffect(() => {
    if (!capOf) return;
    const p = new URLSearchParams(params);
    const view = p.get('tab');
    p.set('sku', capOf);
    p.set('tab', 'cooler-cap');
    if (isCapView(view) && view !== 'display') p.set('cap', view);
    else p.delete('cap');
    setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capOf]);

  useEffect(() => {
    if (!sku) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku]);

  if (!sku) return null;
  // A SKU the scope leaves out is treated like one the registry does not know:
  // nothing opens. (Direct `?sku=forge-45l-cooler-cap` under June 2027.)
  if (!skuTypeInScope(sku.type, mvpScope)) return null;
  return (
    <>
      <Backdrop onClick={close} />
      {sku.type === 'mouse' ? (
        <DeviceCanvas sku={sku} onClose={close} initialTab={initialTab} />
      ) : sku.type === 'keyboard' ? (
        <KeyboardCanvas sku={sku} onClose={close} initialTab={initialTab} />
      ) : sku.type === 'headset' ? (
        <HeadsetCanvas sku={sku} onClose={close} initialTab={initialTab} />
      ) : sku.type === 'monitor' ? (
        <MonitorCanvas sku={sku} onClose={close} initialTab={initialTab} />
      ) : sku.type === 'microphone' ? (
        <MicCanvas sku={sku} onClose={close} initialTab={initialTab} />
      ) : sku.type === 'desktop' ? (
        // The tower is a device with a page of its own.
        <DesktopCanvas
          sku={sku}
          onClose={close}
          initialTab={initialTab}
          // `zone=` lands the lights on one part (the Lighting overview's part
          // labels). JY, 2026-10-21.
          initialZone={CHASSIS_ZONES.find((z) => z.id === params.get('zone'))?.id}
          // `psu=fan` lands the Power supply tab on its Fan view (System
          // Vitals' Fan door). JY, 2026-10-22.
          initialPsuView={initialTab === 'psu' && params.get('psu') === 'fan' ? 'fan' : undefined}
          // `cap=boot` / `cap=settings` lands the cooler cap tab on that view.
          initialCapView={initialTab === 'cooler-cap' && isCapView(capView) ? capView : undefined}
        />
      ) : sku.type === 'desktop-psu' && mvpScope === 'full' ? (
        // Under June 2027 the power supply is its plain spec sheet again: the
        // Status and Fan tabs are OMEN hardware control, which that scope
        // leaves out. It falls through to SpecCanvas below.
        <PsuCanvas sku={sku} onClose={close} initialTab={initialTab} />
) : capOf ? (
        // The cooler cap: the effect above moves the address to its tab.
        null
      ) : sku.type === 'notebook' && capsOf(sku.features).keyboard !== 'none' ? (
        // Only a notebook that declares a lit keyboard (one zone, four zones,
        // or per key — capsOf) gets the control canvas; its Lights tab paints
        // bands, or keys one by one on a per-key board (the OMEN Max 16, since
        // 2026-10-21). The Transcend 14 declares no lighting and keeps the spec
        // sheet it was built as (`SPEC_SCHEMA`);
        // routing on `type` alone silently replaced their System/Power/
        // Connectivity tabs, which `verify-spec-canvas` caught (TH-424).
        <LaptopCanvas sku={sku} onClose={close} initialTab={initialTab} />
      ) : (
        <SpecCanvas sku={sku} onClose={close} initialTab={initialTab} />
      )}
    </>
  );
}

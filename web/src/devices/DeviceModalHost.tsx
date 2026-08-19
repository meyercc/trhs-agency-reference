import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backdrop } from '../components';
import { SpecCanvas } from './SpecCanvas';
import { DeviceCanvas } from './DeviceCanvas';
import { KeyboardCanvas } from './KeyboardCanvas';
import { HeadsetCanvas } from './HeadsetCanvas';
import { MonitorCanvas } from './MonitorCanvas';
import { MicCanvas } from './MicCanvas';
import { getResolvedSku, resolveSku, type Sku } from './skus';
import { LEGACY_DEVICE_TO_SKU } from './devices';

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
 * prototype's `?sku=` behaviour). `?device=<id>` is still honored as a legacy
 * alias. Mounted once at the app shell level.
 */
export function DeviceModalHost() {
  const [params, setParams] = useSearchParams();
  const skuId = params.get('sku') || LEGACY_DEVICE_TO_SKU[params.get('device') || ''];
  const sku = (skuId ? getResolvedSku(skuId) : undefined) ?? decodeSpec(params.get('spec'));
  const initialTab = params.get('tab') || undefined;

  const close = () => {
    const p = new URLSearchParams(params);
    p.delete('sku');
    p.delete('device');
    p.delete('spec');
    p.delete('tab');
    setParams(p, { replace: true });
  };

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
      ) : (
        <SpecCanvas sku={sku} onClose={close} initialTab={initialTab} />
      )}
    </>
  );
}

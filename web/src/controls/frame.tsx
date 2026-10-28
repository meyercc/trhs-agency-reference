/**
 * The pieces every bound control shares (TH-452): the frame that names the
 * device and shows the current value, the honest "nothing on this desk" state,
 * and the one rule for which device a control binds to.
 *
 * Split out of `LiveControl.tsx` so the generic renderer (`BoundItem.tsx`) and
 * the bespoke controls can both import them without importing each other.
 */
import type React from 'react';
import { useSettings } from '../state/Settings';
import { deskDeviceIds } from '../devices/connectedDevices';
import { getResolvedSku, type ResolvedSku } from '../devices/skus';

export function LiveControlFrame({ title, value, children, ...rest }: { title: string; value?: string; children: React.ReactNode } & Record<`data-${string}`, string | undefined>) {
  return (
    <div className="ds-live-control" {...rest}>
      <div className="ds-live-control-head">
        <span className="ds-live-control-title">{title}</span>
        {value != null && <span className="ds-live-control-value">{value}</span>}
      </div>
      {children}
    </div>
  );
}

/** The honest empty state: the frame, with the absence where the control would be. */
export function Absent({ what, ...rest }: { what: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <LiveControlFrame title={what} {...rest}>
      <span className="ds-live-control-value">No {what.toLowerCase()} on this desk.</span>
    </LiveControlFrame>
  );
}

/**
 * "Which device" is the desk's primary of that type: the first monitor,
 * headset, mouse, microphone or keyboard on the desk (Admin's desk roster, not
 * the whole inventory), regardless of the simulator's plugged-in state — a
 * profile value exists whether or not the hardware is here right now.
 */
export function usePrimary(type: string): ResolvedSku | null {
  const { deskDevices } = useSettings();
  for (const id of deskDeviceIds(deskDevices)) {
    const sku = getResolvedSku(id);
    if (sku?.type === type) return sku;
  }
  return null;
}

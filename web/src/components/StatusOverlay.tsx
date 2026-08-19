import React, { type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * A message centred over a region, explaining the state of what's underneath —
 * why a group of controls is unavailable, why a list is empty.
 *
 * It floats above the region instead of displacing it, so the content behind
 * stays visible and the explanation can't be missed. Locked is the only state
 * that gets this treatment — a feature merely switched off never dims and
 * carries no overlay.
 *
 * The box wraps to as many lines as it needs; the radius is the same either
 * way, reading as a pill at single-line height and a rounded rect once the
 * text wraps (Figma scratchpad-2026 100:19379 / 100:25239 are one container,
 * not two variants).
 *
 * The parent must establish a positioning context — `SoftwareOnly` does this
 * via `.ds-sw-only.locked`.
 *
 * Avalonia: a Border in the adorner layer over the disabled content, with the
 * status container brush + `Radius/XL` corner radius.
 */

export interface StatusOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Leading glyph — `lock-on` for a capability lock, `info` for a note. */
  icon?: IconName;
  children: ReactNode;
}

export function StatusOverlay({ icon, children, className, ...rest }: StatusOverlayProps) {
  return (
    <div className={['ds-status-overlay', className].filter(Boolean).join(' ')} {...rest}>
      <div className="ds-status-overlay-box">
        {icon && <Icon name={icon} size={16} aria-hidden />}
        <span>{children}</span>
      </div>
    </div>
  );
}

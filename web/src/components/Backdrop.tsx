import React from 'react';

export interface BackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visible (adds `.open`). Defaults to true since it's usually mounted on demand. */
  open?: boolean;
  /** `heavy` = opaque scrim (search / pickers); `plain` = no blur. */
  variant?: 'default' | 'heavy' | 'plain';
}

/**
 * Full-screen scrim behind modals — the design system's `.ds-backdrop`
 * (rgba(6,7,9,0.24) + 16px blur). Centers its children; click it to dismiss.
 *
 * Avalonia: an overlay Border over the modal host with a BlurEffect.
 */
export function Backdrop({ open = true, variant = 'default', className, style, children, ...rest }: BackdropProps) {
  const classes = ['ds-backdrop', open ? 'open' : '', variant !== 'default' ? variant : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={{ zIndex: 50, ...style }} {...rest}>
      {children}
    </div>
  );
}

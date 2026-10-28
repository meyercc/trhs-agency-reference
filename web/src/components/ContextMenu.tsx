import React, { forwardRef, type ReactNode } from 'react';

export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * A floating menu panel. Compose `ListItem` rows (with leading icon / checkbox /
 * radio slots and optional trailing chevron), `Separator` dividers, and
 * `ContextMenuLabel` group headers as children. `role` is set before the
 * spread, so a caller can re-role the surface (Nova's popovers are dialogs on
 * this panel); the ref is forwarded so such a caller can move focus into it.
 *
 * Avalonia: a ContextMenu / MenuFlyout ControlTheme — the blurred panel around
 * MenuItems (with Icon / ToggleType for the checkbox/radio rows).
 */
export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} role="menu" className={['ds-context-menu', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
});

/** A non-interactive group label inside a ContextMenu (e.g. "Optimize"). */
export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="ds-context-menu-group" role="presentation">
      {children}
    </div>
  );
}

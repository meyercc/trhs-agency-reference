import React, { type ReactNode } from 'react';

export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * A floating menu panel. Compose `ListItem` rows (with leading icon / checkbox /
 * radio slots and optional trailing chevron), `Separator` dividers, and
 * `ContextMenuLabel` group headers as children.
 *
 * Avalonia: a ContextMenu / MenuFlyout ControlTheme — the blurred panel around
 * MenuItems (with Icon / ToggleType for the checkbox/radio rows).
 */
export function ContextMenu({ className, children, ...rest }: ContextMenuProps) {
  return (
    <div role="menu" className={['ds-context-menu', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

/** A non-interactive group label inside a ContextMenu (e.g. "Optimize"). */
export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="ds-context-menu-group" role="presentation">
      {children}
    </div>
  );
}

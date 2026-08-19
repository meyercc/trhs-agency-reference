import React, { type ReactNode } from 'react';

export interface ListItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Row text. Omitted in `iconOnly` mode. */
  label?: ReactNode;
  /** Leading slot — color swatch, icon, checkbox, toggle, avatar, etc. */
  leading?: ReactNode;
  /** Trailing slot — action icon, badge, value, toggle, etc. */
  trailing?: ReactNode;
  /** Selected (active) row. */
  selected?: boolean;
  disabled?: boolean;
  /** Compact icon-only row — just the leading slot, centered. */
  iconOnly?: boolean;
}

/**
 * Hadouken list item — a slotted row (leading · label · trailing). The slots
 * accept any content (swatch, icon, checkbox, toggle, avatar…), so it composes
 * with the rest of the system. Label uses the `.ds-text-label` type. Becomes a
 * list-box row when grouped (forthcoming).
 *
 * Avalonia: a ListBoxItem ControlTheme — leading/trailing ContentPresenters
 * around a TextBlock; hover/selected via the PointerOver / Selected visual
 * states.
 */
export function ListItem({ label, leading, trailing, selected, disabled, iconOnly, className, ...rest }: ListItemProps) {
  const classes = [
    'ds-list-item',
    selected ? 'selected' : '',
    disabled ? 'disabled' : '',
    iconOnly ? 'icon-only' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      role="option"
      aria-selected={selected || undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      {...rest}
    >
      {leading != null && <span className="ds-list-item-leading">{leading}</span>}
      {!iconOnly && <span className="ds-text-label ds-list-item-label">{label}</span>}
      {!iconOnly && trailing != null && <span className="ds-list-item-trailing">{trailing}</span>}
    </div>
  );
}

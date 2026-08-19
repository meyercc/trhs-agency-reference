import React, { type ReactNode } from 'react';

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Selected (active) filter. */
  selected?: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Icon-only chip (omit the label). */
  iconOnly?: boolean;
  /** Chip label. */
  children?: ReactNode;
}

/**
 * Hadouken toggle button used standalone as a selectable filter chip — the
 * segmented option, uncontained. Default carries its own surface + border;
 * `selected` applies the accent wash + border. Toggle semantics via
 * `aria-pressed`.
 *
 * Avalonia: a ToggleButton with the chip ControlTheme (Checked = accent fill).
 */
export function Chip({ selected, icon, iconOnly, className, children, ...rest }: ChipProps) {
  const classes = ['ds-chip', selected ? 'selected' : '', iconOnly ? 'icon-only' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} aria-pressed={selected} {...rest}>
      {icon != null && <span className="ds-chip-icon">{icon}</span>}
      {!iconOnly && children}
    </button>
  );
}

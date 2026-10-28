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
 * `aria-pressed` — unless the caller re-roles the chip (`role="radio"` in a
 * radiogroup, with its own `aria-checked`): a radio may not also claim to be
 * a pressed button, so the role wins and `aria-pressed` is withheld (TH-437).
 * The look still follows `selected` through the class.
 *
 * Avalonia: a ToggleButton with the chip ControlTheme (Checked = accent fill);
 * re-roled, a RadioButton with the same theme.
 */
export function Chip({ selected, icon, iconOnly, className, children, ...rest }: ChipProps) {
  const classes = ['ds-chip', selected ? 'selected' : '', iconOnly ? 'icon-only' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} aria-pressed={rest.role ? undefined : selected} {...rest}>
      {icon != null && <span className="ds-chip-icon">{icon}</span>}
      {!iconOnly && children}
    </button>
  );
}

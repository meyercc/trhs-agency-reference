import React, { type ReactNode } from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional trailing label. */
  label?: ReactNode;
}

/**
 * Thin wrapper over the design system's `.ds-radio` (the Hadouken selector
 * radio). Hidden native input + styled `.ds-radio-mark`. Group radios by giving
 * them the same `name`; controlled via `checked` + `onChange`.
 *
 * Avalonia: a RadioButton with a ControlTheme — Off/On from IsChecked, accent
 * fill + dot via the selected visual state, GroupName for grouping.
 */
export function Radio({ label, className, disabled, ...rest }: RadioProps) {
  const classes = ['ds-radio', disabled ? 'disabled' : '', className].filter(Boolean).join(' ');
  return (
    <label className={classes}>
      <input type="radio" disabled={disabled} {...rest} />
      <span className="ds-radio-mark" />
      {label != null && <span className="ds-radio-label">{label}</span>}
    </label>
  );
}

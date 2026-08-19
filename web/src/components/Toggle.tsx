import React from 'react';

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** On by default — matches the `.ds-toggle` convention (`.off` = off). */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * Thin wrapper over the design system's `.ds-toggle`. Note the DS convention:
 * `.ds-toggle` is ON; add `.off` for the off state (not `.on` for on).
 */
export function Toggle({ checked = true, onChange, className, ...rest }: ToggleProps) {
  const classes = ['ds-toggle', checked ? '' : 'off', className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={classes}
      onClick={() => onChange?.(!checked)}
      {...rest}
    />
  );
}

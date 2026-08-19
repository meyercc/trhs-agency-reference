import React, { useEffect, useRef, type ReactNode } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional trailing label. */
  label?: ReactNode;
  /** Render the dash (mixed) state. Driven via the DOM `indeterminate` flag. */
  indeterminate?: boolean;
}

/**
 * Thin wrapper over the design system's `.ds-checkbox` (the Hadouken selector
 * checkbox). Hidden native input + styled `.ds-checkbox-mark`; supports
 * controlled/uncontrolled `checked`, `disabled`, and `indeterminate`.
 *
 * Avalonia: a CheckBox with a ControlTheme — Off/On from IsChecked, the
 * `indeterminate` state from IsChecked={x:Null} (ThreeState), accent fill via
 * the selected visual state.
 */
export function Checkbox({ label, indeterminate, className, disabled, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  const classes = ['ds-checkbox', disabled ? 'disabled' : '', className].filter(Boolean).join(' ');
  return (
    <label className={classes}>
      <input ref={ref} type="checkbox" disabled={disabled} {...rest} />
      <span className="ds-checkbox-mark" />
      {label != null && <span className="ds-checkbox-label">{label}</span>}
    </label>
  );
}

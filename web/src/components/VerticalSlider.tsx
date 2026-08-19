import React, { forwardRef, useState } from 'react';

export interface VerticalSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Track length in px (default 204). */
  length?: number;
  /** Format the value popup label. */
  formatValue?: (value: number) => string;
  /** Always show the value popup, not just while active. */
  showValue?: boolean;
  disabled?: boolean;
}

/**
 * Vertical slider over the shared `.ds-rail` chrome with the `vertical`
 * orientation modifier. Value 0 sits at the bottom and the accent fill grows
 * up; the native range input runs bottom→top, and the value popup sits to the
 * LEFT of the handle (upright text, arrow pointing at the handle). A transparent
 * native input drives interaction + a11y.
 *
 * Avalonia: a Slider with Orientation="Vertical" and a ToolTip-style popup
 * placed to the left.
 */
export const VerticalSlider = forwardRef<HTMLInputElement, VerticalSliderProps>(function VerticalSlider(
  {
    min = 0,
    max = 100,
    step = 1,
    value,
    defaultValue = 50,
    onChange,
    length = 204,
    formatValue,
    showValue,
    disabled,
    className,
    ...rest
  },
  ref,
) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const v = isControlled ? (value as number) : internal;
  const [active, setActive] = useState(false);

  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
  const label = formatValue ? formatValue(v) : String(v);

  const classes = ['ds-rail', 'vertical', active || showValue ? 'is-active' : '', disabled ? 'disabled' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ ['--pct']: pct, ['--rail-len']: `${length}px` } as React.CSSProperties}>
      <div className="ds-rail-track" />
      <div className="ds-rail-fill" style={{ height: `${pct}%` }} />
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        disabled={disabled}
        aria-orientation="vertical"
        aria-valuetext={label}
        onChange={(e) => {
          const nv = Number(e.target.value);
          if (!isControlled) setInternal(nv);
          onChange?.(nv);
        }}
        onPointerDown={() => setActive(true)}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        {...rest}
      />
      <div className="ds-rail-handle" />
      <div className="ds-rail-popup" aria-hidden="true">
        {label}
      </div>
    </div>
  );
});

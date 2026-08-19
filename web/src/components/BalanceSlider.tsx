import React, { forwardRef, useState } from 'react';

export interface BalanceSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value (centre = midpoint of min/max). */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Format the value popup label (defaults to the raw value). */
  formatValue?: (value: number) => string;
  /** Always show the value popup, not just while active. */
  showValue?: boolean;
  disabled?: boolean;
}

/**
 * Audio L/R balance slider over the design system's shared `.ds-rail` chrome
 * plus the `.ds-balance` modifier. Unlike a normal slider, the fill grows from
 * the CENTRE toward the handle — left of centre fills left, right fills right —
 * with L/centre/R notches and a value popup while dragging or focused. A
 * transparent native range input drives interaction and accessibility; the
 * visual layers track `--pct`.
 *
 * Avalonia: a Slider ControlTheme with a centre-anchored decorator for the
 * fill and a ToolTip-style popup bound to Value.
 */
export const BalanceSlider = forwardRef<HTMLInputElement, BalanceSliderProps>(function BalanceSlider(
  {
    min = 0,
    max = 100,
    step = 1,
    value,
    defaultValue = 50,
    onChange,
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

  const pct = max > min ? ((v - min) / (max - min)) * 100 : 50;
  const lo = Math.min(50, pct);
  const widthPct = Math.abs(pct - 50);
  const label = formatValue ? formatValue(v) : String(v);

  const classes = ['ds-rail', 'ds-balance', active || showValue ? 'is-active' : '', disabled ? 'disabled' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ ['--pct' as string]: pct } as React.CSSProperties}>
      <div className="ds-rail-track" />
      <div className="ds-rail-fill" style={{ left: `${lo}%`, width: `${widthPct}%` }} />
      <span className="ds-balance-notch left" />
      <span className="ds-balance-notch center" />
      <span className="ds-balance-notch right" />
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        disabled={disabled}
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

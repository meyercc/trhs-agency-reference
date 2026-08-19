import React, { forwardRef, useState } from 'react';

export type ColorSliderVariant = 'hue' | 'lightness' | 'opacity';

export interface ColorSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'defaultValue' | 'color'> {
  /** Which colour dimension the track represents. */
  variant?: ColorSliderVariant;
  /** Base colour for the lightness/opacity gradients and the handle dot. */
  color?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Format the value popup label. */
  formatValue?: (value: number) => string;
  /** Always show the value popup, not just while active. */
  showValue?: boolean;
  disabled?: boolean;
}

/**
 * Colour picker slider over the shared `.ds-rail` chrome plus a `.ds-color`
 * gradient track. Three variants: `hue` (rainbow spectrum), `lightness`
 * (black → colour → white), and `opacity` (a CSS checkerboard under a
 * transparent → colour gradient). The whole track is the gradient — no fill —
 * and the handle's inner dot shows the current colour.
 *
 * Avalonia: a Slider ControlTheme whose track Background is a LinearGradientBrush
 * (or a DrawingBrush checkerboard for opacity), thumb fill bound to the colour.
 */
export const ColorSlider = forwardRef<HTMLInputElement, ColorSliderProps>(function ColorSlider(
  {
    variant = 'hue',
    color = 'var(--accent-color)',
    min = 0,
    max = 100,
    step = 1,
    value,
    defaultValue = variant === 'hue' ? 0 : variant === 'opacity' ? 100 : 50,
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

  const frac = max > min ? (v - min) / (max - min) : 0;
  const pct = frac * 100;
  const handleColor = variant === 'hue' ? `hsl(${frac * 360} 100% 50%)` : color;
  const label = formatValue ? formatValue(v) : String(v);

  const classes = ['ds-rail', 'ds-color-slider', active || showValue ? 'is-active' : '', disabled ? 'disabled' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={
        {
          ['--pct']: pct,
          ['--color']: color,
          ['--handle-color']: handleColor,
        } as React.CSSProperties
      }
    >
      <div className={`ds-color-track ${variant}`} />
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

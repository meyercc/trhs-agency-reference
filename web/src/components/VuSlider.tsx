import React, { forwardRef, useState } from 'react';

export type VuVariant = 'default' | 'reference' | 'peak' | 'clipping';

export interface VuSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Meter colouring: neutral, all-green, green→amber, or green→amber→red. */
  variant?: VuVariant;
  /** Level marks per row. */
  marks?: number;
  /** Format the value popup label. */
  formatValue?: (value: number) => string;
  /** Always show the value popup, not just while active. */
  showValue?: boolean;
  disabled?: boolean;
}

/** Colour class for a mark at fractional position `frac` (0–1) given the variant. */
function markClass(variant: VuVariant, frac: number): string {
  switch (variant) {
    case 'reference':
      return 'green';
    case 'peak':
      return frac >= 0.8 ? 'yellow' : 'green';
    case 'clipping':
      return frac >= 0.88 ? 'red' : frac >= 0.72 ? 'yellow' : 'green';
    default:
      return '';
  }
}

/**
 * VU slider over the shared `.ds-rail` slider chrome plus a `.ds-vu` meter:
 * a left-origin slider (accent fill + white handle, value popup while active)
 * flanked by two rows of level marks. The `variant` colours the marks to show
 * a VU scale — green (reference), amber peak zone, or a red clipping zone.
 *
 * Avalonia: a Slider ControlTheme with an ItemsControl of level marks bound to
 * a value-to-brush converter for the meter.
 */
export const VuSlider = forwardRef<HTMLInputElement, VuSliderProps>(function VuSlider(
  {
    min = 0,
    max = 100,
    step = 1,
    value,
    defaultValue = 50,
    onChange,
    variant = 'default',
    marks = 32,
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

  const meter = Array.from({ length: marks }, (_, i) => (
    <span key={i} className={['ds-vu-mark', markClass(variant, marks > 1 ? i / (marks - 1) : 0)].filter(Boolean).join(' ')} />
  ));

  const classes = ['ds-rail', 'ds-vu', active || showValue ? 'is-active' : '', disabled ? 'disabled' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ ['--pct' as string]: pct } as React.CSSProperties}>
      <div className="ds-vu-meter top" aria-hidden="true">
        {meter}
      </div>
      <div className="ds-rail-track" />
      <div className="ds-rail-fill" style={{ left: 0, width: `${pct}%` }} />
      <div className="ds-vu-meter bottom" aria-hidden="true">
        {meter}
      </div>
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

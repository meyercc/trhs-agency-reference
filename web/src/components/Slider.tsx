import React, { useState } from 'react';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Opt-in "managed / OMEN AI" fill — paints the filled portion with the OMEN
   *  brand gradient (red→orange→yellow) instead of the solid accent. Off by
   *  default, so every other slider is unchanged. A gradient is used on purpose:
   *  it reads as AI/auto and never collides with the user's solid accent colour. */
  gradient?: boolean;
}

// Track fill up to the current value — mirrors dsSliderUpdate, via CSS vars so
// it re-themes with the accent. `gradient` swaps the solid accent fill for the
// OMEN brand gradient (managed/AI state).
function fillBg(min: number, max: number, value: number, gradient?: boolean) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  if (gradient) {
    // OMEN brand gradient, softened (~40% transparent) so it reads as AI/auto
    // without the full-strength neon punch.
    return `linear-gradient(to right, color-mix(in srgb, var(--omen-red), transparent 40%) 0%, color-mix(in srgb, var(--omen-orange), transparent 40%) ${pct * 0.55}%, color-mix(in srgb, var(--omen-yellow), transparent 40%) ${pct}%, var(--border-med) ${pct}%, var(--border-med) 100%)`;
  }
  return `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${pct}%, var(--border-med) ${pct}%, var(--border-med) 100%)`;
}

/** Thin wrapper over the design system's `.ds-slider`. */
export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = 50,
  onChange,
  className,
  gradient,
  ...rest
}: SliderProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const v = isControlled ? (value as number) : internal;

  return (
    <div className={['ds-slider', className].filter(Boolean).join(' ')}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        style={{ background: fillBg(min, max, v, gradient) }}
        onChange={(e) => {
          const nv = Number(e.target.value);
          if (!isControlled) setInternal(nv);
          onChange?.(nv);
        }}
        {...rest}
      />
    </div>
  );
}

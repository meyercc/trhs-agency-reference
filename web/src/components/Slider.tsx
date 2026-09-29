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
  /** Opt-in READ-ONLY mode — hands both visual layers to the consumer's CSS so a
   *  slider the user can't drag right now can be drawn in the app's read-only
   *  meter vocabulary. Off by default, so every other slider is unchanged.
   *  Why the consumer draws it: a colour stop inside this element's own background
   *  can only ever end at a 90° cut, and a read-only fill has to end ROUNDED like
   *  the rest of the app's read-only bars (`.ds-prog-fill`, `.ds-rail-fill`). So in
   *  this mode the input paints NOTHING and the wrapper exposes `--pct` — the same
   *  convention `.ds-rail` already uses for its visual layers (see VuSlider /
   *  BalanceSlider) — for CSS to size the fill against.
   *  ⚠️ The name is now a misnomer: the fill is the ordinary accent, not a
   *  gradient (Chris 1:1 2026-08-04 — the OMEN gradient is reserved for genuinely
   *  AI-held controls). Kept as-is because Chris already has this API in hand and
   *  said he'd fold it into a proper `managed` variant; renaming unilaterally
   *  would break the thing he agreed to. */
  gradient?: boolean;
}

function pctOf(min: number, max: number, value: number) {
  return max > min ? ((value - min) / (max - min)) * 100 : 0;
}

// Track fill up to the current value — mirrors dsSliderUpdate, via CSS vars so
// it re-themes with the accent. In read-only mode this element paints NOTHING:
// the treatment sits on the meter-bar vocabulary (Chris, monitor-merge replies
// 2026-08-04), so the consumer CSS owns both layers — a meter-faint track and a
// rounded accent fill. `--border-med` here would be the grabbable slider's track,
// which is exactly what a read-only control must not say.
function fillBg(min: number, max: number, value: number, gradient?: boolean) {
  if (gradient) return 'transparent';
  const pct = pctOf(min, max, value);
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
    <div
      className={['ds-slider', className].filter(Boolean).join(' ')}
      // Managed mode only, so a plain slider's markup is untouched. Unitless 0–100
      // on the wrapper, per the `.ds-rail` convention: `calc(var(--pct) * 1%)`.
      style={gradient ? ({ ['--pct' as string]: pctOf(min, max, v) } as React.CSSProperties) : undefined}
    >
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

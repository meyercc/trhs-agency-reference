import React, { type CSSProperties } from 'react';

export interface AngleDialProps {
  /** Degrees, 0–360. 0 points right; angles turn clockwise. */
  value: number;
  onChange: (value: number) => void;
  /** Degrees per arrow-key press (Shift: ×3). */
  step?: number;
  'aria-label': string;
  className?: string;
}

const wrap = (a: number) => ((Math.round(a) % 360) + 360) % 360;

/**
 * Thin wrapper over `.ds-angle-dial` — Figma "Angle": a round control whose
 * indicator points along the angle. Drag it round with the pointer, or focus
 * it and use the arrow keys (a `slider` to assistive tech). Pair it with a
 * `<Stepper size="sm">` for typing the number, as Figma's Angle Control does.
 *
 * Avalonia: a templated RangeBase (0–360) — an Ellipse with a rotated Line,
 * pointer drag mapped through atan2.
 */
export function AngleDial({ value, onChange, step = 15, className, 'aria-label': label }: AngleDialProps) {
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.focus();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const move = (ev: PointerEvent) => onChange(wrap((Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(e.nativeEvent);
  };
  return (
    <button
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={value}
      aria-valuetext={`${value}°`}
      className={['ds-angle-dial', className].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        const by = e.shiftKey ? step * 3 : step;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(wrap(value + by));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(wrap(value - by));
        }
      }}
    >
      <span className="ds-angle-dial-needle" style={{ ['--angle' as string]: `${value}deg` } as CSSProperties} aria-hidden="true" />
    </button>
  );
}

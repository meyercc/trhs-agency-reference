import { useState } from 'react';
import { Icon } from './Icon';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /**
   * Amount per click or arrow key. A function receives the current value, for
   * scales where the right step depends on where you are (1 Hz near 20 Hz,
   * 100 Hz near 10 kHz).
   */
  step?: number | ((value: number) => number);
  /** How the value reads while not being edited — "2.5 kHz", "+6.0 dB". */
  format?: (value: number) => string;
  /** Typed text → value. `null` rejects the edit and the field reverts. Defaults to `Number`. */
  parse?: (text: string) => number | null;
  /** Decimal places a stepped or typed value is rounded to. */
  precision?: number;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
}

/**
 * A numeric field with stacked step buttons — the design system's `.ds-stepper`
 * (Figma "Input Fields" with Add/Subtract buttons: a `.ds-input` and two 16px
 * chevrons). The field shows the formatted value with its unit; focusing it
 * exposes the bare number for typing, and Enter, Tab or blur commit. Arrow
 * keys step in place, so the buttons are a pointer convenience, not the only
 * way — they are out of the tab order for that reason.
 *
 * Avalonia: a NumericUpDown with a custom ValueConverter for the unit text.
 */
export function Stepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  format = String,
  parse,
  precision = 2,
  disabled,
  className,
  'aria-label': label,
}: StepperProps) {
  // `null` while not editing: the field shows the formatted value instead.
  const [text, setText] = useState<string | null>(null);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const round = (v: number) => +v.toFixed(precision);
  const stepBy = (dir: 1 | -1) => {
    const by = typeof step === 'function' ? step(value) : step;
    onChange(clamp(round(value + dir * by)));
    setText(null);
  };
  const commit = () => {
    if (text === null) return;
    const parsed = parse ? parse(text) : text.trim() === '' ? null : Number(text);
    if (parsed !== null && Number.isFinite(parsed)) onChange(clamp(round(parsed)));
    setText(null);
  };

  const classes = ['ds-stepper', disabled ? 'disabled' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <input
        className="ds-input numeric ds-stepper-field"
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={format(value)}
        value={text ?? format(value)}
        disabled={disabled}
        onFocus={(e) => {
          setText(String(value));
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            // Abandon the edit and keep the modal behind it open.
            e.stopPropagation();
            setText(null);
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            stepBy(1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            stepBy(-1);
          }
        }}
      />
      <span className="ds-stepper-btns">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => stepBy(1)}
        >
          <Icon name="chevron-up" size={8} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => stepBy(-1)}
        >
          <Icon name="chevron-down" size={8} />
        </button>
      </span>
    </div>
  );
}

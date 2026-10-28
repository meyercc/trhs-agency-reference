import React, { forwardRef, type CSSProperties } from 'react';
import { Swatch } from './Swatch';

export interface GradientStopsProps {
  /** The stops' colors, left to right — evenly spaced along the bar. */
  colors: string[];
  /** The stop being edited, if any. */
  active?: number | null;
  /** A handle was clicked (or Enter/Space on it). */
  onSelect: (index: number, handle: HTMLButtonElement) => void;
  /**
   * The bar was clicked between handles: insert a stop at `fraction` (0–1)
   * of its length. Omit to make the bar inert.
   */
  onInsert?: (fraction: number) => void;
  /** Names the control and prefixes each handle's label ("Gradient stop 2 of 5"). */
  label: string;
  className?: string;
}

/** The CSS gradient for evenly spaced stops — the same read the backlight makes. */
export const gradientOf = (colors: string[]) =>
  colors.length === 1 ? colors[0] : `linear-gradient(90deg, ${colors.join(', ')})`;

/**
 * Thin wrapper over `.ds-gradient-stops` — Figma "Gradient Editor": the
 * gradient as a wide `Swatch` with one ring handle per color stop. Stops are
 * evenly spaced (a palette, not free positions), so the handles sit at
 * i / (n − 1). Arrow keys move between handles; the caller opens its color
 * editor from `onSelect`, anchored to the handle it is given.
 *
 * Avalonia: a Grid of the gradient Border and an ItemsControl of
 * ToggleButtons on a Canvas, positioned by index.
 */
export const GradientStops = forwardRef<HTMLDivElement, GradientStopsProps>(function GradientStops(
  { colors, active, onSelect, onInsert, label, className },
  ref,
) {
  const n = colors.length;
  const at = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const focusHandle = (from: HTMLElement, i: number) =>
    from.parentElement?.querySelectorAll<HTMLButtonElement>('.ds-gradient-stops-handle')[i]?.focus();

  return (
    <div ref={ref} role="group" aria-label={label} className={['ds-gradient-stops', className].filter(Boolean).join(' ')}>
      <Swatch
        wide
        className="ds-gradient-stops-bar"
        gradient={n > 1 ? gradientOf(colors) : undefined}
        color={n === 1 ? colors[0] : undefined}
        label={onInsert ? `${label} — click to add a stop` : label}
        tabIndex={-1}
        disabled={!onInsert}
        onClick={(e) => {
          if (!onInsert) return;
          const r = e.currentTarget.getBoundingClientRect();
          onInsert(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
        }}
      />
      <div className="ds-gradient-stops-track">
        <span className="ds-gradient-stops-line" aria-hidden="true" />
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            className={['ds-gradient-stops-handle', active === i ? 'active' : ''].filter(Boolean).join(' ')}
            style={{ left: `${at(i)}%`, ['--stop-color' as string]: c } as CSSProperties}
            aria-label={`${label} stop ${i + 1} of ${n}`}
            aria-pressed={active === i}
            onClick={(e) => onSelect(i, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && i < n - 1) {
                e.preventDefault();
                focusHandle(e.currentTarget, i + 1);
              } else if (e.key === 'ArrowLeft' && i > 0) {
                e.preventDefault();
                focusHandle(e.currentTarget, i - 1);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
});

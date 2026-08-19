import React, { forwardRef } from 'react';

/** The Hadouken rainbow gradient, built from the accent palette tokens. */
export const RAINBOW =
  'linear-gradient(90deg, var(--accent-red) 0%, var(--accent-orange) 17%, var(--accent-yellow) 33%, var(--accent-green) 50%, var(--accent-cyan) 67%, var(--accent-indigo) 83%, var(--accent-purple) 100%)';

export interface SwatchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** A single fill colour. */
  color?: string;
  /** Two+ colours split the chip into equal segments (2 = halves, 3+ = pie). */
  colors?: string[];
  /** Any CSS gradient string for a gradient chip (e.g. `RAINBOW`). */
  gradient?: string;
  /** Diameter / pill height in px. */
  size?: number;
  /** Pill width in px; defaults to a circle (= `size`). */
  width?: number;
  /** Selected halo. */
  selected?: boolean;
  /** Accessible name (e.g. the colour's name). */
  label?: string;
}

/** Resolve the chip's background from a single colour, a colour list, or a gradient. */
function fillStyle({ color, colors, gradient }: Pick<SwatchProps, 'color' | 'colors' | 'gradient'>): React.CSSProperties {
  if (gradient) return { backgroundImage: gradient };
  if (colors && colors.length > 1) {
    if (colors.length === 2) {
      return { backgroundImage: `linear-gradient(90deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)` };
    }
    const seg = 100 / colors.length;
    const stops = colors.map((c, i) => `${c} ${(i * seg).toFixed(3)}% ${((i + 1) * seg).toFixed(3)}%`).join(', ');
    return { backgroundImage: `conic-gradient(${stops})` };
  }
  return { background: colors?.[0] ?? color };
}

/**
 * Thin wrapper over the design system's `.ds-swatch`. A selectable colour chip
 * with the layered Hadouken treatment (soft-light sheen + inner/outer rings,
 * white halo when selected). Single colour, a split of several, or a gradient;
 * circle by default, pill when `width` is set.
 *
 * Avalonia: a ToggleButton ControlTheme — the fill via Background, the rings as
 * a layered Border, IsChecked driving the selected halo.
 */
export const Swatch = forwardRef<HTMLButtonElement, SwatchProps>(function Swatch(
  { color, colors, gradient, size = 24, width, selected, label, className, style, ...rest },
  ref,
) {
  const classes = ['ds-swatch', selected ? 'selected' : '', className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      style={{ width: width ?? size, height: size, ...fillStyle({ color, colors, gradient }), ...style }}
      {...rest}
    />
  );
});

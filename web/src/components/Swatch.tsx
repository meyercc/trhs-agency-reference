import React, { forwardRef } from 'react';

/** The Hadouken rainbow gradient, built from the accent palette tokens. */
export const RAINBOW =
  'linear-gradient(90deg, var(--accent-red) 0%, var(--accent-orange) 17%, var(--accent-yellow) 33%, var(--accent-green) 50%, var(--accent-cyan) 67%, var(--accent-indigo) 83%, var(--accent-purple) 100%)';

export interface SwatchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** A single fill color. */
  color?: string;
  /** Two+ colors split the chip into equal segments (2 = halves, 3+ = pie). */
  colors?: string[];
  /** Any CSS gradient string for a gradient chip (e.g. `RAINBOW`). */
  gradient?: string;
  /** An image, cover-filling the chip — a picture chosen the same way as a color. */
  image?: string;
  /** Diameter / pill height in px. */
  size?: number;
  /** Pill width in px; defaults to a circle (= `size`). */
  width?: number;
  /** Stretch to fill the row instead of taking a fixed measure (`.wide`). */
  wide?: boolean;
  /** Selected halo. */
  selected?: boolean;
  /** Accessible name (e.g. the color's name). */
  label?: string;
}

/** Resolve the chip's background from a single color, a color list, or a gradient. */
function fillStyle({ color, colors, gradient, image }: Pick<SwatchProps, 'color' | 'colors' | 'gradient' | 'image'>): React.CSSProperties {
  if (image) return { backgroundImage: `url(${JSON.stringify(image)})`, backgroundSize: 'cover', backgroundPosition: 'center' };
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
 * Thin wrapper over the design system's `.ds-swatch`. A selectable color chip
 * with the layered Hadouken treatment (soft-light sheen + inner/outer rings,
 * white halo when selected). Single color, a split of several, or a gradient;
 * circle by default, a fixed pill when `width` is set, and a row-filling pill
 * when `wide` is set — `wide` leaves the width to flex, so it is the one to
 * reach for when several chips share a row that has to resize with its panel.
 *
 * Avalonia: a ToggleButton ControlTheme — the fill via Background, the rings as
 * a layered Border, IsChecked driving the selected halo.
 */
export const Swatch = forwardRef<HTMLButtonElement, SwatchProps>(function Swatch(
  { color, colors, gradient, image, size = 24, width, wide, selected, label, className, style, ...rest },
  ref,
) {
  const classes = ['ds-swatch', wide ? 'wide' : '', selected ? 'selected' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      // `wide` deliberately writes no width — an inline px value would beat the
      // class and defeat the flex sizing that variant exists for.
      style={{ ...(wide ? null : { width: width ?? size }), height: size, ...fillStyle({ color, colors, gradient, image }), ...style }}
      {...rest}
    />
  );
});

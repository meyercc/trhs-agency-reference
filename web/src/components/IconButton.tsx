import React from 'react';

export type IconButtonVariant = 'default' | 'accent' | 'ghost';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Accessible name — an icon-only button has no visible text, so this is
   * required. Also shown as the tooltip copy when paired with `Tooltip`.
   */
  label: string;
  /** Visual style. `default` is the secondary `.ds-btn-icon` surface. */
  variant?: IconButtonVariant;
  /** The icon (an `<Icon size={16} />`). */
  children: React.ReactNode;
}

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  default: '',
  accent: 'accent',
  ghost: 'ghost',
};

/**
 * Thin wrapper over the design system's `.ds-btn-icon` — the 32×32 icon-only
 * button (Figma Button/Secondary icon-only: 16px icon, `--radius-sm`, the
 * Kintsugi secondary surface + inner/outer border). Same variants the CSS
 * defines: `accent` (primary-filled, the play buttons) and `ghost` (bare).
 *
 * Pair with `Tooltip` when the icon alone may not be self-evident — the
 * tooltip copy should match `label` so sighted and AT users hear the same name.
 *
 * Avalonia: a Button ControlTheme with a PathIcon content, Width/Height 32.
 */
export function IconButton({ label, variant = 'default', className, children, ...rest }: IconButtonProps) {
  const classes = ['ds-btn-icon', VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
  return (
    <button type="button" aria-label={label} className={classes} {...rest}>
      {children}
    </button>
  );
}

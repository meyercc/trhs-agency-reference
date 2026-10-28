import React, { forwardRef } from 'react';

export interface FabProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name. A FAB is icon-only, so it is required; say what a press does now ("Ask Nova" / "Close Nova"). */
  label: string;
  /** The rest face (an `<Icon size={20} />`). */
  icon: React.ReactNode;
  /** The face shown while `open` (usually a close or chevron). Omit for a button that opens nothing. */
  openIcon?: React.ReactNode;
  /** The surface it owns is showing: the faces cross and `aria-expanded` follows. */
  open?: boolean;
  /** Working on something: the ring runs and the rest face breathes. Pair with a status line elsewhere. */
  busy?: boolean;
  /** Something arrived while closed: the shoulder dot. Say it in `label` too. */
  badge?: boolean;
}

/**
 * Thin wrapper over the design system's `.ds-fab` (shared/components.css) —
 * the round, raised accent button that floats over the page and opens a
 * surface of its own. The host places it; the CSS owns how it looks.
 *
 * `open` sets `aria-expanded` only when `openIcon` is given (a FAB that opens
 * nothing is a plain button). `busy` is visual: the caller announces it.
 *
 * Avalonia: a Button ControlTheme with CornerRadius = Width/2, an accent
 * Background and a BoxShadow; the two faces are PathIcons in one Grid cell
 * with RotateTransform/Opacity transitions on the `:checked`-style class; the
 * ring is an Ellipse stroked with a ConicGradientBrush under a RotateTransform
 * animation, shown on the `busy` class.
 */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
  { label, icon, openIcon, open = false, busy = false, badge = false, className, ...rest },
  ref,
) {
  const classes = ['ds-fab', open && openIcon ? 'open' : '', busy ? 'busy' : '', className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-expanded={openIcon ? open : undefined}
      aria-busy={busy || undefined}
      className={classes}
      {...rest}
    >
      <span className="ds-fab-ring" aria-hidden />
      <span className="ds-fab-icon rest-face" aria-hidden>
        {icon}
      </span>
      {openIcon && (
        <span className="ds-fab-icon open-face" aria-hidden>
          {openIcon}
        </span>
      )}
      {badge && <span className="ds-fab-badge" aria-hidden />}
    </button>
  );
});

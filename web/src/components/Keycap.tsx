import React, { forwardRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type KeycapVariant = 'key' | 'hit';

export interface KeycapProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `key` — the Figma "Key Overlay": a filled cap with its legend.
   * `hit` — the Lights tab's pick target: invisible over the render until
   * hovered, ringed when `picked`. Draws no legend; give it an `aria-label`.
   */
  variant?: KeycapVariant;
  /** The legend, in Subheadline caps. Ignored when `icon` is set. */
  label?: ReactNode;
  /** A glyph legend instead of text (arrows, FN functions). */
  icon?: IconName;
  /** FN layer, no function on this key — the dimmed cap. */
  dim?: boolean;
  /** The active key (Figma State=Active). Sets `aria-pressed`. */
  selected?: boolean;
  /** Carries a remap; with `selected`, the accent wash. */
  assigned?: boolean;
  /** A chip is being dragged over it. */
  dropTarget?: boolean;
  /** `hit` only: picked for painting (white ring). Sets `aria-pressed`. */
  picked?: boolean;
}

/**
 * Thin wrapper over `.ds-keycap` — the control drawn over one cap of a
 * keyboard render (Figma Keys-Buttons "Key Overlay", 2091:399501). It fills
 * the box its parent gives it: the board positions each cap absolutely in
 * the render's own px, so pass `style` with `left`/`top`/`width`/`height`.
 * Drag-and-drop handlers pass straight through to the `<button>`.
 *
 * Avalonia: a ToggleButton ControlTheme on a Canvas over the render — the
 * legend a TextBlock or PathIcon; Dim / Assigned / DropTarget as classes,
 * Active as IsChecked.
 */
export const Keycap = forwardRef<HTMLButtonElement, KeycapProps>(function Keycap(
  { variant = 'key', label, icon, dim, selected, assigned, dropTarget, picked, className, ...rest },
  ref,
) {
  const hit = variant === 'hit';
  const classes = [
    'ds-keycap',
    hit && 'hit',
    !hit && dim && 'dim',
    !hit && selected && 'selected',
    !hit && assigned && 'assigned',
    dropTarget && 'drop',
    hit && picked && 'picked',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type="button" className={classes} aria-pressed={hit ? !!picked : !!selected} {...rest}>
      {!hit && (icon ? <Icon name={icon} size="sm" /> : label != null && <span className="ds-text-subheadline caps ds-keycap-label">{label}</span>)}
    </button>
  );
});

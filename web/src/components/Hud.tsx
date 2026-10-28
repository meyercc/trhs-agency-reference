import React, { forwardRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface HudProps extends React.HTMLAttributes<HTMLElement> {
  /** The overlay's name, in the head. */
  title: string;
  /** Stat tiles and live controls, in a row. */
  children: ReactNode;
  /** Hide the overlay. */
  onClose?: () => void;
  /** Props for the grip — the host wires the drag and the arrow keys here. */
  gripProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  /** While a drag is in flight. */
  dragging?: boolean;
  /** Draw the grip. A preview that cannot be moved passes false — an affordance that does nothing is a lie. */
  grip?: boolean;
}

/**
 * The design system's overlay card (`.ds-hud`, shared/components.css): a
 * grip, a title, a hide button and a body of compact StatTiles or
 * LiveControls. Placement is not its business — OverlayHost positions it,
 * drags it and persists where it lands; the grip is both the pointer handle
 * and the keyboard handle (arrow keys), which is why it is a button.
 *
 * Avalonia: a Border with the HUD ControlTheme inside a Canvas; the grip a
 * Thumb whose DragDelta the host handles.
 */
export const Hud = forwardRef<HTMLElement, HudProps>(function Hud({ title, children, onClose, gripProps, dragging, grip = true, className, ...rest }, ref) {
  const classes = ['ds-hud', dragging ? 'dragging' : '', className].filter(Boolean).join(' ');
  return (
    <aside ref={ref} className={classes} aria-label={title} {...rest}>
      <div className="ds-hud-head">
        {grip && (
          <button type="button" className="ds-hud-grip" aria-label={`Move ${title} — arrow keys`} {...gripProps}>
            <Icon name="more" size={14} />
          </button>
        )}
        <span className="ds-hud-title">{title}</span>
        {onClose && (
          <button type="button" className="ds-hud-close" aria-label={`Hide ${title}`} onClick={onClose}>
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      <div className="ds-hud-body">{children}</div>
    </aside>
  );
});

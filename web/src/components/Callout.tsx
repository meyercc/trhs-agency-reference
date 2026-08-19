import React, { type ReactNode } from 'react';

export interface CalloutProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'title'> {
  /** The reading — the assignment / value the callout carries. */
  value: ReactNode;
  /** Small kicker above the value (e.g. the physical button's own name). */
  title?: ReactNode;
  /** Optional status pill under the value. */
  status?: { label: ReactNode; tone?: 'ok' | 'warn' | 'critical' };
  /** Mirror the row — label extends the other way, dot stays at the anchor. */
  flip?: boolean;
  /** Waiting for an assignment (accent outline). */
  armed?: boolean;
  /** Carrying a non-default assignment (accent tint). */
  assigned?: boolean;
  /** The physical control is switched off. Visual only — stays clickable. */
  off?: boolean;
}

/**
 * Thin wrapper over the design system's `.ds-callout` — the positioned
 * dot + leader line + frosted label that annotates a point on an image.
 * Place inside a `position: relative` container and position via `style`
 * (`left`/`top` at the anchor point). Renders as a real `<button>`: callouts
 * on the device canvases are interactive assignment targets, not captions.
 *
 * `off` maps to the `.disabled` visual state but deliberately does NOT set
 * the HTML disabled attribute — a switched-off mouse button must still be
 * clickable/right-clickable to re-enable it.
 *
 * Avalonia: a templated ToggleButton in an adorner layer — dot ellipse,
 * leader Line, label Border; visual states from the same flags.
 */
export function Callout({
  value,
  title,
  status,
  flip,
  armed,
  assigned,
  off,
  className,
  ...rest
}: CalloutProps) {
  const classes = [
    'ds-callout',
    flip ? 'flip' : '',
    armed ? 'armed' : '',
    assigned ? 'assigned' : '',
    off ? 'disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      <span className="ds-callout-dot" aria-hidden="true" />
      <span className="ds-callout-line" aria-hidden="true" />
      <span className="ds-callout-label">
        {title != null && <span className="ds-callout-title">{title}</span>}
        <span className="ds-callout-value">{value}</span>
        {status && <span className={['ds-callout-status', status.tone].filter(Boolean).join(' ')}>{status.label}</span>}
      </span>
    </button>
  );
}

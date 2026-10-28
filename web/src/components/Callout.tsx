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
  /**
   * `default` — dot + leader + frosted label, anchored at its dot.
   * `overlay` — the Figma "Button Overlay": a fixed 120 × 40 box with no dot
   * or motion, placed in a positioned parent at the design's px; pair it with
   * a `CalloutLeader`. `title` and `status` are not drawn; `armed` hides the
   * label (give the button an `aria-label`).
   */
  variant?: CalloutVariant;
  /** A drag is over it — the drop target lifts to 80%. */
  dropTarget?: boolean;
}

export type CalloutVariant = 'default' | 'overlay';

/** Shared by `Callout` and `CalloutLeader`, so a pair always agrees. */
function stateClasses({ armed, assigned, off, dropTarget }: Pick<CalloutProps, 'armed' | 'assigned' | 'off' | 'dropTarget'>) {
  return [armed && 'armed', assigned && 'assigned', off && 'disabled', dropTarget && 'drop'];
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
  variant = 'default',
  dropTarget,
  className,
  ...rest
}: CalloutProps) {
  const classes = [
    'ds-callout',
    variant === 'overlay' && 'overlay',
    flip && 'flip',
    ...stateClasses({ armed, assigned, off, dropTarget }),
    className,
  ]
    .filter(Boolean)
    .join(' ');
  if (variant === 'overlay') {
    return (
      <button type="button" className={classes} {...rest}>
        {!armed && <span className="ds-text-subheadline caps ds-callout-overlay-label">{value}</span>}
      </button>
    );
  }
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

export interface CalloutLeaderProps extends Omit<React.SVGAttributes<SVGGElement>, 'end'> {
  /** Where the line leaves the callout — its inner edge, mid-height. */
  start: [number, number];
  /** The horizontal run before the corner, in the same units. */
  run: number;
  /** The dot on the button. */
  end: [number, number];
  armed?: boolean;
  assigned?: boolean;
  off?: boolean;
  dropTarget?: boolean;
}

/**
 * The Figma "Connecting Line" from an overlay `Callout` to its button: a
 * horizontal run, Figma's own corner curve (mirrored toward the dot), then
 * a straight diagonal to a dot. Renders an SVG `<g>` — place it inside an
 * `<svg>` whose viewBox is the stage, in the same units as the callouts.
 * Pass the same state flags as its callout so the two agree.
 *
 * Avalonia: a Path with a two-pen style (halo + stroke) and an Ellipse,
 * in the same adorner layer as the callout.
 */
export function CalloutLeader({ start, run, end, armed, assigned, off, dropTarget, className, ...rest }: CalloutLeaderProps) {
  const sx = Math.sign(end[0] - start[0]);
  const sy = Math.sign(end[1] - start[1]);
  const d =
    `M ${start[0]} ${start[1]} l ${run * sx} 0 ` +
    `c ${2.1217 * sx} 0 ${4.1566 * sx} ${0.8429 * sy} ${5.6569 * sx} ${2.3431 * sy} ` +
    `L ${end[0]} ${end[1]}`;
  const classes = ['ds-callout-leader', ...stateClasses({ armed, assigned, off, dropTarget }), className].filter(Boolean).join(' ');
  return (
    <g className={classes} aria-hidden="true" {...rest}>
      <path className="ds-callout-leader-halo" d={d} />
      <circle className="ds-callout-leader-halo" cx={end[0]} cy={end[1]} r={1.5} />
      <path className="ds-callout-leader-stroke" d={d} />
      <circle className="ds-callout-leader-dot" cx={end[0]} cy={end[1]} r={2.5} />
    </g>
  );
}

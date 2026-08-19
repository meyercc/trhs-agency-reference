import React, { type ReactNode } from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Tooltip copy. */
  content: ReactNode;
  /** Where the tooltip sits relative to the trigger. */
  placement?: TooltipPlacement;
  /** Force-show (e.g. controlled or for docs); otherwise shows on hover/focus. */
  open?: boolean;
  className?: string;
  /** The trigger element(s). */
  children: ReactNode;
}

/**
 * A hover/focus tooltip with a directional arrow, over the design system's
 * `.ds-tooltip-wrap` + `.ds-tooltip-popup`. Wrap any trigger; the blurred dark popup positions per
 * `placement`. Shows on `:hover`/`:focus-within` (CSS), or force it with `open`.
 *
 * Avalonia: a ToolTip ControlTheme — the panel + Path arrow, placement-swapped.
 */
export function Tooltip({ content, placement = 'top', open, className, children }: TooltipProps) {
  const popupClasses = ['ds-tooltip-popup', placement, open ? 'show' : ''].filter(Boolean).join(' ');
  return (
    <span className={['ds-tooltip-wrap', className].filter(Boolean).join(' ')}>
      {children}
      <span className={popupClasses} role="tooltip">
        {content}
      </span>
    </span>
  );
}

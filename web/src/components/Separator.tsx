import React from 'react';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `horizontal` (default) = a full-width 1px rule; `vertical` = a 1px column. */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * A 1px separator rule (the design system's `--border` color). Horizontal by
 * default; `vertical` stretches to its flex container's height. Used between
 * list-box groups, toolbar items, etc.
 *
 * Avalonia: a Separator / Border with a 1px BorderBrush, orientation-swapped.
 */
export function Separator({ orientation = 'horizontal', className, ...rest }: SeparatorProps) {
  const classes = ['ds-separator', orientation === 'vertical' ? 'vertical' : '', className].filter(Boolean).join(' ');
  return <div role="separator" aria-orientation={orientation} className={classes} {...rest} />;
}

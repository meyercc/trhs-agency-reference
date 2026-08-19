import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'notification'
  | 'count'
  | 'deal'
  | 'new'
  | 'sale'
  | 'coming'
  | 'free'
  | 'omen-ai'
  | 'status';
export type StatusTone = 'neutral' | 'positive' | 'warn' | 'info' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Tone for `variant="status"` (ignored otherwise). */
  tone?: StatusTone;
}

/** Thin wrapper over the design system's `.ds-badge`. */
export function Badge({ variant = 'default', tone = 'neutral', className, children, ...rest }: BadgeProps) {
  const classes = [
    'ds-badge',
    variant !== 'default' ? variant : '',
    variant === 'status' && tone !== 'neutral' ? tone : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

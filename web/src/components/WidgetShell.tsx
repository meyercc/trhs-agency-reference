import React from 'react';

export interface WidgetShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Optional badge shown next to the title (e.g. a status <Badge/>). */
  badge?: React.ReactNode;
  /** Optional header action link, e.g. { label: 'Full Details →' }. */
  action?: { label: string; onClick?: () => void };
  /** Optional grid span class, e.g. 'w-2' | 'w-4' | 'w-full'. */
  span?: string;
}

/**
 * Thin wrapper over the design system's `.w` dashboard widget shell:
 * a surfaced card with a `.w-label` header (title + optional badge + action link).
 */
export function WidgetShell({ title, badge, action, span, className, children, ...rest }: WidgetShellProps) {
  const classes = ['w', span, className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      <div className="w-label">
        <span className="w-label-lead">
          <span className="ds-text-overline w-label-text">{title}</span>
          {badge}
        </span>
        {action && (
          <button className="ds-text-overline w-link" type="button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

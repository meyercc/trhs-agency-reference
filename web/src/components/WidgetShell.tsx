import React, { createContext, useContext, useLayoutEffect, useRef } from 'react';

export interface WidgetShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Optional badge shown next to the title (e.g. a status <Badge/>). */
  badge?: React.ReactNode;
  /** Optional header action link, e.g. { label: 'Full Details →' }. */
  action?: { label: string; onClick?: () => void };
  /** Optional grid span class, e.g. 'w-2' | 'w-4' | 'w-full'. */
  span?: string;
}

/** The header action, handed to whoever holds the card's menu. */
export interface WidgetShellAction {
  label: string;
  run: () => void;
}

/**
 * Where the header action goes when the card sits somewhere that gives every
 * card a ⋮ «More options» menu (the Home board, 2026-10-08): the board provides
 * this, the shell hands its action to it — the menu's first row — and draws no
 * link in the header, so the top-right corner holds one control, not two.
 * Without a provider (a story, any page that is not the board) the link draws
 * as before.
 */
export const WidgetShellActionSlot = createContext<((action: WidgetShellAction | null) => void) | null>(null);

/**
 * Thin wrapper over the design system's `.w` dashboard widget shell:
 * a surfaced card with a `.w-label` header (title + optional badge + action link).
 */
export function WidgetShell({ title, badge, action, span, className, children, ...rest }: WidgetShellProps) {
  const classes = ['w', span, className].filter(Boolean).join(' ');
  const handOff = useContext(WidgetShellActionSlot);
  // The latest handler, so the menu row never runs a stale one and a new
  // closure every render does not re-register.
  const run = useRef(action?.onClick);
  run.current = action?.onClick;
  const label = action?.label;
  useLayoutEffect(() => {
    if (!handOff || !label) return;
    handOff({ label, run: () => run.current?.() });
    return () => handOff(null);
  }, [handOff, label]);
  return (
    <div className={classes} {...rest}>
      <div className="w-label">
        <span className="w-label-lead">
          <span className="ds-text-overline w-label-text">{title}</span>
          {badge}
        </span>
        {action && !handOff && (
          <button className="ds-text-overline w-link" type="button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

import React, { type ReactNode } from 'react';

export interface Ng3PanelProps {
  /** Tool icons for the chamfered top tab (the NGenuity nav row). */
  tools?: ReactNode;
  /** Header label — rendered as an RBNo3.1 caps title. */
  header?: ReactNode;
  /** Rendered inline after the title (e.g. the Lights master toggle). */
  headerExtra?: ReactNode;
  /** Header action controls, right-aligned (e.g. duplicate / more). */
  actions?: ReactNode;
  /** Render the body content directly instead of inside the bordered section. */
  bare?: boolean;
  /** Panel body content. */
  children?: ReactNode;
  className?: string;
}

/**
 * The NGenuity 3 trademark panel, offered for Treehouse as a library option.
 * A chamfered tool tab protrudes from the top centre; below it a blurred dark
 * panel body carries a header row (RBNo3.1 caps title + action icons) and a
 * bordered content section. Built on `.ds-ng3-panel` with design-system tokens.
 *
 * Avalonia: a custom-shaped Border (chamfer via a Path/Geometry clip) with a
 * tab ItemsControl and a ContentPresenter body.
 */
export function Ng3Panel({ tools, header, headerExtra, actions, bare, children, className }: Ng3PanelProps) {
  return (
    <div className={['ds-ng3-panel', className].filter(Boolean).join(' ')}>
      {tools != null && (
        <div className="ds-ng3-tab">
          <div className="ds-ng3-toolbar">{tools}</div>
        </div>
      )}
      <div className="ds-ng3-body">
        {(header != null || headerExtra != null || actions != null) && (
          <div className="ds-ng3-header">
            {header != null && <span className="ds-ng3-title ds-text-headline caps">{header}</span>}
            {headerExtra}
            {actions != null && <div className="ds-ng3-actions">{actions}</div>}
          </div>
        )}
        {bare ? children : <div className="ds-ng3-content">{children}</div>}
      </div>
    </div>
  );
}

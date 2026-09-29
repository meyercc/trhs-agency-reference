import React, { type ReactNode } from 'react';

export interface Ng3PanelProps {
  /** Tool icons for the chamfered top tab (the NGenuity nav row). */
  tools?: ReactNode;
  /**
   * Content in the tab strip to the left of the tab, aligned with the panel's
   * left edge — a device canvas puts its profile selector here. The strip's
   * side tracks are equal, so nothing placed here moves the tab off center.
   */
  leading?: ReactNode;
  /** Content in the tab strip to the right of the tab, right-aligned — status and actions. */
  trailing?: ReactNode;
  /** Header label — rendered as an RBNo3.1 caps title. */
  header?: ReactNode;
  /** Rendered inline after the title (e.g. the Lights master toggle). */
  headerExtra?: ReactNode;
  /** Header action controls, right-aligned (e.g. duplicate / more). */
  actions?: ReactNode;
  /**
   * Panel measure. `full` (default) spans the canvas column; `narrow` holds the
   * panel in and centres it. Width is information: a dense tab earns the full
   * measure, a sparse one reads better contained — the same reasoning as
   * `ModalShell`'s width. Device canvases drive it from the active tab.
   */
  width?: 'full' | 'narrow';
  /** Render the body content directly instead of inside the bordered section. */
  bare?: boolean;
  /** Panel body content. */
  children?: ReactNode;
  className?: string;
}

/**
 * The NGenuity 3 trademark panel, offered for Treehouse as a library option.
 * A chamfered tool tab protrudes from the top center; below it a blurred dark
 * panel body carries a header row (RBNo3.1 caps title + action icons) and a
 * bordered content section. The tab sits in a three-column strip whose side
 * tracks (`leading` / `trailing`) hold panel-level controls — the profile
 * selector, a slot's Save/Undo — without touching the tab's centering. Built
 * on `.ds-ng3-panel` with design-system tokens.
 *
 * Avalonia: a custom-shaped Border (chamfer via a Path/Geometry clip) with a
 * tab ItemsControl and a ContentPresenter body.
 */
export function Ng3Panel({
  tools,
  leading,
  trailing,
  header,
  headerExtra,
  actions,
  width = 'full',
  bare,
  children,
  className,
}: Ng3PanelProps) {
  const strip = tools != null || leading != null || trailing != null;
  return (
    <div className={['ds-ng3-panel', width === 'narrow' ? 'narrow' : '', className].filter(Boolean).join(' ')}>
      {strip && (
        <div className="ds-ng3-strip">
          {leading != null && <div className="ds-ng3-aside leading">{leading}</div>}
          {tools != null && (
            <div className="ds-ng3-tab">
              <div className="ds-ng3-toolbar">{tools}</div>
            </div>
          )}
          {trailing != null && <div className="ds-ng3-aside trailing">{trailing}</div>}
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

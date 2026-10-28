import React, { type ReactNode } from 'react';

export interface OverlayPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The panel's title, in the Ng3 panel title style. */
  title: ReactNode;
  /** The footer row — usually Cancel / Save — right-aligned. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Thin wrapper over `.ds-overlay-panel` — Figma "Overlay Panel": a floating
 * panel over a canvas or another panel (the preset editor over the presets
 * grid). The surface is the Hadouken panel recipe the context menu uses; the
 * body is a row that takes the room between the title and the footer. Position
 * it with the caller's layout — it does not place itself.
 *
 * Avalonia: a Border with the panel ControlTheme (acrylic + two-pen stroke)
 * around a DockPanel — title top, actions bottom, content fill.
 */
export function OverlayPanel({ title, footer, className, children, ...rest }: OverlayPanelProps) {
  return (
    <div role="group" className={['ds-overlay-panel', className].filter(Boolean).join(' ')} {...rest}>
      <div className="ds-overlay-panel-head">
        <span className="ds-overlay-panel-title ds-text-headline caps">{title}</span>
      </div>
      <div className="ds-overlay-panel-body">{children}</div>
      {footer != null && <div className="ds-overlay-panel-foot">{footer}</div>}
    </div>
  );
}

import React from 'react';
import { Icon } from './Icon';

export interface ModalShellProps {
  title: string;
  open?: boolean;
  onClose?: () => void;
  /** Optional left hero/sidebar (renders `.modal-left`, ~33%). */
  left?: React.ReactNode;
  /** Main scrollable content (`.modal-right`). */
  children?: React.ReactNode;
  className?: string;
  /**
   * Shell width. `full` (default) keeps the existing full-bleed inset — every
   * current caller renders unchanged. `narrow` caps the shell so a modal with a
   * single subject stops spanning the whole window.
   *
   * The intent is that width carries information: a wide shell says this modal
   * has parts to navigate between, a narrow one says it has a single subject.
   * Opt-in rather than derived from `left` so no existing modal changes shape
   * without its owner asking.
   */
  width?: 'full' | 'narrow';
  /**
   * Optional control that governs the WHOLE modal, rendered in the header row
   * to the left of close. Same idea as a card's title row: the right-hand end
   * of the header is where surface-scope things live, so a mode switcher that
   * changes what the entire body means belongs here rather than buried at the
   * bottom of the content.
   */
  headerControl?: React.ReactNode;
  /**
   * Optional footer band, rendered as a sibling of the body rather than inside
   * the scroll area.
   *
   * A modal's last row is usually not content — it is furniture: help, commit
   * actions, a live status strip. Inside the scroll area that furniture drifts:
   * it floats mid-frame when the content is short and scrolls out of reach when
   * the content is long, so an Apply button can sit hundreds of pixels below the
   * fold. As a sibling of `.modal-body` it is pinned to the frame the way the
   * header is, with no sticky background needed to occlude what passes under it
   * — nothing passes under it. It spans the full width, including under a left
   * rail, because it belongs to the frame and not to either column.
   */
  footer?: React.ReactNode;
}

/**
 * Thin wrapper over the design system's `.modal-shell`: breadcrumb (title +
 * close) over a `.modal-body` (left hero + right content). Single-column when
 * no `left` is provided.
 */
export function ModalShell({ title, open = true, onClose, left, children, className, width = 'full', headerControl, footer }: ModalShellProps) {
  const classes = ['modal-shell', open ? 'open' : '', width === 'narrow' ? 'modal-shell-narrow' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <div className="modal-breadcrumb bc-root">
        <div className="modal-breadcrumb-trail">
          <button className="breadcrumb-back" type="button" aria-label="Back">
            ‹
          </button>
          <span className="breadcrumb-current">{title}</span>
        </div>
        <div className="modal-header-right">
          {headerControl}
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="modal-body" style={left ? undefined : { gridTemplateColumns: '1fr' }}>
        {left && <div className="modal-left">{left}</div>}
        <div className="modal-right">{children}</div>
      </div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  );
}

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
}

/**
 * Thin wrapper over the design system's `.modal-shell`: breadcrumb (title +
 * close) over a `.modal-body` (left hero + right content). Single-column when
 * no `left` is provided.
 */
export function ModalShell({ title, open = true, onClose, left, children, className }: ModalShellProps) {
  const classes = ['modal-shell', open ? 'open' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <div className="modal-breadcrumb bc-root">
        <div className="modal-breadcrumb-trail">
          <button className="breadcrumb-back" type="button" aria-label="Back">
            ‹
          </button>
          <span className="breadcrumb-current">{title}</span>
        </div>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body" style={left ? undefined : { gridTemplateColumns: '1fr' }}>
        {left && <div className="modal-left">{left}</div>}
        <div className="modal-right">{children}</div>
      </div>
    </div>
  );
}

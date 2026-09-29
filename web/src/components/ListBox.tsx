import React, { useId, type ReactNode } from 'react';

export interface ListBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Cap the height and scroll when the rows overflow. */
  maxHeight?: number | string;
}

/**
 * A surfaced container of `ListItem` rows (role=listbox). Rows render
 * full-width inside the box; the box owns the rounded corners and (with a
 * `maxHeight`) the scroll. Compose by passing `<ListItem>`s — or `<ListGroup>`s
 * of them — as children.
 *
 * Avalonia: a ListBox ControlTheme — the bordered surface + ScrollViewer
 * around an ItemsPresenter of ListBoxItems.
 */
export function ListBox({ maxHeight, className, style, children, ...rest }: ListBoxProps) {
  const scroll = maxHeight != null;
  const classes = ['ds-list-box', scroll ? 'scroll' : '', className].filter(Boolean).join(' ');
  return (
    <div role="listbox" className={classes} style={scroll ? { maxHeight, ...style } : style} {...rest}>
      {children}
    </div>
  );
}

export interface ListGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The heading over this run of rows. */
  label: ReactNode;
  children?: ReactNode;
}

/**
 * A run of `ListItem` rows under a muted heading (`.ds-list-heading`), inside a
 * `ListBox`. The wrapper is `role="group"` labelled by its heading, so the
 * grouping reaches assistive tech as well as the eye — a screen reader hears
 * "Onboard, group" before the first slot, not a heading it cannot relate to.
 *
 * Avalonia: a GroupStyle header over the group's items in a ListBox.
 */
export function ListGroup({ label, className, children, ...rest }: ListGroupProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={['ds-list-group', className].filter(Boolean).join(' ')} {...rest}>
      <div id={id} className="ds-text-subheadline ds-list-heading">
        {label}
      </div>
      {children}
    </div>
  );
}

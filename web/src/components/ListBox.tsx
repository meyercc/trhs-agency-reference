import React from 'react';

export interface ListBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Cap the height and scroll when the rows overflow. */
  maxHeight?: number | string;
}

/**
 * A surfaced container of `ListItem` rows (role=listbox). Rows render
 * full-width inside the box; the box owns the rounded corners and (with a
 * `maxHeight`) the scroll. Compose by passing `<ListItem>`s as children.
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

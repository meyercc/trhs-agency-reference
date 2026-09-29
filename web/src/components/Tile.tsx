import React from 'react';
import { Icon, type IconName } from './Icon';
import { Tooltip } from './Tooltip';

export type TileSize = 's' | 'm' | 't' | 'l' | 'full';
export type TileState = 'default' | 'context' | 'suggested' | 'attention' | 'overridden' | 'unavailable';

export interface TileProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** What the tile controls — always in the same corner. */
  title: React.ReactNode;
  /** Sprite icon — row tiles only. Grid tiles use the dashboard widget label,
   *  which has no icon, so they match Home and Perform cards. */
  icon?: IconName;
  /** Row tiles only: a leading visual (art thumbnail, device photo) in place of `icon`. */
  media?: React.ReactNode;
  /** Grid footprint on `.ds-quick-tile-grid`: `s` 1×1 · `m` 2×1 · `t` 1×2 · `l` 2×2 · `full` a whole row. */
  size?: TileSize;
  /** Why the tile looks the way it does — see the `.ds-quick-tile` state list. */
  state?: TileState;
  /** Header-right slot: the source badge and/or the primary toggle. */
  controls?: React.ReactNode;
  /** The current value in plain words, big enough to read at a glance. */
  value?: React.ReactNode;
  /** Why the tile shows what it shows. A contextual tile without one is a bug.
   *  With `reasonIcon` it becomes the icon's tooltip (and accessible name). */
  reason?: React.ReactNode;
  /** Show the reason as an icon with a tooltip instead of a text line. The icon
   *  names the kind of reason — the owning mode, a live signal, your change. */
  reasonIcon?: IconName;
  /** Footer-right slot — `TileLink`s (Expand, Undo, Open…). */
  actions?: React.ReactNode;
  /** Compact one-line layout (catalog links). Title + value + actions sit in a row. */
  row?: boolean;
  /** The one in use, in a grid of tiles you pick from (profiles). Pair it with
   *  a word in `controls` — an "Active" badge — so it never reads by colour alone. */
  selected?: boolean;
  /** The whole tile is the control. A row tile becomes a button (catalog links);
   *  a grid tile stays a section and takes click + Enter/Space itself, because
   *  its head, value and foot are block content a button may not hold. */
  onActivate?: () => void;
}

const SIZE_CLASS: Record<TileSize, string> = { s: 's', m: 'm', t: 't', l: 'l', full: 'full' };
const STATE_CLASS: Record<TileState, string> = {
  default: '',
  context: 'context',
  suggested: 'suggested',
  attention: 'attention',
  overridden: 'overridden',
  unavailable: 'unavailable',
};

/**
 * Thin wrapper over the design system's `.ds-quick-tile` (shared/components.css) — the
 * Quick Control tile. Status + one primary control + a reason line, in four sizes
 * and six states, placed on a `TileGrid`.
 *
 * Avalonia: a Border with a ControlTheme keyed on size/state classes, hosting a
 * header DockPanel (title left, controls right), a value TextBlock, a content
 * presenter for the body and a footer DockPanel (reason left, actions right);
 * grid placement maps to Grid.ColumnSpan / Grid.RowSpan on a UniformGrid host.
 */
export function Tile({
  title,
  icon,
  media,
  size = 's',
  state = 'default',
  controls,
  value,
  reason,
  reasonIcon,
  actions,
  row = false,
  selected = false,
  onActivate,
  className,
  children,
  ...rest
}: TileProps) {
  const classes = [
    'ds-quick-tile',
    SIZE_CLASS[size],
    STATE_CLASS[state],
    row ? 'row' : '',
    onActivate ? 'selectable' : '',
    selected ? 'selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const titleEl = (
    <span className="ds-quick-tile-title">
      <span>{title}</span>
    </span>
  );

  // The reason as an icon whose tooltip holds the words (and names it for AT).
  const reasonTip =
    reasonIcon && reason != null ? (
      <Tooltip content={reason} placement={row ? 'bottom' : 'right'}>
        <span
          className="ds-quick-tile-reason-icon"
          role="img"
          tabIndex={0}
          aria-label={typeof reason === 'string' ? reason : undefined}
        >
          <Icon name={reasonIcon} size="sm" />
        </span>
      </Tooltip>
    ) : null;

  if (row) {
    const content = (
      <>
        {media != null ? (
          <span className="ds-quick-tile-media">{media}</span>
        ) : (
          icon && <Icon name={icon} size="md" className="ds-quick-tile-row-icon" />
        )}
        <span className="ds-quick-tile-text">
          <span className="ds-quick-tile-title">
            <span>{title}</span>
            {/* In a row the reason icon sits right after the title it explains. */}
            {reasonTip}
          </span>
          {value != null && <span className="ds-quick-tile-reason">{value}</span>}
        </span>
        {children != null && <span className="ds-quick-tile-row-body">{children}</span>}
        {actions != null && <span className="ds-quick-tile-actions">{actions}</span>}
      </>
    );
    return onActivate ? (
      <button type="button" className={classes} onClick={onActivate} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
        {content}
      </button>
    ) : (
      <div className={classes} {...rest}>
        {content}
      </div>
    );
  }

  // A grid tile that is its own control: the card takes the click, and the
  // keyboard gets the same target. `rest` comes last so the caller still owns
  // the role and ARIA (a profile card is a pressed button, a filter is a radio).
  const pick = onActivate
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: onActivate,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onActivate();
        },
      }
    : undefined;

  return (
    <section className={classes} {...pick} {...rest}>
      <div className="ds-quick-tile-head">
        {titleEl}
        {controls != null && <div className="ds-quick-tile-controls">{controls}</div>}
      </div>
      {value != null && <div className="ds-quick-tile-value">{value}</div>}
      {children != null && <div className="ds-quick-tile-body">{children}</div>}
      {(reason != null || actions != null) && (
        <div className="ds-quick-tile-foot">
          {reasonTip ?? <span className="ds-quick-tile-reason">{reason}</span>}
          {actions != null && <span className="ds-quick-tile-actions">{actions}</span>}
        </div>
      )}
    </section>
  );
}

export interface TileLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading icon (e.g. `undo`, `expand`). */
  icon?: IconName;
  /** Trailing chevron — for links that navigate away. */
  chevron?: boolean;
}

/** The small text action in a tile footer (Expand, Undo, Open…). */
export function TileLink({ icon, chevron, className, children, ...rest }: TileLinkProps) {
  return (
    <button type="button" className={['ds-quick-tile-link', className].filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
      {chevron && <Icon name="chevron-right" size="sm" />}
    </button>
  );
}

export interface TileGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rows size to content — for grids of `row` tiles (catalog links). */
  compact?: boolean;
}

/** The 4 → 2 → 1 column grid tiles are placed on (`.ds-quick-tile-grid`). */
export function TileGrid({ compact = false, className, children, ...rest }: TileGridProps) {
  return (
    <div className={['ds-quick-tile-grid', compact ? 'compact' : '', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

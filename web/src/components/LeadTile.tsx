import React, { type ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface LeadTileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Cover art (2:3), held to the right and cropped from its top. */
  cover?: string;
  title: string;
  /** Label/value pairs under the title — "Last played · Today". */
  facts?: { label: string; value: ReactNode }[];
  /** The tile's own press (the game's details). */
  onClick?: () => void;
  /** The Play button; omitted, there is none. */
  onPlay?: () => void;
}

/**
 * The wide game tile that leads a row of covers — thin wrapper over the design
 * system's `.ds-lead-tile` (shared/components.css). Takes its row's height and
 * whatever width the grid spans it; a press is the tile's (`onClick`), Play is
 * its own button (`onPlay`). Enter and Space press it, as `GameTile`.
 *
 * Avalonia: a templated Button — an Image docked right, a gradient overlay,
 * a StackPanel of the title and a facts grid, and an accent icon Button.
 */
export function LeadTile({ cover, title, facts = [], onClick, onPlay, className, ...rest }: LeadTileProps) {
  return (
    <div
      className={['ds-lead-tile', className].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      aria-label={rest['aria-label'] ?? title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      {...rest}
    >
      {cover && <img className="ds-lead-tile-art" src={cover} alt="" />}
      <div className="ds-lead-tile-body">
        <div className="ds-lead-tile-text">
          <h3 className="ds-lead-tile-title">{title}</h3>
          {facts.length > 0 && (
            <dl className="ds-lead-tile-facts">
              {facts.map((f) => (
                <div className="ds-lead-tile-fact" key={f.label}>
                  <dt className="ds-text-overline">{f.label}</dt>
                  <dd className="ds-text-body">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {onPlay && (
          <IconButton
            variant="accent"
            label={`Play ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Icon name="play-fill" size={16} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

import React from 'react';

export type CardOrientation = 'portrait' | 'landscape' | 'overlay';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  meta?: string;
  /** Image URL for the art area. */
  art?: string;
  artAlt?: string;
  orientation?: CardOrientation;
  price?: string;
  /** Struck-through original price (renders the current `price` as a sale). */
  origPrice?: string;
  /** Optional badge node (e.g. a <Badge variant="sale">), placed over the card. */
  badge?: React.ReactNode;
}

/**
 * Thin wrapper over the design system's `.ds-card` product card.
 * `overlay` puts title/price over the art; `portrait`/`landscape` put them below.
 */
export function Card({
  title,
  meta,
  art,
  artAlt = '',
  orientation = 'portrait',
  price,
  origPrice,
  badge,
  className,
  ...rest
}: CardProps) {
  const classes = ['ds-card', orientation, className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      <div className="ds-card-art">{art && <img src={art} alt={artAlt} />}</div>

      {orientation === 'overlay' ? (
        <div className="ds-card-overlay">
          <div className="ds-card-title">{title}</div>
          {price && <div className="ds-card-price">{price}</div>}
        </div>
      ) : (
        <div className="ds-card-body">
          <div className="ds-card-title">{title}</div>
          {meta && <div className="ds-card-meta">{meta}</div>}
          {(price || origPrice) && (
            <div className="ds-card-prices">
              {price && <span className={'ds-card-price' + (origPrice ? ' sale' : '')}>{price}</span>}
              {origPrice && <span className="ds-card-price orig">{origPrice}</span>}
            </div>
          )}
        </div>
      )}

      {badge}
    </div>
  );
}

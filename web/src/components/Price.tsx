import React from 'react';

export interface PriceProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** What it costs now — "$10.49", "Free". */
  now: string;
  /** What it cost before the sale, struck through. Omit when there is no saving. */
  was?: string;
}

/**
 * A price, or a sale price beside the struck-through original — the design
 * system's `.ds-card-prices` pair (shared/components.css, "Card") as a
 * component, so the Shop card, the Deals widget and a composed card's deals
 * block say a price one way (TH-450). `now` is green only when `was` is given:
 * a plain price is not a saving.
 *
 * Avalonia: a StackPanel of two TextBlocks, the second with Strikethrough.
 */
export function Price({ now, was, className, ...rest }: PriceProps) {
  return (
    <span className={['ds-card-prices', className].filter(Boolean).join(' ')} {...rest}>
      <span className={was ? 'ds-card-price sale' : 'ds-card-price'}>{now}</span>
      {was && <span className="ds-card-price orig">{was}</span>}
    </span>
  );
}

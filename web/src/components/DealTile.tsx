import React, { type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Badge } from './Badge';
import { Button } from './Button';
import './deal-tile.css';

export interface DealTileProps {
  /** Wide (16:9) promo image URL. */
  image: string;
  /** Deal / product title — used as the accessible label. */
  title: string;
  /** Platform glyph at the info bar's left (e.g. `platform-xbox`). */
  platform?: IconName;
  /** Discount badge text, e.g. `-100%` (rendered with the `deal` badge variant). */
  discount?: string;
  /** Price label, e.g. `Free` or `$19.99`. */
  price?: string;
  /** Hover-overlay description. */
  description?: ReactNode;
  /** Hover-overlay CTA label (default `View Deal`). Hidden if `null`. */
  cta?: string | null;
  /** Whole-card click. */
  onClick?: () => void;
  /** CTA click — stops propagation; falls back to `onClick`. */
  onCta?: () => void;
  /** Source-art hover glow (mirrors GameTile). */
  glow?: boolean;
  /** Force the glow + hover overlay on (state previews). */
  forceGlow?: boolean;
  className?: string;
  /** Inline style on the outer element (e.g. a width preset). */
  style?: React.CSSProperties;
}

/**
 * Wide promo card for store deals — a 16:9 image with a bottom acrylic info bar
 * (platform glyph · discount badge · price) and a hover overlay carrying a
 * description + an accent CTA. Structure follows the Figma deal tile, but styled
 * entirely with our `Badge` / `Button` / type tokens. Sibling of `GameTile`
 * (which is a 2:3 cover); same `.glow` mechanism (isolate + blurred `::before`).
 *
 * Avalonia: a templated Button — a cover Image, an info Border, and a hover
 * overlay Panel revealed via the PointerOver visual state.
 */
export function DealTile({
  image,
  title,
  platform,
  discount,
  price,
  description,
  cta = 'View Deal',
  onClick,
  onCta,
  glow,
  forceGlow,
  className,
  style,
}: DealTileProps) {
  const interactive = !!onClick;
  const outerStyle: React.CSSProperties = {
    ...(glow || forceGlow ? { ['--_deal-bg']: `url(${image})` } : {}),
    ...style,
  };
  const classes = ['ds-deal', glow ? 'glow' : '', forceGlow ? 'force-glow' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={outerStyle}>
      <div
        className="ds-deal-card"
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={title}
        onClick={onClick}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        <div className="ds-deal-art">
          <img src={image} alt="" />
        </div>

        {(description || cta) && (
          <div className="ds-deal-hover">
            {description && <p className="ds-text-body ds-deal-desc">{description}</p>}
            {cta && (
              <Button
                variant="accent"
                size="sm"
                className="ds-deal-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  (onCta ?? onClick)?.();
                }}
              >
                {cta}
              </Button>
            )}
          </div>
        )}

        <div className="ds-deal-info">
          {platform && <Icon name={platform} size={16} className="ds-deal-plat" />}
          <div className="ds-deal-meta">
            {discount && <Badge variant="deal">{discount}</Badge>}
            {price && <span className="ds-text-body strong ds-deal-price">{price}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

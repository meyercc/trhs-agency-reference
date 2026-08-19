import React, { type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type GameTileSize = 'sm' | 'md' | 'lg';

export interface GameTileProps {
  /** Cover art image URL (2:3). Omit when using `icon`. */
  cover?: string;
  /** Game / app title. Optional — the footer label is hidden when omitted. */
  name?: string;
  /** Icon-only fallback art (apps without cover art); rendered sharp over a blurred bg. */
  icon?: string;
  /** Hover glow sourced from the art. */
  glow?: boolean;
  /** Force the glow on (for state previews / featured tiles). */
  forceGlow?: boolean;
  /** Size variant. */
  size?: GameTileSize;
  /** Show the centred play overlay on hover. */
  playable?: boolean;
  /** Platform icon (e.g. 'platform-steam'). */
  platform?: IconName;
  /** Renders a ••• menu button; called on click (stops propagation). The event
   *  is passed so callers can anchor a popover to the button. */
  onMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Keep the ••• button visible (e.g. while its menu is open). */
  menuOpen?: boolean;
  /** Badge(s) shown in the art's top-left corner. */
  badges?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  /** Accessible label when `name` is omitted. */
  'aria-label'?: string;
}

/**
 * Image card for games, apps, and media — a port of the prototype's `.ds-tile`.
 * Cover art (default) or an icon-only fallback, with optional hover glow, play
 * overlay, ••• menu, platform icon, and badges. The title label is optional
 * (`name`); when omitted the footer is hidden for art-only grids.
 *
 * Avalonia: a templated Button — a cover Image with overlay adorners and an
 * optional caption TextBlock.
 */
export function GameTile({
  cover,
  name,
  icon,
  glow,
  forceGlow,
  size = 'md',
  playable = true,
  platform,
  onMenu,
  menuOpen,
  badges,
  disabled,
  loading,
  onClick,
  className,
  'aria-label': ariaLabel,
}: GameTileProps) {
  const iconOnly = !cover && !!icon;
  const artSrc = cover ?? icon;

  const classes = [
    'ds-tile',
    glow ? 'glow' : '',
    forceGlow ? 'force-glow' : '',
    size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : '',
    disabled ? 'disabled' : '',
    loading ? 'loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const glowStyle =
    (glow || forceGlow) && artSrc ? ({ ['--_gtile-bg']: `url(${artSrc})` } as React.CSSProperties) : undefined;

  // Overlay adorners shared by both art variants (hidden while loading).
  const adorners = loading ? null : (
    <>
      {badges}
      {playable && (
        <div className="ds-tile-overlay">
          <div className="ds-btn-icon accent ds-tile-play">
            <Icon name="play-fill" />
          </div>
        </div>
      )}
      {onMenu && (
        <button
          type="button"
          className={'ds-tile-menu' + (menuOpen ? ' open' : '')}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen || undefined}
          onClick={(e) => {
            e.stopPropagation();
            onMenu(e);
          }}
        >
          <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="6" r="1.2" />
            <circle cx="6" cy="6" r="1.2" />
            <circle cx="10" cy="6" r="1.2" />
          </svg>
        </button>
      )}
      {platform && (
        <div className="ds-tile-platform">
          <Icon name={platform} />
        </div>
      )}
    </>
  );

  return (
    <div
      className={classes}
      style={glowStyle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={name ?? ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    >
      {iconOnly ? (
        <div className="ds-tile-art icon-only">
          {!loading && <div className="ds-tile-icon-bg" style={{ backgroundImage: `url(${icon})` }} />}
          {!loading && <img className="ds-tile-icon-fg" src={icon} alt="" />}
          {adorners}
        </div>
      ) : (
        <div className="ds-tile-art" style={!loading && cover ? { backgroundImage: `url(${cover})` } : undefined}>
          {adorners}
        </div>
      )}
      {name && (
        <div className="ds-tile-footer">
          <div className="ds-tile-name">{name}</div>
        </div>
      )}
    </div>
  );
}

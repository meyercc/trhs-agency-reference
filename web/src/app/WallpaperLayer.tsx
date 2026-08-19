import type { CSSProperties } from 'react';
import { useSettings } from '../state/Settings';
import { wallpaperById } from './wallpapers';
import './wallpaper.css';

/**
 * Full-bleed app background — the React port of vanilla `#custom-wp-layer`.
 * A fixed layer pinned behind all app content (z-index:-1, above the body
 * gradient canvas): a blurred, dimmed cover image driven by the chosen preset
 * + the `--wp-blur` / `--wp-opacity` controls on the Personalize page. The
 * image variant follows the active theme.
 */
export function WallpaperLayer() {
  const { wallpaper, wpBlur, wpOpacity, isLight } = useSettings();
  const wp = wallpaperById(wallpaper);
  if (!wp) return null;
  const variant = isLight ? wp.light : wp.dark;
  const vars = {
    '--wp-blur': `${wpBlur}px`,
    '--wp-opacity': wpOpacity / 100,
  } as CSSProperties;
  return (
    <div className="wp-layer" style={vars} aria-hidden="true">
      <div className="wp-img" style={{ backgroundImage: `url("${variant.img}")` }} />
      <div className="wp-dim" />
    </div>
  );
}

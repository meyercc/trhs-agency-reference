import type { CSSProperties } from 'react';
import { useSettings } from '../state/Settings';
import { useStoredImage } from '../state/imageStore';
import { CUSTOM_WALLPAPER_ID, wallpaperById } from './wallpapers';
import './wallpaper.css';

/**
 * Full-bleed app background — the React port of vanilla `#custom-wp-layer`.
 * A fixed layer pinned behind all app content (z-index:-1, above the body
 * gradient canvas): a blurred, dimmed cover image driven by the chosen preset
 * (or the user's uploaded image, cropped around its focal point) + the
 * `--wp-blur` / `--wp-opacity` controls in Settings › Appearance. The image
 * variant follows the active theme; the dim layer keeps text legible over any
 * image, uploads included.
 */
export function WallpaperLayer() {
  const { wallpaper, wpBlur, wpOpacity, wpFocus, isLight } = useSettings();
  const upload = useStoredImage('wallpaper');
  const custom = wallpaper === CUSTOM_WALLPAPER_ID;
  const wp = wallpaperById(wallpaper);
  const src = custom ? upload : wp && (isLight ? wp.light : wp.dark).img;
  if (!src) return null;
  const vars = {
    '--wp-blur': `${wpBlur}px`,
    '--wp-opacity': wpOpacity / 100,
  } as CSSProperties;
  return (
    <div className="wp-layer" style={vars} aria-hidden="true">
      <div
        className="wp-img"
        style={{
          backgroundImage: `url("${src}")`,
          ...(custom ? { backgroundPosition: `${wpFocus.x}% ${wpFocus.y}%` } : {}),
        }}
      />
      <div className="wp-dim" />
    </div>
  );
}

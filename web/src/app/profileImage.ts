// A profile's photo: either one of the app's wallpapers (`wp:<id>`, so it
// follows the theme like the wallpaper itself) or a picture the user uploaded,
// kept as a small data URL inside the profile record.
import { WALLPAPERS, wallpaperById } from './wallpapers';

export const WALLPAPER_IMAGE_PREFIX = 'wp:';

/** The wallpaper a `wp:` image points at, or null for an uploaded photo. */
export function profileWallpaperId(image: string): string | null {
  return image.startsWith(WALLPAPER_IMAGE_PREFIX) ? image.slice(WALLPAPER_IMAGE_PREFIX.length) : null;
}

/** Resolve a profile's `image` to something an <img> can show. */
export function profileImageSrc(image: string, light: boolean): string {
  const id = profileWallpaperId(image);
  if (id == null) return image;
  const wp = wallpaperById(id) ?? WALLPAPERS[0];
  return light ? wp.light.img : wp.dark.img;
}

/** The side of the square thumbnail an upload is reduced to before it is stored. */
export const PROFILE_PHOTO_PX = 96;

/**
 * Read an uploaded picture and reduce it to a square thumbnail data URL.
 * Profiles live in localStorage, so the photo has to be small: a centered
 * square crop at `PROFILE_PHOTO_PX` is a few kilobytes and is all a 24px
 * avatar (or the 40px preview) can show anyway.
 */
export async function fileToProfilePhoto(file: File, px = PROFILE_PHOTO_PX): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, px, px);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.85);
}

// Wallpaper presets ported from vanilla `js/theme.js` (WALLPAPERS). Each preset
// has a dark + light image variant; the active one follows the app theme.
// Assets resolve through Vite's glob (mirrors widgets/gameArt.ts) so the files
// in Assets/wallpapers ship with content-hashed URLs and no static imports.
const IMGS = import.meta.glob('../../../Assets/wallpapers/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function img(file: string): string {
  const key = Object.keys(IMGS).find((k) => k.endsWith('/' + file));
  return key ? IMGS[key] : '';
}

export interface WallpaperVariant {
  /** Nav tint (kept for parity with vanilla; React nav doesn't consume it yet). */
  nav: string;
  img: string;
}
export interface Wallpaper {
  id: string;
  name: string;
  dark: WallpaperVariant;
  light: WallpaperVariant;
}

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'red',
    name: 'Red',
    dark: { nav: 'rgba(22,6,6,0.75)', img: img('red-dark.webp') },
    light: { nav: 'rgba(215,170,165,0.75)', img: img('red-light.webp') },
  },
  {
    id: 'blue',
    name: 'Blue',
    dark: { nav: 'rgba(6,10,22,0.75)', img: img('blue-dark.webp') },
    light: { nav: 'rgba(165,185,220,0.75)', img: img('blue-light.webp') },
  },
  {
    id: 'purple',
    name: 'Purple',
    dark: { nav: 'rgba(12,6,22,0.75)', img: img('purple-dark.webp') },
    light: { nav: 'rgba(195,170,215,0.75)', img: img('purple-light.webp') },
  },
  {
    id: 'abstractv2',
    name: 'Abstract',
    dark: { nav: 'rgba(8,8,14,0.75)', img: img('abstractv2-dark.webp') },
    light: { nav: 'rgba(190,185,210,0.75)', img: img('abstractv2-light.webp') },
  },
];

export function wallpaperById(id: string): Wallpaper | undefined {
  return WALLPAPERS.find((w) => w.id === id);
}

/** The wallpaper id for the user's own uploaded image (stored in IndexedDB). */
export const CUSTOM_WALLPAPER_ID = 'custom';

/** The image a preset shows in the current theme (a thumbnail, an avatar). */
export function wallpaperImage(id: string, isLight: boolean): string {
  const wp = wallpaperById(id);
  return wp ? (isLight ? wp.light : wp.dark).img : '';
}

/** Preset avatars — crops of the brand wallpapers until real avatar art exists. */
export const AVATAR_PRESETS: { id: string; name: string; img: string }[] = [
  { id: 'purple', name: 'Purple', img: img('purple-dark.webp') },
  { id: 'red', name: 'Red', img: img('red-dark.webp') },
  { id: 'blue', name: 'Blue', img: img('blue-dark.webp') },
  { id: 'abstract', name: 'Abstract', img: img('abstractv2-dark.webp') },
  { id: 'hp', name: 'HP', img: img('hp-wallpaper.webp') },
];

/**
 * Looks — a wallpaper, accent and theme that belong together, applied in one
 * click. The fast path for people who want it to look good without tuning three
 * controls; every part stays adjustable afterwards.
 */
export interface Look {
  id: string;
  name: string;
  wallpaper: string;
  accent: string;
  theme: 'dark' | 'light';
}
export const LOOKS: Look[] = [
  { id: 'omen-red', name: 'HyperX Red', wallpaper: 'red', accent: 'red', theme: 'dark' },
  { id: 'midnight', name: 'Midnight', wallpaper: 'blue', accent: 'blue', theme: 'dark' },
  { id: 'neon', name: 'Neon', wallpaper: 'purple', accent: 'purple', theme: 'dark' },
  { id: 'abstract', name: 'Abstract', wallpaper: 'abstractv2', accent: 'indigo', theme: 'dark' },
  { id: 'daylight', name: 'Daylight', wallpaper: 'blue', accent: 'blue', theme: 'light' },
];

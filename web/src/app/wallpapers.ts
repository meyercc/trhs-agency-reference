// Wallpaper presets ported from vanilla `js/theme.js` (WALLPAPERS). Each preset
// has a dark + light image variant; the active one follows the app theme.
// Assets resolve through Vite's glob (mirrors widgets/gameArt.ts) so the files
// in Assets/wallpapers ship with content-hashed URLs and no static imports.
const IMGS = import.meta.glob('../../../Assets/wallpapers/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function img(file: string): string {
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

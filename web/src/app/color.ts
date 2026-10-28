// Colour helpers for Appearance: pull accent candidates out of a wallpaper, and
// keep a user-picked accent legible. Runtime values — they describe the user's
// own image and colour, so they are data, not design tokens.

export const HEX_RE = /^#[0-9a-f]{6}$/i;

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** The surfaces an accent sits on — the darkest app surface in each theme. */
export const SURFACE = { dark: '#1a1a1a', light: '#f9f9f8' } as const;
/** WCAG AA for UI components (focus rings, selected borders, icons). */
export const UI_CONTRAST = 3;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/**
 * Up to `count` accent candidates from an image: vivid, distinct hues, each
 * nudged to a lightness that reads on the dark surface.
 */
export async function paletteFrom(url: string, count = 3): Promise<string[]> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Bucket by hue (12 × 30°), weighting vivid pixels.
  const buckets = new Map<number, { w: number; h: number; s: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const key = Math.floor(h / 30);
    const w = s * (1 - Math.abs(l - 0.5));
    const b = buckets.get(key) ?? { w: 0, h: 0, s: 0 };
    b.w += w;
    b.h += h * w;
    b.s += s * w;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .sort((a, b) => b.w - a.w)
    .slice(0, count)
    .map((b) => legible(hslToHex(b.h / b.w, Math.min(0.9, b.s / b.w + 0.1), 0.58)));
}

/** Lighten a colour until it clears UI contrast on the dark surface. */
export function legible(hex: string) {
  if (!HEX_RE.test(hex)) return hex;
  const [h, s, l0] = rgbToHsl(...hexToRgb(hex));
  let l = l0;
  let out = hex;
  while (contrast(out, SURFACE.dark) < UI_CONTRAST && l < 0.95) {
    l += 0.04;
    out = hslToHex(h, s, l);
  }
  return out;
}

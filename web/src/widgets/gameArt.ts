// Resolve game cover art by filename → bundled URL (mirrors the device-image
// glob in devices/skus.ts). Lets the content widgets reference Assets/games
// art by name without dozens of static imports.
const ART = import.meta.glob('../../../Assets/games/*.{webp,jpeg,jpg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function gameArt(file: string): string | undefined {
  const key = Object.keys(ART).find((k) => k.endsWith('/' + file));
  return key ? ART[key] : undefined;
}

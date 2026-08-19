// Real screenshots of each module's live surface, shown on the What's New hero,
// the detail page, and the module cards. Files live in Assets/modules/<id>.webp
// (captured with web/_capture-modules.mjs). Resolved eagerly as URLs, same
// pattern as pages/GallerySection.tsx. A module with no file simply has no
// preview and its surfaces fall back to the icon treatment.
const FILES = import.meta.glob('../../../Assets/modules/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]),
);

/** Screenshot URL for a module, or undefined if none was captured. */
export const modulePreview = (id: string): string | undefined => BY_ID[id];

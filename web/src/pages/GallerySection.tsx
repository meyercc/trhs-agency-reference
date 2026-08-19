import './gallery.css';

// Community/capture gallery — the Play-page surface gated by the `gallery`
// module. Screenshots resolve from Assets/gallery via import.meta.glob (same
// pattern as the SKU device images).
const IMG = import.meta.glob('../../../Assets/gallery/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const art = (file: string): string | undefined => {
  const key = Object.keys(IMG).find((k) => k.endsWith('/' + file));
  return key ? IMG[key] : undefined;
};

interface GalleryItem {
  file: string;
  title: string;
  author: string;
  type: 'Screenshot' | 'Clip';
}
const ITEMS: GalleryItem[] = [
  { file: 'Cyberpunk-2077-2020-new-screenshots-1.webp', title: 'Cyberpunk 2077', author: 'NeonRacer_X', type: 'Screenshot' },
  { file: 'GOW-Feature-Image.webp', title: 'God of War', author: 'KratosMain', type: 'Screenshot' },
  { file: 'Lies-of-P-Overture-Screenshot-002.webp', title: 'Lies of P', author: 'PuppetString', type: 'Screenshot' },
  { file: 'devil-may-cry-5-4k-screenshots-album-v0-ub3mIgoTfNvWV7pk__mjexULumyoCtU2d0a9yxcRDdA.webp', title: 'Devil May Cry 5', author: 'TarnishedLegend', type: 'Clip' },
  { file: 'metaphor-refantazio-screenshot-4.webp', title: 'Metaphor: ReFantazio', author: 'HunterPrime', type: 'Screenshot' },
  { file: '049zi8OCKMGMf1zQYUoDBII-4.webp', title: 'Elden Ring', author: 'ErdtreeWanderer', type: 'Screenshot' },
  { file: 'image-10.webp', title: 'Starfield', author: 'SpacerJane', type: 'Screenshot' },
  { file: 'new-screenshots-from-the-press-kit-added-today-v0-w7lfmzb4w0xe1.webp', title: 'Silent Hill 2', author: 'FoggyTown', type: 'Screenshot' },
  { file: 'ss_b2bf12299c38214fe520af0f724a6349d17ed330.webp', title: 'Counter-Strike 2', author: 'ClutchKing', type: 'Clip' },
];

export function GallerySection() {
  return (
    <div className="gal-grid">
      {ITEMS.map((it) => {
        const src = art(it.file);
        if (!src) return null;
        return (
          <figure className="gal-tile" key={it.file}>
            <img className="gal-img" src={src} alt={it.title} loading="lazy" />
            {it.type === 'Clip' && (
              <span className="gal-play" aria-hidden>
                ▶
              </span>
            )}
            <figcaption className="gal-meta">
              <span className="gal-title">{it.title}</span>
              <span className="gal-sub">
                by {it.author} · {it.type}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

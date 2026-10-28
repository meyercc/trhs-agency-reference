import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components';
import { GAMES } from '../data/games';
import { clipFrameStyle } from '../nova/autocastMedia';
import { useGalleryOptional, type UserClip } from '../state/Gallery';
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
  /** A `GAMES` id (data/games.ts), when the catalog carries the game. */
  gameId?: string;
}
// `gameId` ties an image to the catalog (data/games.ts) for the game detail
// panel's Gallery (TH-504); the titles the catalog does not carry have none.
const ITEMS: GalleryItem[] = [
  { file: 'Cyberpunk-2077-2020-new-screenshots-1.webp', title: 'Cyberpunk 2077', author: 'NeonRacer_X', type: 'Screenshot', gameId: 'cyberpunk' },
  { file: 'GOW-Feature-Image.webp', title: 'God of War', author: 'KratosMain', type: 'Screenshot' },
  { file: 'Lies-of-P-Overture-Screenshot-002.webp', title: 'Lies of P', author: 'PuppetString', type: 'Screenshot' },
  { file: 'devil-may-cry-5-4k-screenshots-album-v0-ub3mIgoTfNvWV7pk__mjexULumyoCtU2d0a9yxcRDdA.webp', title: 'Devil May Cry 5', author: 'TarnishedLegend', type: 'Clip', gameId: 'devilmaycry5' },
  { file: 'metaphor-refantazio-screenshot-4.webp', title: 'Metaphor: ReFantazio', author: 'HunterPrime', type: 'Screenshot' },
  { file: '049zi8OCKMGMf1zQYUoDBII-4.webp', title: 'Elden Ring', author: 'ErdtreeWanderer', type: 'Screenshot', gameId: 'eldenring' },
  { file: 'image-10.webp', title: 'Starfield', author: 'SpacerJane', type: 'Screenshot' },
  { file: 'new-screenshots-from-the-press-kit-added-today-v0-w7lfmzb4w0xe1.webp', title: 'Silent Hill 2', author: 'FoggyTown', type: 'Screenshot' },
  { file: 'ss_b2bf12299c38214fe520af0f724a6349d17ed330.webp', title: 'Counter-Strike 2', author: 'ClutchKing', type: 'Clip', gameId: 'counterstrike2' },
];

/** The gallery's images of one game, with their art resolved — the panel's thumbnails. */
export function galleryFor(gameId: string): (GalleryItem & { src: string })[] {
  return ITEMS.filter((it) => it.gameId === gameId)
    .map((it) => ({ ...it, src: art(it.file) }))
    .filter((it): it is GalleryItem & { src: string } => !!it.src);
}

/** A thumbnail the panel can draw: a picture, or a clip's frame (your own clips are art + a crop, TH-509). */
export interface GalleryThumb {
  key: string;
  alt: string;
  src?: string;
  style?: CSSProperties;
}
/** The gallery's thumbnails of one game — your own clips first, then the fixture's. */
export function useGalleryFor(gameId: string): GalleryThumb[] {
  const gallery = useGalleryOptional();
  const mine = (gallery?.of(gameId) ?? []).map((c) => ({ key: c.id, alt: `${c.title} — clip by you: ${c.label}`, style: clipFrameStyle(c.gameId, c.media) }));
  return [...mine, ...galleryFor(gameId).map((it) => ({ key: it.file, alt: `${it.title} — ${it.type.toLowerCase()} by ${it.author}`, src: it.src }))];
}

/**
 * The gallery, or one game's page of it (TH-505): `?gallery=<gameId>` — what
 * a game panel's Gallery chevron opens — narrows the grid to that game, with
 * a line saying so and the way back to everything.
 */
export function GallerySection() {
  const [params, setParams] = useSearchParams();
  const gallery = useGalleryOptional();
  const only = params.get('gallery');
  const game = only ? GAMES.find((g) => g.id === only) : undefined;
  const items = game ? ITEMS.filter((it) => it.gameId === game.id) : ITEMS;
  // Your own clips (TH-509) lead, newest first.
  const mine = (gallery?.clips ?? []).filter((c) => !game || c.gameId === game.id).sort((a, b) => b.at - a.at);
  const count = mine.length + items.length;
  const showAll = () => {
    const p = new URLSearchParams(params);
    p.delete('gallery');
    setParams(p, { replace: true });
  };
  return (
    <>
      {game && (
        <div className="gal-filter" role="status" data-gallery={game.id}>
          <span className="ds-text-body">
            {count ? `${count} ${count === 1 ? 'capture' : 'captures'} of ${game.title}` : `No captures of ${game.title} yet`}
          </span>
          <Button size="sm" onClick={showAll}>
            Show all
          </Button>
        </div>
      )}
      {count > 0 && <GalleryGrid items={items} mine={mine} />}
    </>
  );
}

function GalleryGrid({ items, mine }: { items: GalleryItem[]; mine: UserClip[] }) {
  return (
    <div className="gal-grid">
      {mine.map((c) => (
        <figure className="gal-tile" key={c.id} data-clip={c.id}>
          <div className="gal-img" role="img" aria-label={`${c.title}: ${c.label}`} style={clipFrameStyle(c.gameId, c.media)} />
          <span className="gal-play" aria-hidden>
            ▶
          </span>
          <figcaption className="gal-meta">
            <span className="gal-title">{c.title}</span>
            <span className="gal-sub">by You · Clip · {c.label}</span>
          </figcaption>
        </figure>
      ))}
      {items.map((it) => {
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

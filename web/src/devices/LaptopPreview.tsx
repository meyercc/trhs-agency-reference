import './laptop-preview.css';
import { deckStops, partDots, type LightCaps, type PcLighting } from './pcLighting';

/**
 * The machine's picture beside the keyboard, tinted by what its lights are
 * doing, with a dot per lit part (keyboard, logo, light bar) and its colour.
 * The keyboard board stays the place you pick zones and keys; this is what the
 * machine looks like from outside. `deck` is where the keyboard sits in the
 * photo, as fractions of it; a photo without a keyboard in view omits it.
 *
 * `photo={false}` draws the dots alone: where the 3D machine is the hero, the
 * picture would be the same machine twice (JY 2026-10-21), but the dots still
 * say at a glance what each part is lit — the logo is round the back.
 */
export interface LaptopPreviewProps {
  src?: string;
  alt: string;
  caps: LightCaps;
  value: PcLighting;
  power: boolean;
  deck?: { x: number; y: number; w: number; h: number };
  /** Draw the picture. Off where the 3D machine is the hero; the dots stay. */
  photo?: boolean;
}

/** The OMEN 16 VALORANT photo's keyboard deck. */
export const VALORANT_DECK = { x: 0.18, y: 0.635, w: 0.64, h: 0.12 };

export function LaptopPreview({ src, alt, caps, value, power, deck, photo = true }: LaptopPreviewProps) {
  const stops = deckStops(value, caps, power);
  const dots = partDots(value, caps, power);
  const bands = stops.length > 1 ? stops.map((c, i) => `${c} ${(i / stops.length) * 100}%, ${c} ${((i + 1) / stops.length) * 100}%`).join(', ') : '';
  const bg = stops.length === 1 ? stops[0] : stops.length > 1 ? `linear-gradient(90deg, ${bands})` : 'transparent';
  return (
    <figure className={'lp' + (photo ? '' : ' lp-dots-only')} data-testid="laptop-preview">
      {photo && (
        <div className="lp-frame">
          {src && <img className="lp-img" src={src} alt={alt} />}
          {deck && stops.length > 0 && (
            <span
              className="lp-deck"
              aria-hidden="true"
              style={{ left: `${deck.x * 100}%`, top: `${deck.y * 100}%`, width: `${deck.w * 100}%`, height: `${deck.h * 100}%`, background: bg }}
            />
          )}
        </div>
      )}
      <figcaption className="lp-parts">
        {dots.map((d) => (
          <span key={d.part} className="lp-part" data-part={d.part}>
            <span className={'lp-dot' + (d.color ? ' lit' : '')} style={d.color ? { background: d.color } : undefined} />
            {d.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

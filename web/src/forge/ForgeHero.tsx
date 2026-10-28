import { useEffect, useRef, useState } from 'react';
import { Button } from '../components';
import clipUrl from '../../../Assets/forge/autocast-preview.mp4';
import posterUrl from '../../../Assets/forge/autocast-poster.jpg';
import type { ForgeListing } from './types';
import type { ForgeState } from './ForgeBody';
import { AddButton } from './ForgeParts';

/** Where the clip's second part begins — the meta line follows it. */
const PART_TWO_AT = 29.7;

const prefersStill = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * The Autocast AI preview: a CS2 death review, then the Live Control screen.
 * Muted, looping and autoplaying — unless the viewer asked for reduced motion,
 * when it waits on its poster with the controls showing.
 */
export function ForgeClip({ tagged }: { tagged?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [part, setPart] = useState(1);
  useEffect(() => {
    const v = ref.current;
    if (v && !prefersStill()) v.play().catch(() => {});
  }, []);
  return (
    <figure className="fg-clip">
      <video
        ref={ref}
        src={clipUrl}
        poster={posterUrl}
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label="Autocast AI preview: a Counter-Strike 2 death review clip, then the Live Control screen collecting clip suggestions"
        onTimeUpdate={(e) => setPart(e.currentTarget.currentTime < PART_TWO_AT ? 1 : 2)}
      />
      {tagged && (
        <figcaption className="fg-clip-tag">
          <span className="fg-clip-dot" aria-hidden />
          {part === 1 ? '1 of 2 · CS2 death review' : '2 of 2 · Live Control'}
        </figcaption>
      )}
    </figure>
  );
}

/** The Discover landing's lead: one official app, with its clip beside the pitch. */
export function ForgeHero({ listing: l, state }: { listing: ForgeListing; state: ForgeState }) {
  return (
    <section className="fg-hero" aria-labelledby="fg-hero-title">
      <div>
        <div className="fg-eyebrow">Featured app · {l.pub}</div>
        <h2 className="fg-hero-title" id="fg-hero-title">
          {l.name}
        </h2>
        <p className="fg-hero-desc">{l.summary}</p>
        <div className="fg-actions">
          <AddButton listing={l} state={state} size="md" />
          <Button onClick={() => state.open(l.id)}>Learn more</Button>
        </div>
      </div>
      <ForgeClip tagged />
    </section>
  );
}

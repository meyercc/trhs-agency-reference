import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

// ── Hero carousel ───────────────────────────────────────────────────────────
// React port of the vanilla `.ds-carousel` home hero: crossfading slides with a
// title/desc/CTAs, dot + arrow nav, autoplay, and the blurred "aura" glow behind
// it (a scaled, saturated, blurred copy of the active slide's art). All styles —
// the carousel, the wrapper, and the full-bleed aura glow — live in the shared
// design system (shared/components.css, `.ds-carousel*`).

export interface CarouselSlide {
  image: string;
  title: ReactNode;
  desc: string;
  primary?: { label: string; onClick?: () => void };
  ghost?: { label: string; onClick?: () => void };
}

export interface CarouselProps {
  slides: CarouselSlide[];
  /** autoplay interval in ms (default 6000); 0 disables autoplay */
  interval?: number;
  /** render the blurred glow behind the carousel (default true) */
  aura?: boolean;
  className?: string;
}

const Arrow = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <polyline points={dir === 'left' ? '6,2 3,5 6,8' : '4,2 7,5 4,8'} />
  </svg>
);

export function Carousel({ slides, interval = 6000, aura = true, className }: CarouselProps) {
  const [idx, setIdx] = useState(0);
  const n = slides.length;
  const timer = useRef<ReturnType<typeof setInterval>>();
  const reset = useCallback(() => {
    clearInterval(timer.current);
    if (interval > 0 && n > 1) timer.current = setInterval(() => setIdx((i) => (i + 1) % n), interval);
  }, [interval, n]);
  useEffect(() => {
    reset();
    return () => clearInterval(timer.current);
  }, [reset]);
  const goto = (i: number) => {
    setIdx(((i % n) + n) % n);
    reset(); // a manual move restarts the autoplay clock
  };

  return (
    <div className={['ds-carousel-wrap', className].filter(Boolean).join(' ')}>
      {aura && <CarouselAura image={slides[idx]?.image} />}
      <div className="ds-carousel">
        {slides.map((s, i) => (
          <div className={'ds-carousel-slide' + (i === idx ? ' active' : '')} key={i} aria-hidden={i !== idx}>
            <div className="ds-carousel-bg" style={{ backgroundImage: `url(${s.image})` }} />
            <div className="ds-carousel-scrim" />
            <div className="ds-carousel-content">
              <div className="ds-carousel-title">{s.title}</div>
              <div className="ds-carousel-desc">{s.desc}</div>
              {(s.primary || s.ghost) && (
                <div className="ds-carousel-ctas">
                  {s.primary && (
                    <button className="ds-btn accent" type="button" onClick={s.primary.onClick}>
                      {s.primary.label}
                    </button>
                  )}
                  {s.ghost && (
                    <Button type="button" onImage onClick={s.ghost.onClick}>
                      {s.ghost.label}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="ds-carousel-nav">
          <button className="ds-carousel-arrow" type="button" onClick={() => goto(idx - 1)} aria-label="Previous slide">
            <Arrow dir="left" />
          </button>
          <div className="ds-carousel-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={'ds-carousel-dot' + (i === idx ? ' active' : '')}
                type="button"
                onClick={() => goto(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === idx}
              />
            ))}
          </div>
          <button className="ds-carousel-arrow" type="button" onClick={() => goto(idx + 1)} aria-label="Next slide">
            <Arrow dir="right" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Two layers that crossfade: the incoming layer takes the new image and fades in
// while the outgoing fades out (mirrors the vanilla `_syncHomeAuraToSlide`).
function CarouselAura({ image }: { image?: string }) {
  const [imgs, setImgs] = useState<[string, string]>([image ?? '', '']);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;
  const last = useRef(image);
  useEffect(() => {
    if (!image || image === last.current) return;
    last.current = image;
    const next = activeRef.current === 0 ? 1 : 0;
    setImgs((p) => {
      const c = [...p] as [string, string];
      c[next] = image;
      return c;
    });
    const r = requestAnimationFrame(() => setActive(next));
    return () => cancelAnimationFrame(r);
  }, [image]);
  return (
    <div className="ds-carousel-aura" aria-hidden="true">
      <div className={'ds-carousel-aura-layer' + (active === 0 ? ' active' : '')} style={imgs[0] ? { backgroundImage: `url(${imgs[0]})` } : undefined} />
      <div className={'ds-carousel-aura-layer' + (active === 1 ? ' active' : '')} style={imgs[1] ? { backgroundImage: `url(${imgs[1]})` } : undefined} />
    </div>
  );
}

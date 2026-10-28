import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { MouseRender } from './mouseRenders';

/**
 * The mouse's photo hero (Figma Keys-Buttons 4631:41576): the stage that
 * holds the render and its button callouts, laid out at the frame's own px
 * so callouts, leader lines and render are 1:1 with the design, then scaled
 * as one to fit the hero — never up past 1:1. Children position themselves
 * in stage px. Ported from the NGENUITY prototype.
 */
export function MouseStage({ render, alt, children }: { render: MouseRender; alt: string; children?: ReactNode }) {
  const fit = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = fit.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(1, width / render.w, height / render.h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [render.w, render.h]);

  const { photoBox } = render;
  return (
    <div ref={fit} className="dc-mouse-fit" style={{ width: render.w * scale, height: render.h * scale }}>
      <div className="dc-mouse-stage" style={{ width: render.w, height: render.h, transform: `scale(${scale})` }}>
        <img
          className="dc-mouse-photo"
          src={render.photo}
          alt={alt}
          draggable={false}
          style={{ left: photoBox.x, top: photoBox.y, width: photoBox.w, height: photoBox.h }}
        />
        {children}
      </div>
    </div>
  );
}

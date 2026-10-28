import { useEffect } from 'react';

// Carousels, animations and lazy content move things without a scroll or a
// resize; a light poll catches those. Only reports when the rect changes.
const POLL_MS = 250;

type Rect = { x: number; y: number; width: number; height: number };

/**
 * When the treehouse-tracker embeds the prototype, it outlines the area of the
 * screen a feature's UX review evaluated. It can't measure inside a
 * cross-origin iframe, so it asks: `{ type: 'tracker:watch-region', selector }`.
 * The prototype answers with `{ type: 'tracker:region', selector, rect }`
 * (viewport pixels, or null when nothing matching is visible) right away and
 * whenever the area moves, so the outline follows scrolling and reflow.
 * Only active inside an iframe; it reads the DOM and changes nothing.
 */
export function useTrackerRegion() {
  useEffect(() => {
    if (window.parent === window) return;
    let selector: string | null = null;
    let origin = '*';
    let last = '';
    let frame = 0;

    const measure = () => {
      frame = 0;
      if (!selector) return;
      const rect = regionRect(selector);
      const key = JSON.stringify(rect);
      if (key === last) return;
      last = key;
      window.parent.postMessage({ type: 'tracker:region', selector, rect }, origin);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data as { type?: unknown; selector?: unknown } | null;
      if (data?.type !== 'tracker:watch-region' || typeof data.selector !== 'string') return;
      selector = data.selector;
      // A file:// or sandboxed parent has an opaque origin that postMessage can't target.
      origin = event.origin && event.origin !== 'null' ? event.origin : '*';
      last = '';
      schedule();
    };

    window.addEventListener('message', onMessage);
    // Capture, so scrolling inside any container (a modal body, a side panel) counts too.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    const poll = window.setInterval(schedule, POLL_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      resize.disconnect();
      window.clearInterval(poll);
      cancelAnimationFrame(frame);
    };
  }, []);
}

/**
 * The union of every visible match, leaving out matches nested in another
 * match. The same rule the tracker's UX assessment uses to find the region.
 */
function regionRect(selector: string): Rect | null {
  let matches: HTMLElement[];
  try {
    matches = [...document.querySelectorAll<HTMLElement>(selector)];
  } catch {
    return null; // not a valid selector
  }
  const visible = matches.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  });
  const roots = visible.filter((el) => !visible.some((other) => other !== el && other.contains(el)));
  if (!roots.length) return null;
  const rects = roots.map((el) => el.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const round = (n: number) => Math.round(n * 2) / 2;
  return { x: round(left), y: round(top), width: round(right - left), height: round(bottom - top) };
}

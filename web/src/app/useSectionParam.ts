import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

// How long to keep looking for the target. Sections mount lazily (the Lighting
// desk, the Home board's measured grid), so the first paint may not have it yet.
const GIVE_UP_MS = 3000;
// How long to keep the target aligned after the first scroll. In a production
// build the target can exist before the images above it load; when they do,
// the page grows and the target slides out of view. Re-align on every resize
// until the layout settles, or until the person scrolls or presses a key.
// Generous because several previews often load at once (the tracker's grid).
const SETTLE_MS = 5000;
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/**
 * `?section=<id>` scrolls the page to one part of itself, so a link (or the
 * treehouse-tracker's per-feature iframes) can land on a feature rather than
 * the top of the page. The id matches, in order: a reorderable section's
 * `data-section`, a Home board cell's `data-widget`, a `data-feature`, or an
 * element id. Read-only: the param stays in the URL and writes no state.
 */
export function useSectionParam() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const section = params.get('section');

  useEffect(() => {
    if (!section) return;
    const id = CSS.escape(section);
    const selector = `[data-section="${id}"], [data-widget="${id}"], [data-feature="${id}"], #${id}`;
    const started = performance.now();
    let frame = 0;
    let settle = 0;
    let resize: ResizeObserver | null = null;

    const align = (target: HTMLElement) => {
      // The nav is sticky over the page; land the target just below it.
      const nav = document.querySelector<HTMLElement>('.shell-nav');
      const top = target.getBoundingClientRect().top + window.scrollY - (nav?.offsetHeight ?? 0);
      if (Math.abs(top - window.scrollY) > 1) window.scrollTo({ top, behavior: 'instant' });
    };
    const stop = () => {
      resize?.disconnect();
      resize = null;
      window.clearTimeout(settle);
      for (const type of USER_INPUT) window.removeEventListener(type, stop);
    };

    const find = () => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) {
        if (performance.now() - started < GIVE_UP_MS) frame = requestAnimationFrame(find);
        return;
      }
      align(target);
      resize = new ResizeObserver(() => align(target));
      resize.observe(document.body);
      settle = window.setTimeout(stop, SETTLE_MS);
      for (const type of USER_INPUT) window.addEventListener(type, stop, { passive: true, once: true });
    };
    frame = requestAnimationFrame(find);
    return () => {
      cancelAnimationFrame(frame);
      stop();
    };
  }, [section, pathname]);
}

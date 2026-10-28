// The breakpoint scale in JS (2026-10-20) — the same five steps the stylesheets
// name as `(--bp-<step>)`, from the same file, so the two cannot drift.
//
// Two different questions, two hooks:
//   · `useViewportStep()` — the WINDOW's size class. For app chrome that is
//     laid out against the window: the nav moving to the bottom edge.
//   · `usePageSize()` / `usePageStep()` (PageSizeContext, provided by AppShell)
//     — the PAGE's size: the width of `.shell-scroll`, which is the window less
//     any rail reserving room beside it, and its step. For everything a page
//     draws, and the same box the page CSS queries with `@container page`, so
//     a layout decided in JS (the board's column count) and one decided in
//     CSS agree.
import { createContext, useContext, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import scale from '../../../shared/breakpoints.json';

export type Step = 'compact' | 'medium' | 'expanded' | 'wide' | 'ultra';
export const STEPS: readonly Step[] = ['compact', 'medium', 'expanded', 'wide', 'ultra'];
/** Each step's lower bound, px. */
export const BP: Readonly<Record<Step, number>> = {
  compact: scale.compact,
  medium: scale.medium,
  expanded: scale.expanded,
  wide: scale.wide,
  ultra: scale.ultra,
};

/**
 * Named single thresholds (the file's `widths`): where the Home board fits
 * eight and ten of its 1100px-grid tracks (2026-10-21). The stylesheets name
 * them as `(--w-board-8)`; the board reads them here to pack the same count.
 */
export const W: Readonly<{ board8: number; board10: number }> = {
  board8: scale.widths['board-8'],
  board10: scale.widths['board-10'],
};

/** The step a width falls in. */
export function stepFor(width: number): Step {
  let out: Step = 'compact';
  for (const s of STEPS) if (width >= BP[s]) out = s;
  return out;
}

/** Is `a` at least as wide a step as `b`? `atLeast('wide', 'expanded')` is true. */
export function atLeast(a: Step, b: Step): boolean {
  return STEPS.indexOf(a) >= STEPS.indexOf(b);
}

/**
 * The media query a named step expands to — the same expansion
 * `web/postcss.config.js` does for the stylesheets, for the few places JS has
 * to ask the window directly.
 */
export function mediaQuery(name: Step | `${Step}-up` | `${Step}-down`): string {
  const [step, dir] = name.split('-') as [Step, 'up' | 'down' | undefined];
  const i = STEPS.indexOf(step);
  const lo = BP[step];
  const next = STEPS[i + 1];
  const hi = next ? BP[next] : null;
  if (dir === 'up') return `(min-width: ${lo}px)`;
  if (dir === 'down') return hi == null ? '(min-width: 0px)' : `(max-width: ${hi - 1}px)`;
  if (lo === 0) return `(max-width: ${hi! - 1}px)`;
  if (hi == null) return `(min-width: ${lo}px)`;
  return `(min-width: ${lo}px) and (max-width: ${hi - 1}px)`;
}

/** A media query's current answer, kept live. */
export function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setOn(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return on;
}

/** The window's size class, live. */
export function useViewportStep(): Step {
  const [step, setStep] = useState<Step>(() => stepFor(typeof window !== 'undefined' ? window.innerWidth : BP.expanded));
  useEffect(() => {
    const on = () => setStep(stepFor(window.innerWidth));
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return step;
}

/** A container's size: its step on the scale and its content width, px. */
export interface PageSize {
  step: Step;
  width: number;
}

/**
 * An element's size, live — a ResizeObserver, with the width mapped onto the
 * scale. Measured in a layout effect so the first paint already has the real
 * answer rather than the window's; the observer keeps it current after that.
 *
 * The CONTENT box, as `@container` measures it: `.shell-scroll`'s padding is
 * the room a rail reserves, and `clientWidth` would count it as page. The
 * observer reports the content box by default, so it also fires through the
 * reservation's 0.28s ease, and the board re-packs when the ease lands.
 */
export function useContainerSize(ref: RefObject<HTMLElement | null>, fallback: PageSize = PAGE_SIZE_DEFAULT): PageSize {
  const [size, setSize] = useState<PageSize>(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (w: number) => setSize((prev) => (prev.width === w ? prev : { step: stepFor(w), width: w }));
    const cs = getComputedStyle(el);
    set(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) set(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * The interface-size zoom in force (tokens.css, INTERFACE SIZE; app.css puts
 * it on <html>). Pointer events arrive in WINDOW px and an element's own
 * sizes are in its zoomed px, so a drag that turns a pointer delta into a
 * width must divide by this — a 100px drag is 67px of panel at 1.5. Rect
 * ratios are unaffected (both sides are window px), so sliders need nothing.
 */
export function uiZoom(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/**
 * Dev only: say so when a `(--bp-…)` name reached the browser unexpanded. The
 * plugin in postcss.config.js runs inside Vite, so a dev server started before
 * that file existed serves the names raw; the query is then invalid and never
 * matches, and nothing says anything — the page just lays out at one step
 * while JS packs at another (Chris, 2026-10-21: a 50px keyboard card). The
 * build is covered by `verify-responsive`; this is for the tab in front of you.
 */
export function warnIfBreakpointsUnexpanded(): void {
  if (!import.meta.env.DEV) return;
  const raw: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const text = (rule as CSSConditionRule).conditionText ?? '';
      if (text.includes('--bp-')) raw.push(text);
    }
  }
  if (raw.length) console.warn(`[breakpoints] ${raw.length} query(ies) reached the browser unexpanded, e.g. ${raw[0]} — restart the dev server so web/postcss.config.js runs.`);
}

/**
 * The page's size — see the file header. AppShell provides it. The default is
 * the 1100px page every screen was drawn at, so a board rendered outside the
 * shell (Storybook) lays out as the 1440 page does.
 */
export const PAGE_SIZE_DEFAULT: PageSize = { step: 'expanded', width: 1100 };
export const PageSizeContext = createContext<PageSize>(PAGE_SIZE_DEFAULT);
export function usePageSize(): PageSize {
  return useContext(PageSizeContext);
}
export function usePageStep(): Step {
  return useContext(PageSizeContext).step;
}

// The breakpoint scale, as names the stylesheets can use (2026-10-20).
//
// CSS has no variables inside `@media` or `@container` params, so until now
// every query carried a literal — about twenty different widths across the
// app, none of them agreeing. This expands the five named steps from
// `shared/breakpoints.json` in BOTH at-rules:
//
//   @media (--bp-compact)            → @media (width < 600px)
//   @container page (--bp-wide-up)   → @container page (width >= 1600px)
//   @media (--bp-medium-down)        → @media (width < 1024px)   (up to and including medium)
//   @container page (--w-board-8)    → @container page (width >= 1523px)
//
// `--bp-<step>` is exactly that step, `-up` is the step and everything wider,
// `-down` is the step and everything narrower. `--w-<name>` is one of the named
// single thresholds in the file's `widths` (where the Home board fits eight or
// ten tracks, 2026-10-21). A name that is not in the file FAILS THE BUILD
// rather than compiling to a query that never matches — that failure is
// silent in the browser and is the house speciality.
//
// Why not postcss-custom-media: it only rewrites `@media`, and the page layouts
// query the page CONTAINER (shell.css `.shell-scroll`), so the same names have
// to work in `@container`. Fifteen lines with no dependency beat a plugin that
// covers half the cases. Vite and Storybook both pick this file up (it is at
// the Vite root), so the app and the catalog compile the same CSS.
import { readFileSync } from 'node:fs';

const { $comment: _, widths: WIDTHS = {}, ...BP } = JSON.parse(readFileSync(new URL('../shared/breakpoints.json', import.meta.url), 'utf8'));
const STEPS = Object.keys(BP).sort((a, b) => BP[a] - BP[b]);

/** `(--w-board-8)` → `(width >= 1523px)`. */
function width(name) {
  if (!(name in WIDTHS)) throw new Error(`postcss.config.js: "--w-${name}" is not a named width; the file has ${Object.keys(WIDTHS).join(', ')} (shared/breakpoints.json)`);
  return `(width >= ${WIDTHS[name]}px)`;
}

/** `(--bp-wide)` → `(1600px <= width < 2560px)`, and the -up / -down forms. */
function range(step, dir) {
  const i = STEPS.indexOf(step);
  if (i < 0) throw new Error(`postcss.config.js: "--bp-${step}" is not a breakpoint; the scale is ${STEPS.join(', ')} (shared/breakpoints.json)`);
  const lo = BP[step];
  const hi = STEPS[i + 1] ? BP[STEPS[i + 1]] : null;
  if (dir === 'up') return `(width >= ${lo}px)`;
  if (dir === 'down') return hi == null ? '(width >= 0px)' : `(width < ${hi}px)`;
  if (lo === 0) return `(width < ${hi}px)`;
  if (hi == null) return `(width >= ${lo}px)`;
  return `(${lo}px <= width < ${hi}px)`;
}

const expand = (rule) => {
  rule.params = rule.params
    .replace(/\(--bp-([a-z]+)(?:-(up|down))?\)/g, (_m, step, dir) => range(step, dir))
    .replace(/\(--w-([a-z0-9-]+)\)/g, (_m, name) => width(name));
};

const breakpoints = () => ({
  postcssPlugin: 'treehouse-breakpoints',
  AtRule: { media: expand, container: expand },
});
breakpoints.postcss = true;

export default { plugins: [breakpoints()] };

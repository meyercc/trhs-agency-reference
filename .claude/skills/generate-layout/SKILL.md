---
name: generate-layout
description: >
  Use this skill when generating or building a new screen, page, view, dashboard, or
  layout for the Treehouse React app (web/) — from a design brief, a Figma handoff, a
  sketch, a written description, or a request like "build a new page", "create a layout",
  "add a screen", "design a view", or "turn this handoff into the app". This is the skill
  for design-handoff-to-prototype work. Load it for any page- or layout-level generation.
  For a single new component with no existing equivalent, use the ds-component skill
  instead. When in doubt for layout work, load this skill.
---

# Treehouse — Generate Layout Skill (React)

You are generating a new layout for the Treehouse **React app** (`web/`). The whole point
of this project is to **close the gap between design handoff and AI UI generation**: a
layout you generate must be indistinguishable from one a designer hand-built in the design
system. That only happens if you compose from existing components and never improvise.

> Every screen you generate either reinforces the design system or erodes it. Treat the
> output as a system asset, not a one-off page.

**The single source of truth is the design system layer** — `shared/tokens.css` +
`shared/components.css` + the React components that wrap them. This is also what keeps the
app portable to other targets (e.g. Avalonia): the spec lives in tokens + component
semantics, not in framework specifics. Never push styling or design decisions below that
layer (no ad-hoc CSS, no hardcoded values). Consume the system; don't fork it.

> **Working from a Figma reference?** Run the **`figma-to-app`** skill *first*. It pulls
> the design, maps every Figma variable to a token and every frame to an existing
> component (via Code Connect + Storybook), and produces the build plan this skill's
> Step 1 consumes. Come back here once you have that plan.

> The vanilla `prototype.html` / `design-system.html` are **retired** — do not read or
> generate them. **Generate React** in `web/`; the living catalog is Storybook.

---

## Step 0 — Read the source of truth first (do not skip)

This skill is a summary and can drift. Before generating anything, read the real thing:

- `shared/tokens.css` — every color, space, radius, font, duration token. Authoritative.
- `shared/components.css` — the shared `.ds-` classes the React components wrap.
- `web/src/components/index.ts` + `web/src/widgets/index.ts` — the live component/widget
  API (names, exported prop types). This is your palette.
- **Storybook** (`cd web && npm run storybook`, :6006) — the living catalog: every
  component and widget with its variants. This is the React-era replacement for
  `design-system.html`.
- `web/src/pages/*.tsx` — the five existing pages. Find the one closest to the brief and
  copy its structure rather than inventing one.

If a token or component you need does not exist: **stop.** Pick the closest existing one,
or — if a genuinely new component is unavoidable — build it first with the `ds-component`
skill (which adds it to `web/src/components` + a story), then return here.

---

## Step 1 — Pre-flight: decode the brief

Answer all of these before writing TSX:

1. **Page type** — dashboard, library/grid, detail view, settings, store, modal flow?
2. **Closest existing page** — which of `Home` / `Play` / `Perform` / `Personalize` /
   `Shop` (in `web/src/pages/`) does this most resemble? You will reuse its skeleton.
3. **Components needed** — list every component/widget the layout requires, and map each
   to an export in `web/src/components/index.ts` or `web/src/widgets/index.ts`.
4. **New component?** — if the brief needs something with no existing equivalent, flag it
   and build it via the `ds-component` skill before continuing.
5. **Interactivity / state** — local `useState`, or app-wide via the Settings context
   (`web/src/state/Settings.tsx`)? Is it a deep-linkable modal (URL param)?
6. **Responsive targets** — desktop-first (1280px+); also tablet (≤1024px) and mobile
   (≤600px). Confirm expected behavior at each.

If any answer is ambiguous, ask before generating.

---

## Step 2 — Skeleton

A page is a component in `web/src/pages/<Name>.tsx`, exported by name, returning JSX:

```tsx
import { Card, Badge } from '../components';
import { SystemVitalsWidget } from '../widgets';

export function Name() {
  return (
    <div>
      <h1 className="page-title">Title</h1>
      <p className="page-sub">One-line description.</p>
      <div className="page-grid">
        {/* compose components/widgets here */}
      </div>
    </div>
  );
}
```

- **Page chrome classes** (defined in `web/src/app/shell.css`): `.page-title` (h1),
  `.page-sub` (the subhead `<p>`), `.page-grid` (responsive auto-fill card/widget grid).
  Use these — do not re-style headings inline.
- For a **draggable dashboard**, reuse `<WidgetBoard />` (it owns the move/resize/reorder
  interaction) rather than laying widgets out by hand.
- Group sub-sections with an `<h2>` (already styled in `shell.css`).

Copy the closest existing page from `web/src/pages/` and adapt it. (`Shop.tsx` = card
grid; `Home.tsx` = widget board; `Perform.tsx` = widget + buttons that open modals.)

---

## Step 3 — Compose from existing parts

Build the layout by assembling components that already exist. The reuse order:

1. An existing **widget** (`web/src/widgets/`) does the job → use it as-is.
2. An existing **component** (`web/src/components/`) does the job → use it, driving the
   variant through **props** (`<Button variant="accent">`, `<Card orientation="overlay">`,
   `<Badge variant="sale">`). Do not write `.ds-` class strings by hand — that's the
   component's job.
3. Neither fits → this is a missing component. Stop, use the `ds-component` skill, then
   come back.

Never hand-roll a card, button, badge, toggle, slider, dropdown, segmented control,
widget shell, or modal shell — the system already provides them. Fewer bespoke
components is a project goal: reuse beats reinvention every time.

**Assets** are imported as URLs (Vite handles them), e.g.
`import cyber from '../../../Assets/games/cyberpunk.webp';` then `art={cyber}`.

---

## Step 4 — Token discipline (non-negotiable)

Every visual value is a token from `shared/tokens.css`. Hardcoded values are bugs. In
TSX this means inline styles use `var(--token)` strings:

| ❌ Never write | ✅ Write instead |
|---|---|
| `style={{ background: '#0d0f13' }}` | `style={{ background: 'var(--bg-base)' }}` |
| `style={{ color: '#e4e8f0' }}` | `style={{ color: 'var(--text-primary)' }}` |
| `style={{ padding: 16 }}` | `style={{ padding: 'var(--gutter)' }}` |
| `style={{ gap: 8 }}` | `style={{ gap: 'var(--gutter-sm)' }}` |
| `style={{ borderRadius: 10 }}` | `style={{ borderRadius: 'var(--radius-card)' }}` |
| `style={{ fontFamily: 'Barlow' }}` | `style={{ fontFamily: 'var(--font-display)' }}` |
| accent color hardcoded | `var(--accent-color)` (re-themes app-wide) |

Prefer a **class** over inline style when a component or `shell.css` already provides one.
Reach for inline `var(--token)` only for one-off layout (flex/grid/spacing) glue, exactly
as the existing pages do. Before finishing, scan the new TSX/CSS for any `#`, raw `px`
number, `rgb(`, or `em` value and replace it with the correct token. Confirm token names
against `shared/tokens.css` — do not trust this table over the file.

---

## Step 5 — Wire it into the app

A new page only exists once it's routed and reachable:

1. **Route** — add a `<Route>` in `web/src/main.tsx` under the `AppShell` layout route:
   `<Route path="name" element={<Name />} />` (and import the page at the top).
2. **Nav tab** — if it belongs in the top nav, add an entry to the `TABS` array in
   `web/src/app/AppShell.tsx` (`{ to: '/name', label: 'Name', end: false }`).
3. **Routing uses HashRouter** — links resolve under any Pages subpath; use `<NavLink>` /
   `useNavigate` / `useSearchParams` from `react-router-dom`, never `<a href>` for
   internal navigation.
4. **Modals are URL-driven.** A deep-linkable modal is opened by setting a search param
   (`setSearchParams({ device: id })`) and rendered by a host that reads it
   (`web/src/devices/DeviceModalHost.tsx` reads `?device=`). For a device modal, add to
   the `devices` registry (`web/src/devices/devices.tsx`); for a generic modal, compose
   `<ModalShell>`. Don't build bespoke overlay/backdrop/Esc logic.
5. **Shared state** goes through the Settings context (`useSettings()` from
   `web/src/state/Settings.tsx`) — don't re-implement persistence or theme handling.

There is **no import map / bare-specifier / `gen:importmap` / `window` bridge** in the
React app — that was the vanilla static server. Vite resolves imports; just `import`.

---

## Step 6 — Accessibility (WCAG AA)

- Contrast: normal text ≥ 4.5:1, large text ≥ 3:1, UI borders/icons ≥ 3:1 — check every
  state (default, hover, active, disabled), in both dark and light themes.
- Keyboard: every interactive element is Tab-reachable, with a visible `:focus-visible`
  ring; no keyboard traps. Modals trap focus and close on Esc.
- ARIA: icon-only buttons get `aria-label`; toggles/segmented use the right
  `aria-pressed`/`aria-checked`/`role`; disclosed regions use `aria-expanded` +
  `aria-controls`. The library components already do much of this — pass the labels.
- Never signal state with color alone — pair it with an icon or text.

---

## Step 7 — Test before reporting done

From `web/`:

- `npm run build` — **must pass** (this runs `tsc --noEmit` + `vite build`; a type error
  is a failure, not a warning).
- `npm run dev` (:5175) — open the new route, confirm it renders, every interaction
  works, and the **console is error-free**. Resize to tablet (≤1024px) and mobile
  (≤600px) — confirm graceful behavior.
- If you added/changed a component, also verify its **Storybook** story
  (`npm run storybook`, :6006).

Deploy (when asked) is `npm run deploy` from the repo root — see `docs/web-hosting.md`.

---

## Post-flight checklist

- [ ] Page is a `web/src/pages/*.tsx` component, skeleton copied from the closest page
- [ ] Uses `.page-title` / `.page-sub` / `.page-grid` chrome; sections under `<h2>`
- [ ] Every element is an existing component or widget, variant driven by **props**
      (no hand-written `.ds-` class strings, no hand-rolled duplicates)
- [ ] Zero hardcoded colors/sizes/spacing — all tokens (`var(--…)`), verified vs `tokens.css`
- [ ] Routed in `main.tsx`; nav tab added in `AppShell.tsx` if applicable
- [ ] Deep-linkable modals via URL param + host/registry; generic modals via `<ModalShell>`
- [ ] Shared state via `useSettings()`; assets via `import`
- [ ] WCAG AA contrast + keyboard + focus verified for all states, both themes
- [ ] `npm run build` passes; tested on `npm run dev` (:5175), console clean, responsive
- [ ] New/changed components verified in Storybook
- [ ] Handoff note updated — see the `session-handoff` skill

If any item is unchecked, fix it before saying the layout is done.

# Treehouse

**The goal this system serves:** a design system consistent enough that new layouts can be
generated from it — by a person or by an AI — and be indistinguishable from ones a designer
hand-built. Every screen either reinforces the system or erodes it. Treat every output as a
system asset, not a prototype artifact.

## Project shape

React + Vite. Run scripts from `web/`.

```
shared/tokens.css        # the token contract — color, spacing, type, motion, radii, shadows
shared/components.css    # canonical .ds- component styles (the visual source of truth)
web/
  src/components/        # React wrappers (thin: props → .ds- classes) + *.stories.tsx
  src/widgets/           # composed widgets
  src/pages/             # routed screens
  src/devices/           # device detail modals
  src/app/               # AppShell.tsx (nav/TABS), shell.css (page chrome)
  src/state/Settings.tsx # app-wide state context (theme, accent, density)
  main.tsx               # routes (HashRouter)
```

## Source of truth

The design-system layer is **`shared/tokens.css` + `shared/components.css` + the React
components/widgets that wrap them**. Never push styling or design decisions below that
layer — no ad-hoc CSS, no hardcoded values. Consume the system; don't fork it. This layer
is also what keeps the system portable to other targets (it is being implemented in
Avalonia in parallel): the spec lives in tokens + component semantics, not in framework
specifics.

**Storybook is the living catalog** (`cd web && npm run storybook`, :6006) — every
component and widget with its variants. Check it before building anything new; the thing
you need usually already exists as a variant.

## Non-negotiable rules

- **Reuse before you reinvent.** Compose from existing components/widgets; drive variants
  through **props**, never hand-written `.ds-` class strings. Fewer bespoke components /
  fewer unique classes is a goal — clean up unused CSS as you go.
- **Every visual value is a token** from `shared/tokens.css` — in CSS *and* in React inline
  styles (`style={{ padding: 'var(--gutter)' }}`, never `16`). A raw hex/px is a bug.
- **Accessibility is craft, not a step.** Consult WCAG for every color choice (text ≥ 4.5:1
  normal / 3:1 large; UI ≥ 3:1) and font size, in **both dark and light themes**. Visible
  `:focus-visible` on every interactive element; full keyboard operability; never signal
  state by color alone.

## Commands (from `web/`)

- `npm run dev` — the app on **:5175**
- `npm run storybook` — the component catalog on **:6006**
- `npm run build` — `tsc --noEmit && vite build`; a type error is a **failure**, not a warning

## How work flows — use the skills

The design-system workflow is encoded in `.claude/skills/` (and documented as a portable
bundle in `treehouse-design-skills/`, which explains how they chain together). Load them:

- **`figma-to-app`** — start here when a task begins from a **Figma reference**. Maps Figma
  variables → tokens and frames → existing components, and produces a build plan.
- **`generate-layout`** — build a new screen / page / view / modal.
- **`ds-component`** — add a new reusable component. It lives in **three coordinated
  homes**: the `.ds-` CSS in `shared/components.css`, a React wrapper in
  `web/src/components/`, and a Storybook story. It isn't done until all three exist.
- **`treehouse-frontend`** — the craft/polish pass (states, motion, hierarchy, accent).
- **`token-audit`** — verify zero hardcoded values before calling work done.
- **`session-handoff`** — a session handoff format, if you want one.

## Notes on this snapshot

This is a point-in-time copy provided as a reference — see `README.md` and `TERMS.md`.
A few things referenced inside the skills belong to the originating project and are not
here: the Figma token sync, Code Connect publishing, the deploy pipeline, and the internal
session handoff. Skip those steps; everything about *building on the system* applies.

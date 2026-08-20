# Treehouse — design system & prototype (reference snapshot)

A frozen snapshot of the Treehouse living prototype, provided as a reference to
build from. It is a point-in-time copy (`v0.2.16`, `2d8a86d`) and does not
track ongoing development — see [TERMS.md](TERMS.md) for how it may be used.

## What this is

Treehouse is a design system plus a React prototype that exercises it. The goal
of the system is that new screens can be generated — by a person or by an AI —
that are consistent with it by construction. **The system layer is the valuable
part; the screens are evidence that it works.**

## The source of truth

Three files carry the contract. Everything else consumes them.

| Path | What it is |
|---|---|
| `shared/tokens.css` | The token contract — color, spacing, type, motion, radii, shadows, and the light/dark themes |
| `shared/components.css` | The canonical `.ds-` component styles — the visual source of truth |
| `web/src/components/` | Thin React wrappers: props in, `.ds-` classes out |

Two rules make it hold together, and they are worth keeping if you build on this:

1. **Every visual value is a token.** In CSS and in React inline styles
   (`style={{ padding: 'var(--gutter)' }}`, never `16`). A raw hex or px is a bug.
2. **Compose before you invent.** Variants are driven through props, never
   hand-written class strings. Fewer bespoke components is a goal in itself.

## Running it

```bash
cd web
npm install
npm run dev         # the app          → http://localhost:5175
npm run storybook   # the catalog      → http://localhost:6006
npm run build       # typecheck + build; a type error is a failure
```

**Start with Storybook.** It is the living catalog — every component and widget
with its variants, plus a changelog of how the system has evolved. It is the
fastest way to see what already exists before building anything new.

The app uses a `HashRouter`; modals are URL-driven (`?modal=…`, `?sku=…`), so
any state you see can be linked to. `docs/modal-registry.md` documents that
contract and `docs/design-decision-records.md` records why the system is shaped
the way it is.

## Layout

```
shared/          the design system (tokens + components)
web/
  src/components/  React wrappers + Storybook stories
  src/widgets/     composed widgets
  src/pages/       routed screens
  src/devices/     device detail modals
  src/app/         AppShell, nav, page chrome
  main.tsx         routes
Assets/          imagery, icons, 3D models, fonts
docs/            selected background reading
```

## What is deliberately not here

This snapshot is trimmed to the system and the app. Internal planning docs,
session handoffs, the retired pre-React prototype, deployment tooling and
unused assets have been removed.

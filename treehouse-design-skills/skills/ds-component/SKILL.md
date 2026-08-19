---
name: ds-component
description: >
  Add or update a component in the Treehouse design system. Use this skill whenever
  you need to: add a new reusable component, add a React wrapper + Storybook story for
  a design-system component, add or update component CSS in shared/components.css, or
  add a variant to an existing component. Trigger on phrases like "add to the design
  system", "new component", "add a Storybook story", "new DS component", or any task
  adding/updating a reusable UI primitive. For a whole page or screen, use the
  generate-layout skill instead.
---

# Treehouse Design System — Component Skill (React + Storybook)

A design-system component lives in **three coordinated places**, and a new component is
not done until all three exist:

1. **CSS** — the `.ds-` class in `shared/components.css`. This is the **visual source of
   truth**: framework-agnostic, the layer that keeps the system portable to other targets
   (e.g. Avalonia). Everything else consumes it.
2. **React wrapper** — `web/src/components/<Name>.tsx`: a thin, props-driven wrapper that
   renders the `.ds-` classes. Exported from `web/src/components/index.ts`.
3. **Storybook story** — `web/src/components/<Name>.stories.tsx`: all variants/states.
   **Storybook is the living catalog** — the React-era replacement for `design-system.html`.

> Never put visual decisions below the CSS layer (no hardcoded values in the wrapper, no
> styling that bypasses tokens). The wrapper maps props → `.ds-` classes; the CSS owns the
> look. That separation is what keeps the system consistent and portable.

> **Storybook is the only catalog.** The vanilla `design-system.html` is **retired** — do
> not read, sync, or maintain it. The catalog you keep current is Storybook.

> **Component coming from a Figma reference?** Run the **`figma-to-app`** skill first — it
> gives you the Figma-variable → token map and the exact variant/prop shape to build,
> and confirms the component is genuinely new (not an existing one in an unfamiliar
> variant). Then build it here.

## Determine Your Workflow

**New component** — no `.ds-` class and no React wrapper exist yet.
→ Part 1 (CSS) + Part 2 (React wrapper) + Part 3 (Storybook story) + Part 4 (verify).

**Update existing component** — adding a variant/state to a component that already has a
wrapper.
→ Part 1 (CSS change) + Part 2B (extend wrapper props) + Part 3B (add to story) + Part 4.

**Wrapper-only** — the `.ds-` CSS already exists in `shared/components.css` (carried over
from the vanilla era) but there is no React wrapper yet.
→ Skip Part 1, follow Part 2 + Part 3 + Part 4. Read the existing CSS carefully so the
wrapper's props match what the classes actually support.

## File Locations

```
shared/tokens.css                  → design tokens (colors, spacing, type, motion)
shared/components.css              → canonical .ds- component styles (source of truth)
web/src/components/<Name>.tsx      → React wrapper
web/src/components/<Name>.stories.tsx → Storybook story (the catalog entry)
web/src/components/index.ts        → barrel: export the component + its prop types
```

## Before You Start

1. **Read `shared/tokens.css`** — you need token names for color, spacing, radii, type,
   motion. Never hardcode a value that has a token.
2. **Read the relevant area of `shared/components.css`** — does the component (or a close
   sibling to extend) already exist?
3. **Read an existing wrapper + story as your template** — `Button.tsx` / `Button.stories.tsx`
   are canonical: prop-typed variants, a `VARIANT_CLASS` map, a JSDoc, and a story with
   per-variant exports plus an `AllVariants` render. Match that shape.

---

## Part 1: CSS in `shared/components.css`

### Structure

```css
/* ── Component Name (.ds-component-name) ───────────────── */
/* Brief description of what the component is and when to use it.
   Variants: .variant-a, .variant-b
   ────────────────────────────────────────── */
.ds-component-name {
  /* layout */
  display: ...;
  /* visual */
  background: ...;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  /* typography */
  font-family: var(--font-mono);
  font-size: var(--text-micro);
  /* motion */
  transition: background var(--dur-fast) var(--ease-default);
}

/* Variants */
.ds-component-name.variant { ... }

/* States */
.ds-component-name:hover { ... }
.ds-component-name:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }
```

### Rules

- **Prefix all new classes with `ds-`.**
- **Always use tokens** from `tokens.css` instead of raw values (`8px` → `var(--gutter-sm)`,
  border color → `var(--border)` / `var(--border-med)`).
- **Comment header** with the component name, class, and brief description.
- **Group properties**: layout → visual → typography → motion.
- **Light-theme overrides** if backgrounds/borders need to change — in the `html.light` /
  `html[data-theme="light"]` block near the end of components.css.
- **Interactive components** need `:focus-visible` styles
  (`outline: 2px solid var(--accent-color); outline-offset: 2px`).
- **WCAG AA contrast** — text ≥ 4.5:1 (normal) / 3:1 (large), in both themes.

### Common Tokens Reference

| Purpose | Token |
|---------|-------|
| Card padding | `var(--gutter)` · Tight gap `var(--gutter-sm)` · Micro gap `var(--gutter-xs)` |
| Radii | Button `var(--radius)` · Small `var(--radius-sm)` · Card `var(--radius-card)` |
| Border | `var(--border)` / `var(--border-med)` |
| Motion | `var(--dur-fast)` + `var(--ease-default)` |
| Fonts | Body `var(--font-display)` · Mono `var(--font-mono)` · Condensed `var(--font-cond)` |
| Text | Body `var(--text-body)` · Small `var(--text-sm)` · Micro `var(--text-micro)` · Nano `var(--text-nano)` |

> These are a quick reference — confirm exact names against `shared/tokens.css`.

---

## Part 2: React wrapper in `web/src/components/<Name>.tsx`

A thin wrapper that maps **props → `.ds-` classes**. It owns no visual values — the CSS
does. Model it on `Button.tsx`:

```tsx
import React from 'react';

export type WidgetVariant = 'default' | 'accent';

export interface WidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual style. `default` is the base `.ds-widget`. */
  variant?: WidgetVariant;
}

const VARIANT_CLASS: Record<WidgetVariant, string> = {
  default: '',
  accent: 'accent',
};

/**
 * Thin wrapper over the design system's `.ds-widget` (shared/components.css).
 * Renders the same classes the prototype uses, so the look stays sourced from CSS.
 *
 * Avalonia: <map this to the Avalonia control/panel/style here — e.g. a Border with
 * a ControlTheme keyed on the variant>. (Captures the porting hint that used to live
 * in the design-system.html "AvaloniaUI tip".)
 */
export function Widget({ variant = 'default', className, children, ...rest }: WidgetProps) {
  const classes = ['ds-widget', VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
```

Rules:

- **Variants are props, not class strings the caller writes.** A `Record<Variant, string>`
  map keeps the `.ds-` class names in one place.
- **Spread the native props** (`...rest`) and **merge `className`** so callers can extend.
- **Controlled + uncontrolled** where it makes sense (see `Slider.tsx` for the pattern):
  accept `value` + `onChange`, fall back to internal `useState`.
- **Accessibility**: forward/derive ARIA (`aria-label`, `aria-pressed`, `aria-checked`,
  `role`) so callers can pass labels; icon-only controls require a label.
- **Preserve the Avalonia mapping** in the component's JSDoc (and/or the story's docs
  description). This is the portability hint — keep it, since the token + component layer
  is what makes targets like Avalonia reachable.
- **Export from the barrel** — add to `web/src/components/index.ts`:
  ```ts
  export { Widget } from './Widget';
  export type { WidgetProps, WidgetVariant } from './Widget';
  ```

---

## Part 3: Storybook story in `web/src/components/<Name>.stories.tsx`

Storybook is the catalog: it must show **every variant and state**. Model it on
`Button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Widget } from './Widget';

const meta: Meta<typeof Widget> = {
  title: 'Components/Widget',
  component: Widget,
  args: { children: 'Widget' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'accent'] },
  },
};
export default meta;

type Story = StoryObj<typeof Widget>;

export const Default: Story = {};
export const Accent: Story = { args: { variant: 'accent' } };

// A controls-disabled overview showing all variants at once.
export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Widget>Default</Widget>
      <Widget variant="accent">Accent</Widget>
    </div>
  ),
};
```

Rules:

- **`title: 'Components/<Name>'`** (widgets go under `Widgets/`) — keeps the catalog nav
  organized, matching the existing stories.
- **One story per meaningful variant/state** + an **`AllVariants`** overview render with
  `controls: { disable: true }`.
- **`argTypes`** wire interactive controls for each prop (select/inline-radio/boolean).
- The preview canvas already renders on a dark `var(--bg-base)` background (the
  `.storybook/preview.tsx` decorator) — no need to set it per story. If the component is
  meant for light surfaces too, add a story toggling the theme.
- Optionally capture the **Avalonia mapping** in
  `meta.parameters.docs.description.component` so it surfaces in the Docs tab.

---

## Part 2B / 3B: Updating an existing component

Adding a variant/state to a component that already has a wrapper + story:

1. **CSS** — add the variant rule(s) next to the existing component in `components.css`.
2. **Wrapper** — extend the variant union type + the `VARIANT_CLASS` map (or add the new
   prop). Don't restructure the component.
3. **Story** — add a new per-variant story export and include it in the `AllVariants`
   render so the catalog stays complete.
4. **Barrel** — no change unless you added a new exported type.

Use targeted edits; don't rewrite the files from scratch.

---

## Part 4: Verification Checklist

From `web/`:

- [ ] CSS in `shared/components.css` with token usage + comment header; light-theme override if needed
- [ ] `:focus-visible` + WCAG AA contrast verified (both themes) for interactive components
- [ ] React wrapper in `web/src/components/<Name>.tsx`: props-driven, `VARIANT_CLASS` map,
      `className` merge, `...rest` spread, JSDoc with Avalonia mapping
- [ ] Exported from `web/src/components/index.ts` (component **and** prop types)
- [ ] Storybook story with one story per variant/state + an `AllVariants` overview
- [ ] `npm run build` passes (`tsc --noEmit` + `vite build` — a type error is a failure)
- [ ] `npm run build-storybook` passes; component renders correctly in `npm run storybook` (:6006)
- [ ] All variants visible and interactive in Storybook — no stubs/placeholders

A component is done only when the CSS, the wrapper, and the story all exist and build clean.

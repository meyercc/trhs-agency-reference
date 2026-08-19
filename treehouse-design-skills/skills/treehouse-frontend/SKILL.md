---
name: treehouse-frontend
description: >
  Use this skill to raise the craft and polish of Treehouse UI — when on-system work
  is correct but does not yet feel refined. Trigger on requests like "make this feel
  more polished", "this looks flat / cheap / unfinished", "improve the interaction
  design", "tighten the visual hierarchy", "add the missing states", "refine the
  motion", or any quality/review pass on an existing screen or component. This is the
  quality bar, not the build step: to build a new screen use the generate-layout
  skill; to add a new component use the ds-component skill. Load this skill once the
  structure exists and the question is whether it is genuinely well-crafted.
---

# Treehouse Frontend — Craft & Polish Skill

The Treehouse aesthetic is already decided: a dark, glassmorphic, accent-driven design
system. Your job is **not** to invent a look — it is to execute that look with the
precision of a senior product designer. Compliant is the floor. *Crafted* is the bar.

> The highest compliment a screen can earn is that no one can tell it was not always
> part of the app.

---

## What this skill is — and is not

This skill is the **quality pass**. It assumes the structure already exists and asks:
is it actually well made?

- Building a new screen or layout → use the **`generate-layout`** skill.
- Adding or documenting a new component → use the **`ds-component`** skill.
- Polishing, refining, reviewing, or fixing the *feel* of existing UI → **this skill**.

If you came here to build something from scratch, stop and use `generate-layout` first.

---

## The mindset: keep the craft, drop the novelty

Generic frontend advice optimizes for **divergent novelty** — bold new aesthetics,
distinctive fonts, unexpected layouts, "never converge." Treehouse optimizes for the
opposite: **convergent consistency**. Carry over the craft discipline; invert the
novelty.

| Generic frontend instinct | Treehouse craft |
|---|---|
| Invent a bold aesthetic direction | The aesthetic is fixed — the design system. Execute it. |
| Pick distinctive, unexpected fonts | Barlow / Barlow Condensed / JetBrains Mono, via `--font-*`. |
| Unexpected, grid-breaking layouts | The 6-column grid and existing page patterns. |
| Decorative effects: grain, custom cursors | Only the system's frosted-glass tint + shadow tokens. |
| Never converge — vary every output | *Deliberately* converge. Sameness is the goal. |
| Surprise the user | Meet the user's expectation flawlessly. |

**What carries over unchanged:** production-grade working code, meticulous detail,
considered motion, accessibility, matching implementation effort to intent, and
refusing to hand off something half-finished. Apply that rigor *inside* the system.

---

## The seven dimensions of craft

A pass is done when each of these holds. Read `shared/tokens.css` for exact token names.

### 1. State completeness
The single biggest "cheap prototype" tell is missing states. Every interactive element
needs **`:hover`, `:focus-visible`, `:active`, and disabled**. Every data region needs
**empty, loading, and error** states — not just the happy path. No dead-looking
controls, no blank containers.

### 2. Motion
Use the motion tokens — `--dur-instant/fast/normal/slow/xslow` and
`--ease-default/out/spring`. Match established app motion (modal open, panel slide,
toast) rather than inventing timings. Polish is *consistent, restrained* motion, not
flashy motion. Honor `prefers-reduced-motion`.

### 3. Visual hierarchy
Use the type scale deliberately: `--text-title` → `--text-nano`, with weight
(`--font-bold/medium/regular`) and text color (`--text`, `--text-dim`, `--text-muted`,
`--text-subtle`) doing real work. The eye should land on the primary thing first.
Never flatten everything to one size and weight.

### 4. Spacing rhythm & density
Consistent `--gutter` / `--gutter-sm` / `--gutter-xs`. Things align. Optical balance,
not just nominal equality. Treehouse UI is dense — but density needs rhythm, not
cramming. No orphaned margins, no accidental drift.

### 5. Surface & depth
Use the frosted-glass widget tint and the four shadow levels *semantically*:
`--shadow-lv-1` for subtle lift, up to `--shadow-lv-4` for modals. Borders via
`--border` / `--border-med`. No decorative effects outside the system.

### 6. Accent discipline
The accent system (`--accent-color` and its `color-mix` dims `--accent-dim/dimmer/
dimmest`) is the **one expressive knob**. Use it for emphasis and interaction, not
decoration. It re-themes the whole app at runtime — never hardcode an accent value.

### 7. Accessibility is craft, not a separate step
Visible `:focus-visible` ring on every interactive element. WCAG AA contrast on every
state. Full keyboard operability. Never signal state with color alone. A screen that
fails here is not "polished but inaccessible" — it is unpolished.

---

## Running a polish pass

1. **Open the target** in the React app — `cd web && npm run dev` (:5175) — and use it
   like a user would. For a single component, `npm run storybook` (:6006) and exercise
   every variant/state in isolation.
2. **Audit against the seven dimensions** above — list concrete defects, not vibes.
3. **Confirm token compliance first** — hardcoded values block everything else. Run the
   `token-audit` skill if anything looks off-system.
4. **Fix in priority order:** missing states → hierarchy → spacing/rhythm → motion →
   surface/depth → accent → final detail.
5. **Re-test** every state (hover, focus, active, disabled, empty, loading, error) and
   at tablet (≤1024px) and mobile (≤600px) widths. Console must be clean.
6. **Cleanup:** remove one-off classes a polish pass tends to spawn — fewer unique
   classes is a project goal. Reuse an existing class before adding one.

---

## Post-flight checklist

- [ ] Every interactive element: `:hover`, `:focus-visible`, `:active`, disabled
- [ ] Every data region: empty, loading, and error states present
- [ ] Type scale, weight, and text-color tokens used to build real hierarchy
- [ ] Spacing uses `--gutter*` tokens; elements align; rhythm is consistent
- [ ] Motion uses `--dur-*` / `--ease-*`; matches app conventions; respects reduced-motion
- [ ] Shadows used semantically; surfaces use the system tint; no off-system effects
- [ ] Accent used for emphasis only, never hardcoded
- [ ] WCAG AA contrast verified on all states; focus rings visible; keyboard works
- [ ] Zero hardcoded colors/sizes/spacing (verify with the `token-audit` skill)
- [ ] Tested on `npm run dev` (:5175) — console clean, responsive at tablet + mobile;
      component-level polish verified in Storybook (:6006)
- [ ] No new single-use classes left behind

If any item is unchecked, the pass is not done. Treat unfinished polish as a bug.

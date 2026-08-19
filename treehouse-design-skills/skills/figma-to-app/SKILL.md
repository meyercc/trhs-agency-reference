---
name: figma-to-app
description: >
  Use this skill FIRST whenever a task starts from a Figma reference — a figma.com URL,
  a frame/component selection, a design handoff, or "build this from Figma". It is the
  intake step: pull the Figma design, map its variables to our tokens and its frames to
  our existing components (via Storybook + Code Connect), decide reuse-vs-build for every
  element, then hand off to generate-layout (for a screen) or ds-component (for a new
  component). Trigger on "here's the Figma", "build this design", "match this frame",
  "implement this handoff", or any request that pairs a visual reference with "add it to
  the app". Load this before generate-layout/ds-component, not instead of them.
---

# Treehouse — Figma-to-App Skill (intake & reconciliation)

Almost every feature in this project starts the same way: **a Figma reference + "build
this."** This skill is that first move. Its job is **not** to reproduce Figma pixel-for-
pixel — it is to translate a Figma design into *our* design system so the result is
indistinguishable from a screen a designer hand-built in the app.

> The Figma file is a reference, not the source of truth. **Our tokens and components
> win.** When Figma and the design system disagree, the design system is right (or the
> disagreement is a real gap to escalate — never a license to hardcode).

This skill produces a **build plan**, then hands off:
- A screen / page / modal / multi-section view → the **`generate-layout`** skill.
- A genuinely new reusable primitive → the **`ds-component`** skill.
- A pure polish/craft pass on something already built → the **`treehouse-frontend`** skill.

---

## Prerequisites

- The **Figma MCP** must be connected (the `mcp__figma__*` tools). If it isn't, tell the
  user and stop — you cannot do intake from a screenshot alone with any rigor.
- Have the Figma **URL or an active selection**. A node-id in the URL (`?node-id=…`) lets
  you target one frame; without it you get the current selection.
- **Reading is enough for intake.** You only need the read tools below. You do *not* need
  the `figma-use` skill unless the user also wants you to *write back* to Figma.

---

## Step 0 — Pull the design (three complementary reads)

Run these against the target node. Each answers a different question — use all three:

| Tool | What it gives you | Use it for |
|---|---|---|
| `mcp__figma__get_screenshot` | The rendered pixels | **Intent** — what it should *feel* like. Never measure off this. |
| `mcp__figma__get_design_context` | Structure + code-ish description of the node | The layout skeleton, hierarchy, and any Code Connect it already resolves |
| `mcp__figma__get_variable_defs` | The Figma **variables** bound in this node | The token mapping (colors, spacing, radii, type) — your single most important read |
| `mcp__figma__get_metadata` | The layer tree (names, nesting) | Finding named layers that hint at component identity |

> Screenshots are for **intent**, not spec. Do not read hex values or pixel gaps off a
> screenshot and hardcode them — that is exactly the drift this project exists to kill.

---

## Step 1 — Map Figma variables → our tokens

`get_variable_defs` returns the variables the design uses. For each one, find the
matching token in **`shared/tokens.css`**. This is a mapping problem, not a copy problem.

1. **Read `shared/tokens.css`** — the authoritative token list. Never trust a value over
   this file.
2. **Match by role, then value.** A Figma variable named `bg/base` or valued `#0d0f13`
   maps to `var(--bg-base)`. Prefer matching the *semantic role* (background, accent,
   text-dim) over the raw hex — the token is the contract, the hex is incidental.
3. **Our Figma variables are kept in sync** — `npm run sync:tokens` (from the project
   root) regenerates token primitives from the Hadouken Figma variables. So a Figma
   variable *should* already have a token twin. If it does not, that's a signal (Step 3).
4. **A raw value with no variable behind it is a red flag.** If Figma used a loose
   `#3a86ff` instead of a bound variable, do **not** carry that hex into code. Snap it to
   the nearest token, or escalate it as an off-system value to fix in Figma.

Record the mapping as a small table (Figma variable → `var(--token)`) — you'll need it in
the handoff.

---

## Step 2 — Map Figma frames → our existing components

Before deciding anything is "new," prove it doesn't already exist. Search in this order —
stop at the first hit:

1. **Code Connect** — `mcp__figma__get_code_connect_map` (or `get_code_connect_suggestions`)
   tells you if the Figma node is already wired to a React component. Several primitives
   are mapped (`Toggle`, `Slider`, `Dropdown`, `Checkbox`, `DealTile`, `Radio`, `Swatch`,
   … — see the `web/src/components/*.figma.tsx` files). A Code Connect hit is the strongest
   possible answer: use that component, drive the mapped props from the Figma variant.
2. **Design-system search** — `mcp__figma__search_design_system` finds library components
   by name/description across the connected libraries.
3. **Storybook** — the living catalog. `cd web && npm run storybook` (:6006). Browse
   `Components/` and `Widgets/` for something that matches the frame by *role*, not just
   looks. This is the React-era replacement for `design-system.html`.
4. **The live API** — `web/src/components/index.ts` + `web/src/widgets/index.ts` list every
   exported component/widget and its prop types. This is your palette.

> A Figma frame that *looks* custom is usually an existing component in a variant you
> haven't seen. A `Card` with an image is still `<Card>`. A pill with a count is still
> `<Badge>`. Match by role; reach for a variant prop before you reach for a new component.

---

## Step 3 — Reconcile: reuse vs. build

Walk every element in the frame and classify it. This is the deliverable of this skill.

- **Exists as a component/widget** → use it as-is, variant driven by **props**. Note which
  export and which variant.
- **Maps to a token** → use `var(--token)`. Note the mapping.
- **Off-system value** (a color/space/size in Figma with no token twin) → **do not
  hardcode.** Choose one and say which:
  - snap to the nearest existing token (default — keeps the system intact), or
  - if it's clearly a legitimate new system value (appears repeatedly, names a real
    concept), propose adding it to `shared/tokens.css` first.
- **Genuinely new component** (no component, no close variant) → flag it. It must be built
  via the **`ds-component`** skill *before* the layout that uses it — never inlined ad hoc.

If anything is ambiguous — a frame that half-matches a component, a variable with no clean
token — **ask the user before building.** Guessing is how drift enters.

---

## Step 4 — Hand off to the build skill

Intake is done when you have a written plan:

```
FIGMA INTAKE — <feature name>
Source: <figma url / node-id>

Token mapping:
  bg/base       → var(--bg-base)
  accent/primary→ var(--accent-color)
  space/16      → var(--gutter)
  … (off-system: <none | listed with resolution>)

Components:
  Header row    → <SectionHeader>            (existing)
  Toggle        → <Toggle checked>           (existing, Code Connect)
  Stat pill     → <Badge variant="…">        (existing)
  Sparkline     → NEW → build via ds-component first
Layout:
  Closest existing page: web/src/pages/<X>.tsx  (copy its skeleton)
```

Then continue:
- **Screen / layout / modal** → **`generate-layout`** skill, using this plan as its Step-1
  brief. Its token-discipline and wire-into-the-app steps take over from here.
- **New component(s)** first → **`ds-component`** skill for each, then return to the layout.

---

## Guardrails (the whole reason this skill exists)

- **Never carry raw Figma pixels/hex into code.** Every visual value resolves to a token
  or it's a bug. This is non-negotiable and is verified later by the `token-audit` skill.
- **Reuse beats reproduction.** Fewer bespoke components is a project goal. An 80% match to
  an existing component + a variant prop beats a pixel-perfect new one.
- **The Figma file can be wrong.** It may lag the system, use loose values, or predate a
  token rename. Treat mismatches as gaps to reconcile, not instructions to follow.
- **Screenshots ≠ spec.** Use them for intent and layout reading only; measurements come
  from variables and our tokens.

---

## Post-flight checklist

- [ ] Pulled the node with `get_screenshot` + `get_design_context` + `get_variable_defs`
- [ ] Every Figma variable mapped to a `var(--token)` (verified against `shared/tokens.css`)
- [ ] Off-system values resolved (snapped to a token or escalated) — none carried as raw hex/px
- [ ] Every frame checked against Code Connect → design-system search → Storybook → the
      component/widget API before being called "new"
- [ ] Written build plan (token map + component map + closest page) produced
- [ ] Handed off to `generate-layout` (screen) and/or `ds-component` (new primitives)
- [ ] Ambiguities raised with the user rather than guessed

If a value can't be traced to a token or a frame to a component, resolve it before building.

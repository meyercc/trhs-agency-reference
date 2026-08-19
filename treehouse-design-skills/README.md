# Treehouse Design-System Skills

A shareable bundle of Claude Code / Claude Agent **skills** that encode how we build the
Treehouse React app on-system: take a design (usually a Figma reference), reconcile it
against our design system, build it from existing tokens and components, and keep the
Storybook catalog current.

The goal these skills serve: **close the gap between design handoff and AI UI generation.**
A screen an agent generates with these skills should be indistinguishable from one a
designer hand-built in the system.

---

## The loop these skills encode

```
   ┌─ idea + Figma reference ─┐
   │                          ▼
   │                   1. figma-to-app        ← pull the design; map variables→tokens,
   │                          │                  frames→existing components (Storybook +
   │                          │                  Code Connect); produce a build plan
   │              ┌───────────┴───────────┐
   │              ▼                        ▼
   │      2a. generate-layout      2b. ds-component      ← build a screen  /  build a new
   │          (a page/view)            (a new primitive)    reusable component + Storybook
   │              │                        │                 story
   │              └───────────┬────────────┘
   │                          ▼
   │                 3. treehouse-frontend    ← craft/polish pass: states, motion,
   │                          │                  hierarchy, accent discipline
   │                          ▼
   │                 4. token-audit           ← verify zero hardcoded values (CSS + TSX)
   │                          ▼
   └──────────────── 5. session-handoff       ← write HANDOFF.md so the next session
                                                 (or teammate) picks up cleanly
```

Not every task runs the whole loop — but this is the spine.

---

## Which skill fires when

| You're doing this | Load this skill |
|---|---|
| Starting from a **Figma URL / frame / handoff** | **`figma-to-app`** (first — it feeds the next two) |
| Building a **new screen, page, view, modal, dashboard** | **`generate-layout`** |
| Adding a **new reusable component** (or a variant) | **`ds-component`** |
| Making existing UI **feel more polished / finished** | **`treehouse-frontend`** |
| Checking for **hardcoded values / token compliance** | **`token-audit`** |
| **Wrapping up** a session / picking one up | **`session-handoff`** |

Descriptions in each skill's frontmatter let the agent auto-select — but knowing the map
helps you steer.

The two non-negotiables every build skill enforces:
1. **Compose from existing components/widgets** — reuse before you reinvent. Check
   Storybook (the living catalog) before building anything new.
2. **Every visual value is a token** from `shared/tokens.css` — never a raw hex/px, in CSS
   *or* React inline styles.

---

## Install

These are standard Claude Code skills. Drop them where your agent looks for skills:

```bash
# from your project root (the folder that contains web/ and shared/)
mkdir -p .claude/skills
cp -R /path/to/treehouse-design-skills/skills/* .claude/skills/
```

Or clone this bundle and symlink it. Once the folders are under `.claude/skills/`, the
agent discovers them automatically — invoke with `/figma-to-app`, `/generate-layout`, etc.,
or just describe the task and let the agent pick.

> **Placement matters for `token-audit`.** Its `scripts/audit-compliance.mjs` resolves the
> project root as four levels up from the script, i.e. it expects to live at
> `<project-root>/.claude/skills/token-audit/scripts/…` and find `shared/tokens.css` at the
> project root. Keep the `.claude/skills/` layout and it just works.

---

## What each skill assumes about your project

These were written for the Treehouse app and assume this structure at the project root:

```
shared/tokens.css        # the token contract (colors, spacing, type, motion)
shared/components.css    # canonical .ds- component styles (the visual source of truth)
web/                     # the React app (Vite)
  src/components/        # React wrappers + *.stories.tsx (the Storybook catalog)
  src/widgets/           # composed widgets
  src/pages/             # page components
```

Key commands the skills reference (run from `web/`):
- `npm run dev` — the app on **:5175**
- `npm run storybook` — the component catalog on **:6006**
- `npm run build` — `tsc --noEmit && vite build` (a type error is a failure)

For **`figma-to-app`** you also need the **Figma MCP** connected (the `mcp__figma__*`
tools) and Code Connect set up (`web/src/components/*.figma.tsx`).

If your project differs, adjust the paths/commands in each `SKILL.md` — they're plain
Markdown.

---

## Notes

- **The vanilla era is retired.** `prototype.html`, `prototype.css`, and
  `design-system.html` are no longer used; the skills point exclusively at the React app
  and Storybook. If you have those files, the skills tell the agent to ignore them.
- **`token-audit/scripts/audit-compliance.mjs`** is a real Node script — no dependencies
  beyond Node itself.
- **`evals/`** folders (in `ds-component` and `token-audit`) are optional test fixtures
  that describe expected skill behavior. They're bonus material, not required to run the
  skills.
- Each skill ends with a **post-flight checklist** — the definition of done. That's the
  quality bar to hold the agent (and yourself) to.

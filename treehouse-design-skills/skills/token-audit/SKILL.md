---
name: token-audit
description: >
  Audit the Treehouse codebase for design-token compliance. Use this skill whenever you
  need to: check whether CSS or React uses hardcoded values instead of tokens from
  shared/tokens.css, find tokens that are defined but never used, or verify token
  consistency before calling work done. Trigger on phrases like "audit tokens", "check
  for hardcoded values", "token compliance", "are we using tokens consistently", "clean
  up CSS", or any task where you're reviewing or writing CSS/TSX and want to confirm it
  follows the design system. Also trigger proactively after writing or modifying any CSS
  or inline style — run the audit as a verification step.
---

# Token Compliance Audit (React era)

The tokens in `shared/tokens.css` are the **contract** between the design system and any
code that consumes it — CSS, React inline styles, and future targets like Avalonia. A
hardcoded value breaks that contract and is the single most common way an AI-generated
layout drifts off-system. This skill finds those breaks.

It checks two things:

1. **Hardcoded values** — a raw hex, px, font family, shadow, or timing that should be a
   `var(--token)`. In two places:
   - **CSS** — `shared/components.css` and any other project `.css` (scanned by the script).
   - **React inline styles** — `style={{ … }}` in `web/src/**/*.tsx` (grep — the script
     does not read `.tsx`; see "The React gap" below).
2. **Unused tokens** — tokens defined in `tokens.css` but referenced nowhere (cleanup
   candidates).

> **Scope note.** The vanilla `prototype.html`, `prototype.css`, and `design-system.html`
> are **retired**. Ignore violations the scanner reports inside them — don't "fix" retired
> files. The living surfaces are `shared/*.css` and `web/` (React + Storybook). The old
> `npm run audit:tokens` doc-drift check compared tokens to `design-system.html` and is
> **dead** — do not run it.

## When to run this

- After writing or modifying any CSS in `shared/`, or any `style={{ … }}` in `web/`.
- Before declaring a component or layout "done" (a verification step in the
  `ds-component`, `generate-layout`, and `treehouse-frontend` skills).
- Periodically as a health check on the design system.

## How to run

### CSS compliance scan (hardcoded values + unused tokens)

From the **project root** (`trhs/`):

```bash
node .claude/skills/token-audit/scripts/audit-compliance.mjs --fix-hints
```

`--fix-hints` appends the suggested `→ var(--token-name)` for each hardcoded value.

**Scope the scan to what's live** — the whole-tree walk includes retired vanilla files.
When you're checking your own change, target the file you touched:

```bash
node .claude/skills/token-audit/scripts/audit-compliance.mjs --file shared/components.css --fix-hints
```

Useful flags:
- `--fix-hints` — suggest the token each hardcoded value should use
- `--file <path>` — scan a single file (use this to check just your change)
- `--json` — structured output for programmatic processing

### The React gap — `.tsx` inline styles (do this too)

The script scans `.css/.html/.js`, **not `.tsx`**. In the React app, hardcoded values hide
in `style={{ … }}`. Grep for them in the files you changed:

```bash
# hardcoded hex / rgb / px in inline styles under web/src
grep -rnE "style=\{\{[^}]*(#[0-9a-fA-F]{3,8}|rgba?\(|[0-9]+px)" web/src --include="*.tsx"
```

Every hit is a candidate. Convert `style={{ padding: 16 }}` → `style={{ padding: 'var(--gutter)' }}`,
`background: '#0d0f13'` → `'var(--bg-base)'`, etc. Prefer a **class** (from `shell.css` or a
component) over an inline style whenever one already exists.

## Interpreting results

**Categories:** `color`, `color-rgba`, `spacing`, `border-radius`, `font-size`,
`font-family`, `shadow`, `transition-duration`.

**Not every violation is a bug** — use judgment:

- `tokens.css` itself is excluded (that's where tokens are defined).
- Custom-property *definitions* (`--my-prop: 16px`) are excluded — those *are* tokens.
- `1px` / `2px` are allowlisted (too granular to tokenize).
- **Retired vanilla files** (`prototype*.css`, `design-system.html`) — ignore entirely.
- **Unused tokens** — a token referenced nowhere in `shared/`, `web/`, or JS
  (`getComputedStyle`/`setProperty`) is a removal candidate — but confirm it isn't used
  dynamically before deleting.

Rule of thumb: **if the value exists in `tokens.css`, use the token.** If you need a value
that *should* be a token but isn't, propose adding it to `tokens.css` rather than
hardcoding — especially if it appears 3+ times or names a real concept.

## Fixing violations

1. **Find the matching token** — `--fix-hints` does this for CSS; match by role for TSX.
2. **Replace the raw value with `var(--token-name)`.**
3. **If nothing matches**, decide whether it should become a new token (add to
   `tokens.css`) or snap to the nearest existing one.
4. **Re-run** the scan (and the `.tsx` grep) to confirm it's resolved.

### Quick reference: common substitutions

| Raw value | Token |
|-----------|-------|
| `#0d0f13` | `var(--bg-base)` |
| `#11141a` | `var(--bg-mid)` |
| `#161921` | `var(--bg-elevated)` |
| `#e4e8f0` | `var(--text-primary)` |
| `#00c8d7` | `var(--cyan)` or `var(--accent-color)` |
| `#ff6b2b` | `var(--orange)` |
| `#22c55e` | `var(--green)` |
| `#ef4444` | `var(--red)` |
| `16px` (spacing) | `var(--gutter)` |
| `8px` (spacing) | `var(--gutter-sm)` |
| `4px` (spacing) | `var(--gutter-xs)` |
| `16px` (radius) | `var(--radius-card)` |
| `8px` (radius) | `var(--radius)` |
| `4px` (radius) | `var(--radius-sm)` |
| `13px` (font-size) | `var(--text-body)` |
| `11px` (font-size) | `var(--text-caption)` |
| `10px` (font-size) | `var(--text-micro)` |

> Confirm exact token names against `shared/tokens.css` — this table is a quick reference,
> not the source of truth.

### Keeping it clean going forward

The goal isn't zero violations — some edge cases are fine. The goal is that every
*semantic* value (a color that means something, a spacing rhythm, a type size from the
scale) goes through the token system, in **both** CSS and React inline styles. That's what
makes AI-generated layouts reliable: the tokens are the contract; hardcoded values break it.

---
name: session-handoff
description: >
  Use this skill at the end of a work session, when context is running low or about to
  compact, when switching between major tasks, or when the user asks for a "handoff",
  "wrap up", "session summary", or "where did we leave off". Also load it at the START
  of a session to read the existing handoff and pick up cleanly. It defines the single
  canonical handoff format so every session ends — and begins — the same way.
---

# Treehouse — Session Handoff Skill

A handoff is how one work session passes context to the next — yours, a teammate's, or
a fresh Claude after compaction. Treehouse keeps **one canonical file: `HANDOFF.md`**
at the repo root. It is a living document, newest session on top.

---

## Start of session
Read the top (most recent) section of `HANDOFF.md` — the latest session and its open
"Remaining work" — to see where things stand. Do this before starting work.

## End of session — or when context is about to compact
Prepend a new session section to `HANDOFF.md`. Do not wait until you are out of room.
If design-system components changed this session, consider also cutting a changelog
entry for devs — load the `ds-changelog` skill.

---

## The format

`HANDOFF.md` has two parts: a **session log** (grows, newest first) and a **stable
reference** block (written once, kept at the bottom — never duplicated per session).

### Each new session section

```markdown
## Treehouse Session Handoff — <absolute date> (Session <n>)

### <TH-###> — <Title> (<status>)
- **What changed:** 1-3 sentences.
- **Files created:** path — one-line purpose.
- **Files modified:** path (~line) — what changed.
- **Bugs fixed:** symptom → root cause → fix.

### Remaining work
- Concrete next steps, blocked items, things still to verify.
```

### Rules
- **Absolute dates** ("May 20, 2026") — never "today" or "yesterday".
- Reference every task by its **`TH-###`**.
- Note modified files with **approximate line numbers** — future sessions search by them.
- For every bug, record the **root cause**, not just the fix, so it is not re-hit.
- Newest session goes **on top**.

### Stable reference (keep once, at the bottom)
Architecture reminders, the services/ports table, and known gotchas live in
a single reference block at the end of `HANDOFF.md`. Maintain it when something
changes — do not restate it inside each session section.

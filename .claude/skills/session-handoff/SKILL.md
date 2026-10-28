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
a fresh Claude after compaction. Treehouse keeps **one live file, `HANDOFF.md`, holding
the newest five sessions**, and a rotated archive in `docs/handoff-archive/`. Newest
session on top. The live file exists to be read whole by the next session; the archive
exists to be grepped and nothing else.

---

## Start of session
Read the top (most recent) section of `HANDOFF.md` — the latest session and its open
"Remaining work" — to see where things stand. Do this before starting work. Gotchas are
in `docs/gotchas.md`, not here; older sessions are in `docs/handoff-archive/`, which you
grep rather than read.

## End of session — or when context is about to compact

**1. Prepend** a new session section to `HANDOFF.md`. Do not wait until you are out of room.

**2. Rotate — every time, not when someone notices.** While
`grep -c '^## Treehouse Session Handoff' HANDOFF.md` is above **5**, or `wc -c` is above
**60000**, cut the OLDEST section out and prepend it to
`docs/handoff-archive/<YYYY>-Q<n>.md` for the quarter of *that section's own* date.
Create the quarter file if it does not exist and add a row to the archive's `README.md`.
Move it **verbatim, byte for byte** — never summarize, never re-wrap, never change a
heading level. The archive's whole value is that it is the original text, and
`git blame -C -C` can only follow a block that stays byte-identical.

Skipping this step is how the file reached 586KB and 65 sessions before it had to be
split by hand on September 29, 2026.

**3. Size your own section as you write it.** Over ~20KB is too long — the largest in six
months is 22.7KB and it is an outlier. Cut the narration, keep the root cause.

**4.** If design-system components changed this session, consider also cutting a changelog
entry for devs — load the `ds-changelog` skill.

---

## The format

`HANDOFF.md` is one thing: a **session log**, newest first, five sessions deep. It has no
reference block, no gotchas and no architecture notes — those live in `docs/gotchas.md`,
`CLAUDE.md`, `README.md` and `.claude/agents/verify-runner.md`, and the file's own
preamble points at them.

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

### Task numbering
`TH-###` is **self-owned in `HANDOFF.md`** — there is no external tracker to reconcile
with (Notion was retired September 2, 2026). To start a task, take the highest number in
the newest session section and continue from it. Numbers already used in changelog
entries are final.

### Where durable knowledge goes — not here
A fact that will still be true in six months does not belong in a session section, which
ages out to the archive. Put it where someone will find it: a gotcha in `docs/gotchas.md`,
a rule in `CLAUDE.md`, a suite-running fact in `.claude/agents/verify-runner.md`, a
command or remote in `README.md`. **Never write an inventory** — a count or a roster of
what exists on disk. Say how to discover it instead; a list rots the moment the disk
changes, which is exactly how the old reference block came to claim 19 verification
suites when there were 38.

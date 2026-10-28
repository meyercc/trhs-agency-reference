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

### Rotate, so the file cannot grow without bound
A handoff that only ever grows stops being readable. After prepending your section,
**rotate every time** — while the file holds more than **5** sessions, or exceeds
**60,000 bytes**, move its oldest section into an archive file for that section's own
quarter (`handoff-archive/<YYYY>-Q<n>.md`), newest first.

Move sections **verbatim, byte for byte** — never summarize, never re-wrap. The archive's
value is the original text with the root causes still in it, and `git blame` can only
follow a block that stays byte-identical. Make sure your formatter ignores these files;
one `prettier --write` over them throws that attribution away.

Rotate as a step of writing the handoff, not when someone notices. The project this
format came from let it slide and reached 586KB and 65 sessions before it had to be
split by hand.

### Durable knowledge does not go in a session section
A fact that will still be true in six months will age out to the archive with the
session that recorded it. Put it where it will be found instead — a gotchas file, your
operating contract, your README. **Never write an inventory**: a count or a roster of
what exists on disk rots the moment the disk changes. Say how to discover it.

// Measure the REAL local model against Nova's `widget` schema (TH-452).
//
// Everything Nova knows about granite4.2:8b was measured by hand in scratchpad
// scripts that were never committed, so the one open question after TH-450 —
// "how does the widened vocabulary behave?" — had nothing in-repo to answer it.
// This is that tool. It loads the real schema builder (`src/nova/widgetSpec.ts`,
// stripped of types by esbuild the way verify-profiles.mjs does), builds the
// exact request the app would send for each of a fixed set of sentences, times
// Ollama answering it, and scores the answers the way the app's validator would.
//
// It decides two things the plan refuses to guess:
//   RETRIEVE_N — the largest candidate count at which p50 ≤ 8s and p95 ≤ 15s;
//   the schema variant — `composite` (one `bind:form` enum) vs `parallel`
//   (ids + a forms array), whichever is valid and faster.
// And it reports whether the model USES the form freedom and whether it changes
// anything on a sentence the regex already read in full — the two numbers that
// decide whether `as` stays in the schema and whether composing-always is worth
// paying for.
//
// Run from web/ with Ollama up (`npm run ollama` from the repo root):
//   node scripts/measure-nova.mjs            # the full grid (~25 min)
//   node scripts/measure-nova.mjs --quick    # 8 sentences × 2 sizes, one pass (~2 min)
//   N=8,16 VARIANTS=composite REPEATS=1 node scripts/measure-nova.mjs
//   KIND=form N=32 node scripts/measure-nova.mjs   # one sentence kind, after a prompt change aimed at it
// Writes a table to stdout and the raw rows to scripts/out/measure-nova-<date>.json.
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENDPOINT = process.env.ENDPOINT || 'http://localhost:11434/v1/chat/completions';
const MODEL = process.env.MODEL || 'granite4.2:8b';
const quick = process.argv.includes('--quick');
const NS = (process.env.N || (quick ? '8,24' : '8,16,24,32')).split(',').map(Number);
const VARIANTS = (process.env.VARIANTS || (quick ? 'composite' : 'composite,parallel')).split(',');
const REPEATS = Number(process.env.REPEATS || (quick ? 1 : 2));
const TIMEOUT_MS = 60_000;

// ── Load the real builder ─────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'trhs-measure-'));
const outfile = join(dir, 'widgetSpec.mjs');
await build({ entryPoints: ['src/nova/widgetSpec.ts'], outfile, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
const W = await import(outfile);
rmSync(dir, { recursive: true, force: true });
const { retrieveBindings, widgetSchema, WIDGET_SYSTEM, proposalToBoundItems, cleanNote, cleanTitle, hitsIn, splitPair } = W;

// The full desk, every module: the widest enum this install can produce.
const GATE = { deviceTypes: ['monitor', 'headset', 'mouse', 'keyboard', 'microphone'], has: () => true };

// ── The sentence set ──────────────────────────────────────────────────────────
// Five kinds, because the go/no-go gates ask five different questions.
const SENTENCES = [
  // fully read by the regex — does the model change anything?
  { kind: 'full', text: 'make me a widget with cpu temp and fps' },
  { kind: 'full', text: 'a widget with my headset volume and mic monitoring' },
  { kind: 'full', text: 'a card with gpu temp, cpu temp and ram' },
  { kind: 'full', text: 'a widget showing my download and upload speed' },
  { kind: 'full', text: 'a widget with my mouse polling rate and lift-off distance' },
  { kind: 'full', text: 'build me a widget with my mic gain and monitor mix' },
  // half read — the regex found some of it
  { kind: 'half', text: 'a widget showing my discord and my fps' },
  { kind: 'half', text: 'a widget with my headset volume and the spotify now playing' },
  { kind: 'half', text: 'make a card with cpu temp and my steam friends online' },
  { kind: 'half', text: 'a widget for my mouse dpi and my webcam status' },
  { kind: 'half', text: 'a card with gpu load and my room temperature' },
  { kind: 'half', text: 'a widget with fps and the time of day' },
  // guesses — nothing named
  { kind: 'guess', text: 'build me a widget' },
  { kind: 'guess', text: 'make me something useful for streaming' },
  { kind: 'guess', text: 'a widget for when I am gaming late at night' },
  { kind: 'guess', text: 'give me a card for my desk' },
  // things nothing here can show
  { kind: 'unavailable', text: 'a widget with my spotify queue' },
  { kind: 'unavailable', text: 'a stock ticker widget' },
  { kind: 'unavailable', text: 'a widget showing the weather and my calendar' },
  { kind: 'unavailable', text: 'a discord voice channel widget' },
  // asking for a FORM that is NOT the default — does the model use the freedom?
  // (In Phase A the only non-default forms are a writable value shown as a plain
  // tile instead of a slider, and a level meter (vu) instead of a plain slider.)
  { kind: 'form', text: 'my headset volume as a plain number tile, not a slider' },
  { kind: 'form', text: 'show mic gain as a level meter with marks' },
  { kind: 'form', text: 'a widget with my keyboard brightness as a read-only tile' },
  { kind: 'form', text: 'headphone volume and monitor mix, both as tiles I can read at a glance' },
];
// KIND=form (or half, full, guess, unavailable) re-measures one kind only — for a prompt change aimed at it.
const set = process.env.KIND ? SENTENCES.filter((s) => s.kind === process.env.KIND) : quick ? SENTENCES.filter((_, i) => i % 3 === 0) : SENTENCES;

// ── One call, the way the app makes it ────────────────────────────────────────
async function ask(system, text, schema) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
        stream: false,
        temperature: 0,
        keep_alive: '30m',
        max_tokens: 400,
        reasoning_effort: 'none',
        response_format: { type: 'json_schema', json_schema: { name: 'widget', strict: true, schema } },
      }),
      signal: ac.signal,
    });
    const seconds = (Date.now() - started) / 1000;
    if (!res.ok) return { seconds, error: `http ${res.status}` };
    const body = await res.json();
    const choice = body?.choices?.[0];
    const content = choice?.message?.content ?? '';
    let value = null;
    try { value = JSON.parse(content); } catch { /* scored as invalid */ }
    return { seconds, finish: choice?.finish_reason, value, usage: body.usage, raw: content.slice(0, 200) };
  } catch (e) {
    return { seconds: (Date.now() - started) / 1000, error: ac.signal.aborted ? 'timeout' : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// The app's `cleanUnavailable` rules (specs.ts), reproduced: short, not a phrase, not the request.
// An EMPTY entry is not a rejection: it is the model saying "nothing" badly,
// and the app's guard drops it without a trace. Counting it read as a 75%
// rejection rate on the form sentences (2026-10-06, TH-454) when every one was
// `[""]` — the metric was measuring the model's punctuation, not its judgment.
const unavailableRejected = (raw, asked) => {
  const a = asked.toLowerCase();
  return (Array.isArray(raw) ? raw : []).filter((u) => {
    if (typeof u !== 'string') return true;
    const k = u.trim().toLowerCase();
    return k.length > 0 && (k.length > 28 || (a.includes(k) ? k.length > a.length / 2 : k.includes(a)));
  }).length;
};

// ── Score one answer ──────────────────────────────────────────────────────────
function score(s, candidates, r) {
  const seed = hitsIn(s.text, GATE).map((b) => b.id);
  const row = { kind: s.kind, text: s.text, n: candidates.length, seconds: +r.seconds.toFixed(2), finish: r.finish ?? r.error ?? '?', valid: !!r.value, items: 0, dupes: 0, formsChosen: 0, seedRecall: null, unavailRejected: 0, noteRejected: false, titleRejected: false, changed: null, promptTokens: r.usage?.prompt_tokens ?? null, completionTokens: r.usage?.completion_tokens ?? null };
  if (!r.value) return row;
  const p = r.value;
  const rawBinds = (p.items ?? []).map((x) => splitPair(x).bind);
  row.dupes = rawBinds.length - new Set(rawBinds).size;
  const items = proposalToBoundItems(p, candidates, () => null);
  row.items = items.length;
  row.formsChosen = items.filter((it) => it.as).length;
  const binds = new Set(items.map((it) => it.bind));
  row.seedRecall = seed.length ? seed.filter((id) => binds.has(id)).length / seed.length : null;
  row.unavailRejected = unavailableRejected(p.unavailable, s.text);
  row.unavailCount = Array.isArray(p.unavailable) ? p.unavailable.length : 0;
  row.noteRejected = cleanNote(p.note, s.text) === undefined;
  row.titleRejected = cleanTitle(p.title) === undefined;
  if (s.kind === 'full') row.changed = row.formsChosen > 0 || binds.size !== seed.length || seed.some((id) => !binds.has(id));
  row.sample = { title: p.title, items: p.items, forms: p.forms, note: p.note, unavailable: p.unavailable };
  return row;
}

const pct = (xs) => (xs.length ? Math.round((100 * xs.filter(Boolean).length) / xs.length) : NaN);
const q = (xs, f) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(f * a.length))] : NaN; };

// ── Run ───────────────────────────────────────────────────────────────────────
console.log(`model ${MODEL} · ${set.length} sentences · N ∈ {${NS.join(',')}} · variants ${VARIANTS.join('/')} · ${REPEATS} pass(es)`);
{
  const warm = await ask('Answer in JSON.', 'warm up', { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] });
  console.log(`warm-up ${warm.seconds}s (${warm.finish ?? warm.error}) — excluded\n`);
}
const rows = [];
for (const variant of VARIANTS) {
  for (const n of NS) {
    for (let pass = 0; pass < REPEATS; pass++) {
      for (const s of set) {
        const candidates = retrieveBindings(s.text, GATE, n);
        const spec = widgetSchema(candidates, 'card', variant);
        const system = `${WIDGET_SYSTEM}\n\nThe vocabulary available right now:\n${spec.catalog}`;
        const r = await ask(system, s.text, spec.schema);
        const row = { variant, pass, nRequested: n, ...score(s, candidates, r) };
        rows.push(row);
        process.stdout.write(`  ${variant.padEnd(9)} N=${String(n).padStart(2)} ${s.kind.padEnd(11)} ${row.seconds.toFixed(1).padStart(5)}s ${row.finish.padEnd(7)} items=${row.items} forms=${row.formsChosen}${row.dupes ? ` dupes=${row.dupes}` : ''}${row.noteRejected ? ' note✗' : ''}  ${s.text.slice(0, 48)}\n`);
      }
    }
  }
}

// ── Aggregate ─────────────────────────────────────────────────────────────────
console.log('\nvariant    N   p50s  p95s  valid  ≥1item  dupe%  forms%(form)  seed%  unav✗%  note✗%  changed%(full)  ptok  ctok');
const summary = [];
for (const variant of VARIANTS) for (const n of NS) {
  const R = rows.filter((r) => r.variant === variant && r.nRequested === n);
  const forms = R.filter((r) => r.kind === 'form' && r.valid);
  const full = R.filter((r) => r.kind === 'full' && r.valid);
  const valid = R.filter((r) => r.valid);
  const withSeed = valid.filter((r) => r.seedRecall != null);
  const s = {
    variant, n,
    p50: q(R.map((r) => r.seconds), 0.5), p95: q(R.map((r) => r.seconds), 0.95),
    valid: pct(R.map((r) => r.valid && r.finish === 'stop')),
    atLeastOne: pct(R.map((r) => r.items >= 1)),
    dupe: pct(valid.map((r) => r.dupes > 0)),
    forms: pct(forms.map((r) => r.formsChosen > 0)),
    seed: Math.round((100 * withSeed.reduce((a, r) => a + r.seedRecall, 0)) / Math.max(1, withSeed.length)),
    unav: pct(valid.map((r) => r.unavailRejected > 0)),
    note: pct(valid.map((r) => r.noteRejected)),
    changed: pct(full.map((r) => r.changed)),
    ptok: Math.round(valid.reduce((a, r) => a + (r.promptTokens ?? 0), 0) / Math.max(1, valid.length)),
    ctok: Math.round(valid.reduce((a, r) => a + (r.completionTokens ?? 0), 0) / Math.max(1, valid.length)),
  };
  summary.push(s);
  console.log(`${variant.padEnd(9)} ${String(n).padStart(3)}  ${s.p50.toFixed(1).padStart(5)} ${s.p95.toFixed(1).padStart(5)}  ${String(s.valid).padStart(4)}%  ${String(s.atLeastOne).padStart(5)}%  ${String(s.dupe).padStart(4)}%  ${String(s.forms).padStart(11)}%  ${String(s.seed).padStart(4)}%  ${String(s.unav).padStart(5)}%  ${String(s.note).padStart(5)}%  ${String(s.changed).padStart(13)}%  ${String(s.ptok).padStart(4)}  ${String(s.ctok).padStart(4)}`);
}
console.log('\ngates: p50 ≤ 8s and p95 ≤ 15s · valid ≥ 95% · ≥1 item ≥ 90% · forms ≥ 50% on form sentences · unav✗ ≤ 10% · note✗ ≤ 15% · changed ≥ 20% on fully-read sentences');

mkdirSync('scripts/out', { recursive: true });
const file = `scripts/out/measure-nova-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify({ model: MODEL, endpoint: ENDPOINT, at: new Date().toISOString(), ns: NS, variants: VARIANTS, repeats: REPEATS, summary, rows }, null, 1));
console.log(`\nraw rows → ${file}`);

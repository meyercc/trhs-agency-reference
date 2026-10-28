// CDP check for Forge (`?modal=agents`), the store that replaced the Agent
// Catalog on 2026-10-19 (TH-479). Supersedes verify-agent-catalog.mjs.
//
// What is protected, in order of how expensive it would be to lose:
//  1. THE OLD LINKS. Every agent from `agents/registry.ts` is a Forge listing
//     under its OWN id, so `?agent=<id>` and Nova's agentIds still resolve —
//     the concept listed most agents under short ids (framedoc, thermal…), and
//     a merge that kept those would break every saved link silently.
//  2. ONE ROW, ONE HEIGHT. Cards in a grid row share a height and their stats
//     rows sit on one line (CLAUDE.md). Measured, not assumed.
//  3. NOTHING NESTED. The card's name is its one link (stretched over the
//     card); every other control is a sibling button, never inside it.
//  4. ADDING STICKS. Add → Adding… → Added, persisted under `trhs-agents` (the
//     catalog's key, so earlier adds survive), with an install receipt; the nav
//     foot follows; on the listing's page votes unlock only once added, like
//     and save persist, and a rating posts and persists. The CARD carries no
//     vote/like/save and no "Official" badge (Chris 2026-10-19).
//  5. THE STARS ARE TRUE. A 3.9 fills less than five stars wherever it is drawn
//     — the aside's grid once stretched .ds-rating and filled all five.
//  6. BROWSING. Legacy `?cat=` values land on a Forge category, search narrows,
//     a type chip filters, an unreleased listing offers Notify me.
//  7. THE MODULE BROWSER IS UNHARMED, and no page errors.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. It writes `trhs-agents` / `trhs-forge` and clears them at the end.
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());

let msgId = 0;
function makeSend(ws) {
  const pending = new Map();
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

const targets = await httpJson('/json/list');
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error(`no page target on CDP ${CDP_PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
const send = makeSend(ws);
await send('Page.enable');
await send('Runtime.enable');

const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text);
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const ev = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

// A hash-only change does not remount and `Page.reload` after one races the
// router (gotcha 33), so every step forces a real document load.
let nav = 0;
const go = async (hash, width = 1440) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Page.loadEventFired') {
        ws.off('message', onMsg);
        resolve();
      }
    };
    ws.on('message', onMsg);
  });
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?n=${++nav}#${hash}` });
  await loaded;
  await sleep(1600);
};

// Every registry agent, read from the registry (a hand list here had missed
// the refund agent, TH-484).
const regTmp = mkdtempSync(join(tmpdir(), 'trhs-forge-'));
await build({ entryPoints: [fileURLToPath(new URL('../src/agents/registry.ts', import.meta.url))], outfile: join(regTmp, 'registry.mjs'), format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
const REG = await import(join(regTmp, 'registry.mjs'));
const AGENT_IDS = REG.AGENTS.map((a) => a.id);
// The built agent stories a first run has already added (Chris, 2026-10-26).
const DEFAULT_NAMES = REG.DEFAULT_AGENT_IDS.map((id) => REG.AGENT_BY_ID[id].name);
rmSync(regTmp, { recursive: true, force: true });
const reset = () => ev(`localStorage.removeItem('trhs-agents'); localStorage.removeItem('trhs-forge')`);
const foot = () => ev(`document.querySelector('.forge .ds-modal-nav-foot')?.innerText?.trim()`);
const cardBy = (name) => `[...document.querySelectorAll('.forge .fg-card')].find((c) => c.querySelector('.fg-card-open')?.innerText.trim() === ${JSON.stringify(name)})`;

console.log('\nThe way in');
await go('/');
await reset();
await go('/');
check('a "Forge" button is in the shell (nav util or Nova panel header)',
  await ev(`!!document.querySelector('.shell-util button[aria-label="Forge"], .nova-panel button[aria-label="Forge"]')`));
await go('/?modal=agents');
check('?modal=agents opens Forge', await ev(`!!document.querySelector('.modal-shell.forge')`));
check('the shell is titled Forge', (await ev(`document.querySelector('.forge .breadcrumb-current')?.innerText?.trim()`)) === 'Forge');
// A fresh browser already has the built agent stories (Chris, 2026-10-26).
check(`only the ${DEFAULT_NAMES.length} default stories are added on a fresh browser`, new RegExp(`^${DEFAULT_NAMES.length} ADDED · \\d+ LISTINGS$`).test(await foot()), await foot());
check('Discover leads with the hero and its clip', await ev(`!!document.querySelector('.forge .fg-hero video')`));

console.log('\nThe old links');
for (const id of AGENT_IDS) {
  await go(`/?modal=agents&agent=${id}`);
  const name = await ev(`document.querySelector('.forge .fg-detail-name')?.innerText?.trim()`);
  check(`?agent=${id} opens its listing`, !!name, name);
}
await go('/?modal=agents');
const dupes = await ev(`(() => { const n = [...document.querySelectorAll('.forge .fg-card-open')].map((b) => b.innerText.trim()); const g = {}; for (const x of n) g[x] = (g[x] || 0) + 1; return n.length; })()`);
check('the landing renders cards', dupes > 0, String(dupes));

console.log('\nOne row, one height');
const rows = await ev(`(() => {
  const grid = document.querySelector('.forge .fg-grid');
  const cards = [...grid.querySelectorAll('.fg-card')];
  const byTop = {};
  for (const c of cards) { const r = c.getBoundingClientRect(); (byTop[Math.round(r.top)] ||= []).push({ b: Math.round(r.bottom), s: Math.round(c.querySelector('.fg-stats').getBoundingClientRect().bottom) }); }
  return Object.values(byTop).filter((r) => r.length > 1).map((r) => ({ bottoms: new Set(r.map((x) => x.b)).size, stats: new Set(r.map((x) => x.s)).size }));
})()`);
check('there is at least one multi-card row to measure', rows.length > 0);
check('every card in a row ends on one line', rows.every((r) => r.bottoms === 1), JSON.stringify(rows));
check('every stats row in a row sits on one line', rows.every((r) => r.stats === 1), JSON.stringify(rows));

console.log('\nNothing nested');
check('no button inside a button or link',
  (await ev(`document.querySelectorAll('.forge button button, .forge button a, .forge a button, .forge [role="button"] button').length`)) === 0);
check('each card has exactly one open control',
  await ev(`[...document.querySelectorAll('.forge .fg-card')].every((c) => c.querySelectorAll('.fg-card-open').length === 1)`));

console.log('\nThe card is quiet');
// Votes, likes and saves moved to the listing's page (Chris 2026-10-19); the
// verification check already says "official", so no badge repeats it.
check('no card carries vote, like or save controls',
  (await ev(`document.querySelectorAll('.forge .fg-card [aria-label^="Upvote"], .forge .fg-card [aria-label^="Downvote"], .forge .fg-card [aria-label^="Like"], .forge .fg-card [aria-label^="Save"]').length`)) === 0);
check('every card still shows its downloads', await ev(`[...document.querySelectorAll('.forge .fg-card')].every((c) => !!c.querySelector('.fg-stats [aria-label="Downloads"], .fg-stats svg[aria-label="Downloads"]'))`));
check('no "Official" badge anywhere', (await ev(`[...document.querySelectorAll('.forge .ds-badge')].filter((b) => /^official$/i.test(b.innerText.trim())).length`)) === 0);
check('the official check is still there, named in words',
  await ev(`!!document.querySelector('.forge .fg-verified.official svg[aria-label="Official HP brand"]')`));
check('stars are neutral, not the accent yellow', await ev(`(() => { const r = document.querySelector('.forge .ds-rating'); const probe = document.createElement('span'); probe.style.color = 'var(--accent-yellow)'; document.body.append(probe); const y = getComputedStyle(probe).color; probe.remove(); return !!r && getComputedStyle(r).color !== y; })()`));

console.log('\nAdding sticks');
await ev(`${cardBy('Frame Doctor')}?.scrollIntoView()`);
await ev(`${cardBy('Frame Doctor')}?.querySelector('[aria-label="Add Frame Doctor"]')?.click()`);
await sleep(150);
check('Add shows Adding… while it installs', /Adding/.test(await ev(`${cardBy('Frame Doctor')}?.querySelector('.fg-card-top .ds-btn')?.innerText`)));
await sleep(1200);
check('then reads Added', /Added/.test(await ev(`${cardBy('Frame Doctor')}?.querySelector('.fg-card-top .ds-btn')?.innerText`)));
check('it persists under trhs-agents', (await ev(`localStorage.getItem('trhs-agents')`) || '').includes('frame-doctor'));
check('an install receipt is issued', /FRG-/.test((await ev(`localStorage.getItem('trhs-forge')`)) || ''));
check('the nav foot follows', new RegExp(`^${DEFAULT_NAMES.length + 1} ADDED`).test(await foot()), await foot());

const asideVote = (dir) => `document.querySelector('.forge .fg-aside [aria-label="${dir}"]')`;
await go('/?modal=agents&listing=voicemod');
check('on a listing not added, votes are locked', await ev(`${asideVote('Upvote')}?.disabled === true`));
const likesExact = () => ev(`(() => { const dt = [...document.querySelectorAll('.forge .fg-kv dt')].find((d) => d.innerText.trim() === 'Likes'); return dt?.nextElementSibling?.innerText.trim(); })()`);
const detailBtn = (re) => `[...document.querySelectorAll('.forge .fg-detail-actions .ds-btn')].find((b) => ${re}.test(b.innerText.trim()))`;
const before = await likesExact();
await ev(`${detailBtn('/^Like$/')}?.click(); ${detailBtn('/^Save$/')}?.click()`);
await sleep(150);
const after = await likesExact();
check('Like presses, its glyph fills, and the exact count moves by one',
  (await ev(`(() => { const b = ${detailBtn('/^Liked$/')}; return b?.getAttribute('aria-pressed') === 'true' && /heart-fill/.test(b.innerHTML); })()`)) &&
    Number(after.replace(/,/g, '')) - Number(before.replace(/,/g, '')) === 1,
  `${before} → ${after}`);
check('Save presses and persists', (await ev(`JSON.parse(localStorage.getItem('trhs-forge') || '{}').saved?.voicemod`)) === true);

await go('/?modal=agents&agent=frame-doctor');
check('on an added listing, votes unlock', await ev(`${asideVote('Upvote')}?.disabled === false`));
await ev(`${asideVote('Upvote')}?.click()`);
await sleep(100);
check('an upvote is pressed and persists', (await ev(`${asideVote('Upvote')}?.getAttribute('aria-pressed')`)) === 'true' && (await ev(`JSON.parse(localStorage.getItem('trhs-forge') || '{}').vote?.['frame-doctor']`)) === 1);

await go('/?modal=agents');
await ev(`[...document.querySelectorAll('.forge .ds-modal-nav-item')].find((b) => /yours/i.test(b.innerText))?.click()`);
await sleep(300);
const yours = await ev(`[...document.querySelectorAll('.forge .fg-card-open')].map((b) => b.innerText.trim())`);
check('Yours lists the added and the saved, and the stories added by default', yours.includes('Frame Doctor') && yours.includes('Voicemod') && DEFAULT_NAMES.every((n) => yours.includes(n)) && yours.length === 2 + DEFAULT_NAMES.length, JSON.stringify(yours));

console.log('\nRating');
await go('/?modal=agents&agent=frame-doctor');
await ev(`[...document.querySelectorAll('.forge .fg-tabs button')].find((b) => b.innerText.trim() === 'Ratings')?.click()`);
await sleep(200);
check('an added listing offers the star input', await ev(`!!document.querySelector('.forge .fg-composer [role="radiogroup"]')`));
await ev(`document.querySelectorAll('.forge .fg-composer [role="radio"]')[3]?.click()`);
await sleep(100);
await ev(`[...document.querySelectorAll('.forge .fg-composer .ds-btn')].find((b) => /Post rating/.test(b.innerText))?.click()`);
await sleep(200);
check('the rating posts as your verified review', await ev(`/You/.test(document.querySelector('.forge .fg-review.mine')?.innerText || '')`));
check('and persists', (await ev(`JSON.parse(localStorage.getItem('trhs-forge') || '{}').rating?.['frame-doctor']?.stars`)) === 4);

console.log('\nThe stars are true');
const fills = await ev(`[...document.querySelectorAll('.forge .ds-rating')].map((r) => { const a = r.getAttribute('aria-label'); const v = parseFloat(a); return { v, ratio: r.querySelector('.ds-rating-fill').getBoundingClientRect().width / r.getBoundingClientRect().width }; })`);
check('every drawn rating fills in proportion (±6%)', fills.length > 0 && fills.every((f) => Math.abs(f.ratio - f.v / 5) < 0.06), JSON.stringify(fills.slice(0, 6)));

console.log('\nBrowsing');
await go('/?modal=agents&cat=support');
check('a legacy ?cat=support lands on Tune my PC', /Tune my PC/.test(await ev(`document.querySelector('.forge .ds-modal-nav-item.active')?.innerText || ''`)));
await ev(`[...document.querySelectorAll('.forge .fg-chips .ds-chip')].find((c) => c.innerText.trim() === 'Recipe')?.click()`);
await sleep(200);
check('the Recipe chip filters to recipes', await ev(`(() => { const c = [...document.querySelectorAll('.forge .fg-card')]; return c.length > 0 && c.every((x) => /^recipe$/i.test(x.querySelector('.fg-badges .ds-badge')?.innerText.trim())); })()`));
await go('/?modal=agents');
await ev(`(() => { const i = document.querySelector('.forge .fg-bar input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'voicemod'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(300);
check('search narrows the grid', (await ev(`document.querySelectorAll('.forge .fg-card').length`)) === 1);
await go('/?modal=agents&listing=competitive-keyboard-mode');
check('an unreleased listing offers Notify me', /Notify me/.test(await ev(`document.querySelector('.forge .fg-detail-actions')?.innerText || ''`)));

console.log('\nInline, on Nova → Agents');
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true }))`);
await go('/nova?view=agents');
const inline = await ev(`(() => { const s = document.querySelector('.nova-agents'), f = document.querySelector('.forge-inline'); if (!s || !f) return null; return { overflow: s.scrollHeight - s.clientHeight, forgeH: f.getBoundingClientRect().height, forgeInner: f.scrollHeight }; })()`);
// The bug this guards: the host is a scrolling flex column, and an overflow
// on .forge-inline let the column shrink it to the viewport — Forge clipped,
// nothing to scroll (fixed 2026-10-19).
check('Forge renders inline on the Agents view', !!inline, JSON.stringify(inline));
check('it is not squeezed: its box holds all of its content', !!inline && inline.forgeH >= inline.forgeInner - 2, JSON.stringify(inline));
check('and the page scrolls through it', !!inline && inline.overflow > 1000, JSON.stringify(inline));
for (const [w, hash] of [[1440, '/nova?view=agents'], [1280, '/?modal=agents'], [1440, '/?modal=agents']]) {
  await go(hash, w);
  const spill = await ev(`Math.max(0, ...[...document.querySelectorAll('.fg-stats')].map((s) => s.scrollWidth - s.clientWidth))`);
  check(`no card's stats row spills at ${w} (${hash.includes('nova') ? 'inline' : 'modal'})`, spill === 0, `${spill}px`);
}
await ev(`localStorage.removeItem('trhs-modules')`);

console.log('\nThe Module Browser is unharmed');
await go('/?modal=modules');
check('the Module Browser still opens and lists modules',
  (await ev(`!!document.querySelector('.modulebrowser') && document.querySelectorAll('.mb-card').length > 0`)) === true);

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// Leave the browser as we found it.
await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
await reset().catch(() => {});
await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

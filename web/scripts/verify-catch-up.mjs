// verify-catch-up — the "Catch Me Up" press demo, start to finish (TH-478,
// docs/catch-me-up-demo-plan.md). Run with `npm run verify -- catch-up`.
//
//  1. THE RESET IS IDEMPOTENT. `#/?demo=catch-up` twice leaves one Night City,
//     Work active by hand, Nova installed and unpinned with the model off, no
//     rehearsal cards, YOUR board kept (Last Played added only if missing,
//     2026-10-20) and the coach mark dismissed.
//  2. TIME IS FIXED. With the browser clock moved 400 days, Last Played still
//     reads "94 days ago": nothing reads `Date.now()`.
//  3. THE RECAP is scripted, spoken by Catch Me Up, has its four sections and
//     the marker badge, and says nothing on the game's spoiler denylist —
//     the denylist is the fixture's own, loaded through esbuild.
//  4. THE MODEL NEVER GATES A BEAT. With the model on and its endpoint dead,
//     the same sentence gets the same reply, in the same time.
//  5. THE FOLLOW-UP CHIP asks rather than acts, and the build section answers.
//  6. RESUME applies Night City through the Game Link rule (source `game`,
//     `revertTo` Work), lands on Play with "Now playing", paints the Origins 65
//     and lights its backlight canvas.
//  7. THE FINALE previews three rows under the exact title; once added the
//     rows are the binding's measured height, nothing clips, and the card ends
//     on one line with its row neighbour. Resume on a row opens that game.
//  8. EXISTING PHRASES still route to their own builders.
//  9. ACCESS: every new control shows :focus-visible; the new text clears
//     4.5:1 in the light theme.
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The fixture and the binding table, as the app has them ───────────────────
const tmp = mkdtempSync(join(tmpdir(), 'trhs-catchup-'));
const load = async (entry, name) => {
  const outfile = join(tmp, name);
  await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], outfile, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
  return import(outfile);
};
const F = await load('../src/data/catchUp.ts', 'catchUp.mjs');
const B = await load('../src/state/bindings.ts', 'bindings.mjs');
rmSync(tmp, { recursive: true, force: true });
const ROW_H = B.BINDINGS['catch-up'].height.rows;

// ── CDP ──────────────────────────────────────────────────────────────────────
const targets = await fetch(`http://localhost:${CDP_PORT}/json/list`).then((r) => r.json());
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error(`no page target on CDP ${CDP_PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
let msgId = 0;
const pending = new Map();
const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expr, ms = 20000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(expr).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
};
// A real document load each time (gotcha 33), then mount, then two frames.
let nav = 0;
const go = async (hash) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?n=${++nav}#${hash}` });
  await sleep(300);
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('.shell') && document.body.innerText.trim().length > 50`, 10000);
  await ev(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`).catch(() => {});
  await sleep(400);
};
const store = (key) => ev(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) ?? 'null')`);
const lastMsg = `[...document.querySelectorAll('.ds-chat-msg')].pop()`;
// "The reply has finished" = its offers are drawn and it is no longer streaming.
// Tried against a bubble that is mid-stream first (gotcha 52): `data-status` is set.
const replyDone = (label) => `(() => { const m = ${lastMsg}; return !!m && m.dataset.status !== 'streaming' && [...m.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(label)}); })()`;
const clickButton = (text, scope = 'document') =>
  ev(`(() => { const b = [...${scope}.querySelectorAll('button')].reverse().find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`);
const type = (text) =>
  ev(`(() => { const t = document.querySelector('.nova-panel textarea') ?? document.querySelector('textarea'); if (!t) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(text)}); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
const speaker = () => ev(`${lastMsg}?.querySelector('.ds-chat-msg-meta, [class*="meta"]')?.textContent ?? ''`);
const msgCount = () => ev(`document.querySelectorAll('.ds-chat-msg').length`);
// What the reply SAYS, without the meta line (its "Just now" moves).
const replyText = () => ev(`(() => { const m = ${lastMsg}; if (!m) return ''; const c = m.cloneNode(true); c.querySelectorAll('[class*="meta"], button').forEach((e) => e.remove()); return c.innerText.trim(); })()`);

// ── 1. The reset ─────────────────────────────────────────────────────────────
console.log('\nThe reset is the stage’s start position, and idempotent');
await go('/');
await ev(`localStorage.clear(); 1`);
await go('/?demo=catch-up');
await go('/?demo=catch-up');
const prof = await store('trhs-profiles');
check('the param is stripped after the reset', !(await ev('location.hash')).includes('demo='), await ev('location.hash'));
check('one Night City, however many resets', prof?.profiles.filter((p) => p.id === 'night-city').length === 1, JSON.stringify(prof?.profiles.map((p) => p.id)));
check('Work is active, by hand, with nothing to revert to', prof?.activeId === 'work' && prof?.source === 'manual' && prof?.revertTo === null, JSON.stringify([prof?.activeId, prof?.source, prof?.revertTo]));
const nc = prof?.profiles.find((p) => p.id === 'night-city');
check('Night City links Cyberpunk and nothing else', nc?.gameLink.enabled && JSON.stringify(nc.gameLink.gameIds) === '["cyberpunk"]', JSON.stringify(nc?.gameLink));
check('and paints the Origins 65 Banana', Object.values(nc?.devices['origins-65']?.['lighting.keyColors'] ?? {}).every((c) => c === 'rgb(247,181,0)') && Object.keys(nc?.devices['origins-65']?.['lighting.keyColors'] ?? {}).length > 60);
check('no default profile was given Night City’s link', prof?.profiles.filter((p) => p.id !== 'night-city').every((p) => !p.gameLink.gameIds.includes('cyberpunk')));
check('Nova is installed and unpinned, the model off', (await store('trhs-modules'))?.nova === true && (await ev(`localStorage.getItem('novaPinned')`)) === '0' && (await store('trhs-nova'))?.settings.llmEnabled === false);
{
  const layout = (await store('board-layout')) ?? [];
  const specs = (await store('cards')) ?? [];
  check('no catch-up card is left on the board', !layout.some((i) => specs.find((c) => c.id === i.id)?.title === 'Pick Up Where You Left Off'));
}
// The person's own board survives the reset (Chris, 2026-10-20). Seed a board
// of THEIR choosing — the rendered widgets, reversed, Last Played left out —
// and the reset must keep it exactly, adding Last Played at the top only
// because the story needs it.
{
  await go('/');
  const rendered = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  const mine = rendered.filter((id) => id !== 'lastplayed').reverse();
  const stored = (await store('board-layout')) ?? [];
  const byId = Object.fromEntries(stored.map((i) => [i.id, i]));
  await ev(`localStorage.setItem('board-layout', ${JSON.stringify(JSON.stringify(mine.map((id) => byId[id] ?? { id, span: 2, rows: 1 })))}); 1`);
  await go('/');
  const seeded = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  await go('/?demo=catch-up');
  await go('/');
  const after = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  check('the reset keeps your own board, in your order', JSON.stringify(after.filter((id) => id !== 'lastplayed')) === JSON.stringify(seeded.filter((id) => id !== 'lastplayed')), `${JSON.stringify(seeded)} → ${JSON.stringify(after)}`);
  check('adding Last Played at the top only because it was missing', after[0] === 'lastplayed' && after.filter((id) => id === 'lastplayed').length === 1, JSON.stringify(after));
  await go('/?demo=catch-up');
  await go('/');
  check('and a second reset changes nothing', JSON.stringify(await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`)) === JSON.stringify(after));
}
check('the coach mark is dismissed', (await ev(`localStorage.getItem('cardMenuHintSeen')`)) === '1');
check('Last Played reads 94 days ago', (await ev(`document.querySelector('.wg-lp-sub')?.textContent`)) === 'Last played: 94 days ago', await ev(`document.querySelector('.wg-lp-sub')?.textContent`));

// ── 2. The clock ─────────────────────────────────────────────────────────────
console.log('\nTime is the fixture’s, not the machine’s');
const { identifier: shift } = await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => { const D = Date, off = 400 * 864e5; function F(...a) { return a.length ? new D(...a) : new D(D.now() + off); } F.now = () => D.now() + off; F.UTC = D.UTC; F.parse = D.parse; F.prototype = D.prototype; window.Date = F; })();`,
});
await go('/');
check('the clock really moved', (await ev(`Date.now() - performance.timeOrigin`)) > 300 * 864e5);
check('and Last Played still reads 94 days ago', (await ev(`document.querySelector('.wg-lp-sub')?.textContent`)) === 'Last played: 94 days ago', await ev(`document.querySelector('.wg-lp-sub')?.textContent`));
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: shift });

// ── 3. The recap ─────────────────────────────────────────────────────────────
console.log('\nThe recap');
await go('/');
const t0 = Date.now();
check('Last Played offers Catch me up', await clickButton('Catch me up', `document.querySelector('.wg-lastplayed')`));
check('Nova opens', await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000));
check('the reply finishes with its offers', await waitFor(replyDone('Show my keyboard')));
const recapMs = Date.now() - t0;
check('spoken by Catch Me Up', (await speaker()).startsWith('Catch Me Up'), await speaker());
check('and in its voice', (await replyText()).startsWith('Catch Me Up here. Welcome back. It has been 94 days'), (await replyText()).slice(0, 80));
check('scripted, not the model', (await ev(`${lastMsg}?.dataset.source`)) === 'scripted', await ev(`${lastMsg}?.dataset.source`));
check('the recap card has its four sections', (await ev(`${lastMsg}?.querySelectorAll('.nova-recap[data-section="all"] .nova-recap-section').length`)) === 4);
check('the marker is on the badge', (await ev(`${lastMsg}?.querySelector('.nova-recap .ds-badge.status')?.textContent`)) === `Spoiler-safe · up to ${F.CATCH_UP_BY_ID.cyberpunk.marker}`);
const recap = await replyText();
const hits = F.SPOILER_DENYLIST.cyberpunk.filter((w) => recap.toLowerCase().includes(w.toLowerCase()));
check('nothing on the spoiler denylist', hits.length === 0, hits.join(', '));
const fixtureHits = Object.entries(F.SPOILER_DENYLIST).flatMap(([g, words]) => words.filter((w) => F.recapText(F.CATCH_UP_BY_ID[g]).toLowerCase().includes(w.toLowerCase())).map((w) => `${g}:${w}`));
check('nor anywhere in any game’s fixture copy', fixtureHits.length === 0, fixtureHits.join(', '));
check('no exclamation marks', !recap.includes('!'));
const activity = (await store('trhs-nova'))?.activity?.[0];
check('the activity feed says what it read', activity?.agentId === 'catch-me-up' && /read your Cyberpunk 2077 save and 2 updates since/.test(activity.text), JSON.stringify(activity));

// ── 4. The model never gates a beat ──────────────────────────────────────────
console.log('\nWith the model on and its endpoint dead');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = true; s.settings.endpoint = 'http://localhost:9/v1/chat/completions'; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);
await go('/');
const before = await msgCount();
const t1 = Date.now();
await type('Catch me up on Cyberpunk 2077');
await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${before + 2}`, 5000);
check('the same reply arrives', await waitFor(replyDone('Show my keyboard')));
const deadMs = Date.now() - t1;
check('word for word', (await replyText()) === recap, (await replyText()).slice(0, 120));
check('still scripted', (await ev(`${lastMsg}?.dataset.source`)) === 'scripted');
check('and on time', deadMs < recapMs + 2500, `${deadMs}ms vs ${recapMs}ms`);
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = false; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);
await go('/');

// ── 5. The follow-up ─────────────────────────────────────────────────────────
console.log('\nThe follow-up chip');
const n5 = await msgCount();
check('How does that affect my build? is a chip', await clickButton('How does that affect my build?'));
check('it asks — a new turn appears', await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n5 + 2}`, 5000));
check('the build section answers', await waitFor(`!!${lastMsg}?.querySelector('.nova-recap[data-section="build"]')`));
await waitFor(replyDone('Resume where I left off'));
check('Catch Me Up speaks it too', (await speaker()).startsWith('Catch Me Up'));
check('only the update that touched the build', (await ev(`${lastMsg}?.querySelectorAll('.nova-recap-change').length`)) === 1);

// ── 6. Resume ────────────────────────────────────────────────────────────────
console.log('\nResume');
check('Resume where I left off', await clickButton('Resume where I left off'));
check('lands on Play, on the game', await waitFor(`location.hash.startsWith('#/play?playing=cyberpunk')`, 5000), await ev('location.hash'));
const p6 = await store('trhs-profiles');
check('Night City is active, by the game, reverting to Work', p6?.activeId === 'night-city' && p6?.source === 'game' && p6?.revertTo === 'work', JSON.stringify([p6?.activeId, p6?.source, p6?.revertTo]));
check('the profile switcher says so', await waitFor(`document.querySelector('.shell-brand')?.textContent.includes('Night City')`, 3000));
check('Play says Now playing', await waitFor(`document.querySelector('.play-rail-now')?.textContent === 'Now playing · Night City profile applied'`, 3000), await ev(`document.querySelector('.play-rail-now')?.textContent ?? 'none'`));
check('the slide holds on Cyberpunk', await ev(`document.querySelector('.play-hero-slide.active')?.dataset.slide === 'cyberpunk'`));
check('Show my keyboard', await clickButton('Show my keyboard'));
check('opens the Origins 65', await waitFor(`location.hash.includes('sku=origins-65') && !!document.querySelector('[role="dialog"]')`, 8000));
check('its keys are painted Banana', await waitFor(`(() => { const k = document.querySelectorAll('[role="dialog"] [data-paint]'); return k.length > 30 && [...k].every((e) => e.dataset.paint === 'rgb(247,181,0)'); })()`, 8000), String(await ev(`document.querySelectorAll('[role="dialog"] [data-paint]').length`)));
const lit = await ev(`(() => { const c = document.querySelector('[role="dialog"] canvas.kbp-backlight'); if (!c) return -1; const x = c.getContext('2d'); if (!x || !c.width) return -2; const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; })()`);
check('and the backlight canvas has lit pixels', lit > 0, String(lit));

// ── 7. The finale ────────────────────────────────────────────────────────────
console.log('\nThe finale: Pick Up Where You Left Off');
await go('/');
const n7 = await msgCount();
await type('keep me caught up on everything I’ve drifted from');
await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n7 + 2}`, 5000);
check('the preview arrives with its offers', await waitFor(replyDone('Add to dashboard')));
check('spoken by Catch Me Up', (await speaker()).startsWith('Catch Me Up'));
check('three rows in the preview', (await ev(`${lastMsg}?.querySelectorAll('[data-block="catch-up"] .ds-list-item').length`)) === 3);
check('under the exact title', (await ev(`${lastMsg}?.querySelector('.wb-card-preview .w')?.textContent ?? ''`)).startsWith('Pick Up Where You Left Off'), await ev(`${lastMsg}?.querySelector('.wb-card-preview .w')?.textContent.slice(0, 40)`));
check('Add to dashboard', await clickButton('Add to dashboard'));
const cell = `document.querySelector('.shell main [data-block="catch-up"]:not(.wb-card-preview [data-block])')?.closest('.w')`;
check('the card is on the board', await waitFor(`!!${cell}`, 5000));
await ev(`${cell}.scrollIntoView({ block: 'center' })`);
await sleep(400);
const m7 = await ev(`(() => { const w = ${cell}; const b = w.querySelector('[data-block="catch-up"]'); const items = b.closest('.wb-card-items') ?? w; const ib = items.getBoundingClientRect(); const rows = [...b.querySelectorAll('.ds-list-item')]; const top = w.getBoundingClientRect().top; return {
  heights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
  clipped: rows.some((r) => r.getBoundingClientRect().bottom > ib.bottom + 0.5) || items.scrollHeight > items.clientHeight + 1,
  titles: rows.map((r) => { const l = r.querySelector('.ds-list-item-label'); return l.scrollWidth <= l.clientWidth + 1; }),
  bottom: Math.round(w.getBoundingClientRect().bottom),
  neighbours: [...document.querySelectorAll('.shell main .wb-cell > .w, .shell main .w')].filter((x) => x !== w && !x.closest('.wb-card-preview') && Math.abs(x.getBoundingClientRect().top - top) < 2).map((x) => Math.round(x.getBoundingClientRect().bottom)),
}; })()`);
check(`each row is the measured ${ROW_H}px`, m7.heights.length === 3 && m7.heights.every((h) => h === ROW_H), JSON.stringify(m7.heights));
check('nothing clips', !m7.clipped);
check('every title fits', m7.titles.every(Boolean), JSON.stringify(m7.titles));
// Alone in its row there is nothing to line up with: the default board
// (2026-10-26) leaves the added card a row of its own at 1440.
check('the card ends on one line with its row neighbours, if it has any', m7.neighbours.every((b) => Math.abs(b - m7.bottom) <= 1), JSON.stringify(m7));
check('Resume on Elden Ring', await ev(`(() => { const b = ${cell}.querySelector('button[aria-label="Resume Elden Ring"]'); if (!b) return false; b.click(); return true; })()`));
check('opens Elden Ring in Play', await waitFor(`location.hash.startsWith('#/play?playing=eldenring')`, 5000), await ev('location.hash'));
check('and claims no profile it did not apply', !(await ev(`!!document.querySelector('.play-rail-now')`)));

// ── 7c. The recap as a widget or an overlay (Chris, 2026-10-20) ─────────────
console.log('\nKeep the recap in view');
await go('/?demo=catch-up');
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
await type('Catch me up on Elden Ring');
check('the recap offers both monitors', await waitFor(replyDone('Show as overlay')) && (await ev(`[...(${lastMsg}?.querySelectorAll('button') ?? [])].some((b) => b.textContent.trim() === 'Add to dashboard')`)));
check('Show as overlay', await clickButton('Show as overlay', lastMsg));
check('Add to dashboard', await clickButton('Add to dashboard', lastMsg));
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/');
const placed = await ev(`(() => { const all = [...document.querySelectorAll('[data-block="catch-up-recap"]')]; const hud = all.find((e) => !e.closest('.wb-cell')); const cardEl = all.find((e) => e.closest('.wb-cell')); return { hud: hud?.querySelector('[data-recap]')?.dataset.recap, hudSection: hud?.querySelector('[data-recap]')?.dataset.section, card: cardEl?.querySelector('[data-recap]')?.dataset.recap, title: cardEl?.closest('.wb-cell')?.querySelector('.w-label-text, .w-label')?.textContent?.trim(), text: (hud?.innerText ?? '') + ' ' + (cardEl?.innerText ?? '') }; })()`);
check('after a reload the HUD still shows Elden Ring — the game it was made for', placed.hud === 'eldenring' && placed.hudSection === 'summary', JSON.stringify(placed));
check('and so does the widget, titled for it', placed.card === 'eldenring' && placed.title === 'Elden Ring recap', JSON.stringify(placed));
const placedHits = F.SPOILER_DENYLIST.eldenring.filter((w) => placed.text.toLowerCase().includes(w.toLowerCase()));
check('the placed recap is as spoiler-safe as the reply', placedHits.length === 0, placedHits.join(', '));
await ev(`document.querySelector('.wb-cell [data-block="catch-up-recap"]')?.scrollIntoView({ block: 'center' }); 1`);
await sleep(500);
const rw = await ev(`(() => { const b = document.querySelector('.wb-cell [data-block="catch-up-recap"]'); if (!b) return null; const cell = b.closest('.wb-cell'); const cr = cell.getBoundingClientRect(); const br = b.getBoundingClientRect(); return { h: Math.round(br.height), inside: br.top >= cr.top - 1 && br.bottom <= cr.bottom + 1, bottom: Math.round(cr.bottom), peers: [...document.querySelectorAll('.wb-cell')].filter((c) => c !== cell && Math.abs(c.getBoundingClientRect().top - cr.top) < 4).map((c) => Math.round(c.getBoundingClientRect().bottom)) }; })()`);
check(`the widget is the binding's measured ${B.BINDINGS['catch-up-recap'].height.rows}px`, rw && Math.abs(rw.h - B.BINDINGS['catch-up-recap'].height.rows) <= 2, JSON.stringify(rw));
check('inside its cell, and level with its neighbour', rw?.inside && rw.peers.every((p) => p === rw.bottom), JSON.stringify(rw));
await go('/?demo=catch-up');
await go('/');
check('the reset clears the placed recap, widget and overlay', (await ev(`document.querySelectorAll('[data-block="catch-up-recap"]').length`)) === 0);

// ── 8. Routing ───────────────────────────────────────────────────────────────
console.log('\nOther sentences still reach their own builders');
await go('/');
for (const [text, sel] of [
  ['make an fps overlay', '.ds-chat-msg:last-child [data-card-preview], [class*="overlay-preview"]'],
  ['build me a widget with fps and cpu temp', '[data-card-preview]'],
  ['recap', null],
]) {
  const n = await msgCount();
  await type(text);
  await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n + 2}`, 5000);
  await waitFor(`${lastMsg}?.dataset.status !== 'streaming'`, 15000);
  check(`“${text}” is not Catch Me Up’s`, !(await speaker()).startsWith('Catch Me Up'), await speaker());
}

// ── 9. Access ────────────────────────────────────────────────────────────────
console.log('\nKeyboard focus and contrast');
await go('/?demo=catch-up');
await go('/');
const focusRing = async (selector) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft' });
  return ev(`(() => { const e = ${selector}; if (!e) return 'missing'; e.focus(); const s = getComputedStyle(e); return e.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; })()`);
};
check('Catch me up shows a focus ring', (await focusRing(`[...document.querySelectorAll('.wg-lastplayed button')].find((b) => b.textContent.trim() === 'Catch me up')`)) === true);
await clickButton('Catch me up', `document.querySelector('.wg-lastplayed')`);
await waitFor(replyDone('Show my keyboard'));
for (const label of ['How does that affect my build?', 'Resume where I left off', 'Show my keyboard']) {
  check(`the ${label} chip shows a focus ring`, (await focusRing(`[...${lastMsg}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`)) === true);
}
await type('keep me caught up on everything I’ve drifted from');
await waitFor(replyDone('Add to dashboard'));
await clickButton('Add to dashboard');
await waitFor(`!!${cell}`, 5000);
check('Resume on a board row shows a focus ring', (await focusRing(`${cell}?.querySelector('button[aria-label="Resume Cyberpunk 2077"]')`)) === true);
check('the board rows are a list, out of the tab order', await ev(`(() => { const b = ${cell}.querySelector('[data-block="catch-up"]'); return b.getAttribute('role') === 'list' && [...b.querySelectorAll('.ds-list-item')].every((r) => r.getAttribute('role') === 'listitem' && !r.hasAttribute('tabindex')); })()`));

// Contrast, composited over every translucent layer down to the first opaque one.
const contrastOf = (selector) => ev(`(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
  if (!els.length) return null;
  return Math.min(...els.map((el) => {
    const layers = []; for (let n = el; n; n = n.parentElement) { const bg = parse(getComputedStyle(n).backgroundColor); if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; } }
    let bg = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1]; if (bg[3] < 1) bg = over(bg, [255, 255, 255, 1]);
    for (const l of layers.reverse()) bg = over(l, bg);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05);
  }));
})()`);
await ev(`localStorage.setItem('theme', 'light'); 1`);
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
await waitFor(`!!document.querySelector('.nova-recap')`, 5000);
for (const sel of ['.nova-recap .nova-recap-p', '.nova-recap .nova-recap-h', '.nova-recap .ds-badge.status', '.cb-catchup-row .ds-list-item-label', '.cb-catchup-row .ds-list-item-description']) {
  const c = await contrastOf(sel);
  check(`light theme: ${sel} clears 4.5:1`, c != null && c >= 4.5, c == null ? 'not found' : c.toFixed(2));
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// Leave the browser as we found it.
await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
await ev(`localStorage.clear(); 1`).catch(() => {});
await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

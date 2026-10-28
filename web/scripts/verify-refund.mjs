// verify-refund — "Did I Just Waste My Money", start to finish (TH-484,
// docs/refund-window-demo-plan.md). Run with `npm run verify -- refund`.
//
//  1. THE RULES. Each store's window, from the fixture's own maths (loaded
//     through esbuild): Steam and Epic close at 2 h played or 14 days, GOG at
//     30 days whatever the playtime — the table the agent states as fact.
//  2. THE RESET is idempotent: the agent added (Forge's Add is its switch
//     again since 2026-10-26, and it is added on a first run), Nova installed
//     and unpinned with the model off, nothing playing, no toasts, no
//     rehearsal cards.
//  3. PLAY starts the clock (the hero's Play was dead before this), and
//     "Now playing" says how long it has been played.
//  4. THE WARNING arrives ONCE, at 15 minutes left: a warn toast whose copy is
//     the fixture's, and an unprompted message spoken by the agent — not a
//     reply to anything. Open pins Nova on that message; the clock keeps
//     running and no second warning comes.
//  5. THE ANSWERS are chips, and scripted: worth-keeping names what this PC
//     saw and offers Booster; how-to gives Steam's steps and its page, labelled
//     with the destination.
//  6. THE MODEL NEVER GATES A BEAT: model on, endpoint dead, same reply.
//  7. THE FINALE previews three rows under the exact title; once added, the
//     rows are the binding's measured height, nothing clips, the card ends on
//     one line with its row neighbour, and each row says its window in words.
//  8. EXISTING PHRASES still route to their own scripts.
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
const tmp = mkdtempSync(join(tmpdir(), 'trhs-refund-'));
const load = async (entry, name) => {
  const outfile = join(tmp, name);
  await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], outfile, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
  return import(outfile);
};
const F = await load('../src/data/refunds.ts', 'refunds.mjs');
const B = await load('../src/state/bindings.ts', 'bindings.mjs');
rmSync(tmp, { recursive: true, force: true });
const ROW_H = B.BINDINGS['refunds'].height.rows;

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


// ── 1. The rules ─────────────────────────────────────────────────────────────
console.log('\nThe rules, as the fixture computes them');
const P = F.PURCHASE_BY_ID;
const w = (id, min) => F.windowFor(P[id], min);
check('Steam: open at 1 h 59 min', w('monsterhunterwilds', 119).open && w('monsterhunterwilds', 119).minutesLeft === 1);
check('Steam: closed at 2 h', !w('monsterhunterwilds', 120).open);
check('Steam: 14 days, bought 2 days ago → 12 left', w('monsterhunterwilds', 0).daysLeft === 12);
check('Epic: the same 2 h / 14 days', F.STORES.epic.minutes === 120 && F.STORES.epic.days === 14);
check('GOG: playtime does not count', w('baldursgate3', 100000).open && w('baldursgate3', 100000).minutesLeft === null);
check('GOG: 30 days', F.STORES.gog.days === 30 && w('baldursgate3', 0).daysLeft === 30 - P.baldursgate3.purchasedDaysAgo);
check('the warning is at 15 minutes', F.WARN_AT_MIN === 15);

// ── 2. The reset ─────────────────────────────────────────────────────────────
console.log('\nThe reset');
await go('/');
await ev(`localStorage.clear(); 1`);
await go('/?demo=refund');
await go('/?demo=refund');
check('the param is stripped after the reset', !(await ev('location.hash')).includes('demo='));
check('the agent is added, once', JSON.stringify((await store('trhs-agents')).filter((x) => x === 'did-i-just-waste-my-money')) === '["did-i-just-waste-my-money"]', JSON.stringify(await store('trhs-agents')));
check('Nova installed and unpinned, the model off', (await store('trhs-modules'))?.nova === true && (await ev(`localStorage.getItem('novaPinned')`)) === '0' && (await store('trhs-nova'))?.settings.llmEnabled === false);
check('no toasts', (await ev(`document.querySelectorAll('.ds-toast').length`)) === 0);
check('no rehearsal cards', !((await store('cards')) ?? []).some((c) => c.title === 'Refund windows'));
// Your own board survives the reset (2026-10-20); only rehearsal cards and
// refund overlays go.
{
  await go('/');
  const rendered = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  const mine = rendered.slice().reverse();
  const stored = (await store('board-layout')) ?? [];
  const byId = Object.fromEntries(stored.map((i) => [i.id, i]));
  await ev(`localStorage.setItem('board-layout', ${JSON.stringify(JSON.stringify(mine.map((id) => byId[id] ?? { id, span: 2, rows: 1 })))}); localStorage.setItem('overlays', JSON.stringify([{ id: 'ov-rehearsal', title: 'Refund window', items: [{ kind: 'bound', bind: 'refund-watch' }], x: 24, y: 96, visible: true, createdAt: 1 }])); 1`);
  await go('/');
  const seeded = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  await go('/?demo=refund');
  await go('/');
  check('the reset keeps your own board exactly', JSON.stringify(await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`)) === JSON.stringify(seeded));
  check('and clears the refund overlay a rehearsal placed', !((await store('overlays')) ?? []).some((o) => o.id === 'ov-rehearsal'));
}

// ── 3–5. Play → warning → answers (no reload: the clock lives in memory) ─────
console.log('\nPlay starts the clock');
await go('/play');
await ev(`[...document.querySelectorAll('.play-rail-thumb')].find((b) => /Monster Hunter/.test(b.getAttribute('aria-label')))?.click(); 1`);
await sleep(300);
check('Play is a real button now', await clickButton('Play', `document.querySelector('.play-rail-card')`));
check('"Now playing" says how long', await waitFor(`/Now playing · 1 h 4\\d min played/i.test(document.querySelector('.play-rail-now')?.textContent ?? '')`, 3000), await ev(`document.querySelector('.play-rail-now')?.textContent`));

console.log('\nThe warning');
const tPlay = Date.now();
check('a toast arrives', await waitFor(`!!document.querySelector('.ds-toast')`, 30000));
const toastText = await ev(`document.querySelector('.ds-toast')?.innerText ?? ''`);
check('it is a warn toast', await ev(`document.querySelector('.ds-toast')?.classList.contains('warn')`));
check('with the fixture’s copy', /15 minutes left to refund Monster Hunter Wilds/.test(toastText) && /You have played 1 h 45 min of the 2 hours Steam allows/.test(toastText), toastText);
check('announced politely, never taking focus', (await ev(`document.querySelector('.ds-toast')?.getAttribute('role')`)) === 'status' && !(await ev(`!!document.activeElement?.closest('.ds-toast')`)));
check('at 15 minutes left, not before', Date.now() - tPlay >= 1000, `${Date.now() - tPlay}ms`);
const conv = (await store('trhs-nova'))?.conversations?.find((c) => c.messages.some((m) => m.agentId === 'did-i-just-waste-my-money'));
check('Nova spoke first: one message, the agent’s, nothing before it', conv && conv.messages.length === 1 && conv.messages[0].role === 'assistant', JSON.stringify(conv?.messages?.map((m) => m.role)));
check('Open is offered', await clickButton('Open', `document.querySelector('.ds-toast')`));
check('Nova opens', await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000));
check('the toast goes', await waitFor(`!document.querySelector('.ds-toast')`, 3000));
check('on the agent’s message, with its three answers', await waitFor(replyDone('Keep playing')));
check('spoken by Did I Just Waste My Money', (await speaker()).startsWith('Did I Just Waste My Money'), await speaker());
check('in its voice', (await replyText()).startsWith('Refund check. 15 minutes of playtime left'), (await replyText()).slice(0, 80));
check('the card shows the window, in words', /15 min left/i.test(await ev(`${lastMsg}?.querySelector('.nova-recap[data-refund] .ds-badge')?.textContent ?? ''`)));
check('no exclamation marks', !(await replyText()).includes('!'));
await sleep(12000);
check('the clock keeps running, and no second warning', (await ev(`document.querySelectorAll('.ds-toast').length`)) === 0 && ((await store('trhs-nova'))?.conversations ?? []).filter((c) => c.messages.some((m) => m.agentId === 'did-i-just-waste-my-money' && m.role === 'assistant' && /15 minutes of playtime left/.test(m.text))).length === 1);

console.log('\nThe answers');
check('Is it worth keeping? is a chip', await clickButton('Is it worth keeping?', lastMsg));
check('it names what this PC saw, and offers Booster', await waitFor(replyDone('Try fixing the stutter with Booster')));
check('…and sides with the player', /not enjoying it is reason enough/.test(await replyText()));
check('How do I refund it? is a chip there too', await clickButton('How do I refund it?', lastMsg));
check('Steam’s steps arrive', await waitFor(replyDone('Open Steam refunds (help.steampowered.com)')));
const steps = await ev(`[...(${lastMsg}?.querySelectorAll('.nova-refund-steps li') ?? [])].map((l) => l.textContent.trim())`);
check('the fixture’s steps, in order', JSON.stringify(steps) === JSON.stringify(F.STORES.steam.steps), JSON.stringify(steps));
check('the offer names where it goes', /help\.steampowered\.com/.test(await ev(`[...(${lastMsg}?.querySelectorAll('button') ?? [])].map((b) => b.textContent).join('|')`)));
check('scripted, not the model', (await ev(`${lastMsg}?.dataset.source`)) === 'scripted');
// The agent's WORDS — its card is live (the badge turns from "13 min left" to
// "Refundable" when a reload puts the clock back), so it is left out.
const saidText = () => ev(`(() => { const m = ${lastMsg}; if (!m) return ''; const c = m.cloneNode(true); c.querySelectorAll('[class*="meta"], button, .nova-recap').forEach((e) => e.remove()); return c.innerText.trim(); })()`);
const howText = await saidText();

// ── 6. The model never gates a beat ──────────────────────────────────────────
console.log('\nWith the model on and its endpoint dead');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = true; s.settings.endpoint = 'http://localhost:9/v1/chat/completions'; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);
await go('/');
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
const n0 = await msgCount();
await type('How do I refund Monster Hunter Wilds?');
await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n0 + 2}`, 5000);
check('the same reply arrives', await waitFor(replyDone('Open Steam refunds (help.steampowered.com)')));
// The minutes move with the clock; compare everything else.
const norm = (s) => s.replace(/\d+ min/g, 'N min').replace(/\d+ h/g, 'N h');
check('word for word, minutes aside', norm(await saidText()) === norm(howText), `${(await saidText()).slice(0, 140)} ≠ ${howText.slice(0, 140)}`);
check('still scripted', (await ev(`${lastMsg}?.dataset.source`)) === 'scripted');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = false; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);

// ── 7. The finale ────────────────────────────────────────────────────────────
console.log('\nThe finale');
await go('/?demo=refund');
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
await type('Keep an eye on everything I can still return');
check('the card preview arrives', await waitFor(replyDone('Add to dashboard')));
check('three rows', (await ev(`${lastMsg}?.querySelectorAll('[data-block="refunds"] [role="listitem"]').length`)) === 3);
check('under the exact title', (await ev(`${lastMsg}?.innerText ?? ''`)).includes('Refund windows'));
check('Add to dashboard', await clickButton('Add to dashboard', lastMsg));
await ev(`document.querySelector('.wb-cell [data-block="refunds"]')?.scrollIntoView({ block: 'center' }); 1`);
await sleep(600);
const board = await ev(`(() => { const b = document.querySelector('.wb-cell [data-block="refunds"]'); if (!b) return null; const cell = b.closest('.wb-cell'); const rows = [...b.querySelectorAll('[role="listitem"]')]; const cr = cell.getBoundingClientRect(); return { h: rows.map((r) => Math.round(r.getBoundingClientRect().height)), clip: rows.some((r) => r.scrollHeight > r.clientHeight + 1) || [...b.querySelectorAll('*')].some((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis'), bottom: Math.round(cr.bottom), peers: [...document.querySelectorAll('.wb-cell')].filter((c) => c !== cell && Math.abs(c.getBoundingClientRect().top - cr.top) < 4).map((c) => Math.round(c.getBoundingClientRect().bottom)), text: rows.map((r) => r.innerText) }; })()`);
check('the card is on the board', !!board);
check(`each row is the binding's ${ROW_H}px`, board?.h.every((h) => h === ROW_H), JSON.stringify(board?.h));
check('nothing clips', board && !board.clip);
check('it ends on one line with its row neighbour', board && board.peers.every((p) => p === board.bottom), JSON.stringify(board));
check('each row says its window in words', board?.text[0].includes('Steam · ') && /min of playtime left/.test(board.text[0]) && /GOG · \d+ days left/.test(board.text[2]), JSON.stringify(board?.text));

// ── 7a. The clock as a widget or an overlay (Chris, 2026-10-20) ─────────────
console.log('\nKeep the clock in view');
await go('/?demo=refund');
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
await type('Did I just waste my money on Monster Hunter Wilds?');
check('the window reply offers both monitors', await waitFor(replyDone('Show as overlay')) && (await ev(`[...(${lastMsg}?.querySelectorAll('button') ?? [])].some((b) => b.textContent.trim() === 'Add to dashboard')`)));
check('Show as overlay places it', await clickButton('Show as overlay', lastMsg));
check('a "Refund window" HUD with the live card', await waitFor(`(() => { const b = document.querySelector('[data-block="refund-watch"] .nova-recap.bare'); return !!b && !b.closest('.ds-chat-msg') && /Monster Hunter Wilds/.test(b.textContent) && /of 2 h/.test(b.textContent); })()`, 3000));
check('Add to dashboard', await clickButton('Add to dashboard', lastMsg));
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/');
await ev(`document.querySelector('.wb-cell [data-block="refund-watch"]')?.scrollIntoView({ block: 'center' }); 1`);
await sleep(500);
const watch = await ev(`(() => { const b = document.querySelector('.wb-cell [data-block="refund-watch"]'); if (!b) return null; const cell = b.closest('.wb-cell'); const cr = cell.getBoundingClientRect(); const br = b.getBoundingClientRect(); return { h: Math.round(br.height), inside: br.top >= cr.top - 1 && br.bottom <= cr.bottom + 1, bottom: Math.round(cr.bottom), peers: [...document.querySelectorAll('.wb-cell')].filter((c) => c !== cell && Math.abs(c.getBoundingClientRect().top - cr.top) < 4).map((c) => Math.round(c.getBoundingClientRect().bottom)) }; })()`);
check('the widget is on Home', !!watch);
check(`at the binding's measured ${B.BINDINGS['refund-watch'].height.rows}px`, watch && Math.abs(watch.h - B.BINDINGS['refund-watch'].height.rows) <= 2, JSON.stringify(watch));
check('inside its cell — nothing spills', watch?.inside, JSON.stringify(watch));
check('and it ends on one line with its row neighbour', watch && watch.peers.every((p) => p === watch.bottom), JSON.stringify(watch));
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
await type('Show my refund window as an overlay');
check('a typed overlay request builds just the countdown', await waitFor(replyDone('Place on screen')) && JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('[data-block]') ?? [])].map((e) => e.dataset.block)`)) === '["refund-watch"]', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('[data-block]') ?? [])].map((e) => e.dataset.block)`)));

// ── 7b. The way Chris tried it: the settings reset, then a My Games tile ─────
// Only the hero's Play started the clock until 2026-10-20; a library tile —
// the obvious place to press Play — left the warning waiting forever.
console.log('\nFrom the settings reset and a My Games tile');
await go('/nova');
check('Nova settings opens', await ev(`(() => { const b = document.querySelector('button[aria-label="Nova settings"]'); b?.click(); return !!b; })()`));
await sleep(300);
check('Reset refund demo is there', await clickButton('Reset refund demo'));
check('and lands on Play', await waitFor(`location.hash.startsWith('#/play')`, 3000), await ev('location.hash'));
// Since TH-504 a tile press opens the game's detail panel; its ▶ is the Play
// (a real button the keyboard reaches with one more Tab).
check('the Monster Hunter Wilds tile carries a Play button', await ev(`(() => { const t = [...document.querySelectorAll('.ds-tile[role="button"]')].find((e) => /Monster Hunter/.test(e.getAttribute('aria-label') || '')); const b = t?.querySelector('button.ds-tile-play'); if (!b) return false; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); b.click(); return true; })()`));
check('pressing it launches', await waitFor(`location.hash.includes('playing=monsterhunterwilds') && /1 h 4\\d min played/.test(document.querySelector('.play-rail-now')?.textContent ?? '')`, 3000), await ev(`document.querySelector('.play-rail-now')?.textContent ?? location.hash`));
check('and the warning arrives', await waitFor(`/15 minutes left to refund Monster Hunter Wilds/.test(document.querySelector('.ds-toast')?.textContent ?? '')`, 30000));

// ── 8. Existing phrases still route ──────────────────────────────────────────
console.log('\nExisting phrases');
// The settings reset above unpinned Nova; the composer is in the pinned panel.
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
await type('Catch me up on Cyberpunk 2077');
check('Catch Me Up still answers its own line', await waitFor(replyDone('Show my keyboard')) && (await speaker()).startsWith('Catch Me Up'));

check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

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

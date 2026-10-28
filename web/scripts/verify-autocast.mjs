// verify-autocast — "Autocast", start to finish (TH-509,
// docs/autocast-demo-plan.md). Run with `npm run verify -- autocast`.
//
//  1. THE FIXTURE, in Node (esbuild): the demo line reads as 8 × 6 s × 9:16;
//     the defaults and what was assumed; the best 8 by hype back in session
//     order; twelve moments, twelve crops.
//  2. THE RESET is idempotent: Autocast NOT added (the story starts without
//     it), no session, nothing playing, no saved clips, Nova unpinned and
//     the model off.
//  3. THE PITCH is NOVA's (the skill is not added): the plan card with the
//     sentence's numbers, Add / Not now. "Not now" leaves it off; asking
//     again pitches again.
//  4. THE CONSENT is Forge's own Add: the chip (and, in a second run, a typed
//     "yes") puts `autocast` in `trhs-agents` with a receipt, and AUTOCAST
//     speaks from here. The composer stays usable while the bar runs.
//  5. THE LAUNCH is real: Play opens on the game, the clock starts, the live
//     card counts and ticks, the panel's status line says so.
//  6. THE SESSION ENDS on its own, the clips are cut one by one, the eight
//     tiles land at 9:16, a toast says so, and no card is missing.
//  7. THE PLAYER: Review one by one opens the modal on clip 1; Approve moves
//     to 2; Discard dims a tile AND says so; Escape closes; a typed "approve
//     all" finishes and the approved ones are in the Gallery store.
//  8. THE GALLERY shows them — the Play page's and the game panel's thumbs.
//  9. TYPED, END TO END (second run): "yes", "launch game now", "end session
//     now" before the session's end, "discard all"; then "stop autocast"
//     removes it and the line is pitched by Nova again.
// 10. THE MODEL NEVER GATES A BEAT: model on, endpoint dead, the same pitch.
// 11. EXISTING PHRASES still route to their own recipes.
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The fixture, as the app has it ───────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'trhs-autocast-'));
// The routing layer reaches the whole app through the other recipes: assets
// load as nothing and Vite's `import.meta.glob` lists nothing (verify-agents).
const ASSETS = Object.fromEntries(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.glb', '.gltf', '.obj', '.mtl', '.fbx', '.hdr', '.css'].map((e) => [e, 'empty']));
const GLOB_SHIM = join(tmp, 'glob-shim.mjs');
writeFileSync(GLOB_SHIM, 'export const __viteGlob = () => ({});\n');
const load = async (entry, name) => {
  const outfile = join(tmp, name);
  await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    outfile,
    format: 'esm',
    platform: 'node',
    bundle: true,
    logLevel: 'silent',
    loader: ASSETS,
    define: { 'import.meta.glob': '__viteGlob' },
    inject: [GLOB_SHIM],
  });
  return import(outfile);
};
const F = await load('../src/data/autocast.ts', 'autocast.mjs');
const RS = await load('../src/agents/recipeScripts.ts', 'recipeScripts.mjs');
rmSync(tmp, { recursive: true, force: true });

// ── CDP ──────────────────────────────────────────────────────────────────────
const targets = await fetch(`http://localhost:${CDP_PORT}/json/list`).then((r) => r.json());
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error(`no page target on CDP ${CDP_PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
let msgId = 0;
const pending = new Map();
const pageErrors = [];
const consoleErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
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
const msgCount = () => ev(`document.querySelectorAll('.ds-chat-msg').length`);
const speaker = () => ev(`${lastMsg}?.querySelector('.ds-chat-msg-meta')?.textContent ?? ''`);
const replyText = () => ev(`(() => { const m = ${lastMsg}; if (!m) return ''; const c = m.cloneNode(true); c.querySelectorAll('[class*="meta"], button').forEach((e) => e.remove()); return c.innerText.trim(); })()`);
const type = (text) =>
  ev(`(() => { const t = document.querySelector('.nova-panel textarea'); if (!t) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(text)}); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
const clickButton = (text, scope = 'document') =>
  ev(`(() => { const b = [...${scope}.querySelectorAll('button')].reverse().find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`);
const escape = () => ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
/** Types a line and waits for its reply to finish. */
const ask = async (text) => {
  const n = await msgCount();
  await type(text);
  return waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n + 2} && ${lastMsg}?.dataset.status !== 'streaming'`, 15000);
};
/** Waits for the NEXT assistant message (a stage the watcher speaks) to finish. */
const nextStage = async (card, ms = 20000) => {
  const ok = await waitFor(`(() => { const m = ${lastMsg}; return !!m && m.classList.contains('assistant') && !!m.querySelector('[data-autocast=${JSON.stringify(card)}]') && m.dataset.status !== 'streaming'; })()`, ms);
  await sleep(200);
  return ok;
};
// A card by name. The plan and added cards are in the last message; the live,
// cutting and clips cards are one per run and may no longer be last.
const card = (name) => (['plan', 'added'].includes(name) ? `${lastMsg}?.querySelector('[data-autocast=${JSON.stringify(name)}]')` : `document.querySelector('[data-autocast=${JSON.stringify(name)}]')`);
const shot = async (name) => {
  if (!process.env.SHOTS_DIR) return;
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(process.env.SHOTS_DIR, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${process.env.SHOTS_DIR}/${name}.png`, Buffer.from(data, 'base64'));
};
const setSpeed = (speed) => ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova') ?? 'null'); if (s?.settings) { s.settings.demoSpeed = ${JSON.stringify(speed)}; localStorage.setItem('trhs-nova', JSON.stringify(s)); } return 1; })()`);
const reset = async () => {
  await go('/?demo=autocast');
  await sleep(500);
  await setSpeed('fast');
  await ev(`localStorage.setItem('novaPinned', '1'); 1`);
  await go('/');
  await waitFor(`!!document.querySelector('.nova-panel textarea')`, 5000);
};

const LINE = 'Record 8 highlight videos of 6 seconds in 9:16 format from my next game session';
const CARD_MISSING = () => consoleErrors.filter((e) => /Nova recipe card missing/.test(e));

// ── 1. The fixture ───────────────────────────────────────────────────────────
console.log('\nThe fixture');
const plan = F.parsePlan(LINE);
check('the demo line reads as 8 × 6 s × 9:16, next session, nothing assumed', plan && plan.count === 8 && plan.seconds === 6 && plan.aspect === '9:16' && plan.when === 'next' && plan.assumed.length === 0, JSON.stringify(plan));
const vague = F.parsePlan('clip my next game');
check('a vague ask gets the defaults and says what it assumed', vague && vague.count === 5 && vague.seconds === 15 && vague.aspect === '9:16' && JSON.stringify(vague.assumed) === '["count","length","format"]', JSON.stringify(vague));
check('"this session" is now', F.parsePlan('record 3 clips right now in this session')?.when === 'now');
check('a clip word without a session word is not a request', F.parsePlan('record a voice memo') === null && F.parsePlan('what is my next game') === null);
check('twelve moments, twelve crops', F.MOMENTS.length === 12 && F.CROPS.length === 12);
const keep = F.keepOf(F.MOMENTS.map((_, i) => i), 8);
const hypes = keep.map((i) => F.MOMENTS[i].hype);
check('the best 8 by hype, back in session order', keep.length === 8 && keep.every((v, i) => i === 0 || v > keep[i - 1]) && Math.min(...hypes) >= 72 && !keep.includes(1) && !keep.includes(5), JSON.stringify(keep));
check('the request routes to Autocast when it is added', RS.recipeScriptFor(LINE, { playedMin: () => 0, added: () => true })?.agentId === 'autocast');
check('and to Nova — no agent — when it is not', RS.recipeScriptFor(LINE, { playedMin: () => 0, added: () => false })?.agentId == null && !!RS.recipeScriptFor(LINE, { playedMin: () => 0, added: () => false }));

// ── 2. The reset ─────────────────────────────────────────────────────────────
console.log('\nThe reset');
await reset();
await reset();
check('Autocast is NOT added — the story starts without it', !((await store('trhs-agents')) ?? []).includes('autocast'), JSON.stringify(await store('trhs-agents')));
check('no session, no saved clips', ((await store('trhs-autocast'))?.phase ?? 'idle') === 'idle' && ((await store('trhs-gallery')) ?? []).length === 0);
check('Nova installed with the model off', (await store('trhs-modules'))?.nova === true && (await store('trhs-nova'))?.settings.llmEnabled === false);
check('the chat is empty', await ev(`!!document.querySelector('.nova-log-empty')`));

// ── 3. The pitch ─────────────────────────────────────────────────────────────
console.log('\nThe pitch is Nova’s');
check('the request is answered', await ask(LINE));
check('by Nova, not Autocast', (await speaker()).startsWith('Nova'), await speaker());
check('it names the skill and Forge', /needs Autocast, a clipping skill from Forge/.test(await replyText()), await replyText());
await shot('autocast-pitch');
const planCard = await ev(`(() => { const c = ${card('plan')}; return c ? [...c.querySelectorAll('dd')].map((d) => d.textContent.trim()) : null; })()`);
check('the plan card carries the sentence’s numbers', JSON.stringify(planCard) === JSON.stringify(['8 highlights', '6 seconds each', '9:16 vertical', 'Your next game session', 'Kills, clutches and big moments']), JSON.stringify(planCard));
check('Add Autocast and Not now are offered', await ev(`[...${lastMsg}.querySelectorAll('button')].map((b) => b.textContent.trim()).join('|')`) === 'Add Autocast|Not now');
check('Not now leaves it off', (await clickButton('Not now', lastMsg)) && (await waitFor(`/Autocast stays off/.test(${lastMsg}?.innerText ?? '')`, 8000)) && !((await store('trhs-agents')) ?? []).includes('autocast'));
check('asking again pitches again', (await ask(LINE)) && (await speaker()).startsWith('Nova') && !!(await ev(`!!${card('plan')}`)));

// ── 4. The consent ───────────────────────────────────────────────────────────
console.log('\nAdd Autocast — Forge’s own Add');
check('the chip is pressed', await clickButton('Add Autocast', lastMsg));
check('Autocast is added, with a receipt', (await waitFor(`(JSON.parse(localStorage.getItem('trhs-agents') ?? '[]')).includes('autocast')`, 5000)) && (await store('trhs-forge'))?.receipt?.autocast?.ver === '1.4.0', JSON.stringify((await store('trhs-forge'))?.receipt));
check('the session is armed', (await store('trhs-autocast'))?.phase === 'armed' && (await store('trhs-autocast'))?.plan?.count === 8);
check('the composer is usable while it installs', await ev(`document.querySelector('.nova-panel textarea')?.disabled !== true`));
check('and Autocast speaks from here', (await nextStage('added', 8000)) && (await speaker()).startsWith('Autocast'), await speaker());
// Quick, in this order: the game launches on its own 2.5 s after the arm.
check('the panel’s status line says armed', /Autocast · armed/.test(await ev(`document.querySelector('.novp-agent-status')?.textContent ?? ''`)), await ev(`document.querySelector('.novp-agent-status')?.textContent`));
check('Launch game now is offered', await ev(`[...${lastMsg}.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Launch game now')`));
check('the added card settles on what it can and cannot do', await waitFor(`(() => { const c = ${card('added')}; return !!c && !c.dataset.installing && /It can/.test(c.textContent) && /It cannot/.test(c.textContent); })()`, 2000));
await shot('autocast-added');

// ── 5. The launch ────────────────────────────────────────────────────────────
console.log('\nThe game launches on its own');
check('the live card arrives', await nextStage('live', 12000));
check('spoken by Autocast', (await speaker()).startsWith('Autocast'), await speaker());
check('Play opened on Cyberpunk 2077 — a real launch', await waitFor(`location.hash.includes('playing=cyberpunk')`, 3000), await ev('location.hash'));
check('the session is recording', (await store('trhs-autocast'))?.phase === 'recording');
const clock1 = await ev(`${card('live')}?.querySelector('.nova-autocast-clock')?.textContent`);
await sleep(1200);
const clock2 = await ev(`${card('live')}?.querySelector('.nova-autocast-clock')?.textContent`);
check('the clock runs', clock1 !== clock2, `${clock1} → ${clock2}`);
await shot('autocast-live');
check('moments tick in on the timeline', (await ev(`${card('live')}?.querySelectorAll('.nova-autocast-tick').length`)) > 0);
check('REC is said, not only shown', /REC/.test(await ev(`${card('live')}?.textContent ?? ''`)));
check('the status line is the clock, in red', await ev(`(() => { const b = document.querySelector('.novp-agent-status'); return !!b && /Autocast · \\d+:\\d\\d/.test(b.textContent) && b.classList.contains('danger'); })()`));
check('the composer is still usable', await ev(`document.querySelector('.nova-panel textarea')?.disabled !== true`));

// ── 6. The session ends, the cut, the clips ──────────────────────────────────
console.log('\nThe session ends and the clips land');
check('the cutting card arrives at the session’s end', await nextStage('cutting', 15000));
check('it says what was marked and what is kept', /12 moments marked\. Cutting your best 8 into 6-second 9:16 clips/.test(await replyText()), await replyText());
check('the live card now says ENDED, best in red', await ev(`(() => { const l = ${card('live')}; return !!l && /ENDED/.test(l.textContent) && l.querySelectorAll('.nova-autocast-tick.keep').length === 8; })()`));
check('eight rows are cut, one by one', await waitFor(`document.querySelector('[data-autocast="cutting"]')?.dataset.done === '8'`, 10000));
check('the clips card arrives', await nextStage('clips', 10000));
check('eight tiles at 9:16', (await ev(`${card('clips')}?.querySelectorAll('.nova-autocast-clip').length`)) === 8 && (await ev(`getComputedStyle(${card('clips')}.querySelector('.nova-autocast-clip')).aspectRatio`)) === '9 / 16');
check('each tile names its moment and its length', await ev(`[...${card('clips')}.querySelectorAll('.nova-autocast-clip')].every((b) => /Clip \\d: .+, 6 seconds/.test(b.getAttribute('aria-label')))`));
check('nothing posted, said in words', /nothing has been posted/i.test(await replyText()));
check('a toast says the clips are ready', await waitFor(`/clips are ready/.test(document.querySelector('.ds-toast')?.innerText ?? '')`, 5000));
check('the status line counts them', /Autocast · 8 clips ready/.test(await ev(`document.querySelector('.novp-agent-status')?.textContent ?? ''`)));
check('no recipe card is missing', CARD_MISSING().length === 0, CARD_MISSING().join(' | '));
await shot('autocast-clips');
await clickButton('Later', `document.querySelector('.ds-toast')`);

// ── 7. The player ────────────────────────────────────────────────────────────
console.log('\nThe player');
check('Review one by one opens clip 1', (await clickButton('Review one by one', lastMsg)) && (await waitFor(`location.hash.includes('modal=autocast-clip') && !!document.querySelector('.nova-autocast-frame')`, 5000)));
await sleep(600);
await shot('autocast-player');
check('titled as 1 of 8, its caption burned in', (await ev(`document.querySelector('.breadcrumb-current')?.textContent`)) === 'Clip 1 of 8' && (await ev(`document.querySelector('.nova-autocast-caption')?.textContent?.length > 0`)));
check('Approve moves to clip 2 and marks tile 1', (await clickButton('Approve', `document.querySelector('.modal-footer')`)) && (await waitFor(`location.hash.includes('i=1')`, 3000)) && (await ev(`document.querySelector('[data-autocast="clips"] [data-clip="0"]')?.dataset.status`)) === 'approved');
check('Discard moves to clip 3', (await clickButton('Discard', `document.querySelector('.modal-footer')`)) && (await waitFor(`location.hash.includes('i=2')`, 3000)), await ev('location.hash'));
const tile2 = `document.querySelector('[data-autocast="clips"] [data-clip="1"]')`;
check('and dims tile 2 AND says so', await waitFor(`(() => { const t = ${tile2}; return t?.dataset.status === 'discarded' && /Discarded/.test(t.textContent) && +getComputedStyle(t).opacity < 0.6; })()`, 3000), await ev(`(() => { const t = ${tile2}; return t ? t.dataset.status + ' ' + getComputedStyle(t).opacity + ' ' + t.textContent : 'no tile'; })()`));
check('the status line counts the decisions', /Autocast · 1\/7 approved/.test(await ev(`document.querySelector('.novp-agent-status')?.textContent ?? ''`)), await ev(`document.querySelector('.novp-agent-status')?.textContent`));
check('Escape closes the player', (await escape(), await waitFor(`!document.querySelector('.nova-autocast-frame') && !location.hash.includes('modal=')`, 3000)));
// A document-level Escape also unpins Nova (AppShell's listener — pre-existing
// for any feature modal over a pinned Nova); pin it back for the typed line.
await ev(`(document.querySelector('.nova-fab .ds-fab') ?? document.querySelector('.shell-util button[aria-label="Ask Nova"]'))?.click(); 1`);
await waitFor(`!!document.querySelector('.nova-panel.open textarea')`, 3000);
check('a typed "approve all" finishes', (await ask('approve all')) && /7 clips approved and saved to Gallery under Cyberpunk 2077/.test(await replyText()), await replyText());
check('the session is done and the seven are in the Gallery store', (await store('trhs-autocast'))?.phase === 'done' && ((await store('trhs-gallery')) ?? []).length === 7, JSON.stringify(((await store('trhs-gallery')) ?? []).length));
check('the status line is clear', await ev(`!document.querySelector('.novp-agent-status')`));

// ── 8. The gallery ───────────────────────────────────────────────────────────
console.log('\nThe Gallery has them');
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/play?section=gallery&gallery=cyberpunk');
check('the Play page’s Gallery counts them — seven of yours and the fixture’s one', await waitFor(`/8 captures of Cyberpunk 2077/.test(document.querySelector('.gal-filter')?.innerText ?? '')`, 5000), await ev(`document.querySelector('.gal-filter')?.innerText`));
check('as clips by you', (await ev(`document.querySelectorAll('.gal-tile[data-clip]').length`)) === 7 && /by You · Clip/.test(await ev(`document.querySelector('.gal-tile[data-clip] .gal-sub')?.textContent ?? ''`)));
await go('/play?game=cyberpunk');
check('and the game panel’s thumbs', await waitFor(`document.querySelectorAll('.game-panel.open .gp-thumb').length >= 8`, 5000), await ev(`document.querySelectorAll('.game-panel.open .gp-thumb').length`));
check('the panel offers "Clip my next session"', await ev(`!!document.querySelector('.game-panel [data-action="autocast:clip"]')`));

// ── 9. Typed, end to end ─────────────────────────────────────────────────────
console.log('\nTyped end to end — yes, launch, end early, discard, stop');
await reset();
check('the pitch', (await ask(LINE)) && (await speaker()).startsWith('Nova'));
check('a typed "yes" adds it', (await ask('yes')) && ((await store('trhs-agents')) ?? []).includes('autocast') && (await speaker()).startsWith('Autocast'), await speaker());
check('a typed "launch game now" launches', (await ask('launch game now')) && (await waitFor(`location.hash.includes('playing=cyberpunk')`, 3000)) && (await store('trhs-autocast'))?.phase === 'recording');
await sleep(1500);
check('a typed "end session now" ends it early', (await ask('end session now')) && (await store('trhs-autocast'))?.phase === 'cutting' && /Good session — .* of Cyberpunk 2077, \d+ moments? marked/.test(await replyText()), await replyText());
check('fewer moments, fewer clips — but at least one', (await nextStage('clips', 15000)) && (await ev(`${card('clips')}?.querySelectorAll('.nova-autocast-clip').length`)) >= 1 && (await ev(`${card('clips')}?.querySelectorAll('.nova-autocast-clip').length`)) < 8);
await clickButton('Later', `document.querySelector('.ds-toast')`);
check('a typed "discard all" saves nothing', (await ask('discard all')) && /All clips discarded/.test(await replyText()) && ((await store('trhs-gallery')) ?? []).length === 0);
check('"stop autocast" removes it from Forge', (await ask('stop autocast')) && !((await store('trhs-agents')) ?? []).includes('autocast') && ((await store('trhs-autocast'))?.phase ?? 'idle') === 'idle');
check('and the line is pitched by Nova again', (await ask(LINE)) && (await speaker()).startsWith('Nova') && !!(await ev(`!!${card('plan')}`)));
check('"What is Autocast?" is answered', (await ask('What is Autocast?')) && /clipping skill from Forge/.test(await replyText()));

// ── 10. The model never gates a beat ─────────────────────────────────────────
console.log('\nWith the model on and its endpoint dead');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = true; s.settings.endpoint = 'http://localhost:9/v1/chat/completions'; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);
await go('/');
await waitFor(`!!document.querySelector('.nova-panel textarea')`, 5000);
check('the same pitch, word for word', (await ask(LINE)) && (await speaker()).startsWith('Nova') && /needs Autocast, a clipping skill from Forge/.test(await replyText()) && !!(await ev(`!!${card('plan')}`)));
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = false; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);

// ── 11. Existing phrases ─────────────────────────────────────────────────────
console.log('\nExisting phrases still route to their own recipes');
await ev(`localStorage.setItem('trhs-agents', JSON.stringify(['catch-me-up', 'did-i-just-waste-my-money', 'who-made-this'])); 1`);
await go('/');
await waitFor(`!!document.querySelector('.nova-panel textarea')`, 5000);
for (const r of RS.RECIPE_SCRIPTS.filter((x) => x.id !== 'autocast')) {
  const line = r.examples[0];
  await ask(line);
  check(`“${line}” → ${r.id}`, !(await speaker()).startsWith('Autocast') && !(await speaker()).startsWith('Nova ·'), await speaker());
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await go('/?demo=autocast');
await ev(`localStorage.clear(); 1`).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
ws.close();
process.exit(failed.length ? 1 : 0);

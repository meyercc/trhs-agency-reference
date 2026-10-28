// verify-who-made-this — "Who Made This", start to finish
// (docs/who-made-this-demo-plan.md). Run with `npm run verify -- who-made-this`.
//
//  1. THE FIXTURE, in Node (esbuild): every credit's game is a catalog game,
//     every billed person has a credit in that game, the one library link the
//     real credits give (Jennifer English: Baldur's Gate 3 ↔ Elden Ring) is
//     found, and the matchers read a game, a person and a character. Routing:
//     the three question words pick the three sections, "it" means the game
//     just named, and the other recipes' lines still reach them.
//  2. THE RESET is idempotent: the agent added, Nova installed and unpinned
//     with the model off, no rehearsal cards; your own board survives.
//  3. THE HERO RAIL BUTTON asks the question; the reply is the agent's, in
//     its voice, with the credits card — cast in billing order, crew by
//     department — and pressing a person's row asks about them.
//  4. THE LIBRARY LINK: a cast row says "Also in Elden Ring" in words; the
//     person card badges the owned game and offers to play it.
//  5. A CHARACTER and a CREW question each get their own card.
//  6. THE MODEL NEVER GATES A BEAT: model on, endpoint dead, same reply.
//  7. KEEP IN VIEW: the overlay holds the compact card; on the board the block
//     is the binding's measured height, spills nothing, ends on one line with
//     its neighbour, and a pressed row pins Nova and asks.
//  8. THE TILE MENU row asks too. 9. EXISTING PHRASES still route.
//
// Set SHOTS_DIR to a folder to also save screenshots of the cards (both themes).
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const SHOTS_DIR = process.env.SHOTS_DIR || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

// ── 1. The fixture and the routing, as the app has them ──────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'trhs-wmt-'));
const ASSETS = Object.fromEntries(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.glb', '.gltf', '.obj', '.mtl', '.fbx', '.hdr', '.css'].map((e) => [e, 'empty']));
const GLOB_SHIM = join(tmp, 'glob-shim.mjs');
writeFileSync(GLOB_SHIM, 'export const __viteGlob = () => ({});\n');
const load = async (entry, name) => {
  const outfile = join(tmp, name);
  await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], outfile, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent', loader: ASSETS, define: { 'import.meta.glob': '__viteGlob' }, inject: [GLOB_SHIM] });
  return import(outfile);
};
const F = await load('../src/data/credits.ts', 'credits.mjs');
const Gm = await load('../src/data/games.ts', 'games.mjs');
const RS = await load('../src/agents/recipeScripts.ts', 'recipeScripts.mjs');
const B = await load('../src/state/bindings.ts', 'bindings.mjs');
rmSync(tmp, { recursive: true, force: true });
const ROW_H = B.BINDINGS['credits'].height.rows;
const AGENT = 'who-made-this';
const gameIds = new Set(Gm.GAMES.map((g) => g.id));

console.log('\nThe fixture');
check('every game with credits is a catalog game', F.GAME_CREDITS.every((c) => gameIds.has(c.gameId)), F.GAME_CREDITS.map((c) => c.gameId).join(','));
check('every credit that names a catalog id names a real one', F.PEOPLE.every((p) => p.credits.every((c) => !c.gameId || gameIds.has(c.gameId))));
check('every billed person exists and has a credit in that game', F.GAME_CREDITS.every((g) => [...g.cast, ...g.crew].every((id) => F.PERSON_BY_ID[id] && F.creditIn(F.PERSON_BY_ID[id], g.gameId))));
check('cast rows are cast credits, crew rows are not', F.GAME_CREDITS.every((g) => g.cast.every((id) => F.creditIn(F.PERSON_BY_ID[id], g.gameId).dept === 'cast') && g.crew.every((id) => F.creditIn(F.PERSON_BY_ID[id], g.gameId).dept !== 'cast')));
check('person ids are unique', new Set(F.PEOPLE.map((p) => p.id)).size === F.PEOPLE.length);
check('Cyberpunk bills Keanu Reeves first, as Johnny Silverhand', F.castOf('cyberpunk')[0]?.person.id === 'keanu-reeves' && F.castOf('cyberpunk')[0]?.role === 'Johnny Silverhand');
check('the library link: Jennifer English, Baldur’s Gate 3 → Elden Ring', JSON.stringify(F.alsoOwned(F.PERSON_BY_ID['jennifer-english'], 'baldursgate3').map((c) => c.gameId)) === '["eldenring"]');
check('…and back', JSON.stringify(F.alsoOwned(F.PERSON_BY_ID['jennifer-english'], 'eldenring').map((c) => c.gameId)) === '["baldursgate3"]');
check('a person’s filmography lists this game first, then newest first', JSON.stringify(F.filmography(F.PERSON_BY_ID['erica-lindbeck'], 'cyberpunk').map((c) => c.year)) === '[2020,2020,2019,2017]');
check('crew groups follow the department order', JSON.stringify(F.crewOf('cyberpunk').map((g) => g.dept)) === '["direction","writing","art","music"]', JSON.stringify(F.crewOf('cyberpunk').map((g) => g.dept)));
check('creditsFor reads a game by alias', F.creditsFor("Who's in Baldur’s Gate 3?")?.gameId === 'baldursgate3' && F.creditsFor('who made bg3')?.gameId === 'baldursgate3' && F.creditsFor('who made this')=== null);
check('personFor reads a name, longest match', F.personFor('What else has Erica Lindbeck been in?')?.id === 'erica-lindbeck' && F.personFor('more from miyazaki')?.id === 'hidetaka-miyazaki' && F.personFor('who made it') === null);
check('characterFor reads a character', F.characterFor('Who voices Johnny Silverhand?')?.person.id === 'keanu-reeves' && F.characterFor('who plays shadowheart')?.person.id === 'jennifer-english');
check('…but not the one-letter V inside a word', F.characterFor('who voices everyone') === null);
check('initials: KR, GM, PA', F.initialsOf('Keanu Reeves') === 'KR' && F.initialsOf('George R. R. Martin') === 'GM' && F.initialsOf('P.T. Adamczyk') === 'PA' && F.initialsOf('Paul Leonard-Morgan') === 'PM');

console.log('\nThe routing');
const ctx = { playedMin: () => 0, added: () => true };
const route = (t) => RS.recipeScriptFor(t, ctx);
const card = (s) => s?.steps.find((st) => st.agentCard)?.agentCard;
let s = route('Who made Cyberpunk 2077?');
check('"who made X" → the agent, the whole credits card', s?.agentId === AGENT && card(s)?.card === 'credits' && card(s)?.props.section === 'all', JSON.stringify(card(s)));
s = route("Who's in Cyberpunk 2077?");
check('"who’s in X" → the cast', card(s)?.props.section === 'cast');
s = route('Who composed it?');
check('"who composed it" → the crew of the game just named', s?.agentId === AGENT && card(s)?.props.section === 'crew' && card(s)?.props.gameId === 'cyberpunk', JSON.stringify(card(s)));
s = route('What else has Erica Lindbeck been in?');
check('a person → their card, from that game', card(s)?.card === 'person' && card(s)?.props.personId === 'erica-lindbeck' && card(s)?.props.from === 'cyberpunk', JSON.stringify(card(s)));
s = route('Who voices Johnny Silverhand?');
check('a character → the person who plays them', card(s)?.card === 'person' && card(s)?.props.personId === 'keanu-reeves');
s = route("Who's in Baldur's Gate 3?");
check('a cast reply offers the person with the library link', s?.steps.some((st) => st.label === 'What else has Jennifer English been in?'), JSON.stringify(s?.steps.filter((st) => st.offer).map((st) => st.label)));
check('…and keep-in-view with the GAME as subject', s?.steps.some((st) => st.offer?.type === 'addCard' && st.offer.spec.items[0]?.bind === 'credits' && st.offer.spec.items[0]?.subject === 'baldursgate3'));
s = route('What else has Jennifer English been in?');
check('her card offers to play the owned game', s?.steps.some((st) => st.offer?.type === 'resumeGame' && st.offer.gameId === 'eldenring'), JSON.stringify(s?.steps.filter((st) => st.offer).map((st) => st.label)));
check('no reply asks the model', [route('Who made Elden Ring?'), route('Who composed Elden Ring?'), route('Who is Adam Smith?')].every((x) => x?.agentId === AGENT && !x.refine));
check('a line that names nothing it knows is left to the others', route('Who made the universe?') === null && route('what else is on') === null);
check('Catch Me Up still owns its line', route('Catch me up on Cyberpunk 2077')?.agentId === 'catch-me-up');
check('the refund agent still owns its line', route('How do I refund Monster Hunter Wilds?')?.agentId === 'did-i-just-waste-my-money');
check('not added from Forge → it does not answer', RS.recipeScriptFor('Who made Cyberpunk 2077?', { playedMin: () => 0, added: (id) => id !== AGENT }) === null);

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
const replyDone = (label) => `(() => { const m = ${lastMsg}; return !!m && m.dataset.status !== 'streaming' && [...m.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(label)}); })()`;
const clickButton = (text, scope = 'document') =>
  ev(`(() => { const b = [...${scope}.querySelectorAll('button')].reverse().find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`);
const type = (text) =>
  ev(`(() => { const t = document.querySelector('.nova-panel textarea') ?? document.querySelector('textarea'); if (!t) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(text)}); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
const speaker = () => ev(`${lastMsg}?.querySelector('.ds-chat-msg-meta, [class*="meta"]')?.textContent ?? ''`);
const msgCount = () => ev(`document.querySelectorAll('.ds-chat-msg').length`);
// What the reply SAYS — no meta line, no chips, no card.
const saidText = () => ev(`(() => { const m = ${lastMsg}; if (!m) return ''; const c = m.cloneNode(true); c.querySelectorAll('[class*="meta"], button, .nova-recap').forEach((e) => e.remove()); return c.innerText.trim(); })()`);
const inLast = (sel) => `${lastMsg}?.querySelector(${JSON.stringify(sel)})`;
const rows = (sel) => ev(`[...(${lastMsg}?.querySelectorAll(${JSON.stringify(sel)}) ?? [])].map((r) => r.dataset.person ?? r.dataset.credit ?? r.innerText)`);
const pinned = (on) => ev(`localStorage.setItem('novaPinned', ${on ? "'1'" : "'0'"}); 1`);
// The viewport, with the element scrolled into view — a clip inside the
// scrolled Nova panel came out offset.
const shot = async (name, sel) => {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const found = await ev(`(() => { const e = ${sel}; if (!e) return false; e.scrollIntoView({ block: 'start' }); return true; })()`);
  if (!found) return;
  await sleep(250);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS_DIR, `${name}.png`), Buffer.from(data, 'base64'));
};

// ── 2. The reset ─────────────────────────────────────────────────────────────
console.log('\nThe reset');
await go('/');
await ev(`localStorage.clear(); 1`);
await go('/?demo=who-made-this');
await go('/?demo=who-made-this');
check('the param is stripped after the reset', !(await ev('location.hash')).includes('demo='));
check('the agent is added, once', JSON.stringify(((await store('trhs-agents')) ?? []).filter((x) => x === AGENT)) === JSON.stringify([AGENT]), JSON.stringify(await store('trhs-agents')));
check('Nova installed and unpinned, the model off', (await store('trhs-modules'))?.nova === true && (await ev(`localStorage.getItem('novaPinned')`)) === '0' && (await store('trhs-nova'))?.settings.llmEnabled === false);
{
  await go('/');
  const rendered = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  const stored = (await store('board-layout')) ?? [];
  const byId = Object.fromEntries(stored.map((i) => [i.id, i]));
  const mine = rendered.slice().reverse();
  await ev(`localStorage.setItem('board-layout', ${JSON.stringify(JSON.stringify(mine.map((id) => byId[id] ?? { id, span: 2, rows: 1 })))}); localStorage.setItem('overlays', JSON.stringify([{ id: 'ov-rehearsal', title: 'Cyberpunk 2077 — Cast & crew', items: [{ kind: 'bound', bind: 'credits', subject: 'cyberpunk' }], x: 24, y: 96, visible: true, createdAt: 1 }])); 1`);
  await go('/');
  const seeded = await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`);
  await go('/?demo=who-made-this');
  await go('/');
  check('the reset keeps your own board exactly', JSON.stringify(await ev(`[...document.querySelectorAll('.wb-cell')].map((c) => c.dataset.widget).filter(Boolean)`)) === JSON.stringify(seeded));
  check('and clears the credits overlay a rehearsal placed', !((await store('overlays')) ?? []).some((o) => o.id === 'ov-rehearsal'));
}
// Instant replies from here on.
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.demoSpeed = 'instant'; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);

// ── 3. The hero rail button ──────────────────────────────────────────────────
console.log('\nFrom the Play hero');
await go('/play?playing=cyberpunk');
check('the slide is held on Cyberpunk 2077', await waitFor(`document.querySelector('.play-hero-slide.active')?.dataset.slide === 'cyberpunk'`, 3000));
check('"Who made this?" is a button on the rail, labelled with the game', await ev(`document.querySelector('.play-rail-card button[aria-label="Who made Cyberpunk 2077?"]')?.textContent.trim() === 'Who made this?'`));
check('it is not offered for a game without credits', await ev(`(() => { [...document.querySelectorAll('.play-rail-thumb')].find((b) => /League of Legends/.test(b.getAttribute('aria-label')))?.click(); return true; })()`) && (await waitFor(`document.querySelector('.play-hero-slide.active')?.dataset.slide === 'lol' && !document.querySelector('.play-rail-card button[aria-label^="Who made"]')`, 3000)));
await ev(`[...document.querySelectorAll('.play-rail-thumb')].find((b) => /Cyberpunk/.test(b.getAttribute('aria-label')))?.click(); 1`);
await sleep(300);
check('pressing it opens Nova', (await clickButton('Who made this?', `document.querySelector('.play-rail-card')`)) && (await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000)));
check('and the agent answers, with the chips', await waitFor(replyDone('Show as overlay')));
check('spoken by Who Made This', (await speaker()).startsWith('Who Made This'), await speaker());
const said = await saidText();
check('in its voice, the game and its year first', said.startsWith('Rolling credits. Cyberpunk 2077 (2020). Keanu Reeves is Johnny Silverhand and Idris Elba is Solomon Reed;'), said.slice(0, 120));
check('names who directed it and who wrote the music', /Adam Badowski and Gabe Amatangelo directed it, and the music is by Marcin Przybyłowicz, P\.T\. Adamczyk and Paul Leonard-Morgan\./.test(said), said);
check('no exclamation marks', !said.includes('!'));
check('scripted, not the model', (await ev(`${lastMsg}?.dataset.source`)) === 'scripted');
check('the credits card, whole', await ev(`!!${inLast('.nova-recap[data-credits="cyberpunk"][data-section="all"]')}`));
check('the cast in billing order', JSON.stringify(await rows('[data-section="all"] [data-person]')).startsWith(JSON.stringify(F.GAME_CREDITS[0].cast).slice(0, -1)), JSON.stringify(await rows('[data-section="all"] [data-person]')));
check('then the crew by department', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('.nova-recap-h') ?? [])].map((h) => h.textContent)`)) === '["Voice cast","Direction","Writing","Art","Music"]', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('.nova-recap-h') ?? [])].map((h) => h.textContent)`)));
check('each person wears a monogram, not a photo', (await ev(`${lastMsg}?.querySelectorAll('[data-person] .ds-avatar.initials').length`)) === 14 && (await ev(`${lastMsg}?.querySelector('[data-person="keanu-reeves"] .ds-avatar-initials')?.textContent`)) === 'KR');
check('a row with more credits says how many', /\+3 games/.test(await ev(`${inLast('[data-person="erica-lindbeck"]')}?.innerText ?? ''`)));
check('rows are buttons the keyboard can press', (await ev(`${inLast('[data-person="erica-lindbeck"]')}?.getAttribute('role')`)) === 'button' && (await ev(`${inLast('[data-person="erica-lindbeck"]')}?.tabIndex`)) === 0);
await shot('credits-all-dark', inLast('.nova-recap[data-credits]'));
check('pressing Erica Lindbeck asks about her', await ev(`(() => { const r = ${inLast('[data-person="erica-lindbeck"]')}; if (!r) return false; r.click(); return true; })()`) && (await waitFor(replyDone('Who made Cyberpunk 2077?'))));
check('her card: Judy here, then Persona 5, Mortal Kombat 11 and FF VII Remake', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('[data-person-card="erica-lindbeck"] .ds-list-item-label') ?? [])].map((l) => l.textContent)`)) === '["Cyberpunk 2077","Final Fantasy VII Remake","Mortal Kombat 11","Persona 5"]', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('[data-person-card] .ds-list-item-label') ?? [])].map((l) => l.textContent)`)));
check('the games we do not carry show an empty cover; no badge anywhere', (await ev(`${lastMsg}?.querySelectorAll('[data-person-card] .nova-credits-nocover').length`)) === 3 && (await ev(`${lastMsg}?.querySelectorAll('[data-person-card] .ds-badge').length`)) === 0);
check('it says what it has', /^Rolling credits\. Erica Lindbeck is Judy Alvarez in Cyberpunk 2077\. Elsewhere: Jessie Rasberry in Final Fantasy VII Remake, Cassie Cage in Mortal Kombat 11 and Futaba Sakura in Persona 5\./.test(await saidText()), (await saidText()).slice(0, 200));
check('and offers the way back', await ev(`[...(${lastMsg}?.querySelectorAll('button') ?? [])].some((b) => b.textContent.trim() === 'Who else is in Cyberpunk 2077?')`));
await shot('person-dark', inLast('.nova-recap[data-person-card]'));

// ── 4. The library link ──────────────────────────────────────────────────────
console.log('\nThe library link');
await type("Who's in Baldur's Gate 3?");
check('the cast card arrives', await waitFor(replyDone('What else has Jennifer English been in?')) && (await ev(`!!${inLast('[data-credits="baldursgate3"][data-section="cast"]')}`)));
check('Jennifer English’s row says "Also in Elden Ring", in words', (await ev(`${inLast('[data-person="jennifer-english"] .ds-badge')}?.textContent`)) === 'Also in Elden Ring');
check('the reply says so too', /Jennifer English is also in Elden Ring, which you own\./.test(await saidText()), await saidText());
check('only the cast — no crew headings', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('.nova-recap-h') ?? [])].map((h) => h.textContent)`)) === '["Voice cast"]');
check('pressing her row', await ev(`(() => { const r = ${inLast('[data-person="jennifer-english"]')}; r?.click(); return !!r; })()`) && (await waitFor(replyDone('Play Elden Ring'))));
check('her card badges the other owned game, in a word, and not this one', (await ev(`${lastMsg}?.querySelector('[data-credit="eldenring"] .ds-badge')?.textContent`)) === 'Owned' && !(await ev(`!!${lastMsg}?.querySelector('[data-credit="baldursgate3"] .ds-badge')`)));
check('…with its cover', await ev(`!!${lastMsg}?.querySelector('[data-credit="eldenring"] img.cb-cover')`));
check('and says it is in your library', /Elden Ring is in your library\./.test(await saidText()));
await shot('person-linked-dark', inLast('.nova-recap[data-person-card]'));

// ── 5. A character; the crew alone ───────────────────────────────────────────
console.log('\nA character, and the crew');
await type('Who voices Johnny Silverhand?');
check('Johnny Silverhand → Keanu Reeves', await waitFor(replyDone('Who else is in Cyberpunk 2077?')) && (await ev(`!!${inLast('[data-person-card="keanu-reeves"]')}`)));
check('who is known from films', /Keanu Reeves is Johnny Silverhand in Cyberpunk 2077\. That is the only game credit I have for them\. Outside games you may know them from The Matrix, John Wick\./.test(await saidText()), await saidText());
await type('Who composed Elden Ring?');
check('the crew card alone', await waitFor(replyDone("Who's in it?")) && (await ev(`!!${inLast('[data-credits="eldenring"][data-section="crew"]')}`)));
check('by department, cast absent', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('.nova-recap-h') ?? [])].map((h) => h.textContent)`)) === '["Direction","Writing","Music"]', JSON.stringify(await ev(`[...(${lastMsg}?.querySelectorAll('.nova-recap-h') ?? [])].map((h) => h.textContent)`)));
check('Miyazaki’s row counts his other games', /\+3 games/.test(await ev(`${inLast('[data-person="hidetaka-miyazaki"]')}?.innerText ?? ''`)));
const crewSaid = await saidText();
check('the sentence, the name keeping its capital', /Elden Ring \(2022\) — Hidetaka Miyazaki and Yui Tanimura directed it, and the music is by Yuka Kitamura\./.test(crewSaid), crewSaid);
await type("Who's in it?");
check('"it" is the game just named', await waitFor(replyDone('Who made it?')) && (await ev(`!!${inLast('[data-credits="eldenring"][data-section="cast"]')}`)));
await shot('crew-dark', `document.querySelector('[data-credits="eldenring"][data-section="crew"]')`);

// ── 6. The model never gates a beat ──────────────────────────────────────────
console.log('\nWith the model on and its endpoint dead');
// The hero-rail reply's words, to compare against.
const baseline = await ev(`(() => { const m = [...document.querySelectorAll('.ds-chat-msg')].find((x) => x.querySelector('[data-credits="cyberpunk"][data-section="all"]')); if (!m) return ''; const c = m.cloneNode(true); c.querySelectorAll('[class*="meta"], button, .nova-recap').forEach((e) => e.remove()); return c.innerText.trim(); })()`);
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = true; s.settings.endpoint = 'http://localhost:9/v1/chat/completions'; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);
await pinned(true);
await go('/');
const n0 = await msgCount();
await type('Who made Cyberpunk 2077?');
await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n0 + 2}`, 5000);
check('the same reply arrives', await waitFor(replyDone('Show as overlay')));
check('word for word', (await saidText()) === baseline, `${(await saidText()).slice(0, 120)} ≠ ${baseline.slice(0, 120)}`);
check('still scripted', (await ev(`${lastMsg}?.dataset.source`)) === 'scripted');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova')); s.settings.llmEnabled = false; localStorage.setItem('trhs-nova', JSON.stringify(s)); return 1; })()`);

// ── 7. Keep in view ──────────────────────────────────────────────────────────
console.log('\nKeep it in view');
check('Show as overlay places it', await clickButton('Show as overlay', lastMsg));
check('a "Cast & crew" HUD with the compact card, for the game', await waitFor(`(() => { const b = document.querySelector('[data-block="credits"] .nova-recap.bare[data-credits="cyberpunk"][data-section="summary"]'); return !!b && !b.closest('.ds-chat-msg') && b.querySelectorAll('[data-person]').length === 2 && /Directed by Adam Badowski/.test(b.textContent); })()`, 3000));
check('Add to dashboard', await clickButton('Add to dashboard', lastMsg));
await pinned(false);
await go('/');
await ev(`document.querySelector('.wb-cell [data-block="credits"]')?.scrollIntoView({ block: 'center' }); 1`);
await sleep(500);
const board = await ev(`(() => { const b = document.querySelector('.wb-cell [data-block="credits"]'); if (!b) return null; const cell = b.closest('.wb-cell'); const cr = cell.getBoundingClientRect(); const br = b.getBoundingClientRect(); return { h: Math.round(br.height), inside: br.top >= cr.top - 1 && br.bottom <= cr.bottom + 1, bottom: Math.round(cr.bottom), peers: [...document.querySelectorAll('.wb-cell')].filter((c) => c !== cell && Math.abs(c.getBoundingClientRect().top - cr.top) < 4).map((c) => Math.round(c.getBoundingClientRect().bottom)), clip: [...b.querySelectorAll('*')].some((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflow !== 'visible'), title: cell.querySelector('.ds-widget-title, [class*="title"]')?.textContent }; })()`);
check('the widget is on Home', !!board, 'no cell holds the credits block');
check(`at the binding's measured ${ROW_H}px (measured now: ${board?.h})`, board && Math.abs(board.h - ROW_H) <= 2, JSON.stringify(board));
check('inside its cell — nothing spills', board?.inside && !board?.clip, JSON.stringify(board));
check('and it ends on one line with its row neighbour', board && board.peers.every((p) => p === board.bottom), JSON.stringify(board));
await shot('board-dark', `document.querySelector('.wb-cell [data-block="credits"]')?.closest('.wb-cell')`);
check('a pressed row on the board pins Nova and asks', await ev(`(() => { const r = document.querySelector('.wb-cell [data-block="credits"] [data-person="keanu-reeves"]'); r?.click(); return !!r; })()`) && (await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000)) && (await waitFor(replyDone('Who else is in Cyberpunk 2077?'))) && (await ev(`!!${inLast('[data-person-card="keanu-reeves"]')}`)));
// The light theme: the monogram and the badges must read there too.
await ev(`localStorage.setItem('theme', 'light'); 1`);
await go('/');
check('the light theme applied', await waitFor(`document.documentElement.classList.contains('light')`, 3000), await ev(`document.documentElement.className`));
await ev(`document.querySelector('.wb-cell [data-block="credits"]')?.scrollIntoView({ block: 'center' }); 1`);
await sleep(300);
await shot('board-light', `document.querySelector('.wb-cell [data-block="credits"]')?.closest('.wb-cell')`);
await shot('person-light', `[...document.querySelectorAll('.nova-recap[data-person-card]')].pop()`);
await ev(`localStorage.setItem('theme', 'dark'); 1`);

// ── 8. The tile menu ─────────────────────────────────────────────────────────
console.log('\nFrom a My Games tile');
await go('/?demo=who-made-this');
await go('/play');
check('the Cyberpunk tile has a menu', await ev(`(() => { const t = [...document.querySelectorAll('.ds-tile')].find((e) => /Cyberpunk/.test(e.getAttribute('aria-label') || e.textContent)); const b = t?.querySelector('button[aria-label="More options"]'); if (!b) return false; b.click(); return true; })()`));
check('with a "Who made this?" row', await waitFor(`[...document.querySelectorAll('.gtm-pop [role="menuitem"]')].some((r) => r.textContent.trim() === 'Who made this?')`, 3000));
check('that opens Nova on the answer', await ev(`(() => { const r = [...document.querySelectorAll('.gtm-pop [role="menuitem"]')].find((r) => r.textContent.trim() === 'Who made this?'); r?.click(); return !!r; })()`) && (await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000)) && (await waitFor(replyDone('Show as overlay'))) && (await ev(`!!${inLast('[data-credits="cyberpunk"][data-section="all"]')}`)));
check('a game without credits gets no row', await ev(`(() => { const t = [...document.querySelectorAll('.ds-tile')].find((e) => /Valorant/.test(e.getAttribute('aria-label') || e.textContent)); const b = t?.querySelector('button[aria-label="More options"]'); if (!b) return false; b.click(); return true; })()`) && (await waitFor(`document.querySelector('.gtm-pop') && ![...document.querySelectorAll('.gtm-pop [role="menuitem"]')].some((r) => r.textContent.trim() === 'Who made this?')`, 3000)));

// ── 8a. Removed in Forge (Chris, 2026-10-26) ─────────────────────────────────
console.log('\nRemoved in Forge');
await ev(`localStorage.setItem('trhs-agents', '[]'); 1`);
await go('/play?playing=cyberpunk');
check('the rail button is gone', await waitFor(`document.querySelector('.play-hero-slide.active')?.dataset.slide === 'cyberpunk'`, 3000) && !(await ev(`!!document.querySelector('.play-rail-card button[aria-label^="Who made"]')`)));
check('the tile menu has no row', await ev(`(() => { const t = [...document.querySelectorAll('.ds-tile')].find((e) => /Cyberpunk/.test(e.getAttribute('aria-label') || e.textContent)); const b = t?.querySelector('button[aria-label="More options"]'); if (!b) return false; b.click(); return true; })()`) && (await waitFor(`document.querySelector('.gtm-pop') && ![...document.querySelectorAll('.gtm-pop [role="menuitem"]')].some((r) => r.textContent.trim() === 'Who made this?')`, 3000)));
await pinned(true);
await go('/');
{
  const n = await msgCount();
  await type('Who made Cyberpunk 2077?');
  await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n + 2} && ${lastMsg}?.dataset.status !== 'streaming'`, 20000);
  await sleep(600);
  check('and the line is no longer its', !(await speaker()).startsWith('Who Made This'), await speaker());
}
check('a reload keeps it removed — an empty list is a choice, not a first run', JSON.stringify(await ev(`JSON.parse(localStorage.getItem('trhs-agents'))`)) === '[]');
await go('/?demo=who-made-this');
check('the reset adds it back', ((await store('trhs-agents')) ?? []).includes(AGENT));
// Back to a first run: the other recipes below need their agents added too.
await ev(`localStorage.removeItem('trhs-agents'); 1`);

// ── 9. Existing phrases still route ──────────────────────────────────────────
console.log('\nExisting phrases');
await pinned(true);
await go('/');
await type('Catch me up on Cyberpunk 2077');
check('Catch Me Up still answers its own line', await waitFor(replyDone('Show my keyboard')) && (await speaker()).startsWith('Catch Me Up'));
await type('How do I refund Monster Hunter Wilds?');
check('the refund agent still answers its own line', await waitFor(replyDone('Open Steam refunds (help.steampowered.com)')) && (await speaker()).startsWith('Did I Just Waste My Money'));

check('no recipe card or block went missing', !consoleErrors.some((e) => /Nova recipe (card|block) missing/.test(e)), consoleErrors.filter((e) => /recipe/.test(e)).slice(0, 2).join(' | '));
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

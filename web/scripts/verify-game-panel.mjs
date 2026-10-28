// verify-game-panel — the game detail panel, start to finish (TH-504,
// docs/game-panel.md; Figma scratchpad-2026 274:10305). Run with
// `npm run verify -- game-panel`.
//
//  1. THE DATA, in Node (esbuild): every game has a valid release date; every
//     gallery image that names a game names a catalog one; the seed
//     collections name catalog games.
//  2. THE RAIL: `?game=<id>` opens the panel in the Devices flyout's slot, the
//     shell reserves its width, ✕ and Esc close it and clear the param, focus
//     returns to the opener, Devices takes the rail from it and it takes the
//     rail from Devices, pinning Nova puts it away, an unknown id shows nothing.
//  3. OPENING IT: a library tile press opens it (no launch), the tile's ▶ and
//     the menu's Play launch, the menu's Details opens it, Jump Back In too.
//  4. THE HEADER AND PLAY: the game's name, the facts line, the cover; Play
//     launches.
//  5. COLLECTIONS: the ones holding the game, three then Show all; the ••• menu's
//     Favorites toggle, the panel's chip, the store and the library's Favorites
//     view agree, across a reload.
//  6. GALLERY: the game's images, or the empty line; the header opens the gallery.
//  7. INFO: collapsed, opens on Enter, four facts, the date formatted.
//  8. ACTIONS: the rows for this game — Catch me up and Who's in this? for games
//     their agents know and not for others, OMEN AI as a switch, Booster — each
//     gone with its agent (Forge) or module (Module Browser); a pressed row pins
//     Nova on the agent's reply and hands it the rail; the switch and the menu's
//     checkbox are one state.
//  9. IT SCROLLS when the window is short — and nothing in it shrinks instead
//     (Play kept its height, October 27); the title holds its contrast in both
//     themes; no page errors.
//
// Set SHOTS_DIR to save screenshots (dark, light, short).
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

// ── 1. The data ───────────────────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'trhs-gp-'));
const ASSETS = Object.fromEntries(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.glb', '.gltf', '.obj', '.mtl', '.fbx', '.hdr', '.css'].map((e) => [e, 'empty']));
const GLOB_SHIM = join(tmp, 'glob-shim.mjs');
writeFileSync(GLOB_SHIM, 'export const __viteGlob = () => ({});\n');
const load = async (entry, name) => {
  const outfile = join(tmp, name);
  await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], outfile, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent', loader: ASSETS, define: { 'import.meta.glob': '__viteGlob' }, inject: [GLOB_SHIM], jsx: 'automatic' });
  return import(outfile);
};
const G = await load('../src/data/games.ts', 'games.mjs');
rmSync(tmp, { recursive: true, force: true });
const ids = new Set(G.GAMES.map((g) => g.id));

console.log('\nThe data');
check('every game has a release date, ISO, that parses', G.GAMES.every((g) => /^\d{4}-\d{2}-\d{2}$/.test(g.released) && !Number.isNaN(Date.parse(g.released))), G.GAMES.filter((g) => !g.released).map((g) => g.id).join(','));
check('Elden Ring: Feb 25, 2022', G.GAMES.find((g) => g.id === 'eldenring')?.released === '2022-02-25');
check('the favorites seed names catalog games', [...G.FAVORITE_IDS].every((id) => ids.has(id)));

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
const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
await size(1440, 900);

const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expr, ms = 15000) => {
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
const hash = () => ev('location.hash');
const PANEL = `document.querySelector('.game-panel')`;
const panelOpen = (id) => waitFor(`!!document.querySelector('.game-panel.open${id ? `[data-game="${id}"]` : ''}')`, 5000);
const panelClosed = () => waitFor(`!document.querySelector('.game-panel.open')`, 5000);
const click = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
const tile = (title) => `[...document.querySelectorAll('.library-grid .ds-tile')].find((t) => t.getAttribute('aria-label') === ${JSON.stringify(title)})`;
const openMenu = async (title) => {
  await ev(`${tile(title)}?.querySelector('button[aria-label="More options"]')?.click(); 1`);
  return waitFor(`!!document.querySelector('.gtm-pop')`, 3000);
};
const menuRow = (label) => ev(`(() => { const r = [...document.querySelectorAll('.gtm-pop [role^="menuitem"]')].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); if (!r) return false; r.click(); return true; })()`);
const lastMsg = `[...document.querySelectorAll('.ds-chat-msg')].pop()`;
const speaker = () => ev(`${lastMsg}?.querySelector('.ds-chat-msg-meta, [class*="meta"]')?.textContent ?? ''`);
const shot = async (name) => {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS_DIR, `${name}.png`), Buffer.from(data, 'base64'));
};

// A first run: nothing in storage, so the seeds and defaults apply.
await go('/');
await ev(`localStorage.clear(); localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); 1`);
await go('/');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova') ?? 'null'); if (s?.settings) { s.settings.llmEnabled = false; s.settings.demoSpeed = 'instant'; localStorage.setItem('trhs-nova', JSON.stringify(s)); } return 1; })()`);

// ── 2. The rail ──────────────────────────────────────────────────────────────
console.log('\nThe rail');
await go('/play?game=eldenring');
check('?game= opens the panel on that game', await panelOpen('eldenring'));
check('the shell reserves its width', (await ev(`document.querySelector('.shell')?.classList.contains('game-open')`)) && (await ev(`getComputedStyle(document.querySelector('.shell')).getPropertyValue('--rail-reserve-w').trim()`)) === '340px', await ev(`getComputedStyle(document.querySelector('.shell')).getPropertyValue('--rail-reserve-w')`));
check('the Devices flyout is not open beside it', !(await ev(`document.querySelector('.device-panel')?.classList.contains('open')`)));
check('focus lands on the panel’s close', await waitFor(`document.activeElement?.classList.contains('gp-close')`, 2000), await ev(`document.activeElement?.className`));
check('it is labelled by the game', (await ev(`${PANEL}?.getAttribute('aria-label')`)) === 'Elden Ring details');
await shot('panel-dark');
check('✕ closes it and clears the param', (await click('.game-panel .gp-close')) && (await panelClosed()) && !(await hash()).includes('game='), await hash());
check('…and the shell gives the room back', !(await ev(`document.querySelector('.shell')?.classList.contains('game-open')`)));
await go('/play?game=eldenring');
await panelOpen('eldenring');
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
check('Esc closes it', (await panelClosed()) && !(await hash()).includes('game='), await hash());
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('Devices takes the rail from it', await ev(`(() => { const b = [...document.querySelectorAll('.shell-nav button, .shell-nav a')].find((e) => e.getAttribute('aria-label') === 'Devices' || e.textContent.trim() === 'Devices'); if (!b) return false; b.click(); return true; })()`) && (await panelClosed()) && (await waitFor(`document.querySelector('.device-panel')?.classList.contains('open')`, 3000)) && !(await hash()).includes('game='), await hash());
check('…and a game takes it back from Devices', (await ev(`${tile('Cyberpunk 2077')}?.click(); 1`)) && (await panelOpen('cyberpunk')) && !(await ev(`document.querySelector('.device-panel')?.classList.contains('open')`)));
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/play');
check('Nova pinned shows', await waitFor(`!!document.querySelector('.nova-panel.open')`, 3000));
await ev(`${tile('Cyberpunk 2077')}?.click(); 1`);
check('opening a game unpins Nova', (await panelOpen('cyberpunk')) && (await waitFor(`!document.querySelector('.nova-panel.open')`, 3000)) && (await ev(`localStorage.getItem('novaPinned')`)) === '0');
await go('/play?game=no-such-game');
check('an unknown id shows nothing and the param goes', await waitFor(`!document.querySelector('.game-panel.open') && !location.hash.includes('game=')`, 3000), await hash());

// ── 3. Opening it ────────────────────────────────────────────────────────────
console.log('\nOpening it');
await go('/play');
await ev(`document.getElementById('my-games')?.scrollIntoView(); 1`);
await sleep(300);
check('a tile press opens the panel, not the game', (await ev(`(() => { const t = ${tile('Cyberpunk 2077')}; t?.focus(); t?.click(); return !!t; })()`)) && (await panelOpen('cyberpunk')) && (await hash()).includes('game=cyberpunk') && !(await hash()).includes('playing='), await hash());
check('focus went to the panel, and comes back to the tile on close', (await click('.game-panel .gp-close')) && (await waitFor(`document.activeElement === ${tile('Cyberpunk 2077')}`, 2000)), await ev(`document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName`));
check('the tile’s ▶ is a button that launches', (await ev(`${tile('Cyberpunk 2077')}?.querySelector('button.ds-tile-play')?.click(); 1`)) && (await waitFor(`location.hash.includes('playing=cyberpunk')`, 3000)) && !(await ev(`!!document.querySelector('.game-panel.open')`)), await hash());
await go('/play');
check('the menu’s Details opens the panel', (await openMenu('Elden Ring')) && (await menuRow('Details')) && (await panelOpen('eldenring')));
check('the menu’s Play still launches', (await openMenu('Elden Ring')) && (await menuRow('Play')) && (await waitFor(`location.hash.includes('playing=eldenring')`, 3000)));

// ── 4. The header and Play ───────────────────────────────────────────────────
console.log('\nThe header');
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('the title and the facts line', (await ev(`${PANEL}.querySelector('.gp-title')?.textContent`)) === 'Elden Ring' && (await ev(`${PANEL}.querySelector('.gp-caption')?.textContent`)) === 'Action RPG · 2022', await ev(`${PANEL}.querySelector('.gp-caption')?.textContent`));
check('the cover behind, blurred, and the tile in front', (await ev(`!!${PANEL}.querySelector('.gp-hero-art') && getComputedStyle(${PANEL}.querySelector('.gp-hero-art')).filter.startsWith('blur(')`)) && (await ev(`!!${PANEL}.querySelector('.gp-hero-tile.ds-tile')`)));
// Its height at full size — the short window must not take any of it (§9).
const playH = await ev(`${PANEL}.querySelector('.gp-play').getBoundingClientRect().height`);
check('Play launches', (await click('.game-panel .gp-play')) && (await waitFor(`location.hash.includes('playing=eldenring')`, 3000)));

// ── 5. Collections ───────────────────────────────────────────────────────────
console.log('\nCollections');
await go('/play?game=eldenring');
await panelOpen('eldenring');
const chips = () => ev(`[...${PANEL}.querySelectorAll('.gp-chips [data-collection]')].map((c) => c.dataset.collection)`);
check('the seeded collections holding Elden Ring', JSON.stringify(await chips()) === '["favorites","souls"]', JSON.stringify(await chips()));
check('a pill opens the library on that collection', (await click('.game-panel [data-collection="souls"]')) && (await waitFor(`document.querySelector('.lib-chips [data-collection="souls"]')?.classList.contains('selected') && !!${tile('Elden Ring')} && !${tile('Cyberpunk 2077')}`, 5000)), await hash());
check('…and the param is spent', !(await hash()).includes('collection='), await hash());
// Four more collections: three show, then Show all.
await ev(`(() => { const c = JSON.parse(localStorage.getItem('trhs-collections')); c.push({ id: 'a', name: 'A', gameIds: ['eldenring'] }, { id: 'b', name: 'B', gameIds: ['eldenring'] }); localStorage.setItem('trhs-collections', JSON.stringify(c)); return 1; })()`);
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('three, then Show all', (await chips()).length === 3 && (await ev(`!!${PANEL}.querySelector('.gp-chips button[aria-label^="Show all 4"]')`)), JSON.stringify(await chips()));
check('Show all shows the rest', (await click('.game-panel .gp-chips button[aria-label^="Show all"]')) && (await chips()).length === 4 && !(await ev(`!!${PANEL}.querySelector('.gp-chips button[aria-label^="Show all"]')`)));
// Favorites: the menu, the chip, the store and the view agree.
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('Remove from Favorites in the ••• menu', (await openMenu('Elden Ring')) && (await menuRow('Remove from Favorites')));
check('the chip goes, live', await waitFor(`![...document.querySelectorAll('.game-panel [data-collection]')].some((c) => c.dataset.collection === 'favorites')`, 3000));
check('and it is saved', !((await store('trhs-collections')) ?? []).find((c) => c.id === 'favorites')?.gameIds.includes('eldenring'));
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('a reload keeps it', !(await chips()).includes('favorites'));
check('the library’s Favorites view agrees', (await ev(`(() => { const c = [...document.querySelectorAll('.ds-chip')].find((e) => e.textContent.trim() === 'Favorites'); c?.click(); return !!c; })()`)) && (await waitFor(`!${tile('Elden Ring')} && !!${tile('Cyberpunk 2077')}`, 3000)));
check('Add to Favorites puts it back', (await ev(`[...document.querySelectorAll('.ds-chip')].find((e) => e.textContent.trim() === 'All')?.click(); 1`)) && (await waitFor(`!!${tile('Elden Ring')}`, 3000)) && (await openMenu('Elden Ring')) && (await menuRow('Add to Favorites')) && (await waitFor(`[...document.querySelectorAll('.game-panel [data-collection]')].some((c) => c.dataset.collection === 'favorites')`, 3000)));
check('a game in no collection says so', (await go('/play?game=valorant'), await panelOpen('valorant')) && (await ev(`${PANEL}.querySelector('.gp-empty')?.textContent`)) === 'Not in a collection');

// ── 6. Gallery ───────────────────────────────────────────────────────────────
console.log('\nGallery');
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('Cyberpunk has captures', (await ev(`${PANEL}.querySelectorAll('.gp-thumbs img').length`)) >= 1 && /Cyberpunk 2077/.test(await ev(`${PANEL}.querySelector('.gp-thumbs img')?.alt`)));
check('the header’s chevron opens the gallery on this game', (await click('.game-panel button[aria-label="Open gallery"]')) && (await waitFor(`location.hash.includes('section=gallery') && location.hash.includes('gallery=cyberpunk')`, 3000)), await hash());
check('the gallery shows only its captures, and says so', (await waitFor(`document.querySelector('.gal-filter')?.dataset.gallery === 'cyberpunk'`, 3000)) && (await ev(`document.querySelectorAll('.gal-grid .gal-tile').length`)) === 1 && /1 capture of Cyberpunk 2077/.test(await ev(`document.querySelector('.gal-filter')?.textContent`)));
check('Show all brings the rest back', (await ev(`[...document.querySelectorAll('.gal-filter button')].find((b) => b.textContent.trim() === 'Show all')?.click(); 1`)) && (await waitFor(`!document.querySelector('.gal-filter') && document.querySelectorAll('.gal-grid .gal-tile').length > 1`, 3000)) && !(await hash()).includes('gallery='), await hash());
await go('/play?section=gallery&gallery=valorant');
check('a game with none says so, with the way back', await waitFor(`/No captures of Valorant yet/.test(document.querySelector('.gal-filter')?.textContent ?? '') && !document.querySelector('.gal-grid')`, 3000));
await go('/play?game=valorant');
await panelOpen('valorant');
check('a game without captures says so, and keeps the section', (await ev(`[...${PANEL}.querySelectorAll('.gp-empty')].some((e) => e.textContent === 'No captures yet')`)) && (await ev(`!!${PANEL}.querySelector('button[aria-label="Open gallery"]')`)));

// ── 7. Info ──────────────────────────────────────────────────────────────────
console.log('\nInfo');
await go('/play?game=eldenring');
await panelOpen('eldenring');
const infoHead = `${PANEL}.querySelector('.gp-info .ds-settings-group-header')`;
check('collapsed by default', (await ev(`${infoHead}?.getAttribute('aria-expanded')`)) === 'false' && (await ev(`getComputedStyle(${PANEL}.querySelector('.gp-info .ds-settings-group-items')).display`)) === 'none');
await ev(`(() => { const h = ${infoHead}; h.focus(); h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
check('Enter opens it', (await waitFor(`${infoHead}?.getAttribute('aria-expanded') === 'true'`, 2000)) && (await ev(`getComputedStyle(${PANEL}.querySelector('.gp-info .ds-settings-group-items')).display`)) !== 'none', await ev(`${infoHead}?.getAttribute('aria-expanded')`));
const facts = await ev(`[...${PANEL}.querySelectorAll('.gp-info .gp-fact')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
check('four facts, stacked, the date formatted', facts.length === 4 && /^genre Action RPG$/i.test(facts[0]) && /^release date Feb 25, 2022$/i.test(facts[1]) && /^developer FromSoftware$/i.test(facts[2]) && /^publisher Bandai Namco$/i.test(facts[3]), JSON.stringify(facts));
await shot('panel-info-open');

// ── 8. Actions ───────────────────────────────────────────────────────────────
console.log('\nActions');
const rows = () => ev(`[...${PANEL}.querySelectorAll('[data-action]')].map((r) => r.dataset.action)`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('Cyberpunk: Catch me up, Who’s in this?, Profile, OMEN AI, Booster', JSON.stringify(await rows()) === '["catch-me-up:recap","who-made-this:credits","profile:linked","omenai:tune","booster:open"]', JSON.stringify(await rows()));
check('rows, not buttons: a list item each, keyboard-reachable', (await ev(`[...${PANEL}.querySelectorAll('[data-action]')].every((r) => r.classList.contains('ds-list-item') && r.tabIndex === 0)`)));
// Cyberpunk is not in the catalog's OMEN AI set, so its switch starts off; Valorant is, so on.
check('OMEN AI is a switch, off for Cyberpunk', (await ev(`${PANEL}.querySelector('[data-action="omenai:tune"]')?.getAttribute('role')`)) === 'switch' && (await ev(`${PANEL}.querySelector('[data-action="omenai:tune"]')?.getAttribute('aria-checked')`)) === 'false');
await go('/play?game=valorant');
await panelOpen('valorant');
check('Valorant: neither agent knows it — only the app’s and the modules’ rows', JSON.stringify(await rows()) === '["profile:linked","omenai:tune","booster:open"]', JSON.stringify(await rows()));
check('…and its OMEN AI switch is on (the catalog’s set)', (await ev(`${PANEL}.querySelector('[data-action="omenai:tune"]')?.getAttribute('aria-checked')`)) === 'true');
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('pressing Catch me up pins Nova on the agent’s reply and hands it the rail', (await click('.game-panel [data-action="catch-me-up:recap"]')) && (await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000)) && (await waitFor(`${lastMsg}?.dataset.status !== 'streaming' && [...(${lastMsg}?.querySelectorAll('button') ?? [])].some((b) => b.textContent.trim() === 'Resume where I left off')`, 20000)) && (await speaker()).startsWith('Catch Me Up') && (await panelClosed()), await speaker());
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('pressing Who’s in this? asks Who Made This', (await click('.game-panel [data-action="who-made-this:credits"]')) && (await waitFor(`!!document.querySelector('.nova-panel.open')`, 5000)) && (await waitFor(`${lastMsg}?.dataset.status !== 'streaming' && !!${lastMsg}?.querySelector('[data-credits="cyberpunk"]')`, 20000)) && (await speaker()).startsWith('Who Made This'), await speaker());
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('the OMEN AI switch flips the store', (await click('.game-panel [data-action="omenai:tune"]')) && (await waitFor(`document.querySelector('.game-panel [data-action="omenai:tune"]')?.getAttribute('aria-checked') === 'true'`, 2000)) && (await store('trhs-game-optimize'))?.cyberpunk?.omenAi === true);
check('…and the tile menu’s checkbox agrees', (await openMenu('Cyberpunk 2077')) && (await ev(`[...document.querySelectorAll('.gtm-pop [role="menuitemcheckbox"]')].find((r) => /OMEN AI/.test(r.textContent))?.getAttribute('aria-checked')`)) === 'true');
check('the menu’s checkbox flips it back, and the switch follows', (await menuRow('OMEN AI')) && (await waitFor(`document.querySelector('.game-panel [data-action="omenai:tune"]')?.getAttribute('aria-checked') === 'false'`, 2000)));
check('Booster opens the Booster modal', (await click('.game-panel [data-action="booster:open"]')) && (await waitFor(`location.hash.includes('modal=booster')`, 3000)), await hash());
// The gates.
await ev(`localStorage.setItem('trhs-agents', '[]'); 1`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('no agents added → no agent rows', JSON.stringify(await rows()) === '["profile:linked","omenai:tune","booster:open"]', JSON.stringify(await rows()));
await ev(`localStorage.removeItem('trhs-agents'); localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, omenai: false, booster: false })); 1`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('OMEN AI and Booster uninstalled → their rows go; the profile row is the app’s and stays', JSON.stringify(await rows()) === '["catch-me-up:recap","who-made-this:credits","profile:linked"]', JSON.stringify(await rows()));
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); 1`);

// ── 9. It scrolls; the title’s contrast; errors ──────────────────────────────
console.log('\nShort window, both themes');
await size(1440, 600);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
// Nothing in the scrolling body gives up height: a flex column shrank the
// Play button to a red line before the body ever scrolled (Chris, October 27).
const playShort = await ev(`${PANEL}.querySelector('.gp-play').getBoundingClientRect().height`);
check('at 600px, Info shut, Play keeps its full height', playH >= 32 && Math.abs(playShort - playH) < 0.5, JSON.stringify({ playH, playShort }));
await ev(`${infoHead}?.click(); 1`);
await sleep(200);
check('and with Info open too', Math.abs((await ev(`${PANEL}.querySelector('.gp-play').getBoundingClientRect().height`)) - playH) < 0.5);
check('no section is squeezed — each keeps its own height', await ev(`[...${PANEL}.querySelectorAll('.gp-body > *')].every((el) => getComputedStyle(el).flexShrink === '0')`));
check('at 600px the body scrolls and ✕ stays in view', (await ev(`(() => { const b = ${PANEL}.querySelector('.gp-body'); const c = ${PANEL}.querySelector('.gp-close').getBoundingClientRect(); return b.scrollHeight > b.clientHeight + 1 && c.top >= 0 && c.bottom <= innerHeight; })()`)));
await shot('panel-short');
await size(1440, 900);
// The title sits on the scrim; the worst case is art of the opposite
// luminance under the veil at the title line (`--scrim`, before the gradient
// reaches `--scrim-strong`).
const contrast = async () => ev(`(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const probe = document.createElement('div'); probe.style.background = 'var(--scrim)'; probe.style.color = 'var(--text-primary)'; document.body.appendChild(probe);
  const cs = getComputedStyle(probe); const veil = parse(cs.backgroundColor); const text = parse(cs.color); probe.remove();
  const dark = document.documentElement.classList.contains('light') ? 0 : 255; // the art's worst case
  const under = { r: dark, g: dark, b: dark };
  const mix = (k) => veil.a * veil[k] + (1 - veil.a) * under[k];
  const L1 = lum(text.r, text.g, text.b), L2 = lum(mix('r'), mix('g'), mix('b'));
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
})()`);
const dark = await contrast();
check(`the title holds 4.5:1 on the dark veil over bright art (${dark.toFixed(1)})`, dark >= 4.5);
await ev(`localStorage.setItem('theme', 'light'); 1`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('the light theme applied', await waitFor(`document.documentElement.classList.contains('light')`, 3000));
const light = await contrast();
check(`…and 4.5:1 on the light veil over dark art (${light.toFixed(1)})`, light >= 4.5);
await shot('panel-light');
await ev(`localStorage.setItem('theme', 'dark'); 1`);

// ── 10. TH-505: the grip, collections in the library, the profile row, inert ──
console.log('\nTH-505');
await size(1440, 900);
await go('/play');
await ev(`document.getElementById('my-games')?.scrollIntoView({ block: 'center' }); 1`);
await sleep(300);
const grip = await ev(`(() => { const s = document.querySelector('[data-section="library"]'); const g = s?.querySelector('.rs-grip'); const l = s?.querySelector('.pg-section-label'); if (!g || !l) return null; const a = g.getBoundingClientRect(), b = l.getBoundingClientRect(); return { dy: Math.round((a.top + a.height / 2) - (b.top + b.height / 2)), left: a.right <= b.left + 1, bare: !!s.querySelector('.rs-head.bare') }; })()`);
check('the My Games grip is level with its label, in the gutter', grip && Math.abs(grip.dy) <= 2 && grip.left && !grip.bare, JSON.stringify(grip));
const libChips = await ev(`[...document.querySelectorAll('.lib-chips [data-collection]')].map((c) => c.textContent.trim())`);
// (§5 added two collections, A and B; they are chips too.)
check('the library has a chip per collection after Favorites', JSON.stringify(libChips) === '["Souls","Co-op nights","Finished","A","B"]', JSON.stringify(libChips));
check('a collection chip shows its games', (await ev(`document.querySelector('.lib-chips [data-collection="coop"]')?.click(); 1`)) && (await waitFor(`!!${tile("Baldur's Gate 3")} && !${tile('Elden Ring')}`, 3000)));
await ev(`[...document.querySelectorAll('.ds-chip')].find((e) => e.textContent.trim() === 'All')?.click(); 1`);
check('the ••• menu lists the collections, checked where the game is', (await openMenu('Elden Ring')) && JSON.stringify(await ev(`[...document.querySelectorAll('.gtm-pop [role="menuitemcheckbox"]')].filter((r) => ['Souls','Co-op nights','Finished'].includes(r.textContent.trim())).map((r) => r.textContent.trim() + ':' + r.getAttribute('aria-checked'))`)) === '["Souls:true","Co-op nights:false","Finished:false"]');
check('ticking one adds the game', (await menuRow('Finished')) && (await waitFor(`(JSON.parse(localStorage.getItem('trhs-collections')) ?? []).find((c) => c.id === 'finished')?.gameIds.includes('eldenring')`, 2000)));
check('New collection… becomes a name field', (await openMenu('Elden Ring')) && (await menuRow('New collection…')) && (await waitFor(`document.activeElement?.matches('.gtm-new input')`, 2000)));
await ev(`(() => { const i = document.querySelector('.gtm-new input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Boss rush'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
check('Enter makes it, with the game in it, and a chip appears', (await waitFor(`(JSON.parse(localStorage.getItem('trhs-collections')) ?? []).some((c) => c.name === 'Boss rush' && c.gameIds.includes('eldenring'))`, 2000)) && (await waitFor(`[...document.querySelectorAll('.lib-chips [data-collection]')].some((c) => c.textContent.trim() === 'Boss rush')`, 2000)) && !(await ev(`!!document.querySelector('.gtm-pop')`)));
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('the panel shows it too', (await chips()).includes('boss-rush') || (await ev(`!!document.querySelector('.game-panel .gp-chips button[aria-label^="Show all"]')`)), JSON.stringify(await chips()));
check('Profile: none linked says so', /None linked/.test(await ev(`${PANEL}.querySelector('[data-action="profile:linked"]')?.innerText ?? ''`)));
check('…and opens the Profiles editor', (await click('.game-panel [data-action="profile:linked"]')) && (await waitFor(`location.hash.includes('modal=profiles')`, 3000)), await hash());
// A profile linked to the game (the Catch Me Up reset makes Night City, linked to Cyberpunk).
await go('/?demo=catch-up');
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('a linked profile is named, and opens on itself', /Night City applies when you play/.test(await ev(`${PANEL}.querySelector('[data-action="profile:linked"]')?.innerText ?? ''`)) && (await click('.game-panel [data-action="profile:linked"]')) && (await waitFor(`location.hash.includes('modal=profiles') && /profile=/.test(location.hash)`, 3000)), await hash());
await go('/play');
check('closed rails are inert — nothing in them takes focus', (await ev(`document.querySelector('.game-panel')?.hasAttribute('inert') && document.querySelector('.device-panel')?.hasAttribute('inert')`)));
await go('/play?game=eldenring');
await panelOpen('eldenring');
check('an open one is not', !(await ev(`document.querySelector('.game-panel')?.hasAttribute('inert')`)));
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true, gallery: false })); 1`);
await go('/play?game=cyberpunk');
await panelOpen('cyberpunk');
check('the gallery module uninstalled → no Gallery section', !(await ev(`!!document.querySelector('.game-panel section[aria-label="Gallery"]')`)));
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); 1`);

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

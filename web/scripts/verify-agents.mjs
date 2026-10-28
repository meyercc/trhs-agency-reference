// verify-agents — every Nova agent lines up, and every recipe works as itself
// (2026-10-26, the recipe manifest; agents/recipes.tsx has the map).
//
// An agent is a registry entry (agents/registry.ts), a persona
// (nova/personas.ts) and a Forge listing (forge/listings.ts). A RECIPE — an
// agent Nova really answers as — adds three layers: its blocks
// (agents/recipeBindings.ts), its routing (agents/recipeScripts.ts) and its UI
// (agents/recipes.tsx). Each piece fails silently when missing: a speaker
// without a name, a card one control short, a block that renders nothing.
//
//   1. Statically, in Node (the pure layers, bundled by esbuild):
//      - every agent has a persona and a Forge listing whose name, type and
//        version are the registry's;
//      - every recipe is a registry agent; every recipe block has a binding row
//        that points at it;
//      - every recipe's example lines are answered by that recipe, through the
//        routing order, as itself.
//   2. In the browser:
//      - each example, typed into Nova, is answered by the agent's registry
//        name, with no "recipe card missing";
//      - each recipe block, placed on the board, renders, with no "recipe block
//        missing";
//      - no uncaught page errors.
//
// Red-proof (2026-10-26): deleting `cards: { recap: … }` from catchUpRecipe
// fails "no recipe card is missing"; dropping refundRecipe's `refund-watch`
// renderer fails its block checks; deleting Clip Keeper's persona fails its
// persona check. (A registry version can no longer drift from Forge's: the
// listing reads it from the registry.)
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

// ── 1. The pure layers, as the app has them ──────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'trhs-agents-'));
const ASSETS = Object.fromEntries(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.glb', '.gltf', '.obj', '.mtl', '.fbx', '.hdr', '.css'].map((e) => [e, 'empty']));
// The routing layer reaches the game catalog, which lists its art with Vite's
// `import.meta.glob`; in Node it lists nothing (the scripts need titles, not art).
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
const R = await load('../src/agents/registry.ts', 'registry.mjs');
const P = await load('../src/nova/personas.ts', 'personas.mjs');
const L = await load('../src/forge/listings.ts', 'listings.mjs');
const B = await load('../src/state/bindings.ts', 'bindings.mjs');
const RB = await load('../src/agents/recipeBindings.ts', 'recipeBindings.mjs');
const RS = await load('../src/agents/recipeScripts.ts', 'recipeScripts.mjs');
rmSync(tmp, { recursive: true, force: true });

console.log('\nEvery agent: a persona and a Forge listing that agree with the registry');
for (const a of R.AGENTS) {
  const p = P.PERSONAS[a.id];
  check(`${a.id}: a persona (opener and system prompt)`, !!p?.opener && !!p?.system);
  const l = L.FORGE_BY_ID[a.id];
  check(
    `${a.id}: Forge lists it as the registry has it`,
    !!l && l.name === a.name && l.type === a.type && l.ver === a.version,
    l ? `Forge ${l.name} / ${l.type} / ${l.ver} — registry ${a.name} / ${a.type} / ${a.version}` : 'no listing',
  );
}

console.log('\nEvery recipe: a registry agent, its blocks bound, its lines its own');
const recipes = RS.RECIPE_SCRIPTS;
check('recipe ids are unique', new Set(recipes.map((r) => r.id)).size === recipes.length);
for (const r of recipes) check(`${r.id}: is a registry agent`, !!R.AGENT_BY_ID[r.id]);
// Added by default or not is Chris's call per story (2026-10-26) — made, not defaulted.
for (const r of recipes) check(`${r.id}: addedByDefault is decided`, typeof R.AGENT_BY_ID[r.id]?.addedByDefault === 'boolean');
for (const [agent, blocks] of Object.entries(RB.RECIPE_BLOCKS)) {
  check(`blocks of ${agent}: belong to a recipe`, recipes.some((r) => r.id === agent));
  for (const id of blocks) {
    const b = B.BINDINGS[id];
    check(`${agent} › ${id}: a binding row whose source is that block`, b?.source?.kind === 'block' && b.source.block === id);
  }
}
const cardRefs = [];
for (const r of recipes) {
  check(`${r.id}: has example lines`, r.examples?.length > 0);
  for (const line of r.examples ?? []) {
    const s = RS.recipeScriptFor(line, { playedMin: () => 0, added: () => true });
    check(`“${line}” → ${r.id}`, s?.agentId === r.id, s ? `answered by ${s.agentId}` : 'no recipe answered');
    const off = RS.recipeScriptFor(line, { playedMin: () => 0, added: (id) => id !== r.id });
    check(`“${line}”: not answered by ${r.id} when it is not added`, off?.agentId !== r.id, off ? `answered by ${off.agentId}` : '');
    for (const st of s?.steps ?? []) if (st.agentCard) cardRefs.push(`${st.agentCard.agent} › ${st.agentCard.card}`);
  }
}

// ── 2. In the browser ────────────────────────────────────────────────────────
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
const waitFor = async (expr, ms = 15000) => {
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
const lastMsg = `[...document.querySelectorAll('.ds-chat-msg')].pop()`;
const msgCount = () => ev(`document.querySelectorAll('.ds-chat-msg').length`);
const type = (text) =>
  ev(`(() => { const t = document.querySelector('.nova-panel textarea') ?? document.querySelector('textarea'); if (!t) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(text)}); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
const speaker = () => ev(`${lastMsg}?.querySelector('.ds-chat-msg-meta, [class*="meta"]')?.textContent ?? ''`);

// Nova installed and pinned, the model off, instant replies — the recipes need nothing else.
await go('/');
// EVERY recipe added, not the defaults: a story that starts removed (Autocast,
// TH-509) must still answer as itself here.
const ALL_RECIPE_IDS = recipes.map((r) => r.id);
await ev(`localStorage.clear(); localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); localStorage.setItem('novaPinned', '1'); localStorage.setItem('trhs-agents', ${JSON.stringify(JSON.stringify(ALL_RECIPE_IDS))}); 1`);
await go('/');
await ev(`(() => { const s = JSON.parse(localStorage.getItem('trhs-nova') ?? 'null'); if (s?.settings) { s.settings.llmEnabled = false; s.settings.demoSpeed = 'instant'; localStorage.setItem('trhs-nova', JSON.stringify(s)); } return 1; })()`);
await go('/');

console.log('\nEach recipe answers its own lines in Nova, as itself');
check('the pinned Nova panel is open', await waitFor(`!!document.querySelector('.nova-panel textarea')`));
consoleErrors.length = 0;
for (const r of recipes) {
  const name = R.AGENT_BY_ID[r.id]?.name ?? r.id;
  for (const line of r.examples ?? []) {
    const n = await msgCount();
    await type(line);
    const done = await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n + 2} && ${lastMsg}?.dataset.status !== 'streaming'`, 20000);
    await sleep(600);
    check(`“${line}”: answered by ${name}`, done && (await speaker()).startsWith(name), await speaker());
  }
}
const missingCards = consoleErrors.filter((e) => /Nova recipe card missing/.test(e));
check(`no recipe card is missing (the replies drew ${cardRefs.length} cards)`, missingCards.length === 0, [...new Set(missingCards)].join(' | '));

// Forge's Remove is the switch (Chris, 2026-10-26): with nothing added, no
// recipe answers as itself. A saved empty list, not a cleared key — a cleared
// key is a first run, which adds the default stories back.
console.log('\nRemoved from Forge, no recipe answers as itself');
await ev(`localStorage.setItem('trhs-agents', '[]'); 1`);
await go('/');
check('nothing added', JSON.stringify(await ev(`JSON.parse(localStorage.getItem('trhs-agents'))`)) === '[]');
for (const r of recipes) {
  const name = R.AGENT_BY_ID[r.id]?.name ?? r.id;
  const line = r.examples[0];
  const n = await msgCount();
  await type(line);
  await waitFor(`document.querySelectorAll('.ds-chat-msg').length >= ${n + 2} && ${lastMsg}?.dataset.status !== 'streaming'`, 20000);
  await sleep(600);
  check(`“${line}”: not answered by ${name}`, !(await speaker()).startsWith(name), await speaker());
}
await ev(`localStorage.setItem('trhs-agents', ${JSON.stringify(JSON.stringify(ALL_RECIPE_IDS))}); 1`);

// The game detail panel's rows (TH-504, agents/gameActions.ts): a recipe's
// row shows for a game it knows while the agent is added, and goes with it.
console.log('\nThe game panel’s rows follow Forge');
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/play?game=cyberpunk');
check('the panel opens on Cyberpunk 2077', await waitFor(`!!document.querySelector('.game-panel.open[data-game="cyberpunk"]')`, 5000));
const rowsOf = () => ev(`[...document.querySelectorAll('.game-panel [data-action]')].map((r) => r.dataset.action)`);
const allRows = await rowsOf();
const recipeRows = allRows.filter((id) => recipes.some((r) => id.startsWith(r.id + ':')));
check('at least one recipe contributes a row', recipeRows.length > 0, JSON.stringify(allRows));
for (const id of recipeRows) {
  const agent = id.split(':')[0];
  await ev(`localStorage.setItem('trhs-agents', JSON.stringify(${JSON.stringify(ALL_RECIPE_IDS)}.filter((a) => a !== ${JSON.stringify(agent)}))); 1`);
  await go('/play?game=cyberpunk');
  await waitFor(`!!document.querySelector('.game-panel.open[data-game="cyberpunk"]')`, 5000);
  check(`${id}: gone when ${agent} is removed from Forge`, !(await rowsOf()).includes(id), JSON.stringify(await rowsOf()));
}
await ev(`localStorage.removeItem('trhs-agents'); 1`);

console.log('\nEach recipe block renders on the board');
const blocks = Object.values(RB.RECIPE_BLOCKS).flat();
const cards = blocks.map((b, i) => ({ id: `card-verify-${i}`, title: `verify ${b}`, items: [{ kind: 'bound', bind: b }], createdAt: Date.now() }));
const layout = cards.map((c) => ({ id: c.id, span: 3, rows: 2 }));
await ev(`localStorage.setItem('cards', ${JSON.stringify(JSON.stringify(cards))}); localStorage.setItem('board-layout', ${JSON.stringify(JSON.stringify(layout))}); localStorage.setItem('novaPinned', '0'); 1`);
consoleErrors.length = 0;
await go('/');
for (const b of blocks) {
  const ok = await waitFor(`(() => { const e = document.querySelector('.shell main [data-block=${JSON.stringify(b)}]'); return !!e && e.textContent.trim().length > 0; })()`, 8000);
  check(`${b}: renders, with content`, ok);
}
const missingBlocks = consoleErrors.filter((e) => /Nova recipe block missing/.test(e));
check('no recipe block is missing', missingBlocks.length === 0, [...new Set(missingBlocks)].join(' | '));

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

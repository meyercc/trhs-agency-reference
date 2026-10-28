// CDP check for the HyperX OMEN 16 VALORANT Edition notebook (TH-424),
// added 2026-10-01.
//
// What is protected, in order of how expensive it would be to lose:
//  1. THE FOUR-ZONE TRUTH. This keyboard is 4-zone RGB, not per-key (HP spec
//     for 16-ap1931nr). The PC's page draws no board over its 3D machine, so
//     the thing that keeps it honest is the zone column: the four bands (and
//     the logo), picked as whole zones — no key groups, no marquee tool, no
//     key-by-key picking. Lose this and the page quietly promises lighting the
//     hardware cannot do.
//  2. THE ZONE PARTITION. Every key on the board belongs to exactly one zone.
//     A layout change that adds a cap would otherwise orphan it silently: it
//     would render, never light, and nothing would say so.
//  3. THE DEFAULT BOARD. The laptop card ships in the default dashboard layout.
//  4. THE TAB SET and the door out — the PC's page: Performance first, then
//     Lighting and Macro; Performance carries the vitals glance and doors
//     (Power Mode, Fan Cleaner, System Vitals) that actually reach their cards
//     on /perform.
//  5. THE SHARED HERO IS UNHARMED. The standalone keyboard must keep its own
//     marquee tool, its key-group rail and its volume knob — this device added
//     props to a component five other canvases render.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. It clears the saved board layout and the device profile it
// touches, and returns to the dashboard at the end.
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const SKU = 'hx-omen-16-valorant';

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

// A layout assertion without a pinned viewport is not an assertion — it reports
// the window the runner happened to launch. The "nothing below the fold" check
// passed at 1600x1200 and failed in a lane whose Chrome defaulted smaller, which
// is the suite being wrong, not the product (TH-424, 2026-10-01).
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
// A hash-only URL change does not remount the modal, and `Page.reload` after one
// races the router — the page then lags a whole block behind and every check
// reads the PREVIOUS screen (2026-10-01: it cost a full suite run, twice, and
// the failures moved between runs because the browser kept state). So each step
// forces a REAL document load with a cache-busting query ahead of the hash, and
// waits for the load event rather than a guessed sleep.
let nav = 0;
const go = async (hash) => {
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
  await sleep(1400); // the React mount + the modal's lazy pieces
};

// The zone data and the board layout are both app modules, and the suite reads
// the SAME source the app runs rather than a copy that can drift.
//
// Loaded with esbuild into node, the way verify-profiles.mjs and
// verify-advanced-eq.mjs do — NOT through the page. These are pure data: there
// is nothing to render, so a navigation bought nothing, and importing
// `/src/...` only works against the dev server, which pinned the whole roster
// to it (the app is deployed as a build).
const zoneDir = mkdtempSync(join(tmpdir(), 'trhs-laptop-'));
const zoneOut = join(zoneDir, 'zones.mjs');
await build({
  entryPoints: ['src/devices/notebookZones.ts'],
  outfile: zoneOut,
  format: 'esm',
  platform: 'node',
  bundle: true,
  logLevel: 'silent',
});
const kbOut = join(zoneDir, 'keys.mjs');
await build({
  entryPoints: ['src/devices/keyboardLayout.ts'],
  outfile: kbOut,
  format: 'esm',
  platform: 'node',
  bundle: true,
  logLevel: 'silent',
});
const zones = (await import(zoneOut)).NOTEBOOK_ZONES;
const boardCodes = (await import(kbOut)).ALL_CODES;
rmSync(zoneDir, { recursive: true, force: true });
const NOTEBOOK_ZONES = zones;
const ZONE_ALL_CODES = zones.flatMap((z) => z.codes);

// ── 2. The zone partition, checked against the board the hero renders ──────
console.log('\nZone partition');
{
  const zoneCodes = ZONE_ALL_CODES;
  const dupes = zoneCodes.filter((c, i) => zoneCodes.indexOf(c) !== i);
  const orphans = (boardCodes || []).filter((c) => !zoneCodes.includes(c));
  const ghosts = zoneCodes.filter((c) => !(boardCodes || []).includes(c));
  check('every board key belongs to a zone', orphans.length === 0, `orphans: ${orphans.join(', ')}`);
  check('no key is in two zones', dupes.length === 0, `duplicated: ${dupes.join(', ')}`);
  check('no zone names a key the board lacks', ghosts.length === 0, `ghosts: ${ghosts.join(', ')}`);
  check('there are four zones', NOTEBOOK_ZONES.length === 4, `got ${NOTEBOOK_ZONES.length}`);
}

// ── 3. The laptop ships in the default board ──────────────────────────────
console.log('\nDefault dashboard');
{
  // The board's `dev-laptop` card is the card for This PC (it follows Admin), so
  // it is the notebook's card only while the notebook is This PC.
  await go('/');
  await evaluate(`localStorage.removeItem('board-layout'); localStorage.setItem('thisPc', ${JSON.stringify(SKU)})`);
  await go('/');
  const ids = await evaluate(`[...document.querySelectorAll('.wb-cell')].map(e => e.dataset.widget)`);
  check('laptop card is in the DEFAULT board layout', (ids || []).includes('dev-laptop'), `board: ${(ids || []).join(', ')}`);
  // The default board, in Chris's order and sizes (2026-10-26).
  const WANT = 'dev-laptop 2x2,dev-headset 2x2,lastplayed 4x2,dev-mouse 2x2,dev-keyboard 2x2,dev-mic 2x2,dev-monitor 2x1,cpu-status 2x1';
  const got = await evaluate(`[...document.querySelectorAll('.wb-cell')].map(e => { const s = getComputedStyle(e); return e.dataset.widget + ' ' + s.gridColumnEnd.replace('span ', '') + 'x' + s.gridRowEnd.replace('span ', ''); }).join(',')`);
  check('the default board is the eight cards in order and size', got === WANT, got);
  // Home cards start with icons only; ⋮ › Customize adds controls (2026-10-26).
  const ctls = await evaluate(`document.querySelectorAll('.wb-cell .devw-controls .devw-ctl').length`);
  check('its device cards show no controls until someone adds them', ctls === 0, `${ctls} controls`);
  const shortcuts = await evaluate(
    `[...document.querySelectorAll('[data-widget=dev-laptop] button')].map(b => b.getAttribute('aria-label')).filter(Boolean)`,
  );
  check(
    'its card offers the PC page\'s three tab shortcuts — Performance, Lighting, Macro — and no Keys & Macros or Settings',
    ['Performance', 'Lighting', 'Macro'].every((t) => (shortcuts || []).some((s) => s.includes(t)))
      && !(shortcuts || []).some((s) => /Keys & Macros|Settings/.test(s)),
    JSON.stringify(shortcuts),
  );
  await evaluate(`localStorage.removeItem('thisPc')`);
}

// ── 4. The tab set, the vitals glance and the door out ────────────────────
console.log('\nModal tabs');
{
  await go(`/?sku=${SKU}`);
  check('the notebook opens the laptop canvas, not the generic spec sheet', await evaluate(`!!document.querySelector('.lc-canvas')`));
  const tabs = await evaluate(`[...document.querySelectorAll('.lc-canvas .ds-ng3-tool')].map(b => b.getAttribute('aria-label') || b.getAttribute('title'))`);
  check(
    'three tabs, Performance first: Performance · Lighting · Macro — no Keys & Macros, no Settings',
    JSON.stringify(tabs) === JSON.stringify(['Performance', 'Lighting', 'Macro']),
    JSON.stringify(tabs),
  );
  check('Performance is the tab it opens on', (await evaluate(`(document.querySelector('.lc-canvas .ds-ng3-panel')?.innerText || '').startsWith('PERFORMANCE')`)) === true);
  check('the Performance tab shows three vitals gauges', (await evaluate(`document.querySelectorAll('.lc-canvas .lc-vital').length`)) === 3);
  check(
    'it names this machine’s silicon rather than a generic PC',
    await evaluate(`/Ryzen 9 9955HX3D/.test(document.querySelector('.lc-canvas .lc-spec')?.innerText || '')`),
  );
  // Nothing may hang below the fold: the first build stacked the gauges and
  // pushed the spec list off the bottom of the viewport.
  check(
    'no panel content falls below the viewport',
    (await evaluate(`[...document.querySelectorAll('.lc-canvas .ds-ng3-panel *')].every(e => { const r = e.getBoundingClientRect(); return !(r.height > 0 && r.bottom > innerHeight + 1); })`)) === true,
  );
  // The tab's doors: each reading, then each one lands on its card on /perform.
  const doors = await evaluate(`[...document.querySelectorAll('.lc-canvas .lc-door')].map(d => ({ spot: d.dataset.spot, label: d.querySelector('.ds-list-item-label')?.textContent.trim(), reading: d.querySelector('.ds-list-item-description')?.textContent.trim() ?? null }))`);
  check(
    'the Performance tab has doors to System Vitals, Power Mode and Fan Cleaner, each with its reading',
    JSON.stringify(doors.map((d) => d.spot).sort()) === JSON.stringify(['fan-cleaner', 'power-mode', 'vitals'])
      && doors.find((d) => d.spot === 'fan-cleaner')?.reading === 'Good · last cleaned 45 days ago'
      && !!doors.find((d) => d.spot === 'power-mode')?.reading,
    JSON.stringify(doors),
  );
  check('every door is inside the panel, not below its edge', (await evaluate(`(() => { const p = document.querySelector('.lc-canvas .ds-ng3-panel').getBoundingClientRect(); return [...document.querySelectorAll('.lc-canvas .lc-door')].every((d) => { const r = d.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; }); })()`)) === true);
  check('no "Manage performance" button is left', (await evaluate(`![...document.querySelectorAll('.lc-canvas button')].some(b => /manage performance/i.test(b.innerText))`)) === true);
  await evaluate(`document.querySelector('.lc-canvas [data-spot="power-mode"]')?.click()`);
  await sleep(1000);
  check('the Power Mode door reaches the Performance page', (await evaluate(`location.hash`)).startsWith('#/perform'), await evaluate(`location.hash`));
  check(
    'it lands on the Power Mode card, lit, and the window is closed',
    (await evaluate(`document.querySelector('.pv5-spotlight')?.dataset.feature`)) === 'power-mode' && (await evaluate(`!document.querySelector('.lc-canvas')`)) === true,
  );
}

// ── 1. The four-zone truth ────────────────────────────────────────────────
console.log('\nFour-zone lighting');
{
  await go(`/?sku=${SKU}&tab=lighting`);
  const zoneIds = await evaluate(`[...document.querySelectorAll('.lc-canvas .pcz-zone')].map((z) => z.dataset.zone)`);
  check(
    'the zone column offers All, the four zones and the logo, not key groups',
    JSON.stringify(zoneIds) === JSON.stringify(['*', ...NOTEBOOK_ZONES.map((z) => z.id), 'logo']),
    JSON.stringify(zoneIds),
  );
  check('the page draws no key rail, no marquee tool and no volume knob over the 3D machine',
    (await evaluate(`document.querySelectorAll('.lc-canvas .kbd-qs-btn, .lc-canvas .kbd-qs-icon, .lc-canvas .kbd-knob, .lc-canvas .kbd-key').length`)) === 0);

  // Picking ONE zone in the column takes the whole band, nothing finer.
  await evaluate(`document.querySelector('.lc-canvas .pcz-zone[data-zone="left"]')?.click()`);
  await sleep(300);
  const picked = await evaluate(`[...document.querySelectorAll('.lc-canvas .pcz-zone[aria-selected="true"]')].map((z) => z.dataset.zone)`);
  check(
    'picking a zone selects that whole band alone',
    JSON.stringify(picked) === JSON.stringify(['left']),
    JSON.stringify(picked),
  );
}

// ── 5. The shared hero is unharmed ────────────────────────────────────────
console.log('\nStandalone keyboard unaffected');
{
  // A keyboard on the drawn board (KeyboardHero, which this device shares).
  // The Origins 65 has a photo board of its own now (keyboardRenders.ts).
  await go('/?sku=origins&tab=lighting');
  const rail = await evaluate(`[...document.querySelectorAll('.kbd-canvas .kbd-qs-btn')].map(b => b.innerText.trim()).filter(Boolean)`);
  check(
    'the keyboard keeps its own key-group rail',
    JSON.stringify(rail) === JSON.stringify(['Reset', 'All', 'WASD', 'QWER', 'Numbers', 'Arrows', 'Functions']),
    JSON.stringify(rail),
  );
  check('the keyboard keeps its marquee tool', (await evaluate(`document.querySelectorAll('.kbd-canvas .kbd-qs-icon').length`)) === 1);
  check('the keyboard keeps its volume knob', (await evaluate(`document.querySelectorAll('.kbd-canvas .kbd-knob').length`)) === 1);
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// Leave the browser as we found it.
await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
await evaluate(`localStorage.removeItem('board-layout')`).catch(() => {});
await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

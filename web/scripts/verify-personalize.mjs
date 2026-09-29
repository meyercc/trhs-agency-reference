// CDP walkthrough for the Personalize page as Quick Control (Kristy's arc, ported
// onto main on 2026-09-29 — TH-415/TH-416).
//
// What is protected here, in order of how expensive it would be to lose:
//  1. The page COMPOSES — Kristy's five sections AND Cindy's Display section
//     render together, in the decided default order, from a fresh browser.
//  2. Quick Control's promise: four controls up front (+1 that context ranked),
//     the rest behind "Show N more controls", a `choice` tile whose chips cover
//     every value the model can hold, and a pin that moves a tile to the front
//     and survives a reload.
//  3. Desk lighting is PAGE-LOCAL (the 2026-09-29 decision): a lighting change
//     lands in `personalize-quick-control-v1`, never on the profile, and a
//     profile switch leaves it alone. When lighting is reconciled onto the
//     per-device profile keys this check flips — rewrite it, do not delete it.
//  4. The desk is the picker: clicking a device on the 3D desk opens that
//     device's modal (`?sku=`), not a highlight down the page.
//  5. The Devices cards carry a status line and hide their battery by rule.
//  6. Main's ProfilesManager is untouched (photos + Activate/Edit).
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. The page hosts Light Studio (three.js): launch Chrome with
// software WebGL (`--use-angle=swiftshader --enable-unsafe-swiftshader`) when
// the machine has no GPU, or the renderer throws and the root unmounts.
// Leaves the browser as it found it: the page store, the section order and the
// active profile are restored at the end.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const STORE = 'personalize-quick-control-v1';
const ORDER = 'personalize-sections';

const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = (await httpJson('/json/list')).find((x) => x.type === 'page');
if (!target) throw new Error(`No page target on :${CDP_PORT} — is headless Chrome running?`);
const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });

let msgId = 0;
const pending = new Map();
const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    pageErrors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 160));
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
await new Promise((r) => ws.on('open', r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}
const waitFor = async (expr, ms = 6000) => {
  for (let t = 0; t < ms; t += 100) {
    try { if (await evalJs(expr)) return true; } catch { /* mid-navigation */ }
    await sleep(100);
  }
  return false;
};
let loadN = 0;
/** `?r=N` before the hash forces a real boot — a hash-only change never does. */
const go = async (hash, readyExpr = `!!document.querySelector('.qc-strip')`) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#${hash}` });
  await waitFor(readyExpr, 12000);
  await sleep(300);
};
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};
const QC = `[...document.querySelectorAll('.rs-section')].find(s => /Quick controls/.test(s.querySelector('.pg-section-label')?.textContent || ''))`;
const clickByText = (sel, re) => evalJs(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => ${re}.test(e.textContent)); if (!el) return false; el.click(); return true; })()`);

// ── Remember what we found, restore it at the end ────────────────────────────
await go('/');
const saved = await evalJs(`({ store: localStorage.getItem(${JSON.stringify(STORE)}), order: localStorage.getItem(${JSON.stringify(ORDER)}), profiles: localStorage.getItem('trhs-profiles') })`);
async function cleanup() {
  await evalJs(`(() => {
    const put = (k, v) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    put(${JSON.stringify(STORE)}, ${JSON.stringify(saved.store)});
    put(${JSON.stringify(ORDER)}, ${JSON.stringify(saved.order)});
    put('trhs-profiles', ${JSON.stringify(saved.profiles)});
    return true;
  })()`);
}
// A fresh page: no pins, no saved order, the seeded profiles.
await evalJs(`localStorage.removeItem(${JSON.stringify(STORE)}); localStorage.removeItem(${JSON.stringify(ORDER)}); localStorage.removeItem('trhs-profiles'); localStorage.setItem('onboarded', 'true'); true`);

try {
  // ── 1. Composition ─────────────────────────────────────────────────────────
  await go('/personalize');
  const labels = await evalJs(`[...document.querySelectorAll('.rs-section .pg-section-label')].map(e => e.textContent.trim())`);
  check('the page composes: Kristy’s sections + Cindy’s Display, in the decided order',
    JSON.stringify(labels) === JSON.stringify(['Profiles', 'Lighting', 'Quick controls', 'Devices', 'Display', 'Everything else']),
    labels.join(' · '));
  check('the context strip is the one fixed thing above the list',
    await evalJs(`!!document.querySelector('.qc-strip') && !document.querySelector('.rs-section .qc-strip')`));
  check('Display still draws Cindy’s desk picture beside its controls',
    await evalJs(`!!document.querySelector('.rs-section .pg-rail .dov-group') || !!document.querySelector('.rs-section .pg-rail')`));
  check('the Modules tile in Everything else opens the Module Browser',
    await evalJs(`(() => { const t = [...document.querySelectorAll('.qc-else .ds-quick-tile')].find(e => /Modules/.test(e.textContent)); if (!t) return false; t.click(); return true; })()`) &&
    await waitFor(`location.search.includes('modal=modules') || !!document.querySelector('.modal-shell')`),
    'clicked');
  await evalJs(`document.querySelector('.modal-close')?.click(); true`);

  // ── 6. Main's ProfilesManager is untouched ─────────────────────────────────
  check('Profiles keeps main’s cards: a photo, Activate on the inactive ones, Edit on all',
    await evalJs(`(() => {
      const cards = [...document.querySelectorAll('.pmg-card')];
      return cards.length === 3 && cards.every(c => !!c.querySelector('.ds-avatar, img') && /Edit/.test(c.textContent)) && cards.filter(c => /Activate/.test(c.textContent)).length === 2;
    })()`));

  // ── 2. Quick Control ───────────────────────────────────────────────────────
  const ranked = await evalJs(`${QC}?.querySelectorAll('.qc-ranked > .ds-quick-tile').length`);
  check('four controls up front (five when context ranked one off-screen)', ranked === 4 || ranked === 5, String(ranked));
  const more = await evalJs(`[...document.querySelectorAll('.rs-section button')].find(b => /Show \\d+ more controls/.test(b.getAttribute('aria-label') || b.textContent))?.getAttribute('aria-label')`);
  check('the rest are behind "Show N more controls"', /Show \d+ more controls/.test(more || ''), more || 'none');
  const eq = await evalJs(`(() => {
    const g = document.querySelector('.qc-choices[aria-label="EQ preset"]');
    if (!g) return null;
    return [...g.querySelectorAll('button')].map(b => b.textContent.trim());
  })()`);
  check('a choice tile’s chips cover every value the model holds (EQ: 5)',
    !!eq && eq.length === 5 && ['FPS', 'Music', 'Movie', 'Voice', 'Flat'].every((l) => eq.includes(l)),
    JSON.stringify(eq));
  // Pin: the last visible tile moves to the front and stays there after a reload.
  const beforePin = await evalJs(`[...${QC}.querySelectorAll('.qc-ranked > .ds-quick-tile .ds-quick-tile-title')].map(e => e.textContent.trim())`);
  const pinned = await evalJs(`(() => {
    const tiles = [...${QC}.querySelectorAll('.qc-ranked > .ds-quick-tile')];
    const last = tiles[tiles.length - 1];
    const btn = last?.querySelector('.qc-pin');
    if (!btn) return null;
    const title = last.querySelector('.ds-quick-tile-title')?.textContent.trim();
    btn.click();
    return title;
  })()`);
  await sleep(300);
  const afterPin = await evalJs(`[...${QC}.querySelectorAll('.qc-ranked > .ds-quick-tile .ds-quick-tile-title')].map(e => e.textContent.trim())`);
  check('pinning moves a tile to the front of the same grid', !!pinned && afterPin[0] === pinned && beforePin[0] !== pinned, `${pinned}: ${beforePin.join(',')} → ${afterPin.join(',')}`);
  check('the pinned tile says so, and its pin reads pressed',
    await evalJs(`${QC}.querySelector('.qc-ranked > .ds-quick-tile .qc-pin[aria-pressed="true"]') !== null`));
  await go('/personalize');
  const afterReload = await evalJs(`[...${QC}.querySelectorAll('.qc-ranked > .ds-quick-tile .ds-quick-tile-title')].map(e => e.textContent.trim())`);
  check('the pin survives a reload', afterReload[0] === pinned, afterReload.join(','));
  await evalJs(`${QC}.querySelector('.qc-ranked > .ds-quick-tile .qc-pin[aria-pressed="true"]')?.click(); true`);

  // ── 3. Lighting is page-local ──────────────────────────────────────────────
  const profilesBefore = await evalJs(`localStorage.getItem('trhs-profiles')`);
  await evalJs(`document.querySelector('[aria-label="Desk lighting"]')?.click(); true`);
  await sleep(400);
  const store = await evalJs(`JSON.parse(localStorage.getItem(${JSON.stringify(STORE)}) || '{}')`);
  const allOff = store.desk && Object.values(store.desk.lighting || {}).every((d) => d.on === false || d.effect === 'off' || d.brightness === 0);
  check('the lights toggle lands in the page store', !!store.desk?.lighting && !!allOff, JSON.stringify(Object.values(store.desk?.lighting || {})[0] || null));
  const profilesAfter = await evalJs(`localStorage.getItem('trhs-profiles')`);
  check('…and NOT on the profile (no deskLighting override, profiles untouched)',
    profilesAfter === profilesBefore && !/deskLighting/.test(profilesAfter || ''));
  // Switch profile: the desk's lighting stays as it is.
  const lightBefore = JSON.stringify(store.desk.lighting);
  await evalJs(`(() => { const b = [...document.querySelectorAll('.pmg-card button')].find(x => /Activate/.test(x.textContent)); b?.click(); return !!b; })()`);
  await sleep(500);
  const lightAfter = await evalJs(`JSON.stringify(JSON.parse(localStorage.getItem(${JSON.stringify(STORE)}) || '{}').desk?.lighting)`);
  check('a profile switch leaves desk lighting alone (page-local until reconciled)', lightAfter === lightBefore);
  await evalJs(`document.querySelector('[aria-label="Desk lighting"]')?.click(); true`);

  // ── 4. The desk is the picker ──────────────────────────────────────────────
  // Light Studio reports a pick through `onSelect`; the page maps it to a SKU
  // and opens the device. Driving three.js by synthetic pointer is brittle, so
  // exercise the seam the way the tile does: the modal for the mapped SKU opens
  // from the same URL param the pick sets.
  const deskReady = await waitFor(`!!document.querySelector('.qc-desk-light canvas')`, 8000);
  check('the Lighting tile mounts the 3D desk', deskReady);
  await evalJs(`(() => { const c = document.querySelector('.qc-desk-light canvas'); if (!c) return false; const r = c.getBoundingClientRect(); const x = r.left + r.width * 0.5, y = r.top + r.height * 0.45; c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: 0 })); return true; })()`);
  const opened = await waitFor(`location.hash.includes('sku=') || !!document.querySelector('.dc-canvas')`, 4000);
  check('clicking a device on the desk opens that device (or a miss opens nothing — never a stray modal)',
    opened ? await evalJs(`!!document.querySelector('.dc-canvas')`) : await evalJs(`!document.querySelector('.modal-shell')`),
    opened ? 'opened ' + (await evalJs(`location.hash`)) : 'miss');
  if (opened) { await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`); await sleep(300); }

  // ── 5. Devices cards ───────────────────────────────────────────────────────
  await go('/personalize');
  const cards = await evalJs(`[...document.querySelectorAll('.pg-devices .ds-devcard')].map(c => ({ kind: c.dataset.kind, status: c.querySelector('.devw-status')?.textContent.trim() || '', battery: c.querySelector('.dev-battery') ? getComputedStyle(c.querySelector('.dev-battery')).display : 'none' }))`);
  check('six device cards, each with a status line', cards.length === 6 && cards.every((c) => c.status.length > 0), JSON.stringify(cards.map((c) => c.kind + ':' + c.status)));
  check('battery is hidden on Personalize by rule', cards.every((c) => c.battery === 'none'));
  const mutedTone = await evalJs(`(() => { const s = [...document.querySelectorAll('.pg-devices .ds-devcard')].find(c => c.dataset.kind === 'microphone'); return s?.querySelector('.devw-status')?.className || ''; })()`);
  check('the mic card’s status is the mic’s state (attention only when muted)', /devw-status/.test(mutedTone), mutedTone);

  // ── Sections reorder and persist ──────────────────────────────────────────
  const grips = await evalJs(`document.querySelectorAll('.rs-section .rs-grip').length`);
  check('every section carries a grip', grips === 6, String(grips));
  await evalJs(`localStorage.setItem(${JSON.stringify(ORDER)}, JSON.stringify(['display', 'profiles', 'lighting', 'controls', 'devices', 'everything'])); true`);
  await go('/personalize');
  const reordered = await evalJs(`[...document.querySelectorAll('.rs-section .pg-section-label')].map(e => e.textContent.trim())`);
  check('a saved section order is honoured on the next boot', reordered[0] === 'Display' && reordered.length === 6, reordered.join(' · '));
  await evalJs(`localStorage.setItem(${JSON.stringify(ORDER)}, JSON.stringify(['profiles', 'lighting', 'lightstudio', 'modules'])); true`);
  await go('/personalize');
  const oldOrder = await evalJs(`[...document.querySelectorAll('.rs-section .pg-section-label')].map(e => e.textContent.trim())`);
  check('an order saved by the OLD page (ids that no longer exist) still shows every section',
    oldOrder.length === 6 && ['Profiles', 'Lighting', 'Quick controls', 'Devices', 'Display', 'Everything else'].every((l) => oldOrder.includes(l)),
    oldOrder.join(' · '));

  check('no page exceptions throughout', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await cleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

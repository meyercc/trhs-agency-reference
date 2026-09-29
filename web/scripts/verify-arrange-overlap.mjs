// The overlap limit on the shared arrangement (healOverlap, arrangement.ts).
//
// The bug this guards (2026-08-28, Cindy's screenshots): a stored layout can
// hold one display BURIED in another — deeper than the quarter-tuck allowance
// on both axes — and the two view surfaces drew it verbatim while the Arrange
// editor healed only its own working copy: three pictures of one desk, all
// different. The heal now runs where the store is read and where the one
// free-placement writer commits.
//
// What is checked here, on the monitor-modal hero (no WebGL, headless-safe):
//   1. clean store        → no buried pair (baseline)
//   2. seeded burial      → drawn desk has NO buried pair (the heal) — this
//                           check FAILS on 797f562, the commit before the fix
//   3.                    → left-to-right order of the seeded desk survives
//   4.                    → merely LOOKING at the desk does not rewrite the
//                           store (heal is draw-time; the store stays as saved)
//   5. Arrange editor     → still opens on the same store, tiles not buried
//   6. editor ROUND TRIP  → drag a display below another, close: the hero
//                           draws a DESIGNED desk (2026-08-29, Cindy) —
//                           row bottoms share the floor, the side gap is the
//                           designed one (not packed flush), the stacked
//                           display sits centred under its row, and reopening
//                           the editor still shows the stack
//
// The Personalize DESK card runs the same healOverlap through the same call
// shape (DeskWidget `saved` + drag commit); its coverage lives in
// verify-desk-card.mjs, whose drag checks exercise the commit-path heal (a
// 90px drag now settles at the quarter-tuck allowance and survives reload).
// ⚠️ Harness note (2026-08-29, Chrome 151): on the WebGL pages the OLD
// swiftshader recipe (--use-gl=angle --use-angle=swiftshader) now wedges the
// tab; plain `--headless=new` WITH GPU is what works. The 2026-08-21 note in
// verify-arrange-return.mjs prescribing swiftshader is stale on this machine.
//
// Run: CDP=<port> PORT=<vite port> node scripts/verify-arrange-overlap.mjs
import WebSocket from 'ws';
// Desk hardware — the Admin axis since 2026-09-08. `displayCount`/`pcCount` are
// gone; the desk is a LIST of optional devices (`deskDevices`) and the numbers
// are derived. This maps the (screens, PCs) pairs these checks were written in
// onto the real desks: 3 screens = OMEN + laptop lid + Treehouse; 2 = laptop
// lid + Treehouse; 1 = the tower alone with the Treehouse (a laptop on the desk
// brings its screen, so a one-screen desk has no laptop). PCs 1 drops the tower.
const DESK = (screens, pcs = 2) => JSON.stringify(
  screens >= 3 ? ['pulse-27', 'macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : screens === 2 ? ['macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : ['tower']);

const CDP = process.env.CDP || '9246', PORT = process.env.PORT || '5215';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const t = tl.find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
const pend = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const send = (me, pa = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id: i, method: me, params: pa }));
  });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: e, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 500));
  return result.value;
};
const wait = async (e, ms = 30000) => {
  const u = Date.now() + ms;
  while (Date.now() < u) {
    if (await ev(`!!(${e})`)) return true;
    await sleep(300);
  }
  return false;
};
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Buried = past the quarter allowance on BOTH axes (arrangement.ts MAX_OVERLAP).
// Screen space is fine: overlap and allowance scale together under the zoom.
// Every caller passes DISPLAY tiles only (`:not(.dsa-computer)` / `:not(.ae-pc)`):
// both pictures stand the computer in the row too since 2026-09-18, and the
// overlap rules here are about screens. The computer is checked in
// verify-desk-agreement.mjs.
const rectsOf = (sel, nameSel) => `[...document.querySelectorAll('${sel}')].map(d=>{
  const b=('${nameSel}'? d.querySelector('${nameSel}'):d).getBoundingClientRect();
  // By device id, not caption: the hero says "MacBook", the editor "Built-in
  // Display" — same device (2026-09-21).
  return {n:d.dataset.display||'?',
    l:b.left,t:b.top,w:b.width,h:b.height};})`;
const buriedPairs = (rs, eps = 0.5) => {
  const out = [];
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
      const oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
      if (ox > 0.25 * Math.min(a.w, b.w) + eps && oy > 0.25 * Math.min(a.h, b.h) + eps)
        out.push(`${a.n}×${b.n} ${ox.toFixed(0)}×${oy.toFixed(0)}px`);
    }
  return out;
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 1, mobile: false });

// 1 — clean store
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` });
await sleep(800);
await wait(`document.getElementById('root')?.children.length`);
await ev(`localStorage.clear()`);
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}#/perform?sku=treehouse-32` });
await sleep(1200);
await wait(`document.querySelector('.dsa-disp .dsa-bounds')`);
await sleep(600);
let hero = await ev(rectsOf('.dsa-disp:not(.dsa-computer)', '.dsa-bounds'));
check('clean store: hero has no buried pair', buriedPairs(hero).length === 0, buriedPairs(hero).join(' '));

// 2..4 — seeded burial (the 2026-08-28 state)
const BAD = {
  mode: 'extend', space: 'fraction',
  positions: {
    'oled-27': { left: 0.28, top: 0.3 },
    'treehouse-32': { left: 0.36, top: 0.34 },
    builtin: { left: 0.44, top: 0.52 },
  },
};
await ev(`localStorage.setItem('displayArrange', ${JSON.stringify(JSON.stringify(BAD))})`);
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}#/perform?sku=treehouse-32` });
await sleep(1500);
await wait(`document.querySelector('.dsa-disp .dsa-bounds')`);
await sleep(800);
hero = await ev(rectsOf('.dsa-disp:not(.dsa-computer)', '.dsa-bounds'));
const buried = buriedPairs(hero);
check('seeded burial: hero draws no buried pair (healed)', buried.length === 0, buried.join(' ') || hero.map((r) => `${r.n}@${r.l.toFixed(0)}`).join(' '));
const order = [...hero].sort((a, b) => a.l - b.l).map((r) => r.n).join(' | ');
check('seeded burial: left-to-right order survives the heal',
  order === 'oled-27 | treehouse-32 | builtin', order);
const storeNow = await ev(`localStorage.getItem('displayArrange')`);
check('looking at the desk does not rewrite the store', storeNow === JSON.stringify(BAD));

// 5 — the editor still opens and is itself legal
await ev(`[...document.querySelectorAll('.dsa-actions button')].find(b=>b.textContent.trim()==='Arrange')?.click()`);
check('Arrange editor opens on the same store', await wait(`document.querySelector('.arrange-modal .ae-tile')`));
await sleep(600);
const ae = await ev(rectsOf('.ae-tile:not(.ae-pc)', ''));
check('editor tiles are not buried either', buriedPairs(ae).length === 0, buriedPairs(ae).join(' '));

// 6 — editor round trip: the hero redraws as a designed desk
// (close the editor left open by the section above, then start clean)
await ev(`document.querySelector('.arrange-modal .modal-close')?.click()`);
await sleep(800);
await ev(`localStorage.clear()`);
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}#/perform?sku=treehouse-32` });
await sleep(1500);
await wait(`document.querySelector('.dsa-disp .dsa-bounds')`);
await sleep(600);
await ev(`[...document.querySelectorAll('.dsa-actions button')].find(b=>b.textContent.trim()==='Arrange')?.click()`);
await wait(`document.querySelector('.arrange-modal .ae-tile')`);
await sleep(700);
const tileBox = async (name) => (await ev(rectsOf('.ae-tile:not(.ae-pc)', ''))).find((x) => x.n === name);
const omen = await tileBox('oled-27');
const tre = await tileBox('treehouse-32');
const drag = async (from, to, steps = 14) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
      button: 'left', buttons: 1,
    });
    await sleep(25);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 });
};
await drag(
  { x: tre.l + tre.w / 2, y: tre.t + tre.h / 2 },
  { x: omen.l + omen.w / 2, y: omen.t + omen.h + tre.h / 2 + 10 },
);
await sleep(900);
await ev(`document.querySelector('.arrange-modal .modal-close').click()`);
await wait(`!document.querySelector('.arrange-modal')`);
await sleep(900);
const rt = await ev(rectsOf('.dsa-disp:not(.dsa-computer)', '.dsa-bounds'));
const rOmen = rt.find((x) => x.n === 'oled-27');
const rMac = rt.find((x) => x.n === 'builtin');
const rTre = rt.find((x) => x.n === 'treehouse-32');
// The desk picture is a desk (2026-09-24, Cindy «응»): a display stacked under
// another in the Arrange window is drawn standing beside it, in one row on one
// floor — only the ORDER crosses over. The editor keeps the stack (checked below).
const floors = [rOmen, rMac, rTre].map((r) => r.t + r.h);
check('round trip: the desk picture is one row on one floor',
  Math.max(...floors) - Math.min(...floors) <= 1.5, `bottoms ${floors.map((f) => f.toFixed(1)).join(' / ')}`);
const byX = [rOmen, rMac, rTre].sort((a, b) => a.l - b.l);
const gaps = byX.slice(1).map((r, i) => r.l - (byX[i].l + byX[i].w));
check('round trip: neighbours stand apart at the designed gap, none overlap',
  gaps.every((g) => g > 8), `gaps ${gaps.map((g) => g.toFixed(1)).join(' / ')}px`);
await ev(`[...document.querySelectorAll('.dsa-actions button')].find(b=>b.textContent.trim()==='Arrange')?.click()`);
await wait(`document.querySelector('.arrange-modal .ae-tile')`);
await sleep(700);
const ae2 = await ev(rectsOf('.ae-tile:not(.ae-pc)', ''));
const eOmen = ae2.find((x) => x.n === 'oled-27');
const eTre = ae2.find((x) => x.n === 'treehouse-32');
check('round trip: reopening the editor still shows the stack',
  eTre.t >= eOmen.t + eOmen.h - 2, `editor tre top ${eTre.t.toFixed(0)} vs omen bottom ${(eOmen.t + eOmen.h).toFixed(0)}`);

// ── A display attached AFTER the layout was saved (2026-09-02) ───────────────
// A saved layout describes the desk that existed when it was saved. Attach
// another display and it says nothing about the newcomer, and `readArrangement`
// used to leave it on its raw `DEFAULTS` slot — a slot authored for a
// three-display desk that knows nothing about where the saved displays landed.
// Measured that day: with a two-display layout saved and a third attached,
// `oled-27` took .0357 while the saved `builtin` sat at .0328, so the hero drew
// the two OVERLAPPING BY 77px while the Arrange window's packing butted them
// apart — the "hero doesn't match Arrange" that started this.
await ev(`localStorage.setItem('deskDevices','${DESK(2)}')`);
await ev(`localStorage.setItem('displayArrange', JSON.stringify({ mode:'extend', space:'fraction', positions:{ builtin:{left:0.0328, top:0.3593}, 'treehouse-32':{left:0.2418, top:0.2531} } }))`);
await ev(`localStorage.setItem('deskDevices','${DESK(3)}')`);
await send('Page.navigate', { url: `http://localhost:${PORT}/?grow=1#/?sku=treehouse-32&tab=display` });
await sleep(3200);
const grown = await ev(`(() => {
  const st = document.querySelector('.dsa-stage');
  if (!st) return null;
  const sr = st.getBoundingClientRect();
  const t = [...st.querySelectorAll('.dsa-disp:not(.dsa-computer)')].map((e) => {
    const r = e.getBoundingClientRect();
    return { nm: e.dataset.display, x: r.left - sr.left, w: r.width };
  }).sort((a, b) => a.x - b.x);
  const gaps = [];
  for (let i = 1; i < t.length; i += 1) gaps.push(t[i].x - (t[i - 1].x + t[i - 1].w));
  return { names: t.map((d) => d.nm), gaps };
})()`);
check('a display added to a saved desk does not land on top of another',
  !!grown && grown.gaps.every((g) => g > 0), grown ? grown.gaps.map((g) => g.toFixed(0)).join(' / ') : 'no stage');
check('and it takes its authored place in the row',
  !!grown && grown.names.join(' → ') === 'oled-27 → builtin → treehouse-32',
  grown ? grown.names.join(' → ') : '-');


console.log(results.every(Boolean) ? `PASS ${results.length}/${results.length}` : `FAIL ${results.filter((x) => !x).length} of ${results.length}`);
ws.close();
process.exit(results.every(Boolean) ? 0 : 1);

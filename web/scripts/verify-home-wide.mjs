// CDP check for the wide Home board (2026-10-21; replaces the TH-440 suite).
//
// What is protected:
//  1. THE BOARD GROWS BY WHOLE WIDGETS. A track is (1100 − 5·24)/6 = 163.33px
//     on the 1100 page every screen was drawn at; one standard widget (span 2)
//     plus its gap is 374.67. Where eight tracks fit the page (≥1523 of page
//     container) the content cap is 1474.67 and the grid runs eight columns;
//     where ten fit (≥1898) it is 1849.33 and ten. A span-2 card measures the
//     SAME width at 1440, 1600 and 1920 — the whole point: nothing stretches.
//  2. THE CAROUSEL IS THE GRID'S FIRST CELL — six columns by two rows (344px),
//     top-left — and the widgets PACK BESIDE IT in the columns a wider page adds
//     (Chris, 2026-10-21: «i can't place widgets in the top row by the
//     carousel»). A one-row card lands beside it with its top on the hero's top;
//     a second one-row card under that ends on the hero's bottom line (the card
//     rule). Its width is six tracks — exactly the 1440 width.
//  3. ONE DECISION. The column count is the board's class (`.wb-grid.cols-N`,
//     from the page's width) and the cap is shell.css's container query on the
//     same named width. They agree, or a card lands in an implicit column
//     (gotcha 62). The page's width, not the window's: with Nova pinned at 1920
//     the page is 1477 and the board stays at six.
//  4. THE AURA stays anchored to the app top, full-bleed, wherever the carousel
//     box sits.
//  5. AN OLD BOARD STILL LOADS: a stored layout carrying TH-440's `slot` draws
//     every card on the grid.
//
// Proven to fail (2026-10-21): dropping `cols-8`/`cols-10` from the grid's
// class reds exactly the two "span-2 card is exactly as wide" checks (367 and
// 444 against 351) while the cap checks stay green — the failure shape of
// gotcha 62. Note what did NOT go red: `grid-template-columns` still read 8
// and 10, because explicit placement past six tracks grows IMPLICIT columns
// and the computed value lists those too. So the column checks below read the
// class as well, and the width check is the one that carries the weight.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. Writes `board-layout`, `trhs-modules` and `novaPinned`, and
// clears them at the end.
import WebSocket from 'ws';

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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const viewport = async (w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
};
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
  await Promise.race([loaded, sleep(8000)]);
  await sleep(1500);
};
const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
const width = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.getBoundingClientRect().width : null; })()`);
// Tracks AND the class: an explicit placement past the class's count grows
// implicit tracks that the computed value also lists (see the header).
const cols = () => ev(`(() => { const g = document.querySelector('.wb-grid'); const n = getComputedStyle(g).gridTemplateColumns.split(' ').length; const m = /cols-(\\d+)/.exec(g.className); const c = m ? Number(m[1]) : 6; return n === c ? n : -1; })()`);
const gridClass = () => ev(`document.querySelector('.wb-grid').className`);
const near = (a, b, tol = 1) => a != null && b != null && Math.abs(a - b) <= tol;

// A board with a known span-2 card to measure, and a span-4 beside it.
const SEED = [{ id: 'cpu', span: 2, rows: 1 }, { id: 'appearance', span: 2, rows: 1 }, { id: 'vitals', span: 4, rows: 2 }];
const top = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.getBoundingClientRect().top : null; })()`);
const bottom = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.getBoundingClientRect().bottom : null; })()`);
await viewport(1440, 1000);
await go('/');
await ev(`localStorage.setItem('board-layout', JSON.stringify(${JSON.stringify(SEED)})); localStorage.setItem('novaPinned', '0'); localStorage.setItem('novaEntry', 'topbar'); localStorage.removeItem('trhs-modules'); 1`);

console.log('\nAt 1440 the page is the page it was');
await go('/');
check('six columns', (await cols()) === 6, `${await cols()}`);
check('and the grid carries no count class', !/cols-/.test(await gridClass()), await gridClass());
check('the content cap is the page cap (1100)', (await ev(`getComputedStyle(document.querySelector('.shell-content')).maxWidth`)) === '1100px', await ev(`getComputedStyle(document.querySelector('.shell-content')).maxWidth`));
const carousel1440 = await rect('.home-carousel .ds-carousel');
check('the carousel is two board rows tall (344)', near(carousel1440?.h, 344, 1), String(carousel1440?.h));
check('and at six columns every widget is under it', (await top('.wb-cell[data-widget="cpu"]')) >= (await bottom('.wb-hero')) - 1, `${await top('.wb-cell[data-widget="cpu"]')} vs hero bottom ${await bottom('.wb-hero')}`);
const card1440 = await width('.wb-cell[data-widget="cpu"]');
check('(setup) the span-2 card is on screen', card1440 != null && card1440 > 300, String(card1440));

console.log('\nAt 1600 eight tracks fit: one more widget');
await viewport(1600, 1000);
await go('/');
check('the route is marked page-wide', await ev(`document.querySelector('.shell').classList.contains('page-wide')`));
check('eight columns', (await cols()) === 8, `${await cols()}`);
check('the content is 1474.67 — one standard widget wider', near(await ev(`document.querySelector('.shell-content').getBoundingClientRect().width - 48`), 1474.67, 1), String(await ev(`document.querySelector('.shell-content').getBoundingClientRect().width - 48`)));
check('the span-2 card is exactly as wide as at 1440', near(await width('.wb-cell[data-widget="cpu"]'), card1440, 1), `${await width('.wb-cell[data-widget="cpu"]')} vs ${card1440}`);
let carousel = await rect('.home-carousel .ds-carousel');
let content = await rect('.shell-content');
check('the carousel keeps exactly its 1440 width', near(carousel?.w, carousel1440?.w, 1), `${carousel?.w} vs ${carousel1440?.w}`);
check('left-aligned: its left edge is the content’s', !!carousel && !!content && near(carousel.x, content.x + 24, 1), JSON.stringify({ carousel, content }));
check('the first one-row card packs BESIDE it, top on the hero’s top', near(await top('.wb-cell[data-widget="cpu"]'), await top('.wb-hero'), 1) && (await ev(`document.querySelector('.wb-cell[data-widget="cpu"]').getBoundingClientRect().left`)) > carousel.x + carousel.w, `${await top('.wb-cell[data-widget="cpu"]')} vs ${await top('.wb-hero')}`);
check('the second one-row card sits under it and ends on the hero’s bottom line', near(await bottom('.wb-cell[data-widget="appearance"]'), await bottom('.wb-hero'), 1), `${await bottom('.wb-cell[data-widget="appearance"]')} vs ${await bottom('.wb-hero')}`);
check('and the span-4 card, too wide for the two spare columns, goes under the hero', (await top('.wb-cell[data-widget="vitals"]')) >= (await bottom('.wb-hero')) - 1);

console.log('\nAt 1920 ten tracks fit: two more widgets');
await viewport(1920, 1080);
await go('/');
check('ten columns', (await cols()) === 10, `${await cols()}`);
check('the content is 1849.33', near(await ev(`document.querySelector('.shell-content').getBoundingClientRect().width - 48`), 1849.33, 1), String(await ev(`document.querySelector('.shell-content').getBoundingClientRect().width - 48`)));
check('the span-2 card is still exactly as wide', near(await width('.wb-cell[data-widget="cpu"]'), card1440, 1), `${await width('.wb-cell[data-widget="cpu"]')} vs ${card1440}`);
carousel = await rect('.home-carousel .ds-carousel');
content = await rect('.shell-content');
check('the carousel keeps its width and its left edge', near(carousel?.w, carousel1440?.w, 1) && !!content && near(carousel.x, content.x + 24, 1), JSON.stringify({ carousel, content }));
check('the aura is still anchored to the app top', (await rect('.home-carousel .ds-carousel-aura'))?.y === 0, String((await rect('.home-carousel .ds-carousel-aura'))?.y));
check('and spans the window', near((await rect('.home-carousel .ds-carousel-aura'))?.w, await ev('document.documentElement.clientWidth'), 2), String((await rect('.home-carousel .ds-carousel-aura'))?.w));

console.log('\nThe page, not the window');
await ev(`localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
check('with Nova pinned at 1920 the page is 1477 and the board stays at six', await (async () => { for (let i = 0; i < 20; i++) { if ((await cols()) === 6) return true; await sleep(100); } return false; })(), `${await cols()}`);
check('and the content cap is back to 1100', (await ev(`getComputedStyle(document.querySelector('.shell-content')).maxWidth`)) === '1100px', await ev(`getComputedStyle(document.querySelector('.shell-content')).maxWidth`));
await ev(`localStorage.setItem('novaPinned', '0'); localStorage.removeItem('trhs-modules'); 1`);

console.log('\nAn old board still loads');
await ev(`localStorage.setItem('board-layout', JSON.stringify([{ id: 'cpu', span: 2, rows: 1, slot: 'left' }, { id: 'vitals', span: 4, rows: 2, slot: 'right' }, { id: 'appearance', span: 2, rows: 1 }])); 1`);
await go('/');
check('every card of a layout that still carries `slot` is on the grid', (await ev(`['cpu', 'vitals', 'appearance'].every((id) => !!document.querySelector('.wb-grid .wb-cell[data-widget="' + id + '"]'))`)));
check('and the hero is still the grid’s first cell', (await ev(`document.querySelector('.wb-grid > .wb-hero')?.style.gridRow`)) === '1 / span 2');

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
await ev(`localStorage.removeItem('board-layout'); localStorage.removeItem('novaPinned'); localStorage.removeItem('trhs-modules'); 1`).catch(() => {});
await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

// CDP check for the responsive shell (2026-10-20): the breakpoint scale, the
// page container, the sidebar model, the bottom nav and the interface-size zoom.
//
// What is protected:
//  1. NO ROUTE SCROLLS SIDEWAYS at any step of the scale (375 → 3840), with no
//     rail, with Nova at its default width and with Nova dragged wide. Sideways
//     overflow is the one responsive failure a screenshot of the top never shows.
//  2. THE NAV IS REACHABLE at every width. Below `compact` the top bar's tabs
//     move to a bottom tab bar with labels on; with more items than slots the
//     last fold into a "More" menu, and the menu holds EXACTLY the tabs the bar
//     does not — so every tab the 1440 nav offers is one or two presses away.
//  3. THE SIDEBAR RESERVES ITS DEFAULT WIDTH AND NO MORE (Chris, 2026-10-20).
//     Pinned at 380 the page clears it; stored at 700 the page keeps the same
//     reservation, the panel is 700 and floats over the page with its shadow.
//     Lose the `min()` in shell.css and the page squeezes to 700 again — which
//     looks like a page, so only the measurement tells.
//  4. THE CONTENT FLOOR: where the page beside a rail would drop below `medium`
//     the rail overlays instead (`.rail-overlay`, padding 0) — Devices too,
//     which used to squeeze at every width. At 1100 Nova still reserves; at
//     1024 it overlays. On `compact` both panels are edge-to-edge sheets.
//  5. THE PAGE CONTAINER: `.shell-scroll` is `@container page`, and the board's
//     wide band follows the PAGE's width — at 1920 with Nova pinned the page
//     is `expanded` and the band is one column; with Nova unpinned it is wide.
//  6. INTERFACE SIZE: at 3840×2160 the root zooms 1.5 automatically, nothing
//     overflows, and the page lays out as 2560 (the board is wide, not ultra-
//     stretched); at 2560×1440 it does not zoom. A stored `uiScale` of 125
//     zooms a 1440 window and still nothing overflows.
//  7. NOTHING THIS WORK ADDED IS UNDER 12px — Chris's floor (2026-10-20): the
//     bottom bar's labels and the More menu. The smallest text on each ROUTE is
//     measured and printed as a finding, not a failure: the first run found an
//     8px gauge unit, a 10px badge, a 9px "Auto" and an 11px device name that
//     predate the scale, and they are the handoff's to list, not this suite's
//     to red. The line is there so the next pass can watch the number climb.
//
// Proven to fail (2026-10-20): making the reservation follow the dragged
// width (`--rail-reserve-w: var(--nova-panel-w)` in shell.css) reds exactly
// the three reservation checks under 3 — the page still "clears" the panel,
// which is the failure shape — and nothing else.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default
// 9222), run from web/. Writes `trhs-modules`, `novaPinned`, `novaPanelW` and
// `uiScale`, and clears them at the end.
// Report → ~/Treehouse-monitor/design-loop/reports/<date>-responsive.md (every
// line, findings included) and a screenshot of Home at each width beside it in
// <date>-responsive/, the way tab-walk reports — the runner's $OUT_DIR is a
// temp dir it deletes, so a grid written there is never seen.
import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const REPORT_DIR = process.env.REPORT_DIR || join(homedir(), 'Treehouse-monitor/design-loop/reports');
const STAMP = new Date().toLocaleDateString('sv-SE'); // local yyyy-mm-dd, as the other reports
const log = [];

const BP = (() => {
  const { $comment: _, widths: __, ...bp } = createRequire(import.meta.url)('../../shared/breakpoints.json');
  return bp;
})();
const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const QUIET = !!process.env.QUIET;
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
  const line = `${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`;
  log.push(line);
  if (!QUIET || !ok) console.log(line);
};
/** A measurement worth reading, not a verdict (see 7 in the header). */
const findings = [];
const note = (text) => {
  findings.push(text);
  log.push(`  · ${text}`);
  if (!QUIET) console.log(`  · ${text}`);
};
const section = (t) => {
  log.push(`\n${t}`);
  if (!QUIET) console.log(`\n${t}`);
};
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const viewport = async (w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < BP.medium });
  await sleep(400);
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
  await sleep(1200);
};
const waitFor = async (expr, ms = 4000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(expr)) return true;
    await sleep(100);
  }
  return false;
};
const click = async (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
const SHOTS = join(REPORT_DIR, `${STAMP}-responsive`);
const shot = async (name) => {
  try {
    mkdirSync(SHOTS, { recursive: true });
    const png = (await send('Page.captureScreenshot', { format: 'png' })).data;
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(png, 'base64'));
  } catch {
    /* a screenshot is a courtesy, never a failure */
  }
};

// ── the measurements ─────────────────────────────────────────────────────────
// Sideways overflow, in the document's own px (zoomed or not).
const overflowX = () => ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
// The smallest font-size of any element that shows text, with where it is.
const minFont = () => ev(`(() => {
  let min = Infinity, at = '';
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < min) { min = fs; at = (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase(); at += ' "' + t.slice(0, 24) + '"'; }
  }
  return { min, at };
})()`);
const navLabels = (scope) => ev(`[...document.querySelectorAll(${JSON.stringify(scope + ' .ds-menu-item')})].map((e) => e.getAttribute('aria-label') || e.textContent.trim())`);
const padRight = () => ev(`parseFloat(getComputedStyle(document.querySelector('.shell-scroll')).paddingRight)`);
const rectOf = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }; })()`);
const hasClass = (sel, c) => ev(`!!document.querySelector(${JSON.stringify(sel)})?.classList.contains(${JSON.stringify(c)})`);

const setModules = (obj) => ev(`localStorage.setItem('trhs-modules', JSON.stringify(${JSON.stringify(obj)}))`);
const ROUTES = ['/', '/perform', '/personalize', '/play', '/shop', '/nova'];
const SIZES = [
  [375, 812, 'compact'],
  [768, 1024, 'medium'],
  [1024, 768, 'expanded'],
  [1440, 900, 'expanded'],
  [1920, 1080, 'wide'],
  [2560, 1440, 'ultra'],
  [3840, 2160, 'ultra'],
];

// A known start: Nova installed (its panel is half of what is checked), not pinned.
await viewport(1440, 900);
await go('/');
await setModules({ nova: true });
// This suite is about the RAIL — Top bar entry (Floating is the default since 2026-10-28).
await ev(`localStorage.setItem('novaEntry', 'topbar'); localStorage.setItem('novaPinned', '0'); localStorage.removeItem('novaPanelW'); localStorage.removeItem('uiScale'); localStorage.removeItem('novaRails'); 1`);
await go('/');
check('the page container is `.shell-scroll`', (await ev(`getComputedStyle(document.querySelector('.shell-scroll')).containerName`)) === 'page');
const allTabs = await navLabels('.shell-nav');
check('the 1440 nav offers its tabs', allTabs.length >= 5, JSON.stringify(allTabs));

// ── 1 + 2 + 7: every route at every step ─────────────────────────────────────
for (const [w, h, step] of SIZES) {
  section(`${w}×${h} (${step})`);
  await viewport(w, h);
  for (const route of ROUTES) {
    await go(route);
    const over = await overflowX();
    check(`${route} does not scroll sideways at ${w}`, over <= 1, `${over}px over`);
    const font = await minFont();
    if (font.min < 12) note(`${route} at ${w}: smallest text ${font.min}px (${font.at}) — under the 12px floor, predates the scale`);
    if (route === '/') await shot(`${w}-home`);
  }
  await go('/');
  const compact = w < BP.medium;
  const bottom = await ev(`!!document.querySelector('.shell-bottom-nav .ds-menu.bar')`);
  const top = await ev(`!!document.querySelector('.shell-nav .ds-menu')`);
  check(`the nav is ${compact ? 'a bottom bar' : 'the top pill'} at ${w}`, compact ? bottom && !top : top && !bottom);
  if (compact) {
    const barTabs = await navLabels('.shell-bottom-nav .ds-menu');
    check('labels are on in the bottom bar', await ev(`getComputedStyle(document.querySelector('.shell-bottom-nav .ds-menu-label')).display !== 'none'`));
    const barFont = await ev(`parseFloat(getComputedStyle(document.querySelector('.shell-bottom-nav .ds-menu-label')).fontSize)`);
    check('and at least 12px — the floor', barFont >= 12, `${barFont}px`);
    const clipped = await ev(`[...document.querySelectorAll('.shell-bottom-nav .ds-menu-label')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent)`);
    check('and no label is clipped in its slot (short labels where the full one would be)', clipped.length === 0, JSON.stringify(clipped));
    const item = await rectOf('.shell-bottom-nav .ds-menu-item');
    check('each tab meets the 44px touch target', !!item && item.b - item.t >= 44, JSON.stringify(item));
    check('the bar sits inside the window', !!item && item.b <= h && item.l >= 0);
    const hasMore = barTabs.includes('More');
    check('at most five slots, the last "More" when the tabs do not fit', barTabs.length <= 5 && (allTabs.length <= 5 ? !hasMore : hasMore), JSON.stringify(barTabs));
    if (hasMore) {
      await click('.shell-bottom-nav .ds-menu-item:last-child');
      check('More opens a menu above the bar', await waitFor(`!!document.querySelector('.shell-nav-more')`));
      const more = await ev(`[...document.querySelectorAll('.shell-nav-more [role="menuitem"]')].map((e) => e.textContent.trim())`);
      const shown = barTabs.filter((t) => t !== 'More');
      check('which holds exactly the tabs the bar does not', JSON.stringify([...shown, ...more]) === JSON.stringify(allTabs), `${JSON.stringify(shown)} + ${JSON.stringify(more)} vs ${JSON.stringify(allTabs)}`);
      const menu = await rectOf('.shell-nav-more');
      const bar = await rectOf('.shell-bottom-nav');
      check('the menu is above the bar and inside the window', !!menu && !!bar && menu.b <= bar.t && menu.l >= 0 && menu.r <= w, JSON.stringify({ menu, bar }));
      check('focus moved into it', await ev(`document.activeElement?.getAttribute('role') === 'menuitem'`));
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      check('Escape closes it', await waitFor(`!document.querySelector('.shell-nav-more')`));
      await click('.shell-bottom-nav .ds-menu-item:last-child');
      await waitFor(`!!document.querySelector('.shell-nav-more')`);
      const first = more[0];
      await ev(`[...document.querySelectorAll('.shell-nav-more [role="menuitem"]')].find((e) => e.textContent.trim() === ${JSON.stringify(first)})?.click(); 1`);
      await sleep(400);
      const went = (await ev(`location.hash`)) !== '#/' || (await ev(`!!document.querySelector('.shell.devices-open')`));
      check(`picking "${first}" from More acts (navigates, or opens its panel)`, went, await ev(`location.hash`));
      check('and the menu closes', await waitFor(`!document.querySelector('.shell-nav-more')`));
    }
    const pad = await ev(`parseFloat(getComputedStyle(document.querySelector('.shell-content')).paddingBottom)`);
    check('the page reserves the bar under its content', pad >= 64 + 24, `${pad}px`);
  }
}

// ── 3: the reservation is the default width, the rest floats ─────────────────
section('The sidebar reserves its default width (Chris, 2026-10-20)');
await viewport(1440, 900);
await go('/');
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await go('/');
check('pinned at the default, the page reserves 380 + two gutters', await waitFor(`Math.round(parseFloat(getComputedStyle(document.querySelector('.shell-scroll')).paddingRight)) === 428`), `${await padRight()}`);
let panel = await rectOf('.nova-panel');
let content = await rectOf('.shell-content');
check('and the page clears the panel', !!panel && !!content && content.r <= panel.l + 1, JSON.stringify({ panel, content }));
check('a panel at its default does not float', !(await hasClass('.nova-panel', 'floating')));
await ev(`localStorage.setItem('novaPanelW', '700'); 1`);
await go('/');
panel = await rectOf('.nova-panel');
content = await rectOf('.shell-content');
check('stored at 700, the panel is 700 (plus its two 1px borders)', !!panel && Math.abs(panel.w - 700) <= 2, JSON.stringify(panel));
check('the page STILL reserves only the default', Math.round(await padRight()) === 428, `${await padRight()}`);
check('so the page runs under the panel', !!panel && !!content && content.r > panel.l + 100, JSON.stringify({ panel, content }));
check('and the panel floats, with its shadow', (await hasClass('.nova-panel', 'floating')) && (await ev(`getComputedStyle(document.querySelector('.nova-panel')).boxShadow !== 'none'`)));
// Dragging past the widest sidebar still means full screen.
const handle = `document.querySelector('.nova-panel .ds-resize-handle')`;
await ev(`${handle}.focus(); ${handle}.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); 1`);
await sleep(400);
panel = await rectOf('.nova-panel');
check('End is the widest sidebar: a peek of page stays beside it', !!panel && panel.l >= 300 && panel.l <= 400, JSON.stringify(panel));
check('and the reservation has not moved', Math.round(await padRight()) === 428, `${await padRight()}`);
await ev(`localStorage.removeItem('novaPanelW'); 1`);

// ── 4: the content floor ─────────────────────────────────────────────────────
section('The content floor: a rail reserves only while the page keeps `medium`');
await viewport(1100, 800);
await go('/');
check('at 1100 Nova still reserves (1100 − 380 − 96 ≥ 600)', await waitFor(`Math.round(parseFloat(getComputedStyle(document.querySelector('.shell-scroll')).paddingRight)) === 428`), `${await padRight()}`);
check('and the shell is not in overlay', !(await hasClass('.shell', 'rail-overlay')));
await viewport(1024, 768);
await go('/');
check('at 1024 Nova overlays (548 of page is below `medium`)', await waitFor(`document.querySelector('.shell').classList.contains('rail-overlay') && parseFloat(getComputedStyle(document.querySelector('.shell-scroll')).paddingRight) === 0`), `${await padRight()}`);
check('the floating panel carries the shadow', await hasClass('.nova-panel', 'floating'));
content = await rectOf('.shell-content');
check('and the page keeps its full width underneath', !!content && content.r >= 1024 - 24 - 1, JSON.stringify(content));
// Devices, which used to squeeze at every width.
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await viewport(768, 1024);
await go('/');
await click('.shell-nav .ds-menu-item[aria-label="Devices"], .shell-nav .ds-menu-item:last-child');
check('Devices at 768 overlays rather than squeezing the page', await waitFor(`document.querySelector('.shell.devices-open.rail-overlay') && parseFloat(getComputedStyle(document.querySelector('.shell-scroll')).paddingRight) === 0`), `${await padRight()}`);
check('with the overlay shadow', await ev(`getComputedStyle(document.querySelector('.device-panel')).boxShadow !== 'none'`));
// Compact: a sheet.
await ev(`localStorage.setItem('novaPinned', '1'); 1`);
await viewport(375, 812);
await go('/');
await waitFor(`!!document.querySelector('.nova-panel.open')`);
panel = await rectOf('.nova-panel');
const bar = await rectOf('.shell-bottom-nav');
check('on compact the pinned panel is an edge-to-edge sheet', !!panel && panel.l === 0 && panel.w === 375, JSON.stringify(panel));
check('between the top bar and the bottom nav', !!panel && !!bar && panel.t >= 60 && panel.b <= bar.t, JSON.stringify({ panel, bar }));
check('with no resize handle', await ev(`!document.querySelector('.nova-panel .ds-resize-handle') || getComputedStyle(document.querySelector('.nova-panel .ds-resize-handle')).display === 'none'`));

// ── 5: the board answers to the page, not the window ─────────────────────────
section('The page container: the board follows the PAGE');
const gridCols = () => ev(`getComputedStyle(document.querySelector('.wb-grid')).gridTemplateColumns.split(' ').length`);
await viewport(1920, 1080);
await go('/');
check('at 1920 with Nova pinned the board stays at six (the page is 1477)', await waitFor(`getComputedStyle(document.querySelector('.wb-grid')).gridTemplateColumns.split(' ').length === 6`), `${await gridCols()}`);
await ev(`localStorage.setItem('novaPinned', '0'); 1`);
await go('/');
check('unpinned, ten columns (ten tracks fit a 1920 page)', await waitFor(`getComputedStyle(document.querySelector('.wb-grid')).gridTemplateColumns.split(' ').length === 10`), `${await gridCols()}`);
const hero = await rectOf('.wb-hero');
const pageBox = await rectOf('.shell-content');
check('and the carousel keeps its 1100 box, left-aligned', !!hero && !!pageBox && Math.abs(hero.w - 1100) <= 1 && Math.abs(hero.l - (pageBox.l + 24)) <= 1, JSON.stringify({ hero, pageBox }));

// ── 6: interface size ────────────────────────────────────────────────────────
section('Interface size (tokens.css)');
await viewport(2560, 1440);
await go('/');
const zoomOf = () => ev(`parseFloat(getComputedStyle(document.documentElement).zoom) || 1`);
check('2560×1440 does not zoom — a 1440p desktop wants columns, not magnification', (await zoomOf()) === 1, `${await zoomOf()}`);
check('and the board is ten columns', (await gridCols()) === 10, `${await gridCols()}`);
await viewport(3840, 2160);
await go('/');
check('3840×2160 zooms 1.5 automatically', (await zoomOf()) === 1.5, `${await zoomOf()}`);
check('which lays the page out as 2560 (ten columns)', (await gridCols()) === 10, `${await gridCols()}`);
// Against the root's client width, not the window: a vertical scrollbar takes
// 15px of a headless window. (Both are window px — the root's clientWidth is
// not divided by the zoom, measured 2026-10-20.)
check('the shell still fills the window, not 1.5 of it', (await overflowX()) <= 1 && (await ev(`Math.abs(document.querySelector('.shell').getBoundingClientRect().width - document.documentElement.clientWidth) <= 2`)), `${await ev(`document.querySelector('.shell').getBoundingClientRect().width + ' vs ' + document.documentElement.clientWidth`)}`);
for (const route of ['/play', '/nova']) {
  await go(route);
  check(`${route} does not scroll sideways under the zoom`, (await overflowX()) <= 1, `${await overflowX()}px over`);
}
await viewport(1440, 900);
await ev(`localStorage.setItem('uiScale', '125'); 1`);
await go('/');
check('Interface size 125% zooms a 1440 window', (await zoomOf()) === 1.25, `${await zoomOf()}`);
check('and nothing overflows', (await overflowX()) <= 1, `${await overflowX()}px over`);
check('the page container sees the zoomed width (1152 → six columns)', (await gridCols()) === 6, `${await gridCols()}`);
await ev(`localStorage.removeItem('uiScale'); 1`);

// ── done ─────────────────────────────────────────────────────────────────────
await ev(`localStorage.removeItem('trhs-modules'); localStorage.removeItem('novaPinned'); localStorage.removeItem('novaPanelW'); localStorage.removeItem('uiScale'); 1`);
const failed = results.filter((r) => !r.ok);
const uniqueFindings = [...new Set(findings.map((f) => f.replace(/ at \d+:/, ':')))];
if (findings.length) console.log(`\n${uniqueFindings.length} finding(s) under the 12px floor (not failures):\n  ${uniqueFindings.join('\n  ')}`);
const tally = `${results.length - failed.length}/${results.length} checks passed${pageErrors.length ? `; ${pageErrors.length} page error(s): ${pageErrors.slice(0, 3).join(' | ')}` : ''}`;
console.log(`\n${tally}`);
try {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `${STAMP}-responsive.md`), `# verify-responsive — ${new Date().toISOString()}\n\n${tally}\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n\n## Under the 12px floor\n\n${uniqueFindings.map((f) => `- ${f}`).join('\n') || '- none'}\n\nScreenshots: ${SHOTS}/\n`);
} catch {
  /* the console has it */
}
ws.close();
process.exit(failed.length ? 1 : 0);

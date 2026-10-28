// CDP check for the Play page's two tops — the full-bleed hero and the
// "Jump Back In" grid (TH-425, Figma scratchpad-2026 207:8904), added
// 2026-10-01.
//
// What is protected, in order of how expensive it would be to lose:
//  1. THE DEFAULT. A fresh browser gets the HERO. This is an alternate layout to
//     compare, not a replacement: a shared link must not open on the new top
//     unless the person opening it chose it. Same rule the ad concepts carry.
//  2. THE WAY IN. The Admin row exists, names both options, and actually
//     switches the page. A layout nobody can reach during a review is the same
//     as no layout.
//  3. FOUR DIFFERENT GAMES. The Figma places four identical placeholder covers;
//     the point of the section is four things you were last in. Four tiles, four
//     distinct titles, each with its cover and platform badge.
//  4. IT DOES NOT MIRROR THE LIBRARY. The My Games grid sits directly below. The
//     first build drew both from the head of the same list, so the same four
//     covers appeared twice on one screen and read as a bug. `RECENT`
//     (data/games.ts) exists to keep those sets apart.
//  5. THE HAND-OFF. "Go to Library" actually moves the page to the grid.
//  6. The hero's fixed-position scaffolding does not leak into the alternate:
//     no hero, no scroll spacer, and the section sits in the normal flow.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. It writes `playLayout` and clears it at the end.
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

// Layout assertions need a known viewport, not whatever window the runner opened.
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const ev = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
// A hash-only change does not remount, and `Page.reload` after one races the
// router (gotcha 33). Force a real document load and wait for it.
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
  await sleep(1600);
};
// Polls until an expression in the page is truthy (TH-506's Featured checks).
const waitFor = async (expr, ms = 10000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(expr).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
};

console.log('\nThe default');
await go('/play');
await ev(`localStorage.removeItem('playLayout')`);
await go('/play');
check('a fresh browser gets the HERO, not the alternate', await ev(`!!document.querySelector('.play-hero') && !document.querySelector('.jbi')`));

console.log('\nThe way in');
await go('/?modal=admin');
const row = await ev(`(() => {
  const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Play layout');
  if (!r) return null;
  return [...r.querySelectorAll('.ds-toggle-group button')].map((b) => b.innerText.trim());
})()`);
check('Admin has a Play layout row naming all three tops', JSON.stringify(row) === JSON.stringify(['Hero', 'Jump Back In', 'Featured']), JSON.stringify(row));
await ev(`(() => {
  const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Play layout');
  [...r.querySelectorAll('button')].find((b) => /jump back in/i.test(b.innerText))?.click();
})()`);
await sleep(600);
check('choosing it stores the preference', (await ev(`localStorage.getItem('playLayout')`)) === 'jumpback');
check(
  'and the chosen option reads as selected, not by color alone',
  await ev(`(() => {
    const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Play layout');
    const b = [...r.querySelectorAll('button')].find((x) => /jump back in/i.test(x.innerText));
    return b?.getAttribute('aria-selected') === 'true';
  })()`),
);

console.log('\nThe section');
await go('/play');
check('the page honors it: the section replaces the hero', await ev(`!!document.querySelector('.jbi') && !document.querySelector('.play-hero')`));
check('no hero scaffolding leaks in — the scroll spacer is gone with it', (await ev(`document.querySelectorAll('.play-scroll-spacer').length`)) === 0);
check('its label is "Jump Back In"', (await ev(`document.querySelector('.jbi .pg-section-label')?.innerText?.trim()`)) === 'JUMP BACK IN');

const tiles = await ev(`(() => {
  const j = document.querySelector('.jbi');
  const t = [...j.querySelectorAll('.ds-tile')];
  return {
    count: t.length,
    names: t.map((x) => x.innerText.split('\\n')[0].trim()),
    // The cover is a CSS background on .ds-tile-art, not an img (GameTile.tsx).
    // No backticks in here: this whole expression is a template literal.
    covers: t.filter((x) => (x.querySelector('.ds-tile-art')?.style.backgroundImage || '').indexOf('url(') === 0).length,
    badges: t.filter((x) => !!x.querySelector('.ds-tile-platform')).length,
    sameRow: t.every((x) => Math.round(x.getBoundingClientRect().top) === Math.round(t[0].getBoundingClientRect().top)),
  };
})()`);
check('four tiles', tiles.count === 4, JSON.stringify(tiles));
check('four DIFFERENT games — not one cover repeated', new Set(tiles.names).size === 4, tiles.names.join(' / '));
check('every tile has its cover art', tiles.covers === 4, `${tiles.covers}/4`);
check('every tile has its platform badge', tiles.badges === 4, `${tiles.badges}/4`);
check('all four sit on one row at desktop width', tiles.sameRow === true);

console.log('\nIt does not mirror the library');
const libTop = await ev(`[...document.querySelectorAll('#my-games .ds-tile')].slice(0, 4).map((t) => (t.getAttribute('aria-label') || t.innerText.split('\\n')[0]).trim())`);
const overlap = tiles.names.filter((n) => (libTop || []).includes(n));
check(
  'the four covers are not the library grid’s opening four',
  overlap.length === 0,
  `repeated on one screen: ${overlap.join(', ')}`,
);

console.log('\nThe hand-off');
const before = await ev(`Math.round(window.scrollY)`);
await ev(`[...document.querySelectorAll('.jbi button')].find((b) => /go to library/i.test(b.innerText))?.click()`);
await sleep(1400);
const after = await ev(`Math.round(window.scrollY)`);
check('"Go to Library" moves the page to the grid', after > before && (await ev(`!!document.getElementById('my-games')`)), `${before} → ${after}`);

console.log('\nResponsive');
for (const [w, want] of [[1440, 4], [1024, 2], [600, 1]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  await go('/play');
  const cols = await ev(`getComputedStyle(document.querySelector('.jbi-grid')).gridTemplateColumns.split(' ').length`);
  check(`${w}px wide → ${want} column(s)`, cols === want, `got ${cols}`);
}

// ── Featured (TH-506): the most recent game leads, wide; three covers follow ──
console.log('\nFeatured');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await go('/?modal=admin');
await ev(`(() => {
  const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Play layout');
  [...r.querySelectorAll('button')].find((b) => /featured/i.test(b.innerText))?.click();
})()`);
await sleep(600);
check('choosing Featured stores it', (await ev(`localStorage.getItem('playLayout')`)) === 'featured');
await go('/play');
check('it replaces the hero, and Jump Back In', await ev(`!!document.querySelector('.frc') && !document.querySelector('.play-hero') && !document.querySelector('.jbi') && !document.querySelector('.play-scroll-spacer')`));
const f = await ev(`(() => {
  const g = document.querySelector('.frc-grid');
  const lead = g.querySelector('.ds-lead-tile');
  const covers = [...g.querySelectorAll('.ds-tile')];
  const r = (e) => e.getBoundingClientRect();
  const colW = (r(g).width - 5 * parseFloat(getComputedStyle(g).columnGap)) / 6;
  return {
    cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
    lead: lead?.dataset.game,
    title: lead?.querySelector('.ds-lead-tile-title')?.textContent,
    facts: [...(lead?.querySelectorAll('.ds-lead-tile-fact') ?? [])].map((x) => x.innerText.split(/\\n+/).map((s) => s.trim()).join(' ')),
    spans3: lead ? Math.abs(r(lead).width - (3 * colW + 2 * parseFloat(getComputedStyle(g).columnGap))) <= 2 : false,
    covers: covers.map((c) => c.getAttribute('aria-label')),
    oneLine: [lead, ...covers].every((e) => Math.abs(r(e).bottom - r(lead).bottom) <= 1 && Math.abs(r(e).top - r(lead).top) <= 1),
    art: !!lead?.querySelector('img.ds-lead-tile-art')?.src,
    play: !!lead?.querySelector('button[aria-label^="Play"]'),
  };
})()`);
// Set SHOTS_DIR to keep a picture of the row.
if (process.env.SHOTS_DIR) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(process.env.SHOTS_DIR, { recursive: true });
  await ev(`window.scrollTo(0, 0); 1`);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${process.env.SHOTS_DIR}/featured-1440.png`, Buffer.from(data, 'base64'));
}
check('six columns', f.cols === 6, JSON.stringify(f));
check('the most recent game leads — Baldur’s Gate 3', f.lead === 'baldursgate3' && f.title === "Baldur's Gate 3", JSON.stringify(f));
check('the lead tile spans three columns', f.spans3, JSON.stringify(f));
check('it says when it was last played and for how long', JSON.stringify(f.facts) === JSON.stringify(['LAST PLAYED Today', 'PLAY TIME 9 hours']) || (f.facts[0] === 'Last played Today' && f.facts[1] === 'Play time 9 hours'), JSON.stringify(f.facts));
check('with its cover and a Play button', f.art && f.play);
check('then the next three recent games as covers', JSON.stringify(f.covers) === JSON.stringify(['Monster Hunter Wilds', 'Apex Legends', 'Rocket League']), JSON.stringify(f.covers));
check('one row, one height — every top and bottom on one line', f.oneLine, JSON.stringify(f));
check('pressing the lead tile opens its details', (await ev(`document.querySelector('.ds-lead-tile')?.click(); 1`)) && (await waitFor(`location.hash.includes('game=baldursgate3') && !!document.querySelector('.game-panel.open')`, 3000)), await ev('location.hash'));
await go('/play');
check('its Play launches', (await ev(`document.querySelector('.ds-lead-tile button[aria-label^="Play"]')?.click(); 1`)) && (await waitFor(`location.hash.includes('playing=baldursgate3')`, 3000)), await ev('location.hash'));
await go('/play');
check('Enter on the lead tile opens its details', (await ev(`(() => { const t = document.querySelector('.ds-lead-tile'); t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`)) && (await waitFor(`location.hash.includes('game=baldursgate3')`, 3000)));
for (const [w, want] of [[1024, 3], [600, 3]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  await go('/play');
  const n = await ev(`(() => { const g = document.querySelector('.frc-grid'); const l = g.querySelector('.ds-lead-tile').getBoundingClientRect(); return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, fullRow: Math.abs(l.width - g.getBoundingClientRect().width) <= 1, h: Math.round(l.height) }; })()`);
  check(`${w}px wide → ${want} columns, the lead tile on its own row`, n.cols === want && n.fullRow && n.h > 0, JSON.stringify(n));
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// Leave the browser as we found it.
await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
await ev(`localStorage.removeItem('playLayout')`).catch(() => {});
await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

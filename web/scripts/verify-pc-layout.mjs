// CDP walkthrough for the desktop PC page's two layouts (JY, 2026-10-22, after
// JW's design review: the lit tower competed with the part being edited).
// Stacked is today's layout and the default; Full-screen is the trial, switched
// from the Simulator's PC layout row (only there while the desktop's page is
// open; the notebook's page has one layout). In Full-screen the 3D fills the
// window and the panel, and on the cooler cap tab the cap's preview, float over
// it as cards; the camera frames the tower in what they leave uncovered (the
// scene's view offset, read here from the viewport's `data-view-center`). On a
// tab about one part the rest of the tower's lights dim to a fifth (the
// viewport's `data-dim-levels`, the hero's `data-dim`) until the "Dim the rest"
// pill over the 3D says not to.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

const OUT = process.argv[2] || '/tmp';
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
async function evalJs(send, expr) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
};
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}
const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;
// The keys this suite reads or writes, cleared so a run starts from defaults.
const OWN_KEYS = ['pcLayout', 'pcDimRest', 'personalize-quick-control-v1', 'thisPc', 'mvpScope', 'nonHpPc', 'omenAi', 'gameSession'];

let loadN = 0;
// `sim=1`: the Simulator is hidden until asked (2026-10-26); these suites drive it.
async function load(send, hash = '#/') {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}&sim=1${hash}` });
  await waitFor(send, APP_READY);
}
const clickTab = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)})?.click()`);
/** The Simulator's PC layout row: the option labels, the selected one marked. */
const LAYOUT_ROW = `(() => { const g = document.querySelector('[data-testid="sim-rig"] [aria-label="PC layout"]'); return g ? [...g.querySelectorAll('[role=tab]')].map(t => t.textContent.trim() + (t.getAttribute('aria-selected') === 'true' ? '*' : '')) : null; })()`;
const pickLayout = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('[data-testid="sim-rig"] [aria-label="PC layout"] [role=tab]')].find(t => t.textContent.trim() === ${JSON.stringify(label)})?.click()`);

/** Everything the layout checks read, in px from the window's top-left. */
const RECTS = `(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const q = (s) => document.querySelector(s);
  const vc = q('.dc-hero .ls-viewport')?.dataset.viewCenter;
  return {
    full: !!q('.dc-canvas.pc-canvas--full'),
    canvas: r(q('.dc-canvas')),
    hero: r(q('.dc-hero')),
    gl: r(q('.dc-hero .ls-canvas')),
    wrap: r(q('.dc-panel-wrap')),
    panel: r(q('.dc-panel-wrap .ds-ng3-panel')),
    body: r(q('.dc-panel-wrap .ds-ng3-body')),
    chips: r(q('.dc-status')),
    close: r(q('.dc-close')),
    card: r(q('.cap-hero')),
    center: vc ? vc.split(',').map(Number) : null,
  };
})()`;
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
/** The page's gutter, in px (it steps with the window's width). */
const GUTTER = `(() => { const d = document.createElement('div'); d.style.width = 'var(--gutter)'; document.querySelector('.dc-canvas').appendChild(d); const w = d.getBoundingClientRect().width; d.remove(); return w; })()`;
const inside = (a, b, tol = 1) => !!a && !!b && a.l >= b.l - tol && a.r <= b.r + tol && a.t >= b.t - tol && a.b <= b.b + tol;
/** Where the camera's centre should be: the middle of the 3D less the cards and the chips' row (DesktopCanvas, useUncovered). */
const GAP = 12;
const expectedCenter = (k) => {
  const top = k.chips.b - k.hero.t + GAP;
  const bottom = k.hero.b - k.wrap.t + GAP;
  const right = k.card ? k.hero.r - k.card.l + GAP : 0;
  return [(k.hero.w - right) / 2, (top + (k.hero.h - bottom)) / 2];
};
/** Arrived: the camera's centre is where the cards leave the middle of the 3D (it eases there; a machine drawing in
 *  software takes its time). Returns the last reading, arrived or not. */
async function arrived(send) {
  let k = null;
  for (let i = 0; i < 80; i++) {
    k = await evalJs(send, RECTS);
    if (k.center && k.chips && k.wrap) {
      const want = expectedCenter(k);
      if (near(k.center[0], want[0], 1.5) && near(k.center[1], want[1], 1.5)) return k;
    }
    await sleep(150);
  }
  return k;
}

/** The dimming as a person sees it: the pill, the hero's word for it, the scene's multipliers, what is stored. */
const PILL = `document.querySelector('.dc-canvas .pc-dim')`;
const DIM = `(() => ({
  dim: document.querySelector('.dc-hero')?.dataset.dim ?? null,
  pressed: ${PILL}?.getAttribute('aria-pressed') ?? null,
  levels: document.querySelector('.dc-hero .ls-viewport')?.dataset.dimLevels ?? null,
  stored: localStorage.getItem('pcDimRest'),
}))()`;
const ALL_DIM = 'fans:0.05,memory:0.05,gpu:0.05';
/** The tower's lighting as the page keeps it: dimming must never write to it. */
const DESK_LIGHTING = `JSON.stringify(JSON.parse(localStorage.getItem('personalize-quick-control-v1') || '{}').desk?.lighting ?? null)`;
const clickPill = (send) => evalJs(send, `${PILL}?.click()`);
/** A zone of the Chassis lighting tab: picking toggles it in the selection. */
const clickZone = (send, zone) => evalJs(send, `document.querySelector('.dc-canvas .pcz-zone[data-zone="${zone}"]')?.click()`);
/** A preset in the tab's library, by name. */
const clickPreset = (send, name) =>
  evalJs(send, `[...document.querySelectorAll('.dc-canvas [role=button], .dc-canvas .ds-list-item, .dc-canvas button')].find(e => e.textContent.trim().startsWith(${JSON.stringify(name)}))?.click()`);
/** The mean brightness of what the 3D canvas drew, read the frame it was drawn in (the buffer is not kept). */
const LUMA = `new Promise((res) => requestAnimationFrame(() => {
  const gl = document.querySelector('.dc-hero .ls-canvas');
  const c = document.createElement('canvas'); c.width = 300; c.height = 190;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(gl, 0, 0, 300, 190);
  const d = g.getImageData(0, 0, 300, 190).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) * (d[i + 3] / 255);
  res(sum / (d.length / 4));
}))`;
/** Settled: the multipliers read the same on two looks, a fade apart. */
async function dimmedTo(send, want, timeoutMs = 6000) {
  return waitFor(send, `document.querySelector('.dc-hero .ls-viewport')?.dataset.dimLevels ${want === null ? '=== undefined' : `=== ${JSON.stringify(want)}`}`, timeoutMs);
}

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  await load(send);
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);

  // ── Stacked, the default ──────────────────────────────────────────────────
  await load(send, '#/?sku=forge-45l&tab=vitals');
  await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .lc-vital')`, 8000);
  await waitFor(send, `document.querySelector('.dc-hero .ls-viewport.ls-loaded')`, 15000);
  let k = await evalJs(send, RECTS);
  check('default: nothing is stored, and the PC page is stacked', (await evalJs(send, `localStorage.getItem('pcLayout')`)) === null && !k.full);
  check('default: the Simulator\'s PC layout row is there, on Stacked',
    JSON.stringify(await evalJs(send, LAYOUT_ROW)) === JSON.stringify(['Stacked*', 'Full-screen']), JSON.stringify(await evalJs(send, LAYOUT_ROW)));
  check('stacked: the 3D is a box above the panel, not the whole window',
    k.hero.h < k.canvas.h - 200 && k.panel.t >= k.hero.b - 1, `hero ${Math.round(k.hero.h)} of ${Math.round(k.canvas.h)}, panel top ${Math.round(k.panel.t)}, hero bottom ${Math.round(k.hero.b)}`);
  check('stacked: the camera is told nothing about covered parts (no view offset)', k.center === null);
  check('stacked: no "Dim the rest" pill, nothing dims, and the hero says nothing about it',
    (await evalJs(send, `!${PILL}`)) && (await evalJs(send, `!document.querySelector('.dc-hero').hasAttribute('data-dim')`)) && (await evalJs(send, DIM)).levels === null);
  const stackedPanelH = Math.round(k.wrap.h);
  const stackedGap = Math.round(k.canvas.b - k.panel.b);
  const gutter = await evalJs(send, GUTTER);

  // ── Full-screen, from the Simulator ───────────────────────────────────────
  await pickLayout(send, 'Full-screen');
  check('Full-screen: the choice is kept and the page takes the layout',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas--full')`, 3000) && (await evalJs(send, `localStorage.getItem('pcLayout')`)) === 'full');
  check('Full-screen: the row marks it', JSON.stringify(await evalJs(send, LAYOUT_ROW)) === JSON.stringify(['Stacked', 'Full-screen*']));
  k = await arrived(send);
  check('Full-screen: the 3D\'s box is the whole canvas, edge to edge (behind the nav)',
    near(k.hero.l, 0) && near(k.hero.t, 0) && near(k.hero.w, k.canvas.w) && near(k.hero.h, k.canvas.h) && near(k.gl.w, k.canvas.w) && near(k.gl.h, k.canvas.h),
    JSON.stringify([k.hero, k.canvas]));
  check('Full-screen: the panel lies inside the 3D\'s box, over it, at the bottom centre where it sat stacked',
    inside(k.panel, k.hero) && (k.panel.t + k.panel.b) / 2 > k.hero.h / 2 && near((k.panel.l + k.panel.r) / 2, (k.hero.l + k.hero.r) / 2, 2) && near(k.panel.b, k.canvas.b - stackedGap, 1),
    JSON.stringify(k.panel));
  check('Full-screen: the panel is the height it is stacked', near(k.wrap.h, stackedPanelH, 1), `${k.wrap.h} vs ${stackedPanelH}`);
  const look = await evalJs(send, `(() => {
    const body = document.querySelector('.dc-canvas .dc-panel-wrap .ds-ng3-body');
    const cs = getComputedStyle(body);
    const m = cs.backgroundColor.match(/[\\d.]+/g).map(Number);
    return { alpha: m.length > 3 ? m[3] : 1, blur: cs.backdropFilter, over: document.elementFromPoint(${Math.round((k.panel.l + k.panel.r) / 2)}, ${Math.round(k.body.t + 60)})?.closest('.ds-ng3-body') === body };
  })()`);
  check('Full-screen: the panel is translucent but mostly opaque, blurs what is behind it, and takes the pointer',
    look.alpha > 0.8 && look.alpha < 1 && /blur/.test(look.blur) && look.over, JSON.stringify(look));
  const onTop = await evalJs(send, `(() => {
    const at = (e) => { const b = e.getBoundingClientRect(); return document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); };
    return { chip: !!document.querySelector('.dc-status .dc-chip') && at(document.querySelector('.dc-status .dc-chip'))?.closest('.dc-chip') === document.querySelector('.dc-status .dc-chip'),
             close: at(document.querySelector('.dc-close'))?.closest('.dc-close') === document.querySelector('.dc-close') };
  })()`);
  check('Full-screen: the status chip and the close button stay on top of the 3D', onTop.chip && onTop.close, JSON.stringify(onTop));
  check('Full-screen: the camera\'s centre is the middle of what the panel and the chips leave uncovered',
    !!k.center && near(k.center[0], expectedCenter(k)[0]) && near(k.center[1], expectedCenter(k)[1]), `${k.center} vs ${expectedCenter(k)}`);
  check('Full-screen: the camera\'s centre lies in the 3D above the panel, not under it', !!k.center && k.center[1] < k.panel.t && k.center[1] > k.chips.b);
  const shotFull = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-layout-full-performance.png`, Buffer.from(shotFull.data, 'base64'));

  // ── "Dim the rest": the pill, and Performance (an overview) dims nothing ──
  const pill = await evalJs(send, `(() => {
    const e = ${PILL}; if (!e) return null;
    const b = e.getBoundingClientRect();
    const at = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
    return { text: e.textContent.trim(), tag: e.tagName, l: b.left, t: b.top, r: b.right, b: b.bottom, on: at === e || e.contains(at) };
  })()`);
  check('Full-screen: a "Dim the rest" pill floats over the 3D, top left under the status chip, on top and a button',
    !!pill && pill.text === 'Dim the rest' && pill.tag === 'BUTTON' && pill.t >= k.chips.b && near(pill.l, k.chips.l, 1) && pill.on && inside({ l: pill.l, r: pill.r, t: pill.t, b: pill.b }, k.hero),
    JSON.stringify([pill, k.chips]));
  check('the pill starts pressed (dimming on), nothing is stored, and the hero says none on Performance, an overview',
    JSON.stringify(await evalJs(send, DIM)) === JSON.stringify({ dim: 'none', pressed: 'true', levels: null, stored: null }), JSON.stringify(await evalJs(send, DIM)));

  // Every tab's panel is one height here too.
  const heights = [];
  for (const tab of ['Performance', 'LCD cooler cap', 'Chassis lighting', 'Power supply']) {
    await clickTab(send, tab);
    await sleep(500);
    heights.push(Math.round(await evalJs(send, `document.querySelector('.dc-canvas .dc-panel-wrap').getBoundingClientRect().height`)));
  }
  check('Full-screen: every tab\'s panel is one height', new Set(heights).size === 1 && heights[0] === stackedPanelH, heights.join('/'));

  // ── The cooler cap tab: the preview is a card on the right ────────────────
  await clickTab(send, 'Performance');
  const before = (await arrived(send)).center;
  await clickTab(send, 'LCD cooler cap');
  await waitFor(send, `document.querySelector('.dc-canvas .cap-hero .pcp-cap')`, 4000);
  // The camera's centre eases over rather than jumping: sample it on the way, until it has arrived.
  const samples = [];
  for (let i = 0; i < 200; i++) {
    const c = await evalJs(send, `document.querySelector('.dc-hero .ls-viewport')?.dataset.viewCenter ?? null`);
    if (c) samples.push(Number(c.split(',')[0]));
    const now = await evalJs(send, RECTS);
    if (now.card && now.center && near(now.center[0], expectedCenter(now)[0], 1.5)) break;
    await sleep(30);
  }
  const lastX = samples[samples.length - 1];
  const between = samples.filter((x) => x < before[0] - 20 && x > lastX + 20);
  check('cap tab: the camera\'s centre eases to the left as the card comes in, not a jump',
    lastX < before[0] - 100 && between.length >= 1 && samples.every((x, i) => i === 0 || x <= samples[i - 1] + 0.5),
    `${before[0]} → ${samples.slice(0, 6).join(', ')} … ${lastX}, ${between.length} between`);
  k = await arrived(send);
  check('cap tab: the preview is a card on the right, over the 3D',
    !!k.card && inside(k.card, k.hero) && inside(k.card, k.gl) && k.card.l > k.hero.w / 2 && near(k.card.r, k.hero.r - gutter, 2), JSON.stringify(k.card));
  check('cap tab: the card is centred between the close button and the panel, clear of both',
    !!k.card && k.card.t >= k.close.b && k.card.b <= k.wrap.t + 1 && near((k.card.t + k.card.b) / 2, (k.close.b + gutter + k.wrap.t) / 2, 2),
    JSON.stringify([k.card, k.close.b, k.wrap.t]));
  const cardLook = await evalJs(send, `(() => {
    const card = document.querySelector('.dc-canvas .cap-hero');
    const cs = getComputedStyle(card);
    const m = cs.backgroundColor.match(/[\\d.]+/g).map(Number);
    const b = card.getBoundingClientRect();
    return { alpha: m.length > 3 ? m[3] : 1, blur: cs.backdropFilter, over: document.elementFromPoint((b.left + b.right) / 2, b.top + 8)?.closest('.cap-hero') === card, round: cs.borderRadius };
  })()`);
  check('cap tab: the card is the panel\'s kind of surface (translucent, blurred, rounded) and is on top of the 3D',
    cardLook.alpha > 0.8 && cardLook.alpha < 1 && /blur/.test(cardLook.blur) && cardLook.over && parseFloat(cardLook.round) > 0, JSON.stringify(cardLook));
  check('cap tab: the camera\'s centre is the middle of what the card, the panel and the chips leave uncovered',
    !!k.center && near(k.center[0], expectedCenter(k)[0]) && near(k.center[1], expectedCenter(k)[1]) && k.center[0] < k.card.l, `${k.center} vs ${expectedCenter(k)}`);
  check('cap tab: the cap\'s screen is still the cap\'s preview (round, reading in °C)',
    await evalJs(send, `/°C$/.test(document.querySelector('.cap-hero .pcp-cap .pcp-cap-big')?.textContent.trim() ?? '') && (() => { const b = document.querySelector('.cap-hero .pcp-cap').getBoundingClientRect(); return Math.abs(b.width - b.height) < 1; })()`));
  const shotCap = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-layout-full-cooler-cap.png`, Buffer.from(shotCap.data, 'base64'));

  // ── The cap tab dims the whole tower: the cap's screen is the subject ─────
  check('cap tab: the hero says on, and every light of the tower goes down to a fifth',
    (await evalJs(send, DIM)).dim === 'on' && (await dimmedTo(send, ALL_DIM)), JSON.stringify(await evalJs(send, DIM)));
  const deskBefore = await evalJs(send, DESK_LIGHTING);
  await clickPill(send);
  // Sampled as the frames come: a machine drawing the 3D in software makes one a second or less.
  const fade = [];
  for (let t0 = Date.now(); Date.now() - t0 < 20000; ) {
    const l = await evalJs(send, `document.querySelector('.dc-hero .ls-viewport')?.dataset.dimLevels ?? null`);
    fade.push(l === null ? 1 : Number(l.split(',')[0].split(':')[1]));
    if (l === null) break;
    await sleep(20);
  }
  const fadeShown = fade.filter((v, i) => i === 0 || v !== fade[i - 1]);
  check('the pill off: the lights come back over a fade, not a snap, to full',
    fade[fade.length - 1] === 1 && fade.some((v) => v > 0.25 && v < 0.95) && fade.every((v, i) => i === 0 || v >= fade[i - 1] - 1e-9), fadeShown.map((v) => v.toFixed(2)).join(' → '));
  check('the pill off: unpressed, the hero says off, the choice is kept',
    JSON.stringify(await evalJs(send, DIM)) === JSON.stringify({ dim: 'off', pressed: 'false', levels: null, stored: '0' }), JSON.stringify(await evalJs(send, DIM)));
  await clickPill(send);
  check('the pill on again: pressed, the hero says on, the lights go back down',
    (await dimmedTo(send, ALL_DIM)) && JSON.stringify(await evalJs(send, DIM)) === JSON.stringify({ dim: 'on', pressed: 'true', levels: ALL_DIM, stored: '1' }), JSON.stringify(await evalJs(send, DIM)));
  check('dimming is a display multiplier: the lighting the page keeps did not change', (await evalJs(send, DESK_LIGHTING)) === deskBefore);

  // What the eye gets, with a static look so the readings do not move: the 3D draws less light dimmed than not.
  await clickTab(send, 'Chassis lighting');
  await sleep(600);
  await clickPreset(send, 'Touch Grass');
  await sleep(400);
  await clickTab(send, 'LCD cooler cap');
  await waitFor(send, `document.querySelector('.dc-canvas .cap-hero .pcp-cap')`, 4000);
  await dimmedTo(send, ALL_DIM);
  await sleep(500);
  const lumaOn = await evalJs(send, LUMA);
  await clickPill(send);
  await dimmedTo(send, null);
  await sleep(500);
  const lumaOff = await evalJs(send, LUMA);
  check('the 3D draws visibly less light with the rest dimmed than with the pill off (a static look, the cap\'s screen kept)',
    lumaOn > 0 && lumaOff > 0 && lumaOn < lumaOff * 0.9, `${lumaOn.toFixed(2)} dimmed vs ${lumaOff.toFixed(2)} not`);
  await clickPill(send);
  await dimmedTo(send, ALL_DIM);
  // As before each reading above: the multipliers settle a frame before that
  // frame is on the canvas, and software GL here takes about a second a frame.
  await sleep(800);
  const lumaBack = await evalJs(send, LUMA);
  check('…and the pill on again takes it back down to the same', near(lumaBack, lumaOn, 0.3), `${lumaBack.toFixed(2)} vs ${lumaOn.toFixed(2)}`);

  // ── Chassis lighting: a part being edited stays lit, the others dim ───────
  await clickTab(send, 'Chassis lighting');
  await waitFor(send, `document.querySelector('.dc-canvas .pcz-zone')`, 4000);
  await sleep(500);
  check('Chassis lighting, no part picked (all of them): the hero says none and nothing dims',
    (await evalJs(send, DIM)).dim === 'none' && (await dimmedTo(send, null)), JSON.stringify(await evalJs(send, DIM)));
  await clickZone(send, 'fans');
  await clickZone(send, 'gpu');
  check('Chassis lighting, Memory alone: it stays at full, the fans and the graphics card dim',
    await waitFor(send, `document.querySelector('.dc-hero').dataset.dim === 'on'`, 3000) && (await dimmedTo(send, 'fans:0.05,memory:1.00,gpu:0.05')), JSON.stringify(await evalJs(send, DIM)));
  await clickZone(send, 'memory');
  await clickZone(send, 'gpu');
  check('Chassis lighting, the graphics card alone: it stays at full, the others dim', await dimmedTo(send, 'fans:0.05,memory:0.05,gpu:1.00'), JSON.stringify(await evalJs(send, DIM)));
  await clickZone(send, 'gpu');
  await clickZone(send, 'fans');
  check('Chassis lighting, the fans alone: they stay at full, the others dim', await dimmedTo(send, 'fans:1.00,memory:0.05,gpu:0.05'), JSON.stringify(await evalJs(send, DIM)));
  await clickZone(send, 'memory');
  await clickZone(send, 'gpu');
  check('Chassis lighting, every part picked again: nothing dims',
    (await dimmedTo(send, null)) && (await evalJs(send, DIM)).dim === 'none', JSON.stringify(await evalJs(send, DIM)));
  await clickZone(send, 'fans');
  await clickZone(send, 'gpu');
  await dimmedTo(send, 'fans:0.05,memory:1.00,gpu:0.05');
  await clickTab(send, 'Performance');
  check('leaving for Performance: the part\'s dimming goes with the tab, the hero says none', (await dimmedTo(send, null)) && (await evalJs(send, DIM)).dim === 'none', JSON.stringify(await evalJs(send, DIM)));
  await clickTab(send, 'Power supply');
  check('Power supply: the model has no supply, so every light dims',
    (await dimmedTo(send, ALL_DIM)) && (await evalJs(send, DIM)).dim === 'on', JSON.stringify(await evalJs(send, DIM)));
  await clickPill(send);
  await clickTab(send, 'LCD cooler cap');
  check('the pill off stays off across tabs: the cap tab says off and nothing dims',
    (await dimmedTo(send, null)) && JSON.stringify(await evalJs(send, DIM)) === JSON.stringify({ dim: 'off', pressed: 'false', levels: null, stored: '0' }), JSON.stringify(await evalJs(send, DIM)));
  await load(send, '#/?sku=forge-45l&tab=cooler-cap');
  await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas--full .pc-dim')`, 8000);
  check('…and it is kept across a reload: off, unpressed, nothing dims',
    JSON.stringify(await evalJs(send, DIM)) === JSON.stringify({ dim: 'off', pressed: 'false', levels: null, stored: '0' }), JSON.stringify(await evalJs(send, DIM)));
  await clickPill(send);
  check('the pill on after a reload dims the cap tab again', await dimmedTo(send, ALL_DIM, 8000));
  await clickTab(send, 'Chassis lighting');
  await waitFor(send, `!document.querySelector('.dc-canvas .cap-hero')`, 3000);
  k = await arrived(send);
  check('other tabs: the card goes and the camera\'s centre returns to the middle', !k.card && !!k.center && near(k.center[0], k.hero.w / 2), JSON.stringify(k.center));

  // ── Back to Stacked ───────────────────────────────────────────────────────
  await pickLayout(send, 'Stacked');
  check('Stacked again: the layout, and the camera\'s plain view, come back',
    await waitFor(send, `!document.querySelector('.dc-canvas.pc-canvas--full') && !document.querySelector('.dc-hero .ls-viewport')?.dataset.viewCenter`, 4000));
  k = await evalJs(send, RECTS);
  check('Stacked again: the 3D is a box above the panel', k.hero.h < k.canvas.h - 200 && k.panel.t >= k.hero.b - 1);
  await clickTab(send, 'LCD cooler cap');
  await sleep(1500);
  check('Stacked again: on the cap tab there is no pill and nothing dims, whatever was set (the old layout is untouched)',
    (await evalJs(send, `!${PILL}`)) && (await evalJs(send, `!document.querySelector('.dc-hero').hasAttribute('data-dim')`)) && (await evalJs(send, DIM)).levels === null);

  // ── The notebook's page has one layout ────────────────────────────────────
  await evalJs(send, `localStorage.setItem('pcLayout', 'full')`);
  await load(send, '#/?sku=hx-omen-16-valorant&tab=vitals');
  await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .lc-vital')`, 8000);
  await waitFor(send, `document.querySelector('[data-testid="sim-rig"]')`);
  check('laptop page: the stored Full-screen changes nothing, and the Simulator has no PC layout row',
    (await evalJs(send, `!document.querySelector('.dc-canvas.pc-canvas--full')`)) && (await evalJs(send, LAYOUT_ROW)) === null);
  await evalJs(send, `localStorage.setItem('pcLayout', 'nonsense')`);
  await load(send, '#/?sku=forge-45l&tab=vitals');
  await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .lc-vital')`, 8000);
  check('an unknown stored layout reads as Stacked', (await evalJs(send, `!document.querySelector('.dc-canvas.pc-canvas--full')`)) && JSON.stringify(await evalJs(send, LAYOUT_ROW)) === JSON.stringify(['Stacked*', 'Full-screen']));

  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

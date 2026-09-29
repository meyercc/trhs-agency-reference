// CDP walkthrough for the unified .ds-ng3-* panel primitives across the mouse,
// keyboard and headset canvases + the keyboard Lights header fix (Figma Lights
// 680:176027). Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
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
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

let loadN = 0;
// Poll for the rendered canvas rather than sleeping a fixed amount — a fixed
// sleep made this suite report "missing" when it only meant "not painted yet".
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

async function open(send, sku, tab) {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
}

const PANEL = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  const gap = (el) => el ? getComputedStyle(el).gap : null;
  return {
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    sections: c.querySelectorAll('.ds-ng3-section').length,
    labels: [...c.querySelectorAll('.ds-ng3-label')].map(e => e.textContent.trim()),
    gridGap: gap(c.querySelector('.ds-ng3-grid')),
    headerToggle: !!c.querySelector('.ds-ng3-header .ds-toggle'),
    headerActionBtns: c.querySelectorAll('.ds-ng3-actions button').length,
    oldHead: !!c.querySelector('.pdm-lights-head'),
    litKeys: c.querySelectorAll('.kbd-key.lit').length,
    heroGlow: !!c.querySelector('.kbd-hero-glow'),
    bodyOpacity: c.querySelector('.pdm-lights-body') ? getComputedStyle(c.querySelector('.pdm-lights-body')).opacity : null,
  };
})()`;

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  // ── Mouse ──
  await open(send, 'saga-pro');
  let s = await evalJs(send, PANEL);
  check('mouse buttons: 2 shared sections', s?.sections === 2, String(s?.sections));
  check('mouse buttons: unified grid gap', s?.gridGap === '8px', String(s?.gridGap));
  check('mouse buttons: Assignments label', s?.labels.includes('Assignments'), s?.labels.join(', '));
  await open(send, 'saga-pro', 'sensor');
  s = await evalJs(send, PANEL);
  check('mouse sensor: 2 shared sections', s?.sections === 2, String(s?.sections));
  check('mouse sensor: labels migrated', ['Sensitivity', 'Polling Rate', 'Motion Sync'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/unify-mouse-sensor.png`, Buffer.from(shot.data, 'base64'));

  // ── Keyboard Lights (the Figma fix) ──
  await open(send, 'origins-65');
  s = await evalJs(send, PANEL);
  check('kbd lights: header title "Lights"', s?.title === 'Lights', String(s?.title));
  check('kbd lights: toggle in panel header', s?.headerToggle === true);
  check('kbd lights: single copy action', s?.headerActionBtns === 1, String(s?.headerActionBtns));
  check('kbd lights: old inner head gone', s?.oldHead === false);
  check('kbd lights: 2 shared sections (bright + presets)', s?.sections === 2, String(s?.sections));
  check('kbd lights: unified grid gap', s?.gridGap === '8px', String(s?.gridGap));

  // Header toggle = the device's truth: off renders the hero unlit, while the
  // panel stays full-color and operable (off gates the feature, not editing).
  await evalJs(send, `document.querySelector('.pdm-preset-pick').click()`);
  await sleep(300);
  s = await evalJs(send, PANEL);
  check('kbd lights: preset lights the hero', (s?.litKeys ?? 0) > 0 && s?.heroGlow === true, `lit ${s?.litKeys}`);
  await evalJs(send, `document.querySelector('.ds-ng3-header .ds-toggle').click()`);
  await sleep(300);
  s = await evalJs(send, PANEL);
  check('kbd lights: toggle off → hero unlit', s?.litKeys === 0 && s?.heroGlow === false, `lit ${s?.litKeys}`);
  check('kbd lights: off → body not dimmed', s?.bodyOpacity === '1', String(s?.bodyOpacity));
  await evalJs(send, `document.querySelector('.ds-ng3-header .ds-toggle').click()`);
  await sleep(300);
  s = await evalJs(send, PANEL);
  check('kbd lights: back on → hero relit from kept state', (s?.litKeys ?? 0) > 0, `lit ${s?.litKeys}`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/unify-kbd-lights.png`, Buffer.from(shot.data, 'base64'));

  // Keyboard settings tab on the primitives
  await open(send, 'origins-65', 'settings');
  s = await evalJs(send, PANEL);
  check('kbd settings: 3 shared sections', s?.sections === 3, String(s?.sections));
  check('kbd settings: labels migrated', ['Polling Rate', 'Control Mode'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));

  // ── Headset (gap now sourced from the shared grid) ──
  await open(send, 'cloud-iii-s');
  s = await evalJs(send, PANEL);
  check('headset: 5 shared sections', s?.sections === 5, String(s?.sections));
  check('headset: unified grid gap', s?.gridGap === '8px', String(s?.gridGap));

  // ── Keys & Macros rides the primitives, it doesn't imitate them ──
  // This tab used to hand-roll the section card and had drifted off it. The
  // check compares the computed card against a live `.ds-ng3-section`, so any
  // re-fork fails no matter which property drifts — and confirms the halves
  // stay real landmarks rather than trading semantics for the look.
  await open(send, 'origins-65', 'keys');
  const keys = await evalJs(send, `(() => {
    const grid = document.querySelector('.pdm-keys');
    const rail = document.querySelector('.pdm-keys-rail');
    const browse = document.querySelector('.pdm-keys-browse');
    if (!grid || !rail || !browse) return null;
    const ref = document.createElement('div');
    ref.className = 'ds-ng3-section';
    document.body.appendChild(ref);
    const cs = (e) => getComputedStyle(e);
    const card = (e) => [cs(e).backgroundColor, cs(e).borderTopColor, cs(e).borderTopWidth, cs(e).padding, cs(e).borderRadius].join('|');
    const out = {
      onGrid: grid.classList.contains('ds-ng3-grid'),
      sections: rail.classList.contains('ds-ng3-section') && browse.classList.contains('ds-ng3-section'),
      tags: [rail.tagName, browse.tagName].join('/'),
      gap: cs(grid).gap,
      measured: Math.round(browse.getBoundingClientRect().left - rail.getBoundingClientRect().right),
      matchesRef: card(rail) === card(ref) && card(browse) === card(ref),
      refCard: card(ref), railCard: card(rail),
    };
    ref.remove();
    return out;
  })()`);
  check('keys tab: both halves are real .ds-ng3-sections on a .ds-ng3-grid',
    keys?.onGrid && keys?.sections, `grid=${keys?.onGrid} sections=${keys?.sections}`);
  check('keys tab: the card is the shared one, not a look-alike',
    keys?.matchesRef, keys?.matchesRef ? keys?.refCard : `ref ${keys?.refCard} vs rail ${keys?.railCard}`);
  check('keys tab: the gutter is the system 8px', keys?.gap === '8px' && keys?.measured === 8,
    `${keys?.gap} declared / ${keys?.measured}px measured`);
  check('keys tab: the halves keep their landmark semantics', keys?.tags === 'ASIDE/SECTION', keys?.tags);

  // ── Panel measure is per-tab, driven from the tab definition ──
  // A pure layout consequence of `DeviceTab.width` → `Ng3Panel width` → the
  // `.narrow` step: no class names change in the markup and the type checker
  // cannot see it, so the proportion is measured against the column the panel
  // actually sits in. Also guards the centring, since a narrow panel that is
  // not centred would be the obvious way for this to go wrong.
  const MEASURE = `(() => {
    const p = document.querySelector('.ds-ng3-panel');
    const w = document.querySelector('.dc-panel-wrap');
    if (!p || !w) return null;
    const cs = getComputedStyle(w);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    const pb = p.getBoundingClientRect(), wb = w.getBoundingClientRect();
    const avail = wb.width - padL - padR;
    const left = Math.round(pb.left - (wb.left + padL));
    const right = Math.round((wb.right - padR) - pb.right);
    const tb = document.querySelector('.ds-ng3-tab')?.getBoundingClientRect();
    return {
      narrow: p.classList.contains('narrow'),
      pct: Math.round((pb.width / avail) * 100),
      centred: Math.abs(left - right) <= 1,
      tabCentred: tb ? Math.abs((tb.left + tb.right) / 2 - (pb.left + pb.right) / 2) <= 1 : null,
    };
  })()`;
  await open(send, 'cloud-iii-s', 'audio');
  let m = await evalJs(send, MEASURE);
  check('a dense tab keeps the full measure', m?.narrow === false && m?.pct === 100, `${m?.pct}%`);
  await open(send, 'cloud-iii-s', 'settings');
  m = await evalJs(send, MEASURE);
  check('the headset Settings tab holds in to 65%, centred',
    m?.narrow === true && m?.pct === 65 && m?.centred === true && m?.tabCentred === true,
    `${m?.pct}% centred=${m?.centred} tab=${m?.tabCentred}`);
  await open(send, 'origins-65', 'settings');
  m = await evalJs(send, MEASURE);
  check('a tab that does not ask for it is untouched', m?.narrow === false && m?.pct === 100, `${m?.pct}%`);

  // ── A panel is a filled frame: every column bottoms out on the same line ──
  // `.ds-ng3-col > .ds-ng3-section:last-child { flex-grow: 1 }` is a pure
  // layout consequence — no class name changes and nothing the type checker
  // can see, so it needs measuring in a real browser. Ragged column bottoms
  // are the regression this catches.
  const FLOOR = `(() => {
    const grid = document.querySelector('.ds-ng3-grid');
    if (!grid) return { err: 'no grid' };
    const floor = grid.getBoundingClientRect().bottom;
    // Only flex-laid columns: the monitor packs sections into CSS columns
    // instead, where there is no last item to stretch.
    const cols = [...grid.querySelectorAll(':scope > .ds-ng3-col')];
    return {
      cols: cols.length,
      gaps: cols.map((c) => {
        const last = c.querySelector(':scope > .ds-ng3-section:last-child');
        return last ? Math.round(floor - last.getBoundingClientRect().bottom) : null;
      }),
    };
  })()`;
  for (const [sku, tab, label] of [
    ['cloud-iii-s', 'audio', 'headset audio'],
    ['origins-65', 'settings', 'kbd settings'],
  ]) {
    await open(send, sku, tab);
    const f = await evalJs(send, FLOOR);
    check(`${label}: every column's last card is flush with the panel floor`,
      (f?.cols ?? 0) > 0 && f.gaps.every((g) => g !== null && Math.abs(g) <= 1),
      `${f?.cols} cols, gaps ${JSON.stringify(f?.gaps)}`);
  }

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

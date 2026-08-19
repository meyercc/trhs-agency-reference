// CDP walkthrough for the unified .ds-ng3-* panel primitives across the mouse,
// keyboard and headset canvases + the keyboard Lights header fix (Figma Lights
// 680:176027). Dev server :5175, headless Chrome :9222, run from web/.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (p) => fetch('http://localhost:9222' + p).then((r) => r.json());

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
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
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

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

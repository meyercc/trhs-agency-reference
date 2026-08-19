// CDP walkthrough for the MicCanvas (NG3 microphone modal).
// Dev server :5175, headless Chrome :9222, run from web/.
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

const SNAP = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  const body = c.querySelector('.ds-ng3-body');
  const r = body?.getBoundingClientRect();
  return {
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map(b => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    chips: [...c.querySelectorAll('.dc-chip-val')].map(e => e.textContent.trim()),
    labels: [...c.querySelectorAll('.ds-ng3-label')].map(e => e.textContent.trim()),
    patterns: [...c.querySelectorAll('.mic-patterns .ds-list-item')].map(e => e.textContent.trim()),
    patternSel: c.querySelector('.mic-patterns .ds-list-item.selected')?.textContent.trim() ?? null,
    fxRows: [...c.querySelectorAll('.ds-ng3-row .ds-ng3-label.plain')].map(e => e.textContent.trim()),
    hasGain: !!c.querySelector('.dc-slider-row .ds-vu'),
    fits: r ? r.bottom <= innerHeight + 1 : null,
  };
})()`;

// Poll for the rendered canvas rather than sleeping a fixed amount — a fixed
// sleep made this suite flaky on a slow reload.
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

let loadN = 0;
async function open(send, sku, tab) {
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
  return evalJs(send, SNAP);
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

  // ── quadcast-2-s: full feature set ──
  let s = await open(send, 'quadcast-2-s');
  check('q2s: 4 tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Effects', 'Lighting', 'Settings']), s?.tabs.join('/'));
  check('q2s: chips USB + Cardioid', JSON.stringify(s?.chips) === JSON.stringify(['Connected · USB', 'Cardioid']), s?.chips.join('/'));
  check('q2s: 4 pickup patterns', s?.patterns.length === 4, s?.patterns.join(', '));
  check('q2s: gain VU + monitoring + tap-to-mute', s?.hasGain && ['Monitoring', 'Tap to Mute'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
  check('q2s: fits', s?.fits === true);

  // Pattern → chip sync
  await evalJs(send, `[...document.querySelectorAll('.mic-patterns .ds-list-item')].find(r => r.textContent.includes('Stereo')).click()`);
  await sleep(250);
  s = await evalJs(send, SNAP);
  check('q2s: pick Stereo → chip syncs', s?.chips[1] === 'Stereo' && /Stereo/.test(s?.patternSel || ''), s?.chips.join('/'));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mic-audio.png`, Buffer.from(shot.data, 'base64'));

  // Effects tab
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Effects').click()`);
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('q2s effects: preset + 4 processing rows', s?.labels.includes('Preset') && JSON.stringify(s?.fxRows) === JSON.stringify(['Noise Reduction', 'Compressor', 'Limiter', 'Noise Gate']), s?.fxRows.join(', '));

  // Lighting tab
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Lighting').click()`);
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('q2s lighting: effect + brightness + zones', s?.labels.includes('Effect') && s?.labels.includes('Brightness'), s?.labels.join(', '));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mic-lighting.png`, Buffer.from(shot.data, 'base64'));

  // Settings tab
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Settings').click()`);
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('q2s settings: device + mounting', s?.labels.some((l) => /QuadCast 2 S/.test(l)) && s?.labels.includes('Mounting'), s?.labels.join(', '));

  // ── solocast-2: single pattern, no lighting ──
  s = await open(send, 'solocast-2');
  check('solocast-2: no Lighting tab', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Effects', 'Settings']), s?.tabs.join('/'));
  check('solocast-2: single pattern', s?.patterns.length === 1 && s?.chips[1] === 'Cardioid', s?.patterns.join(', '));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mic-sparse.png`, Buffer.from(shot.data, 'base64'));

  // ── quadcast-2: gain disabled ──
  s = await open(send, 'quadcast-2');
  check('quadcast-2: no gain slider, toggles remain', s?.hasGain === false && s?.labels.includes('Monitoring'), s?.labels.join(', '));

  // Esc closes
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  check('Esc closes the canvas', !(await evalJs(send, `!!document.querySelector('.dc-canvas')`)));

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

// CDP walkthrough for the keyboard lighting quick-select rail — the Figma
// "Keyboard Quick Select" pill (Lights 32:34339) and the marquee tool that
// leads it.
//
// The model: the rail is how you build a lighting selection. The presets cover
// the common groups; the marquee covers everything they don't — drag a box over
// the board and the keys it crosses become the selection. A drag replaces the
// selection the way a preset does, Shift adds to it, and either way no preset
// stays lit claiming credit for a hand-made selection.
//
// The pill itself is system parts, not local ones: the Kintsugi panel surface,
// the Hadouken double stroke (2px inner border over a 1px dark hairline) and
// --shadow-lv-1, which IS the Figma Panels/Dark shadow.
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

async function waitFor(send, expr, timeoutMs = 8000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const SNAP = `(() => {
  const rail = document.querySelector('.kbd-quickselect');
  if (!rail) return { hasRail: false };
  const cs = getComputedStyle(rail);
  const box = rail.getBoundingClientRect();
  const icon = rail.querySelector('.kbd-qs-icon');
  const label = (t) => [...rail.querySelectorAll('.kbd-qs-btn')].find(b => b.textContent.trim() === t);
  const all = label('All');
  const wasd = label('WASD');
  return {
    hasRail: true,
    // Rail contents in order — the design leads with the marquee tool, then
    // Reset, then a divider, then the preset groups.
    order: [...rail.children].map(c => c.classList.contains('kbd-qs-icon') ? 'icon'
      : c.classList.contains('kbd-qs-divider') ? '|' : c.textContent.trim()),
    height: box.height,
    radius: cs.borderRadius,
    borderWidth: cs.borderTopWidth,
    borderColor: cs.borderTopColor,
    background: cs.backgroundColor,
    shadow: cs.boxShadow,
    gap: cs.gap,
    padding: cs.paddingLeft,
    labelSize: all ? getComputedStyle(all).fontSize : null,
    labelWeight: all ? getComputedStyle(all).fontWeight : null,
    activeColor: all ? getComputedStyle(all).color : null,
    inactiveColor: wasd ? getComputedStyle(wasd).color : null,
    divider: (() => {
      const d = rail.querySelector('.kbd-qs-divider');
      const c = getComputedStyle(d);
      return { height: d.getBoundingClientRect().height, background: c.backgroundColor };
    })(),
    armed: icon?.getAttribute('aria-pressed') === 'true',
    armedChip: icon ? getComputedStyle(icon).backgroundColor : null,
    iconLabel: icon?.getAttribute('aria-label') ?? null,
    // Which preset is lit, and what the board thinks is selected.
    activePresets: [...rail.querySelectorAll('.kbd-qs-btn.active')].map(b => b.textContent.trim() || 'icon'),
    lit: [...document.querySelectorAll('.kbd-key.lit-sel')].map(k => k.getAttribute('aria-label')),
    marqueeBox: !!document.querySelector('.kbd-marquee'),
    boardCursor: getComputedStyle(document.querySelector('.kbd')).cursor,
    modalOpen: !!document.querySelector('.dc-canvas'),
  };
})()`;

let loadN = 0;
async function open(send, tab = 'lighting') {
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/?sku=origins-65&tab=${tab}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  await waitFor(send, `document.querySelector('.kbd-key')`);
  await sleep(300);
  return evalJs(send, SNAP);
}

const keyRect = (send, label) =>
  evalJs(send, `(() => { const k = document.querySelector('[aria-label=${JSON.stringify(label)}]');
    const r = k.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; })()`);

/** Drag a box from just outside `from` to just outside `to`. */
async function drag(send, from, to, { shift = false, steps = 3 } = {}) {
  const a = await keyRect(send, from);
  const b = await keyRect(send, to);
  const x0 = a.l - 4, y0 = a.t - 4, x1 = b.r + 4, y1 = b.b + 4;
  const mod = shift ? 8 : 0;
  const ev = (type, x, y, buttons) =>
    send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'mouse', modifiers: mod });
  await ev('mousePressed', x0, y0, 1);
  for (let i = 1; i <= steps; i++) {
    await ev('mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, 1);
    await sleep(40);
  }
  await ev('mouseReleased', x1, y1, 0);
  await sleep(250);
}

/** Press and release without moving — a click, not a drag. */
async function clickKey(send, label) {
  const r = await keyRect(send, label);
  const x = (r.l + r.r) / 2, y = (r.t + r.b) / 2;
  const ev = (type, x, y, buttons) =>
    send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'mouse' });
  await ev('mousePressed', x, y, 1);
  await ev('mouseReleased', x, y, 0);
  await sleep(250);
}

const arm = async (send) => {
  await evalJs(send, `document.querySelector('.kbd-qs-icon').click()`);
  await sleep(250);
};

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
  await evalJs(send, `localStorage.removeItem('theme')`);

  // ── The rail as designed ─────────────────────────────────────────────────
  let s = await open(send);
  check('the rail exists in lighting mode', s?.hasRail === true);
  check('order matches the design: tool, Reset, divider, then the preset groups',
    JSON.stringify(s?.order) === JSON.stringify(['icon', 'Reset', '|', 'All', 'WASD', 'QWER', 'Numbers', 'Arrows', 'Functions']),
    JSON.stringify(s?.order));
  check('the designed 32 is the whole control, borders included', s?.height === 32, `${s?.height}px`);
  check('radius is the 16 step, not the 8 of --radius-card', s?.radius === '16px', s?.radius);
  check('Kintsugi panel surface, not a local color-mix', s?.background === 'rgba(30, 30, 31, 0.85)', s?.background);
  check('Hadouken double stroke: a 1px inner border…',
    s?.borderWidth === '1px' && s?.borderColor === 'rgba(255, 255, 255, 0.2)', `${s?.borderWidth} ${s?.borderColor}`);
  check('…over a 1px dark hairline, so the edge reads on any hero',
    /rgba\(0, 0, 0, 0\.8\) 0px 0px 0px 1px/.test(s?.shadow ?? ''), s?.shadow?.slice(0, 60));
  check('the Panels/Dark shadow is --shadow-lv-1',
    /rgba\(0, 0, 0, 0\.3\) 0px 1px 8px/.test(s?.shadow ?? '') && /rgba\(0, 0, 0, 0\.15\) 0px 2px 24px/.test(s?.shadow ?? ''),
    s?.shadow?.slice(0, 100));
  check('16px rhythm — the control step, not the 24px page gutter',
    s?.gap === '16px' && s?.padding === '16px', `gap=${s?.gap} pad=${s?.padding}`);
  check('labels are the 14/600 Hadouken label style',
    s?.labelSize === '14px' && s?.labelWeight === '600', `${s?.labelSize}/${s?.labelWeight}`);
  check('divider is a 16px hairline at 10% ink', s?.divider.height === 16 && s?.divider.background === 'rgba(255, 255, 255, 0.1)',
    JSON.stringify(s?.divider));
  check('the active preset is brighter than the rest, and it is All on open',
    s?.activePresets.join(',') === 'All' && s?.activeColor !== s?.inactiveColor,
    `${s?.activePresets} · ${s?.activeColor} vs ${s?.inactiveColor}`);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/kbd-qs-rail.png`, Buffer.from(shot.data, 'base64'));

  // ── The presets still do their job ───────────────────────────────────────
  // Pre-existing quirk, asserted as-is so a fix is a deliberate act: the rail
  // opens with All lit while nothing is actually selected, because activeQs
  // starts at 'all' and litSel starts empty.
  check('on open the rail lights All while the board holds no selection (known)',
    s?.activePresets.join(',') === 'All' && s?.lit.length === 0, `presets=${s?.activePresets} lit=${s?.lit.length}`);
  await evalJs(send, `[...document.querySelectorAll('.kbd-qs-btn')].find(b => b.textContent.trim() === 'All').click()`);
  await sleep(250);
  s = await evalJs(send, SNAP);
  check('clicking All selects the whole board', (s?.lit.length ?? 0) > 60, `${s?.lit.length} keys`);
  await evalJs(send, `[...document.querySelectorAll('.kbd-qs-btn')].find(b => b.textContent.trim() === 'WASD').click()`);
  await sleep(250);
  s = await evalJs(send, SNAP);
  check('WASD selects exactly those four', JSON.stringify(s?.lit.sort()) === JSON.stringify(['A', 'D', 'S', 'W']), JSON.stringify(s?.lit));
  await evalJs(send, `[...document.querySelectorAll('.kbd-qs-btn')].find(b => b.textContent.trim() === 'Reset').click()`);
  await sleep(250);
  s = await evalJs(send, SNAP);
  check('Reset empties the selection and lights no preset',
    s?.lit.length === 0 && s?.activePresets.length === 0, `${s?.lit.length} lit, presets=${s?.activePresets}`);

  // ── The marquee tool ─────────────────────────────────────────────────────
  check('the tool is off until asked for — no crosshair on an unarmed board',
    s?.armed === false && s?.boardCursor !== 'crosshair', `armed=${s?.armed} cursor=${s?.boardCursor}`);
  check('a11y: the tool says what it does, not just how it looks',
    /drag a box/i.test(s?.iconLabel ?? ''), s?.iconLabel);
  await arm(send);
  s = await evalJs(send, SNAP);
  check('arming is announced (aria-pressed) and drawn (chip + crosshair)',
    s?.armed === true && s?.armedChip === 'rgba(255, 255, 255, 0.1)' && s?.boardCursor === 'crosshair',
    `pressed=${s?.armed} chip=${s?.armedChip} cursor=${s?.boardCursor}`);

  await drag(send, 'Q', 'D');
  s = await evalJs(send, SNAP);
  check('a dragged box takes every key it crosses',
    ['Q', 'W', 'E', 'A', 'S', 'D'].every((k) => s?.lit.includes(k)), JSON.stringify(s?.lit));
  check('the box itself is gone once the drag ends', s?.marqueeBox === false);
  check('a hand-made selection leaves no preset claiming credit',
    s?.activePresets.join(',') === 'icon', JSON.stringify(s?.activePresets));
  const afterFirst = s?.lit.length ?? 0;
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/kbd-qs-marquee.png`, Buffer.from(shot.data, 'base64'));

  await drag(send, '1', '3', { shift: true });
  s = await evalJs(send, SNAP);
  check('Shift-drag adds to the selection instead of replacing it',
    s?.lit.includes('Q') && s?.lit.includes('1') && (s?.lit.length ?? 0) > afterFirst,
    `${afterFirst} → ${s?.lit.length}`);

  await drag(send, 'M', 'M');
  s = await evalJs(send, SNAP);
  check('a plain drag replaces what was there', !s?.lit.includes('Q') && s?.lit.includes('M'), JSON.stringify(s?.lit));

  // A press that never moves is a click, and the key under it must still
  // toggle — the drag guard has to let that through.
  const litBefore = s?.lit.length ?? 0;
  await clickKey(send, 'Z');
  s = await evalJs(send, SNAP);
  check('a press without a drag still toggles the key under it',
    s?.lit.includes('Z') && s?.lit.length === litBefore + 1, `${litBefore} → ${s?.lit.length}`);

  // ── Escape belongs to the tool, not to the modal ─────────────────────────
  await evalJs(send, `document.querySelector('.kbd').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('Escape disarms the tool and leaves the device modal open',
    s?.armed === false && s?.modalOpen === true, `armed=${s?.armed} modal=${s?.modalOpen}`);
  check('disarming does not throw the selection away', (s?.lit.length ?? 0) > 0, `${s?.lit.length} still lit`);

  // ── Light theme ──────────────────────────────────────────────────────────
  // The alpha-white scale does not flip with the theme but this rail's panel
  // does, so 10% white would simply vanish on the light surface.
  await evalJs(send, `localStorage.setItem('theme', 'light')`);
  s = await open(send);
  await arm(send);
  s = await evalJs(send, SNAP);
  check('light theme: the panel flips with the theme', s?.background === 'rgba(249, 249, 248, 0.85)', s?.background);
  check('light theme: the divider is black ink, not invisible white',
    s?.divider.background === 'rgba(0, 0, 0, 0.1)', s?.divider.background);
  check('light theme: the armed chip is visible too', s?.armedChip === 'rgba(0, 0, 0, 0.1)', s?.armedChip);
  check('light theme: active and inactive labels still differ',
    s?.activeColor !== s?.inactiveColor, `${s?.activeColor} vs ${s?.inactiveColor}`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/kbd-qs-light.png`, Buffer.from(shot.data, 'base64'));
  await evalJs(send, `localStorage.removeItem('theme')`);

  // ── The rail belongs to lighting ─────────────────────────────────────────
  s = await open(send, 'keys');
  check('keys mode shows the layer toggle, not the lighting rail',
    s?.hasRail === false && (await evalJs(send, `!!document.querySelector('.kbd-layer-toggle')`)) === true);

  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('theme')`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

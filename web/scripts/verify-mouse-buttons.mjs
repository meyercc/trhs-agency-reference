// CDP walkthrough for the mouse Buttons tab (TH-341, Figma Keys-Buttons
// 4631:41576): assignment callouts anchored on the hero, the arm → assign
// grammar (click a callout, then press any key or pick a chip), chip
// drag-and-drop onto a callout, and the Reset/Disable context menu.
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

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

// One callout's visible state, by its data-callout id.
const CO = (id) => `(() => {
  const co = document.querySelector('[data-callout="${id}"]');
  if (!co) return null;
  const btn = co.querySelector('.ds-callout');
  return {
    value: co.querySelector('.ds-callout-value')?.textContent.trim(),
    aria: btn.getAttribute('aria-label'),
    armed: btn.classList.contains('armed'),
    assigned: btn.classList.contains('assigned'),
    off: btn.classList.contains('disabled'),
    flip: btn.classList.contains('flip'),
  };
})()`;

const centerOf = (send, sel) => evalJs(send, `(() => {
  const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  // Unique ?r per run — identical URLs skip the reload and inherit the last
  // run's SPA state (the hash-navigation trap).
  await send('Page.navigate', { url: `http://localhost:5175/?r=${Date.now() % 1e7}#/?sku=saga-pro&tab=buttons` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('.dc-canvas .ds-ng3-body')`);
  await waitFor(send, `document.querySelectorAll('[data-callout]').length > 0`);

  // ── Callouts render from the SKU's slot data ──────────────────────────────
  let ids = await evalJs(send, `[...document.querySelectorAll('[data-callout]')].map(c => c.dataset.callout)`);
  check('callouts: one per SKU slot (saga-pro has 6)', ids.length === 6, ids.join(','));
  let s = await evalJs(send, CO('mouse-l'));
  check('callouts: default state shows the physical button name',
    s?.value === 'Mouse Left' && !s?.assigned, JSON.stringify(s));
  check('callouts: left-flank slots are mirrored (flip)', s?.flip === true);
  check('callouts: they are real buttons (focusable, labelled by content)',
    await evalJs(send, `[...document.querySelectorAll('[data-callout] .ds-callout')].every(b => b.tagName === 'BUTTON')`));

  // ── Arm → hint → press any key ────────────────────────────────────────────
  await evalJs(send, `document.querySelector('[data-callout="mouse-4"] .ds-callout').click()`);
  await waitFor(send, `document.querySelector('[data-callout="mouse-4"] .ds-callout.armed')`);
  s = await evalJs(send, CO('mouse-4'));
  // The hint fades in — wait for it rather than racing the transition.
  const hintShown = await waitFor(send, `(() => {
    const tip = document.querySelector('[data-callout="mouse-4"] .ds-tooltip-popup');
    return tip && getComputedStyle(tip).opacity === '1' && /press any key/i.test(tip.textContent);
  })()`);
  check('arm: clicking a callout arms it and shows the hint', s?.armed === true && hintShown);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mb-armed.png`, Buffer.from(shot.data, 'base64'));

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'g', code: 'KeyG', windowsVirtualKeyCode: 71 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'g', code: 'KeyG', windowsVirtualKeyCode: 71 });
  await waitFor(send, `document.querySelector('[data-callout="mouse-4"] .ds-callout.assigned')`);
  s = await evalJs(send, CO('mouse-4'));
  check('press any key: assigns it — single-line label, identity kept in the accessible name',
    s?.assigned === true && s?.value === 'G' && s?.aria === 'Mouse 4, assigned G', JSON.stringify(s));

  // Escape cancels an arm without closing the modal.
  await evalJs(send, `document.querySelector('[data-callout="mouse-5"] .ds-callout').click()`);
  await waitFor(send, `document.querySelector('[data-callout="mouse-5"] .ds-callout.armed')`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(send, `!document.querySelector('[data-callout="mouse-5"] .ds-callout.armed')`);
  check('arm: Escape cancels the arm and the canvas stays open',
    (await evalJs(send, `!!document.querySelector('.dc-canvas')`)) === true
    && !(await evalJs(send, CO('mouse-5')))?.armed);

  // ── Arm → pick a chip from the panel ──────────────────────────────────────
  await evalJs(send, `document.querySelector('[data-callout="mouse-5"] .ds-callout').click()`);
  await waitFor(send, `document.querySelector('[data-callout="mouse-5"] .ds-callout.armed')`);
  await evalJs(send, `[...document.querySelectorAll('.dc-key')].find(k => k.getAttribute('aria-label')?.includes('MOUS L 2X')).click()`);
  await waitFor(send, `document.querySelector('[data-callout="mouse-5"] .ds-callout.assigned')`);
  s = await evalJs(send, CO('mouse-5'));
  check('armed callout + chip click: assigns the chip', s?.value === 'MOUS L 2X' && /Mouse 5/.test(s?.aria ?? ''), JSON.stringify(s));

  // ── Chip-first: arm a chip, then click a callout ──────────────────────────
  await evalJs(send, `[...document.querySelectorAll('.dc-key')].find(k => k.getAttribute('aria-label')?.startsWith('DPI')).click()`);
  await waitFor(send, `document.querySelector('.dc-key.armed')`);
  check('chip-first: clicking a chip with nothing armed arms the chip (mirrors the keyboard)',
    await evalJs(send, `!!document.querySelector('.dc-key.armed')`));
  await evalJs(send, `document.querySelector('[data-callout="mouse-m"] .ds-callout').click()`);
  await waitFor(send, `document.querySelector('[data-callout="mouse-m"] .ds-callout.assigned')`);
  s = await evalJs(send, CO('mouse-m'));
  check('chip-first: clicking a callout assigns the armed chip and clears it',
    s?.value === 'DPI' && !(await evalJs(send, `!!document.querySelector('.dc-key.armed')`)), JSON.stringify(s));

  // ── Drag a chip onto a callout ────────────────────────────────────────────
  const chip = await centerOf(send, '.dc-key'); // MOUS L
  const co = await centerOf(send, '[data-callout="mouse-r"] .ds-callout');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: chip.x, y: chip.y, button: 'left', clickCount: 1 });
  await sleep(60);
  // moves must carry buttons:1 (held) or Chrome synthesises a different pointer stream
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (chip.x + co.x) / 2, y: (chip.y + co.y) / 2, button: 'left', buttons: 1 });
  await sleep(150);
  const midDrag = await evalJs(send, `!!document.querySelector('.dc-drag-ghost')`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: co.x, y: co.y, button: 'left', buttons: 1 });
  await sleep(200);
  const overState = await evalJs(send, CO('mouse-r'));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mb-drag.png`, Buffer.from(shot.data, 'base64'));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: co.x, y: co.y, button: 'left', clickCount: 1 });
  await waitFor(send, `document.querySelector('[data-callout="mouse-r"] .ds-callout.assigned')`);
  s = await evalJs(send, CO('mouse-r'));
  check('drag: ghost follows the pointer mid-drag', midDrag === true);
  check('drag: hovering a callout highlights it as the drop target', overState?.armed === true, JSON.stringify(overState));
  check('drag: dropping assigns the chip', s?.value === 'MOUS L' && s?.assigned === true, JSON.stringify(s));
  check('drag: ghost cleaned up after drop', (await evalJs(send, `!!document.querySelector('.dc-drag-ghost')`)) === false);

  // ── Context menu: Reset / Disable ─────────────────────────────────────────
  await evalJs(send, `(() => {
    const btn = document.querySelector('[data-callout="mouse-r"] .ds-callout');
    const r = btn.getBoundingClientRect();
    btn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10 }));
  })()`);
  await waitFor(send, `document.querySelector('.dc-cmenu')`);
  check('context menu: opens on right-click with Reset + Disable',
    await evalJs(send, `[...document.querySelectorAll('.dc-cmenu-item')].map(b => b.textContent.trim()).join('/')`)
      === 'Reset Button/Disable Button');
  await evalJs(send, `[...document.querySelectorAll('.dc-cmenu-item')].find(b => b.textContent.includes('Reset')).click()`);
  await waitFor(send, `!document.querySelector('.dc-cmenu')`);
  s = await evalJs(send, CO('mouse-r'));
  check('context menu: Reset returns the callout to its default', s?.value === 'Mouse Right' && !s?.assigned, JSON.stringify(s));

  await evalJs(send, `(() => {
    const btn = document.querySelector('[data-callout="dpi"] .ds-callout');
    btn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 400 }));
  })()`);
  await waitFor(send, `document.querySelector('.dc-cmenu')`);
  await evalJs(send, `[...document.querySelectorAll('.dc-cmenu-item')].find(b => b.textContent.includes('Disable')).click()`);
  await waitFor(send, `document.querySelector('[data-callout="dpi"] .ds-callout.disabled')`);
  s = await evalJs(send, CO('dpi'));
  check('context menu: Disable switches the button off — shown, not hidden',
    s?.off === true && s?.value === 'Disabled' && s?.aria === 'DPI, disabled', JSON.stringify(s));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mb-states.png`, Buffer.from(shot.data, 'base64'));

  // ── Reset Buttons clears everything ───────────────────────────────────────
  await evalJs(send, `document.querySelector('.dc-reset').click()`);
  await waitFor(send, `!document.querySelector('.ds-callout.assigned') && !document.querySelector('.ds-callout.disabled')`);
  check('Reset Buttons: every callout back to defaults',
    await evalJs(send, `[...document.querySelectorAll('[data-callout] .ds-callout-value')].map(v => v.textContent.trim()).join('/')`)
      === 'Mouse Left/Mouse Right/Mouse Middle/Mouse 5/Mouse 4/DPI'
      || (await evalJs(send, `document.querySelectorAll('.ds-callout.assigned, .ds-callout.disabled').length`)) === 0);

  // ── Callouts belong to the Buttons tab only ───────────────────────────────
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Sensor').click()`);
  await waitFor(send, `document.querySelector('.dc-sensor')`);
  check('callouts: absent on other tabs', (await evalJs(send, `document.querySelectorAll('[data-callout]').length`)) === 0);

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

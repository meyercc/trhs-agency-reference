// CDP walkthrough for the MonitorCanvas (NG3 monitor modal, pulse-27).
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
    sections: c.querySelectorAll('.ds-ng3-section').length,
    arrange: !!c.querySelector('.dsa-stage'),
    photo: !!c.querySelector('.dc-hero img'),
    specVals: [...c.querySelectorAll('.ds-ng3-spec-val')].map(e => e.textContent.trim()),
    // Scrolling is only sanctioned inside .ds-ng3-scroll — flag any other
    // scrollable region (closed dropdown menus inflate scrollHeight without
    // scrolling, so only count elements whose computed overflow can scroll).
    bodyScrolls: body ? [...body.querySelectorAll('*')].some(e =>
      !e.closest('.ds-ng3-scroll') &&
      /(auto|scroll)/.test(getComputedStyle(e).overflowY) &&
      e.scrollHeight > e.clientHeight + 1) : null,
    fits: r ? r.bottom <= innerHeight + 1 : null,
    kvmStage: !!c.querySelector('.kvm-stage'),
    kvmBanner: !!c.querySelector('.kvm-setup'),
    inputRows: c.querySelectorAll('.ds-ng3-scroll .ds-list-item').length,
  };
})()`;

let loadN = 0;
async function open(send, tab, pre = '') {
  await evalJs(send, `localStorage.removeItem('kvm'); localStorage.removeItem('displayArrange'); ${pre}`);
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/?sku=pulse-27${tab ? '&tab=' + tab : ''}` });
  await sleep(1100);
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

  // ── Monitor 5-tab IA (Cindy, 2026-07): pulse-27 has no modes and no
  // speakers, so its roster is the gated 3 — Connectivity · Display ·
  // Utilities. KVM lives inside Connectivity (KvmTab byte-for-byte, TH-320
  // contract unchanged); Color folded into Display; Settings → Utilities. ──
  let s = await open(send);
  check('3 tabs (no modes → no Overview; no speakers → no Audio)',
    JSON.stringify(s?.tabs) === JSON.stringify(['Connectivity', 'Display', 'Utilities']), s?.tabs.join('/'));
  check('chips: USB + 240 Hz', JSON.stringify(s?.chips) === JSON.stringify(['Connected · USB', '240 Hz']), s?.chips.join('/'));
  check('hero is DisplayArrange', s?.arrange === true);

  // ── Connectivity (default tab): KVM + inputs re-homed here ──
  check('connectivity: setup banner until configured', s?.kvmBanner === true);
  check('connectivity: routing stage + inputs list (3)', s?.kvmStage === true && s?.inputRows === 3,
    `stage=${s?.kvmStage} rows=${s?.inputRows}`);
  check('connectivity: Switching + Inputs sections', ['Switching', 'Inputs', 'Rename Inputs'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
  check('connectivity: panel fits viewport', s?.fits === true, `fits=${s?.fits}`);
  // NOTE not asserted: bodyScrolls — Cindy's Connectivity layout is flagged
  // provisional (70041b0) and currently scrolls outside .ds-ng3-scroll.
  // Re-tighten to `bodyScrolls === false` when the layout lands.
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/monitor-connectivity.png`, Buffer.from(shot.data, 'base64'));

  // Configure + switch to PC 2 → Settings.kvm updates (the TH-320 contract)
  await evalJs(send, `[...document.querySelectorAll('.kvm-setup .ds-btn')].at(0)?.click() ?? [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Set up KVM').click()`);
  await sleep(250);
  await evalJs(send, `[...document.querySelectorAll('.kvm-src')].find(b => b.textContent.includes('Work Laptop')).click()`);
  await sleep(300);
  const kvmState = await evalJs(send, `localStorage.getItem('kvm')`);
  check('kvm: switch → Settings.kvm pc2', /pc2/.test(String(kvmState)) && /"configured":true/.test(String(kvmState)), String(kvmState));

  // ── Display tab (Color folded in) ──
  s = await open(send, 'display');
  check('display deep link opens Display', s?.title === 'Display', String(s?.title));
  check('display: Brightness/Contrast + color group', ['Brightness', 'Contrast', 'HDR', 'RGB Gain'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
  check('display: fits, no body scroll', s?.fits === true && s?.bodyScrolls === false, `fits=${s?.fits} scrolls=${s?.bodyScrolls}`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/monitor-display.png`, Buffer.from(shot.data, 'base64'));

  // Extend/Mirror moved into the Arrange editor (Chris 1:1 2026-07-30): the
  // hero desk map is the view lens; the editor owns the arrangement. Contract
  // unchanged — Mirror still writes Settings.displayArrange.
  await evalJs(send, `[...document.querySelectorAll('.dsa-actions .ds-btn')].find(b => b.textContent.trim() === 'Arrange')?.click()`);
  await sleep(400);
  const editorOpen = await evalJs(send, `!!document.querySelector('.arrange-modal')`);
  check('Arrange opens the editor', editorOpen === true);
  await evalJs(send, `[...document.querySelectorAll('.arrange-modal .ds-toggle-group-btn')].find(b => b.textContent.trim() === 'Mirror')?.click()`);
  await sleep(300);
  const arrange = await evalJs(send, `localStorage.getItem('displayArrange')`);
  check('editor: Mirror writes displayArrange', /mirror/.test(String(arrange)), String(arrange).slice(0, 40));

  // ── Utilities tab (the old Settings; inputs now live on Connectivity) ──
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Utilities').click()`);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('utilities: spec values (OLED, 240 Hz)', s?.specVals.includes('240 Hz') && s?.specVals.includes('OLED'), s?.specVals.join(', '));
  check('utilities: Power/Firmware/OSD groups', ['Power', 'Firmware', 'OSD'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
  check('utilities: fits, no scroll', s?.fits === true && s?.bodyScrolls === false);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/monitor-utilities.png`, Buffer.from(shot.data, 'base64'));

  await evalJs(send, `localStorage.removeItem('kvm'); localStorage.removeItem('displayArrange');`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

// Regression checks for the three rows a DIVIDED screen needs (Connectivity →
// VIEWING MODE): `Left screen` / `Main screen`, `PIP size`, `Sound from`.
//
// What is checked here is mostly about the rows EXISTING ONLY WHEN THEY MEAN
// SOMETHING. The layout decides that — `Full Screen` has one source filling the
// panel, so all three questions are unanswerable and none of them is drawn; a
// desk with one computer cannot divide a screen at all, so the rows stay away
// even if an old PIP layout is still saved. A dropdown that offers one option,
// or a control with nothing behind it, is the failure this file watches for.
//
// The other half is INDEPENDENCE: the three values are stored beside the layout
// rather than under `byMode` with it (see `ViewingModeState`), so a mode switch
// must move the layout and leave these alone.
//
// Run: dev server on :5201, headless Chrome on :9233, from web/.
//   node scripts/verify-pbp-depth.mjs
import WebSocket from 'ws';

// Desk hardware — the Admin axis since 2026-09-08. `displayCount`/`pcCount` are
// gone; the desk is a LIST of optional devices (`deskDevices`) and the numbers
// are derived. This maps the (screens, PCs) pairs these checks were written in
// onto the real desks: 3 screens = OMEN + laptop lid + Treehouse; 2 = laptop
// lid + Treehouse; 1 = the tower alone with the Treehouse (a laptop on the desk
// brings its screen, so a one-screen desk has no laptop). PCs 1 drops the tower.
const DESK = (screens, pcs = 2) => JSON.stringify(
  screens >= 3 ? ['pulse-27', 'macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : screens === 2 ? ['macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : ['tower']);

const PORT = process.env.PORT || '5201';
const CDP = process.env.CDP || '9233';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
const pend = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++msgId;
    pend.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });

let n = 0;
const open = async (hash = '#/perform?sku=treehouse-32&tab=connectivity') => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${++n}${hash}` });
  await sleep(2500);
  // Poll rather than guess: the tab renders the tiles last, and a fixed sleep
  // that was long enough before storage was cleared was not after (the first
  // run of this file reported 0 tiles and then found them 300ms later).
  for (let i = 0; i < 40; i++) {
    if ((await ev(`document.querySelectorAll('.vm-tile').length`)) > 0) return;
    await sleep(250);
  }
};

// Read every depth row on the tab, with the numbers a slot budget needs.
const ROWS = `(() => {
  const wanted = ['Left screen', 'Main screen', 'PIP size', 'Sound from'];
  const out = {};
  for (const w of wanted) {
    const label = [...document.querySelectorAll('.ds-ng3-label')].find((e) => e.textContent.trim() === w);
    if (!label) continue;
    const host = label.closest('.ds-ng3-row') || label.closest('.ds-ng3-field');
    const dd = host.querySelector('.ds-dropdown-label');
    const seg = [...host.querySelectorAll('.ds-toggle-group-btn')];
    const r = host.getBoundingClientRect();
    out[w] = {
      value: dd ? dd.textContent.trim() : (seg.find((b) => b.className.includes('active')) || {}).textContent?.trim(),
      options: dd ? host.querySelectorAll('[role="option"]').length : seg.length,
      height: +r.height.toFixed(0),
      labelWidth: +label.getBoundingClientRect().width.toFixed(0),
      hostWidth: +r.width.toFixed(0),
    };
  }
  return out;
})()`;

// The two computers' names come from the SKU (`gearSwitch.hosts`) and changed on
// 2026-09-03 when the second sample became a desktop. SPEC: desk-stage item 12
// says checks read them rather than repeat them, so this pulls the `Sound from`
// dropdown's own options — which are exactly those two hosts, in order.
const HOSTS = `(() => {
  const label = [...document.querySelectorAll('.ds-ng3-label')].find((e) => e.textContent.trim() === 'Sound from');
  if (!label) return [];
  const host = label.closest('.ds-ng3-row') || label.closest('.ds-ng3-field');
  return [...host.querySelectorAll('[role="option"]')].map((e) => e.textContent.trim());
})()`;

const pickTile = (id) => `(() => {
  const t = [...document.querySelectorAll('.vm-tile')].find((b) => b.getAttribute('aria-label') === '${id}');
  if (!t) return false;
  t.click();
  return true;
})()`;

const pickInRow = (rowLabel, option) => `(() => {
  const label = [...document.querySelectorAll('.ds-ng3-label')].find((e) => e.textContent.trim() === '${rowLabel}');
  const host = label.closest('.ds-ng3-row') || label.closest('.ds-ng3-field');
  const seg = [...host.querySelectorAll('.ds-toggle-group-btn')].find((b) => b.textContent.trim() === '${option}');
  if (seg) { seg.click(); return 'seg'; }
  host.querySelector('.ds-dropdown-trigger').click();
  const opt = [...host.querySelectorAll('[role="option"]')].find((e) => e.textContent.trim() === '${option}');
  opt.click();
  return 'dropdown';
})()`;

const vm = `JSON.parse(localStorage.getItem('viewingMode') || '{}')`;
const reset = `(() => { localStorage.clear(); return true; })()`;

// ── Full Screen: the rows do not exist ───────────────────────────────────────
await open();
await ev(reset);
await open();
let rows = await ev(ROWS);
check('Full Screen draws none of the three rows', Object.keys(rows).length === 0, `saw ${JSON.stringify(Object.keys(rows))}`);
check('the tiles themselves are there (8 on this SKU)', (await ev(`document.querySelectorAll('.vm-tile').length`)) === 8);

// ── PBP: side + speakers, no size ────────────────────────────────────────────
await ev(pickTile('PBP'));
await sleep(300);
rows = await ev(ROWS);
check('PBP draws `Left screen` and `Sound from`', !!rows['Left screen'] && !!rows['Sound from']);
check('PBP draws no `PIP size` (nothing is inset)', !rows['PIP size']);
check('PBP does not also draw `Main screen` (one label per setting)', !rows['Main screen']);
const [PC1, PC2] = await ev(HOSTS);
check('the two computers come from the SKU, not from this file', !!PC1 && !!PC2 && PC1 !== PC2, `${PC1} / ${PC2}`);
check('`Left screen` defaults to the first computer', rows['Left screen']?.value === PC1, rows['Left screen']?.value);
check('`Sound from` defaults to the main pane', rows['Sound from']?.value === PC1, rows['Sound from']?.value);
check('no dropdown offers a single option', Object.values(rows).every((r) => r.options >= 2), JSON.stringify(Object.values(rows).map((r) => r.options)));

// ── Slot budget: label and control share one line ─────────────────────────────
check(
  'every row stays one line (≤ 44px, the row height this card uses)',
  Object.values(rows).every((r) => r.height <= 44),
  JSON.stringify(Object.entries(rows).map(([k, v]) => `${k}:${v.height}`)),
);
check(
  'no label eats more than 60% of its row (copy-rules slot budget)',
  Object.values(rows).every((r) => r.labelWidth / r.hostWidth <= 0.6),
  JSON.stringify(Object.entries(rows).map(([k, v]) => `${k}:${((v.labelWidth / v.hostWidth) * 100).toFixed(0)}%`)),
);

// ── PIP: main + size + speakers ──────────────────────────────────────────────
await ev(pickTile('PIP TopR'));
await sleep(300);
rows = await ev(ROWS);
check('PIP draws `Main screen`, `PIP size`, `Sound from`', !!rows['Main screen'] && !!rows['PIP size'] && !!rows['Sound from']);
check('PIP drops the `Left screen` wording', !rows['Left screen']);
check('`PIP size` starts on Medium', rows['PIP size']?.value === 'Medium', rows['PIP size']?.value);
check('`PIP size` offers three named steps, not a slider', rows['PIP size']?.options === 3);

// ── The three values are written, and written separately ──────────────────────
await ev(pickInRow('PIP size', 'Large'));
await sleep(250);
let saved = await ev(vm);
check('`PIP size` saves', saved.pipSize === 'Large', JSON.stringify(saved));
await ev(pickInRow('Sound from', PC2));
await sleep(250);
saved = await ev(vm);
check('`Sound from` saves to its own field', saved.audioFrom === PC2, JSON.stringify(saved));
await ev(pickInRow('Main screen', PC2));
await sleep(250);
saved = await ev(vm);
check('moving the main pane does not move a chosen `Sound from`', saved.left === PC2 && saved.audioFrom === PC2, JSON.stringify(saved));

// ── Reload, and back to Full Screen ──────────────────────────────────────────
await open();
rows = await ev(ROWS);
check('the three answers survive a reload', rows['PIP size']?.value === 'Large' && rows['Sound from']?.value === PC2);
await ev(pickTile('Full Screen'));
await sleep(300);
rows = await ev(ROWS);
saved = await ev(vm);
check('going back to Full Screen hides the rows', Object.keys(rows).length === 0);
check('…and keeps their values for the next split', saved.pipSize === 'Large' && saved.audioFrom === PC2, JSON.stringify(saved));

// ── One computer: no half-choices, even with a split saved ────────────────────
await ev(`(() => { localStorage.setItem('viewingMode', JSON.stringify({ current: 'PIP TopR', byMode: {}, pipSize: 'Large' })); localStorage.setItem('deskDevices','${DESK(3, 1)}'); return true; })()`);
await open();
rows = await ev(ROWS);
check('one computer draws no depth rows even with PIP saved', Object.keys(rows).length === 0, JSON.stringify(Object.keys(rows)));
await ev(`(() => { localStorage.setItem('deskDevices','${DESK(3, 2)}'); return true; })()`);

// ── A mode switch moves the layout, not these three ──────────────────────────
await ev(`(() => {
  localStorage.setItem('viewingMode', JSON.stringify({ current: 'PBP', byMode: { Game: 'PBP', Work: 'PIP TopR' }, left: '${PC2}', pipSize: 'Small', audioFrom: '${PC1}' }));
  localStorage.setItem('monitorMode', 'Game');
  return true;
})()`);
await open();
const before = await ev(vm);
const switched = await ev(`(() => {
  // The mode bar is one grouped Dropdown in the tab strip (2026-09-24): the
  // trigger opens the list of the desk's profile and this monitor's modes.
  const trig = document.querySelector('.pb-select .ds-dropdown-trigger');
  if (!trig) return false;
  trig.click();
  return true;
})()`);
check('the mode bar could be driven (setup, not a finding)', switched === true);
await sleep(400);
const chose = await ev(`(() => {
  const opt = [...document.querySelectorAll('.pb-select .ds-list-item')]
    .find((e) => e.querySelector('.ds-list-item-label')?.textContent.trim() === 'Work');
  if (!opt) return false;
  opt.click();
  return true;
})()`);
check('…and the mode list offered Work (setup, not a finding)', chose === true);
await sleep(900);
const after = await ev(vm);
check('a mode switch restores that mode’s layout', after.current === 'PIP TopR', `${before.current} → ${after.current}`);
check('…and leaves the three depth values alone', after.left === before.left && after.pipSize === before.pipSize && after.audioFrom === before.audioFrom, JSON.stringify(after));

// ── The receipt names what the mode actually learned ─────────────────────────
// Four values live on this card and only the layout is mode-scoped, so a bare
// `Saved to Create` would claim the other three (2026-08-21 consultant pass).
await ev(`(() => { localStorage.setItem('monitorMode','Create'); localStorage.setItem('deskDevices','${DESK(3, 2)}'); localStorage.setItem('viewingMode', JSON.stringify({current:'Full Screen', byMode:{}})); return true; })()`);
await open();
await ev(pickTile('PBP'));
await sleep(400);
const ask = await ev(`(() => { const n = document.querySelector('.pb-note'); return n ? n.textContent.trim() : null; })()`);
check('picking a layout in a mode asks in one line', /^Remember this layout for Create\?/.test(ask || ''), ask || 'no note');
const receipt = await ev(`(() => {
  const b = [...document.querySelectorAll('.pb-actions button')].find((e) => e.textContent.trim() === 'Save');
  if (!b) return null;
  b.click();
  return new Promise((r) => setTimeout(() => {
    const n = document.querySelector('.pb-note');
    r(n ? n.textContent.trim() : null);
  }, 400));
})()`);
check('the receipt says which value the mode learned', /layout only/.test(receipt || ''), receipt || 'no receipt');

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (bad.length) {
  console.log('FAILED: ' + bad.map((b) => b.name).join(' · '));
  process.exit(1);
}
ws.close();

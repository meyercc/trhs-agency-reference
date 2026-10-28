// CDP walkthrough for the Performance page under the June 2027 scope (set
// explicitly; full parity is the default): no Power Mode card, no door to
// Advanced Tuning, no Fan Cleaner, and the cards that stay fill their rows. The June MVP leaves out OMEN hardware
// control (deck "Treehouse MVP Modules June 2027", slide 7). Then the
// "Product scope" row in the Simulator on /perform-v7 switches to Full
// and brings all of it back without a reload; the Admin modal has no Scope switch.
// Fan Cleaner is a notebook's (JY, 2026-10-22): the Full checks run on the
// laptop the Simulator picked above, and the desktop has none.
// Also: Home's board without the Power Mode widget or the Fan Control buttons,
// the page subtitle, Nova's June replies and chips, and a link that carries the
// scope (?scope=27c2 reads as full).
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

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

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;

// The keys this suite reads or writes, cleared so a run starts from defaults
// (nothing stored: the scope is full parity).
const OWN_KEYS = ['mvpScope', 'thisPc', 'nonHpPc', 'omenAi', 'gameSession', 'powerModeEvent', 'powerMode', 'perform-main-sections', 'perform-v7-sections', 'board-layout', 'board-seeded-dev-pc', 'trhs-nova', 'trhs-modules'];

let loadN = 0;
// `sim=1`: the Simulator is hidden until asked (2026-10-26); these suites drive it.
async function load(send, hash = '#/perform', ready = `document.querySelector('.pv5-root')`) {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}&sim=1${hash}` });
  await waitFor(send, APP_READY);
  await waitFor(send, ready);
  await sleep(250);
}

// ── What the page shows, as a person reads it ────────────────────────────────
const sectionLabels = `[...document.querySelectorAll('.pg-section-label')].map(e => e.textContent.trim())`;

/** The first row of the Performance section: how its cards fill it. */
const PERF_ROW = `(() => {
  const zone = document.querySelector('.pv4-zone');
  if (!zone) return null;
  const row = zone.firstElementChild;
  const kids = [...row.children];
  const box = row.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const used = kids.reduce((s, k) => s + k.getBoundingClientRect().width, 0) + gap * Math.max(0, kids.length - 1);
  const tops = [...new Set(kids.map(k => Math.round(k.getBoundingClientRect().top)))];
  return {
    cls: row.className,
    cards: kids.length,
    titles: kids.map(k => k.querySelector('.ds-feature-card-title')?.textContent.trim()),
    rowWidth: Math.round(box.width),
    used: Math.round(used),
    oneLine: tops.length === 1,
    rows: zone.children.length,
  };
})()`;

/** The Maintenance grid: its cards and how they fill the row. */
const MAINT = `(() => {
  const grid = document.querySelector('.pv5-maint-grid');
  if (!grid) return null;
  const kids = [...grid.children];
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
  const w = grid.getBoundingClientRect().width;
  return {
    cards: kids.map(k => k.querySelector('.ds-feature-card-title')?.textContent.trim()),
    widths: kids.map(k => Math.round(k.getBoundingClientRect().width)),
    gridWidth: Math.round(w),
    gap: Math.round(gap),
    tops: [...new Set(kids.map(k => Math.round(k.getBoundingClientRect().top)))].length,
  };
})()`;

/** Everything of the Power Mode card, the managed mark and the way into Advanced Tuning. */
const POWER_MODE_BITS = `(() => {
  const q = (s) => document.querySelectorAll(s).length;
  const text = document.querySelector('.pv5-root').innerText;
  return {
    anchor: q('.pv5-anchor'),
    tiles: q('.power-mode-btn, .pv5-mode-tile'),
    managedFrame: q('.pv5-managed'),
    govChip: q('.pv5-gov-chip'),
    configureDoor: [...document.querySelectorAll('.pv5-card-door')].filter(b => /configure/i.test(b.textContent)).length,
    advancedTuningRow: [...document.querySelectorAll('.ut-row-label')].filter(e => /advanced tuning/i.test(e.textContent)).length,
    cardTitle: [...document.querySelectorAll('.ds-feature-card-title')].filter(e => e.textContent.trim() === 'Power Mode').length,
    // The mode names as words on the page (the section header "Performance" is not one of them).
    modeWords: (text.match(/\\b(Eco|Balanced|Unleashed|Extreme)\\b/g) || []),
    managedText: /Managed by OMEN AI/.test(text),
    tuningModal: q('.pv7-modals .modal-shell, .pv7-modals [role=dialog]'),
  };
})()`;

const FAN_BITS = `(() => ({
  titled: [...document.querySelectorAll('.ds-feature-card-title')].filter(e => /fan cleaner/i.test(e.textContent)).length,
  text: /fan cleaner/i.test(document.querySelector('.pv5-root').innerText),
}))()`;

const clickTabIn = (send, group, label) =>
  evalJs(send, `[...document.querySelectorAll('[aria-label=${JSON.stringify(group)}] [role=tab]')].find(t => t.textContent.trim() === ${JSON.stringify(label)})?.click()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  // Page errors and console errors, per load: a harmless arrival is a quiet one.
  let errors = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description ?? ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await load(send, '#/', `document.querySelector('#root')?.firstElementChild`);
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);

  // ── /perform, nothing stored: full parity ─────────────────────────────────
  errors = [];
  await load(send, '#/perform');
  check('default: the scope is full parity when nothing is stored — the Power Mode card is there',
    await evalJs(send, `localStorage.getItem('mvpScope') === null`) && await evalJs(send, `document.querySelectorAll('.pv5-anchor').length === 1`));
  check('default: a stored 27c2 still reads as full — the Power Mode card is there',
    await evalJs(send, `localStorage.setItem('mvpScope', '27c2'); true`) && (await load(send, '#/perform'), await evalJs(send, `document.querySelectorAll('.pv5-anchor').length === 1`)));

  // ── /perform, June 2027 set explicitly ────────────────────────────────────
  await evalJs(send, `localStorage.setItem('mvpScope', 'june27')`);
  await load(send, '#/perform');
  check('june: the scope is June 2027 when stored', await evalJs(send, `localStorage.getItem('mvpScope') === 'june27'`));
  let pm = await evalJs(send, POWER_MODE_BITS);
  check('june: no Power Mode card, no mode tiles, no managed mark',
    pm.anchor === 0 && pm.tiles === 0 && pm.cardTitle === 0 && pm.managedFrame === 0 && pm.govChip === 0 && !pm.managedText, JSON.stringify(pm));
  check('june: no mode name anywhere on the page (Eco, Balanced, Unleashed, Extreme)', pm.modeWords.length === 0, JSON.stringify(pm.modeWords));
  check('june: no configure row, no Advanced Tuning row, nothing opens a tuning window',
    pm.configureDoor === 0 && pm.advancedTuningRow === 0 && pm.tuningModal === 0, JSON.stringify(pm));
  check('june: the Performance section is still there, under its header',
    JSON.stringify(await evalJs(send, sectionLabels)) === JSON.stringify(['Monitoring', 'Performance', 'Maintenance']), JSON.stringify(await evalJs(send, sectionLabels)));

  const row = await evalJs(send, PERF_ROW);
  check('june: the Performance section starts with the OMEN AI / Booster / Network Booster row',
    row?.cls === 'pv5-perf-row2' && row.cards === 3 && JSON.stringify(row.titles.map((t) => t ?? '')).includes('Booster') && row.rows === 1, JSON.stringify(row));
  check('june: that row has no empty slot — the three cards fill it on one line',
    row?.oneLine === true && Math.abs(row.rowWidth - row.used) <= 2, JSON.stringify(row));

  const fan = await evalJs(send, FAN_BITS);
  check('june: no Fan Cleaner card, and the words appear nowhere on the page', fan.titled === 0 && fan.text === false, JSON.stringify(fan));
  const maint = await evalJs(send, MAINT);
  check('june: Maintenance holds System Cleaner alone',
    JSON.stringify(maint?.cards) === JSON.stringify(['System Cleaner']), JSON.stringify(maint));
  check('june: System Cleaner spans the Maintenance row — no half row left empty',
    maint?.widths.length === 1 && Math.abs(maint.widths[0] - maint.gridWidth) <= 2, JSON.stringify(maint));
  check('june: a clean page — no errors while loading', errors.length === 0, errors.join(' | '));

  // Even with Unleashed stored as the mode (the one mode whose card carries the
  // configure row), June has no card and so no way into Advanced Tuning.
  await evalJs(send, `localStorage.setItem('powerModeEvent', JSON.stringify({ mode: 'unleashed', source: 'user' }))`);
  await load(send, '#/perform');
  pm = await evalJs(send, POWER_MODE_BITS);
  check('june, Unleashed stored: still no Power Mode card, no configure row, no tuning window',
    pm.anchor === 0 && pm.configureDoor === 0 && pm.advancedTuningRow === 0 && pm.tuningModal === 0 && pm.modeWords.length === 0, JSON.stringify(pm));
  await evalJs(send, `localStorage.removeItem('powerModeEvent')`);
  await load(send, '#/perform');

  // The System Cleaner and the Storage door still work; the Fan Cleaner door does not exist.
  await evalJs(send, `[...document.querySelectorAll('.pv5-card-door')].find(b => /schedule/i.test(b.textContent) && b.closest('.pv5-maint-grid'))?.click()`);
  check('june: System Cleaner still opens its scheduler',
    await waitFor(send, `document.querySelector('.pv7-modals .modal-shell, .pv7-modals [role=dialog]')`, 3000));
  await evalJs(send, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await waitFor(send, `!document.querySelector('.pv7-modals .modal-shell')`, 3000);

  // ── The arrivals that named the two cards are harmless ────────────────────
  for (const spot of ['power-mode', 'fan-cleaner']) {
    errors = [];
    await load(send, `#/perform?spot=${spot}`);
    await sleep(600);
    check(`june ?spot=${spot}: loads quietly, the parameter is cleared`,
      errors.length === 0 && (await evalJs(send, `!location.hash.includes('spot=')`)), `${errors.join(' | ')} · ${await evalJs(send, 'location.hash')}`);
    check(`june ?spot=${spot}: nothing is lit and the page is whole`,
      (await evalJs(send, `document.querySelectorAll('.pv5-spotlight').length === 0 && !!document.querySelector('.pv5-perf-row2') && !!document.querySelector('.pv5-maint-grid')`)));
  }
  // The card that is on the page still takes its arrival.
  errors = [];
  await load(send, '#/perform?spot=vitals');
  check('june ?spot=vitals: System Vitals still lights', await waitFor(send, `document.querySelector('.pv5-vitals-card.pv5-spotlight')`, 3000) && errors.length === 0, errors.join(' | '));

  // ── The Simulator on /perform-v7 ──────────────────────────────────────────
  errors = [];
  await load(send, '#/perform-v7');
  check('simulator: the rig is there', await evalJs(send, `!!document.querySelector('.pv3-rig-tag') && document.querySelector('.pv3-rig-tag').textContent.trim() === 'Simulator'`));
  pm = await evalJs(send, POWER_MODE_BITS);
  check('simulator · june, HyperX laptop: still no Power Mode card, no configure row',
    pm.anchor === 0 && pm.tiles === 0 && pm.configureDoor === 0 && pm.modeWords.length === 0, JSON.stringify(pm));

  await clickTabIn(send, 'Machine', 'Not a HyperX PC');
  await sleep(300);
  pm = await evalJs(send, POWER_MODE_BITS);
  let r = await evalJs(send, PERF_ROW);
  check('simulator · june, no HyperX laptop: Performance still renders, from the OMEN AI row, with no hole',
    pm.anchor === 0 && r?.cls === 'pv5-perf-row2' && r.cards === 3 && r.oneLine && Math.abs(r.rowWidth - r.used) <= 2, JSON.stringify(r));
  check('simulator · june, no HyperX laptop: the page keeps its three sections',
    JSON.stringify(await evalJs(send, sectionLabels)) === JSON.stringify(['Monitoring', 'Performance', 'Maintenance']));

  await clickTabIn(send, 'OMEN AI', '2.0');
  await sleep(300);
  r = await evalJs(send, PERF_ROW);
  check('simulator · june, OMEN AI 2.0: the OMEN AI card alone fills the row',
    r?.cards === 1 && r.oneLine && Math.abs(r.rowWidth - r.used) <= 2, JSON.stringify(r));

  await clickTabIn(send, 'OMEN AI', '1.0');
  await clickTabIn(send, 'Machine', 'Laptop');
  await sleep(300);
  // Turning OMEN AI on is unchanged by the scope: it lifts Eco to Performance
  // and signs the shared mode event omen_ai, though no card on this page shows it.
  await evalJs(send, `localStorage.setItem('powerModeEvent', JSON.stringify({ mode: 'eco', source: 'user' }))`);
  await load(send, '#/perform-v7');
  await clickTabIn(send, 'OMEN AI', 'Off');
  await clickTabIn(send, 'OMEN AI', '1.0');
  await sleep(300);
  const ev = await evalJs(send, `JSON.parse(localStorage.getItem('powerModeEvent') ?? 'null')`);
  check('simulator · june: enabling OMEN AI still lifts Eco to Performance and signs it omen_ai (as at full parity)',
    ev?.mode === 'performance' && ev?.source === 'omen_ai', JSON.stringify(ev));
  pm = await evalJs(send, POWER_MODE_BITS);
  check('simulator · june: OMEN AI enablement toggles without surfacing any power-mode UI',
    pm.anchor === 0 && pm.managedFrame === 0 && pm.govChip === 0 && !pm.managedText, JSON.stringify(pm));
  check('simulator · june: a clean page — no errors', errors.length === 0, errors.join(' | '));

  // ── The Simulator row: Full parity brings it all back, no reload ──────────
  await evalJs(send, `localStorage.removeItem('perform-v7-sections')`);
  await load(send, '#/perform?modal=admin');
  await waitFor(send, `document.querySelector('.modal-close')`);
  check('admin: the modal has no Scope switch any more', await evalJs(send, `!document.querySelector('[aria-label="Scope"]')`));
  await evalJs(send, `document.querySelector('.modal-close')?.click()`);
  await load(send, '#/perform-v7');
  const scopeTabs = await evalJs(send, `[...document.querySelectorAll('[aria-label="Product scope"] [role=tab]')].map(t => [t.textContent.trim(), t.getAttribute('aria-selected')])`);
  check('simulator scope: June 2027 and Full, June selected', JSON.stringify(scopeTabs) === JSON.stringify([['June 2027', 'true'], ['Full', 'false']]), JSON.stringify(scopeTabs));
  await clickTabIn(send, 'Product scope', 'Full');
  await sleep(300);
  check('simulator scope: choosing Full is kept', await evalJs(send, `localStorage.getItem('mvpScope') === 'full'`));
  check('full: the Power Mode card is back, with no reload',
    await waitFor(send, `document.querySelector('.pv5-anchor .power-mode-btn')`, 3000));
  pm = await evalJs(send, POWER_MODE_BITS);
  check('full: four mode tiles under a Power Mode title', pm.cardTitle === 1 && pm.tiles === 4 && pm.anchor === 1, JSON.stringify(pm));
  check('full: the OMEN AI event shows as managed, as it did before June', pm.managedFrame === 1 && pm.managedText, JSON.stringify(pm));
  // The configure row belongs to the Unleashed mode's sub controls.
  await evalJs(send, `[...document.querySelectorAll('.pv5-anchor .power-mode-btn')].find(b => /unleashed/i.test(b.textContent))?.click()`);
  await waitFor(send, `document.querySelector('.pv5-anchor .pv5-mode-tile.active.unleash-mode')`, 3000);
  await sleep(500);
  pm = await evalJs(send, POWER_MODE_BITS);
  check('full: the configure row to Advanced Tuning is back', pm.configureDoor === 1 && pm.advancedTuningRow === 1, JSON.stringify(pm));
  await evalJs(send, `[...document.querySelectorAll('.pv5-card-door')].find(b => /configure/i.test(b.textContent))?.click()`);
  check('full: the configure row opens Advanced Tuning',
    await waitFor(send, `document.querySelector('.pv7-modals .modal-shell, .pv7-modals [role=dialog]')`, 3000));
  await evalJs(send, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await waitFor(send, `!document.querySelector('.pv7-modals .modal-shell')`, 3000);

  const fan27 = await evalJs(send, FAN_BITS);
  const maint27 = await evalJs(send, MAINT);
  check('full, the laptop: the Fan Cleaner card is back', fan27.titled === 1, JSON.stringify(fan27));
  check('full, the laptop: Maintenance is two cards, half a row each — exactly as before',
    JSON.stringify(maint27?.cards) === JSON.stringify(['System Cleaner', 'Fan Cleaner'])
      && maint27.tops === 1 && Math.abs(maint27.widths[0] - maint27.widths[1]) <= 2 && Math.abs(maint27.widths[0] * 2 + maint27.gap - maint27.gridWidth) <= 2, JSON.stringify(maint27));
  const row27 = await evalJs(send, PERF_ROW);
  check('full: the Performance section starts with the Power Mode card on its own row', row27?.rows === 2 && row27.cls !== 'pv5-perf-row2', JSON.stringify(row27));

  // The arrivals land again.
  await load(send, '#/perform?spot=power-mode');
  check('full ?spot=power-mode: the Power Mode card lights', await waitFor(send, `document.querySelector('.pv5-anchor.pv5-spotlight')`, 3000));
  await load(send, '#/perform?spot=fan-cleaner');
  check('full ?spot=fan-cleaner, the laptop: the Fan Cleaner card lights', await waitFor(send, `[...document.querySelectorAll('.pv5-maint-grid > .pv5-spotlight')].length === 1`, 3000));
  // The desktop has no Fan Cleaner: its supply cleans its own fan, on the PC page.
  const pcBefore = await evalJs(send, `localStorage.getItem('thisPc')`);
  await evalJs(send, `localStorage.setItem('thisPc', 'forge-45l')`);
  await load(send, '#/perform');
  await waitFor(send, `document.querySelector('.pv5-maint-grid')`);
  const fanDesk = await evalJs(send, FAN_BITS);
  const maintDesk = await evalJs(send, MAINT);
  check('full, the desktop: no Fan Cleaner card; System Cleaner spans the Maintenance row',
    fanDesk.titled === 0 && JSON.stringify(maintDesk?.cards) === JSON.stringify(['System Cleaner']) && Math.abs(maintDesk.widths[0] - maintDesk.gridWidth) <= 2, JSON.stringify({ fanDesk, maintDesk }));
  // Back to the machine the Simulator picked, for the rest of the walk.
  await evalJs(send, pcBefore === null ? `localStorage.removeItem('thisPc')` : `localStorage.setItem('thisPc', ${JSON.stringify(pcBefore)})`);

  // And back: choosing June 2027 in the Simulator again takes them away, no reload.
  await load(send, '#/perform-v7');
  await waitFor(send, `document.querySelector('[aria-label="Product scope"]')`);
  await clickTabIn(send, 'Product scope', 'June 2027');
  check('june again: the Power Mode card and the Fan Cleaner go without a reload',
    await waitFor(send, `!document.querySelector('.pv5-anchor') && ![...document.querySelectorAll('.ds-feature-card-title')].some(e => /fan cleaner/i.test(e.textContent))`, 3000));

  // ── Home, the subtitle and Nova, both scopes ──────────────────────────────
  const BOARD = JSON.stringify([
    { id: 'power', span: 3, rows: 1 }, { id: 'thermal', span: 2, rows: 2 }, { id: 'fanspeed', span: 2, rows: 1 },
  ]);
  const cellIds = `[...document.querySelectorAll('.wb-cell')].map(c => c.dataset.widget)`;
  // On the board a widget's header link lives in its card ⋮ menu (WidgetShell hands it off).
  const menuOf = async (id) => {
    await evalJs(send, `document.querySelector('.wb-cell[data-widget="${id}"] .card-menu button')?.click()`);
    await waitFor(send, `document.querySelector('.card-menu-pop [role=menuitem]')`, 2000);
    const items = await evalJs(send, `[...document.querySelectorAll('.card-menu-pop [role=menuitem]')].map(e => e.textContent.trim())`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(300);
    return items || [];
  };
  const fanControlLinks = async () => (await menuOf('thermal')).concat(await menuOf('fanspeed')).filter((t) => /fan control/i.test(t));
  const subtitleText = `document.querySelector('.pv5-root .page-sub')?.textContent.trim()`;
  const chips = `[...document.querySelectorAll('.nova .nova-prompts .ds-chip')].map(c => c.innerText.trim())`;
  const lastReply = `[...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.querySelector('.ds-chat-msg-bubble')?.innerText ?? ''`;
  const HARDWARE_CHIPS = ['Power modes', 'Fan curve', 'Fan learning', 'Optimus', 'Overclocking'];
  const seed = (scope) => evalJs(send, `localStorage.setItem('mvpScope', '${scope}'); localStorage.setItem('board-seeded-dev-pc', '1'); localStorage.setItem('board-layout', ${JSON.stringify(BOARD)}); localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'instant' } })); true`);
  const sendNova = async (text) => {
    await evalJs(send, `document.querySelector('.nova-composer textarea')?.focus()`);
    await send('Input.insertText', { text });
    await sleep(150);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  };

  await seed('june27');
  await load(send, '#/', `document.querySelector('.wb-cell')`);
  let ids = await evalJs(send, cellIds);
  check('home · june: the Power Mode widget is not on the board', !ids.includes('power') && ids.includes('thermal') && ids.includes('fanspeed'), JSON.stringify(ids));
  const juneThermal = await menuOf('thermal');
  check('home · june: Thermal and Fan Speed keep their readings, without a Fan Control link', juneThermal.length > 0 && (await fanControlLinks()).length === 0, JSON.stringify(juneThermal));
  await evalJs(send, `document.querySelector('.wb-add')?.click()`);
  await waitFor(send, `document.querySelector('.wb-pick-row')`, 3000);
  const picker = await evalJs(send, `[...document.querySelectorAll('.wb-pick-row')].map(r => r.textContent.trim())`);
  check('home · june: Add a widget does not offer Power Mode', picker.length > 0 && !picker.some(t => /^Power Mode/.test(t)), JSON.stringify(picker));

  await load(send, '#/perform');
  check('perform · june: the subtitle names what is on the page', (await evalJs(send, subtitleText)) === 'Monitoring, optimizers and maintenance.', await evalJs(send, subtitleText));

  await load(send, '#/nova', `document.querySelector('.nova .nova-prompts')`);
  const juneChips = await evalJs(send, chips);
  check('nova · june: no chips for power modes, fans, graphics switching or overclocking', !HARDWARE_CHIPS.some(c => juneChips.includes(c)) && juneChips.includes('OMEN AI'), JSON.stringify(juneChips));
  await evalJs(send, `[...document.querySelectorAll('.nova .nova-prompts .ds-chip')].find(c => c.innerText.trim() === 'OMEN AI')?.click()`);
  await waitFor(send, `(${lastReply}).length > 40`, 4000);
  const aiReply = await evalJs(send, lastReply);
  check('nova · june: OMEN AI is told the deck\'s way, without power mode or fan curve', /held your frames back/.test(aiReply) && !/power mode|fan curve/i.test(aiReply), aiReply.slice(0, 160));
  await sendNova('switch my power mode');
  await waitFor(send, `/not in this version/.test(${lastReply})`, 4000);
  const pmReply = await evalJs(send, lastReply);
  check('nova · june: asking about power modes says they are not in this version, and where they are', /not in this version of Treehouse/.test(pmReply) && /OMEN Gaming Hub/.test(pmReply), pmReply.slice(0, 160));
  check('nova · june: and carries no power mode control', !(await evalJs(send, `!![...document.querySelectorAll('.nova .nova-log .ds-chat-msg.assistant')].pop()?.querySelector('[role="tablist"][aria-label="Power mode"]')`)));

  await seed('full');
  await load(send, '#/', `document.querySelector('.wb-cell')`);
  ids = await evalJs(send, cellIds);
  check('home · full: the Power Mode widget is back', ids.includes('power'), JSON.stringify(ids));
  const links27 = await fanControlLinks();
  check('home · full: and both Fan Control links', links27.length === 2, JSON.stringify(links27));
  await load(send, '#/perform');
  check('perform · full: the subtitle as it was', (await evalJs(send, subtitleText)) === 'Performance, power & thermal.', await evalJs(send, subtitleText));
  await load(send, '#/nova', `document.querySelector('.nova .nova-prompts')`);
  const chips27 = await evalJs(send, chips);
  check('nova · full: the hardware chips are back', HARDWARE_CHIPS.every(c => chips27.includes(c)), JSON.stringify(chips27));

  // ── A link carries the scope: ?scope=full (27c2) / ?scope=june27 ──────────────────
  // Before the hash or inside it. It stores the scope the way the Simulator row
  // does, then leaves the address, so a reload keeps it and a later switch in
  // the Simulator is not undone by the next reload. Anything else is ignored.
  const openUrl = async (path) => {
    await send('Page.navigate', { url: `http://localhost:${APP_PORT}${path}` });
    await waitFor(send, APP_READY);
    await waitFor(send, `document.querySelector('.pv5-root')`);
    await sleep(250);
  };
  const where = () => evalJs(send, `({ scope: localStorage.getItem('mvpScope'), search: location.search, hash: location.hash, anchor: document.querySelectorAll('.pv5-anchor').length })`);
  await evalJs(send, `localStorage.setItem('mvpScope', 'june27')`);
  await openUrl(`/?r=${++loadN}&scope=27c2#/perform`);
  let at = await where();
  check('link: ?scope=27c2 before the hash reads as full — the Power Mode card is there, stored as full', at.anchor === 1 && at.scope === 'full', JSON.stringify(at));
  check('link: and the parameter leaves the address, the rest of it stays', !/scope/.test(at.search) && /r=\d+/.test(at.search) && at.hash === '#/perform', JSON.stringify(at));
  await load(send, '#/perform');
  at = await where();
  check('link: a reload without it stays on full, as the Simulator row would', at.anchor === 1 && at.scope === 'full', JSON.stringify(at));
  await openUrl(`/?r=${++loadN}#/perform?x=1&scope=june27`);
  at = await where();
  check('link: ?scope=june27 inside the hash switches back — no Power Mode card', at.anchor === 0 && at.scope === 'june27', JSON.stringify(at));
  check('link: and leaves the hash with its other parameters', at.hash === '#/perform?x=1', JSON.stringify(at));
  await openUrl(`/?r=${++loadN}#/perform?scope=27c3`);
  at = await where();
  check('link: a value that is not a scope is ignored and left in the address', at.anchor === 0 && at.scope === 'june27' && /scope=27c3/.test(at.hash), JSON.stringify(at));

  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

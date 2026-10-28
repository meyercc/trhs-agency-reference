// CDP walkthrough for the OMEN power supply's editor, opened on its own from
// #/modal-lab and on the desktop's page: the eight readings and
// the warning levels the player sets (lcd-diy.14-16), the fan and the clean
// (lcd-diy.17-18, fan-cleaner.32-41), how the supply is found and when it has
// no link (lcd-diy.38). Run from web/.
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

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;
const OWN_KEYS = ['mvpScope', 'psuSettings'];
let loadN = 0;
async function load(send, hash = '#/modal-lab') {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}${hash}` });
  await waitFor(send, APP_READY);
}
const CANVAS = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  const spec = {};
  c.querySelectorAll('.ds-ng3-spec-row').forEach(row => {
    spec[row.querySelector('.ds-ng3-spec-key')?.textContent.trim()] = row.querySelector('.ds-ng3-spec-val')?.textContent.trim();
  });
  const read = {};
  const over = [];
  c.querySelectorAll('.pcp-reading').forEach(r => {
    const k = r.querySelector('.ds-spark-lbl')?.textContent.trim();
    read[k] = r.querySelector('.ds-spark-val')?.textContent.trim();
    if (r.classList.contains('is-over')) over.push(k);
  });
  return {
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map(b => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    chips: [...c.querySelectorAll('.dc-chip-val')].map(e => e.textContent.trim()),
    labels: [...c.querySelectorAll('.ds-ng3-label')].map(e => e.textContent.trim()),
    badges: [...c.querySelectorAll('.ds-badge')].map(e => e.textContent.trim()),
    notify: c.querySelector('[aria-label="Notify me of status warnings"]') ? true : false,
    buttons: [...c.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean),
    text: c.textContent,
    spec, read, over,
  };
})()`;
const clickTab = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)})?.click()`);
const clickButton = (send, text) =>
  evalJs(send, `[...document.querySelectorAll('.dc-canvas button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
const clickLabel = (send, label) =>
  evalJs(send, `document.querySelector('.dc-canvas [aria-label=${JSON.stringify(label)}]')?.click()`);
const toggleFact = (send, label) =>
  evalJs(send, `document.querySelector('.mlab-facts [aria-label=${JSON.stringify(label)}]')?.click()`);
const openWindow = async (send) => {
  await evalJs(send, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open power supply window')?.click()`);
  return waitFor(send, `document.querySelector('.dc-canvas')`, 4000);
};
const closeWindow = async (send) => {
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await waitFor(send, `!document.querySelector('.dc-canvas')`);
};
const read = async (send) => { await sleep(150); return evalJs(send, CANVAS); };

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
  await load(send);

  // ── Reachable on its own, in the peripherals' frame ────────────────────────
  check('lab: the power supply plate is on #/modal-lab',
    await evalJs(send, `[...document.querySelectorAll('h2')].some(h => h.textContent.includes('Power supply window'))`));
  check('lab: the button opens the window', await openWindow(send));
  let c = await read(send);
  check('frame: Status, Fan and Settings, ending on Settings like every peripheral',
    JSON.stringify(c?.tabs) === JSON.stringify(['Status', 'Fan', 'Settings']), c?.tabs?.join('/'));
  check('frame: one connection chip, as a peripheral has', JSON.stringify(c?.chips) === JSON.stringify(['USB']), c?.chips?.join(' / '));
  check('frame: the notify switch sits in the panel header, on', c?.notify
    && await evalJs(send, `document.querySelector('.dc-canvas [aria-label="Notify me of status warnings"]')?.closest('.ds-ng3-panel') != null`));

  // ── First look: eight readings ───────────────────────────────────
  const keys = Object.keys(c?.read ?? {});
  check('status: eight readings — total power, efficiency, temperature, fan, and four rails (lcd-diy.14)',
    JSON.stringify(keys) === JSON.stringify(['Total power', 'Efficiency', 'Temperature', 'Fan speed', '12V', '5V', '3.3V', '5V Standby']), keys.join(', '));
  check('status: readings are there from the first look (lcd-diy.15)',
    /^\d+ W$/.test(c?.read['Total power'] ?? '') && /^\d+%$/.test(c?.read['Efficiency'] ?? '') && /A · [\d.]+ V$/.test(c?.read['12V'] ?? ''), JSON.stringify(c?.read));
  check('status: total power is never a 2 W or 4 W blip', parseInt(c?.read['Total power'] ?? '0', 10) >= 20);
  check('status: each reading draws its last minute',
    await evalJs(send, `[...document.querySelectorAll('.dc-canvas .pcp-reading .ds-spark-line')].length === 8`));
  check('status: the status is said in a word', c?.badges.includes('Good'), c?.badges.join(' / '));
  check('protection: the window says it is on and where to turn it off',
    c?.text.includes('Power protection is on') && c.text.includes('Advanced Tuning'));

  // ── Warning levels the player sets (OGH's overflow menu) ───────────────────
  const level12 = parseFloat(c?.read['12V']);
  await clickLabel(send, '12V options');
  check('menu: the 12V menu sets its current warning level',
    await waitFor(send, `document.querySelector('.pcp-menu-pop [aria-label="Current warning level, maximum"]')`, 2000));
  // Lower the level under the reading and apply: the rail turns red.
  await evalJs(send, `(() => {
    const input = document.querySelector('.pcp-menu-pop input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus(); set.call(input, '${Math.max(1, Math.floor(level12) - 2)}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.blur();
  })()`);
  await evalJs(send, `[...document.querySelectorAll('.pcp-menu-pop button')].find(b => b.textContent.trim() === 'Apply')?.click()`);
  c = await read(send);
  check('menu: Apply saves the level, and a rail over it is red with a mark (lcd-diy.16)',
    c?.over.includes('12V') && c.read['12V'].startsWith('⚠') && c.badges.includes('High current'),
    `${JSON.stringify(c?.over)} · ${c?.read['12V']} · ${JSON.stringify(await evalJs(send, `JSON.parse(localStorage.getItem('psuSettings')).warn`))}`);
  await clickLabel(send, '12V options');
  await waitFor(send, `document.querySelector('.pcp-menu-pop')`, 2000);
  await evalJs(send, `[...document.querySelectorAll('.pcp-menu-pop button')].find(b => b.textContent.trim() === 'Reset to default')?.click()`);
  c = await read(send);
  check('menu: Reset to default puts the level back and the warning goes',
    !c?.over.includes('12V') && await evalJs(send, `JSON.parse(localStorage.getItem('psuSettings')).warn['12v'] === 85`));
  await evalJs(send, `document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
  await clickLabel(send, 'Fan speed options');
  await waitFor(send, `document.querySelector('.pcp-menu-pop')`, 2000);
  await evalJs(send, `[...document.querySelectorAll('.pcp-menu-pop button')].find(b => b.textContent.trim() === 'Open fan control')?.click()`);
  c = await read(send);
  check('menu: the fan speed menu opens fan control', c?.title === 'Fan', c?.title);
  await clickTab(send, 'Status');

  await closeWindow(send);
  await toggleFact(send, 'Force high temperature');
  await openWindow(send);
  c = await read(send);
  check('warning: a high temperature is red with a mark, and the status says so',
    c?.over.includes('Temperature') && c.read['Temperature'].startsWith('⚠') && c.badges.includes('Running hot'), c?.read['Temperature']);
  await clickLabel(send, 'Notify me of status warnings');
  c = await read(send);
  check('notify: turned off, the window says warnings show here only',
    c?.text.includes('Warnings show here only') && await evalJs(send, `JSON.parse(localStorage.getItem('psuSettings')).notify === false`));
  await clickLabel(send, 'Notify me of status warnings');
  // Too warm to clean: OGH's dialog, without its temperature (fan-cleaner.40, .41).
  await clickTab(send, 'Fan');
  await sleep(200);
  await clickButton(send, 'Start fan clean');
  const dlg = await waitFor(send, `document.querySelector('.pcp-dialog')`, 2000)
    && await evalJs(send, `document.querySelector('.pcp-dialog')?.textContent ?? ''`);
  check('clean refused: a dialog says why, without naming a temperature, and the fan keeps its setting',
    !!dlg && dlg.includes('Unable to start fan cleaning') && !/\d+\s*°/.test(dlg)
      && !(await evalJs(send, `document.querySelector('.dc-canvas')?.textContent ?? ''`)).includes('The clean is running the fan'), dlg);
  await evalJs(send, `[...document.querySelectorAll('.pcp-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`);
  check('clean refused: Close shuts the dialog and leaves the window open',
    await waitFor(send, `!document.querySelector('.pcp-dialog') && document.querySelector('.dc-canvas')`, 2000));
  await clickTab(send, 'Status');
  await closeWindow(send);
  await toggleFact(send, 'Force high temperature');

  // ── Fan: Max / Auto / Manual, reset, clean ─────────────────────────────────
  await openWindow(send);
  await clickTab(send, 'Fan');
  c = await read(send);
  check('fan: three modes, Auto first chosen, with Enable 0 RPM on (GSW-19748)',
    c?.buttons.includes('Max') && c.buttons.includes('Auto') && c.buttons.includes('Manual') && !c.buttons.includes('Curve')
      && await evalJs(send, `document.querySelector('.dc-canvas [aria-label="Enable 0 RPM"]')?.checked === true`));
  check('fan: Auto only shows the speed', /RPM$/.test(c?.spec['Speed'] ?? '') && !c.text.includes('Dynamic fan curve'), c?.spec['Speed']);
  check('fan: automatic cleaning is off by default (fan-cleaner.32)',
    await evalJs(send, `document.querySelector('.dc-canvas [aria-label="Enable automatic fan cleaning"]')?.checked === false`));
  await clickButton(send, 'Manual');
  c = await read(send);
  check('fan: Manual sets a speed', /Speed \([\d,]+ RPM\)/.test(c?.text ?? ''));
  await clickLabel(send, 'Dynamic fan curve');
  c = await read(send);
  check('fan: Dynamic fan curve swaps the speed for a curve',
    c?.labels.includes('Fan curve') && !/Speed \([\d,]+ RPM\)/.test(c.text));
  await clickButton(send, 'Reset to default');
  c = await read(send);
  check('fan: Reset to default puts it back to Auto', /RPM$/.test(c?.spec['Speed'] ?? '') && !c.labels.includes('Fan curve'));
  await clickButton(send, 'Start fan clean');
  await sleep(300);
  c = await read(send);
  check('fan: a clean says it is driving the fan', c?.text.includes('The clean is running the fan'));
  await clickTab(send, 'Status');
  c = await read(send);
  check('status: the fan reads the clean while it runs', c?.read['Fan speed'] === 'Cleaning', c?.read['Fan speed']);
  await sleep(3300);
  await closeWindow(send);

  // ── Settings: the device card ─────────────────────────────────────────────
  await openWindow(send);
  await clickTab(send, 'Settings');
  c = await read(send);
  check('settings: the device card, with how the supply was found and its specs (lcd-diy.38)',
    c?.spec['Maker'] === 'Great Wall' && c.spec['Link'] === 'USB' && c.spec['Wattage'] === '1,200 W', JSON.stringify(c?.spec));
  await closeWindow(send);

  // ── AMD, second maker, no USB ─────────────────────────────────────────────
  await toggleFact(send, 'AMD host');
  await toggleFact(send, 'Second maker');
  await openWindow(send);
  await clickTab(send, 'Fan');
  c = await read(send);
  check('AMD: the manual clean stays, the automatic option is gone (fan-cleaner.33)',
    c?.buttons.includes('Start fan clean') && !c.text.includes('Enable automatic fan cleaning'));
  await clickTab(send, 'Settings');
  c = await read(send);
  check('second maker: found and read the same way (lcd-diy.38)', c?.spec['Maker'] === 'Seasonic', JSON.stringify(c?.spec));
  await closeWindow(send);
  await toggleFact(send, 'Has a USB link');
  await openWindow(send);
  c = await read(send);
  check('no USB: no readings, said in words, a neutral badge, and the chip says so',
    c?.badges.includes('No readings') && c.text.includes('no link to read') && Object.keys(c.read).length === 0 && c.chips.includes('No link'));
  await clickTab(send, 'Fan');
  c = await read(send);
  check('no USB: the fan cannot be set, and the window says why', c?.text.includes('cannot be set') && !c.buttons.includes('Start fan clean'));
  await closeWindow(send);
  await toggleFact(send, 'Has a USB link');
  await toggleFact(send, 'AMD host');
  await toggleFact(send, 'Second maker');

  // ── The same editor on the desktop's page ──────────────────────────────────
  await load(send, '#/?sku=forge-45l&tab=psu');
  await waitFor(send, `document.querySelector('.dc-canvas .pcp-editor')`, 5000);
  c = await read(send);
  check('desktop: the Power Supply tab holds the same editor, readings and all',
    // No switch beside the tab's title: the notify setting is the supply's
    // own window's (JY, 2026-10-21); the Status / Fan switch is the control.
    c?.title === 'Power supply' && Object.keys(c.read).length === 8 && !c.notify, `${c?.title} · ${Object.keys(c?.read ?? {}).length}`);
  // The switch sits at the right end of the panel's title row, not in the body.
  check('desktop: the Status / Fan switch is in the panel\'s head, beside the title',
    await evalJs(send, `!!document.querySelector('.dc-canvas .ds-ng3-header [aria-label="Power supply view"]') && !document.querySelector('.dc-canvas .pcp-editor [aria-label="Power supply view"]')`));
  await evalJs(send, `[...document.querySelectorAll('.dc-canvas [aria-label="Power supply view"] button')].find(b => b.textContent.trim() === 'Fan')?.click()`);
  c = await read(send);
  check('desktop: its Fan switch shows the same fan control', c?.buttons.includes('Start fan clean') && c.buttons.includes('Manual'));

  // ── Same window from the part's address ───────────────────────────────────
  await load(send, '#/?sku=forge-45l-psu');
  check('one window: the address opens the same one', await waitFor(send, `document.querySelector('.dc-canvas .pcp-reading')`, 4000));

  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

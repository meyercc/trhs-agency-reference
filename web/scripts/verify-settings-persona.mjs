// One-off CDP walkthrough for the SettingsModal "Setup" group (redo setup +
// persona re-pick). Run from web/ with dev server on :5175 and headless Chrome
// on :9222. Safe to delete after the feature lands.
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

async function waitFor(send, sel, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalJs(send, `!!document.querySelector(${JSON.stringify(sel)})`)) return true;
    await sleep(200);
  }
  return false;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  await send('Page.navigate', { url: 'http://localhost:5175/#/?modal=settings' });
  await sleep(1200);
  check('settings modal opens', await waitFor(send, '.settings-modal'));

  // Sectioned modal: left nav (shared .ds-modal-nav) with the three sections,
  // Appearance first — theme/accent/wallpaper migrated from Personalize.
  const navItems = await evalJs(send, `
    [...document.querySelectorAll('.settings-modal .ds-modal-nav-item')].map(b => b.textContent.trim())
  `);
  check('nav sections', JSON.stringify(navItems) === JSON.stringify(['Appearance', 'Navigation', 'Setup']), navItems.join('/'));
  const appearance = await evalJs(send, `({
    theme: [...document.querySelectorAll('.settings-modal .ds-settings-row-label')].some(e => e.textContent.trim() === 'Theme'),
    swatches: document.querySelectorAll('.settings-modal .wg-swatch').length,
    wallpapers: document.querySelectorAll('.settings-modal .wp-thumb').length,
  })`);
  check('appearance default: theme + accent + wallpaper',
    appearance?.theme === true && appearance?.swatches === 7 && appearance?.wallpapers > 0,
    JSON.stringify(appearance));

  // Setup section: both rows
  await evalJs(send, `[...document.querySelectorAll('.settings-modal .ds-modal-nav-item')].find(b => b.textContent.trim() === 'Setup').click()`);
  await sleep(250);
  const rows = await evalJs(send, `
    [...document.querySelectorAll('.settings-modal .ds-settings-row-label')].map(e => e.textContent.trim())
  `);
  check('Experience Style row', rows.includes('Experience Style'), rows.join(', '));
  check('Redo Setup row', rows.includes('Redo Setup'));

  // Persona group has the 3 options; click "Hands-on" → Settings.persona = tinkerer
  await evalJs(send, `localStorage.removeItem('persona')`);
  const opts = await evalJs(send, `
    [...document.querySelectorAll('.settings-modal .ds-toggle-group-btn')].map(b => b.textContent.trim())
  `);
  check('3 persona options', JSON.stringify(opts) === JSON.stringify(['Guided', 'Hands-on', 'Minimal']), opts.join('/'));

  await evalJs(send, `
    [...document.querySelectorAll('.settings-modal .ds-toggle-group-btn')].find(b => b.textContent.trim() === 'Hands-on').click()
  `);
  await sleep(300);
  const persona = await evalJs(send, `localStorage.getItem('persona')`);
  check('click Hands-on → persona=tinkerer', persona === 'tinkerer' || persona === '"tinkerer"', String(persona));
  const active = await evalJs(send, `
    document.querySelector('.settings-modal .ds-toggle-group-btn.active')?.textContent.trim()
  `);
  check('Hands-on shows active', active === 'Hands-on', String(active));
  const blurb = await evalJs(send, `
    [...document.querySelectorAll('.settings-modal .ds-settings-row')].find(r => r.textContent.includes('Experience Style'))?.querySelector('.ds-settings-row-sublabel')?.textContent
  `);
  check('sublabel reflects tinkerer', /Manual controls/.test(blurb || ''), String(blurb));

  // Switch to Guided → learner
  await evalJs(send, `
    [...document.querySelectorAll('.settings-modal .ds-toggle-group-btn')].find(b => b.textContent.trim() === 'Guided').click()
  `);
  await sleep(300);
  const persona2 = await evalJs(send, `localStorage.getItem('persona')`);
  check('click Guided → persona=learner', /learner/.test(String(persona2)), String(persona2));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/settings-setup-group.png`, Buffer.from(shot.data, 'base64'));

  // Redo setup → navigates to #/onboarding, modal gone, onboarding renders
  await evalJs(send, `
    [...document.querySelectorAll('.settings-modal button')].find(b => b.textContent.trim() === 'Redo setup').click()
  `);
  await sleep(600);
  const hash = await evalJs(send, `location.hash`);
  check('Redo setup → #/onboarding', hash.startsWith('#/onboarding'), hash);
  check('onboarding welcome renders', await waitFor(send, '.onb .onb-h1'));
  check('settings modal closed', !(await evalJs(send, `!!document.querySelector('.settings-modal')`)));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/settings-redo-onboarding.png`, Buffer.from(shot.data, 'base64'));

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

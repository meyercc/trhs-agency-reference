// One-off CDP walkthrough for the persona-differentiated Power & Thermal
// surface (TH-324). Dev server on :5175, headless Chrome on :9222, run from web/.
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

// Snapshot of the Power & Thermal section as rendered.
const SNAPSHOT = `(() => {
  const sec = [...document.querySelectorAll('.rs-section')].find(s => s.textContent.includes('Power & Thermal'));
  if (!sec) return null;
  const cards = [...sec.querySelectorAll('.ds-feature-card')];
  return {
    cardTitles: cards.map(c => c.querySelector('.ds-feature-card-title')?.childNodes[0]?.textContent.trim()),
    modes: [...sec.querySelectorAll('.power-mode-btn .power-mode-label')].map(e => e.textContent.trim()),
    activeMode: sec.querySelector('.power-mode-btn.active .power-mode-label')?.textContent.trim() ?? null,
    autoNote: sec.querySelector('.power-auto-note')?.textContent ?? null,
    fanBadge: cards.find(c => c.textContent.includes('Fan Control'))?.querySelector('.ds-badge, [class*=badge]')?.textContent.trim() ?? null,
  };
})()`;

// A hash-only change doesn't reload the SPA, so bust with a unique search
// param — the React providers must re-read localStorage on every case.
let loadN = 0;
async function loadPerform(send, { persona, modules, modal } = {}) {
  await evalJs(send, `
    localStorage.removeItem('persona');
    localStorage.removeItem('trhs-modules');
    localStorage.removeItem('perform-sections');
    ${persona ? `localStorage.setItem('persona', ${JSON.stringify(persona)});` : ''}
    ${modules ? `localStorage.setItem('trhs-modules', ${JSON.stringify(JSON.stringify(modules))});` : ''}
  `);
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/perform${modal ? '?modal=' + modal : ''}` });
  await sleep(1100);
  return evalJs(send, SNAPSHOT);
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

  // 1. No persona (pre-onboarding) → unchanged full manual surface
  let s = await loadPerform(send, {});
  check('no persona: 4 cards', s?.cardTitles.length === 4, s?.cardTitles.join(', '));
  check('no persona: 3 modes, no Auto', s?.modes.length === 3 && !s.modes.includes('Auto'), s?.modes.join('/'));

  // 2. Learner → Auto mode present + default, note shown, UV/OC hidden, fan badge Auto
  s = await loadPerform(send, { persona: 'learner' });
  check('learner: Power+Fan only', JSON.stringify(s?.cardTitles) === JSON.stringify(['Power Mode', 'Fan Control']), s?.cardTitles.join(', '));
  check('learner: Auto mode offered', s?.modes[0] === 'Auto', s?.modes.join('/'));
  check('learner: Auto is default', s?.activeMode === 'Auto', String(s?.activeMode));
  check('learner: gentle note shown', /OMEN AI balances/.test(s?.autoNote || ''), String(s?.autoNote));
  check('learner: fan badge Auto', s?.fanBadge === 'Auto', String(s?.fanBadge));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/perform-learner.png`, Buffer.from(shot.data, 'base64'));

  // 2b. Learner takes over: click Performance → note gone, fan badge Custom
  await evalJs(send, `[...document.querySelectorAll('.power-mode-btn')].find(b => b.textContent.includes('Performance')).click()`);
  await sleep(300);
  s = await evalJs(send, SNAPSHOT);
  check('learner takeover: Performance active', s?.activeMode === 'Performance', String(s?.activeMode));
  check('learner takeover: note gone', s?.autoNote === null);
  check('learner takeover: fan badge Custom', s?.fanBadge === 'Custom', String(s?.fanBadge));

  // 3. Learner without the OMEN AI module → no Auto branding at all
  s = await loadPerform(send, { persona: 'learner', modules: { omenai: false } });
  check('learner w/o omenai: no Auto', !s?.modes.includes('Auto') && s?.activeMode === 'Performance', s?.modes.join('/'));
  check('learner w/o omenai: still no UV/OC', s?.cardTitles.length === 2, s?.cardTitles.join(', '));

  // 4. Minimalist → presets card only
  s = await loadPerform(send, { persona: 'minimalist' });
  check('minimalist: Power Mode only', JSON.stringify(s?.cardTitles) === JSON.stringify(['Power Mode']), s?.cardTitles.join(', '));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/perform-minimalist.png`, Buffer.from(shot.data, 'base64'));

  // 5. Tinkerer → full manual surface, no Auto
  s = await loadPerform(send, { persona: 'tinkerer' });
  check('tinkerer: 4 cards', s?.cardTitles.length === 4, s?.cardTitles.join(', '));
  check('tinkerer: no Auto', !s?.modes.includes('Auto'), s?.modes.join('/'));

  // 6. Live flip via the Settings pills on top of #/perform. The sectioned
  // settings modal opens on Appearance — the persona pills live under Setup.
  await loadPerform(send, { persona: 'tinkerer', modal: 'settings' });
  await evalJs(send, `[...document.querySelectorAll('.settings-modal .ds-modal-nav-item')].find(b => b.textContent.trim() === 'Setup').click()`);
  await sleep(250);
  await evalJs(send, `[...document.querySelectorAll('.settings-modal .ds-toggle-group-btn')].find(b => b.textContent.trim() === 'Guided').click()`);
  await sleep(400);
  s = await evalJs(send, SNAPSHOT);
  check('live flip → Guided: Auto active behind modal', s?.activeMode === 'Auto' && s?.cardTitles.length === 2, `${s?.activeMode}, ${s?.cardTitles.length} cards`);
  await evalJs(send, `[...document.querySelectorAll('.settings-modal .ds-toggle-group-btn')].find(b => b.textContent.trim() === 'Hands-on').click()`);
  await sleep(800);
  s = await evalJs(send, SNAPSHOT);
  check('live flip → Hands-on: manual surface back', s?.activeMode === 'Performance' && s?.cardTitles.length === 4, `${s?.activeMode}, ${s?.cardTitles.length} cards`);

  await evalJs(send, `localStorage.removeItem('persona'); localStorage.removeItem('trhs-modules'); localStorage.removeItem('perform-sections');`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

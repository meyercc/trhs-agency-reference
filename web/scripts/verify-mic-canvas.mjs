// CDP walkthrough for the MicCanvas (NG3 microphone modal).
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
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
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
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

  // Device settings are profile-backed and persist (TH-387), and this suite picks
  // Stereo below. Without a clean slate the default-state checks read the PREVIOUS
  // run's pick instead of the real default, so the suite passes once and then fails
  // on every re-run in the same browser.
  await open(send, 'quadcast-2-s');
  await evalJs(send, `localStorage.removeItem('trhs-profiles'), true`);

  // ── quadcast-2-s: full feature set ──
  let s = await open(send, 'quadcast-2-s');
  check('q2s: 4 tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Effects', 'Lights', 'Settings']), s?.tabs.join('/'));
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
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Lights').click()`);
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

  // ── solocast-2-pro: the ring mic (TH-408). Audio is the FlipCast panel with
  // the Microphone Test over the hero; Lights is the standard keyboard panel
  // painting nine lights behind the photo, kept by the profile. ──
  await evalJs(send, `localStorage.removeItem('trhs-profiles'), true`);
  s = await open(send, 'solocast-2-pro');
  check('sc2p: 3 tabs — Audio, Lights, Settings', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Lights', 'Settings']), s?.tabs.join('/'));
  check('sc2p: no pattern list for a single-pattern mic', s?.patterns.length === 0);
  check('sc2p audio: gain, headphone volume, mix, input EQ and effects',
    s?.hasGain && ['Mic Gain', 'Headphone Volume', 'Mic Monitoring / Playback Mix', 'Input Equalizer', 'Effects'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
  check('sc2p audio: the three effects as checkboxes', (await evalJs(send, `document.querySelectorAll('.mic-fx-list .ds-checkbox').length`)) === 3);
  check('sc2p audio: Microphone Test sits over the hero', /Microphone Test/.test(await evalJs(send, `document.querySelector('.mic-hero-cta button')?.textContent || ''`)));
  await evalJs(send, `document.querySelector('.mic-hero-cta button').click()`);
  check('sc2p audio: the test is a pressed state that reads Stop Test', await evalJs(send, `(() => { const b = document.querySelector('.mic-hero-cta button'); return b.getAttribute('aria-pressed') === 'true' && /Stop Test/.test(b.textContent); })()`));
  check('sc2p: the ring is unpainted on a fresh profile', await evalJs(send, `[...document.querySelectorAll('.mic-ring-light')].every(e => !e.style.getPropertyValue('--rgb') || e.style.getPropertyValue('--rgb') === 'transparent')`));
  check('sc2p: fits', s?.fits === true);

  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Lights').click()`);
  await sleep(300);
  check('sc2p lights: the Microphone Test leaves with the Audio tab', !(await evalJs(send, `!!document.querySelector('.mic-hero-cta')`)));
  check('sc2p lights: the standard panel — presets grid and brightness rail', await evalJs(send, `!!document.querySelector('.pdm-presets-grid') && !!document.querySelector('.pdm-bright')`));
  check('sc2p lights: nine pick targets on the photo, none selected', await evalJs(send, `(() => { const p = document.querySelectorAll('.mic-light-pick'); return p.length === 9 && [...p].every(b => b.getAttribute('aria-checked') === 'false'); })()`));
  await evalJs(send, `document.querySelectorAll('.pdm-preset-pick')[2]?.click()`);
  await sleep(300);
  const ringRgb = await evalJs(send, `[...document.querySelectorAll('.mic-ring-light')].map(e => e.style.getPropertyValue('--rgb'))`);
  check('sc2p lights: picking a preset lights all nine', ringRgb.length === 9 && ringRgb.every((c) => /^rgb\(/.test(c)) && new Set(ringRgb).size === 1, ringRgb[0]);
  check('sc2p lights: and the bloom appears behind the photo', await evalJs(send, `!!document.querySelector('.mic-ring-bloom')`));
  await evalJs(send, `document.querySelectorAll('.mic-light-pick')[3].click()`);
  check('sc2p lights: clicking a light selects it (aria-checked + drawn border)', await evalJs(send, `(() => { const b = document.querySelectorAll('.mic-light-pick')[3]; return b.getAttribute('aria-checked') === 'true' && b.classList.contains('selected') && getComputedStyle(b).borderTopColor !== 'rgba(0, 0, 0, 0)'; })()`));
  const bag = await evalJs(send, `(() => { const st = JSON.parse(localStorage.getItem('trhs-profiles') || 'null'); const p = st?.profiles.find(x => x.id === st.activeId); return (p?.devices || {})['solocast-2-pro'] || {}; })()`);
  check('sc2p lights: the ring and the preset are in the profile', Object.keys(bag['lighting.lightColors'] || {}).length === 9 && typeof bag['lighting.preset'] === 'string', Object.keys(bag).join(', '));
  s = await open(send, 'solocast-2-pro', 'lighting');
  // Inside the evalJs template literal a regex needs `\\(` (the fifteenth session's gotcha).
  check('sc2p lights: the ring is still lit after a reload', await evalJs(send, `[...document.querySelectorAll('.mic-ring-light')].every(e => /^rgb\\(/.test(e.style.getPropertyValue('--rgb')))`));
  await evalJs(send, `document.querySelector('.ds-ng3-header [aria-label="Ring lighting power"]').click()`);
  await sleep(200);
  check('sc2p lights: the header toggle turns the ring off (level 0)', (await evalJs(send, `document.querySelector('.mic-fig').style.getPropertyValue('--ring-level')`)) === '0');
  await evalJs(send, `document.querySelector('.ds-ng3-header [aria-label="Ring lighting power"]').click()`);
  await sleep(200);

  // ── Marquee + per-light color (TH-409): drag across three lights, then a
  // preset lands on those three only. ──
  const pickRect = (i) => evalJs(send, `(() => { const r = document.querySelectorAll('.mic-light-pick')[${i}].getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });
  const before = await evalJs(send, `[...document.querySelectorAll('.mic-ring-light')].map(e => e.style.getPropertyValue('--rgb'))`);
  const p0 = await pickRect(0), p2 = await pickRect(2);
  // Start inside the first light and end inside the third: the lights abut
  // along the arc, so a box padded past them would take a neighbour too.
  await mouse('mouseMoved', p0.l + 2, p0.t + 2);
  await mouse('mousePressed', p0.l + 2, p0.t + 2, { clickCount: 1 });
  await mouse('mouseMoved', p0.l + 8, p0.t + 6);
  await mouse('mouseMoved', p2.r - 2, p2.b - 2);
  check('sc2p lights: dragging draws a marquee on the photo', await evalJs(send, `!!document.querySelector('.mic-marquee')`));
  await mouse('mouseReleased', p2.r - 2, p2.b - 2, { clickCount: 1 });
  await sleep(200);
  const selMask = await evalJs(send, `[...document.querySelectorAll('.mic-light-pick')].map(b => b.getAttribute('aria-checked') === 'true' ? 1 : 0).join('')`);
  check('sc2p lights: releasing selects the lights the box crossed, and only those', selMask === '111000000', selMask);
  await evalJs(send, `document.querySelectorAll('.pdm-preset-pick')[11]?.click()`);
  await sleep(300);
  const after = await evalJs(send, `[...document.querySelectorAll('.mic-ring-light')].map(e => e.style.getPropertyValue('--rgb'))`);
  check('sc2p lights: a preset now paints only the selected lights — the ring carries two colors',
    after.slice(0, 3).every((c) => c === after[0] && c !== before[0]) && after.slice(3).every((c, i) => c === before[i + 3]),
    `${after[0]} ×3 · ${after[3]} ×6`);
  check('sc2p lights: the lights sit on the photo, lit ones glowing', await evalJs(send, `(() => { const l = document.querySelectorAll('.mic-ring-light'); const img = document.querySelector('.mic-fig img'); return l.length === 9 && Number(getComputedStyle(l[0].parentElement).zIndex) > Number(getComputedStyle(img).zIndex) && l[0].classList.contains('lit') && getComputedStyle(l[0]).boxShadow !== 'none'; })()`));
  let shotSc = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mic-solocast-lights.png`, Buffer.from(shotSc.data, 'base64'));

  // ── Settings: the device card (Figma Device Settings 12065:12944) ──
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Settings').click()`);
  await sleep(300);
  const settingsText = await evalJs(send, `document.querySelector('.dc-canvas .ds-ng3-body').textContent.replace(/\\s+/g, ' ')`);
  check('sc2p settings: name, firmware, Device Manager, Get Support, the credit and the OS hand-off',
    ['SoloCast 2 Pro', 'Firmware Version', 'Device Manager', 'Get Support', 'Audio powered by', 'Windows Sound Devices'].every((t) => settingsText.includes(t)) && !/Mounting/.test(settingsText),
    settingsText.trim().slice(0, 120));
  check('sc2p settings: the hand-off sits on the card floor', await evalJs(send, `(() => { const h = document.querySelector('.dsc-handoff'); const card = h?.closest('.ds-ng3-section'); if (!h || !card) return false; const hr = h.getBoundingClientRect(), cr = card.getBoundingClientRect(); return cr.bottom - hr.bottom < 24; })()`));
  await evalJs(send, `localStorage.removeItem('trhs-profiles'), true`);

  // ── solocast-2: single pattern, no lighting ──
  s = await open(send, 'solocast-2');
  check('solocast-2: no Lighting tab', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Effects', 'Settings']), s?.tabs.join('/'));
  // A one-pattern mic has no pattern list to pick from (TH-408); the chip still names it.
  check('solocast-2: single pattern — no list, the chip says Cardioid', s?.patterns.length === 0 && s?.chips[1] === 'Cardioid', s?.chips.join('/'));
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

  // Leave the app as we found it — the pattern pick above is persisted state that
  // would otherwise poison this suite's next run and any suite reading profiles.
  await evalJs(send, `localStorage.removeItem('trhs-profiles'), true`);

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

// CDP walkthrough for the HeadsetCanvas (NG3 headset modal). Dev server on
// :5175, headless Chrome on :9222, run from web/.
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

// Poll until `expr` is truthy. Replaces fixed sleeps: under CPU contention (the
// parallel verify lane) a sleep that was "long enough" reads mid-render. An eval
// that throws (execution context torn down by a navigation) counts as not-yet.
async function waitFor(send, expr, timeoutMs = 8000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    try { if (await evalJs(send, `!!(${expr})`)) return true; } catch {}
    await sleep(100);
  }
  return false;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const SNAPSHOT = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  return {
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map(b => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    chips: [...c.querySelectorAll('.dc-chip-val')].map(e => e.textContent.trim()),
    sections: [...c.querySelectorAll('.ds-ng3-section .ds-ng3-label.strong')].map(e => e.textContent.trim()),
    eqRows: [...c.querySelectorAll('.hc-eq-list .ds-list-item')].length,
    eqSelected: c.querySelector('.hc-eq-list .ds-list-item.selected')?.textContent.trim() ?? null,
    eqLive: (() => { const el = c.querySelector('.hc-eq-list'); if (!el) return false; const cs = getComputedStyle(el); return cs.pointerEvents !== 'none' && cs.opacity === '1'; })(),
    fxLabels: [...c.querySelectorAll('.hc-fx-list .ds-checkbox-label')].map(e => e.textContent.trim()),
    hero: !!c.querySelector('.dc-hero img'),
  };
})()`;

let loadN = 0;
// The unique ?r= proves the new document committed (not the old one, which has
// the same selectors); then wait for the panel's own content.
const READY = (n) => `location.search.includes('r=${n}') && document.readyState === 'complete'
  && document.querySelector('.dc-canvas .ds-ng3-tool')
  && document.querySelector('.dc-canvas .ds-ng3-section .ds-ng3-label.strong')`;
async function open(send, skuId, tab) {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${skuId}${tab ? '&tab=' + tab : ''}` });
  await waitFor(send, READY(loadN));
  // This suite counts EQ rows, which include any preset the user made in the
  // Simple Equalizer. Seed our own empty list rather than inheriting whatever a
  // sibling suite left behind — a device-behavior suite must not depend on
  // another suite's leftovers (the TH-364 lesson, second time around).
  if (await evalJs(send, `localStorage.getItem('eqPresets') !== null`)) {
    await evalJs(send, `localStorage.removeItem('eqPresets'); 1`);
    await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${skuId}${tab ? '&tab=' + tab : ''}` });
    await waitFor(send, READY(loadN));
  }
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

  // ── cloud-iii-s: the all-defaults flagship ──
  let s = await open(send, 'cloud-iii-s');
  check('c3s: canvas renders + hero', !!s && s.hero);
  check('c3s: 3 tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Spatial Audio', 'Settings']), s?.tabs.join('/'));
  check('c3s: battery + wireless chips', JSON.stringify(s?.chips) === JSON.stringify(['28%', 'Wireless']), s?.chips.join('/'));
  check('c3s: Audio sections', JSON.stringify(s?.sections) === JSON.stringify(['Volume', 'Mic Volume', 'Audio Equalizer', 'Mic Presets', 'Mic Effects']), s?.sections.join(', '));
  check('c3s: 8 EQ rows (add + 7 presets)', s?.eqRows === 8, String(s?.eqRows));
  check('c3s: EQ off → list undimmed + operable', s?.eqLive === true);
  check('c3s: 3 mic effects', JSON.stringify(s?.fxLabels) === JSON.stringify(['AI Noise Reduction', 'Compressor', 'Limiter']), s?.fxLabels.join(', '));

  // Pick Gaming while EQ is still OFF (off gates the feature, not editing),
  // then enable EQ — the pick made while off sticks.
  await evalJs(send, `[...document.querySelectorAll('.hc-eq-list .ds-list-item')].find(r => r.textContent.includes('Gaming')).click()`);
  await waitFor(send, `/Gaming/.test(document.querySelector('.hc-eq-list .ds-list-item.selected')?.textContent ?? '')`);
  s = await evalJs(send, SNAPSHOT);
  check('c3s: preset pick works while off', /Gaming/.test(s?.eqSelected || ''), String(s?.eqSelected));
  const eqToggle = `[...document.querySelectorAll('.ds-ng3-row')].find(r => r.textContent.includes('Audio Equalizer')).querySelector('.ds-toggle')`;
  const eqWasOff = await evalJs(send, `${eqToggle}.classList.contains('off')`);
  await evalJs(send, `${eqToggle}.click()`);
  await waitFor(send, `${eqToggle}.classList.contains('off') !== ${eqWasOff}`);
  s = await evalJs(send, SNAPSHOT);
  check('c3s: EQ on → Gaming still selected', /Gaming/.test(s?.eqSelected || ''), String(s?.eqSelected));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/headset-audio.png`, Buffer.from(shot.data, 'base64'));

  // Mute toggles
  await evalJs(send, `document.querySelector('.dc-mute[aria-label="Mute"]').click()`);
  await waitFor(send, `document.querySelector('.dc-mute[aria-label="Unmute"]')`);
  const mutePressed = await evalJs(send, `document.querySelector('.dc-mute[aria-label="Unmute"]')?.getAttribute('aria-pressed')`);
  check('c3s: volume mute toggles', mutePressed === 'true', String(mutePressed));

  // Spatial + Settings tabs
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Spatial Audio').click()`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Spatial Audio' && document.querySelectorAll('.hc-node').length === 8`);
  s = await evalJs(send, SNAPSHOT);
  // TH-339: the "Spatial Audio" label moved into the panel HEADER (master
  // toggle beside it, like the keyboard's Lights); the body is the surround
  // stage (8 testable channel nodes) + the Experience/Distance parameters.
  check('c3s: Spatial tab — stage + parameters, master toggle in the header',
    s?.title === 'Spatial Audio'
    && s?.sections.includes('Experience') && s?.sections.includes('Distance')
    && (await evalJs(send, `!!document.querySelector('.ds-toggle[aria-label="Spatial audio power"]')
        && document.querySelectorAll('.hc-node').length === 8
        && !!document.querySelector('.hc-io')`)),
    `${s?.title}: ${s?.sections.join(', ')}`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/headset-spatial.png`, Buffer.from(shot.data, 'base64'));
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Settings').click()`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Settings' && document.querySelector('.dc-canvas .ds-ng3-section .ds-ng3-label.strong')`);
  s = await evalJs(send, SNAPSHOT);
  check('c3s: Settings tab', s?.title === 'Settings' && s?.sections.includes('Auto Power-Off') && s?.sections.includes('Notifications'), s?.sections.join(', '));

  // Deep link ?tab=spatial
  s = await open(send, 'cloud-iii-s', 'spatial');
  check('c3s: deep link ?tab=spatial', s?.title === 'Spatial Audio', String(s?.title));

  // ── cloud-iii: wired sibling — no battery, USB chip, but spatial like the S ──
  // Spatial audio is rendered on the PC, so being wired is no reason to lose it;
  // the SKU used to carry `spatial: false` and no longer does. Wired vs wireless
  // shows up in the power chip, not the tab list.
  s = await open(send, 'cloud-iii');
  check('c3 wired: tabs Audio/Spatial Audio/Settings',
    JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Spatial Audio', 'Settings']), s?.tabs.join('/'));
  check('c3 wired: USB chip, no battery', JSON.stringify(s?.chips) === JSON.stringify(['USB']), s?.chips.join('/'));
  check('c3 wired: full audio sections', s?.sections.includes('Audio Equalizer'), s?.sections.join(', '));
  // The tab is not just present — it's populated from the headset type defaults.
  s = await open(send, 'cloud-iii', 'spatial');
  s = await open(send, 'cloud-iii', 'settings');
  check('c3 wired settings: no Auto Power-Off (no battery to time out), own firmware',
    !s?.sections.includes('Auto Power-Off') && s?.sections.includes('Notifications')
    && (await evalJs(send, `document.querySelector('.dsc-fw')?.textContent.trim()`)) === 'Firmware Version 1.9.7',
    s?.sections.join(', '));

  s = await open(send, 'cloud-iii', 'spatial');
  check('c3 wired: spatial tab is fully populated, not an empty shell',
    s?.title === 'Spatial Audio'
    && s?.sections.includes('Experience') && s?.sections.includes('Distance')
    && (await evalJs(send, `document.querySelectorAll('.hc-node').length === 8
        && !!document.querySelector('.hc-io')`)),
    `${s?.title}: ${s?.sections.join(', ')}`);

  // ── Many presets: the list scrolls inside the panel and the panel does not
  // grow — its height is the Volume/Mic columns' (Figma Audio 8931:20990).
  // Nine-plus used to grow it past the bottom of the fixed canvas (TH-407). ──
  // Baseline on a fresh Audio-tab load (the checks above left the Spatial tab up).
  await open(send, 'cloud-iii-s');
  const panelH0 = await evalJs(send, `document.querySelector('.dc-panel-wrap').getBoundingClientRect().height`);
  await evalJs(send, `localStorage.setItem('eqPresets', JSON.stringify(Array.from({ length: 14 }, (_, i) => ({ kind: 'simple', id: 'seed-' + i, label: 'Seed ' + (i + 1), bands: 5, gains: [0, 0, 0, 0, 0] })))); 1`);
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=cloud-iii-s` });
  await waitFor(send, READY(loadN));
  const many = await evalJs(send, `(() => {
    const list = document.querySelector('.hc-eq-presets');
    const rows = document.querySelectorAll('.hc-eq-list .ds-list-item');
    const panel = document.querySelector('.dc-panel-wrap').getBoundingClientRect();
    const last = rows[rows.length - 1];
    last.scrollIntoView({ block: 'nearest' });
    const add = [...rows].find(r => /Add Equalizer Preset/.test(r.textContent)).getBoundingClientRect();
    const lr = last.getBoundingClientRect(), ll = list.getBoundingClientRect();
    // The constraint chain, outermost first: each box's height vs its content's.
    const chain = ['.dc-canvas', '.dc-panel-wrap', '.ds-ng3-panel', '.ds-ng3-body', '.hc-audio', '.hc-eq', '.hc-eq-list', '.hc-eq-presets']
      .map(sel => { const el = document.querySelector(sel); return el ? sel.slice(1) + ':' + el.clientHeight + '/' + el.scrollHeight : sel + ':none'; }).join(' ');
    return { rows: rows.length, scrolls: list.scrollHeight > list.clientHeight + 1, onScreen: panel.bottom <= window.innerHeight + 1,
      lastVisible: lr.bottom <= ll.bottom + 1 && lr.top >= ll.top - 1, addPinned: add.bottom <= ll.top + 1, panelH: panel.height, chain };
  })()`);
  check('c3s: 22 EQ rows with fourteen user presets', many?.rows === 22, String(many?.rows));
  check('c3s: the presets scroll and the panel stays on the canvas', !!many?.scrolls && !!many?.onScreen, JSON.stringify(many));
  check('c3s: fourteen more presets do not change the panel\'s height', Math.abs((many?.panelH ?? 0) - panelH0) <= 1, `${panelH0} → ${many?.panelH}`);
  check('c3s: the last preset can be scrolled into view, with "Add" pinned above the list', !!many?.lastVisible && !!many?.addPinned);
  if (process.env.HC_SHOT) {
    const { data } = await send('Page.captureScreenshot');
    (await import('node:fs')).writeFileSync(process.env.HC_SHOT, Buffer.from(data, 'base64'));
  }
  await evalJs(send, `localStorage.removeItem('eqPresets'); 1`);

  // ── cloud-ii-wireless: no EQ, no mic presets/effects ──
  s = await open(send, 'cloud-ii-wireless');
  check('c2w: no EQ / presets / effects', JSON.stringify(s?.sections) === JSON.stringify(['Volume', 'Mic Volume']), s?.sections.join(', '));
  check('c2w: spatial tab present', s?.tabs.includes('Spatial Audio'), s?.tabs.join('/'));
  check('c2w: battery chip 55%', s?.chips[0] === '55%', s?.chips.join('/'));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/headset-sparse.png`, Buffer.from(shot.data, 'base64'));

  // ── cloud-ii-core: minimal wired ──
  s = await open(send, 'cloud-ii-core');
  check('c2c: tabs Audio/Settings', JSON.stringify(s?.tabs) === JSON.stringify(['Audio', 'Settings']), s?.tabs.join('/'));
  check('c2c: volume + mic only', JSON.stringify(s?.sections) === JSON.stringify(['Volume', 'Mic Volume']), s?.sections.join(', '));

  // Esc closes
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(send, `!document.querySelector('.dc-canvas')`);
  check('Esc closes the canvas', !(await evalJs(send, `!!document.querySelector('.dc-canvas')`)));

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

// CDP walkthrough for the SpecCanvas (the generic long-tail device canvas that
// replaced DeviceModal + renderers.tsx) and the shared deviceTabs source.
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
  const spec = {};
  c.querySelectorAll('.ds-ng3-spec-row').forEach(row => {
    spec[row.querySelector('.ds-ng3-spec-key')?.textContent.trim()] =
      row.querySelector('.ds-ng3-spec-val')?.textContent.trim();
  });
  return {
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map(b => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    chips: [...c.querySelectorAll('.dc-chip-val')].map(e => e.textContent.trim()),
    labels: [...c.querySelectorAll('.ds-ng3-label')].map(e => e.textContent.trim()),
    spec,
    toggles: [...c.querySelectorAll('.ds-ng3-row')].map(row => {
      const t = row.querySelector('.ds-toggle');
      return t ? [row.querySelector('.ds-ng3-label')?.textContent.trim(), !t.classList.contains('off')] : null;
    }).filter(Boolean),
    tags: [...c.querySelectorAll('.sc-tags .ds-badge')].map(e => e.textContent.trim()),
    monoVals: [...c.querySelectorAll('.dc-mono-val')].map(e => e.textContent.trim()),
    sliders: c.querySelectorAll('.ds-slider, .ds-rail').length,
    dropdowns: c.querySelectorAll('.ds-dropdown').length,
    heroImg: !!c.querySelector('.dc-hero img'),
    heroGlyph: !!c.querySelector('.sc-hero-glyph'),
    // Nothing may overflow the viewport, and no legacy modal may render.
    fits: r ? r.bottom <= innerHeight + 1 : null,
    legacy: !!document.querySelector('.dm-body, .dm-tabs'),
  };
})()`;

/**
 * Poll until the app has actually rendered instead of sleeping a fixed amount.
 * A fixed sleep makes this suite flaky — a slow reload silently reports "tab
 * missing" rather than "not painted yet".
 */
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;

let loadN = 0;
async function open(send, sku, tab, expectCanvas = true) {
  // ?r=N busts the SPA cache — hash-only navigations don't reload React.
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await waitFor(send, APP_READY);
  if (expectCanvas) await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
  else await sleep(400); // let a canvas appear if it (wrongly) would
  return evalJs(send, SNAP);
}

const clickTab = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)}).click()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  // ── Webcam: spec rows + capability/preference toggles + gated AI tab ──
  let s = await open(send, 'omen-max-16-webcam');
  check('webcam: renders the NG3 canvas, not the legacy modal', !!s && s.legacy === false);
  check('webcam: Video + AI Effects tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Video', 'AI Effects']), s?.tabs.join('/'));
  check('webcam: type + parent chips', JSON.stringify(s?.chips) === JSON.stringify(['Webcam', 'Part of OMEN Max 16']), s?.chips.join('/'));
  check('webcam: spec rows resolution/FOV/IR', s?.spec['Resolution'] === '1080p' && s?.spec['Field of view'] === '88°' && s?.spec['IR sensor'] === 'Yes', JSON.stringify(s?.spec));
  check('webcam: privacy + hello toggles on', s?.toggles.length === 2 && s.toggles.every(([, on]) => on), JSON.stringify(s?.toggles));
  check('webcam: falls back to the parent system photo', s?.heroImg === true && s?.heroGlyph === false);
  check('webcam: fits the viewport', s?.fits === true);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/spec-webcam.png`, Buffer.from(shot.data, 'base64'));

  await clickTab(send, 'AI Effects');
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('webcam AI: 4 enhancement toggles', s?.toggles.length === 4 && s.toggles.every(([, on]) => on), JSON.stringify(s?.toggles.map(([l]) => l)));

  // ── Trackpad: range slider + the capability/preference split ──
  // `naturalScrolling: false` is a preference that defaults off, so it renders
  // switched off; `haptic: false` is absent hardware, so it doesn't render.
  s = await open(send, 'omen-max-16-trackpad');
  const scroll = s?.toggles.find(([l]) => l === 'Natural Scrolling');
  check('trackpad: Natural Scrolling renders OFF (preference, not absent)', !!scroll && scroll[1] === false, JSON.stringify(s?.toggles));
  check('trackpad: Pointer + Gestures tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Pointer', 'Gestures']), s?.tabs.join('/'));
  check('trackpad: pointer-speed slider starts at the SKU default (6)',
    s?.sliders > 0 && s?.labels.includes('Pointer Speed') && s?.monoVals[0] === '6',
    `slider=${s?.sliders} readout=${s?.monoVals.join('/')}`);
  check('trackpad (Max 16): Haptic Feedback shown — hardware has it', s?.toggles.some(([l]) => l === 'Haptic Feedback'), JSON.stringify(s?.toggles.map(([l]) => l)));

  s = await open(send, 'omen-transcend-14-trackpad');
  check('trackpad (Transcend 14): Haptic hidden — capability absent', !s?.toggles.some(([l]) => l === 'Haptic Feedback'), JSON.stringify(s?.toggles.map(([l]) => l)));

  s = await open(send, 'omen-max-16-trackpad', 'gestures');
  check('trackpad gestures: cap-formatted multi-finger rows', s?.spec['Three-finger'] === 'Mission Control, App Switch, Show Desktop', JSON.stringify(s?.spec));

  // ── Notebook I/O: port tags ──
  s = await open(send, 'omen-max-16-io');
  check('io: wireless spec + 6 port tags', s?.spec['Wi-Fi'] === 'Wi-Fi 7' && s?.tags.length === 6, `${s?.spec['Wi-Fi']} / ${s?.tags.length} tags`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/spec-io.png`, Buffer.from(shot.data, 'base64'));

  // ── Notebook audio ──
  s = await open(send, 'omen-max-16-audio');
  check('audio: Output + Mic tabs, speaker specs', JSON.stringify(s?.tabs) === JSON.stringify(['Output', 'Mic']) && s?.spec['Speakers'] === '4' && s?.spec['Peak power'] === '8 W', s?.tabs.join('/') + ' ' + JSON.stringify(s?.spec));
  check('audio: DTS:X reads Yes (boolean → Yes)', s?.spec['DTS:X'] === 'Yes', JSON.stringify(s?.spec));

  // ── Notebook display: three tabs, number units ──
  s = await open(send, 'omen-max-16-display');
  check('display: Display/Color/Comfort tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Display', 'Color', 'Comfort']), s?.tabs.join('/'));
  check('display: refresh rate carries its unit', s?.spec['Refresh rate'] === '240 Hz', JSON.stringify(s?.spec));
  await clickTab(send, 'Color');
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('display color: HDR toggle + 2 dropdowns + calibration', s?.toggles.some(([l]) => l === 'HDR') && s?.dropdowns === 2 && s?.spec['Delta E'] === '1 max', JSON.stringify(s?.spec));

  // ── GPU: overview + the shared zone-lighting tab ──
  s = await open(send, 'forge-45l-gpu');
  check('gpu: Overview + Lighting tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Overview', 'Lighting']), s?.tabs.join('/'));
  check('gpu: model/VRAM/TDP/length specs', s?.spec['Model'] === 'GeForce RTX 5090' && s?.spec['VRAM'] === '32 GB' && s?.spec['TDP'] === '600 W', JSON.stringify(s?.spec));
  check('gpu: 2 display-output tags', s?.tags.length === 2, s?.tags.join(', '));
  check('gpu: no photo → type glyph hero', s?.heroGlyph === true && s?.heroImg === false);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/spec-gpu.png`, Buffer.from(shot.data, 'base64'));

  await clickTab(send, 'Lighting');
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('gpu lighting: effect dropdown + zones + brightness', s?.dropdowns === 1 && s?.spec['Zones'] === '3' && s?.labels.includes('Brightness'), JSON.stringify(s?.spec));

  // ── Cooling: the `max`-shaped pump slider ──
  s = await open(send, 'forge-45l-cpu-cooling');
  check('cooling: radiator specs + pump slider', s?.spec['Radiator'] === '360 mm' && s?.labels.includes('Pump Speed') && s?.sliders > 0, JSON.stringify(s?.spec));
  check('cooling: pump starts at 60% of max (1,680 RPM)', s?.monoVals[0] === '1,680 RPM', s?.monoVals.join('/'));

  // ── RAM / PSU / lighting controller ──
  s = await open(send, 'forge-45l-ram');
  check('ram: capacity/speed specs + XMP toggle', s?.spec['Capacity'] === '64 GB' && s?.spec['Speed'] === '7,200 MT/s' && s?.toggles.some(([l]) => l === 'XMP Profile'), JSON.stringify(s?.spec));

  s = await open(send, 'forge-45l-psu');
  check('psu: single Overview tab, wattage + cap-formatted modular', JSON.stringify(s?.tabs) === JSON.stringify(['Overview']) && s?.spec['Wattage'] === '1,200 W' && s?.spec['Modular'] === 'Fully', JSON.stringify(s?.spec));

  s = await open(send, 'forge-45l-lighting');
  check('lighting controller: effect dropdown + channel specs', s?.dropdowns === 1 && s?.spec['ARGB zones'] === '12' && s?.spec['Ecosystem'] === 'OMEN Light Studio', JSON.stringify(s?.spec));

  // ── Parent systems ──
  s = await open(send, 'omen-max-16');
  check('notebook: System/Power/Connectivity tabs', JSON.stringify(s?.tabs) === JSON.stringify(['System', 'Power', 'Connectivity']), s?.tabs.join('/'));
  check('notebook: false capabilities are omitted (no Tobii on Max 16)', s?.spec['Overclocking'] === 'Yes' && s?.spec['Tobii eye tracking'] === undefined, JSON.stringify(s?.spec));
  check('notebook: battery capacity carries Wh', s?.spec['Capacity'] === '99 Wh', JSON.stringify(s?.spec));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/spec-notebook.png`, Buffer.from(shot.data, 'base64'));

  await clickTab(send, 'Power');
  await sleep(300);
  check('notebook power: {id,label} power modes populate the dropdown',
    await evalJs(send, `document.querySelector('.ds-dropdown-trigger')?.textContent.trim()`) === 'Eco');

  s = await open(send, 'desktop-does-not-exist', undefined, false);
  check('unknown sku: nothing renders', s === null);

  s = await open(send, 'forge-45l');
  check('desktop: Power + Connectivity tabs', JSON.stringify(s?.tabs) === JSON.stringify(['Power', 'Connectivity']), s?.tabs.join('/'));

  // ── deviceTabs is the single source: a board card's shortcut buttons must
  // be exactly the tabs its modal opens with (they used to come from the dead
  // renderers.tsx list, so a card could offer a tab the canvas never had). ──
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/` });
  await waitFor(send, APP_READY);
  await waitFor(send, `document.querySelector('.ds-devcard .dev-shortcut')`);
  const card = await evalJs(send, `(() => {
    const el = [...document.querySelectorAll('.ds-devcard')].find(c => c.querySelector('.dev-shortcut'));
    if (!el) return null;
    return {
      name: el.querySelector('.devw-title')?.textContent.trim(),
      shortcuts: [...el.querySelectorAll('.dev-shortcut')].map(b => b.getAttribute('title')),
    };
  })()`);
  check('board card renders shortcut buttons', !!card?.shortcuts.length, JSON.stringify(card));
  if (card?.shortcuts.length) {
    await evalJs(send, `[...document.querySelectorAll('.ds-devcard')].find(c => c.querySelector('.dev-shortcut')).querySelector('.dev-shortcut').click()`);
    await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
    s = await evalJs(send, SNAP);
    check('card shortcut opens the modal on that exact tab',
      s?.tabs?.[0] === card.shortcuts[0] && s?.title === card.shortcuts[0],
      `card=${card.shortcuts.join('/')} modal=${s?.tabs?.join('/')} open=${s?.title}`);
    // Rich cards (treehouse-32) drop tabs they already control inline (Rule A,
    // Cindy 2026-07-23), so shortcuts are an ordered SUBSET of the modal tabs
    // — still sourced from deviceTabs, so a shortcut can never point at a tab
    // the modal doesn't have.
    const isSubsetInOrder = (sub, full) => {
      let i = 0;
      for (const t of full ?? []) if (t === sub[i]) i++;
      return i === sub.length;
    };
    check('card shortcuts ⊆ the modal tab list (in order)',
      isSubsetInOrder(card.shortcuts, s?.tabs),
      `${JSON.stringify(card.shortcuts)} vs ${JSON.stringify(s?.tabs)}`);
  }

  // ── every connected device has a board card (keyboard + mic were missing) ──
  await evalJs(send, `localStorage.setItem('board-layout', JSON.stringify(
    ['dev-mouse','dev-keyboard','dev-headset','dev-monitor','dev-mic'].map(id => ({ id, span: 3, rows: 2 }))))`);
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/` });
  await waitFor(send, APP_READY);
  await waitFor(send, `document.querySelectorAll('.ds-devcard').length >= 5`);
  const cards = await evalJs(send, `[...document.querySelectorAll('.ds-devcard')].map(c => ({
    name: c.querySelector('.devw-title')?.textContent.trim(),
    sub: c.querySelector('.devw-sub')?.textContent.trim(),
    shortcuts: [...c.querySelectorAll('.dev-shortcut')].map(b => b.getAttribute('title')),
  }))`);
  check('all five connected devices have a board card',
    cards?.length === 5 && cards.every((c) => c.name && c.shortcuts.length),
    cards?.map((c) => c.name).join(' · '));
  check('keyboard card shortcuts match the KeyboardCanvas tabs',
    JSON.stringify(cards?.find((c) => c.sub === 'Keyboard')?.shortcuts) === JSON.stringify(['Lights', 'Keys & Macros', 'Settings']),
    JSON.stringify(cards?.find((c) => c.sub === 'Keyboard')?.shortcuts));
  check('mic card shortcuts match the MicCanvas tabs',
    JSON.stringify(cards?.find((c) => c.sub === 'Microphone')?.shortcuts) === JSON.stringify(['Audio', 'Effects', 'Lighting', 'Settings']),
    JSON.stringify(cards?.find((c) => c.sub === 'Microphone')?.shortcuts));
  await evalJs(send, `localStorage.removeItem('board-layout')`);

  // Esc closes the canvas
  await open(send, 'forge-45l-gpu');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);
  check('Esc closes the canvas', !(await evalJs(send, `!!document.querySelector('.dc-canvas')`)));

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

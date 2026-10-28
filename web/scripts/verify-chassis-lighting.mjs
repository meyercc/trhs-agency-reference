// CDP walkthrough for the desktop's lighting (OpenGSW lighting, lighting-family):
// the PC's zones in the peripherals' Lights layout (JY, 2026-10-21) — the
// brightness rail, the zones with All (Fans, each fan under it, Memory, the
// graphics card), and the preset library and editor the keyboard and mouse use.
// A preset goes to the selected zones; a fan can wear its own over the fans';
// the LEDs follow (the model, bundled from the app's own source); the machine's
// parts come from what the lighting board found; the LIGHTS switch is the one
// Off; the door from This PC opens the PC's page on its Chassis lighting tab.
// Reset to default is behind the gear at the top right of the panel's header
// (LightingGear), on the Chassis lighting tab only.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
};
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}
const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;
// The keys this suite reads or writes, cleared so a run starts from defaults.
// The tower's looks live in the profile's desk lighting and are reset in-app.
const OWN_KEYS = ['chassisMachine', 'fanKit', 'thisPc', 'lightPresets'];
let loadN = 0;
async function load(send, hash = '#/') {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}${hash}` });
  await waitFor(send, APP_READY);
}

// ── Readers for the editor ────────────────────────────────────────────────
const EDITOR = `document.querySelector('.dc-canvas .cl')`;
const openPanel = async (send) => {
  await evalJs(send, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Open the desktop's Lights")?.click()`);
  return waitFor(send, EDITOR, 8000);
};
/** The zone rows: id, label, what they wear, picked. */
const ZONES = `[...document.querySelectorAll('.dc-canvas .pcz-zone')].map(z => ({ id: z.dataset.zone, label: z.querySelector('.ds-list-item-label')?.textContent.trim() ?? z.textContent.trim(), wears: z.querySelector('.ds-list-item-description')?.textContent.trim() ?? '', on: z.getAttribute('aria-selected') === 'true' }))`;
const zones = (send) => evalJs(send, ZONES);
const zoneRow = async (send, id) => (await zones(send)).find((z) => z.id === id);
const pickZone = (send, id) => evalJs(send, `document.querySelector('.dc-canvas .pcz-zone[data-zone=${JSON.stringify(id)}]')?.click()`);
/** The preset grid: names, and the one highlighted. */
const presetNames = (send) => evalJs(send, `[...document.querySelectorAll('.dc-canvas .pdm-preset')].map(p => p.querySelector('.pdm-preset-pick span:last-child')?.textContent.trim())`);
const activePreset = (send) => evalJs(send, `document.querySelector('.dc-canvas .pdm-preset.active .pdm-preset-pick span:last-child')?.textContent.trim() ?? null`);
const pickPreset = async (send, name) => {
  await evalJs(send, `[...document.querySelectorAll('.dc-canvas .pdm-preset-pick')].find(b => b.querySelector('span:last-child')?.textContent.trim() === ${JSON.stringify(name)})?.click()`);
  await sleep(250);
};
const clickText = (send, text, scope = '.dc-canvas') =>
  evalJs(send, `[...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
const GEAR = `document.querySelector('.dc-canvas .ds-ng3-actions [aria-label="Lighting settings"]')`;
const gearOpen = (send) => evalJs(send, `!!document.querySelector('.dc-canvas .lg-pop')`);
/** A real Escape, from the keyboard: it goes to the focused element, as a person's does. */
const pressEscape = async (send) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(250);
};
/** Reset to default is behind the gear: open it, press it, put the popover away. */
const resetViaGear = async (send) => {
  if (!(await gearOpen(send))) {
    await evalJs(send, `${GEAR}.click()`);
    await sleep(250);
  }
  await clickText(send, 'Reset to default', '.dc-canvas .lg-pop');
  await sleep(300);
  await pressEscape(send);
};
const lights = (send) => evalJs(send, `document.querySelector('.dc-canvas [aria-label="PC lighting power"]')?.click()`);

async function main() {
  // ── The model, from the app's own source ──────────────────────────────
  console.log('\nModel');
  const dir = mkdtempSync(join(tmpdir(), 'trhs-cl-'));
  const out = join(dir, 'towerZones.mjs');
  await build({ entryPoints: ['src/lightstudio/towerZones.ts'], outfile: out, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
  const M = await import(out);
  rmSync(dir, { recursive: true, force: true });
  const solid = (hex, name = 'Solid') => ({ presetId: 'x', name, layers: [{ fx: 'solid', colors: [hex], angle: 0, speed: 50, opacity: 100 }] });
  const rgb = (led) => led.rgb.map(Math.round).join(',');
  {
    const s = M.startingLighting();
    check('starts on, full brightness, the fans in a wave and the memory and card in a rainbow (lighting.4, .5)',
      s.on && s.brightness === 100 && s.zones.fans?.name === 'Wave' && s.zones.memory?.name === 'Rainbow Wave' && s.zones.gpu?.name === 'Rainbow Wave', JSON.stringify(Object.fromEntries(Object.entries(s.zones).map(([k, v]) => [k, v?.name]))));
    check('a tower with no panel state wears the desk look; an earlier build\'s modes start over',
      !M.panelDrives({}) && M.chassisOf({}).zones.fans?.name === 'Wave' && M.chassisOf({ chassis: { mode: 'custom', parts: {} } }).zones.fans?.name === 'Wave');
    const c = { ...s, zones: { ...s.zones, fans: solid('#0a84ff') } };
    check('a solid preset colours every fan LED, in step (lighting.10)',
      rgb(M.ledAt(c, 'fans', 0, 12, 0, 'board-1')) === '10,132,255' && rgb(M.ledAt(c, 'fans', 7, 12, 3, 'board-5')) === '10,132,255' && M.ledAt(c, 'fans', 0, 12, 0, 'board-1').a === 1);
    const one = { ...c, zones: { ...c.zones, 'board-2': solid('#30d158') } };
    check('a fan\'s own look wins over the fans\' (the other fans keep theirs)',
      rgb(M.ledAt(one, 'fans', 0, 12, 0, 'board-2')) === '48,209,88' && rgb(M.ledAt(one, 'fans', 0, 12, 0, 'board-1')) === '10,132,255');
    check('LIGHTS off leaves every LED dark and keeps the looks', M.ledAt({ ...c, on: false }, 'fans', 0, 12, 0, 'board-1').a === 0 && M.chassisOf({ chassis: { ...c, on: false } }).zones.fans.name === 'Solid');
    check('zero brightness leaves the LEDs off (light-studio.21)', M.ledAt({ ...c, brightness: 0 }, 'fans', 0, 12, 0, 'board-1').a === 0);
    check('black leaves the LEDs off (lighting-family.8)', M.ledAt({ ...c, zones: { ...c.zones, fans: solid('#000000') } }, 'fans', 0, 12, 0, 'board-1').a === 0);
    check('a zone turned off is dark; the memory keeps its own look', M.ledAt({ ...c, zones: { ...c.zones, fans: null } }, 'fans', 0, 12, 0, 'board-1').a === 0 && M.ledAt(c, 'memory', 0, 5, 0).a > 0);
    check('a desk-wide preset puts the zones back; a chassis change does not (lighting-family.3)',
      M.clearsZones({ preset: 'x' }) && M.clearsZones({ color: '#fff' }) && !M.clearsZones({ chassis: {} }) && !M.clearsZones({ brightness: 50 }));
  }

  // ── The editor ────────────────────────────────────────────────────────
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  const logs = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
      logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
  });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await load(send);
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  await load(send, '#/modal-lab');

  console.log('\nThe door and the layout');
  check('door: Modal Lab has the desktop lights plate', await waitFor(send, `document.querySelector('[aria-label="Desktop lights"]')`));
  check('door: it opens the desktop window on Chassis lighting, with the editor', await openPanel(send));
  check('door: the window is the desktop\'s, on its Chassis lighting tab',
    await evalJs(send, `/45L/.test(document.querySelector('.dc-canvas')?.getAttribute('aria-label') || '') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim().toLowerCase() === 'chassis lighting'`));
  check('door: the tower is drawn above, alone', await waitFor(send, `document.querySelector('.dc-canvas .dc-hero canvas')`, 8000));
  await resetViaGear(send);
  const cols = await evalJs(send, `['.pdm-bright', '.pcz-zones', '.pdm-presets'].map(s => document.querySelector('.dc-canvas ' + s)?.getBoundingClientRect().left ?? -1)`);
  check('layout: the peripherals\' three columns — the brightness rail, the zones, the presets, left to right',
    cols.every((x) => x >= 0) && cols[0] < cols[1] && cols[1] < cols[2], JSON.stringify(cols));
  check('layout: the LIGHTS switch sits in the window\'s header — the one Off', await evalJs(send, `!!document.querySelector('.dc-canvas .ds-ng3-header [aria-label="PC lighting power"]')`));
  check('layout: brightness is the rail every Lights tab has', await evalJs(send, `!!document.querySelector('.dc-canvas .pdm-bright input[type=range]')`));
  const names = await presetNames(send);
  check('layout: the preset library is the peripherals\' — Wave, HyperX Red and the rest', names.length >= 16 && names.includes('Wave') && names.includes('HyperX Red'), JSON.stringify(names));

  console.log('\nThe gear');
  check('gear: the header has a gear at the top right — the panel action style, named in aria-label and title',
    await evalJs(send, `(() => { const g = ${GEAR}; return !!g && g.classList.contains('ds-ng3-action') && g.getAttribute('title') === 'Lighting settings' && !!g.querySelector('svg') && g.closest('.ds-ng3-header') !== null; })()`));
  check('gear: Reset to default is not in the zone column, and no loose settings row is under the zones',
    await evalJs(send, `(() => { const col = document.querySelector('.dc-canvas .pcz-zones'); return !col.textContent.includes('Reset to default') && !document.querySelector('.dc-canvas .pcz-other') && ![...col.querySelectorAll('button')].length; })()`));
  check('gear: the popover starts closed', !(await gearOpen(send)) && (await evalJs(send, `${GEAR}.getAttribute('aria-expanded')`)) === 'false');
  await evalJs(send, `${GEAR}.click()`);
  await sleep(250);
  check('gear: clicking it opens a popover anchored to it with Reset to default and nothing else',
    await evalJs(send, `(() => { const p = document.querySelector('.dc-canvas .lg-pop'); if (!p) return false; const g = ${GEAR}.getBoundingClientRect(), r = p.getBoundingClientRect(); const names = [...p.querySelectorAll('button')].map((b) => b.textContent.trim()); return p.getAttribute('role') === 'dialog' && JSON.stringify(names) === JSON.stringify(['Reset to default']) && Math.abs(r.right - g.right) <= 2 && r.top >= g.bottom - 1 && r.top - g.bottom < 24 && r.left >= 0 && r.right <= innerWidth; })()`));
  await pickZone(send, '*');
  await pickZone(send, 'memory');
  await pickPreset(send, 'Orange');
  const wore = (await zoneRow(send, 'memory'))?.wears;
  await clickText(send, 'Reset to default', '.dc-canvas .lg-pop');
  await sleep(300);
  check('gear: Reset to default in the popover puts the starting looks back (the memory from Orange to Rainbow Wave)', wore === 'Orange' && (await zoneRow(send, 'memory'))?.wears === 'Rainbow Wave', `${wore} → ${(await zoneRow(send, 'memory'))?.wears}`);
  await pressEscape(send);
  check('gear: Escape closes the popover first and leaves the window open, focus back on the gear',
    await evalJs(send, `!document.querySelector('.dc-canvas .lg-pop') && !!document.querySelector('.dc-canvas .cl') && document.activeElement === ${GEAR}`));
  await evalJs(send, `${GEAR}.click()`);
  await sleep(250);
  await evalJs(send, `document.querySelector('.dc-canvas .pcz-zones').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(250);
  check('gear: a click outside closes it too', !(await gearOpen(send)) && (await evalJs(send, `!!document.querySelector('.dc-canvas .cl')`)));
  const tabLabels = await evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].map((b) => b.getAttribute('aria-label'))`);
  let gearOn = {};
  for (const t of tabLabels) {
    await evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(t)}).click()`);
    await sleep(400);
    gearOn[t] = await evalJs(send, `!!${GEAR}`);
  }
  check('gear: only the Chassis lighting tab has it', tabLabels.length > 1 && Object.entries(gearOn).every(([t, on]) => on === (t === 'Chassis lighting')), JSON.stringify(gearOn));
  await evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].find((b) => b.getAttribute('aria-label') === 'Chassis lighting').click()`);
  await sleep(400);
  await waitFor(send, EDITOR, 4000);

  console.log('\nZones');
  let z = await zones(send);
  const ids = z.map((x) => x.id);
  check('zones: All, Fans with every fan under it, Memory, Graphics card',
    ids[0] === '*' && ids[1] === 'fans' && ids.includes('board-1') && ids.includes('board-6') && ids.includes('memory') && ids.includes('gpu') && ids.indexOf('memory') > ids.indexOf('board-6'), JSON.stringify(ids));
  check('zones: a fan carries the name the player gave it (lcd-diy.13)', z.some((x) => /front fan/i.test(x.label)), JSON.stringify(z.map((x) => x.label)));
  check('zones: the parts start picked, All with them', z.find((x) => x.id === '*')?.on && z.find((x) => x.id === 'fans')?.on && z.find((x) => x.id === 'memory')?.on && z.find((x) => x.id === 'gpu')?.on);
  check('zones: each wears its starting preset; a fan wears the fans\' (lighting.4, .5)',
    z.find((x) => x.id === 'fans')?.wears === 'Wave' && z.find((x) => x.id === 'memory')?.wears === 'Rainbow Wave' && z.find((x) => x.id === 'board-1')?.wears === 'With Fans', JSON.stringify(z.map((x) => [x.id, x.wears])));
  check('zones: with different presets picked, no preset is highlighted', (await activePreset(send)) === null, String(await activePreset(send)));
  await pickZone(send, '*');
  await pickZone(send, 'memory');
  z = await zones(send);
  check('zones: All clears the pick; the memory alone is then picked, and its preset lights up in the grid',
    z.filter((x) => x.on).map((x) => x.id).join() === 'memory' && (await activePreset(send)) === 'Rainbow Wave', JSON.stringify(z.filter((x) => x.on).map((x) => x.id)) + ' · ' + (await activePreset(send)));

  console.log('\nPresets on zones');
  await pickPreset(send, 'Orange');
  check('a preset goes to the picked zone alone: the memory wears Orange, the fans keep their wave',
    (await zoneRow(send, 'memory'))?.wears === 'Orange' && (await zoneRow(send, 'fans'))?.wears === 'Wave' && (await activePreset(send)) === 'Orange');
  await pickZone(send, 'memory');
  await pickZone(send, 'board-2');
  await pickPreset(send, 'Banana');
  check('one fan: a preset on one fan is that fan\'s own; the fan beside it stays with the fans',
    (await zoneRow(send, 'board-2'))?.wears === 'Banana' && (await zoneRow(send, 'board-1'))?.wears === 'With Fans');
  await pickZone(send, 'fans');
  z = await zones(send);
  check('picking Fans drops the one fan from the pick (the fans are one choice or the other)', z.filter((x) => x.on).map((x) => x.id).join() === 'fans');
  await pickPreset(send, 'Ocean');
  check('a preset on Fans takes every fan with it, the one fan\'s own look included',
    (await zoneRow(send, 'fans'))?.wears === 'Ocean' && (await zoneRow(send, 'board-2'))?.wears === 'With Fans');
  await pickZone(send, '*');
  await pickZone(send, '*');
  await pickZone(send, 'gpu');
  await pickZone(send, 'memory');
  await pickPreset(send, 'HyperX Red');
  check('several zones at once take the one preset', (await zoneRow(send, 'gpu'))?.wears === 'HyperX Red' && (await zoneRow(send, 'memory'))?.wears === 'HyperX Red' && (await zoneRow(send, 'fans'))?.wears === 'Ocean');

  console.log('\nThe preset editor');
  await evalJs(send, `[...document.querySelectorAll('.dc-canvas .pdm-preset')].find(p => p.textContent.includes('Orange'))?.querySelector('.pdm-preset-menu')?.click()`);
  await sleep(200);
  await evalJs(send, `[...document.querySelectorAll('.dc-canvas .pdm-cmenu-item')].find(b => b.textContent.trim() === 'Edit')?.click()`);
  check('Edit opens the peripherals\' preset editor in the presets\' place', await waitFor(send, `document.querySelector('.dc-canvas .pdm-editor') && document.querySelector('.dc-canvas input[aria-label="Preset name"]')`, 3000));
  check('the editor edits the preset by name', (await evalJs(send, `document.querySelector('.dc-canvas input[aria-label="Preset name"]')?.value`)) === 'Orange');
  await evalJs(send, `document.querySelector('.dc-canvas .pdm-editor-back')?.click()`);
  check('‹ Presets goes back to the library, the zones as they were', await waitFor(send, `document.querySelector('.dc-canvas .pdm-presets-grid')`, 3000) && (await zoneRow(send, 'gpu'))?.wears === 'HyperX Red');

  console.log('\nOff');
  await lights(send);
  check('LIGHTS off: the editor says so, and the looks stay', await evalJs(send, `document.querySelector('.dc-canvas .cl')?.dataset.on === 'off'`) && (await zoneRow(send, 'fans'))?.wears === 'Ocean');
  await lights(send);
  check('LIGHTS on again', await evalJs(send, `document.querySelector('.dc-canvas .cl')?.dataset.on === 'on'`));

  console.log('\nThe machine');
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await sleep(300);
  await evalJs(send, `[...document.querySelectorAll('[aria-label="Memory modules"] button')].find(b => b.textContent.trim() === '0')?.click()`);
  await evalJs(send, `document.querySelector('[aria-label="HP-supplied graphics card"]')?.click()`);
  await evalJs(send, `[...document.querySelectorAll('[aria-label="Fans found"] button')].find(b => b.textContent.trim() === '3')?.click()`);
  await sleep(200);
  await openPanel(send);
  z = await zones(send);
  check('no memory, no HP card: those zones are not offered (lighting-family.6, lighting.7)', !z.some((x) => x.id === 'memory' || x.id === 'gpu'), JSON.stringify(z.map((x) => x.id)));
  check('three board fans found: three fan rows plus the CPU\'s, the kit\'s after them', z.filter((x) => /^board-/.test(x.id)).length === 4, JSON.stringify(z.filter((x) => /^board-/.test(x.id)).map((x) => x.id)));
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await sleep(200);
  await clickText(send, 'Full machine', 'body');
  await sleep(200);

  console.log('\nThe door from This PC');
  await evalJs(send, `localStorage.setItem('thisPc', 'forge-45l')`);
  await load(send, '#/');
  await evalJs(send, `[...document.querySelectorAll('nav button')].find(b => b.textContent.includes('Devices'))?.click()`);
  await waitFor(send, `document.querySelector('.device-panel.open .devp-pc')`);
  // The row reads what the lights wear now, in the words of the tower's label on
  // Personalize's 3D desk (looks.ts towerLook; JY, 2026-10-21).
  const ROW_READING = `[...document.querySelectorAll('.devp-feature')].find(r => r.querySelector('.devp-feature-label')?.textContent.trim() === 'Chassis lighting')?.querySelector('.devp-feature-reading')?.textContent.trim() ?? null`;
  const openRow = () => evalJs(send, `[...document.querySelectorAll('.devp-feature')].find(r => r.querySelector('.devp-feature-label')?.textContent.trim() === 'Chassis lighting')?.click()`);
  const backToPanel = async () => {
    await evalJs(send, `document.querySelector('.dc-close')?.click()`);
    return waitFor(send, `!document.querySelector('.dc-canvas') && document.querySelector('.device-panel.open .devp-pc')`, 3000);
  };
  const row = await evalJs(send, ROW_READING);
  check('This PC: the desktop\'s Chassis lighting row reads what its lights wear, not the parts they are on', !!row && row !== 'Fans, memory, graphics card', String(row));
  await openRow();
  check('This PC: it opens the PC\'s page on its Chassis lighting tab, with this editor (lighting.19), the other tabs still there',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .cl .pcz-zones') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Chassis lighting' && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length > 1`, 6000),
    await evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].map(b => b.getAttribute('aria-label')).join()`));
  // Behind the real host (DeviceModalHost and the Devices panel both listen for Escape): the
  // popover takes the first one, the page and the panel stay.
  await evalJs(send, `${GEAR}.click()`);
  await sleep(250);
  await pressEscape(send);
  check('This PC: with the gear open, Escape closes the popover and not the page or the panel behind it',
    await evalJs(send, `!document.querySelector('.dc-canvas .lg-pop') && !!document.querySelector('.dc-canvas.pc-canvas') && location.hash.includes('sku=forge-45l') && !!document.querySelector('.device-panel.open')`));
  // Every part in one look (the editor opens with every part picked): the row says that look.
  await pickPreset(send, 'Ocean');
  const backOnce = await backToPanel();
  check('This PC: every part in Ocean, and the row says Ocean', backOnce && (await evalJs(send, ROW_READING)) === 'Ocean', String(await evalJs(send, ROW_READING)));
  // The starting lighting has the parts differ (fans Wave, the rest Rainbow Wave).
  await openRow();
  await waitFor(send, `document.querySelector('.dc-canvas .cl .pcz-zones')`, 6000);
  await resetViaGear(send);
  const backTwice = await backToPanel();
  check('…reset to the start, parts differing: the row says Custom by part', backTwice && (await evalJs(send, ROW_READING)) === 'Custom by part', String(await evalJs(send, ROW_READING)));
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  const scene = logs.filter((l) => /^(error|exception)/.test(l) && /lightstudio|THREE|shader|WebGL|exception/i.test(l));
  check('the page throws nothing and the 3D scene reports no error', scene.length === 0, scene.slice(0, 4).join(' | '));
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

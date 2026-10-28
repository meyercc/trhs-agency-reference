// CDP check for a laptop's own lighting (OpenGSW lighting, lighting-family):
// the keyboard's zones, the light bar and the lid logo in the peripherals'
// Lights layout (JY, 2026-10-21) — the brightness rail, the zones with All,
// the preset library and editor the keyboard and mouse use (LaptopLights.tsx,
// ZoneLightsTab.tsx). The model (pcLighting.ts) is read from the app's own
// source; the editor is walked in Modal Lab, where the machine can be switched,
// and on the notebook's page (This PC's Lighting tab). The hotkeys, sleep and
// charging settings and the reset sit behind the gear in the panel's header
// (LightingGear), so every check of them opens the gear first.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const SKU = 'hx-omen-16-valorant';

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

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

// ── 1. The model ────────────────────────────────────────────────────────────
console.log('\nModel');
const modelDir = mkdtempSync(join(tmpdir(), 'trhs-kl-'));
const modelOut = join(modelDir, 'pcLighting.mjs');
await build({ entryPoints: ['src/devices/pcLighting.ts'], outfile: modelOut, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
const M = await import(modelOut);
rmSync(modelDir, { recursive: true, force: true });
{
  const solid = (hex, name = 'Solid') => ({ presetId: 'x', name, layers: [{ fx: 'solid', colors: [hex], angle: 0, speed: 50, opacity: 100 }] });
  const four = { keyboard: 'four', bar: 'none', logo: 'single' };
  const max = { keyboard: 'four', bar: 'u', logo: 'four' };
  const one = { keyboard: 'one', bar: 'none', logo: 'none' };
  check('a 4-zone SKU with a cover logo reads four + single', JSON.stringify(M.capsOf({ keyboard: { rgbZones: 4 }, lighting: { coverLogo: true } })) === JSON.stringify(four));
  check('a per-key keyboard is read from the record (OMEN Max; Chris 2026-10-21: per-key stays)', M.capsOf({ keyboard: { perKeyRGB: true } }).keyboard === 'per-key' && M.capsOf({ lighting: { keyboard: 'per-key' } }).keyboard === 'per-key' && M.capsOf({ lighting: { keyboard: 'perKey' } }).keyboard === 'none');
  check('a machine with no lights lists no parts', M.partsOf(M.capsOf({})).length === 0);
  const d = M.defaultLighting();
  const perkey = { keyboard: 'per-key', bar: 'u', logo: 'four' };
  check('on a per-key board every key is a zone that wears the whole board\'s look until painted', M.keyZone('per-key', 'w') === 'w' && M.zoneLookNow(d, perkey, 'keyboard', 'w')?.name === 'Wave' && M.zoneLookNow({ ...d, zones: { ...d.zones, w: solid('#ff0000') } }, perkey, 'keyboard', 'w')?.name === 'Solid' && M.zoneLookNow({ ...d, zones: { ...d.zones, w: solid('#ff0000') } }, perkey, 'keyboard', 'a')?.name === 'Wave');
  check('a per-key colour paints that key alone', (() => { const pk = M.paintKeyboard({ ...d, zones: { ...d.zones, w: solid('#ff0000') } }, perkey); return pk.colors.get('w') === 'rgb(255, 0, 0)' && pk.colors.get('a') !== 'rgb(255, 0, 0)' && pk.colors.has('a'); })());
  check('the whole per-key board taking a look lifts every key\'s own', M.keyboardLooks({ ...d.zones, w: solid('#ff0000') }, perkey, solid('#00ff00')).w === undefined && M.keyboardLooks({ ...d.zones, w: solid('#ff0000') }, perkey, solid('#00ff00')).all?.layers[0].colors[0] === '#00ff00');
  check('per-key selections are keys; All is the board', M.codesOfZones('per-key', ['w', 'a']).size === 2 && M.codesOfZones('per-key', ['all']).size > 80 && JSON.stringify(M.zonesSelected('per-key', new Set(['w', 'a']))) === JSON.stringify(['w', 'a']) && M.quickSelectFor('per-key').some((q) => q.id === 'wasd'));
  check('Fn+Space on a per-key board moves the whole board to the next animation', M.applyHotkey(d, perkey, 'fn-space', true).state.zones.all?.name !== 'Wave' && /next animation/.test(M.applyHotkey(d, perkey, 'fn-space', true).notice));
  check('the default: a wave on every keyboard zone and the bar, the logo in HyperX red (lighting.4)',
    ['left', 'center', 'right', 'numpad', 'all', 'bar'].every((z) => d.zones[z]?.name === 'Wave') && d.zones.logo?.name === 'HyperX Red' && d.sleepOff === true && d.chargeColor === 'amber');
  check('a value from before the zones (modes per part) starts over', M.normalizeLighting({ mode: 'custom', parts: {} }).zones.left?.name === 'Wave' && M.normalizeLighting({ zones: { left: solid('#ff0000') } }).zones.left.name === 'Solid');
  const eco = { ...d, eco: true };
  check('ECO on AC lights only a white keyboard (lighting.13)',
    M.zoneLookNow(eco, max, 'keyboard', 'left')?.layers[0].colors[0] === '#ffffff' && M.zoneLookNow(eco, max, 'bar', 'bar') === null && M.zoneLookNow(eco, max, 'logo', 'logo-1') === null);
  check('ECO on battery lights nothing', ['left', 'bar', 'logo-1'].every((z, i) => M.zoneLookNow({ ...eco, ac: false }, max, ['keyboard', 'bar', 'logo'][i], z) === null));
  check('ECO is ignored where the machine has no U bar', M.zoneLookNow(eco, four, 'keyboard', 'left')?.name === 'Wave' && M.hasEco(four) === false);
  check('Fn+Space is blocked on a 4-zone keyboard (lighting.25)', M.applyHotkey(d, four, 'fn-space', true).state === d && /does nothing/.test(M.applyHotkey(d, four, 'fn-space', true).notice));
  const dark = { ...d, zones: { ...d.zones, all: null } };
  check('Fn+Space from a dark one-zone keyboard starts an animation', M.applyHotkey(dark, one, 'fn-space', true).state.zones.all?.name && /first animation/.test(M.applyHotkey(dark, one, 'fn-space', true).notice));
  check('Fn+Space on a lit one-zone keyboard moves to the next animation', M.applyHotkey(d, one, 'fn-space', true).state.zones.all?.name !== 'Wave' && /next animation/.test(M.applyHotkey(d, one, 'fn-space', true).notice));
  check('Fn+F9 flips the power', M.applyHotkey(d, four, 'fn-f9', true).power === false && M.applyHotkey(d, four, 'fn-f9', false).power === true);
  check('Fn+F9 ends ECO, Fn+Space ends ECO and animates the keyboard', M.applyHotkey(eco, max, 'fn-f9', true).state.eco === false && M.applyHotkey(eco, max, 'fn-space', true).state.eco === false && M.applyHotkey(eco, max, 'fn-space', true).state.zones.left?.name);
  const painted = M.paintKeyboard({ ...d, zones: { ...d.zones, left: solid('#ff0000'), center: solid('#ffffff') } }, four);
  check('a 4-zone colour paints exactly that band', painted.colors.get('w') === 'rgb(255, 0, 0)' && painted.colors.get('space') === 'rgb(255, 255, 255)');
  check('a zone turned off paints no key', M.paintKeyboard({ ...d, zones: { ...d.zones, left: null } }, four).colors.has('w') === false);
  check('the keys a zone covers, and the zones a key selection stands for, agree',
    M.codesOfZones('four', ['left']).has('w') && !M.codesOfZones('four', ['left']).has('space') && JSON.stringify(M.zonesSelected('four', M.codesOfZones('four', ['left', 'numpad']))) === JSON.stringify(['left', 'numpad']) && M.keyZone('four', 'w') === 'left' && M.keyZone('one', 'w') === 'all');
  check('the part dots read each part\'s first colour', M.partDots(d, four, true).map((p) => p.part).join() === 'keyboard,logo' && M.partDots(d, four, true)[1].color === '#c8102e' && M.partDots(d, four, false).every((p) => p.color === null));
}

const targets = await httpJson('/json/list');
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error(`no page target on CDP ${CDP_PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
const send = makeSend(ws);
await send('Page.enable');
await send('Runtime.enable');
const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text);
});
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
let nav = 0;
const go = async (hash) => {
  const loaded = new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Page.loadEventFired') {
        ws.off('message', onMsg);
        resolve();
      }
    };
    ws.on('message', onMsg);
  });
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?n=${++nav}#${hash}` });
  await loaded;
  await sleep(1400);
};
await go('/');
await evaluate(`['lightPresets'].forEach(k => localStorage.removeItem(k))`);

// ── 2. The editor on its own, in Modal Lab ───────────────────────────────────
console.log('\nModal Lab');
const lab = (expr) => evaluate(`(async () => { const q = (s) => document.querySelector(s); const qa = (s) => [...document.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (t, root = '.pcl-lab') => qa(root + ' button, ' + root + ' [role=radio]').find((b) => (b.textContent.trim() || b.getAttribute('aria-label')) === t);
  const click = async (t, root) => { const b = btn(t, root); if (!b) throw new Error('no button ' + t); b.click(); await sleep(150); };
  const machine = async (v) => { const s = q('select[aria-label=Machine]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, v); s.dispatchEvent(new Event('change', { bubbles: true })); await sleep(200); };
  const kbBtn = (code) => q('.pcl-lab .kbd-key[data-code="' + code + '"]');
  const zones = () => qa('.pcl-lab .pcz-zone').map((z) => z.dataset.zone);
  const zone = async (id) => { q('.pcl-lab .pcz-zone[data-zone="' + id + '"]').click(); await sleep(150); };
  const wears = (id) => q('.pcl-lab .pcz-zone[data-zone="' + id + '"] .ds-list-item-description')?.textContent.trim();
  const picked = () => qa('.pcl-lab .pcz-zone[aria-selected="true"]').map((z) => z.dataset.zone).filter((z) => z !== '*');
  const preset = async (name) => { qa('.pcl-lab .pdm-preset-pick').find((b) => b.querySelector('span:last-child')?.textContent.trim() === name)?.click(); await sleep(250); };
  const rgb = (code) => kbBtn(code).style.getPropertyValue('--key-rgb').trim();
  const gear = async () => { if (!q('.pcl-lab .lg-pop')) { q('.pcl-lab [aria-label="Lighting settings"]').click(); await sleep(150); } };
  ${expr} })()`);
{
  await go('/modal-lab');
  check('Modal Lab mounts the laptop lighting editor', await evaluate(`!!document.querySelector('[data-testid=pcl-lab] .pcz')`));
  check('the peripherals\' layout: the brightness rail, the zones, the preset library', await lab(`const x = ['.pdm-bright', '.pcz-zones', '.pdm-presets'].map((s) => q('.pcl-lab ' + s)?.getBoundingClientRect().left ?? -1); return x.every((v) => v >= 0) && x[0] < x[1] && x[1] < x[2] && qa('.pcl-lab .pdm-preset').length >= 16`));
  check('the settings are behind a gear: the zone column holds only the zones, and the popover starts closed', await lab(`const col = q('.pcl-lab .pcz-zones').textContent; return !!q('.pcl-lab .ds-ng3-actions [aria-label="Lighting settings"]') && !q('.pcl-lab .lg-pop') && !q('.pcl-lab .pcz-zones .pcz-other') && !/Hotkeys|Fn\+Space|Fn\+F9|Lights off at sleep|Charging light|Reset to default/.test(col)`));
  check('4 zones + logo lists All, the four zones and Logo, no Light bar', await lab(`return JSON.stringify(zones()) === JSON.stringify(['*', 'left', 'center', 'right', 'numpad', 'logo'])`));
  check('the 4-zone rail offers the zones', await lab(`return JSON.stringify(qa('.pcl-lab .kbd-qs-btn').map((b) => b.textContent.trim())) === JSON.stringify(['Reset','All zones','Left','Center','Right','Numpad'])`));
  check('a cap selects its whole zone, in the list too', await lab(`kbBtn('w').click(); await sleep(200); return qa('.pcl-lab .kbd-key.lit-sel').length > 20 && JSON.stringify(picked()) === JSON.stringify(['left'])`));
  check('a preset goes to the zone picked, and paints its keys at once, nothing else', await lab(`await preset('HyperX Red'); return wears('left') === 'HyperX Red' && wears('center') === 'Wave' && rgb('w') === 'rgb(200, 16, 46)' && rgb('space') !== 'rgb(200, 16, 46)'`));
  check('the rail\'s All zones picks every zone; one preset then takes them all', await lab(`await click('All zones'); await preset('Banana'); return ['left','center','right','numpad'].every((z) => wears(z) === 'Banana') && wears('logo') !== 'Banana' && rgb('space') === 'rgb(247, 181, 0)'`));
  check('the list\'s All picks the logo with the keyboard; a preset lights the logo too', await lab(`await zone('*'); await zone('*'); return wears('logo') === 'HyperX Red' ? (await zone('logo'), await preset('Ocean'), wears('logo') === 'Ocean') : false`));
  check('Fn+Space does nothing on a 4-zone keyboard', await lab(`await gear(); await click('Fn+Space'); return /does nothing on a 4-zone/.test(q('[data-testid=hotkey-notice]')?.textContent || '')`));
  check('Fn+F9 darkens the keyboard and a second press brings it back', await lab(`await gear(); await click('Fn+F9'); const dark = qa('.pcl-lab .kbd-key.lit').length === 0; await click('Fn+F9'); return dark && qa('.pcl-lab .kbd-key.lit').length > 50`));

  // One zone
  check('a one-zone keyboard is one zone, picked from any cap', await lab(`await machine('one'); kbBtn('w').click(); await sleep(200); return JSON.stringify(zones()) === JSON.stringify(['*', 'all']) && qa('.pcl-lab .kbd-key.lit-sel').length > 80 && JSON.stringify(picked()) === JSON.stringify(['all'])`));
  check('a one-zone keyboard paints whole', await lab(`await preset('Touch Grass'); return rgb('a') === 'rgb(109, 212, 0)' && rgb('enter') === 'rgb(109, 212, 0)'`));
  check('Fn+Space on a lit one-zone keyboard moves to the next animation', await lab(`await preset('Wave'); await gear(); await click('Fn+Space'); return /next animation/.test(q('[data-testid=hotkey-notice]')?.textContent || '') && wears('all') !== 'Wave'`));

  // OMEN Max: 4 zones + U bar + four-region logo (no per-key tier, JY 2026-10-21)
  check('the lab offers the per-key keyboard kind (no shipping machine declares it)', await lab(`return qa('[aria-label="Keyboard type"] button, [aria-label="Keyboard type"] [role=radio]').some((b) => /per key/i.test(b.textContent))`));
  check('OMEN Max lists the zones, the logo\'s four regions and the light bar', await lab(`await machine('max'); return JSON.stringify(zones()) === JSON.stringify(['*', 'left', 'center', 'right', 'numpad', 'logo', 'logo-1', 'logo-2', 'logo-3', 'logo-4', 'bar'])`));
  check('a preset on Logo takes its four regions with it; one region can then differ', await lab(`await zone('logo'); await preset('Vibes'); const all4 = ['logo-1','logo-2','logo-3','logo-4'].every((z) => wears(z) === 'Vibes'); await zone('logo-2'); await preset('Orange'); return all4 && wears('logo-2') === 'Orange' && wears('logo-1') === 'Vibes' && JSON.stringify(picked()) === JSON.stringify(['logo-2'])`));
  check('ECO lighting: a white keyboard on AC', await lab(`await gear(); q('.pcl-lab [aria-label="ECO lighting"]').click(); await sleep(200); const keys = qa('.pcl-lab .kbd-key.lit'); return keys.length > 50 && keys.every((k) => k.style.getPropertyValue('--key-rgb').trim() === 'rgb(255, 255, 255)') && /ECO lighting is on/.test(q('.pcl-lab .pcl-eco')?.textContent || '')`));
  check('ECO lighting on battery lights nothing', await lab(`await gear(); await click('Battery'); return qa('.pcl-lab .kbd-key.lit').length === 0`));
  check('Fn+F9 ends ECO lighting', await lab(`await gear(); await click('Fn+F9'); return !q('.pcl-lab .pcl-eco')`));
  check('the charging light is amber or white, with no percentage', await lab(`await gear(); return !!btn('Amber') && !!btn('White') && !/%/.test(q('.pcl-lab .lg-settings').textContent)`));

  // None + reset
  check('a machine with no lights says so and offers nothing — no gear either', await lab(`await machine('none'); return /no lights the app can set/.test(q('.pcl-lab').textContent) && qa('.pcl-lab .pcz-zone').length === 0 && !q('.pcl-lab [aria-label="Lighting settings"]')`));
  check('Reset to default puts the wave back on every zone', await lab(`await machine('bar'); await zone('*'); await preset('Orange'); await gear(); await click('Reset to default'); return ['left','center','numpad','bar'].every((z) => wears(z) === 'Wave')`));

  // Per key (a kit of its own: the OMEN Max's design opens zones, not keys)
  check('a per-key machine lists one Keyboard row, the logo and the bar', await lab(`await machine('perkey'); return JSON.stringify(zones()) === JSON.stringify(['*', 'all', 'logo', 'logo-1', 'logo-2', 'logo-3', 'logo-4', 'bar'])`));
  check('the per-key rail offers key groups and the marquee tool', await lab(`return qa('.pcl-lab .kbd-qs-btn').map((b) => b.textContent.trim()).includes('WASD') && qa('.pcl-lab .kbd-qs-icon').length === 1`));
  check('a cap picks that one key, and the note says so', await lab(`kbBtn('w').click(); await sleep(200); return qa('.pcl-lab .kbd-key.lit-sel').length === 1 && /1 key picked/.test(q('[data-testid=perkey-note]')?.textContent || '')`));
  check('a preset lands on the picked key alone', await lab(`await preset('HyperX Red'); return rgb('w') === 'rgb(200, 16, 46)' && rgb('a') !== 'rgb(200, 16, 46)' && wears('all') === 'Wave'`));
  check('the rail\'s All picks the whole board; a preset then takes every key, the painted one too', await lab(`qa('.pcl-lab .kbd-qs-btn').find((b) => b.textContent.trim() === 'All')?.click(); await sleep(200); await preset('Banana'); return wears('all') === 'Banana' && rgb('w') === 'rgb(247, 181, 0)' && rgb('a') === 'rgb(247, 181, 0)'`));
  check('the library carries OMEN\'s effects after NGENUITY\'s in one list, with no OGH label', await lab(`const names = qa('.pcl-lab .pdm-preset-pick').map((b) => b.querySelector('span:last-child')?.textContent.trim()); return names.length >= 30 && names.indexOf('Starlight') > names.indexOf('Vibes') && ['OMEN', 'Spiral', 'System Vitals', 'Raindrop'].every((n) => names.includes(n)) && !q('.pcl-lab .pdm-presets-group') && !/OMEN Gaming Hub/.test(q('.pcl-lab .pdm-presets-grid')?.textContent ?? '')`));
  check('an OMEN effect applies like any preset', await lab(`if (!picked().includes('all')) await zone('all'); await preset('Starlight'); return wears('all') === 'Starlight' && qa('.pcl-lab .pdm-preset.active span:last-child').some((s) => s.textContent.trim() === 'Starlight')`));
  check('there is no Apply button anywhere in the editor', await lab(`return !qa('.pcl-lab button, .pcl-lab [role=radio]').some((b) => /^apply$/i.test(b.textContent.trim()))`));
  check('Edit opens the peripherals\' preset editor in the presets\' place, and ‹ Presets comes back', await lab(`qa('.pcl-lab .pdm-preset').find((p) => p.textContent.includes('Orange'))?.querySelector('.pdm-preset-menu')?.click(); await sleep(150); qa('.pcl-lab .pdm-cmenu-item').find((b) => b.textContent.trim() === 'Edit')?.click(); await sleep(200); const open = !!q('.pcl-lab .pdm-editor') && q('.pcl-lab input[aria-label="Preset name"]')?.value === 'Orange'; q('.pcl-lab .pdm-editor-back')?.click(); await sleep(200); return open && !!q('.pcl-lab .pdm-presets-grid')`));
}

// ── 3. The notebook's window uses it ────────────────────────────────────────
console.log('\nNotebook page');
{
  await go(`/?sku=${SKU}&tab=lighting`);
  check('the notebook’s Lighting tab is the laptop\'s lighting in the peripherals\' layout', await evaluate(`!!document.querySelector('.lc-canvas .pcz-zones') && !!document.querySelector('.lc-canvas .pcz .pdm-preset')`));
  check('its zones are the four bands and the logo', await evaluate(`JSON.stringify([...document.querySelectorAll('.lc-canvas .pcz-zone')].map((z) => z.dataset.zone)) === JSON.stringify(['*', 'left', 'center', 'right', 'numpad', 'logo'])`));
  check('the page draws no keyboard over its 3D machine: a zone is picked in the list, alone', await evaluate(`(async () => { const z = document.querySelector('.lc-canvas .pcz-zone[data-zone="left"]'); z.click(); await new Promise(r => setTimeout(r, 200)); return document.querySelectorAll('.lc-canvas .kbd-key').length === 0 && JSON.stringify([...document.querySelectorAll('.lc-canvas .pcz-zone[aria-selected="true"]')].map((e) => e.dataset.zone)) === JSON.stringify(['left']); })()`));
}

// ── 3b. The gear on the notebook's page ──────────────────────────────────────
console.log('\nNotebook page · the gear');
{
  /** A real Escape, from the keyboard: it goes to the focused element, as a person's does. */
  const pressEscape = async () => {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(250);
  };
  const SETTINGS = ['Fn+Space', 'Fn+F9', 'Lights off at sleep', 'Charging light', 'Reset to default'];
  const GEAR = `document.querySelector('.lc-canvas .ds-ng3-actions [aria-label="Lighting settings"]')`;
  await go(`/?sku=${SKU}&tab=lighting`);
  check('the Lighting tab has a gear at the top right of the panel header, before Duplicate profile, wearing the panel action style, named in aria-label and title',
    await evaluate(`(() => { const g = ${GEAR}; if (!g) return false; const acts = [...g.closest('.ds-ng3-actions').querySelectorAll('button')]; return g.classList.contains('ds-ng3-action') && g.getAttribute('title') === 'Lighting settings' && acts.indexOf(g) === 0 && acts[1]?.getAttribute('aria-label') === 'Duplicate profile' && !!g.querySelector('svg'); })()`));
  check('the settings are not in the zone column: it holds only the zones, no Hotkeys, sleep, charging or reset',
    await evaluate(`(() => { const col = document.querySelector('.lc-canvas .pcz-zones'); const t = col.textContent; return !document.querySelector('.lc-canvas .pcz-other') && !${JSON.stringify(SETTINGS)}.some((x) => t.includes(x)) && !/Hotkeys/.test(t) && col.querySelectorAll('[role=tab], button').length === 0; })()`));
  check('the popover is closed until the gear is clicked', await evaluate(`!document.querySelector('.lc-canvas .lg-pop') && ${GEAR}.getAttribute('aria-expanded') === 'false'`));
  await evaluate(`${GEAR}.click()`);
  await sleep(250);
  check('clicking the gear opens a popover anchored to it, holding Hotkeys (Fn+Space, Fn+F9), Lights off at sleep, Charging light and Reset to default',
    await evaluate(`(() => { const p = document.querySelector('.lc-canvas .lg-pop'); if (!p) return false; const g = ${GEAR}.getBoundingClientRect(), r = p.getBoundingClientRect(); const t = p.textContent; return p.getAttribute('role') === 'dialog' && ${JSON.stringify(SETTINGS)}.every((x) => t.includes(x)) && t.includes('Hotkeys') && Math.abs(r.right - g.right) <= 2 && r.top >= g.bottom - 1 && r.top - g.bottom < 24 && r.left >= 0 && r.right <= innerWidth && ${GEAR}.getAttribute('aria-expanded') === 'true'; })()`));
  check('…and nothing but those controls is in it (the machine has no ECO lighting)',
    await evaluate(`(() => { const p = document.querySelector('.lc-canvas .lg-pop'); const names = [...p.querySelectorAll('button, [role=switch], [role=tab]')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()); return JSON.stringify(names) === JSON.stringify(['Fn+Space', 'Fn+F9', 'Lights off at sleep', 'Amber', 'White', 'Reset to default']); })()`),
    await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop button, .lc-canvas .lg-pop [role=switch]')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()).join(' | ')`));
  // The controls work as they did in the column.
  await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop button')].find((b) => b.textContent.trim() === 'Fn+F9').click()`);
  await sleep(250);
  check('Fn+F9 in the popover puts the keyboard\'s lights out (the header switch goes off), a second press brings them back',
    (await evaluate(`document.querySelector('.lc-canvas [aria-label="Lighting power"]').getAttribute('aria-checked')`)) === 'false'
      && (await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop button')].find((b) => b.textContent.trim() === 'Fn+F9').click(), new Promise((r) => setTimeout(() => r(document.querySelector('.lc-canvas [aria-label="Lighting power"]').getAttribute('aria-checked')), 250))`)) === 'true');
  await evaluate(`document.querySelector('.lc-canvas .lg-pop [aria-label="Lights off at sleep"]').click()`);
  await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop [role=tab]')].find((b) => b.textContent.trim() === 'White').click()`);
  await sleep(250);
  check('Lights off at sleep and the charging light change as they did',
    (await evaluate(`document.querySelector('.lc-canvas .lg-pop [aria-label="Lights off at sleep"]').getAttribute('aria-checked')`)) === 'false'
      && (await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop [role=tab]')].find((b) => b.textContent.trim() === 'White').getAttribute('aria-selected')`)) === 'true');
  await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop button')].find((b) => b.textContent.trim() === 'Reset to default').click()`);
  await sleep(250);
  check('Reset to default puts the sleep switch and the charging light back',
    (await evaluate(`document.querySelector('.lc-canvas .lg-pop [aria-label="Lights off at sleep"]').getAttribute('aria-checked')`)) === 'true'
      && (await evaluate(`[...document.querySelectorAll('.lc-canvas .lg-pop [role=tab]')].find((b) => b.textContent.trim() === 'Amber').getAttribute('aria-selected')`)) === 'true');
  await pressEscape();
  check('Escape closes the popover first and leaves the window open',
    await evaluate(`!document.querySelector('.lc-canvas .lg-pop') && !!document.querySelector('.lc-canvas') && location.hash.includes('sku=${SKU}') && document.activeElement === ${GEAR}`));
  await evaluate(`${GEAR}.click()`);
  await sleep(250);
  await evaluate(`document.querySelector('.lc-canvas .pcz-zones').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(250);
  check('a click outside closes it too, the window stays', await evaluate(`!document.querySelector('.lc-canvas .lg-pop') && !!document.querySelector('.lc-canvas')`));
  await evaluate(`${GEAR}.click()`);
  await sleep(250);
  await evaluate(`${GEAR}.click()`);
  await sleep(250);
  check('the gear toggles it', await evaluate(`!document.querySelector('.lc-canvas .lg-pop')`));
  await pressEscape();
  check('with no popover open, Escape closes the window as before', await evaluate(`!document.querySelector('.lc-canvas') && !location.hash.includes('sku=')`));
  // Only the Lighting tab has the gear.
  await go(`/?sku=${SKU}&tab=vitals`);
  check('the Performance tab has no gear', await evaluate(`!${GEAR}`));
  await evaluate(`[...document.querySelectorAll('.lc-canvas .ds-ng3-tool')].find((b) => b.getAttribute('aria-label') === 'Macro').click()`);
  await sleep(400);
  check('the Macro tab has no gear', await evaluate(`!${GEAR} && !!document.querySelector('.lc-canvas [data-testid="macro-tab"]')`));
  await evaluate(`[...document.querySelectorAll('.lc-canvas .ds-ng3-tool')].find((b) => b.getAttribute('aria-label') === 'Lighting').click()`);
  await sleep(400);
  check('Lighting brings the gear back', await evaluate(`!!${GEAR}`));
  await evaluate(`${GEAR}.click()`);
  await sleep(250);
  await evaluate(`[...document.querySelectorAll('.lc-canvas .ds-ng3-tool')].find((b) => b.getAttribute('aria-label') === 'Performance').click()`);
  await sleep(400);
  check('leaving the Lighting tab with the popover open takes both away', await evaluate(`!${GEAR} && !document.querySelector('.lc-canvas .lg-pop')`));
}

// ── 4. The OMEN Max 16's window: its design opens zones, the U bar and the logo ──
console.log('\nOMEN Max 16 page');
{
  await go(`/?sku=omen-max-16&tab=lighting`);
  check('the OMEN Max 16 opens the laptop canvas with four keyboard zones, the light bar and the four-region logo', await evaluate(`JSON.stringify([...document.querySelectorAll('.lc-canvas .pcz-zone')].map((z) => z.dataset.zone)) === JSON.stringify(['*', 'left', 'center', 'right', 'numpad', 'logo', 'logo-1', 'logo-2', 'logo-3', 'logo-4', 'bar'])`));
  check('its keyboard is zone-locked: no marquee tool, and picking Left in the list takes the band alone (the Rockstar Figma; JY 2026-10-21)', await evaluate(`(async () => { document.querySelector('.lc-canvas .pcz-zone[data-zone="left"]')?.click(); await new Promise(r => setTimeout(r, 200)); return document.querySelectorAll('.lc-canvas .kbd-qs-icon').length === 0 && JSON.stringify([...document.querySelectorAll('.lc-canvas .pcz-zone[aria-selected="true"]')].map((e) => e.dataset.zone)) === JSON.stringify(['left']); })()`));
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
await evaluate(`localStorage.removeItem('lightPresets')`).catch(() => {});
await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

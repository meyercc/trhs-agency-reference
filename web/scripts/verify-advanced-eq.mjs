// Advanced (parametric) Equalizer: the chooser, the graph, the parameter bar,
// and that a bent preset lands in the headset panel and survives a reload.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
//   CDP_PORT=9333 APP_PORT=5180 node scripts/verify-advanced-eq.mjs
import WebSocket from 'ws';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

// ── The math, without a browser ─────────────────────────────────────────────
// esbuild strips the types so node can import the module, the way
// verify-profiles.mjs does for the profile rules.
const dir = mkdtempSync(join(tmpdir(), 'trhs-aeq-'));
const outfile = join(dir, 'eqParametric.mjs');
await build({ entryPoints: ['src/devices/eqParametric.ts'], outfile, format: 'esm', platform: 'node', bundle: true, logLevel: 'silent' });
const M = await import(outfile);
rmSync(dir, { recursive: true, force: true });

const flat = M.defaultBands();
check('math · a fresh preset is flat', M.isFlat(flat) && Math.abs(M.responseDb(flat, 1000)) < 1e-9);
const peak = flat.map((b, i) => (i === 5 ? { ...b, gain: 6, q: 1 } : b));
check('math · a +6 dB peak at 1 kHz reads +6 dB at 1 kHz', Math.abs(M.responseDb(peak, 1000) - 6) < 0.05, M.responseDb(peak, 1000).toFixed(2));
check('math · and is back near 0 dB two decades away', Math.abs(M.responseDb(peak, 20)) < 0.1 && Math.abs(M.responseDb(peak, 20000)) < 0.3,
  `${M.responseDb(peak, 20).toFixed(2)} / ${M.responseDb(peak, 20000).toFixed(2)}`);
const bypassed = peak.map((b, i) => (i === 5 ? { ...b, on: false } : b));
check('math · a bypassed band contributes nothing', Math.abs(M.responseDb(bypassed, 1000)) < 1e-9);
const shelf = flat.map((b, i) => (i === 9 ? { ...b, type: 'highshelf', hz: 4000, gain: 6 } : b));
check('math · a +6 dB high shelf lifts the top and leaves the bottom',
  M.responseDb(shelf, 18000) > 5 && Math.abs(M.responseDb(shelf, 50)) < 0.2,
  `${M.responseDb(shelf, 18000).toFixed(2)} / ${M.responseDb(shelf, 50).toFixed(2)}`);
const hp = flat.map((b, i) => (i === 0 ? { ...b, type: 'highpass', hz: 100 } : b));
check('math · a high pass at 100 Hz cuts below it', M.responseDb(hp, 20) < -20 && Math.abs(M.responseDb(hp, 5000)) < 0.2,
  `${M.responseDb(hp, 20).toFixed(1)} / ${M.responseDb(hp, 5000).toFixed(2)}`);
check('math · the log scale round-trips', Math.abs(M.unitToHz(M.hzToUnit(2500)) - 2500) < 0.01 && M.hzToUnit(20) === 0 && M.hzToUnit(20000) === 1);
check('math · Q and half-octaves round-trip, and a higher Q is a narrower band',
  Math.abs(M.halfOctavesToQ(M.qToHalfOctaves(0.7)) - 0.7) < 1e-9 && M.qToHalfOctaves(0.5) > M.qToHalfOctaves(2),
  `${M.qToHalfOctaves(0.5).toFixed(3)} oct at Q 0.5 · ${M.qToHalfOctaves(2).toFixed(3)} at Q 2`);
check('math · "2.5k" is a frequency, "loud" is not', M.parseHz('2.5k') === 2500 && M.parseHz('250 Hz') === 250 && M.parseHz('loud') === null);
check('math · the row glyph is nine points', M.curveFromParams(peak).split(' ').length === 9);

// ── The browser ─────────────────────────────────────────────────────────────
let msgId = 0;
const pending = new Map();
const target = (await httpJson('/json/list')).find((t) => t.type === 'page');
if (!target) throw new Error(`No page target on :${CDP_PORT} — is headless Chrome running?`);
const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
await new Promise((r) => ws.on('open', r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}
const waitFor = async (expr, ms = 4000) => {
  for (let t = 0; t < ms; t += 100) {
    try { if (await evalJs(`!!(${expr})`)) return true; } catch { /* mid-navigation */ }
    await sleep(100);
  }
  return false;
};
let loadN = 0;
const openAudio = async () => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=cloud-iii-s&tab=audio` });
  await waitFor(`document.readyState === 'complete' && document.querySelector('.hc-eq-list')`);
};
const click = (sel) => evalJs(`document.querySelector(${JSON.stringify(sel)})?.click(), true`);
const panelLabels = () => evalJs(`[...document.querySelectorAll('.hc-eq-list .ds-list-item')].map(e=>e.textContent.trim())`);
const point = (i) => evalJs(`(() => { const p = document.querySelectorAll('.aeq-point')[${i}]; if (!p) return null;
  const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, gain: Number(p.getAttribute('aria-valuenow')), selected: p.classList.contains('selected'), off: p.classList.contains('off') }; })()`);
const plot = () => evalJs(`(() => { const r = document.querySelector('.aeq-plot').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })()`);
const mouse = async (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra });

await openAudio();
await evalJs(`localStorage.removeItem('eqPresets'); 1`);
await openAudio();
const before = await panelLabels();

// ── Chooser ──
await evalJs(`[...document.querySelectorAll('.ds-list-item')].find(x=>/Add Equalizer Preset/.test(x.textContent)).click()`);
check('"Add Equalizer Preset" asks Simple or Advanced first', await waitFor(`document.querySelector('.modal-shell.ceq')`));
check('the chooser offers exactly the two editors', /Simple.*\|.*Advanced/i.test(await evalJs(`[...document.querySelectorAll('.ceq-card')].map(c => c.textContent).join('|')`)));
await evalJs(`[...document.querySelectorAll('.ceq-card')].find(x=>/Advanced/i.test(x.textContent)).click()`);
check('picking Advanced opens the Advanced Equalizer and closes the chooser',
  (await waitFor(`document.querySelector('.modal-shell.aeq')`)) && !(await evalJs(`!!document.querySelector('.modal-shell.ceq')`)));

// ── Opening state ──
check('it opens on a fresh "Advanced EQ 1" in the shared rail',
  await evalJs(`[...document.querySelectorAll('.seq-preset-list .ds-list-item')].some(r => /Advanced EQ 1/.test(r.textContent))`));
check('ten bands, one point each', (await evalJs(`document.querySelectorAll('.aeq-point').length`)) === 10);
check('every point starts at 0 dB', await evalJs(`[...document.querySelectorAll('.aeq-point')].every(p => p.getAttribute('aria-valuenow') === '0')`));
check('the points are sliders with real names', await evalJs(`[...document.querySelectorAll('.aeq-point')].every(p => p.getAttribute('role') === 'slider' && /Band \\d+/.test(p.getAttribute('aria-label')))`));
check('the parameter bar is quiet until a band is picked', await evalJs(`!document.querySelector('.aeq-params').classList.contains('has-band') && document.querySelector('.aeq-params .ds-stepper-field').disabled`));
check('and so is the graph: a plain line, no fill, no band color', await evalJs(`(() => { const ed = document.querySelector('.aeq-editor'); return !ed.classList.contains('has-band') && getComputedStyle(document.querySelector('.aeq-fill')).opacity === '0' && document.querySelectorAll('.aeq-q-anchor').length === 0; })()`));
check('the named ranges run Sub-Bass to Highs', (await evalJs(`[...document.querySelectorAll('.aeq-refs .seq-group')].map(g=>g.textContent).join(',')`)) === 'Sub-Bass,Bass,Low Mids,Mids,High Mids,Highs');
check('the 0 dB tick sits on a 0 dB point', await evalJs(`(() => { const p = document.querySelectorAll('.aeq-point')[0].getBoundingClientRect(); const t = [...document.querySelectorAll('.seq-tick')].find(t => t.textContent.trim() === '0 dB').getBoundingClientRect(); return Math.abs((p.top + p.height/2) - (t.top + t.height/2)) <= 2; })()`));

// ── Drag a point ──
const p5 = await point(5);
const box = await plot();
await mouse('mouseMoved', p5.x, p5.y);
await mouse('mousePressed', p5.x, p5.y, { clickCount: 1 });
const targetY = box.top + (box.bottom - box.top) * 0.25; // three quarters up = +6 dB
await mouse('mouseMoved', p5.x, targetY);
await mouse('mouseReleased', p5.x, targetY, { clickCount: 1 });
await sleep(150);
const after5 = await point(5);
check('dragging a point up raises its gain', after5.gain > 5 && after5.gain < 7, `${after5.gain} dB`);
check('and selects it — the bar lights up with its values', after5.selected && (await evalJs(`document.querySelector('.aeq-params').classList.contains('has-band')`)));
check('the gain field reads the point', /\+?6\.0 dB|\+5\.5 dB|\+6\.5 dB/.test(await evalJs(`document.querySelector('.aeq-params [aria-label="Gain"]').value`)), await evalJs(`document.querySelector('.aeq-params [aria-label="Gain"]').value`));
// The fill's opacity arrives through a --dur-fast transition too — wait for it.
const fillShown = await waitFor(`getComputedStyle(document.querySelector('.aeq-fill')).opacity !== '0'`, 4000);
const fillLen = await evalJs(`document.querySelector('.aeq-fill').getAttribute('d').length`);
check('the curve fills below the line', fillLen > 100 && fillShown,
  `d ${fillLen} chars · opacity ${await evalJs(`getComputedStyle(document.querySelector('.aeq-fill')).opacity`)} · has-band ${await evalJs(`document.querySelector('.aeq-editor').classList.contains('has-band')`)}`);
// The color arrives through a --dur-fast transition, so wait for it to settle
// rather than read a blend of the neutral and the band color.
const bandColorEverywhere = `(() => {
  const ed = document.querySelector('.aeq-editor');
  const cs = getComputedStyle(ed);
  const rgb = (hex) => { const n = parseInt(hex.trim().slice(1), 16); return 'rgb(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ') + ')'; };
  const want = rgb(cs.getPropertyValue('--eq-band-6'));
  return ed.style.getPropertyValue('--band') === 'var(--eq-band-6)'
    && getComputedStyle(document.querySelector('.aeq-line')).stroke === want
    && getComputedStyle(document.querySelector('.aeq-fill')).fill === want
    && getComputedStyle(document.querySelector('.aeq-params')).borderTopColor === want
    && rgb(cs.getPropertyValue('--accent-color')) !== want;
})()`;
check('the line, the fill and the bar all take the selected band\'s color, not the accent',
  await waitFor(bandColorEverywhere, 2000),
  await evalJs(`getComputedStyle(document.querySelector('.aeq-line')).stroke + ' / ' + getComputedStyle(document.querySelector('.aeq-params')).borderTopColor`));
// ── Q anchors ──
const anchors = () => evalJs(`[...document.querySelectorAll('.aeq-q-anchor')].map(a => { const r = a.getBoundingClientRect(); return r.left + r.width / 2; })`);
const qOf = (i) => evalJs(`Number((document.querySelectorAll('.aeq-point')[${i}].getAttribute('aria-valuetext').match(/Q ([\\d.]+)/) || [])[1])`);
const ax = await anchors();
const p5b = await point(5);
check('the selected point alone grows two Q anchors, the same distance either side',
  ax.length === 2 && Math.abs((p5b.x - ax[0]) - (ax[1] - p5b.x)) < 1.5,
  `${ax.length} anchors · ${ax.map((x) => Math.round(x - p5b.x)).join(' / ')} px`);
const q0 = await qOf(5);
await mouse('mouseMoved', ax[1], p5b.y);
await mouse('mousePressed', ax[1], p5b.y, { clickCount: 1 });
await mouse('mouseMoved', ax[1] - 40, p5b.y);
await mouse('mouseReleased', ax[1] - 40, p5b.y, { clickCount: 1 });
await sleep(150);
const q1 = await qOf(5);
const p5c = await point(5);
check('dragging the right anchor inward narrows the band — Q up, gain and frequency untouched',
  q1 > q0 && p5c.gain === p5b.gain && Math.abs(p5c.x - p5b.x) < 1, `Q ${q0} → ${q1}`);
check('and the anchors follow the new width', Math.abs((await anchors())[1] - (ax[1] - 40)) < 3, `${Math.round((await anchors())[1] - ax[1])} px`);
if (process.env.AEQ_SHOT) {
  const { data } = await send('Page.captureScreenshot');
  (await import('node:fs')).writeFileSync(process.env.AEQ_SHOT, Buffer.from(data, 'base64'));
}

// ── Type into the bar ──
await evalJs(`(() => { const f = document.querySelector('.aeq-params [aria-label="Frequency"]'); f.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(f, '2.5k'); f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
await sleep(150);
check('typing "2.5k" into Freq moves the point to 2.5 kHz',
  /2\.5 kHz/.test(await evalJs(`document.querySelectorAll('.aeq-point')[5].getAttribute('aria-label')`)),
  await evalJs(`document.querySelectorAll('.aeq-point')[5].getAttribute('aria-label')`));
await evalJs(`[...document.querySelectorAll('.aeq-params .ds-toggle-group-btn')].find(b => b.getAttribute('aria-label') === 'High Shelf').click()`);
await sleep(100);
check('the filter picker changes the band type', /High Shelf/.test(await evalJs(`document.querySelectorAll('.aeq-point')[5].getAttribute('aria-label')`)));
check('and names it in the bar', /High Shelf/i.test(await evalJs(`document.querySelector('.aeq-param-label.filter').textContent`)));

// ── Keyboard on a point ──
await evalJs(`document.querySelectorAll('.aeq-point')[2].focus()`);
await evalJs(`document.querySelectorAll('.aeq-point')[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`);
await sleep(100);
check('ArrowUp on a focused point steps its gain', (await point(2)).gain === 0.5, `${(await point(2)).gain} dB`);

// ── Bypass and reset ──
await click('.aeq-param-actions [aria-label="Bypass band"]');
await sleep(100);
check('bypass keeps the point but takes it out of the curve', (await point(2)).off === true);
await click('.aeq-param-actions [aria-label="Enable band"]');
await click('.aeq-param-actions [aria-label="Reset band"]');
await sleep(100);
check('reset returns the band to rest', (await point(2)).gain === 0 && !(await point(2)).off);

// ── Commit and reload ──
await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
await sleep(300);
check('Escape closes the editor and leaves the device canvas open',
  !(await evalJs(`!!document.querySelector('.modal-shell.aeq')`)) && (await evalJs(`!!document.querySelector('.hc-eq-list')`)));
const afterLabels = await panelLabels();
check('the bent preset joins the headset panel list', afterLabels.length === before.length + 1 && afterLabels.some((l) => /Advanced EQ 1/.test(l)), afterLabels.slice(-2).join(', '));
await openAudio();
const reloaded = await panelLabels();
check('it survives a reload', JSON.stringify(reloaded) === JSON.stringify(afterLabels));
check('and is stored as a parametric preset with ten bands', await evalJs(`(() => { const l = JSON.parse(localStorage.getItem('eqPresets') || '[]'); const p = l.find(x => x.label === 'Advanced EQ 1'); return !!p && p.kind === 'parametric' && p.params.length === 10 && p.params[5].type === 'highshelf'; })()`));

// A simple preset made afterwards must sit beside it, not replace it.
await evalJs(`[...document.querySelectorAll('.ds-list-item')].find(x=>/Add Equalizer Preset/.test(x.textContent)).click()`);
await waitFor(`document.querySelector('.ceq-card')`);
await evalJs(`[...document.querySelectorAll('.ceq-card')].find(x=>/Simple/i.test(x.textContent)).click()`);
await waitFor(`document.querySelector('.modal-shell.seq')`);
check('the Simple editor lists only simple presets', !(await evalJs(`[...document.querySelectorAll('.seq-preset-list .ds-list-item')].some(r => /Advanced EQ/.test(r.textContent))`)));
await evalJs(`(()=>{const inp=document.querySelectorAll('.seq-band input[type=range]')[0]; const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(inp,'4'); inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true}));})()`);
await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
await sleep(300);
const both = await panelLabels();
check('one list holds both kinds', both.some((l) => /Advanced EQ 1/.test(l)) && both.some((l) => /Simple EQ 1/.test(l)), both.slice(-3).join(', '));

// Leave the app as we found it — other suites read this state.
await evalJs(`localStorage.removeItem('eqPresets'); 1`);
ws.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

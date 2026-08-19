// CDP walkthrough for the React SKU Registry (/registry) + Configurator
// (/configurator). Dev server :5175, headless Chrome :9222, run from web/.
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

let loadN = 0;
async function nav(send, hash) {
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#${hash}` });
  await sleep(1100);
}

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });

  // ── Registry ──
  await nav(send, '/registry');
  let n = await evalJs(send, `document.querySelectorAll('.reg-card').length`);
  check('registry: cards render', n > 20, `${n} cards`);
  await evalJs(send, `[...document.querySelectorAll('.reg-chips .ds-chip')].find(c => c.textContent.trim() === 'microphone').click()`);
  await sleep(300);
  n = await evalJs(send, `document.querySelectorAll('.reg-card').length`);
  check('registry: type filter → 9 mics', n === 9, String(n));
  await evalJs(send, `[...document.querySelectorAll('.reg-chips .ds-chip')].find(c => c.textContent.trim() === 'all').click()`);
  await evalJs(send, `
    const inp = document.querySelector('.reg-filters input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, 'cloud iii s'); inp.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await sleep(300);
  n = await evalJs(send, `document.querySelectorAll('.reg-card').length`);
  check('registry: search narrows', n >= 1 && n <= 3, String(n));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/registry.png`, Buffer.from(shot.data, 'base64'));

  // Preview opens the real canvas over the page
  await evalJs(send, `[...document.querySelectorAll('.reg-card')][0].querySelector('.reg-card-btns .ds-btn')?.click() ?? [...document.querySelectorAll('.reg-card button')].find(b => b.textContent.trim() === 'Preview').click()`);
  await sleep(900);
  check('registry: Preview opens device canvas', await evalJs(send, `!!document.querySelector('.dc-canvas')`));
  await evalJs(send, `document.querySelector('.dc-close').click()`);
  await sleep(400);

  // Edit navigates to the configurator
  await evalJs(send, `[...document.querySelectorAll('.reg-card button')].find(b => b.textContent.trim() === 'Edit').click()`);
  await sleep(900);
  check('registry: Edit → configurator', await evalJs(send, `location.hash.includes('/configurator?edit=')`), await evalJs(send, `location.hash`));

  // ── Configurator: edit cloud-iii-s ──
  await nav(send, '/configurator?edit=cloud-iii-s');
  check('cfg: editing badge', await evalJs(send, `!!document.querySelector('.cfg-editing')`));
  check('cfg: live canvas preview in stage', await evalJs(send, `!!document.querySelector('.cfg-stage .dc-canvas .ds-ng3-panel')`));
  let spec = await evalJs(send, `document.querySelector('.cfg-json pre').textContent`);
  check('cfg: spec shows loaded SKU', /cloud-iii-s/.test(spec));

  // EQ section visible in the preview before, gone after toggling Equalizer off
  const eqBefore = await evalJs(send, `[...document.querySelectorAll('.cfg-stage .ds-ng3-label')].some(l => l.textContent.includes('Audio Equalizer'))`);
  await evalJs(send, `[...document.querySelectorAll('.cfg-form .ds-ng3-row')].find(r => r.textContent.trim().startsWith('Equalizer')).querySelector('.ds-toggle').click()`);
  await sleep(400);
  const eqAfter = await evalJs(send, `[...document.querySelectorAll('.cfg-stage .ds-ng3-label')].some(l => l.textContent.includes('Audio Equalizer'))`);
  spec = await evalJs(send, `document.querySelector('.cfg-json pre').textContent`);
  check('cfg: Equalizer off → preview updates live', eqBefore === true && eqAfter === false, `before=${eqBefore} after=${eqAfter}`);
  check('cfg: spec records the override', /"equalizer":\s*false/.test(spec));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/configurator.png`, Buffer.from(shot.data, 'base64'));

  // Battery slider feeds the preview chip
  await evalJs(send, `
    const sliders = [...document.querySelectorAll('.cfg-form input[type=range]')];
    const s = sliders[0];
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(s, '10'); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await sleep(400);
  const chip = await evalJs(send, `[...document.querySelectorAll('.cfg-stage .dc-chip-val')].map(e => e.textContent.trim()).join('/')`);
  check('cfg: battery slider → preview chip', /10%/.test(chip), chip);

  // Type switch swaps the form + canvas
  await evalJs(send, `[...document.querySelectorAll('.cfg-form .ds-dropdown-trigger')].find(t => t.textContent.trim() === 'headset').click()`);
  await sleep(200);
  await evalJs(send, `[...document.querySelectorAll('.ds-dropdown-pop .ds-list-item, .ds-dropdown-pop [role=option], .ds-dropdown-pop li')].find(o => o.textContent.trim() === 'mouse').click()`);
  await sleep(500);
  const mouseForm = await evalJs(send, `[...document.querySelectorAll('.cfg-feature-name')].map(e => e.textContent.trim()).join('/')`);
  check('cfg: type switch → mouse form', /Sensor/.test(mouseForm), mouseForm);
  check('cfg: type switch → mouse canvas', await evalJs(send, `!!document.querySelector('.cfg-stage .dc-sensor, .cfg-stage .dc-buttons')`));

  // Save guard without id/name (Start fresh clears identity first)
  await evalJs(send, `[...document.querySelectorAll('.cfg-editing .ds-btn, .cfg-editing button')].find(b => b.textContent.includes('Start fresh'))?.click()`);
  await sleep(300);
  await evalJs(send, `[...document.querySelectorAll('.cfg-actions .ds-btn')].find(b => b.textContent.includes('Save')).click()`);
  await sleep(300);
  const toast = await evalJs(send, `document.querySelector('.cfg-toast')?.textContent ?? ''`);
  check('cfg: save guard (no id/name)', /Need id, name/.test(toast), toast);

  // ── Colorway label field (was dropped in the React port) ──
  // `haste` is the fixture: saga-pro ships no colorways, so it renders no rows.
  await nav(send, '/configurator?edit=haste');
  const cwFields = await evalJs(send, `[...document.querySelectorAll('.cfg-cw-row')][0]
    ? [...document.querySelectorAll('.cfg-cw-row')[0].querySelectorAll('input[aria-label]')].map(i => i.getAttribute('aria-label'))
    : null`);
  check('cfg: colorway row has id + label + image fields',
    Array.isArray(cwFields) && cwFields.some((l) => /label/i.test(l)) && cwFields.some((l) => /image/i.test(l)),
    JSON.stringify(cwFields));
  const cwLabelVal = await evalJs(send, `document.querySelector('.cfg-cw-row input[aria-label="Colorway 1 label"]')?.value ?? null`);
  check('cfg: colorway label loads from the stored SKU', cwLabelVal === 'Black', JSON.stringify(cwLabelVal));

  // Editing the label must reach the saved spec — it was unreachable before.
  await evalJs(send, `(() => {
    const i = document.querySelector('.cfg-cw-row input[aria-label="Colorway 1 label"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(i, 'Midnight');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(400);
  const cwSpec = await evalJs(send, `(() => {
    try { return JSON.parse(document.querySelector('.cfg-json pre').textContent).colorways[0].label; } catch (e) { return null; }
  })()`);
  check('cfg: edited colorway label lands in the spec', cwSpec === 'Midnight', JSON.stringify(cwSpec));

  // ── Mouse callouts editor (ported from the vanilla 6 chip-slot rows) ──
  await nav(send, '/configurator?edit=saga-pro');
  const callouts = await evalJs(send, `(() => {
    const rows = [...document.querySelectorAll('.cfg-callout-row')];
    return {
      slots: rows.map(r => r.querySelector('.cfg-callout-slot')?.textContent.trim()),
      claimed: rows.filter(r => r.querySelector('input[type=checkbox]')?.checked).length,
      ids: rows.map(r => r.querySelectorAll('input[aria-label$="callout id"]')[0]?.value),
    };
  })()`);
  check('cfg: six callout slot rows', JSON.stringify(callouts?.slots) === JSON.stringify(['lt', 'lm', 'lb', 'rt', 'rm', 'rb']), callouts?.slots.join('/'));
  check('cfg: saga-pro claims all six, ids loaded', callouts?.claimed === 6 && callouts?.ids.includes('dpi'), `${callouts?.claimed} claimed · ${callouts?.ids.join(',')}`);

  // Unclaiming a slot drops it from the spec and disables its inputs.
  await evalJs(send, `document.querySelectorAll('.cfg-callout-row')[5].querySelector('input[type=checkbox]').click()`);
  await sleep(350);
  const afterUnclaim = await evalJs(send, `(() => {
    const row = document.querySelectorAll('.cfg-callout-row')[5];
    return { off: row.classList.contains('cfg-off'), disabled: row.querySelector('input[aria-label$="callout id"]').disabled };
  })()`);
  check('cfg: unclaiming a slot dims + disables its row', afterUnclaim?.off === true && afterUnclaim?.disabled === true, JSON.stringify(afterUnclaim));

  // Re-claiming restores the slot in canonical order, not at the end.
  await evalJs(send, `document.querySelectorAll('.cfg-callout-row')[5].querySelector('input[type=checkbox]').click()`);
  await sleep(350);
  const json = await evalJs(send, `(() => {
    try { return JSON.parse(document.querySelector('.cfg-json pre').textContent).features.buttons.callouts.map(c => c.slot); }
    catch (e) { return null; }
  })()`);
  check('cfg: re-claimed slot returns in canonical order, not appended',
    JSON.stringify(json) === JSON.stringify(['lt', 'lm', 'lb', 'rt', 'rm', 'rb']),
    JSON.stringify(json));

  // ── Share link (?spec=) renders a draft with no commit ──
  const b64 = Buffer.from(JSON.stringify({ $schema: 1, id: '', name: 'Draft Headset', type: 'headset', features: { audio: { equalizer: false }, spatial: false } })).toString('base64');
  await nav(send, `/?spec=${encodeURIComponent(b64)}`);
  const specTabs = await evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].map(b => b.getAttribute('aria-label'))`);
  check('share link: ?spec= renders draft canvas', JSON.stringify(specTabs) === JSON.stringify(['Audio', 'Settings']), specTabs?.join('/'));
  check('share link: draft name on dialog', await evalJs(send, `document.querySelector('.dc-canvas')?.getAttribute('aria-label')`) === 'Draft Headset');

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

// CDP walkthrough for the Simple Equalizer preset-creation flow
// (Figma Audio 7557:272603) behind "Add Equalizer Preset" on the headset Audio
// panel. Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
//
// Most of what matters here is invisible to the type checker: whether the dB
// axis actually lines up with the rails it labels, whether a bipolar rail's
// fill grows from the center, whether Escape stops at this modal instead of
// closing the device canvas under it, and whether a created preset survives a
// reload. All of that is measured in a real browser.
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

let loadN = 0;
async function waitFor(send, expr, timeoutMs = 8000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

async function openAudio(send) {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=cloud-iii-s&tab=audio` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  await waitFor(send, `document.querySelector('.hc-eq-list')`);
}

// "Add Equalizer Preset" asks Simple or Advanced first; this suite is the Simple one.
const openEditor = async (send) => {
  const row = await evalJs(send, `(()=>{const r=[...document.querySelectorAll('.ds-list-item')]
    .find(x=>/Add Equalizer Preset/.test(x.textContent||'')); if(!r) return false; r.click(); return true;})()`);
  if (!row) return false;
  await waitFor(send, `document.querySelector('.modal-shell.ceq .ceq-card')`);
  return evalJs(send, `(()=>{const c=[...document.querySelectorAll('.ceq-card')].find(x=>/Simple/i.test(x.textContent||'')); if(!c) return false; c.click(); return true;})()`);
};

// Drive the native range input the way a drag would land.
const setGain = (send, i, v) =>
  evalJs(send, `(()=>{const inp=document.querySelectorAll('.seq-band input[type=range]')[${i}];
    if(!inp) return false;
    const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    set.call(inp,'${v}'); inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.dispatchEvent(new Event('change',{bubbles:true})); return true;})()`);

const panelLabels = (send) =>
  evalJs(send, `[...document.querySelectorAll('.hc-eq-list .ds-list-item')].map(e=>e.textContent.trim())`);

async function main() {
  const target = (await httpJson('/json/list')).find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on('open', r));
  const send = makeSend(ws);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  await openAudio(send);
  await evalJs(send, `localStorage.removeItem('eqPresets'); 1`);
  await openAudio(send);
  const before = await panelLabels(send);

  // ── Opening ──
  check('"Add Equalizer Preset" opens the Simple Equalizer', await openEditor(send));
  await waitFor(send, `document.querySelector('.modal-shell.seq')`);
  let s = await evalJs(send, `(()=>{const m=document.querySelector('.modal-shell.seq'); if(!m) return null; return {
    title: m.querySelector('.breadcrumb-current')?.textContent,
    rails: m.querySelectorAll('.seq-band .ds-rail').length,
    groups: [...m.querySelectorAll('.seq-group')].map(e=>e.textContent),
    hz: [...m.querySelectorAll('.seq-hz-label')].map(e=>e.textContent),
    bench: !!m.querySelector('.seq-bench .ds-dropdown') && !!m.querySelector('.seq-play'),
    bandCount: !!m.querySelector('.seq-editor .seq-band-count .ds-toggle-group'),
  };})()`);
  // The band switcher sits with the stage it changes, not in a full-width modal
  // footer that would also run under the preset rail.
  check('built on ModalShell — title + rail, band switcher inside the editor',
    s?.title === 'Simple Equalizer' && s?.bench && s?.bandCount, String(s?.title));
  check('opens on 5 bands with the named ranges',
    s?.rails === 5 && JSON.stringify(s?.groups) === JSON.stringify(['Bass', 'Low Mids', 'Mids', 'High Mids', 'Highs']),
    `${s?.rails} rails: ${s?.groups?.join('/')}`);
  check('frequency labels match the 5-band set',
    JSON.stringify(s?.hz) === JSON.stringify(['125 Hz', '250 Hz', '1 kHz', '4 kHz', '8 kHz']), s?.hz?.join(', '));

  // ── The axis must share the rails' geometry, or it is decoration ──
  const axis = await evalJs(send, `(()=>{
    const tick=[...document.querySelectorAll('.seq-tick')].find(e=>/^0 dB/.test(e.textContent.trim()));
    const h=document.querySelector('.seq-band .ds-rail-handle');
    if(!tick||!h) return null;
    const t=tick.getBoundingClientRect(), r=h.getBoundingClientRect();
    return Math.round((t.top+t.height/2)-(r.top+r.height/2));})()`);
  check('the 0 dB tick sits on a 0 dB handle', axis !== null && Math.abs(axis) <= 2, `${axis}px off`);

  // ── Bipolar rail: a flat band must not read as half-loud ──
  const flatFill = await evalJs(send, `Math.round(document.querySelector('.seq-band .ds-rail-fill').getBoundingClientRect().height)`);
  check('0 dB shows no fill — the rail grows from the center, not the floor', flatFill <= 3, `${flatFill}px`);
  await setGain(send, 0, 8);
  await setGain(send, 4, -5);
  await sleep(300);
  const signed = await evalJs(send, `(()=>{const f=[...document.querySelectorAll('.seq-band .ds-rail-fill')];
    const mid=(el)=>{const p=el.closest('.ds-rail').getBoundingClientRect(); return p.top+p.height/2;};
    const b=f[0].getBoundingClientRect(), h=f[4].getBoundingClientRect();
    return { boostAbove: Math.round(mid(f[0])-b.bottom) >= -2, cutBelow: Math.round(h.top-mid(f[4])) >= -2,
             boostH: Math.round(b.height), cutH: Math.round(h.height) };})()`);
  check('a boost fills upward and a cut downward from the center',
    signed?.boostAbove && signed?.cutBelow && signed.boostH > 10 && signed.cutH > 10,
    `boost ${signed?.boostH}px up, cut ${signed?.cutH}px down`);

  const curve = await evalJs(send, `document.querySelector('.seq-preset-list .ds-list-item.selected polyline')?.getAttribute('points')`);
  check('the rail preset draws a curve from its own gains', !!curve && curve.split(' ').length === 5, String(curve));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/simple-eq.png`, Buffer.from(shot.data, 'base64'));

  // ── Band count is a property of the preset, so switching resamples it ──
  await evalJs(send, `(()=>{const b=[...document.querySelectorAll('.seq-band-count button')].find(x=>x.textContent.trim()==='10'); b.click(); return 1;})()`);
  await sleep(400);
  const ten = await evalJs(send, `({ rails: document.querySelectorAll('.seq-band .ds-rail').length,
    groups: [...new Set([...document.querySelectorAll('.seq-group')].map(e=>e.textContent))],
    hz: [...document.querySelectorAll('.seq-hz-label')].map(e=>e.textContent),
    first: Number(document.querySelectorAll('.seq-band input[type=range]')[0].value) })`);
  check('10 bands subdivide the same five named ranges',
    ten?.rails === 10 && JSON.stringify(ten?.groups) === JSON.stringify(['Bass', 'Low Mids', 'Mids', 'High Mids', 'Highs']),
    `${ten?.rails} rails across ${ten?.groups?.length} ranges`);
  check('switching band count resamples the curve rather than flattening it', ten?.first === 8, `band 1 = ${ten?.first} dB`);
  await evalJs(send, `(()=>{const b=[...document.querySelectorAll('.seq-band-count button')].find(x=>x.textContent.trim()==='5'); b.click(); return 1;})()`);
  await sleep(300);

  // ── The preset row is a row, not a form ──
  // Selecting a preset used to leave a rename field open in it, which reads as
  // unsaved and takes the caret on every selection. The name is a label; the
  // actions live behind the row's menu (Figma Audio 7557:264412).
  const row = await evalJs(send, `(() => {
    const list = document.querySelector('.seq-preset-list');
    const btn = document.querySelector('.seq-row-menu');
    return {
      noOpenField: !list.querySelector('input'),
      isListItem: !!document.querySelector('.seq-row .ds-list-item.selected'),
      hiddenAtRest: getComputedStyle(btn).opacity === '0',
      focusable: btn.tabIndex >= 0 && getComputedStyle(btn).display !== 'none',
    };
  })()`);
  check('selecting a preset does not open a text field in the row',
    row?.noOpenField === true && row?.isListItem === true,
    `openField=${!row?.noOpenField} listItem=${row?.isListItem}`);
  check('the row menu stays out of the way but in the tab order',
    row?.hiddenAtRest === true && row?.focusable === true,
    `hidden=${row?.hiddenAtRest} focusable=${row?.focusable}`);

  await evalJs(send, `document.querySelector('.seq-row-menu').click(); 1`);
  await sleep(400);
  const menu = await evalJs(send, `(() => {
    const m = document.querySelector('.seq-cmenu');
    if (!m) return null;
    const b = m.getBoundingClientRect();
    const btn = document.querySelector('.seq-row-menu').getBoundingClientRect();
    const top = document.elementFromPoint(b.x + b.width / 2, b.y + 20);
    return {
      items: [...m.querySelectorAll('.ds-list-item')].map((e) => e.textContent.trim()),
      isDsMenu: m.classList.contains('ds-context-menu'),
      portalled: m.parentElement === document.body,
      anchored: Math.round(b.top - btn.bottom) === 4 && Math.round(btn.right - b.right) === 0,
      onTop: !!(top && top.closest('.seq-cmenu')),
    };
  })()`);
  check('the menu carries Rename / Duplicate / Reset / Delete on the DS menu',
    JSON.stringify(menu?.items) === JSON.stringify(['Rename', 'Duplicate', 'Reset', 'Delete']) && menu?.isDsMenu === true,
    menu?.items?.join(', '));
  // Two traps in one check: the rail scrolls, which clips an absolutely
  // positioned child; and .modal-shell's backdrop-filter makes it the
  // containing block for `fixed`, so viewport coordinates land ~110px out.
  // Portalling to <body> is what defeats both.
  check('the menu escapes the scrolling rail and paints above the modal',
    menu?.portalled === true && menu?.anchored === true && menu?.onTop === true,
    `portalled=${menu?.portalled} anchored=${menu?.anchored} onTop=${menu?.onTop}`);

  const clickItem = (label) =>
    evalJs(send, `[...document.querySelectorAll('.seq-cmenu .ds-list-item')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click(); 1`);
  const rowNames = () =>
    evalJs(send, `[...document.querySelectorAll('.seq-row .ds-list-item')].map(e=>e.textContent.trim())`);
  const openRowMenu = (i) =>
    evalJs(send, `document.querySelectorAll('.seq-row-menu')[${i}].click(); 1`);

  await clickItem('Duplicate'); await sleep(400);
  let names = await rowNames();
  check('Duplicate copies the preset without colliding with its name',
    names.length === 2 && names[1] === names[0] + ' copy', names.join(' / '));
  await openRowMenu(1); await sleep(300);
  await clickItem('Reset'); await sleep(300);
  check('Reset flattens the curve',
    Number(await evalJs(send, `document.querySelectorAll('.seq-band input[type=range]')[0].value`)) === 0);
  await openRowMenu(1); await sleep(300);
  await clickItem('Rename'); await sleep(300);
  check('Rename opens the field only when asked',
    await evalJs(send, `!!document.querySelector('.seq-preset-list input')`));
  await evalJs(send, `(()=>{const i=document.querySelector('.seq-preset-list input');
    const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    set.call(i,'Night Mode'); i.dispatchEvent(new Event('input',{bubbles:true}));
    i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return 1;})()`);
  await sleep(400);
  names = await rowNames();
  check('Enter commits the name and closes the field',
    names[1] === 'Night Mode' && !(await evalJs(send, `!!document.querySelector('.seq-preset-list input')`)),
    names.join(' / '));
  await openRowMenu(1); await sleep(300);
  await clickItem('Delete'); await sleep(400);
  check('Delete removes just that preset', (await rowNames()).length === 1, (await rowNames()).join(' / '));

  // ── Escape stops here: DeviceModalHost listens on document (TH-353) ──
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(600);
  const esc = await evalJs(send, `({ eq: !!document.querySelector('.modal-shell.seq'), canvas: !!document.querySelector('.ds-ng3-panel') })`);
  check('Escape closes the editor and leaves the device canvas open', esc?.eq === false && esc?.canvas === true,
    `eq=${esc?.eq} canvas=${esc?.canvas}`);

  // ── The preset is real: it joins the panel list and outlives a reload ──
  const after = await panelLabels(send);
  check('the new preset joins the panel EQ list beside the factory ones',
    after.length === before.length + 1 && after[after.length - 1] === 'Simple EQ 1',
    `${before.length} → ${after.length}, last "${after[after.length - 1]}"`);

  await openAudio(send);
  const reloaded = await panelLabels(send);
  check('it survives a reload', JSON.stringify(reloaded) === JSON.stringify(after), reloaded.slice(-2).join(', '));

  // ── An abandoned "Add" must not litter the list ──
  await openEditor(send);
  await waitFor(send, `document.querySelector('.modal-shell.seq')`);
  await evalJs(send, `document.querySelector('.modal-shell.seq .modal-close').click(); 1`);
  await sleep(500);
  const untouched = await panelLabels(send);
  check('closing without touching a slider adds nothing',
    JSON.stringify(untouched) === JSON.stringify(reloaded), `${untouched.length} rows`);

  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/simple-eq-panel.png`, Buffer.from(shot.data, 'base64'));

  // Leave the profile as we found it — this suite creates a preset, and the
  // headset suite counts EQ rows.
  await evalJs(send, `localStorage.removeItem('eqPresets'); 1`);

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

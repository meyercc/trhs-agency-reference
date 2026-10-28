// CDP walkthrough for the macro keys editor (OpenGSW keys-macros): P1–P4 each
// take a macro (by list, drag or the key's menu), key changes wait for Apply,
// Create new makes a keystroke, multi-key, launcher or text macro, the test
// area plays it, and leaving asks first. Opened on its own at #/modal-lab.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

const OUT = process.argv[2] || tmpdir();
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

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}


const click = (send, sel) => evalJs(send, `document.querySelector(${JSON.stringify(sel)}).click(); 1`);
const clickText = (send, scope, text) => evalJs(send, `(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(scope)})].find(b => b.textContent.trim() === ${JSON.stringify(text)});
  if (!b) throw new Error('no ${text} in ${scope}');
  b.click(); return 1;
})()`);
const keyTap = async (send, key, code, vk, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers, text: key.length === 1 && !modifiers ? key : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
};
const setValue = (send, sel, value) => evalJs(send, `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return el.value;
})()`);
const setSelect = (send, label, value) => setValue(send, `select[aria-label=${JSON.stringify(label)}]`, value);
const selText = (send, label) => evalJs(send, `(() => {
  const el = document.querySelector('select[aria-label=${JSON.stringify(label)}]');
  return el.options[el.selectedIndex].textContent;
})()`);
const out = (send) => evalJs(send, `document.querySelector('textarea[aria-label="Test area"]').value`);
const disabled = (send, text) => evalJs(send, `[...document.querySelectorAll('.mp-foot button, .mp-actions button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).disabled`);
const state = (send) => evalJs(send, `document.querySelector('.mp-foot .mp-state').textContent`);
const libNames = (send) => evalJs(send, `[...document.querySelectorAll('.mp-lib .mp-row-name')].map(n => n.textContent).join('|')`);
// Drag a library row onto a key, the way the browser reports it.
const drag = (send, name, key) => evalJs(send, `(() => {
  const row = [...document.querySelectorAll('.mp-lib .mp-row')].find(r => r.querySelector('.mp-row-name').textContent === ${JSON.stringify(name)});
  const cap = document.querySelector('.mp-keyrow[data-key="${key}"] .mp-cap');
  const dt = new DataTransfer();
  row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  cap.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  cap.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return 1;
})()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${Date.now() % 1e7}#/modal-lab` });
  await waitFor(send, `document.readyState === 'complete'`);
  await evalJs(send, `localStorage.removeItem('macros'); localStorage.removeItem('macroKeys'); 1`);
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${Date.now() % 1e7}#/modal-lab` });
  await waitFor(send, `document.querySelector('[data-testid="macro-keys"]')`);

  // ── Opens on its own, four keys only ──────────────────────────────────────
  check('opens on its own at #/modal-lab', await evalJs(send, `!!document.querySelector('[data-testid="macro-keys"]')`));
  check('four keys: P1 to P4, nothing else takes a macro',
    (await evalJs(send, `[...document.querySelectorAll('.mp-keyrow')].map(r => r.dataset.key).join(',')`)) === 'P1,P2,P3,P4');
  check('starts from two macros in the library', (await libNames(send)) === 'Quick buy|Ping and call');
  check('P2 and P3 hold the starter macros, P1 and P4 are Unassigned',
    (await selText(send, 'P2 plays')) === 'Quick buy' && (await selText(send, 'P3 plays')) === 'Ping and call'
      && (await selText(send, 'P1 plays')) === 'Unassigned' && (await selText(send, 'P4 plays')) === 'Unassigned');
  check('the library row names the key its macro sits on',
    await evalJs(send, `[...document.querySelectorAll('.mp-lib .mp-row')].map(r => r.querySelector('.mp-tag')?.textContent).join(',') === 'P2,P3'`));

  // ── Changes wait for Apply (keys-macros.13) ───────────────────────────────
  check('nothing changed: Applied, Apply and Discard are off', (await state(send)) === 'Applied' && (await disabled(send, 'Apply')) && (await disabled(send, 'Discard changes')));
  await setSelect(send, 'P1 plays', 'm-buy');
  await waitFor(send, `document.querySelector('.mp-foot .mp-state').textContent === 'Not applied'`);
  check('assigning a macro to P1 moves it off P2 (one macro, one key), and waits for Apply',
    (await selText(send, 'P1 plays')) === 'Quick buy' && (await selText(send, 'P2 plays')) === 'Unassigned'
      && (await state(send)) === 'Not applied' && !(await disabled(send, 'Apply')));
  await evalJs(send, `localStorage.getItem('macroKeys')`).then((v) => check('before Apply nothing is saved', v === null, String(v)));
  await clickText(send, '.mp-foot button', 'Discard changes');
  await waitFor(send, `document.querySelector('.mp-foot .mp-state').textContent === 'Applied'`);
  check('Discard changes puts the keys back',
    (await selText(send, 'P1 plays')) === 'Unassigned' && (await selText(send, 'P2 plays')) === 'Quick buy');
  await setSelect(send, 'P1 plays', 'm-buy');
  await clickText(send, '.mp-foot button', 'Apply');
  await waitFor(send, `document.querySelector('.mp-foot .mp-state').textContent === 'Applied'`);
  await evalJs(send, `location.reload(); 1`);
  await waitFor(send, `document.querySelector('[data-testid="macro-keys"]')`);
  check('Apply keeps the keys after a reload (keys-macros.16)', (await selText(send, 'P1 plays')) === 'Quick buy');

  // ── Drag a macro onto a key ───────────────────────────────────────────────
  await drag(send, 'Ping and call', 'P4');
  await waitFor(send, `document.querySelector('.mp-keyrow[data-key="P4"] select').value === 'm-ping'`);
  check('dragging a macro onto P4 puts it there and takes it off P3',
    (await selText(send, 'P4 plays')) === 'Ping and call' && (await selText(send, 'P3 plays')) === 'Unassigned');

  // ── The key's menu: New, Edit, Assign ─────────────────────────────────────
  await click(send, '.mp-keyrow[data-key="P2"] .mp-cap');
  await waitFor(send, `document.querySelector('.mp-menu')`);
  check('a key opens a menu: New, Edit, Assign',
    await evalJs(send, `(() => { const t = document.querySelector('.mp-menu').textContent; return /New/.test(t) && /Edit/.test(t) && /Assign/.test(t); })()`));
  await clickText(send, '.mp-menu [role="option"]', 'Quick buy');
  await waitFor(send, `!document.querySelector('.mp-menu')`);
  check('Assign in the menu puts the macro there and closes it',
    (await selText(send, 'P2 plays')) === 'Quick buy' && (await selText(send, 'P1 plays')) === 'Unassigned');
  await click(send, '.mp-keyrow[data-key="P2"] .mp-cap');
  await waitFor(send, `document.querySelector('.mp-menu')`);
  await keyTap(send, 'Escape', 'Escape', 27);
  check('Escape closes the menu', await waitFor(send, `!document.querySelector('.mp-menu')`));
  await clickText(send, '.mp-foot button', 'Reset to default');
  await waitFor(send, `[...document.querySelectorAll('.mp-keyrow select')].every(s => s.value === '')`);
  check('Reset to default: every key Unassigned, waiting for Apply', (await state(send)) === 'Not applied');
  await clickText(send, '.mp-foot button', 'Discard changes');
  await waitFor(send, `document.querySelector('.mp-foot .mp-state').textContent === 'Applied'`);
  check('…and Discard brings the applied keys back', (await selText(send, 'P1 plays')) === 'Quick buy');

  // ── Create new from a key's menu: keystroke ───────────────────────────────
  await click(send, '.mp-keyrow[data-key="P3"] .mp-cap');
  await waitFor(send, `document.querySelector('.mp-menu')`);
  await clickText(send, '.mp-menu [role="option"]', 'New');
  await waitFor(send, `document.querySelector('.mp-editor')`);
  check('New opens the editor on the Keystroke tab, named KEYSTROKE 1',
    (await evalJs(send, `document.querySelector('input[aria-label="Macro name"]').value`)) === 'KEYSTROKE 1'
      && (await evalJs(send, `!!document.querySelector('input[aria-label="Key combination"]')`)));
  check('the name takes at most 18 characters', (await evalJs(send, `document.querySelector('input[aria-label="Macro name"]').maxLength`)) === 18);
  check('Save is off until a combination is typed', await disabled(send, 'Save'));
  await evalJs(send, `document.querySelector('input[aria-label="Key combination"]').focus(); 1`);
  await keyTap(send, 'a', 'KeyA', 65, 2);
  await waitFor(send, `document.querySelector('input[aria-label="Key combination"]').value !== ''`);
  check('a combination is read, not run: Ctrl + A', (await evalJs(send, `document.querySelector('input[aria-label="Key combination"]').value`)) === 'Ctrl + A');
  check('the page did not select-all (keys-macros.29)', await evalJs(send, `window.getSelection().toString() === ''`));
  await clickText(send, '.mp-actions button', 'Save');
  await waitFor(send, `document.querySelector('[data-testid="macro-keys"]')`);
  check('Save adds it to the library, and it sits on P3 (not applied yet)',
    (await libNames(send)) === 'Quick buy|Ping and call|KEYSTROKE 1' && (await selText(send, 'P3 plays')) === 'KEYSTROKE 1' && (await state(send)) === 'Not applied');
  check('its line reads the combination',
    await evalJs(send, `[...document.querySelectorAll('.mp-lib .mp-row')].pop().querySelector('.mp-row-sub').textContent === 'Ctrl + A'`));

  // ── Text ──────────────────────────────────────────────────────────────────
  await clickText(send, '.mp-lib button', 'Create new');
  await waitFor(send, `document.querySelector('.mp-editor')`);
  await clickText(send, '.mp-editor [role="radio"], .mp-editor button', 'Text');
  await waitFor(send, `document.querySelector('textarea[aria-label="Custom text"]')`);
  check('switching to Text renames the untouched name to TEXT 1',
    (await evalJs(send, `document.querySelector('input[aria-label="Macro name"]').value`)) === 'TEXT 1');
  check('Text: blank text shows the error and Save stays off',
    (await evalJs(send, `/cannot be left blank/.test(document.querySelector('.mp-editor').textContent)`)) && (await disabled(send, 'Save')));
  await setValue(send, 'textarea[aria-label="Custom text"]', 'Hi there');
  await clickText(send, '.mp-editor button', 'Play');
  await waitFor(send, `document.querySelector('textarea[aria-label="Test area"]').value.length >= 8`);
  check('Text: the test area types it, capital and all', (await out(send)) === 'Hi there', await out(send));
  await clickText(send, '.mp-actions button', 'Save');
  await waitFor(send, `document.querySelector('[data-testid="macro-keys"]')`);
  check('Save adds TEXT 1', (await libNames(send)).endsWith('|TEXT 1'));

  // ── Launcher ──────────────────────────────────────────────────────────────
  await clickText(send, '.mp-lib button', 'Create new');
  await waitFor(send, `document.querySelector('.mp-editor')`);
  await clickText(send, '.mp-editor button', 'Launcher');
  await waitFor(send, `document.querySelector('select[aria-label="Program to open"]')`);
  check('Launcher: Save is off until a program is chosen', await disabled(send, 'Save'));
  await setSelect(send, 'Program to open', 'Notepad');
  check('Launcher: choosing a program turns Save on', !(await disabled(send, 'Save')));
  await clickText(send, '.mp-actions button', 'Save');
  await waitFor(send, `document.querySelector('[data-testid="macro-keys"]')`);
  check('the launcher line says what it opens',
    await evalJs(send, `[...document.querySelectorAll('.mp-lib .mp-row')].pop().querySelector('.mp-row-sub').textContent === 'Opens Notepad'`));

  // ── Multi-key: record, steps, delays, play modes ──────────────────────────
  await clickText(send, '.mp-lib button', 'Create new');
  await waitFor(send, `document.querySelector('.mp-editor')`);
  await clickText(send, '.mp-editor button', 'Multi-key');
  await waitFor(send, `document.querySelector('.mp-record')`);
  check('Multi-key starts with no steps and a read-only test area (keys-macros.12)',
    (await evalJs(send, `document.querySelectorAll('.mp-step').length`)) === 0 && (await evalJs(send, `document.querySelector('textarea[aria-label="Test area"]').readOnly`)));
  await clickText(send, '.mp-editor button', 'Record');
  await waitFor(send, `document.querySelector('.mp-rec-dot.on')`);
  const y0 = await evalJs(send, `window.scrollY`);
  await keyTap(send, 'h', 'KeyH', 72);
  await keyTap(send, 'i', 'KeyI', 73);
  await keyTap(send, 'ArrowDown', 'ArrowDown', 40);
  check('recording: arrow keys go to the recorder, the page stays still (keys-macros.10)',
    (await evalJs(send, `window.scrollY`)) === y0 && (await evalJs(send, `document.querySelectorAll('.mp-step').length`)) === 6);
  await clickText(send, '.mp-editor button', 'Stop');
  await evalJs(send, `[...document.querySelectorAll('.mp-step-del')].pop().click(); 1`);
  await evalJs(send, `[...document.querySelectorAll('.mp-step-del')].pop().click(); 1`);
  check('steps can be removed', (await evalJs(send, `document.querySelectorAll('.mp-step').length`)) === 4);
  await clickText(send, '.mp-editor button', 'None');
  check('Fixed delay starts at 300 ms (keys-macros.5)',
    await evalJs(send, `[...document.querySelectorAll('.mp-editor button')].some(b => b.textContent.trim() === 'Fixed 300 ms')`));
  await setValue(send, 'input[aria-label="Macro name"]', 'Say hi');
  await clickText(send, '.mp-editor button', 'Play');
  await waitFor(send, `document.querySelector('textarea[aria-label="Test area"]').value.length >= 2`);
  check('test area: once types the macro (hi)', (await out(send)) === 'hi', await out(send));
  await clickText(send, '.mp-editor button', 'Clear');
  await clickText(send, '.mp-editor button', 'Repeat');
  await waitFor(send, `document.querySelector('.mp-repeat input')`);
  await clickText(send, '.mp-editor button', 'Play');
  await waitFor(send, `document.querySelector('textarea[aria-label="Test area"]').value.length >= 6`);
  check('test area: repeat 3 plays three times', (await out(send)) === 'hihihi', await out(send));
  await clickText(send, '.mp-editor button', 'Clear');
  await clickText(send, '.mp-editor button', 'On and off');
  await clickText(send, '.mp-editor button', 'Turn on');
  await waitFor(send, `document.querySelector('textarea[aria-label="Test area"]').value.length >= 6`);
  await clickText(send, '.mp-editor button', 'Turn off');
  await sleep(300);
  const settled = (await out(send)).length;
  await sleep(300);
  check('test area: on and off keeps playing until turned off, then stops',
    settled >= 6 && (await out(send)).length === settled, `${settled} chars`);
  await clickText(send, '.mp-editor button', 'Clear');
  await clickText(send, '.mp-editor button', 'While held');
  await evalJs(send, `(() => { const b = [...document.querySelectorAll('.mp-editor button')].find(b => b.textContent.trim() === 'Hold to play'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.__hb = b; })()`);
  await waitFor(send, `document.querySelector('textarea[aria-label="Test area"]').value.length >= 4`);
  await evalJs(send, `window.__hb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); 1`);
  await sleep(300);
  const held = (await out(send)).length;
  await sleep(300);
  check('test area: while held repeats, then finishes its last run after release',
    held >= 4 && held % 2 === 0 && (await out(send)).length === held, `${held} chars`);

  // ── Leaving asks; Save adds ───────────────────────────────────────────────
  await click(send, '.mp-back');
  await waitFor(send, `document.querySelector('.mp-ask')`);
  check('leaving unsaved changes asks first (keys-macros.14)', await evalJs(send, `!!document.querySelector('.mp-ask')`));
  await clickText(send, '.mp-ask button', 'Keep editing');
  await clickText(send, '.mp-actions button', 'Save');
  await waitFor(send, `document.querySelector('[data-testid="macro-keys"]')`);
  check('Save adds it to the library', (await libNames(send)).endsWith('|Say hi'));
  check('the draft of the keys survived writing macros', (await state(send)) === 'Not applied' && (await selText(send, 'P3 plays')) === 'KEYSTROKE 1');

  // ── Copy and delete ───────────────────────────────────────────────────────
  const before = await evalJs(send, `document.querySelectorAll('.mp-lib .mp-row').length`);
  await click(send, 'button[aria-label="Copy Say hi"]');
  check('Copy adds a copy of the macro', (await evalJs(send, `document.querySelectorAll('.mp-lib .mp-row').length`)) === before + 1 && (await libNames(send)).endsWith('Say hi copy'));
  await click(send, 'button[aria-label="Delete KEYSTROKE 1"]');
  await waitFor(send, `!/KEYSTROKE 1/.test([...document.querySelectorAll('.mp-lib .mp-row-name')].map(n => n.textContent).join('|'))`);
  check('deleting a macro frees its key', (await selText(send, 'P3 plays')) === 'Unassigned');

  // ── Rest of the keyboard is not offered here ──────────────────────────────
  check('no full-keyboard remapping in this editor',
    await evalJs(send, `!document.querySelector('[data-testid="macro-keys"] .pdm-keycap, [data-testid="macro-keys"] input[type=search]')`));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/macros.png`, Buffer.from(shot.data, 'base64'));
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

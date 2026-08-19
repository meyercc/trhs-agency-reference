// CDP walkthrough for the onboard-profile bar — the software profile vs the
// device's onboard slots, and the software-only locking that goes with it.
//
// The model: selecting IS switching. Picking a slot puts the device on it and
// picking the software profile hands the device back — there is no preview and
// no separate Activate, so scope and activeSlot are one fact. Saving is still
// its own act, because it writes flash. A disconnected device disables the bar.
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

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const SNAP = `(() => {
  const bar = document.querySelector('.pb');
  const store = JSON.parse(localStorage.getItem('device-onboard') || '{}');
  return {
    hasBar: !!bar,
    // Two halves now — the software profile and the device's onboard memory.
    // Selected/on-device live on the half so the split onboard control (body +
    // chevron) reads as one pill.
    opts: [...document.querySelectorAll('.pb-half')].map(h => ({
      kicker: h.querySelector('.pb-opt-kicker')?.textContent.trim(),
      name: h.querySelector('.pb-opt-name')?.textContent.trim(),
      selected: h.querySelector('.pb-opt')?.getAttribute('aria-checked') === 'true',
      onDevice: h.classList.contains('on-device'),
    })),
    popOpen: !!document.querySelector('.pb-pop'),
    slots: [...document.querySelectorAll('.pb-pop .ds-list-item')].map(r => ({
      label: r.querySelector('.ds-list-item-label')?.textContent.trim(),
      selected: r.getAttribute('aria-selected') === 'true',
      running: /Running/.test(r.textContent),
    })),
    note: document.querySelector('.pb-note')?.textContent.replace(/\\s+/g,' ').trim() ?? null,
    // The onboard confirmation retires after a beat, fading in place rather
    // than unmounting — so "what does the note say" and "is it still showing"
    // are two different questions, and only the computed style answers the
    // second one.
    // The actions row is out of flow, so the bar must measure the same in every
    // state — software scope, on a slot, mid-edit.
    barHeight: document.querySelector('.pb')?.getBoundingClientRect().height ?? null,
    noteVisible: (() => {
      const n = document.querySelector('.pb-note');
      if (!n) return null;
      const cs = getComputedStyle(n);
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01;
    })(),
    // Out of flow the row no longer widens the bar to fit itself, so a wrapped
    // note is the tell that it got clamped to the pill row's width instead.
    noteLines: (() => {
      const n = document.querySelector('.pb-note');
      if (!n) return null;
      const lh = parseFloat(getComputedStyle(n).lineHeight) || 19;
      return Math.round(n.getBoundingClientRect().height / lh);
    })(),
    buttons: [...document.querySelectorAll('.pb-actions .ds-btn')].map(b => b.textContent.trim()),
    bindShown: !!document.querySelector('.pb-bind'),
    barDisabled: !!document.querySelector('.pb-row.disabled'),
    optsInert: [...document.querySelectorAll('.pb-opt, .pb-chev')].every(b => b.disabled),
    // Locked regions: the centred overlay message, whether the body is inert,
    // and whether the message actually sits over the region it describes.
    locks: [...document.querySelectorAll('.ds-sw-only.locked')].map(l => {
      const ov = l.querySelector('.ds-status-overlay-box');
      const lr = l.getBoundingClientRect(), or = ov?.getBoundingClientRect();
      return {
        text: ov?.textContent.replace(/\\s+/g, ' ').trim(),
        inert: l.querySelector('.ds-sw-only-body')?.hasAttribute('inert'),
        // Centred within the locked region, within a pixel of rounding.
        centered: or ? Math.abs((or.left + or.right) / 2 - (lr.left + lr.right) / 2) < 2
                    && Math.abs((or.top + or.bottom) / 2 - (lr.top + lr.bottom) / 2) < 2 : null,
        // The box must not spill outside the region it belongs to.
        contained: or ? or.left >= lr.left - 1 && or.right <= lr.right + 1 : null,
        lines: ov ? Math.round(or.height / 19) : null,
      };
    }),
    unlockedRegions: document.querySelectorAll('.ds-sw-only:not(.locked)').length,
    brightness: document.querySelector('.pdm-bright-val')?.textContent.trim() ?? null,
    store,
  };
})()`;

let loadN = 0;
async function open(send, sku, tab) {
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
  return evalJs(send, SNAP);
}

// The software half is a plain radio; the onboard half is a split control —
// its body selects the scope at the slot on show, its chevron opens the list.
const clickSoftware = (send) => evalJs(send, `document.querySelector('.pb-half .pb-opt').click()`);
const clickOnboard = (send) => evalJs(send, `document.querySelector('.pb-onboard .pb-opt').click()`);
const openPop = async (send) => {
  await evalJs(send, `document.querySelector('.pb-chev').click()`);
  await waitFor(send, `document.querySelector('.pb-pop .ds-list-item')`);
};
/** Choose slot `i` (0-based) from the collapsed list. */
const pickSlot = async (send, i) => {
  await openPop(send);
  await evalJs(send, `document.querySelectorAll('.pb-pop .ds-list-item')[${i}].click()`);
  await waitFor(send, `!document.querySelector('.pb-pop')`);
};
/** How many slots the device offers — only countable with the list open. */
const slotCount = async (send) => {
  await openPop(send);
  const n = await evalJs(send, `document.querySelectorAll('.pb-pop .ds-list-item').length`);
  await evalJs(send, `document.querySelector('.pb-chev').click()`);
  await waitFor(send, `!document.querySelector('.pb-pop')`);
  return n;
};
const clickBtn = (send, text) =>
  evalJs(send, `[...document.querySelectorAll('.pb-actions .ds-btn')].find(b => b.textContent.includes(${JSON.stringify(text)})).click()`);
const setBrightness = (send, v) => evalJs(send, `(() => {
  const s = document.querySelector('.pdm-bright-slider input[type=range]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(s, '${v}');
  s.dispatchEvent(new Event('input', { bubbles: true }));
  s.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('device-sim')`);

  // ── The bar only exists where onboard memory does ──────────────────────────
  let s = await open(send, 'pulse-27', 'display');
  check('monitor (0 slots): no bar at all, not a one-option radio', s?.hasBar === false);

  s = await open(send, 'forge-45l-gpu');
  check('long-tail component: no bar', s?.hasBar === false);

  s = await open(send, 'origins-65', 'lighting');
  check('bar is two halves, not a run of options', s?.opts.length === 2, s?.opts.map((o) => o.name).join('/'));
  check('keyboard: 3 slots, collapsed into the onboard half', (await slotCount(send)) === 3);
  check('software option is labelled a different KIND of thing than a slot',
    s?.opts[0].kicker === 'Software profile' && /On the keyboard/i.test(s?.opts[1].kicker ?? ''),
    `${s?.opts[0].kicker} vs ${s?.opts[1].kicker}`);
  check('collapsed onboard half starts on Slot 1', s?.opts[1].name === 'Slot 1', s?.opts[1].name);
  check('software profile selected by default', s?.opts[0].selected === true);
  check('nothing locked in software scope', s?.locks.length === 0 && s?.unlockedRegions > 0, `${s?.unlockedRegions} unlocked`);
  check('no slot claims to be on the device yet', s?.opts.every((o) => !o.onDevice));
  // Everything in the actions row comes and goes on its own timing, so it sits
  // out of flow: the bar is one height in every state and the hero below it
  // never moves. Baseline taken in software scope, where the row is absent.
  const barH = s?.barHeight;

  // ── Selecting a slot IS switching the device to it ───────────────────────
  await pickSlot(send, 0);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('slot selected: the device is switched to it, no second step',
    s?.opts[1].onDevice === true && s?.store.byDevice['origins-65']?.activeSlot === 0,
    JSON.stringify(s?.store.byDevice['origins-65']));
  check('switching is activation only — nothing written to flash',
    !s?.store.byDevice['origins-65']?.slots?.[0], JSON.stringify(s?.store.byDevice['origins-65']?.slots));
  check('no Activate step survives — selecting already did it',
    !s?.buttons.some((b) => /Activate/.test(b)), s?.buttons.join('/') || '(no buttons)');
  check('no binding control anywhere — the pin model is gone', s?.bindShown === false);
  check('note says what is running and that it travels', /travels with it/.test(s?.note ?? ''), s?.note);
  check('slot selected: software-only region locks rather than disappearing',
    s?.locks.length === 1 && /^Software Only/.test(s.locks[0].text ?? ''), JSON.stringify(s?.locks[0]?.text));
  check('locked region: message is centred over the region it describes',
    s?.locks[0]?.centered === true && s?.locks[0]?.contained === true, JSON.stringify(s?.locks[0]));
  check('locked region is genuinely inert (out of tab order)', s?.locks[0]?.inert === true);
  check('locked region explains why', /onboard slot stores one static color set/.test(s?.locks[0]?.text ?? ''), s?.locks[0]?.text);
  check('onboard-capable controls stay live (brightness rail)', s?.brightness !== null, `brightness=${s?.brightness}`);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pb-onslot.png`, Buffer.from(shot.data, 'base64'));

  // ── The confirmation retires; the standing state does not ────────────────
  // The note explains how the device got onto this slot, which stops being
  // news. It fades in place after ~5s — in place, so the row keeps its height
  // and nothing below the bar moves on a timer — and the bar itself goes on
  // carrying what is actually running.
  check('the confirmation is up at the moment of the switch', s?.noteVisible === true);
  check('the note arriving does not resize the bar', s?.barHeight === barH, `${barH} → ${s?.barHeight}`);
  await sleep(6000);
  s = await evalJs(send, SNAP);
  check('confirmation retires itself after ~5s', s?.noteVisible === false, `note reads "${s?.note}"`);
  check('retiring costs no layout either — nothing below the bar moves', s?.barHeight === barH, `${barH} → ${s?.barHeight}`);
  check('what is running stays readable on the bar once the note has gone',
    s?.opts[1].onDevice === true && /On the keyboard/i.test(s?.opts[1].kicker ?? ''), s?.opts[1].kicker);
  await pickSlot(send, 1);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('a fresh switch brings the confirmation back', s?.noteVisible === true && /travels with it/.test(s?.note ?? ''), s?.note);
  await pickSlot(send, 0);
  await sleep(400);

  // ── The software half hands the device back ──────────────────────────────
  await clickSoftware(send);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('software half hands the device back in one click',
    s?.store.byDevice['origins-65']?.activeSlot === null && s?.opts.every((o) => !o.onDevice),
    JSON.stringify(s?.store.byDevice['origins-65']));
  check('handing back: locks release', s?.locks.length === 0);
  check('handing back: the onboard half still points at the slot it was on',
    s?.opts[1].name === 'Slot 1', s?.opts[1].name);

  // ── Editing an onboard-capable control still needs an explicit Save ──────
  // Activation is free; a Save writes flash, so it stays a deliberate act.
  await clickOnboard(send);
  await sleep(400);
  await setBrightness(send, 42);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('edit in a slot: Undo + Save appear', s?.buttons.includes('Undo') && s?.buttons.some((b) => /Save to Slot 1/.test(b)), s?.buttons.join('/'));
  check('edit in a slot: warns it is not on the device yet', /Unsaved changes/.test(s?.note ?? ''), s?.note);
  check('Save/Undo arriving does not resize the bar', s?.barHeight === barH, `${barH} → ${s?.barHeight}`);
  check('the warning sits on one line beside its buttons, not wrapped under them',
    (s?.noteLines ?? 0) === 1, `${s?.noteLines} lines`);
  check('edit in a slot: nothing written to flash yet', !s?.store.byDevice['origins-65']?.slots?.[0]);
  // Only the confirmation retires. This one is actionable and belongs with the
  // buttons beside it, so it has to still be there when the user comes back.
  await sleep(6000);
  s = await evalJs(send, SNAP);
  check('the unsaved warning does NOT retire — it is actionable',
    s?.noteVisible === true && /Unsaved changes/.test(s?.note ?? ''), s?.note);

  await clickBtn(send, 'Undo');
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('undo: brightness reverts and the dirty state clears',
    s?.brightness === '100' && !s?.buttons.includes('Undo'), `brightness=${s?.brightness} buttons=${s?.buttons.join('/')}`);

  await setBrightness(send, 42);
  await sleep(300);
  await clickBtn(send, 'Save to Slot 1');
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('save: the only path that writes to the slot',
    s?.store.byDevice['origins-65']?.slots?.['0']?.['lighting.brightness'] === 42,
    JSON.stringify(s?.store.byDevice['origins-65']?.slots));
  check('save: dirty state clears', !s?.buttons.includes('Undo'), s?.buttons.join('/'));

  // Slots hold distinct contents — slot 2 must not show slot 1's brightness.
  await pickSlot(send, 1);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('slot 2 shows its own (empty) contents, not what slot 1 holds', s?.brightness === '100', `brightness=${s?.brightness}`);
  check('picking another slot switches the device to it too',
    s?.opts[1].name === 'Slot 2' && s?.opts[1].onDevice === true && s?.store.byDevice['origins-65']?.activeSlot === 1,
    `${s?.opts[1].name} onDevice=${s?.opts[1].onDevice}`);
  await pickSlot(send, 0);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('slot 1 still holds what was saved to it', s?.brightness === '42', `brightness=${s?.brightness}`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pb-saved.png`, Buffer.from(shot.data, 'base64'));

  // ── A device that isn't here cannot be switched ──────────────────────────
  await evalJs(send, `(() => {
    const s = JSON.parse(localStorage.getItem('device-sim') || '{}');
    s.byDevice = { ...(s.byDevice||{}), 'origins-65': { connected: false, deviceSlot: 0, slotAtDisconnect: 0 } };
    localStorage.setItem('device-sim', JSON.stringify(s));
  })()`);
  s = await open(send, 'origins-65', 'lighting');
  check('disconnected: the whole bar is disabled', s?.barDisabled === true && s?.optsInert === true,
    `disabled=${s?.barDisabled} inert=${s?.optsInert}`);
  check('disconnected: the note says why, in words', /Disconnected — the keyboard is away/.test(s?.note ?? ''), s?.note);
  check('disconnected: no Save or Undo offered', s?.buttons.length === 0, s?.buttons.join('/'));
  const beforeAway = JSON.stringify(s?.store.byDevice['origins-65']);
  await evalJs(send, `document.querySelector('.pb-onboard .pb-opt').click()`);
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('disconnected: clicking the half changes nothing',
    JSON.stringify(s?.store.byDevice['origins-65']) === beforeAway, beforeAway);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pb-disconnected.png`, Buffer.from(shot.data, 'base64'));
  await evalJs(send, `localStorage.removeItem('device-sim')`);

  // ── Onboard state survives closing the panel ─────────────────────────────
  // Scope is derived from what the device runs, so reopening lands on the slot
  // rather than resetting to the software profile — the panel shows the truth
  // about the hardware from the first frame.
  s = await open(send, 'origins-65', 'lighting');
  check('reopening: the device is still on its slot', s?.opts[1].onDevice === true);
  check('reopening: the panel opens on that slot, not on the software profile',
    s?.opts[1].selected === true && s?.opts[0].selected === false && s?.opts[1].name === 'Slot 1',
    `${s?.opts[1].name} selected=${s?.opts[1].selected}`);
  check('reopening: the slot it holds is still what was saved', s?.brightness === '42', `brightness=${s?.brightness}`);
  await openPop(send);
  s = await evalJs(send, SNAP);
  check('slot list names the running slot in words, not just the dot',
    s?.slots[0]?.running === true && s?.slots.slice(1).every((r) => !r.running),
    s?.slots.map((r) => r.label + (r.running ? '(running)' : '')).join('/'));
  await evalJs(send, `document.querySelector('.pb-pop .ds-list-item').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(send, `!document.querySelector('.pb-pop')`);
  check('a11y: Escape closes the list and hands focus back to the chevron',
    await evalJs(send, `document.activeElement?.classList.contains('pb-chev')`) === true);

  // ── The split differs per device ─────────────────────────────────────────
  s = await open(send, 'quadcast-2-s', 'effects');
  check('mic: 2 slots', (await slotCount(send)) === 2);
  await pickSlot(send, 0);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('mic: the whole effects chain locks (DSP runs on the PC)',
    s?.locks.length === 1 && /processing chain runs on the PC/.test(s?.locks[0]?.text ?? ''), s?.locks[0]?.text);

  s = await open(send, 'cloud-iii-s', 'audio');
  await pickSlot(send, 0);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('headset: EQ curves lock, volume/mic stay onboard',
    s?.locks.length === 1 && /curve presets/.test(s?.locks[0]?.text ?? ''), s?.locks[0]?.text);
  check('narrow column: the same box wraps to multiple lines', (s?.locks[0]?.lines ?? 0) >= 2, `${s?.locks[0]?.lines} lines`);

  // ── Keyboard operability: role="radio" promises arrow keys ──────────────
  // Cleared first: scope follows the device now, so a leftover active slot
  // would open the panel on the onboard half and flip the roving tab stop.
  await evalJs(send, `localStorage.removeItem('device-onboard')`);
  s = await open(send, 'origins-65', 'lighting');
  const tabStops = await evalJs(send, `[...document.querySelectorAll('.pb-opt')].map(o => o.tabIndex)`);
  check('a11y: roving tabindex — only the selected half is a tab stop',
    JSON.stringify(tabStops) === JSON.stringify([0, -1]), JSON.stringify(tabStops));
  check('a11y: the chevron is its own tab stop, reachable with Tab',
    await evalJs(send, `document.querySelector('.pb-chev').tabIndex`) === 0);
  await evalJs(send, `(() => {
    const row = document.querySelector('.pb-row');
    row.querySelector('.pb-opt').focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  })()`);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('a11y: ArrowRight moves to the onboard half — and switches the device',
    s?.opts[1].selected === true && s?.store.byDevice['origins-65']?.activeSlot === 0,
    s?.opts.map((o) => (o.selected ? '[' + o.name + ']' : o.name)).join(' '));
  check('a11y: focus follows the arrow key',
    await evalJs(send, `document.activeElement?.querySelector('.pb-opt-name')?.textContent.trim()`) === 'Slot 1');
  await evalJs(send, `document.querySelector('.pb-row').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))`);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('a11y: Home jumps back to the software half, handing the device back',
    s?.opts[0].selected === true && s?.store.byDevice['origins-65']?.activeSlot === null,
    s?.opts.map((o) => o.selected).join(','));

  s = await open(send, 'saga-pro', 'sensor');
  check('mouse: 5 slots collapsed — the case that overflowed the old bar',
    (await slotCount(send)) === 5);
  await pickSlot(send, 0);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('mouse: nothing locked — a device where it all travels',
    s?.opts.length === 2 && s?.locks.length === 0, `${s?.opts.length} halves, ${s?.locks.length} locks`);

  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('device-sim')`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

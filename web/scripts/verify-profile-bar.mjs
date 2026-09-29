// CDP walkthrough for the profile selector — the software profile vs the
// device's onboard slots as one grouped dropdown in the device panel's tab
// strip, and the software-only locking that goes with it.
//
// The model: selecting IS switching. Picking a slot puts the device on it and
// picking the software profile hands the device back — there is no preview and
// no separate Activate, so scope and activeSlot are one fact. Saving is still
// its own act, because it writes flash. A disconnected device disables the bar.
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

// An eval that throws (execution context torn down by a navigation) counts as
// not-yet — without the catch, a poll that lands mid-navigation kills the suite
// with no ✗ line, which is how it failed under the parallel lane.
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    try { if (await evalJs(send, `!!(${expr})`)) return true; } catch {}
    await sleep(100);
  }
  return false;
}

const SNAP = `(() => {
  const bar = document.querySelector('.pb');
  const sel = document.querySelector('.pb-select');
  const label = sel?.querySelector('.ds-dropdown-label')?.textContent.trim() ?? null;
  const groups = [...(sel?.querySelectorAll('.ds-list-group') ?? [])].map(g => ({
    heading: g.querySelector('.ds-list-heading')?.textContent.trim(),
    rows: [...g.querySelectorAll('.ds-list-item')].map(r => ({
      label: r.querySelector('.ds-list-item-label')?.textContent.trim(),
      selected: r.getAttribute('aria-selected') === 'true',
      running: /Running/.test(r.querySelector('.ds-list-item-trailing')?.textContent ?? ''),
    })),
  }));
  const onboard = groups[1]?.rows.some(r => r.selected) ?? false;
  const store = JSON.parse(localStorage.getItem('device-onboard') || '{}');
  return {
    hasBar: !!bar,
    // One dropdown now — the trigger names what the device is on, and its menu
    // is two groups: the software profile, then the device's onboard slots.
    // Scope is derived from what the device runs, so the selected row and the
    // running slot are the same fact.
    label,
    triggerIcon: !!sel?.querySelector('.ds-dropdown-leading'),
    groups,
    // The old two-half view, derived, so the flow below reads the same:
    // [software, onboard]. name on the onboard side is the slot the trigger
    // shows while on a slot, else the slot marked Running (none = null).
    opts: [
      { kicker: groups[0]?.heading, name: groups[0]?.rows[0]?.label, selected: !onboard, onDevice: false },
      { kicker: groups[1]?.heading, name: onboard ? label : (groups[1]?.rows.find(r => r.running)?.label ?? null), selected: onboard, onDevice: onboard },
    ],
    popOpen: !!sel?.classList.contains('open'),
    slots: groups[1]?.rows ?? [],
    note: document.querySelector('.pb-note')?.textContent.replace(/\\s+/g,' ').trim() ?? null,
    // The onboard confirmation retires after a beat, fading in place rather
    // than unmounting — so "what does the note say" and "is it still showing"
    // are two different questions, and only the computed style answers the
    // second one.
    // The selector and its actions live in the panel's tab strip, a fixed
    // height, so the panel body sits at the same y in every state — software
    // scope, on a slot, mid-edit — and nothing on the canvas moves.
    panelTop: document.querySelector('.ds-ng3-body')?.getBoundingClientRect().top ?? null,
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
    barDisabled: !!sel?.classList.contains('disabled'),
    optsInert: !!sel?.querySelector('.ds-dropdown-trigger')?.disabled,
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
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  // The unique ?r= proves the NEW document committed — the previous one (or a
  // previous run's, in the same browser) has the same selectors.
  await waitFor(send, `location.search.includes('r=${loadN}') && document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
  return evalJs(send, SNAP);
}

// One dropdown: the trigger opens the menu, group 1 is the software profile,
// group 2 the onboard slots. Picking a row IS switching the device.
const TRIGGER = `document.querySelector('.pb-select .ds-dropdown-trigger')`;
const GROUP = (n) => `document.querySelector('.pb-select .ds-list-group:nth-child(${n})')`;
const openPop = async (send) => {
  // Under lane contention a pick can land before the canvas has re-rendered;
  // wait for the trigger rather than clicking null.
  await waitFor(send, TRIGGER);
  await evalJs(send, `${TRIGGER}.click()`);
  await waitFor(send, `document.querySelector('.pb-select.open')`);
};
const closed = (send) => waitFor(send, `!document.querySelector('.pb-select.open')`);
const clickSoftware = async (send) => {
  await openPop(send);
  await evalJs(send, `${GROUP(1)}.querySelector('.ds-list-item').click()`);
  await closed(send);
};
/** Choose slot `i` (0-based) from the Onboard group. */
const pickSlot = async (send, i) => {
  await openPop(send);
  await evalJs(send, `${GROUP(2)}.querySelectorAll('.ds-list-item')[${i}].click()`);
  await closed(send);
};
/** How many slots the device offers — the menu is mounted closed, so no need to open it. */
const slotCount = (send) => evalJs(send, `${GROUP(2)}?.querySelectorAll('.ds-list-item').length ?? 0`);
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
  check('selector is one dropdown with two groups — Software, then Onboard',
    s?.groups.length === 2 && s?.groups[0].heading === 'Software' && s?.groups[1].heading === 'Onboard',
    s?.groups.map((g) => g.heading).join('/'));
  check('keyboard: 3 slots listed under Onboard', (await slotCount(send)) === 3);
  check('the software profile and the slots are labeled as different KINDS of thing — group headings, not peers',
    s?.groups[0].rows.length === 1 && s?.groups[1].rows.length === 3,
    `${s?.groups[0].rows.length} software / ${s?.groups[1].rows.length} onboard`);
  check('the trigger names the software profile, with the profile glyph',
    s?.label === s?.opts[0].name && s?.triggerIcon === true, `${s?.label} icon=${s?.triggerIcon}`);
  check('the menu is closed until asked', s?.popOpen === false);
  check('software profile selected by default', s?.opts[0].selected === true);
  check('nothing locked in software scope', s?.locks.length === 0 && s?.unlockedRegions > 0, `${s?.unlockedRegions} unlocked`);
  check('no slot claims to be on the device yet', s?.opts.every((o) => !o.onDevice));
  // Everything in the trailing aside comes and goes on its own timing inside a
  // fixed-height strip, so the panel body never moves. Baseline taken in
  // software scope, where the aside is empty.
  const barH = s?.panelTop;

  // ── Selecting a slot IS switching the device to it ───────────────────────
  await pickSlot(send, 0);
  // Wait for the confirmation note to fade in (--dur-xslow) before the
  // snapshot: it is read for "the confirmation is up" below, and it only lives
  // ~5 s, so the wait has to happen here, before the checks and the screenshot
  // that sit between the switch and that check.
  await waitFor(send, `(() => { const n = document.querySelector('.pb-note'); if (!n) return false; const cs = getComputedStyle(n); return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01; })()`);
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
  check('the note arriving does not move the panel', s?.panelTop === barH, `${barH} → ${s?.panelTop}`);
  await sleep(6000);
  s = await evalJs(send, SNAP);
  check('confirmation retires itself after ~5s', s?.noteVisible === false, `note reads "${s?.note}"`);
  check('retiring costs no layout either — the panel stays put', s?.panelTop === barH, `${barH} → ${s?.panelTop}`);
  check('what is running stays readable on the trigger once the note has gone',
    s?.opts[1].onDevice === true && s?.label === 'Slot 1', s?.label);
  await pickSlot(send, 1);
  // The note fades back in over --dur-xslow (500 ms); wait for it rather than
  // read it at a fixed 400 ms, which a software-GL renderer can miss.
  await waitFor(send, `(() => { const n = document.querySelector('.pb-note'); if (!n) return false; const cs = getComputedStyle(n); return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01; })()`);
  s = await evalJs(send, SNAP);
  check('a fresh switch brings the confirmation back', s?.noteVisible === true && /travels with it/.test(s?.note ?? ''), s?.note);
  await pickSlot(send, 0);
  await sleep(400);

  // ── Picking the software profile hands the device back ───────────────────
  await clickSoftware(send);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('the software profile row hands the device back in one pick',
    s?.store.byDevice['origins-65']?.activeSlot === null && s?.opts.every((o) => !o.onDevice),
    JSON.stringify(s?.store.byDevice['origins-65']));
  check('handing back: locks release', s?.locks.length === 0);
  check('handing back: the trigger names the software profile again, and no row says Running',
    s?.label === s?.opts[0].name && s?.slots.every((r) => !r.running), s?.label);

  // ── Editing an onboard-capable control still needs an explicit Save ──────
  // Activation is free; a Save writes flash, so it stays a deliberate act.
  await pickSlot(send, 0);
  await sleep(400);
  await setBrightness(send, 42);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('edit in a slot: Undo + Save appear', s?.buttons.includes('Undo') && s?.buttons.some((b) => /Save to Slot 1/.test(b)), s?.buttons.join('/'));
  check('edit in a slot: warns it is not on the device yet', /Unsaved changes/.test(s?.note ?? ''), s?.note);
  check('Save/Undo arriving does not move the panel', s?.panelTop === barH, `${barH} → ${s?.panelTop}`);
  check('the warning sits on one line beside its buttons in the strip, never wrapped',
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
  check('disconnected: the selector is disabled', s?.barDisabled === true && s?.optsInert === true,
    `disabled=${s?.barDisabled} inert=${s?.optsInert}`);
  check('disconnected: the note says why, in words', /Disconnected — the keyboard is away/.test(s?.note ?? ''), s?.note);
  check('disconnected: no Save or Undo offered', s?.buttons.length === 0, s?.buttons.join('/'));
  const beforeAway = JSON.stringify(s?.store.byDevice['origins-65']);
  await evalJs(send, `${TRIGGER}.click()`);
  await sleep(300);
  s = await evalJs(send, SNAP);
  check('disconnected: clicking the selector opens nothing and changes nothing',
    s?.popOpen === false && JSON.stringify(s?.store.byDevice['origins-65']) === beforeAway, beforeAway);
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
  check('open: focus lands on the selected row, where the eye already is',
    await evalJs(send, `document.activeElement?.getAttribute('aria-selected') === 'true' && document.activeElement?.textContent.includes('Slot 1')`) === true);
  await evalJs(send, `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await closed(send);
  check('a11y: Escape closes the menu and hands focus back to the trigger — the modal stays open',
    await evalJs(send, `document.activeElement?.classList.contains('ds-dropdown-trigger') && !!document.querySelector('.dc-canvas')`) === true);

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

  // ── Keyboard operability: a listbox dropdown promises arrow keys ─────────
  // Cleared first: scope follows the device now, so a leftover active slot
  // would open the panel on a slot and move the roving tab stop.
  await evalJs(send, `localStorage.removeItem('device-onboard')`);
  s = await open(send, 'origins-65', 'lighting');
  const swName = s?.opts[0].name;
  const rowStops = await evalJs(send, `[...document.querySelectorAll('.pb-select .ds-list-item')].map(r => r.tabIndex)`);
  check('a11y: roving tabindex — only the selected row is a tab stop',
    JSON.stringify(rowStops) === JSON.stringify([0, -1, -1, -1]), JSON.stringify(rowStops));
  check('a11y: the closed menu is out of the tab order entirely',
    await evalJs(send, `getComputedStyle(document.querySelector('.pb-select .ds-dropdown-pop')).visibility`) === 'hidden');
  await evalJs(send, `(() => { const t = ${TRIGGER}; t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); })()`);
  await waitFor(send, `document.querySelector('.pb-select.open')`);
  check('a11y: ArrowDown on the trigger opens the menu with focus on the selected row',
    await evalJs(send, `document.activeElement?.getAttribute('aria-selected') === 'true' && document.activeElement?.textContent.trim() === ${JSON.stringify(swName)}`) === true,
    await evalJs(send, `document.activeElement?.textContent.trim()`));
  const focusedLabel = () => evalJs(send, `document.activeElement?.querySelector('.ds-list-item-label')?.textContent.trim()`);
  await evalJs(send, `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
  check('a11y: ArrowDown crosses the group boundary onto Slot 1', (await focusedLabel()) === 'Slot 1', await focusedLabel());
  await evalJs(send, `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))`);
  check('a11y: End jumps to the last slot', (await focusedLabel()) === 'Slot 3', await focusedLabel());
  await evalJs(send, `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))`);
  check('a11y: Home jumps back to the software profile', (await focusedLabel()) === swName, await focusedLabel());
  await evalJs(send, `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
  await evalJs(send, `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  await closed(send);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('a11y: Enter picks the row — and switches the device to Slot 1',
    s?.opts[1].selected === true && s?.label === 'Slot 1' && s?.store.byDevice?.['origins-65']?.activeSlot === 0,
    `${s?.label} activeSlot=${s?.store.byDevice?.['origins-65']?.activeSlot}`);
  check('a11y: focus returns to the trigger after a pick',
    await evalJs(send, `document.activeElement?.classList.contains('ds-dropdown-trigger')`) === true);

  s = await open(send, 'saga-pro', 'sensor');
  check('mouse: 5 slots listed under Onboard — the case that overflowed the old bar',
    (await slotCount(send)) === 5);
  await pickSlot(send, 0);
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('mouse: nothing locked — a device where it all travels',
    s?.groups.length === 2 && s?.locks.length === 0, `${s?.groups.length} groups, ${s?.locks.length} locks`);

  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('device-sim')`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

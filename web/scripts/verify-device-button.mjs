// CDP walkthrough for the device-side profile button + reconnect reconciliation
// (TH-336). The device simulator HUD plays the hardware: pressing the physical
// profile button, unplugging, switching slots while away, and plugging back in.
//
// The rule under test: the device is the truth about what it's running, and
// nothing overrides it. The app follows — the bar moves to whatever slot the
// hardware landed on and says how it got there. Handing the device back to the
// software profile is the user's one-click act, never automatic.
//
// Slot numbering: deviceSlot/activeSlot are 0-based; labels are 1-based
// ("Slot 1" = index 0). A fresh device idles on index 0 as its fallback, so
// the FIRST live press cycles 0 → 1 and lands on "Slot 2".
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

// Poll a readiness predicate instead of sleeping a fixed interval — paced, so
// the suite survives slow reloads and rapid serial runs alike.
async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const SNAP = `(() => {
  const onboard = JSON.parse(localStorage.getItem('device-onboard') || '{}');
  const hudRows = [...document.querySelectorAll('.sim-hud-row')].map(r => ({
    name: r.querySelector('.sim-hud-name')?.textContent.trim(),
    state: r.querySelector('.sim-hud-state')?.textContent.trim(),
  }));
  return {
    hud: !!document.querySelector('.sim-hud'),
    hudRows,
    chip: document.querySelector('.dc-chip-val')?.textContent.trim() ?? null,
    chipDotOn: !!document.querySelector('.dc-chip-dot-on'),
    // Two halves: software profile, then the device's onboard memory. Scope is
    // derived from what the device runs, so the selected half and the running
    // slot are the same fact.
    opts: [...document.querySelectorAll('.pb-half')].map(h => ({
      name: h.querySelector('.pb-opt-name')?.textContent.trim(),
      selected: h.querySelector('.pb-opt')?.getAttribute('aria-checked') === 'true',
      onDevice: h.classList.contains('on-device'),
    })),
    barDisabled: !!document.querySelector('.pb-row.disabled'),
    optsInert: [...document.querySelectorAll('.pb-opt, .pb-chev')].every(b => b.disabled),
    note: document.querySelector('.pb-note')?.textContent.replace(/\\s+/g,' ').trim() ?? null,
    buttons: [...document.querySelectorAll('.pb-actions .ds-btn')].map(b => b.textContent.trim()),
    locks: document.querySelectorAll('.ds-sw-only.locked').length,
    kb: onboard.byDevice?.['origins-65'] ?? null,
  };
})()`;

let loadN = 0;
async function load(send, path) {
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}${path}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
}

const snap = (send) => evalJs(send, SNAP);
const clickSoftware = (send) => evalJs(send, `document.querySelector('.pb-half .pb-opt').click()`);
/** Choose slot `i` (0-based) from the onboard half's collapsed list. */
const pickSlot = async (send, i) => {
  await evalJs(send, `document.querySelector('.pb-chev').click()`);
  await waitFor(send, `document.querySelector('.pb-pop .ds-list-item')`);
  await evalJs(send, `document.querySelectorAll('.pb-pop .ds-list-item')[${i}].click()`);
  await waitFor(send, `!document.querySelector('.pb-pop')`);
};
/** Wait-expression: the onboard half is showing slot `n` (1-based) as running. */
const runningSlot = (n) => `(() => {
  const h = document.querySelector('.pb-onboard');
  return h?.classList.contains('on-device')
    && h.querySelector('.pb-opt-name')?.textContent.trim() === 'Slot ${n}';
})()`;
/** Snapshot assertion for the same thing. */
const onSlot = (s, n) => s.opts[1]?.onDevice === true && s.opts[1]?.name === `Slot ${n}`;
// A HUD action on a device row, addressed by its visible name.
const hudAction = (send, name, text) => evalJs(send, `(() => {
  const row = [...document.querySelectorAll('.sim-hud-row')].find(r =>
    r.querySelector('.sim-hud-name')?.textContent.includes(${JSON.stringify(name)}));
  [...row.querySelectorAll('.ds-btn')].find(b => b.textContent.includes(${JSON.stringify(text)})).click();
})()`);
const hudState = (s, name) => s.hudRows.find((r) => new RegExp(name).test(r.name ?? ''))?.state ?? '';
// The Active Profile board widget behind the canvas — the real profile switch.
const switchProfile = (send, label) => evalJs(send, `(() => {
  const w = [...document.querySelectorAll('.w')]
    .find(el => el.querySelector('.w-label')?.textContent.includes('Active Profile'));
  const btn = [...w.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)});
  btn.click();
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

  // Clean slate: no onboard state, no sim state, default board (has the
  // Active Profile widget), Gaming profile.
  await load(send, '#/');
  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('device-sim'); localStorage.removeItem('board-layout'); localStorage.setItem('activeProfileId', 'gaming')`);

  // ── The simulator is discoverable in the Admin panel and toggles the HUD ──
  await load(send, '#/?modal=admin');
  await waitFor(send, `document.querySelector('.admin-modal')`);
  let s = await snap(send);
  check('admin: Device simulator tool row exists', await evalJs(send,
    `[...document.querySelectorAll('.admin-tool-name')].some(n => n.textContent === 'Device simulator')`));
  check('admin: HUD hidden by default', s.hud === false);
  await evalJs(send, `[...document.querySelectorAll('.admin-tool')].find(t =>
    t.querySelector('.admin-tool-name')?.textContent === 'Device simulator')
    .querySelector('.ds-btn.accent').click()`);
  await waitFor(send, `document.querySelector('.sim-hud')`);
  s = await snap(send);
  check('admin: Show opens the HUD and closes the modal (watch the app react)',
    s.hud === true && !(await evalJs(send, `!!document.querySelector('.admin-modal')`)));
  check('hud: one row per device with onboard memory (no monitor, no long tail)',
    s.hudRows.length === 4 && !s.hudRows.some((r) => /OLED|monitor/i.test(r.name ?? '')),
    s.hudRows.map((r) => r.name).join(' / '));
  check('hud: rows carry the hardware truth (software-driven + fallback slot)',
    s.hudRows.every((r) => /software-driven, falls back to Slot 1/.test(r.state ?? '')), s.hudRows[0]?.state);

  // ── Live press with the canvas open: the app follows and says why ─────────
  await evalJs(send, `location.hash = '#/?sku=origins-65&tab=lighting'`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
  s = await snap(send);
  check('keyboard canvas over the HUD, chip connected', s.chip === 'Connected · USB' && s.chipDotOn, s.chip);
  check('fresh state: nothing locked, software scope selected', s.locks === 0 && s.opts[0]?.selected === true);

  await hudAction(send, 'Origins', 'Profile button');
  await waitFor(send, `document.querySelector('.pb-half.on-device')`);
  s = await snap(send);
  check('press: the device is the truth — it cycles 0→1, the live dot lands on Slot 2',
    onSlot(s, 2) && s.kb?.activeSlot === 1, JSON.stringify(s.kb));
  check('press: provenance is device-side, nothing written to flash',
    s.kb?.slotSource === 'device' && !s.kb?.slots?.[1], JSON.stringify(s.kb));
  check('press: the panel follows the hardware onto Slot 2',
    s.opts[1]?.selected === true && s.opts[0]?.selected === false,
    s.opts.map((o) => (o.selected ? '[' + o.name + ']' : o.name)).join(' '));
  check('press: the note credits the device, not the app',
    /Switched to Slot 2 on the keyboard/.test(s.note ?? ''), s.note);
  check('press: software-only regions lock — they genuinely are not running', s.locks === 1, `${s.locks} locked`);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/db-live-press.png`, Buffer.from(shot.data, 'base64'));

  await hudAction(send, 'Origins', 'Profile button');
  await waitFor(send, runningSlot(3));
  s = await snap(send);
  check('press cycles: Slot 2 → Slot 3, the app keeps following', onSlot(s, 3) && s.kb?.activeSlot === 2);

  await clickSoftware(send);
  await waitFor(send, `!document.querySelector('.pb-half.on-device')`);
  s = await snap(send);
  check('the software half is the way back: software drives again, no write',
    s.locks === 0 && s.kb?.activeSlot === null && Object.keys(s.kb?.slots ?? {}).length === 0, JSON.stringify(s.kb));
  check('hud: the fallback slot survives handing back to software',
    /software-driven, falls back to Slot 3/.test(hudState(s, 'Origins')), hudState(s, 'Origins'));

  // ── Unplug: presses while away are invisible until it comes back ──────────
  await hudAction(send, 'Origins', 'Unplug');
  await waitFor(send, `[...document.querySelectorAll('.dc-chip-val')].some(c => c.textContent === 'Disconnected')`);
  s = await snap(send);
  check('unplug: chip says Disconnected in words, dot goes red', s.chip === 'Disconnected' && !s.chipDotOn, s.chip);
  check('unplug: software scope says the device is away', /Disconnected — the keyboard is away/.test(s.note ?? ''), s.note);

  await hudAction(send, 'Origins', 'Profile button'); // 2 → 0
  await hudAction(send, 'Origins', 'Profile button'); // 0 → 1  ("on the Xbox")
  s = await snap(send);
  check('away presses: the hardware moves (…→ Slot 2), the app cannot see it',
    /Away · on Slot 2/.test(hudState(s, 'Origins')) && s.kb?.activeSlot === null, hudState(s, 'Origins'));
  check('away: no slot claims to be running in the bar', s.opts.every((o) => !o.onDevice));
  check('away: the bar is disabled — a device that is not here cannot be switched',
    s.barDisabled === true && s.optsInert === true, `disabled=${s.barDisabled} inert=${s.optsInert}`);

  const awayState = JSON.stringify(s.kb);
  await evalJs(send, `document.querySelector('.pb-onboard .pb-opt').click()`);
  await sleep(300);
  s = await snap(send);
  check('away: clicking the bar changes nothing at all', JSON.stringify(s.kb) === awayState, awayState);

  // ── Reconnect, changed: the device wins and the app teaches ──────────────
  await hudAction(send, 'Origins', 'Plug in');
  await waitFor(send, `document.querySelector('.pb-half.on-device')`);
  s = await snap(send);
  check('reconnect (changed): adopts the slot it came back running',
    onSlot(s, 2) && s.kb?.activeSlot === 1 && s.kb?.slotSource === 'reconnect', JSON.stringify(s.kb));
  check('reconnect: the teaching moment — came back running Slot 2, switched while away',
    /came back running Slot 2/i.test(s.note ?? '') && /switched while away/.test(s.note ?? ''), s.note);
  check('reconnect: software-only features honestly off', s.locks === 1);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/db-reconnect.png`, Buffer.from(shot.data, 'base64'));

  // ── Reconnect, unchanged: silence — only disagreements speak ──────────────
  await clickSoftware(send);
  await waitFor(send, `!document.querySelector('.pb-half.on-device')`);
  await hudAction(send, 'Origins', 'Unplug');
  await waitFor(send, `[...document.querySelectorAll('.dc-chip-val')].some(c => c.textContent === 'Disconnected')`);
  await hudAction(send, 'Origins', 'Plug in');
  await waitFor(send, `[...document.querySelectorAll('.dc-chip-val')].some(c => c.textContent === 'Connected · USB')`);
  s = await snap(send);
  check('reconnect (unchanged): silent — no note, no locks, software drives as before',
    s.locks === 0 && s.note == null && s.kb?.activeSlot === null, `note=${s.note} locks=${s.locks}`);

  // ── A live press while the panel sits on another slot ────────────────────
  // Nothing overrules the device now, so the panel simply follows it. This is
  // where the binding reassert / standing-conflict machinery used to live.
  await pickSlot(send, 0);
  await waitFor(send, runningSlot(1));
  s = await snap(send);
  check('picking Slot 1 switches the device with no second step',
    s.kb?.activeSlot === 0 && s.kb?.slotSource === 'app' && Object.keys(s.kb?.slots ?? {}).length === 0,
    JSON.stringify(s.kb));

  await hudAction(send, 'Origins', 'Profile button'); // Slot 1 → Slot 2, live
  await waitFor(send, runningSlot(2));
  s = await snap(send);
  check('live press from a slot: the device wins and the panel moves with it',
    onSlot(s, 2) && s.kb?.activeSlot === 1 && s.opts[1]?.selected === true, JSON.stringify(s.kb));
  check('live press: no conflict to resolve, just the truth about the switch',
    /Switched to Slot 2 on the keyboard/.test(s.note ?? '') && !s.buttons.length,
    `${s.note} · buttons=${s.buttons.join('/') || 'none'}`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/db-live-from-slot.png`, Buffer.from(shot.data, 'base64'));

  // ── Software profiles have no opinion about onboard slots ────────────────
  // The Active Profile widget sits on the board behind the canvas; its buttons
  // are still clickable programmatically. With bindings gone, a profile switch
  // must leave the hardware exactly where it is.
  await switchProfile(send, 'Work');
  await waitFor(send, `document.querySelector('.pb-opt-name')?.textContent.trim() === 'Work'`);
  s = await snap(send);
  check('profile switch leaves the device on its slot — no pin, nothing asserted',
    s.kb?.activeSlot === 1 && onSlot(s, 2), JSON.stringify(s.kb));
  check('bar names the profile it shows: Work in the software half',
    s.opts[0]?.name === 'Work', s.opts[0]?.name);
  check('profile switch writes nothing', Object.keys(s.kb?.slots ?? {}).length === 0, JSON.stringify(s.kb?.slots));

  await switchProfile(send, 'Gaming');
  await waitFor(send, `document.querySelector('.pb-opt-name')?.textContent.trim() === 'Gaming'`);
  s = await snap(send);
  check('switching back is equally inert — the keyboard is still on Slot 2',
    s.kb?.activeSlot === 1 && onSlot(s, 2), JSON.stringify(s.kb));

  // Hand it back so the board/flyout checks below start from software.
  await clickSoftware(send);
  await waitFor(send, `!document.querySelector('.pb-half.on-device')`);

  // ── Unplugging takes the device's board card with it (hidden, not deleted) ──
  // The board sits behind the open canvas on the Home route; same pattern as
  // module-gated widgets: the saved layout keeps the card, so plugging back in
  // restores it at exactly its saved position.
  const orderBefore = await evalJs(send, `[...document.querySelectorAll('.wb-cell')].map(c => c.dataset.widget)`);
  check('board: headset card present while connected', orderBefore.includes('dev-headset'), orderBefore.join(','));
  await hudAction(send, 'Cloud', 'Unplug');
  await waitFor(send, `![...document.querySelectorAll('.wb-cell')].some(c => c.dataset.widget === 'dev-headset')`);
  const orderGone = await evalJs(send, `[...document.querySelectorAll('.wb-cell')].map(c => c.dataset.widget)`);
  check('board: unplugging hides the card and nothing else moves',
    !orderGone.includes('dev-headset')
    && JSON.stringify(orderGone) === JSON.stringify(orderBefore.filter((id) => id !== 'dev-headset')),
    orderGone.join(','));
  check('board: hidden, not deleted — the saved layout still holds the card',
    await evalJs(send, `JSON.parse(localStorage.getItem('board-layout') || '[]').some(i => i.id === 'dev-headset')`));
  await hudAction(send, 'Cloud', 'Plug in');
  await waitFor(send, `[...document.querySelectorAll('.wb-cell')].some(c => c.dataset.widget === 'dev-headset')`);
  const orderAfter = await evalJs(send, `[...document.querySelectorAll('.wb-cell')].map(c => c.dataset.widget)`);
  check('board: plugging back in restores the card at its saved position',
    JSON.stringify(orderAfter) === JSON.stringify(orderBefore), orderAfter.join(','));

  // ── Devices flyout: a disconnected device stays listed and says so ────────
  // "My Devices" is inventory, not just what's live — unlike the board card,
  // the flyout entry keeps its place (same as the KVM "handed off" precedent),
  // drains its image, and the badge says Disconnected in words.
  // The nav tab's label renders twice (visible + tooltip), so match by includes.
  await evalJs(send, `[...document.querySelectorAll('nav button')].find(b => b.textContent.includes('Devices'))?.click()`);
  check('flyout: the Devices nav toggle actually opens the panel',
    await waitFor(send, `document.querySelector('.device-panel.open')`));
  await hudAction(send, 'Cloud', 'Unplug');
  await waitFor(send, `[...document.querySelectorAll('.devp-tab')].some(t => t.classList.contains('offline'))`);
  const fly = await evalJs(send, `(() => {
    const tabs = [...document.querySelectorAll('.devp-tab')];
    return { count: tabs.length, offline: tabs.map(t => t.classList.contains('offline')), titles: tabs.map(t => t.title) };
  })()`);
  check('flyout: unplugged headset stays listed — inventory, not hidden',
    fly.count === 5 && fly.offline.filter(Boolean).length === 1 && /Cloud III \(disconnected\)/.test(fly.titles[2]),
    JSON.stringify(fly.titles));
  await evalJs(send, `document.querySelectorAll('.devp-tab')[2].click()`);
  await waitFor(send, `[...document.querySelectorAll('.devp-badge')].some(b => b.textContent.trim() === 'Disconnected')`);
  const offBadges = await evalJs(send, `[...document.querySelectorAll('.devp-badge')].map(b => b.textContent.trim())`);
  check('flyout: badge carries the state in words, no battery reading from an absent device',
    offBadges.includes('Disconnected') && !offBadges.some((b) => /%$/.test(b)), offBadges.join(' / '));
  await hudAction(send, 'Cloud', 'Plug in');
  await waitFor(send, `[...document.querySelectorAll('.devp-badge')].some(b => b.textContent.trim() === 'Connected')`);
  const onBadges = await evalJs(send, `[...document.querySelectorAll('.devp-badge')].map(b => b.textContent.trim())`);
  check('flyout: replug restores the Connected badge, offline styling clears',
    onBadges.includes('Connected') && !onBadges.includes('Disconnected')
    && (await evalJs(send, `document.querySelectorAll('.devp-tab.offline').length`)) === 0,
    onBadges.join(' / '));
  await evalJs(send, `document.querySelector('.device-panel .ds-panel-close')?.click()`);

  // ── A device with no binding and no slot running is untouched by switches ──
  const mouseTouched = await evalJs(send,
    `JSON.parse(localStorage.getItem('device-onboard') || '{}').byDevice?.['saga-pro'] !== undefined`);
  check('profile switches never create state for untouched devices', mouseTouched === false);

  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('device-sim'); localStorage.removeItem('activeProfileId')`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

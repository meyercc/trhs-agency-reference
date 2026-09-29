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
    // Which acts this row offers — a display has no profile button and no
    // battery, so the row is expected to be shorter (2026-09-01).
    acts: [...r.querySelectorAll('.sim-hud-actions button')].map(b => b.textContent.trim()),
    hasBattery: !!r.querySelector('.sim-hud-batt-pct'),
  }));
  return {
    hud: !!document.querySelector('.sim-hud'),
    hudRows,
    chip: document.querySelector('.dc-chip-val')?.textContent.trim() ?? null,
    chipDotOn: !!document.querySelector('.dc-chip-dot-on'),
    // One dropdown: group 1 is the software profile, group 2 the onboard
    // slots. Scope is derived from what the device runs, so the selected row
    // and the running slot are the same fact. Read as the old two-half view:
    // [software, onboard], name on the onboard side being the slot the
    // trigger shows while on a slot.
    opts: (() => {
      const sel = document.querySelector('.pb-select');
      const label = sel?.querySelector('.ds-dropdown-label')?.textContent.trim() ?? null;
      const g = [...(sel?.querySelectorAll('.ds-list-group') ?? [])];
      const sw = g[0]?.querySelector('.ds-list-item-label')?.textContent.trim();
      const onboard = !!g[1]?.querySelector('.ds-list-item[aria-selected="true"]');
      return [
        { name: sw, selected: !onboard, onDevice: false },
        { name: onboard ? label : null, selected: onboard, onDevice: onboard },
      ];
    })(),
    barDisabled: !!document.querySelector('.pb-select.disabled'),
    optsInert: !!document.querySelector('.pb-select .ds-dropdown-trigger')?.disabled,
    note: document.querySelector('.pb-note')?.textContent.replace(/\\s+/g,' ').trim() ?? null,
    buttons: [...document.querySelectorAll('.pb-actions .ds-btn')].map(b => b.textContent.trim()),
    locks: document.querySelectorAll('.ds-sw-only.locked').length,
    kb: onboard.byDevice?.['origins-65'] ?? null,
  };
})()`;

let loadN = 0;
async function load(send, path) {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}${path}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
}

const snap = (send) => evalJs(send, SNAP);
const TRIGGER = `document.querySelector('.pb-select .ds-dropdown-trigger')`;
const GROUP = (n) => `document.querySelector('.pb-select .ds-list-group:nth-child(${n})')`;
/** Wait-expression: the device is on an onboard slot (a slot row is the selected row). */
const ON_DEVICE = `${GROUP(2)}?.querySelector('.ds-list-item[aria-selected="true"]')`;
const SW_NAME = `${GROUP(1)}?.querySelector('.ds-list-item-label')?.textContent.trim()`;
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
/** Wait-expression: the trigger shows slot `n` (1-based) as what the device runs. */
const runningSlot = (n) => `(() => {
  const on = ${ON_DEVICE};
  return !!on && document.querySelector('.pb-select .ds-dropdown-label')?.textContent.trim() === 'Slot ${n}';
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
  // Seed the board rather than inheriting DEFAULT_LAYOUT: this suite drives a
  // real profile switch through the Active Profile widget and needs the headset
  // card present, and the default layout is a product decision that moves. A
  // seeded layout keeps the suite testing device behavior, not the default.
  await evalJs(send, `localStorage.removeItem('device-onboard'); localStorage.removeItem('device-sim'); localStorage.setItem('activeProfileId', 'gaming');
    localStorage.setItem('board-layout', JSON.stringify(
      [['profile',2,1],['dev-treehouse',3,2],['dev-mouse',3,2],['dev-monitor',3,2],['dev-headset',3,2]]
        .map(([id, span, rows]) => ({ id, span, rows }))))`);

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
  // Every connected device, displays included (2026-09-01, Cindy). This used to
  // assert the opposite — 4 rows and no monitor — because the roster was
  // "devices with onboard memory", and a monitor has none. That left both
  // displays out of the only screen that plays hardware, so nobody could see
  // what the app does when a display is unplugged.
  check('hud: one row per connected device, displays included',
    s.hudRows.length === 6 && s.hudRows.some((r) => /Treehouse 32/.test(r.name ?? ''))
      && s.hudRows.some((r) => /OLED/.test(r.name ?? '')),
    s.hudRows.map((r) => r.name).join(' / '));
  // A row offers only what that device can do. Offering a dead control on the
  // screen we CHECK dead controls from would be the same lie one layer up.
  check('hud: a display gets Unplug only — no profile button, no battery',
    s.hudRows.filter((r) => /Treehouse 32|OLED/.test(r.name ?? ''))
      .every((r) => r.acts.join() === 'Unplug' && !r.hasBattery),
    JSON.stringify(s.hudRows.filter((r) => /Treehouse 32|OLED/.test(r.name ?? '')).map((r) => r.acts)));
  check('hud: slot devices still carry the hardware truth (software-driven + fallback slot)',
    s.hudRows.filter((r) => r.acts.includes('Profile button'))
      .every((r) => /software-driven, falls back to Slot 1/.test(r.state ?? '')),
    s.hudRows[0]?.state);
  // A display has no slots, so the slot sentence would be noise — it says the
  // short true thing instead.
  check('hud: a display says just Connected, not a slot it does not have',
    s.hudRows.filter((r) => /Treehouse 32|OLED/.test(r.name ?? '')).every((r) => r.state === 'Connected'),
    s.hudRows.find((r) => /Treehouse 32/.test(r.name ?? ''))?.state);
  // The battery the card's low treatment needs — only the mouse has one on this
  // desk (the registry gives Cloud III `wired`), so one row and only one.
  check('hud: the one device with a battery gets the slider, nobody else',
    s.hudRows.filter((r) => r.hasBattery).length === 1
      && /Saga Pro/.test(s.hudRows.find((r) => r.hasBattery)?.name ?? ''),
    s.hudRows.filter((r) => r.hasBattery).map((r) => r.name).join(' / '));

  // ── Live press with the canvas open: the app follows and says why ─────────
  await evalJs(send, `location.hash = '#/?sku=origins-65&tab=lighting'`);
  await waitFor(send, `document.querySelector('.dc-canvas .ds-ng3-body')`);
  s = await snap(send);
  check('keyboard canvas over the HUD, chip connected', s.chip === 'Connected · USB' && s.chipDotOn, s.chip);
  check('fresh state: nothing locked, software scope selected', s.locks === 0 && s.opts[0]?.selected === true);

  await hudAction(send, 'Origins', 'Profile button');
  await waitFor(send, ON_DEVICE);
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
  await waitFor(send, `!${ON_DEVICE}`);
  s = await snap(send);
  check('the software profile row is the way back: software drives again, no write',
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
  check('away: the selector is disabled — a device that is not here cannot be switched',
    s.barDisabled === true && s.optsInert === true, `disabled=${s.barDisabled} inert=${s.optsInert}`);

  const awayState = JSON.stringify(s.kb);
  await evalJs(send, `${TRIGGER}.click()`);
  await sleep(300);
  s = await snap(send);
  check('away: clicking the selector changes nothing at all', JSON.stringify(s.kb) === awayState, awayState);

  // ── Reconnect, changed: the device wins and the app teaches ──────────────
  await hudAction(send, 'Origins', 'Plug in');
  await waitFor(send, ON_DEVICE);
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
  await waitFor(send, `!${ON_DEVICE}`);
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
  await waitFor(send, `${SW_NAME} === 'Work'`);
  s = await snap(send);
  check('profile switch leaves the device on its slot — no pin, nothing asserted',
    s.kb?.activeSlot === 1 && onSlot(s, 2), JSON.stringify(s.kb));
  check('the menu names the profile it offers: Work in the Software group',
    s.opts[0]?.name === 'Work', s.opts[0]?.name);
  check('profile switch writes nothing', Object.keys(s.kb?.slots ?? {}).length === 0, JSON.stringify(s.kb?.slots));

  await switchProfile(send, 'Gaming');
  await waitFor(send, `${SW_NAME} === 'Gaming'`);
  s = await snap(send);
  check('switching back is equally inert — the keyboard is still on Slot 2',
    s.kb?.activeSlot === 1 && onSlot(s, 2), JSON.stringify(s.kb));

  // Hand it back so the board/flyout checks below start from software.
  await clickSoftware(send);
  await waitFor(send, `!${ON_DEVICE}`);

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
    // 6, not 5 — this count was stale before the 2026-09-01 work and failed on
    // the parent commit too (measured by running this file on both). The panel
    // lists CONNECTED_DEVICE_IDS, which has six entries.
    fly.count === 6 && fly.offline.filter(Boolean).length === 1 && /Cloud III \(disconnected\)/.test(fly.titles[2]),
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

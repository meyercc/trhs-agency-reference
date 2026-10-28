// CDP walkthrough for the cooler cap and the DIY fan kit's window (OpenGSW
// lcd-diy, parts 2, 3, 5 and 7), each opened from the test door on
// #/modal-lab. The cap's door opens the PC's page at its LCD cooler cap tab,
// the cap's one place (JY, 2026-10-22): Display, Power On and Settings are
// switched at the title row's right end, the preview sits beside the tower.
// The cap: themes and reading slots, edits that
// wait for Apply and a Cancel that leaves the saved setting alone, four drives
// at most, crop, the fan names on its readings, sleep / restart / display off,
// firmware online and offline. The kit: groups with speed, curve, RPM and
// Identify, names that survive fans coming and going, the port limits.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

// SHOTS_DIR keeps the screenshots past the runner's temp folder.
const OUT = process.env.SHOTS_DIR || process.argv[2] || '/tmp';
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

const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;
// The keys this suite reads or writes, cleared so a run starts from defaults.
const OWN_KEYS = ['coolerCap', 'fanKit', 'mvpScope'];

let loadN = 0;
async function load(send, hash = '#/modal-lab') {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}${hash}` });
  await waitFor(send, APP_READY);
}

const q = (s) => JSON.stringify(s);
/** Click a button by its text, inside `scope` (a selector). */
const clickText = (send, text, scope = '.dc-canvas') =>
  evalJs(send, `(() => { const b = [...document.querySelectorAll(${q(scope)} + ' button')].find(b => b.textContent.trim() === ${q(text)}); if (b) b.click(); return !!b; })()`);
/** Pick an option from a design-system Dropdown named by its aria-label. */
async function pick(send, label, option) {
  await evalJs(send, `document.querySelector('.ds-dropdown-trigger[aria-label=${q(label)}]')?.click()`);
  await sleep(150);
  return evalJs(send, `(() => {
    const dd = document.querySelector('.ds-dropdown-trigger[aria-label=${q(label)}]')?.closest('.ds-dropdown');
    const row = [...(dd?.querySelectorAll('.ds-dropdown-pop .ds-list-item') ?? [])].find(r => r.textContent.trim() === ${q(option)});
    if (row) row.click();
    return !!row;
  })()`);
}
/** Type into an input the way React hears it, then leave the field. */
const typeInto = (send, selector, value) =>
  evalJs(send, `(() => {
    const el = document.querySelector(${q(selector)});
    if (!el) return false;
    el.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, ${q(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.blur();
    return true;
  })()`);
const clickTab = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === ${q(label)})?.click()`);
/** The cap tab's views, switched at the title row's right end. */
const capViews = (send) => evalJs(send, `[...document.querySelectorAll('.dc-canvas [aria-label="Cooler cap view"] button')].map(b => b.textContent.trim())`);
const clickView = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.dc-canvas [aria-label="Cooler cap view"] button')].find(b => b.textContent.trim() === ${q(label)})?.click()`);
const capSaved = (send) => evalJs(send, `JSON.parse(localStorage.getItem('coolerCap') || '{}')`);
const kitSaved = (send) => evalJs(send, `JSON.parse(localStorage.getItem('fanKit') || '{}')`);
const heroTag = (send) => evalJs(send, `document.querySelector('.pcp-hero-tag')?.textContent.trim()`);
const applyBar = (send) => evalJs(send, `!!document.querySelector('.pcp-apply')`);
const shoot = async (send, name) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(shot.data, 'base64'));
};
const closeCanvas = async (send) => {
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await waitFor(send, `!document.querySelector('.dc-canvas')`);
};
const openCap = async (send) => {
  await clickText(send, 'Open the cooler cap', '[data-plate="cooler-cap"]');
  return waitFor(send, `document.querySelector('.dc-canvas .pcp-cap')`);
};
const openKit = async (send) => {
  await clickText(send, 'Open the DIY fan kit', '[data-plate="cooler-cap"]');
  return waitFor(send, `document.querySelector('.dc-canvas .fk-hero')`);
};
const heroFans = (send) =>
  evalJs(send, `[...document.querySelectorAll('.fk-fan')].map(f => [f.dataset.fan, f.querySelector('.fk-fan-name').textContent.trim()])`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  await load(send);
  await evalJs(send, `${q(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  await load(send);

  // ── The cap: a door of its own ────────────────────────────────────────────
  check('lab: the plate is on #/modal-lab', await waitFor(send, `document.querySelector('[data-plate="cooler-cap"]')`));
  check('cap: the lab door opens the PC page at its LCD cooler cap tab, the cap beside the tower', await openCap(send));
  const where = await evalJs(send, `({ hash: location.hash, title: document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim(), active: document.querySelector('.dc-canvas .ds-ng3-tool.active, .dc-canvas .ds-ng3-tool[aria-pressed="true"]')?.getAttribute('aria-label') })`);
  check('cap: one place — the address becomes the PC page at the cap tab',
    /sku=forge-45l(&|$)/.test(where.hash) && where.hash.includes('tab=cooler-cap') && where.title === 'LCD cooler cap', JSON.stringify(where));
  const views = await capViews(send);
  check('cap: Display, Power On, Settings, at the title row\'s right end', JSON.stringify(views) === q(['Display', 'Power On', 'Settings']), views?.join('/'));
  check('cap: at rest the hero is the cap as it is, with nothing to apply',
    (await heroTag(send)) === 'Live now' && !(await applyBar(send)), await heroTag(send));

  // The presets, as the Lights tab lays them out; picking one shows it at once.
  // Scoped to the window: the Modal Lab page behind it carries the laptop
  // lighting lab, whose preset library draws the same .pdm-preset rows.
  const rows = await evalJs(send, `[...document.querySelectorAll('.dc-canvas .pdm-preset')].map(r => r.dataset.preset)`);
  check('cap: the presets list the themes, both clocks and each kind of media', rows?.length === 9 && rows[0] === 'vitals-classic', JSON.stringify(rows));
  check('cap: the one on the cap is marked Live',
    (await evalJs(send, `document.querySelector('.dc-canvas .pdm-preset.active')?.dataset.preset`)) === 'vitals-classic' &&
      (await evalJs(send, `!!document.querySelector('.dc-canvas .pdm-preset.active .cap-live')`)));
  await evalJs(send, `document.querySelector('.dc-canvas [data-preset="vitals-ring"] .pdm-preset-pick').click()`);
  await sleep(200);
  check('cap: picking a preset shows it at once',
    (await evalJs(send, `!!document.querySelector('.pcp-hero .pcp-face-ring')`)) && (await capSaved(send)).activePreset === 'vitals-ring' && (await heroTag(send)) === 'Live now');

  // Customize: OGH's configuration page, which waits for Apply (lcd-diy#open:2).
  const customize = async (id) => {
    await evalJs(send, `document.querySelector('.dc-canvas [data-preset="${id}"] .pdm-preset-menu').click()`);
    await sleep(100);
    await clickText(send, 'Customize');
    return waitFor(send, `document.querySelector('.cap-editor')`, 2000);
  };
  check('cap: Customize puts the configuration page in the list\'s place', await customize('vitals-ring'));
  check('cap: one title, then the way back to the presets (the macro editor\'s head)',
    !(await evalJs(send, `!!document.querySelector('.dc-canvas .pdm-presets-grid, .dc-canvas .ds-overlay-panel-title')`)) &&
      (await evalJs(send, `document.querySelector('.cap-editor .cap-back')?.textContent.trim()`)) === 'Presets' &&
      (await heroTag(send)) === 'Live now' && (await evalJs(send, `document.querySelector('.cap-editor-state')?.textContent.trim()`)) === 'On the cap');
  const tones = await evalJs(send, `[...document.querySelectorAll('.cap-editor [aria-label="Theme"] [role=radio]')].map(t => [t.getAttribute('aria-label'), t.getAttribute('aria-checked')])`);
  check('cap: on a HyperX desktop, red leads the themes and is the default (lcd-diy.36)',
    tones?.[0]?.[0] === 'Red' && tones?.[0]?.[1] === 'true', JSON.stringify(tones));
  check('cap: the page shows Style, and one place for Ring',
    JSON.stringify(await evalJs(send, `[...document.querySelectorAll('.pcp-slot')].map(s => s.dataset.slot)`)) === q(['Centre']));
  await evalJs(send, `[...document.querySelectorAll('.pcp-theme')].find(b => b.querySelector('.pcp-theme-name').textContent.trim() === 'List')?.click()`);
  await sleep(200);
  check('cap: an edit previews on the cap without sending it',
    (await evalJs(send, `!!document.querySelector('.pcp-hero .pcp-face-list')`)) && (await heroTag(send)) === 'Preview · not applied yet' && (await capSaved(send)).theme === 'ring' &&
      (await evalJs(send, `document.querySelector('.cap-editor-state')?.textContent.trim()`)) === 'Not applied yet',
    `${await heroTag(send)} · saved ${(await capSaved(send)).theme}`);
  await evalJs(send, `document.querySelector('.cap-back').click()`);
  await sleep(200);
  check('cap: going back puts the cap back and leaves the saved setting as it was (lcd-diy.22)',
    (await evalJs(send, `!!document.querySelector('.pcp-hero .pcp-face-ring')`)) && !(await evalJs(send, `!!document.querySelector('.cap-editor')`)) &&
      (await evalJs(send, `!!document.querySelector('.dc-canvas .pdm-presets-grid')`)) && (await capSaved(send)).theme === 'ring');

  await customize('vitals-ring');
  await evalJs(send, `[...document.querySelectorAll('.pcp-theme')].find(b => b.querySelector('.pcp-theme-name').textContent.trim() === 'List')?.click()`);
  await sleep(150);
  check('cap: List shows four places', (await evalJs(send, `document.querySelectorAll('.pcp-slot').length`)) === 4);
  await clickText(send, 'Apply');
  check('cap: Apply waits a moment, says so', await waitFor(send, `[...document.querySelectorAll('.cap-editor button')].some(b => b.textContent.trim() === 'Applying…')`, 1000));
  check('cap: the wait always ends, and the edit is saved (lcd-diy.39)',
    (await waitFor(send, `!document.querySelector('.cap-editor')`, 4000)) && (await capSaved(send)).theme === 'list' &&
      (await capSaved(send)).presets?.find((p) => p.id === 'vitals-ring')?.theme === 'list');
  check('cap: with six drives, the cap shows four (lcd-diy.42)', (await evalJs(send, `document.querySelectorAll('.pcp-hero .pcp-drive').length`)) === 4);
  await shoot(send, 'cooler-cap-list');

  // A fan on the readings, by its fan-list name (lcd-diy.13).
  await customize('vitals-ring');
  await clickText(send, 'Fan speed', '[data-slot="Row 2"]');
  await sleep(150);
  check('cap: a place can show a fan, picked from the fan list', await evalJs(send, `!!document.querySelector('.ds-dropdown-trigger[aria-label="Row 2 fan"]')`));
  await pick(send, 'Row 2 fan', 'Fan 1');
  await sleep(150);
  await shoot(send, 'cooler-cap-customize');
  await clickText(send, 'Apply');
  await waitFor(send, `!document.querySelector('.cap-editor')`, 4000);
  check('cap: the fan reading shows on the cap under its name',
    (await evalJs(send, `document.querySelector('.pcp-hero .pcp-face-list')?.textContent ?? ''`)).includes('Fan 1'));

  // A new display: a picture, cropped (lcd-diy.28).
  await evalJs(send, `document.querySelector('.dc-canvas .pdm-preset-fab').click()`);
  await waitFor(send, `document.querySelector('.cap-editor')`, 2000);
  await pick(send, 'What the screen shows', 'Picture');
  await sleep(150);
  check('cap: a picture offers a crop', await evalJs(send, `!!document.querySelector('[aria-label="Crop zoom"]')`));
  check('cap: the picture can be dragged on the cap', await evalJs(send, `!!document.querySelector('.pcp-cap.pannable')`));
  await clickText(send, 'Cancel');
  await sleep(150);

  // Rotation, from the panel header (lcd-diy.26).
  await evalJs(send, `document.querySelector('.cap-rotate').click()`);
  await sleep(100);
  check('cap: the header turns the screen a quarter at a time', (await capSaved(send)).rotation === 90);
  for (let i = 0; i < 3; i++) {
    await evalJs(send, `document.querySelector('.cap-rotate').click()`);
    await sleep(100);
  }
  check('cap: four quarter turns bring it back upright', (await capSaved(send)).rotation === 0);
  await closeCanvas(send);

  // ── The kit ───────────────────────────────────────────────────────────────
  check('kit: the lab door opens the DIY fan kit window', await openKit(send));
  const kitTabs = await evalJs(send, `[...document.querySelectorAll('.dc-canvas .ds-ng3-tool')].map(b => b.getAttribute('aria-label'))`);
  check('kit: Groups, Fans', JSON.stringify(kitTabs) === q(['Groups', 'Fans']), kitTabs?.join('/'));
  let fans = await heroFans(send);
  check('kit: the hero shows the six kit fans, each under its name',
    fans.length === 6 && fans[0][1] === 'Fan 1', JSON.stringify(fans));
  const groups = await evalJs(send, `[...document.querySelectorAll('.fk-group')].map(g => g.dataset.group)`);
  check('kit: Group 1, then Ungrouped', JSON.stringify(groups) === q(['group-1', 'ungrouped']), JSON.stringify(groups));
  check('kit: each group shows its live RPM',
    await evalJs(send, `[...document.querySelectorAll('.fk-group .fk-rpm')].every(r => / RPM$/.test(r.textContent.trim()))`));

  // Speed bar and curve (lcd-diy.11), from the app's own controls (lcd-diy.29).
  await clickText(send, 'Manual', '[data-group="group-1"]');
  await sleep(150);
  check('kit: Manual gives the group a speed bar', await evalJs(send, `!!document.querySelector('[data-group="group-1"] [aria-label="Group 1 speed"].ds-slider, [data-group="group-1"] input[aria-label="Group 1 speed"], [data-group="group-1"] [role=slider]')`));
  await clickText(send, 'Curve', '[data-group="group-1"]');
  await sleep(150);
  check('kit: Curve gives the group a fan curve', await evalJs(send, `!!document.querySelector('[data-group="group-1"] .ds-fan-curve-svg')`));
  check('kit: the group\'s mode is kept', (await kitSaved(send)).groups?.[0]?.mode === 'curve');

  // Identify (lcd-diy.11).
  await clickText(send, 'Identify', '[data-group="group-1"]');
  await sleep(150);
  check('kit: Identify flashes the group\'s three fans', (await evalJs(send, `document.querySelectorAll('.fk-fan.lit').length`)) === 3);
  check('kit: and stops by itself', await waitFor(send, `document.querySelectorAll('.fk-fan.lit').length === 0`, 5000));

  await evalJs(send, `document.querySelector('.dc-canvas [aria-label="New group"]').click()`);
  await sleep(150);
  await shoot(send, 'fan-kit-groups');
  check('kit: a new group is added, named Group 2',
    (await evalJs(send, `document.querySelector('[data-group="group-2"] .fk-group-name')?.textContent.trim()`)) === 'Group 2');
  await evalJs(send, `document.querySelector('[data-group="group-2"] [aria-label="Rename Group 2"]').click()`);
  await sleep(100);
  await typeInto(send, '[data-group="group-2"] input', 'Top exhaust');
  await sleep(150);
  check('kit: a group takes the name the player gives it',
    (await evalJs(send, `document.querySelector('[data-group="group-2"] .fk-group-name')?.textContent.trim()`)) === 'Top exhaust');

  // Names (lcd-diy.12) that survive fans coming and going (lcd-diy.37).
  await clickTab(send, 'Fans');
  await sleep(200);
  await typeInto(send, '[data-fan="kit-1"] input', 'Front intake');
  await sleep(200);
  fans = await heroFans(send);
  check('kit: a renamed fan shows its new name', fans.find(([id]) => id === 'kit-1')?.[1] === 'Front intake', JSON.stringify(fans));
  check('kit: the name is kept', (await kitSaved(send)).fans?.find((f) => f.id === 'kit-1')?.name === 'Front intake');
  await clickText(send, 'Simulate: plug in a fan', '[data-port="2"]');
  await sleep(150);
  await clickText(send, 'Simulate: unplug the first', '[data-port="2"]');
  await sleep(150);
  fans = await heroFans(send);
  check('kit: plugging one in and pulling another renames no other fan',
    JSON.stringify(fans.map(([, n]) => n)) === q(['Front intake', 'Fan 2', 'Fan 3', 'Fan 4', 'Fan 6', 'Fan 7']), JSON.stringify(fans));
  for (let i = 0; i < 6; i++) {
    await clickText(send, 'Simulate: plug in a fan', '[data-port="1"]');
    await sleep(60);
  }
  check('kit: a port takes 10 fans, then says why it takes no more',
    (await evalJs(send, `document.querySelectorAll('[data-port="1"] .fk-fan-row').length`)) === 10 &&
      (await evalJs(send, `document.querySelector('[data-port="1"] .fk-sim .pcp-reason')?.textContent.trim()`)) === 'A port drives 10 fans at most.');
  for (let i = 0; i < 6; i++) {
    await clickText(send, 'Simulate: plug in a fan', '[data-port="2"]');
    await sleep(60);
  }
  check('kit: the kit takes 16 fans across two ports',
    (await evalJs(send, `document.querySelectorAll('.fk-fan-row').length`)) === 16 &&
      (await evalJs(send, `document.querySelector('[data-port="2"] .fk-sim .pcp-reason')?.textContent.trim()`)) === 'The kit drives 16 fans at most.');
  await shoot(send, 'fan-kit-fans');
  await evalJs(send, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  check('kit: Esc closes it', await waitFor(send, `!document.querySelector('.dc-canvas')`));

  // ── The cap reads the new name; sleep, restart, display off ────────────────
  await openCap(send);
  check('cap: a fan renamed in the kit shows on the cap under the new name',
    await waitFor(send, `(document.querySelector('.pcp-hero .pcp-face-list')?.textContent ?? '').includes('Front intake')`, 2000));
  await clickView(send, 'Settings');
  await sleep(200);
  await clickText(send, 'Sleep and wake');
  await sleep(200);
  check('cap: asleep, the cap is dark and the page says why',
    (await evalJs(send, `!!document.querySelector('.pcp-hero .pcp-cap.off')`)) &&
      (await evalJs(send, `[...document.querySelectorAll('.dc-chip-val')].some(c => c.textContent.trim() === 'PC asleep')`)));
  check('cap: on waking it comes back to the player\'s setting (lcd-diy.20)',
    await waitFor(send, `!document.querySelector('.pcp-cap.off') && document.querySelector('.pcp-hero .pcp-face-list')`, 5000));
  await clickText(send, 'Restart');
  check('cap: a restart plays the Power On Effect',
    await waitFor(send, `document.querySelector('.pcp-hero .pcp-cap')?.getAttribute('aria-label') === 'Cooler cap, showing the Power On Effect'`, 4000));
  check('cap: then comes back to the player\'s setting',
    await waitFor(send, `document.querySelector('.pcp-hero .pcp-face-list')`, 5000));
  await clickText(send, 'Display off');
  await sleep(200);
  check('cap: the cap goes dark with the display (lcd-diy.21)', await evalJs(send, `!!document.querySelector('.pcp-hero .pcp-cap.off')`));
  await waitFor(send, `!document.querySelector('.pcp-cap.off')`, 5000);

  // Firmware (lcd-diy.23, .24, .40).
  await clickText(send, 'Check for updates', '[data-firmware="Cooler cap"]');
  check('cap firmware: a check finds the update', await waitFor(send, `[...document.querySelectorAll('[data-firmware="Cooler cap"] button')].some(b => b.textContent.trim() === 'Install v2.4.0')`, 3000));
  await clickText(send, 'Install v2.4.0', '[data-firmware="Cooler cap"]');
  check('cap firmware: installing ends in one restart', await waitFor(send, `[...document.querySelectorAll('[data-firmware="Cooler cap"] button')].some(b => b.textContent.trim() === 'Restart now')`, 3000));
  await clickText(send, 'Restart now', '[data-firmware="Cooler cap"]');
  await sleep(150);
  check('cap firmware: then it is up to date',
    (await evalJs(send, `document.querySelector('[data-firmware="Cooler cap"]').textContent`)).includes('v2.4.0') &&
      (await evalJs(send, `document.querySelector('[data-firmware="Cooler cap"]').textContent`)).includes('Up to date'));
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await clickText(send, 'Check for updates', '[data-firmware="Fan kit controller"]');
  await sleep(200);
  check('kit firmware: offline, the button still answers (lcd-diy.40)',
    (await evalJs(send, `document.querySelector('[data-firmware="Fan kit controller"]').textContent`)).includes("You're offline"));
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // An event over the content (lcd-diy.6).
  await clickText(send, 'Preview an event');
  check('cap: with events on, an event shows over the content', await waitFor(send, `document.querySelector('.pcp-hero .pcp-cap-event')`, 1000));
  await shoot(send, 'cooler-cap-settings');
  await closeCanvas(send);

  await evalJs(send, `${q(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

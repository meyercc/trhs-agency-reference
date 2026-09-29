// CDP walkthrough for the profile SURFACES — the switcher in the nav, the
// Profiles modal, the Personalize section, and the Settings override notes.
//
// The model itself is covered elsewhere: verify-profiles.mjs (arbitration, pure)
// and verify-profile-resolution.mjs (override resolution + capture, in-app).
// This one is about whether a person can see and drive any of it.
//
// The claim worth protecting hardest: EDITING A PROFILE IS NOT SWITCHING TO IT.
// The modal's list selection is local, so you can fix the Work profile at 9pm
// without the desk changing color. It is one `useState` away from being wrong
// and nothing about the screen would look broken if it were.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = (await httpJson('/json/list')).find((x) => x.type === 'page');
if (!target) throw new Error(`No page target on :${CDP_PORT} — is headless Chrome running?`);
const ws = new WebSocket(target.webSocketDebuggerUrl);

let msgId = 0;
const pending = new Map();
const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    pageErrors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 160));
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
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}

let loadN = 0;
/** `?r=N` before the hash forces a real boot — a hash-only change never does. */
const goto = async (hash) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/${hash}` });
  await sleep(2800);
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Leave the app as we found it. These suites rewrite the profile store and the
// appearance baseline, and other suites (verify-device-button drives the Active
// Profile widget by button label) read that state — a renamed profile left
// behind fails a suite that has nothing to do with profiles.
async function cleanup() {
  try {
    await evalJs(`['trhs-profiles','accent','theme','wallpaper','wpBlur','wpOpacity'].forEach((k) => localStorage.removeItem(k))`);
  } catch {
    /* page already gone — nothing to restore */
  }
}

const store = () => evalJs(`JSON.parse(localStorage.getItem('trhs-profiles') || 'null')`);
const trigger = () => evalJs(`document.querySelector('.profile-switcher-btn')?.textContent.trim() || 'none'`);
const click = (sel) => evalJs(`document.querySelector(${JSON.stringify(sel)})?.click(), true`);

// ── The switcher ────────────────────────────────────────────────────────────
await goto('');
await evalJs(`localStorage.clear()`);
await goto('');

check('the switcher sits in the nav', await evalJs(`!!document.querySelector('.shell-util .profile-switcher-wrap')`));
check('it sits LEFT of the account avatar', await evalJs(`(() => {
  const u = document.querySelector('.shell-util');
  const kids = [...u.children];
  return kids.findIndex(k => k.classList.contains('profile-switcher-wrap'))
       < kids.findIndex(k => k.classList.contains('account-menu-wrap'));
})()`));
check('it names the active profile', (await trigger()).includes('Gaming'), await trigger());
check('the trigger is labeled for screen readers',
  (await evalJs(`document.querySelector('.profile-switcher-btn').getAttribute('aria-label')`)) === 'Profile: Gaming');

await click('.profile-switcher-btn');
await sleep(400);
check('opening lists every profile', (await evalJs(`document.querySelectorAll('.profile-switcher-menu .ds-list-item').length`)) === 4, '3 profiles + Manage');
check('the active row is marked checked, not just colored', await evalJs(`(() => {
  const rows = [...document.querySelectorAll('.profile-switcher-menu [role="menuitemradio"]')];
  const on = rows.filter(r => r.getAttribute('aria-checked') === 'true');
  return on.length === 1 && /Gaming/.test(on[0].textContent);
})()`));

// Escape must close it — the same contract the account menu has.
await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
await sleep(300);
check('Escape closes the menu', !(await evalJs(`!!document.querySelector('.profile-switcher-menu')`)));

// Picking a row switches the whole app.
await click('.profile-switcher-btn');
await sleep(300);
await evalJs(`[...document.querySelectorAll('.profile-switcher-menu .ds-list-item')].find(r=>/Silent/.test(r.textContent))?.click()`);
await sleep(500);
check('picking a profile switches the app', (await trigger()).includes('Silent'), await trigger());
check('a hand pick is recorded as manual intent', (await store())?.source === 'manual');

// ── The modal ───────────────────────────────────────────────────────────────
await goto('?modal=profiles');
check('the modal is deep-linkable at ?modal=profiles', await evalJs(`!!document.querySelector('.profiles-modal')`));
check('the rail lists every profile', (await evalJs(`document.querySelectorAll('.pfm-nav .ds-modal-nav-item').length`)) === 3);
check('the rail names which profile is RUNNING', await evalJs(`(() => {
  const items = [...document.querySelectorAll('.pfm-nav .ds-modal-nav-item')];
  const badged = items.filter(i => i.querySelector('.pfm-nav-badge'));
  return badged.length === 1 && /Silent/.test(badged[0].textContent);
})()`));

// THE claim: selecting in the rail edits, it does not switch.
await evalJs(`[...document.querySelectorAll('.pfm-nav .ds-modal-nav-item')].find(i=>/Work/.test(i.textContent))?.click()`);
await sleep(400);
check('selecting a profile to edit does NOT activate it',
  (await store())?.activeId === 'silent' && (await trigger()).includes('Silent'),
  `active=${(await store())?.activeId}`);
check('but the editor is now showing that profile',
  (await evalJs(`document.querySelector('.profiles-modal input[aria-label="Profile name"]')?.value`)) === 'Work');
check('and it offers an explicit Activate',
  await evalJs(`[...document.querySelectorAll('.pfm-footer button')].some(b=>/Activate/.test(b.textContent))`));

// Renaming reaches every surface that shows the name.
await evalJs(`(() => {
  const el = document.querySelector('.profiles-modal input[aria-label="Profile name"]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, 'Focus');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await sleep(500);
check('renaming persists', (await store())?.profiles.some((p) => p.name === 'Focus'));
check('renaming reaches the rail',
  await evalJs(`[...document.querySelectorAll('.pfm-nav .ds-modal-nav-item')].some(i=>/Focus/.test(i.textContent))`));

// Creating appends and selects the new profile without activating it.
const before = (await store())?.profiles.length ?? 0;
await click('.pfm-new');
await sleep(500);
const after = await store();
check('New Profile creates one', after?.profiles.length === before + 1, `${before} → ${after?.profiles.length}`);
check('the new profile is selected for editing',
  (await evalJs(`document.querySelector('.profiles-modal input[aria-label="Profile name"]')?.value`)) === 'New Profile');
check('creating does not switch the app to it', after?.activeId === 'silent');

// Overrides, set from the modal and cleared from it.
await evalJs(`[...document.querySelectorAll('.pfm-nav .ds-modal-nav-item')].find(i=>/Focus/.test(i.textContent))?.click()`);
await sleep(400);
await evalJs(`document.querySelector('[aria-label="Accent override"] .ds-swatch:nth-child(3)')?.click()`);
await sleep(500);
check('an accent override is written to the profile',
  'accent' in ((await store())?.profiles.find((p) => p.name === 'Focus')?.overrides ?? {}),
  JSON.stringify((await store())?.profiles.find((p) => p.name === 'Focus')?.overrides));
check('"Use app setting" appears once a key is overridden',
  await evalJs(`!!document.querySelector('.pfm-clear')`));
await click('.pfm-clear');
await sleep(500);
check('and clearing hands the key back',
  !('accent' in ((await store())?.profiles.find((p) => p.name === 'Focus')?.overrides ?? {})));

// Schedule + game link round-trip.
await evalJs(`[...document.querySelectorAll('.pfm-days .ds-chip')].find(c=>/Sat/.test(c.textContent))?.click()`);
await sleep(400);
check('a schedule day toggles on',
  ((await store())?.profiles.find((p) => p.name === 'Focus')?.schedule.days ?? []).includes(6));
await evalJs(`[...document.querySelectorAll('.profiles-modal button')].find(b=>/Choose games|linked/.test(b.textContent))?.click()`);
await sleep(400);
check('the game picker lists linkable games',
  (await evalJs(`document.querySelectorAll('.pfm-gamelist .ds-list-item').length`)) > 0);
await evalJs(`document.querySelector('.pfm-gamelist .ds-list-item')?.click()`);
await sleep(400);
check('picking a game links it',
  ((await store())?.profiles.find((p) => p.name === 'Focus')?.gameLink.gameIds ?? []).length === 1);

// The details manifest is derived from what was captured, not authored.
await click('.pfm-disclosure[aria-controls="pfm-details"]');
await sleep(400);
check('with nothing captured, Details teaches where settings come from',
  /Nothing captured yet/.test(await evalJs(`document.querySelector('.pfm-empty')?.textContent || ''`)));

// Seed a capture and confirm the manifest groups it by the device's own tab.
await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles'));
  const p = s.profiles.find(x => x.name === 'Focus');
  p.devices = { 'origins-65': { 'lighting.brightness': 42, 'settings.pollingRate': '1000 Hz' } };
  s.activeId = p.id;
  localStorage.setItem('trhs-profiles', JSON.stringify(s));
})()`);
await goto('?modal=profiles');
await click('.pfm-disclosure[aria-controls="pfm-details"]');
await sleep(500);
check('the manifest names the device', /ALLOY|ORIGINS|65/i.test(await evalJs(`document.querySelector('.pfm-device-head')?.textContent || ''`)),
  await evalJs(`document.querySelector('.pfm-device-head')?.textContent || 'none'`));
check('and groups captured keys under the device\'s own tab titles', await evalJs(`(() => {
  const titles = [...document.querySelectorAll('.pfm-group-title')].map(t => t.textContent.trim());
  return titles.includes('Lights') && titles.includes('Settings');
})()`), await evalJs(`[...document.querySelectorAll('.pfm-group-title')].map(t=>t.textContent.trim()).join(' | ')`));
check('showing the captured value, read-only', await evalJs(`(() => {
  const rows = [...document.querySelectorAll('.pfm-row')].map(r => r.textContent.trim());
  return rows.some(r => /Brightness42/.test(r.replace(/\\s+/g,''))) &&
         document.querySelectorAll('.pfm-manifest input, .pfm-manifest button').length === 0;
})()`));

// ── Export / import, from the rail's foot ───────────────────────────────────
// Both are off-screen acts (a download, a file picker), so the surface's job is
// the buttons, the feedback line, and what the list looks like afterwards. The
// file format itself is covered by verify-profiles.mjs.
await goto('?modal=profiles');
await send('Page.setDownloadBehavior', { behavior: 'deny' });
// Wait on the state the next check reads (the feedback line), not on a timer.
const waitFor = async (sel, ms = 3000) => {
  for (let t = 0; t < ms; t += 100) {
    try { if (await evalJs(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; } catch { /* mid-navigation */ }
    await sleep(100);
  }
  return false;
};
const railBtn = (re) => evalJs(`[...document.querySelectorAll('.pfm-nav-actions .ds-btn')].find(b => ${re}.test(b.textContent))?.click(), 1`);
check('the rail foot offers Export and Import', await evalJs(`(() => {
  const t = [...document.querySelectorAll('.pfm-nav-actions .ds-btn')].map(b => b.textContent.trim());
  return t.length === 2 && /Export All Profiles/.test(t[0]) && /Import Profiles/.test(t[1]);
})()`));
check('Export is the primary of the two', await evalJs(`document.querySelector('.pfm-nav-actions .ds-btn').classList.contains('accent')`));
const countBefore = (await store())?.profiles.length ?? 0;
await railBtn('/Export/');
await waitFor('.pfm-nav-status:not(:empty)');
check('exporting says what happened, in words',
  new RegExp(`${countBefore} profiles exported`).test(await evalJs(`document.querySelector('.pfm-nav-status')?.textContent || ''`)),
  await evalJs(`document.querySelector('.pfm-nav-status')?.textContent`));

// Import: hand the hidden file input a real file over CDP. The fixture is one
// new profile plus a second copy of Gaming (same id + name) — the copy must
// update in place, never duplicate.
const fixture = join(tmpdir(), `trhs-import-${Date.now()}.json`);
writeFileSync(fixture, JSON.stringify({
  format: 'trhs-profiles', version: 1, exported: '2026-09-22T00:00:00.000Z',
  profiles: [
    { id: 'stream', name: 'Streaming', image: 'wp:purple', overrides: { accent: 'purple' }, devices: {}, gameLink: { enabled: false, gameIds: [] }, schedule: { enabled: false, start: 540, end: 1020, days: [1] } },
    { id: 'gaming', name: 'Gaming', image: 'wp:abstractv2', overrides: {}, devices: {}, gameLink: { enabled: false, gameIds: [] }, schedule: { enabled: false, start: 540, end: 1020, days: [1] } },
  ],
}));
const activeBefore = (await store())?.activeId;
const { root } = await send('DOM.getDocument', { depth: 1 });
const { nodeId: inputNode } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.pfm-nav-actions input[type="file"]' });
await send('DOM.setFileInputFiles', { nodeId: inputNode, files: [fixture] });
// The note is written once the file has been read and applied, so wait for
// its final wording rather than for the element to be non-empty — a first
// read on a slow renderer caught it before the count landed.
const statusText = () => evalJs(`document.querySelector('.pfm-nav-status')?.textContent || ''`);
let imported = false;
for (let t = 0; t < 3000 && !imported; t += 100) {
  imported = /2 profiles imported/.test(await statusText());
  if (!imported) await sleep(100);
}
check('importing says how many arrived', imported, await statusText());
check('a new profile is added; the same profile is updated, not duplicated', await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles'));
  const names = s.profiles.map(p => p.name);
  return names.filter(n => n === 'Gaming').length === 1 && names.includes('Streaming')
    && s.profiles.find(p => p.id === 'gaming').image === 'wp:abstractv2';
})()`));
check('the rail lists what arrived', await evalJs(`[...document.querySelectorAll('.pfm-nav .ds-modal-nav-item')].some(i => /Streaming/.test(i.textContent))`));
check('the first imported profile is opened for editing, not activated',
  (await evalJs(`document.querySelector('.profiles-modal input[aria-label="Profile name"]')?.value`)) === 'Streaming'
    && (await store())?.activeId === activeBefore);
rmSync(fixture, { force: true });

// ── A long list scrolls inside the rail; the ends of the rail stay put ──────
// The window's height must never decide how many profiles can exist.
await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles'));
  for (let i = 0; i < 20; i++) s.profiles.push({ id: 'many-' + i, name: 'Profile ' + i, image: 'wp:blue', overrides: {}, devices: {}, gameLink: { enabled: false, gameIds: [] }, schedule: { enabled: false, start: 540, end: 1020, days: [1] } });
  localStorage.setItem('trhs-profiles', JSON.stringify(s));
})()`);
await goto('?modal=profiles');
await waitFor('.pfm-nav-actions');
const railGeom = await evalJs(`(() => {
  const box = (s) => document.querySelector(s).getBoundingClientRect();
  const rail = box('.modal-left'), top = box('.pfm-new'), foot = box('.pfm-nav-actions');
  const list = document.querySelector('.pfm-nav .ds-modal-nav');
  return { listScrolls: list.scrollHeight > list.clientHeight,
           railScrolls: document.querySelector('.modal-left').scrollHeight > document.querySelector('.modal-left').clientHeight,
           topInside: top.top >= rail.top && top.bottom <= rail.bottom,
           footInside: foot.top >= rail.top && foot.bottom <= rail.bottom };
})()`);
check('with many profiles the LIST scrolls, not the rail', railGeom.listScrolls && !railGeom.railScrolls, JSON.stringify(railGeom));
check('New Profile stays at the top of the rail', railGeom.topInside);
check('Export / Import stay at the foot of the rail', railGeom.footInside);

// ── Settings override notes ─────────────────────────────────────────────────
await evalJs(`(() => {
  localStorage.setItem('accent', 'orange');
  const s = JSON.parse(localStorage.getItem('trhs-profiles'));
  s.profiles.find(p => p.id === s.activeId).overrides = { accent: 'purple' };
  localStorage.setItem('trhs-profiles', JSON.stringify(s));
})()`);
await goto('?modal=settings');
check('Settings says which profile took a setting over',
  /Set by the/.test(await evalJs(`document.querySelector('.stx-override')?.textContent || ''`)),
  await evalJs(`document.querySelector('.stx-override')?.textContent.trim() || 'NONE'`));
check('the row shows the BASELINE it edits, not the resolved value', await evalJs(`(() => {
  const swatches = [...document.querySelectorAll('[aria-label="Accent color"] .wg-swatch')];
  const on = swatches.findIndex(b => b.getAttribute('aria-pressed') === 'true');
  return swatches[on]?.getAttribute('aria-label') === 'orange';
})()`));
const accentVar = () => evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()`);
const purple = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--accent-purple').trim()`);
check('while the app actually runs the override', (await accentVar()) === purple, await accentVar());
await click('.stx-override-clear');
await sleep(500);
const orange = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim()`);
check('Clear hands it back live, with no reload', (await accentVar()) === orange, await accentVar());

// ── Personalize section ─────────────────────────────────────────────────────
await goto('personalize');
// The section mounts after the page's own data settles; read it once it is there.
check('Personalize has a Profiles section', await waitFor('.pmg'));
check('it lists every profile as a card',
  (await evalJs(`document.querySelectorAll('.pmg-card').length`)) === (await store())?.profiles.length);
check('the active card says so in words, not just an accent border',
  await evalJs(`!!document.querySelector('.pmg-card.is-active .pmg-badge')`));

// ── Light theme ─────────────────────────────────────────────────────────────
await evalJs(`localStorage.setItem('theme','light')`);
await goto('?modal=profiles');
check('light theme: the modal renders', await evalJs(`document.documentElement.classList.contains('light') && !!document.querySelector('.profiles-modal')`));
check('light theme: the switcher name is not painted on its own color', await evalJs(`(() => {
  const el = document.querySelector('.profile-switcher-btn');
  const cs = getComputedStyle(el);
  return cs.color !== cs.backgroundColor;
})()`));

check('no page exceptions throughout', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

await cleanup();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

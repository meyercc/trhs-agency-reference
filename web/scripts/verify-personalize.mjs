// CDP walkthrough for the Personalize page as Quick Control (Kristy's arc, ported
// onto main on 2026-09-29 — TH-415/TH-416).
//
// What is protected here, in order of how expensive it would be to lose:
//  1. The page COMPOSES — Kristy's five sections AND Cindy's Display section
//     render together, in the decided default order, from a fresh browser.
//  2. The device cards carry their controls (Option A, 2026-10-12 — Quick
//     Controls and Devices are one section): each card shows ONE control until
//     the person picks more (Kristy, 2026-10-14; the headset's is Volume), the
//     EQ chips cover every value the model holds, and the card's ⋮ chooser
//     adds a control that survives a reload; every control may be off.
//  3. Desk lighting belongs to the PROFILE (Kristy's branch, contesting the
//     2026-09-29 page-local decision): a lighting change is written to the
//     active profile's `deskLighting` override, a profile switch puts on that
//     profile's lighting, and switching back brings the change back.
//  4. The desk is the picker: clicking a device on the 3D desk opens that
//     device's modal (`?sku=`), not a highlight down the page.
//  5. The Devices cards carry no status line (Kristy, 2026-10-14) and hide
//     their battery by rule. The desktop's LCD cooler cap is a part of the PC,
//     so it is a line on the tower's card, not a card of its own (JY,
//     2026-10-22): it says what the cap's screen shows now and opens the PC's
//     page at that tab (lcd-diy.25); not on a notebook, not under June 2027.
//  6. The profile band (TH-439, Sept 30 2026 — replaces the context strip and
//     the Profiles card grid): it names the active profile and why it is on,
//     switches to the others in one click, and follows one rule for anything
//     automatic — the profile's own rules (Game Link, Schedule) act and say so
//     with Undo, a guess (a calendar entry) asks. A control the profile owns is
//     saved to it on change and comes back with the profile.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. The page hosts Light Studio (three.js): launch Chrome with
// software WebGL (`--use-angle=swiftshader --enable-unsafe-swiftshader`) when
// the machine has no GPU, or the renderer throws and the root unmounts.
// Leaves the browser as it found it: the page store, the section order and the
// active profile are restored at the end.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;
const STORE = 'personalize-quick-control-v1';
const ORDER = 'personalize-sections';

const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = (await httpJson('/json/list')).find((x) => x.type === 'page');
if (!target) throw new Error(`No page target on :${CDP_PORT} — is headless Chrome running?`);
const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });

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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}
const waitFor = async (expr, ms = 6000) => {
  for (let t = 0; t < ms; t += 100) {
    try { if (await evalJs(expr)) return true; } catch { /* mid-navigation */ }
    await sleep(100);
  }
  return false;
};
let loadN = 0;
/** `?r=N` before the hash forces a real boot — a hash-only change never does. */
const go = async (hash, readyExpr = `!!document.querySelector('.qc-band')`) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#${hash}` });
  await waitFor(readyExpr, 12000);
  await sleep(300);
};
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};
// The headset's card in Personalize › Devices.
const HEADSET = `[...document.querySelectorAll('.pg-devices .ds-devcard')].find(c => c.querySelector('.devw-title')?.textContent.trim() === 'Cloud III')`;
const clickByText = (sel, re) => evalJs(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => ${re}.test(e.textContent)); if (!el) return false; el.click(); return true; })()`);

// ── Remember what we found, restore it at the end ────────────────────────────
await go('/');
const saved = await evalJs(`({ store: localStorage.getItem(${JSON.stringify(STORE)}), order: localStorage.getItem(${JSON.stringify(ORDER)}), profiles: localStorage.getItem('trhs-profiles') })`);
async function cleanup() {
  await evalJs(`(() => {
    const put = (k, v) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    put(${JSON.stringify(STORE)}, ${JSON.stringify(saved.store)});
    put(${JSON.stringify(ORDER)}, ${JSON.stringify(saved.order)});
    put('trhs-profiles', ${JSON.stringify(saved.profiles)});
    return true;
  })()`);
}
// A fresh page: no pins, no saved order, the seeded profiles.
await evalJs(`localStorage.removeItem(${JSON.stringify(STORE)}); localStorage.removeItem(${JSON.stringify(ORDER)}); localStorage.removeItem('trhs-profiles'); localStorage.setItem('onboarded', 'true'); true`);
// The profile steps below pick EQ on the headset card, so it shows EQ too.
const CLOUD_TWO = `localStorage.setItem('trhs-devcard-controls:cloud-iii', JSON.stringify(['volume', 'eq'])); true`;
await evalJs(CLOUD_TWO);

try {
  // ── 1. Composition ─────────────────────────────────────────────────────────
  await go('/personalize');
  const labels = await evalJs(`[...document.querySelectorAll('.rs-section .pg-section-label')].map(e => e.textContent.trim())`);
  check('the page composes: Kristy’s sections + Cindy’s Display, in the decided order',
    JSON.stringify(labels) === JSON.stringify(['Lighting', 'Devices', 'Display', 'Everything else']),
    labels.join(' · '));
  check('the profile band is the one fixed thing above the list',
    await evalJs(`!!document.querySelector('.qc-band') && !document.querySelector('.rs-section .qc-band')`));
  check('Display still draws Cindy’s desk picture beside its controls',
    await evalJs(`!!document.querySelector('.rs-section .pg-rail .dov-group') || !!document.querySelector('.rs-section .pg-rail')`));
  check('the Modules tile in Everything else opens the Module Browser',
    await evalJs(`(() => { const t = [...document.querySelectorAll('.qc-else .ds-quick-tile')].find(e => /Modules/.test(e.textContent)); if (!t) return false; t.click(); return true; })()`) &&
    await waitFor(`location.search.includes('modal=modules') || !!document.querySelector('.modal-shell')`),
    'clicked');
  await evalJs(`document.querySelector('.modal-close')?.click(); true`);

  // ── 6. The profile band ────────────────────────────────────────────────────
  // The title span only: the title row also holds the ⓘ reason icon, whose
  // tooltip text would otherwise be read as part of the name.
  const bandName = () => evalJs(`document.querySelector('.qc-band .qc-band-name')?.textContent.trim()`);
  const bandWhy = () => evalJs(`document.querySelector('.qc-band .qc-band-why')?.textContent.trim()`);
  // Profiles switch from the nav's switcher; the band keeps only Manage Profiles.
  const pickChip = (name) => evalJs(`(async () => {
    document.querySelector('.profile-switcher-btn')?.click();
    await new Promise(r => setTimeout(r, 150));
    const row = [...document.querySelectorAll('.profile-switcher-menu .ds-list-item')].find(x => x.textContent.trim().startsWith(${JSON.stringify(name)}));
    row?.click();
    return !!row;
  })()`);
  const context = async (digit) => { await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit${digit}', altKey: true, shiftKey: true })); true`); await sleep(500); };
  const bandText = () => evalJs(`document.querySelector('.qc-band')?.innerText.replace(/\\n+/g, ' | ')`);

  // Picked by you: no "why" (Kristy, 2026-10-14) — only a switch made by
  // something else says why.
  check('the band names the active profile, with no why when you picked it', (await bandName()) === 'Gaming' && !(await bandWhy()), `${await bandName()}: ${await bandWhy()}`);
  check('…and has no ⓘ any more', !(await evalJs(`!!document.querySelector('.qc-band .ds-quick-tile-reason-icon')`)));
  check('…and when it turns on by itself (Gaming’s seeded Game Link)', /Turns on for Valorant/.test(await evalJs(`document.querySelector('.qc-band-when')?.textContent || ''`)));
  // 2026-10-09: one labelled Manage Profiles button, nothing else in the band.
  const bandActions = await evalJs(`[...document.querySelectorAll('.qc-band .ds-quick-tile-actions button')].map(b => b.textContent.trim())`);
  check('the band offers one Manage Profiles button and nothing else',
    JSON.stringify(bandActions) === JSON.stringify(['Manage Profiles']), JSON.stringify(bandActions));
  check('the old Profiles card grid is gone', await evalJs(`!document.querySelector('.pmg-card')`));

  // Your rule acts and says so: Work → Valorant starts → Gaming, with Undo.
  await pickChip('Work'); await sleep(400);
  await context(1);
  check('a linked game switches the profile by itself', (await bandName()) === 'Gaming', await bandText());
  check('…and says it was Game Link, with an Undo back to where you were',
    /^Switched by Game Link/.test((await bandWhy()) || '') && /Undo · back to Work/.test(await bandText()), await bandText());
  await clickByText('.qc-band button', '/Undo/');
  await sleep(400);
  check('Undo goes back, and the band drops the why', (await bandName()) === 'Work' && !(await bandWhy()), await bandText());

  // A guess asks: from Gaming (picked), a Teams call on the calendar.
  await pickChip('Gaming'); await sleep(400);
  await context(2);
  check('a guess (a calendar entry) asks instead of switching',
    (await bandName()) === 'Gaming' && (await evalJs(`document.querySelector('.qc-band')?.classList.contains('asking')`)) && /Switch to Work\?/.test((await bandWhy()) || ''),
    await bandText());
  check('…and it is the one question on the page (the suggestion row waits)', await evalJs(`!document.querySelector('.qc-suggestions')`));
  await clickByText('.qc-band button', '/Not now/');
  await sleep(300);
  check('Not now leaves the profile alone', (await bandName()) === 'Gaming' && !(await evalJs(`document.querySelector('.qc-band')?.classList.contains('asking')`)), await bandText());

  // Your schedule acts: quiet hours open at 11:00 PM.
  await context(3);
  check('a schedule switches the profile by itself, and says so', (await bandName()) === 'Silent' && /^Switched by your schedule/.test((await bandWhy()) || ''), await bandText());

  // What you change is saved to what's running.
  await pickChip('Work'); await sleep(400);
  const pickEq = (label) => evalJs(`(() => { const b = [...document.querySelectorAll('.qc-choices[aria-label="EQ preset"] button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); b?.click(); return !!b; })()`);
  const eqNow = () => evalJs(`[...document.querySelectorAll('.qc-choices[aria-label="EQ preset"] button')].find(b => b.getAttribute('aria-pressed') === 'true')?.textContent.trim()`);
  await pickEq('Music'); await sleep(400);
  await pickChip('Gaming'); await sleep(500);
  const gamingEq = await eqNow();
  await pickChip('Work'); await sleep(500);
  check('the change belongs to Work: Gaming keeps its own EQ, Work gets Music back', gamingEq !== 'Music' && (await eqNow()) === 'Music', `${gamingEq} / ${await eqNow()}`);
  await pickChip('Gaming'); await sleep(400);

  // ── 2. Device cards carry their controls ──────────────────────────────────
  check('there is no separate Quick controls section', !(await evalJs(`!!document.querySelector('.qc-controls')`)));
  const headsetCtls = () => evalJs(`[...(${HEADSET}?.querySelectorAll('.devw-ctl-label') ?? [])].map(e => e.textContent.trim())`);
  // One control per card until the person picks more (Kristy, 2026-10-14).
  await evalJs(`localStorage.removeItem('trhs-devcard-controls:cloud-iii'); true`);
  await go('/personalize');
  check('a card shows one control by default (the headset: Volume)', JSON.stringify(await headsetCtls()) === JSON.stringify(['Volume']), JSON.stringify(await headsetCtls()));
  await evalJs(CLOUD_TWO);
  await go('/personalize');
  const eq = await evalJs(`(() => {
    const g = ${HEADSET}?.querySelector('.qc-choices[aria-label="EQ preset"]');
    return g ? [...g.querySelectorAll('button')].map(b => b.textContent.trim()) : null;
  })()`);
  check('its EQ chips cover every value the model holds (5)',
    !!eq && eq.length === 5 && ['FPS', 'Music', 'Movie', 'Voice', 'Flat'].every((l) => eq.includes(l)),
    JSON.stringify(eq));
  // The ⋮ chooser: add Spatial audio, keep it after a reload, never drop the last.
  const openChooser = async () => {
    await evalJs(`${HEADSET}?.querySelector('.card-menu button')?.click(); true`);
    await sleep(250);
    await evalJs(`document.querySelector('.card-menu-pop [data-action="customize"]')?.click(); true`);
    await sleep(250);
  };
  await openChooser();
  const flip = (label) => evalJs(`(() => { const r = [...document.querySelectorAll('.card-menu-pop .devw-face-row')].find(x => x.textContent.trim() === ${JSON.stringify('LABEL')}.replace('LABEL', ${JSON.stringify(label)})); const s = r?.querySelector('[role=switch], input, button'); s?.click(); return !!s; })()`);
  check('the card’s ⋮ lists every control it can show',
    JSON.stringify(await evalJs(`[...document.querySelectorAll('.card-menu-pop .devw-face-row')].map(r => r.textContent.trim())`)) === JSON.stringify(['Volume', 'EQ', 'Spatial audio', 'Sidetone']),
    JSON.stringify(await evalJs(`[...document.querySelectorAll('.card-menu-pop .devw-face-row')].map(r => r.textContent.trim())`)));
  await flip('Spatial audio'); await sleep(200);
  check('turning one on puts it on the card', (await headsetCtls()).includes('Spatial audio'), JSON.stringify(await headsetCtls()));
  await go('/personalize');
  check('…and it is still there after a reload', (await headsetCtls()).includes('Spatial audio'), JSON.stringify(await headsetCtls()));
  await openChooser();
  for (const l of ['Volume', 'EQ', 'Spatial audio']) { await flip(l); await sleep(120); }
  // Every control may be off (TH-465). The rule used to be that the last one
  // stayed on, because the chooser was reached from inside the rows it would
  // hide; it is the card's own ⋮ now, so an empty card can still be refilled.
  check('every control can be turned off, and the ⋮ is still there to undo it',
    (await headsetCtls()).length === 0 && (await evalJs(`!!${HEADSET}?.querySelector('.card-menu button')`)) === true,
    JSON.stringify(await headsetCtls()));
  await evalJs(CLOUD_TWO);
  await go('/personalize');
  check('pressing a control never opens the device', await evalJs(`(() => { ${HEADSET}?.querySelector('.devw-ctl .ds-chip')?.click(); return !location.hash.includes('sku='); })()`));

  // ── 3. Lighting belongs to the profile ─────────────────────────────────────
  const profileStore = () => evalJs(`JSON.parse(localStorage.getItem('trhs-profiles') || '{}')`);
  const lightsOn = () => evalJs(`document.querySelector('[aria-label="Desk lighting"]')?.getAttribute('aria-checked')`);
  const allOffIn = (l) => !!l && Object.values(l).length > 0 && Object.values(l).every((d) => d.on === false || d.effect === 'off' || d.brightness === 0);
  // Name profiles by the band on screen, find ids in the store afterwards.
  const selectedName = bandName;
  const clickProfile = pickChip;
  const firstName = await selectedName();
  check('the desk starts lit', (await lightsOn()) === 'true', String(await lightsOn()));
  await evalJs(`document.querySelector('[aria-label="Desk lighting"]')?.click(); true`);
  await sleep(500);
  check('the toggle reads off', (await lightsOn()) === 'false', String(await lightsOn()));
  const first = (await profileStore()).profiles?.find((pr) => pr.name === firstName)?.id;
  const ownOverride = (await profileStore()).profiles?.find((pr) => pr.id === first)?.overrides?.deskLighting;
  check('turning the lights off is written to the active profile (a deskLighting override)',
    allOffIn(ownOverride), first + ': ' + JSON.stringify(Object.values(ownOverride || {})[0] || null));
  // Switch profile from the nav: the desk puts on THAT profile's lighting.
  const otherName = (await profileStore()).profiles?.find((pr) => pr.id !== first)?.name;
  const other = await pickChip(otherName);
  await sleep(700);
  const second = (await profileStore()).activeId;
  check('picking another profile switches to it', other && second !== first, first + ' → ' + second);
  check('…and the desk wears that profile’s lighting (lit, since nobody turned it off)', (await lightsOn()) === 'true', String(await lightsOn()));
  check('…while the first profile keeps its own', allOffIn((await profileStore()).profiles?.find((pr) => pr.id === first)?.overrides?.deskLighting));
  // Back to the first: its lighting comes back with it.
  const back = await clickProfile(firstName);
  await sleep(700);
  check('switching back brings that profile’s lighting back (off again)',
    back && (await profileStore()).activeId === first && (await lightsOn()) === 'false', String(await lightsOn()));

  // ── 3b. The desk and the device panels are one lighting, in BOTH directions ──
  // (merge of PR #3, 2026-10-07.) The PR says "one lighting model"; what the
  // code has is two stores kept in step — `overrides.deskLighting` and the
  // panels' `lighting.*` profile keys (state.tsx, "The desk and the device
  // panels are one lighting"). So both writers are pinned: the desk edit above
  // must have reached every lit panel, and a panel edit must reach the desk.
  {
    const PANEL_SKUS = ['origins-65', 'solocast-2-pro', 'saga-pro', 'forge-45l'];
    const bags = (await profileStore()).profiles?.find((pr) => pr.id === first)?.devices ?? {};
    check('turning the desk off switched every lit device’s panel power off too (desk → panels)',
      PANEL_SKUS.every((sku) => bags[sku]?.['lighting.power'] === false), JSON.stringify(PANEL_SKUS.map((s) => s + ':' + bags[s]?.['lighting.power'])));
    // Panel → desk: the mouse's Lights tab, power back on.
    await go('/personalize?sku=saga-pro&tab=lighting', `!!document.querySelector('[aria-label="Lighting power"]')`);
    await evalJs(`document.querySelector('[aria-label="Lighting power"]')?.click(); true`);
    await sleep(700);
    const deskOf = (dev) => evalJs(`(JSON.parse(localStorage.getItem('trhs-profiles') || '{}').profiles || []).find((p) => p.id === '${first}')?.overrides?.deskLighting?.${dev}`);
    const dark = (d) => !!d && (d.effect === 'off' || d.on === false || d.brightness === 0);
    let m = await deskOf('mouse');
    check('switching the mouse’s panel power on lights the mouse on the desk (panel → desk)', !!m && !dark(m), JSON.stringify(m));
    check('…and only the mouse: the keyboard stays dark on the desk', dark(await deskOf('keyboard')), JSON.stringify(await deskOf('keyboard')));
    // Back off, so the profile reads all-dark again for whatever follows.
    await evalJs(`document.querySelector('[aria-label="Lighting power"]')?.click(); true`);
    await sleep(600);
    m = await deskOf('mouse');
    check('…and switching it off again darkens it on the desk', dark(m), JSON.stringify(m));
    await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
    await sleep(300);
  }

  // ── 4. The desk is the picker (the 3D overview, 2026-10-21) ────────────────
  // The Lighting tile is the 3D desk with each lit device's look pinned above
  // it. A device (on the desk or its label) flies the camera to it; on the
  // tower each part gets a label, and a part opens the tower's lighting landed
  // on that part. Labels are DOM, so they are driven by click; the pointer on
  // the canvas is three.js's and is checked in the browser, not here.
  const deskReady = await waitFor(`!!document.querySelector('.lx-desk canvas')`, 8000);
  check('the Lighting tile mounts the 3D desk', deskReady);
  // Lights back on (section 3b left the profile dark), so the labels name looks.
  await evalJs(`(() => { const t = document.querySelector('[aria-label="Desk lighting"]'); if (t?.getAttribute('aria-checked') === 'false') t.click(); return true; })()`);
  await sleep(600);
  const chip = (id) => `.lx-desk .ls-anchor[data-anchor="${id}"] .lx-chip`;
  const chipLook = (id) => evalJs(`document.querySelector(${JSON.stringify(chip(id) + ' .lx-chip-look')})?.textContent.trim() ?? null`);
  const DEVICES = ['mic', 'keyboard', 'mouse', 'tower'];
  const labelsShown = await waitFor(`${JSON.stringify(DEVICES)}.every((id) => document.querySelector('.lx-desk .ls-anchor[data-anchor="' + id + '"]')?.dataset.shown === 'true')`, 10000);
  const looks0 = await Promise.all(DEVICES.map(chipLook));
  check('a label is pinned above each lit device — mic, keyboard, mouse, desktop — and says its look',
    labelsShown && looks0.every((l) => l && l.length > 0), JSON.stringify(looks0));
  check('the tile is not one big button: a click on the tile\'s own text opens nothing',
    await (async () => { await evalJs(`document.querySelector('#qc-lighting .qc-mode-name')?.click(); true`); await sleep(400); return evalJs(`!location.hash.includes('modal=') && !location.hash.includes('sku=') && !document.querySelector('.modal-shell')`); })());
  check('with the whole desk shown the footer has the camera views and the Devices-with-lights link; no hint',
    await evalJs(`!!document.querySelector('#qc-lighting [aria-label="Camera view"]') && !document.querySelector('#qc-lighting .lx-hint') && [...document.querySelectorAll('#qc-lighting .qc-desk-bottom button')].some((b) => b.textContent.trim() === 'Devices with lights')`));

  // A device's label flies to it; the tower shows its parts.
  await evalJs(`document.querySelector(${JSON.stringify(chip('tower'))})?.click(); true`);
  const here = await waitFor(`!!document.querySelector('.lx-here')`, 4000);
  const partsShown = await waitFor(`['fans', 'memory', 'gpu'].every((z) => document.querySelector('.lx-desk .ls-anchor[data-anchor="tower:' + z + '"]')?.dataset.shown === 'true')`, 10000);
  check('clicking the tower\'s label shows the tower alone: a label per part (Fans, Memory, Graphics card) and the .lx-here panel',
    here && partsShown && (await evalJs(`[...document.querySelectorAll('.lx-here .lx-part')].map((b) => b.querySelector('.lx-part-name')?.textContent.trim()).join('|')`)) === 'Fans|Memory|Graphics card');
  check('…the other devices\' labels are gone, the camera buttons give way to the hint, the list link stays',
    await evalJs(`['mic', 'keyboard', 'mouse', 'tower'].every((id) => document.querySelector('.lx-desk .ls-anchor[data-anchor="' + id + '"]') === null)`) &&
    await evalJs(`!document.querySelector('#qc-lighting [aria-label="Camera view"]') && !!document.querySelector('#qc-lighting .lx-hint') && [...document.querySelectorAll('#qc-lighting .qc-desk-bottom button')].some((b) => b.textContent.trim() === 'Devices with lights')`));
  check('…the .lx-here panel has All devices, the device name, and Set lights',
    await evalJs(`(() => { const h = document.querySelector('.lx-here'); const t = [...h.querySelectorAll('button')].map((b) => b.textContent.trim()); return t.includes('All devices') && t.includes('Set lights') && /OMEN MAX 45L/.test(h.querySelector('.lx-here-name').textContent); })()`));

  // A part opens the PC page at its lighting tab, landed on it.
  await evalJs(`document.querySelector('.lx-here .lx-part[data-part="memory"]')?.click(); true`);
  const landed = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas .pcz-zone[data-zone="memory"]')`, 6000);
  check('clicking Memory opens the PC page at its lighting tab with zone=memory in the address — not the lights alone (no part=)',
    landed && (await evalJs(`location.hash.includes('sku=forge-45l') && location.hash.includes('tab=lighting') && location.hash.includes('zone=memory') && !location.hash.includes('part=') && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length > 1`)), await evalJs(`location.hash`));
  check('…and Memory is the part selected in the editor, the others not',
    await evalJs(`(() => { const on = [...document.querySelectorAll('.dc-canvas .pcz-zone[data-zone]')].filter((e) => e.getAttribute('aria-selected') === 'true').map((e) => e.dataset.zone); return on.length === 1 && on[0] === 'memory'; })()`));
  // Give Memory a look of its own, so the tower is no longer one look, then close.
  await evalJs(`[...document.querySelectorAll('.dc-canvas .pdm-preset-pick')].find((b) => b.querySelector('span:last-child')?.textContent.trim() === 'Orange')?.click(); true`);
  await sleep(500);
  await evalJs(`document.querySelector('.dc-close')?.click(); true`);
  await waitFor(`!document.querySelector('.dc-canvas')`, 3000);
  check('closing drops zone= from the address, and the overview is still on the tower',
    await evalJs(`!location.hash.includes('zone=') && !location.hash.includes('sku=') && !!document.querySelector('.lx-here')`), await evalJs(`location.hash`));
  const memLook = await evalJs(`document.querySelector('.lx-desk .ls-anchor[data-anchor="tower:memory"] .lx-chip-look')?.textContent.trim()`);
  check('the Memory label shows the look just set', memLook === 'Orange', String(memLook));

  // All devices: back to the whole desk.
  await evalJs(`[...document.querySelectorAll('.lx-here button')].find((b) => b.textContent.trim() === 'All devices')?.click(); true`);
  const backOnDesk = await waitFor(`!document.querySelector('.lx-here') && !!document.querySelector('#qc-lighting [aria-label="Camera view"]')`, 4000);
  check('All devices goes back to the whole desk and its camera views', backOnDesk);
  const towerLabel = await chipLook('tower');
  check('the tower\'s label now reads its parts as one line: Custom by part', towerLabel === 'Custom by part', String(towerLabel));
  // The title reads the same as the labels (JY, 2026-10-21): it used to read
  // the desk's copy of the tower and say "Wave · 80% · On all 4 devices" over
  // a PC whose label said otherwise.
  const titleNow = await evalJs(`document.querySelector('#qc-lighting .qc-mode-name')?.textContent.trim() ?? ''`);
  const spreadNow = await evalJs(`document.querySelector('#qc-lighting .qc-mode-summary')?.textContent.trim() ?? ''`);
  check('…and the tile\'s title follows it: Mixed lighting, with the Desktop named by its parts underneath',
    titleNow === 'Mixed lighting' && spreadNow.includes('Custom by part on Desktop') && !spreadNow.startsWith('On all'), JSON.stringify([titleNow, spreadNow]));

  // Devices with lights: the list window, and its tower row says what the label says.
  await evalJs(`[...document.querySelectorAll('#qc-lighting .qc-desk-bottom button')].find((b) => b.textContent.trim() === 'Devices with lights')?.click(); true`);
  const listOpen = await waitFor(`!!document.querySelector('.lm-shell')`, 4000);
  check('"Devices with lights" opens the device-list window (?modal=lighting)', listOpen && (await evalJs(`location.hash.includes('modal=lighting')`)));
  const towerRow = await evalJs(`document.querySelector('.lm-shell .lm-row[data-device="tower"]')?.textContent ?? ''`);
  check('the list\'s tower row says the same look as the tower\'s label', !!towerLabel && towerRow.includes(towerLabel), JSON.stringify(towerRow) + ' vs ' + JSON.stringify(towerLabel));
  const listStatus = await evalJs(`document.querySelector('.lm-shell .lm-status-line')?.textContent ?? ''`);
  check('…and the window\'s status line says what the tile\'s title says', listStatus.includes(titleNow), JSON.stringify(listStatus) + ' vs ' + JSON.stringify(titleNow));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await waitFor(`!document.querySelector('.lm-shell')`, 3000);

  // A peripheral: its label flies to it; Set lights opens its own window at Lighting.
  await evalJs(`document.querySelector(${JSON.stringify(chip('mic'))})?.click(); true`);
  await waitFor(`!!document.querySelector('.lx-here')`, 4000);
  check('a peripheral\'s panel has no parts, just its one look',
    await evalJs(`document.querySelectorAll('.lx-here .lx-part').length === 1 && !!document.querySelector('.lx-here .lx-part.static')`));
  await evalJs(`[...document.querySelectorAll('.lx-here button')].find((b) => b.textContent.trim() === 'Set lights')?.click(); true`);
  const micOpen = await waitFor(`!!document.querySelector('.mic-canvas')`, 5000);
  check('Set lights on the mic opens the mic\'s own window at its Lighting tab',
    micOpen && (await evalJs(`location.hash.includes('sku=solocast-2-pro') && location.hash.includes('tab=lighting')`)), await evalJs(`location.hash`));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(300);

  // Another part: the same page, the same tab, landed on that part.
  await go('/personalize');
  await waitFor(`!!document.querySelector('.lx-desk .ls-anchor[data-anchor="tower"] .lx-chip')`, 8000);
  await evalJs(`document.querySelector(${JSON.stringify(chip('tower'))})?.click(); true`);
  await waitFor(`!!document.querySelector('.lx-here .lx-part[data-part="gpu"]')`, 4000);
  await evalJs(`document.querySelector('.lx-here .lx-part[data-part="gpu"]')?.click(); true`);
  const pageOpen = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas .pcz-zone[data-zone="gpu"]')`, 6000);
  check('the graphics card opens the PC page at its lighting tab (tab=lighting, not part=lights) landed on that part',
    pageOpen && (await evalJs(`location.hash.includes('sku=forge-45l') && location.hash.includes('tab=lighting') && location.hash.includes('zone=gpu') && !location.hash.includes('part=lights')`)) &&
    (await evalJs(`[...document.querySelectorAll('.dc-canvas .pcz-zone[data-zone]')].filter((e) => e.getAttribute('aria-selected') === 'true').map((e) => e.dataset.zone).join()`)) === 'gpu',
    await evalJs(`location.hash`));
  await go('/personalize');

  // ── 4b. The Lighting window is a list of doors (2026-10-21) ───────────────
  // No whole-desk editor: the window lists the devices with lights and opens
  // each one's own window at its Lights tab.
  await go('/personalize?modal=lighting');
  const litRows = await evalJs(`[...document.querySelectorAll('.lm-shell .lm-row')].map((r) => r.dataset.device)`);
  check('the Lighting window lists the lit devices, the tower first, and holds no Light Studio', Array.isArray(litRows) && litRows.length >= 4 && litRows[0] === 'tower' && ['keyboard', 'mouse', 'mic'].every((d) => litRows.includes(d)) && (await evalJs(`!document.querySelector('.lm-shell .ls')`)), JSON.stringify(litRows));
  await evalJs(`document.querySelector('.lm-shell .lm-row[data-device="keyboard"]')?.click(); true`);
  const kbOpened = await waitFor(`!!document.querySelector('.kbd-canvas') && !document.querySelector('.lm-shell')`, 4000);
  check('a row opens that device\'s own window in the Lighting window\'s place', kbOpened, await evalJs(`location.hash`));
  if (kbOpened) { await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`); await sleep(300); }
  // The tower's row is the PC: it opens the PC page at Chassis lighting, every tab still there (the lights alone went with option A).
  await go('/personalize?modal=lighting');
  await evalJs(`document.querySelector('.lm-shell .lm-row[data-device="tower"]')?.click(); true`);
  const towerOpened = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas') && !document.querySelector('.lm-shell')`, 6000);
  check('the tower\'s row opens the PC page on its Chassis lighting tab (tab=lighting, no part=), every tab still there',
    towerOpened && (await evalJs(`location.hash.includes('sku=forge-45l') && location.hash.includes('tab=lighting') && !location.hash.includes('part=') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Chassis lighting' && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length > 1`)),
    await evalJs(`location.hash`));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(300);

  // ── 5. Devices cards ───────────────────────────────────────────────────────
  await go('/personalize');
  const cards = await evalJs(`[...document.querySelectorAll('.pg-devices .ds-devcard')].map(c => ({ kind: c.dataset.kind, status: !!c.querySelector('.devw-status'), battery: c.querySelector('.dev-battery') ? getComputedStyle(c.querySelector('.dev-battery')).display : 'none' }))`);
  // Seven since TH-459: Personalize reads the desk list, which Treehouse 32 joined.
  // The cooler cap is a line on the tower's card, not a card (JY, 2026-10-22).
  // No status line on the cards (Kristy, 2026-10-14): the controls show the state.
  check('seven device cards on the desktop, the tower first, no cooler cap card, none with a status line',
    cards.length === 7 && cards[0].kind === 'desktop' && !cards.some((c) => c.kind === 'desktop-cooler-cap') && cards.every((c) => !c.status),
    JSON.stringify(cards.map((c) => c.kind + ':' + c.status)));
  check('battery is hidden on Personalize by rule', cards.every((c) => c.battery === 'none'));
  // The desk's cards that belong to This PC open the PC's page, at the tab that fits (no part windows).
  await evalJs(`document.querySelector('.pg-devices [aria-label="Configure OMEN MAX 45L"]')?.click(); true`);
  const towerCard = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas')`, 6000);
  check('the tower\'s card opens the PC page on its Chassis lighting tab, no part= in the address',
    towerCard && (await evalJs(`location.hash.includes('sku=forge-45l') && !location.hash.includes('part=') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Chassis lighting' && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length > 1`)),
    await evalJs(`location.hash`));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(300);
  // The cap's line on the tower's card: what the screen shows, and where it goes.
  const CAP_PART = `document.querySelector('.pg-devices [aria-label="Configure OMEN MAX 45L"] .devw-part[data-part="cooler-cap"]')`;
  const capLine = await evalJs(`(() => { const p = ${CAP_PART}; return p && { label: p.querySelector('.devw-part-label')?.textContent.trim(), reading: p.querySelector('.devw-part-reading')?.textContent.trim(), visual: !!p.querySelector('.devw-part-visual'), parts: document.querySelectorAll('.pg-devices .devw-part').length }; })()`);
  check('the tower\'s card has one Cooler cap line, with its small screen, saying what the screen shows (the directory\'s words)',
    capLine?.label === 'Cooler cap' && capLine.reading === 'System Vitals' && capLine.visual && capLine.parts === 1, JSON.stringify(capLine));
  await evalJs(`${CAP_PART}?.click(); true`);
  const capOpened = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas')`, 6000);
  check('the line opens the PC page on its LCD cooler cap tab (not the card\'s Chassis lighting), every tab still there',
    capOpened && (await evalJs(`location.hash.includes('sku=forge-45l') && location.hash.includes('tab=cooler-cap') && !location.hash.includes('part=') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'LCD cooler cap' && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length > 1`)),
    await evalJs(`location.hash`));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(300);
  // The reading is the cap's own setting: an Off screen reads Off, as the directory's row does.
  await evalJs(`localStorage.setItem('coolerCap', JSON.stringify({ on: false })); true`);
  await go('/personalize');
  check('with the cap\'s screen off the line reads Off',
    (await evalJs(`${CAP_PART}?.querySelector('.devw-part-reading')?.textContent.trim()`)) === 'Off');
  await evalJs(`localStorage.removeItem('coolerCap'); true`);
  // June 2027 has no cap, so no line.
  await evalJs(`localStorage.setItem('mvpScope', 'june27'); true`);
  await go('/personalize');
  const juneCards = await evalJs(`[...document.querySelectorAll('.pg-devices .ds-devcard')].map(c => c.dataset.kind)`);
  check('under June 2027 there is no cap: seven cards, the tower\'s first, no Cooler cap line',
    juneCards.length === 7 && juneCards[0] === 'desktop' && (await evalJs(`document.querySelectorAll('.pg-devices .devw-part').length === 0`)), juneCards.join(' · '));
  await evalJs(`localStorage.removeItem('mvpScope'); true`);
  await evalJs(`localStorage.setItem('thisPc', 'hx-omen-16-valorant'); true`);
  await go('/personalize');
  await waitFor(`!!document.querySelector('.pg-devices [aria-label="Configure Built-in keyboard"]')`, 6000);
  await evalJs(`document.querySelector('.pg-devices [aria-label="Configure Built-in keyboard"]')?.click(); true`);
  const kbCard = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas')`, 6000);
  check('the notebook\'s Built-in keyboard card opens the PC page on its Lighting tab, no part=keyboard, the other tabs still there',
    kbCard && (await evalJs(`location.hash.includes('sku=hx-omen-16-valorant') && location.hash.includes('tab=lighting') && !location.hash.includes('part=') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Lighting' && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length === 3`)),
    await evalJs(`location.hash`));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(300);
  await evalJs(`[...document.querySelectorAll('.pg-devices [aria-label="Configure Built-in keyboard"] button')].find((b) => /Macro/.test(b.getAttribute('title') || b.textContent))?.click(); true`);
  const kbMacro = await waitFor(`!!document.querySelector('.dc-canvas.pc-canvas [data-testid="macro-tab"]')`, 6000);
  check('…and its Macro shortcut opens the Macro tab (the card names no Keys & Macros tab the page lacks)', kbMacro, await evalJs(`location.hash`));
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(300);
  // On a notebook there is no cooler cap: the Built-in keyboard's card leads and no card has a cap line.
  await go('/personalize');
  const lapCards = await evalJs(`[...document.querySelectorAll('.pg-devices .ds-devcard')].map(c => c.getAttribute('aria-label'))`);
  check('on the notebook there is no cooler cap anywhere in Devices',
    lapCards.length > 0 && lapCards[0] === 'Configure Built-in keyboard' && (await evalJs(`!document.querySelector('.pg-devices .devw-part[data-part="cooler-cap"]')`)), lapCards.join(' · '));
  await evalJs(`localStorage.removeItem('thisPc'); true`);
  await go('/personalize');

  // ── Sections reorder and persist ──────────────────────────────────────────
  const grips = await evalJs(`document.querySelectorAll('.rs-section .rs-grip').length`);
  // Four since TH-460 removed the Quick Controls section: Lighting, Devices,
  // Display, Everything else (the reorder checks below count the same four).
  check('every section carries a grip', grips === 4, String(grips));
  await evalJs(`localStorage.setItem(${JSON.stringify(ORDER)}, JSON.stringify(['display', 'profiles', 'lighting', 'controls', 'devices', 'everything'])); true`);
  await go('/personalize');
  const reordered = await evalJs(`[...document.querySelectorAll('.rs-section .pg-section-label')].map(e => e.textContent.trim())`);
  // 'profiles' is in this saved order on purpose: an order saved before the
  // band replaced that section must still load.
  check('a saved section order is honoured on the next boot', reordered[0] === 'Display' && reordered.length === 4, reordered.join(' · '));
  await evalJs(`localStorage.setItem(${JSON.stringify(ORDER)}, JSON.stringify(['profiles', 'lighting', 'lightstudio', 'modules'])); true`);
  await go('/personalize');
  const oldOrder = await evalJs(`[...document.querySelectorAll('.rs-section .pg-section-label')].map(e => e.textContent.trim())`);
  check('an order saved by the OLD page (ids that no longer exist) still shows every section',
    oldOrder.length === 4 && ['Lighting', 'Devices', 'Display', 'Everything else'].every((l) => oldOrder.includes(l)),
    oldOrder.join(' · '));

  check('no page exceptions throughout', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await cleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

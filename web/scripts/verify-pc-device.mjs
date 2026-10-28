// CDP walkthrough for This PC in My Devices: the PC's directory (Performance
// and Personalize rows, the This PC button), the cooler cap's address (it
// opens the PC page at the cap's tab, JY 2026-10-22), the power supply's own
// window by address, About this PC with its device card, the
// Spotlight arrival on Perform, the laptop variant, the board card for This PC
// opening the PC's page, and the PC's own page: its tabs per machine, one
// panel height across them, the Performance tab's glance and its doors to the
// Performance page's cards, the cap's one-panel tab and the Macro tab, and
// that each directory row opens the page at its tab. Also: the directory's
// spacing (16 / 8 / 4 / 16 px, one row height), that Power Mode, System Vitals
// and (a notebook's) Fan Cleaner land on their card, lit, that a desktop has
// no Fan Cleaner (JY, 2026-10-22: its supply cleans on the Power supply tab), that the Simulator and Admin hold no
// "PC is" / "Opens as" switch (the PC is one model, JY 2026-10-22), and that
// old stored `pcModel` / `pcDoor` values change nothing.
// The scope (full parity by default, June 2027 set explicitly) comes first:
// June trims the directory and puts the part windows out of reach, and every
// hardware check after it runs under full. The switch is the Simulator's
// "Product scope" row on #/perform-v7.
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

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;

// The keys this suite reads or writes, cleared so a run starts from defaults.
const OWN_KEYS = ['thisPc', 'pcDoor', 'mvpScope', 'pcModel', 'nonHpPc', 'omenAi', 'gameSession', 'coolerCap', 'psuSettings', 'powerModeEvent', 'powerMode'];

let loadN = 0;
// `sim=1`: the Simulator is hidden until asked (2026-10-26); these suites drive it.
async function load(send, hash = '#/') {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}&sim=1${hash}` });
  await waitFor(send, APP_READY);
}

async function openPanel(send) {
  // The nav tab's label renders twice (visible + tooltip), so match by includes.
  await evalJs(send, `[...document.querySelectorAll('nav button')].find(b => b.textContent.includes('Devices'))?.click()`);
  return waitFor(send, `document.querySelector('.device-panel.open .devp-pc')`);
}

/** The PC's directory as a person reads it: groups, then each row's label and reading. */
const DIR = `[...document.querySelectorAll('.devp-pc-group')].map(g => ({
  group: g.getAttribute('aria-label'),
  rows: [...g.querySelectorAll('.devp-feature')].map(r => ({
    label: r.querySelector('.devp-feature-label')?.textContent.trim(),
    reading: r.querySelector('.devp-feature-reading')?.textContent.trim() ?? null,
  })),
}))`;
const rowsOf = (dir, group) => dir?.find((g) => g.group === group)?.rows ?? [];
/** The This PC button above the groups: its title and its line under it. */
const ABOUT_BTN = `(() => { const b = document.querySelector('.devp-pc-about'); return b ? { title: b.querySelector('b')?.textContent.trim(), sub: b.querySelector('.devp-action-sub')?.textContent.trim() } : null; })()`;
const labelsOf = (dir, group) => rowsOf(dir, group).map((r) => r.label);
const clickRow = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.devp-feature')].find(r => r.querySelector('.devp-feature-label')?.textContent.trim() === ${JSON.stringify(label)})?.click()`);
const readingOf = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.devp-feature')].find(r => r.querySelector('.devp-feature-label')?.textContent.trim() === ${JSON.stringify(label)})?.querySelector('.devp-feature-reading')?.textContent.trim() ?? null`);

/** Spacing in the PC directory: the gap above each group label, from a label to
 *  its first row, between rows, and every row's height. */
const SPACING = `(() => {
  const r = (e) => e.getBoundingClientRect();
  const pc = document.querySelector('.devp-pc');
  const above = [], toFirst = [], between = [], heights = [];
  [...pc.children].filter((k) => k.classList.contains('devp-pc-group')).forEach((g) => {
    const label = g.querySelector('.devp-features-label');
    const rows = [...g.querySelectorAll('.devp-feature')];
    above.push(r(label).top - r(g.previousElementSibling).bottom);
    toFirst.push(r(rows[0]).top - r(label).bottom);
    rows.forEach((row, i) => { heights.push(r(row).height); if (i) between.push(r(row).top - r(rows[i - 1]).bottom); });
  });
  return { above, toFirst, between, heights };
})()`;
const near = (xs, want) => xs.length > 0 && xs.every((x) => Math.abs(x - want) <= 1);

/** Where the Performance page is lighting a card, by its data-feature, and whether its middle is on screen. */
const SPOT_VISIBLE = `(() => { const e = document.querySelector('.pv5-spotlight'); if (!e) return false; const r = e.getBoundingClientRect(); const m = (r.top + r.bottom) / 2; return m > 0 && m < innerHeight; })()`;
const landed = async (send, feature) =>
  (await waitFor(send, `location.hash.startsWith('#/perform') && document.querySelector('.pv5-spotlight')?.dataset.feature === ${JSON.stringify(feature)}`, 4000))
    && (await waitFor(send, SPOT_VISIBLE, 2500));
/** Gone from the screen: no My Devices panel, no PC window. */
const leftBoth = (send) => evalJs(send, `!document.querySelector('.device-panel.open') && !document.querySelector('.dc-canvas')`);
/** A directory row, from a fresh load: it lands on its card, lit and in view, and the panel is closed. */
/** A directory row that is a tab of the PC's page: it opens the page (not a window of the part, not a part alone) on that tab,
 *  with the panel still open behind it. Closes the page after. */
async function rowOpensTab(send, label, tabTitle) {
  await load(send);
  await openPanel(send);
  await clickRow(send, label);
  const ok = await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === ${JSON.stringify(tabTitle)} && document.querySelector('.device-panel.open') && !location.hash.includes('part=')`, 6000);
  // The page keeps all of its tabs: nothing opened alone.
  const tabs = await evalJs(send, `document.querySelectorAll('.dc-canvas .ds-ng3-tool').length`);
  return ok && tabs > 1;
}
async function rowLands(send, label, feature) {
  await load(send);
  await openPanel(send);
  await clickRow(send, label);
  return (await landed(send, feature)) && (await leftBoth(send));
}

/** The Performance tab's doors, as a person reads them: card id, label, reading. */
/** Every door sits inside the page's panel, not below its edge. */
const DOORS_IN_PANEL = `(() => { const p = document.querySelector('.dc-canvas .dc-panel-wrap').getBoundingClientRect(); const ds = [...document.querySelectorAll('.dc-canvas .lc-door')]; return ds.length > 0 && ds.every((d) => { const r = d.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom - 1; }); })()`;
const DOORS = `[...document.querySelectorAll('.dc-canvas .lc-door')].map(d => ({ spot: d.dataset.spot, label: d.querySelector('.ds-list-item-label')?.textContent.trim(), reading: d.querySelector('.ds-list-item-description')?.textContent.trim() ?? null }))`;
/** A door of the PC window's Performance tab, from a fresh load with the panel open behind the window
 *  (opened by `viaRow`): it lands on its card, lit and in view, and both the window and the panel are gone. */
async function doorLands(send, viaRow, spot, feature) {
  await load(send);
  await openPanel(send);
  await clickRow(send, viaRow);
  await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas')`, 6000);
  await clickTab(send, 'Performance');
  await sleep(500);
  const behind = await evalJs(send, `!!document.querySelector('.device-panel.open') && !!document.querySelector('.dc-canvas [data-spot="${spot}"]')`);
  await evalJs(send, `document.querySelector('.dc-canvas [data-spot="${spot}"]')?.click()`);
  return behind && (await landed(send, feature)) && (await leftBoth(send));
}

const CANVAS = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  const spec = {};
  c.querySelectorAll('.ds-ng3-spec-row').forEach(row => {
    spec[row.querySelector('.ds-ng3-spec-key')?.textContent.trim()] =
      row.querySelector('.ds-ng3-spec-val')?.textContent.trim();
  });
  return {
    name: c.getAttribute('aria-label'),
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map(b => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    chips: [...c.querySelectorAll('.dc-chip-val')].map(e => e.textContent.trim()),
    labels: [...c.querySelectorAll('.ds-ng3-label')].map(e => e.textContent.trim()),
    badges: [...c.querySelectorAll('.ds-badge')].map(e => e.textContent.trim()),
    spec,
  };
})()`;
const clickTab = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)})?.click()`);
/** The cooler cap tab's views, switched at the title row's right end. */
const CAP_VIEWS = `[...document.querySelectorAll('.dc-canvas [aria-label="Cooler cap view"] button')].map(b => b.textContent.trim() + (b.classList.contains('active') ? '*' : ''))`;
const clickView = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.dc-canvas [aria-label="Cooler cap view"] button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`);
const clickButton = (send, text) =>
  evalJs(send, `[...document.querySelectorAll('.dc-canvas button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
const closeCanvas = async (send) => {
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await waitFor(send, `!document.querySelector('.dc-canvas')`);
};

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  await load(send);
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  await load(send);

  let dir;
  let shot;
  // ── June 2027, set explicitly ─────────────────────────────────────────────
  // The June MVP leaves out OMEN hardware control and lighting (deck "Treehouse
  // MVP Modules June 2027", slide 7): the directory is System Vitals and About
  // this PC, the power supply is its plain spec sheet, the cooler cap is out.
  check('default: nothing is stored, and the scope is full — the directory has Power Mode',
    await evalJs(send, `localStorage.getItem('mvpScope') === null`) && await openPanel(send)
      && labelsOf(await evalJs(send, DIR), 'Performance').includes('Power Mode'));
  await evalJs(send, `localStorage.setItem('mvpScope', 'june27')`);
  await load(send);
  check('june: the scope is June 2027 when stored', await evalJs(send, `localStorage.getItem('mvpScope') === 'june27'`));
  check('june: panel opens on This PC', await openPanel(send));
  dir = await evalJs(send, DIR);
  check('june desktop: the directory is one System Vitals row and the This PC button, nothing else',
    JSON.stringify(dir.map((g) => [g.group, g.rows.map((r) => r.label)])) === JSON.stringify([['Performance', ['System Vitals']]])
      && (await evalJs(send, ABOUT_BTN))?.title === 'This PC',
    JSON.stringify(dir));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-directory-june.png`, Buffer.from(shot.data, 'base64'));
  check('june: the System Vitals row goes to the page\'s vitals card, lit, and the panel closes',
    await rowLands(send, 'System Vitals', 'system-vitals'));
  await openPanel(send);

  await load(send, '#/?sku=forge-45l-psu');
  await waitFor(send, `document.querySelector('.dc-canvas')`);
  let jc = await evalJs(send, CANVAS);
  check('june psu: the address opens the plain spec sheet — one Overview tab, not Status/Fan/Overview',
    JSON.stringify(jc?.tabs) === JSON.stringify(['Overview']) && jc?.spec['Wattage'] === '1,200 W' && jc?.spec['Modular'] === 'Fully', `${jc?.tabs?.join('/')} · ${JSON.stringify(jc?.spec)}`);
  check('june psu: no live readings, no part window furniture',
    !('Total power' in (jc?.spec ?? {})) && (await evalJs(send, `!document.querySelector('.dc-canvas [class*="pcp-"]')`)));

  await load(send, '#/?sku=forge-45l-cooler-cap');
  await sleep(1200);
  check('june cap: the address opens nothing — the window is out of reach, as for a SKU the app does not show',
    await evalJs(send, `!document.querySelector('.dc-canvas') && !document.querySelector('.pcp-cap')`));

  await load(send, '#/?modal=about-pc');
  await waitFor(send, `document.querySelector('.modal-right .ds-ng3-spec-row')`);
  let jAbout = await evalJs(send, `Object.fromEntries([...document.querySelectorAll('.modal-right .ds-ng3-spec-row')].map(r => [r.querySelector('.ds-ng3-spec-key')?.textContent.trim(), r.querySelector('.ds-ng3-spec-val')?.textContent.trim()]))`);
  check('june about: the machine facts stay, and none of them is the cooler cap',
    (await evalJs(send, `document.querySelector('.modal-right .dsc')?.textContent.includes('HyperX OMEN MAX 45L')`)) === true
      && !Object.keys(jAbout).some((k) => /cap/i.test(k)), JSON.stringify(jAbout));

  await evalJs(send, `localStorage.setItem('thisPc', 'hx-omen-16-valorant')`);
  await load(send);
  await openPanel(send);
  dir = await evalJs(send, DIR);
  check('june laptop: System Vitals alone under Performance, no Power Mode, lighting or macros',
    JSON.stringify(labelsOf(dir, 'Performance')) === JSON.stringify(['System Vitals']) && !dir.some((g) => g.group === 'Personalize'), JSON.stringify(dir));
  check('june laptop: the This PC button names the machine', (await evalJs(send, ABOUT_BTN))?.sub?.startsWith('HyperX OMEN 16 VALORANT Edition') === true, JSON.stringify(await evalJs(send, ABOUT_BTN)));
  await evalJs(send, `localStorage.setItem('thisPc', 'forge-45l')`);

  // The Admin modal has no Scope switch any more; the Simulator's "Product scope"
  // row on #/perform-v7 brings the hardware rows back, with no reload.
  await load(send, '#/?modal=admin');
  await waitFor(send, `document.querySelector('.modal-close')`);
  check('admin: the modal has no Scope switch any more', await evalJs(send, `!document.querySelector('[aria-label="Scope"]')`));
  await load(send, '#/perform-v7');
  await waitFor(send, `document.querySelector('[aria-label="Product scope"]')`);
  const scopeTabs = await evalJs(send, `[...document.querySelectorAll('[aria-label="Product scope"] [role=tab]')].map(t => [t.textContent.trim(), t.getAttribute('aria-selected')])`);
  check('simulator scope: June 2027 and Full, June selected',
    JSON.stringify(scopeTabs) === JSON.stringify([['June 2027', 'true'], ['Full', 'false']]), JSON.stringify(scopeTabs));
  await evalJs(send, `[...document.querySelectorAll('[aria-label="Product scope"] [role=tab]')].find(t => t.textContent.trim() === 'Full')?.click()`);
  await sleep(300);
  check('simulator scope: choosing Full is kept', await evalJs(send, `localStorage.getItem('mvpScope') === 'full'`));
  await load(send);
  await openPanel(send);
  dir = await evalJs(send, DIR);
  check('simulator scope: on full the desktop gets its Power Mode, System Vitals, Power supply, LCD cooler cap and Chassis lighting rows back',
    JSON.stringify(labelsOf(dir, 'Performance')) === JSON.stringify(['Power Mode', 'System Vitals', 'Power supply'])
      && JSON.stringify(labelsOf(dir, 'Personalize')) === JSON.stringify(['LCD cooler cap', 'Chassis lighting']), JSON.stringify(dir));
  await load(send, '#/?sku=forge-45l-cooler-cap');
  check('full cap: the address opens the PC page at the cap\'s tab again',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .cap-hero .pcp-cap')`, 4000));
  await load(send, '#/?sku=forge-45l-psu');
  await waitFor(send, `document.querySelector('.dc-canvas')`);
  jc = await evalJs(send, CANVAS);
  check('full psu: the address opens Status, Fan and Settings again', JSON.stringify(jc?.tabs) === JSON.stringify(['Status', 'Fan', 'Settings']), jc?.tabs?.join('/'));

  // Every hardware check below is a full-scope check. A stored 27c2 still reads as full.
  await evalJs(send, `localStorage.setItem('mvpScope', '27c2'); localStorage.removeItem('thisPc')`);
  await load(send);

  // ── Desktop (the default This PC) ─────────────────────────────────────────
  check('panel: opens on This PC', await openPanel(send));
  const lead = await evalJs(send, `(() => {
    const tabs = [...document.querySelectorAll('.devp-tab')];
    return { first: tabs[0]?.classList.contains('active'), badges: [...document.querySelectorAll('.devp-badge')].map(b => b.textContent.trim()) };
  })()`);
  check('panel: This PC leads the list and is selected', lead.first === true && lead.badges.includes('This PC'), JSON.stringify(lead));

  dir = await evalJs(send, DIR);
  check('desktop: the This PC button comes first, then Performance and Personalize — what only this PC has first (JW, 10/19)',
    (await evalJs(send, ABOUT_BTN))?.title === 'This PC'
      && (await evalJs(send, `document.querySelector('.devp-pc')?.firstElementChild?.classList.contains('devp-pc-about')`)) === true
      && JSON.stringify(dir.map((g) => g.group)) === JSON.stringify(['Performance', 'Personalize']), dir.map((g) => g.group).join(' · '));
  check('desktop: Performance is Power Mode, System Vitals and Power supply — no Fan Cleaner, a notebook\'s (its supply cleans on the Power supply tab)',
    JSON.stringify(labelsOf(dir, 'Performance')) === JSON.stringify(['Power Mode', 'System Vitals', 'Power supply']), labelsOf(dir, 'Performance').join(' · '));
  check('desktop: Personalize is the LCD cooler cap, then Chassis lighting',
    JSON.stringify(labelsOf(dir, 'Personalize')) === JSON.stringify(['LCD cooler cap', 'Chassis lighting']), labelsOf(dir, 'Personalize').join(' · '));
  check('desktop: the power supply reads its status in a word', rowsOf(dir, 'Performance')[2]?.reading === 'Good', JSON.stringify(rowsOf(dir, 'Performance')[2]));
  check('desktop: System Vitals reads the CPU temperature in the player\'s unit, from the shared vitals numbers',
    rowsOf(dir, 'Performance')[1]?.reading === 'CPU 58°C', JSON.stringify(rowsOf(dir, 'Performance')[1]));
  // Advanced Tuning is reached only from the top mode, on the Power Mode card.
  check('desktop: no entry goes to Advanced Tuning',
    !dir.some((g) => g.rows.some((r) => /advanced|tuning/i.test(r.label))));
  const power = rowsOf(dir, 'Performance').find((r) => r.label === 'Power Mode');
  check('desktop: Power Mode reads the mode from its home', power?.reading === 'Performance', JSON.stringify(power));
  check('desktop: the cap reads what its screen shows', rowsOf(dir, 'Personalize')[0]?.reading === 'System Vitals', JSON.stringify(rowsOf(dir, 'Personalize')[0]));
  // What the lights wear now, as Personalize's 3D label says it (JY, 2026-10-21),
  // not the parts they are on. verify-chassis-lighting checks the words follow an edit.
  const chassisReading = rowsOf(dir, 'Personalize')[1]?.reading;
  check('desktop: Chassis lighting reads what its lights wear now, not the parts they are on',
    !!chassisReading && chassisReading !== 'Fans, memory, graphics card', JSON.stringify(rowsOf(dir, 'Personalize')[1]));
  // Spacing (JY, 2026-10-21): 16 above each group label, 8 label → first row,
  // 4 between rows, and one height for every row, whatever its label and reading.
  const sp = await evalJs(send, SPACING);
  check('desktop spacing: 16 px above every group label (the first one too), 8 px label → first row, 4 px row → row',
    near(sp.above, 16) && near(sp.toFirst, 8) && near(sp.between, 4), JSON.stringify(sp));
  check('desktop spacing: every row is one line and the same height — the long labels do not wrap',
    sp.heights.length === 5 && new Set(sp.heights.map((h) => Math.round(h))).size === 1, sp.heights.join(' / '));
  check('desktop spacing: no label is cut and none wraps; the reading is what gives way',
    await evalJs(send, `[...document.querySelectorAll('.devp-pc .devp-feature-label')].every(l => l.scrollWidth <= l.clientWidth + 1 && l.getBoundingClientRect().height < 24)`));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-directory-desktop.png`, Buffer.from(shot.data, 'base64'));

  // ── The cooler cap's address: the PC page at the cap's tab (JY, 2026-10-22)
  // Every door to the cap opens that one place (lcd-diy.25); the address is
  // rewritten to say so, and `tab=` picks the view.
  await load(send, '#/?sku=forge-45l-cooler-cap');
  await waitFor(send, `document.querySelector('.dc-canvas .cap-hero .pcp-cap')`);
  let c = await evalJs(send, CANVAS);
  const capHash = await evalJs(send, 'location.hash');
  check('cap: the address opens the PC page at its LCD cooler cap tab, and the address says so',
    c?.name === 'HyperX OMEN MAX 45L' && c?.title === 'LCD cooler cap' && /sku=forge-45l(&|$)/.test(capHash) && capHash.includes('tab=cooler-cap'),
    `${c?.name} · ${c?.title} · ${capHash}`);
  check('cap: Display, Power On and Settings at the title row\'s right end, on Display',
    JSON.stringify(await evalJs(send, CAP_VIEWS)) === JSON.stringify(['Display*', 'Power On', 'Settings']), JSON.stringify(await evalJs(send, CAP_VIEWS)));
  check('cap: chips name the PC and the screen state',
    JSON.stringify(c?.chips) === JSON.stringify(['Connected · This PC', 'Screen on']), c?.chips?.join(' / '));
  check('cap: the preview beside the tower shows the System Vitals reading in the player\'s unit',
    await evalJs(send, `/°C$/.test(document.querySelector('.cap-hero .pcp-cap .pcp-cap-big')?.textContent.trim() ?? '')`));
  check('cap: the preview sits beside the tower, not over it',
    await evalJs(send, `(() => { const a = document.querySelector('.dc-hero .ls')?.getBoundingClientRect(); const b = document.querySelector('.cap-hero .pcp-cap')?.getBoundingClientRect(); return !!a && !!b && b.left >= a.right - 1; })()`));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-cooler-cap.png`, Buffer.from(shot.data, 'base64'));

  await evalJs(send, `document.querySelector('[aria-label="Screen on"]')?.click()`);
  await waitFor(send, `document.querySelector('.pcp-cap.off')`);
  c = await evalJs(send, CANVAS);
  const faceGone = await evalJs(send, `!document.querySelector('.pcp-cap-face')`);
  await closeCanvas(send);
  await openPanel(send);
  const entryOff = await readingOf(send, 'LCD cooler cap');
  check('cap: off goes dark, and the chip and the PC entry both say so',
    faceGone && c?.chips?.includes('Screen off') && entryOff === 'Off', `${c?.chips?.join(' / ')} · entry ${entryOff}`);
  await load(send, '#/?sku=forge-45l-cooler-cap&tab=boot');
  await waitFor(send, `document.querySelector('.dc-canvas .pcp-cap.off')`);
  check('cap: the address\'s tab= picks the view (Power On)',
    JSON.stringify(await evalJs(send, CAP_VIEWS)) === JSON.stringify(['Display', 'Power On*', 'Settings']), JSON.stringify(await evalJs(send, CAP_VIEWS)));
  c = await evalJs(send, CANVAS);
  check('cap Power On: a HyperX desktop boots to the HyperX logo until the player picks a file',
    c?.spec['File'] === 'HyperX logo (default)' && !c?.labels.includes('Plays'), JSON.stringify(c?.spec));
  await clickView(send, 'Display');
  await sleep(200);
  await evalJs(send, `document.querySelector('[aria-label="Screen on"]')?.click()`);
  await waitFor(send, `!document.querySelector('.pcp-cap.off')`);

  // What the cap shows is a preset, picked from the list the Lights tab lays
  // out; the detail of the cap's editor is verify-cooler-cap's.
  const live = await evalJs(send, `document.querySelector('.pdm-preset.active .pdm-preset-pick span:last-child')?.textContent.trim()`);
  check('cap: the presets show which one is on the cap, Classic by default', live === 'Classic', live);
  check('cap: the change is kept for the next launch',
    await evalJs(send, `JSON.parse(localStorage.getItem('coolerCap') || '{}').activePreset === 'vitals-classic'`));
  await closeCanvas(send);

  // ── The power supply's own window, by address ─────────────────────────────
  // Its readings are small charts (.pcp-reading), read here by label and number.
  const PSU_READ = `Object.fromEntries([...document.querySelectorAll('.dc-canvas .pcp-reading')].map(r => [r.querySelector('.ds-spark-lbl')?.textContent.trim(), r.querySelector('.ds-spark-val')?.textContent.trim()]))`;
  await load(send, '#/?sku=forge-45l-psu');
  await waitFor(send, `document.querySelector('.dc-canvas .pcp-reading')`);
  c = await evalJs(send, CANVAS);
  check('psu: the address opens the power supply window on Status',
    JSON.stringify(c?.tabs) === JSON.stringify(['Status', 'Fan', 'Settings']) && c?.title === 'Status', `${c?.tabs?.join('/')} · ${c?.title}`);
  let pr = await evalJs(send, PSU_READ);
  check('psu: live readings are there from the first look',
    /^\d+ W$/.test(pr['Total power'] ?? '') && /°C$/.test(pr['Temperature'] ?? '') && /RPM$/.test(pr['Fan speed'] ?? ''), JSON.stringify(pr));
  check('psu: the status is said in a word', c?.badges.includes('Good'), c?.badges.join(' / '));

  await clickTab(send, 'Fan');
  await sleep(300);
  check('psu fan: automatic cleaning is off by default',
    await evalJs(send, `document.querySelector('[aria-label="Enable automatic fan cleaning"]')?.checked === false`));
  await clickButton(send, 'Start fan clean');
  await sleep(200);
  check('psu fan: a clean says it is driving the fan',
    (await evalJs(send, `document.querySelector('.dc-canvas')?.textContent ?? ''`)).includes('The clean is running the fan'));
  await clickTab(send, 'Status');
  await sleep(200);
  pr = await evalJs(send, PSU_READ);
  check('psu status: the fan reads the clean while it runs', pr['Fan speed'] === 'Cleaning', pr['Fan speed']);
  await sleep(3200);
  await clickTab(send, 'Fan');
  await sleep(300);
  c = await evalJs(send, CANVAS);
  check('psu fan: the clean ends and is recorded', c?.spec['Last cleaned'] === 'Just now', c?.spec['Last cleaned']);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-psu.png`, Buffer.from(shot.data, 'base64'));
  await closeCanvas(send);

  // ── About this PC: the This PC button ─────────────────────────────────────
  await load(send);
  await openPanel(send);
  await evalJs(send, `document.querySelector('.devp-pc-about')?.click()`);
  await waitFor(send, `document.querySelector('.breadcrumb-current')?.textContent.trim() === 'About this PC'`);
  const about = await evalJs(send, `Object.fromEntries([...document.querySelectorAll('.modal-right .ds-ng3-spec-row')].map(r => [r.querySelector('.ds-ng3-spec-key')?.textContent.trim(), r.querySelector('.ds-ng3-spec-val')?.textContent.trim()]))`);
  const aboutCard = await evalJs(send, `(() => { const c = document.querySelector('.modal-right .dsc'); return c ? { text: c.textContent, buttons: [...c.querySelectorAll('button')].map(b => b.textContent.trim()) } : null; })()`);
  check('about: the This PC button opens it, with the peripherals\' device card — the name, Device Manager, Get Support',
    aboutCard?.text?.includes('HyperX OMEN MAX 45L') && JSON.stringify(aboutCard?.buttons) === JSON.stringify(['Device Manager', 'Get Support']), JSON.stringify(aboutCard));
  check('about: one list of the machine below it, its parts read from the registry',
    !('Model' in about) && about['Power supply'] === '1200 W, 80+ Platinum' && about['Graphics'] === 'GeForce RTX 5090 (32 GB)', JSON.stringify(about));
  await evalJs(send, `document.querySelector('.modal-close')?.click()`);
  await sleep(300);

  // ── An entry that goes to a page lands on its card (the Spotlight) ────────
  // Power Mode and System Vitals go to the Performance page; the card is lit,
  // in view, and the panel has closed behind it. (Fan Cleaner, a notebook's,
  // is walked on the laptop below.)
  for (const [label, feature] of [['Power Mode', 'power-mode'], ['System Vitals', 'system-vitals']]) {
    check(`${label.toLowerCase()}: the entry goes to Perform and lights its card, in view, with the panel closed`, await rowLands(send, label, feature));
  }

  // ── Laptop as This PC ─────────────────────────────────────────────────────
  await evalJs(send, `localStorage.setItem('thisPc', 'hx-omen-16-valorant')`);
  await load(send);
  check('laptop: panel opens on This PC', await openPanel(send));
  dir = await evalJs(send, DIR);
  check('laptop: Performance is Power Mode, System Vitals and Fan Cleaner (a notebook cleans its own fans)', JSON.stringify(labelsOf(dir, 'Performance')) === JSON.stringify(['Power Mode', 'System Vitals', 'Fan Cleaner']), labelsOf(dir, 'Performance').join(' · '));
  const lsp = await evalJs(send, SPACING);
  check('laptop spacing: the same 16 / 8 / 4 px, and one row height', near(lsp.above, 16) && near(lsp.toFirst, 8) && near(lsp.between, 4) && new Set(lsp.heights.map((h) => Math.round(h))).size === 1, JSON.stringify(lsp));
  const keyboard = rowsOf(dir, 'Personalize').find((r) => r.label === 'Lighting');
  const macro = rowsOf(dir, 'Personalize').find((r) => r.label === 'Macro');
  check('laptop: Personalize is Lighting, with its zones, then Macro, with its four keys (keys-macros.7)',
    JSON.stringify(labelsOf(dir, 'Personalize')) === JSON.stringify(['Lighting', 'Macro']) && /zones$/.test(keyboard?.reading ?? '') && macro?.reading === '4 keys',
    JSON.stringify(rowsOf(dir, 'Personalize')));
  check('laptop: no cooler cap, no power supply — no entry for hardware it does not have; the This PC button names the machine and its firmware',
    !dir.some((g) => g.rows.some((r) => /cooler cap|power supply/i.test(r.label))) && (await evalJs(send, ABOUT_BTN))?.sub === 'HyperX OMEN 16 VALORANT Edition · Firmware 1.0.3',
    JSON.stringify(await evalJs(send, ABOUT_BTN)));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-directory-laptop.png`, Buffer.from(shot.data, 'base64'));

  // ── The board card for This PC opens the PC's page ────────────────────────
  // The PC is a device like the mouse: its card opens its page, a shortcut on
  // the card opens the page at that tab, and the panel is not its door.
  const PC_CARD = `document.querySelector('[aria-label="Configure OMEN 16 VALORANT Edition"]')`;
  await evalJs(send, `localStorage.removeItem('board-layout')`);
  await load(send);
  await waitFor(send, PC_CARD);
  check('card: the page is closed before the card is used', await evalJs(send, `!document.querySelector('.dc-canvas') && !location.hash.includes('sku=')`));
  await evalJs(send, `${PC_CARD}.click()`);
  check('card: clicking This PC opens the PC\'s page (the address carries ?sku=), not the panel',
    await waitFor(send, `location.hash.includes('sku=hx-omen-16-valorant') && document.querySelector('.dc-canvas.pc-canvas')`, 4000)
      && (await evalJs(send, `!document.querySelector('.device-panel.open')`)));
  await closeCanvas(send);
  await evalJs(send, `[...${PC_CARD}.querySelectorAll('.dev-shortcut')].find(b => b.getAttribute('title') === 'Lighting')?.click()`);
  check('card: its Lighting shortcut opens the page on the Lighting tab',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Lighting'`, 4000));
  await closeCanvas(send);
  await evalJs(send, `document.querySelector('[aria-label="Configure Cloud III"]')?.click()`);
  check('card: a peripheral\'s card still opens that device\'s own window',
    await waitFor(send, `location.hash.includes('sku=cloud-iii') && document.querySelector('.dc-canvas')`, 3000));

  // ── The board card follows This PC ────────────────────────────────────────
  const BOARD_PC = `document.querySelector('[data-widget="dev-laptop"] [aria-label^="Configure "]')?.getAttribute('aria-label')`;
  await evalJs(send, `localStorage.setItem('thisPc', 'forge-45l'); localStorage.removeItem('board-layout')`);
  await load(send);
  await waitFor(send, BOARD_PC);
  check('card: with the desktop as This PC the board card is the desktop', (await evalJs(send, BOARD_PC)) === 'Configure OMEN MAX 45L', await evalJs(send, BOARD_PC));
  await evalJs(send, `document.querySelector('[data-widget="dev-laptop"] [aria-label^="Configure "]').click()`);
  check('card: the desktop\'s card opens the desktop\'s page',
    await waitFor(send, `location.hash.includes('sku=forge-45l') && document.querySelector('.dc-canvas.pc-canvas') && !document.querySelector('.device-panel.open')`, 3000));
  await evalJs(send, `localStorage.setItem('thisPc', 'hx-omen-16-valorant')`);
  await load(send);
  await waitFor(send, BOARD_PC);
  check('card: with the laptop as This PC it is the laptop', (await evalJs(send, BOARD_PC)) === 'Configure OMEN 16 VALORANT Edition', await evalJs(send, BOARD_PC));

  // ── No switch for how the PC opens: the PC is one model ───────────────────
  // Admin had "Opens as" (Page · Card → panel · Panel only) and the Simulator
  // "PC is" (A · Directory / B · Device). Both went with option A (JY 2026-10-22).
  await load(send, '#/?modal=admin');
  await waitFor(send, `document.querySelector('.modal-close')`);
  check('admin: no "Opens as" row and no "This PC opens as" switch',
    await evalJs(send, `!/Opens as/i.test(document.body.textContent) && !document.querySelector('[aria-label="This PC opens as"]')`));
  // Values stored by the old switches are ignored: a `panel` door and the
  // `directory` model change nothing — the card and the address open the page.
  const PAGE_ADDR = '#/?sku=hx-omen-16-valorant';
  await evalJs(send, `localStorage.setItem('pcDoor', 'panel'); localStorage.setItem('pcModel', 'directory')`);
  await load(send, PAGE_ADDR);
  check('stored pcDoor=panel and pcModel=directory are ignored: the page address opens the PC\'s page, not the panel',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas')`, 4000) && await evalJs(send, `!document.querySelector('.device-panel.open')`));
  await load(send);
  await waitFor(send, PC_CARD);
  await evalJs(send, `${PC_CARD}.click()`);
  check('stored pcDoor=panel and pcModel=directory are ignored: the card opens the page',
    await waitFor(send, `location.hash.includes('sku=hx-omen-16-valorant') && document.querySelector('.dc-canvas.pc-canvas')`, 4000));
  await evalJs(send, `localStorage.removeItem('pcDoor'); localStorage.removeItem('pcModel')`);

  // ── The PC's page ─────────────────────────────────────────────────────────
  // The directory's rows are the page's tabs, every tab's panel is one height,
  // and the page holds what the user arranged (2026-10-21).
  /** The page's panel, per tab: its title, height, and whether the body is clipped. */
  const TAB_WALK = `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    for (const t of document.querySelectorAll('.dc-canvas .ds-ng3-tool')) {
      t.click(); await sleep(700);
      const body = document.querySelector('.dc-canvas .ds-ng3-body');
      const scope = body.querySelector('.pb-scope-body');
      const content = scope ? scope.firstElementChild : [...body.children].find((c) => !c.classList.contains('ds-ng3-header'));
      out.push({ tab: t.getAttribute('aria-label'), title: document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim(),
        h: Math.round(document.querySelector('.dc-canvas .dc-panel-wrap').getBoundingClientRect().height),
        clipped: !!content && content.scrollHeight > content.clientHeight + 1 && getComputedStyle(content).overflowY !== 'auto' });
    }
    return out;
  })()`;
  await evalJs(send, `localStorage.setItem('thisPc', 'forge-45l'); localStorage.removeItem('mvpScope')`);
  await load(send);
  check('desktop page: the panel shows the same directory', await openPanel(send) && JSON.stringify(labelsOf(await evalJs(send, DIR), 'Personalize')) === JSON.stringify(['LCD cooler cap', 'Chassis lighting']));
  check('desktop page: the hero opens the PC\'s page, not About this PC', (await evalJs(send, `document.querySelector('.devp-hero')?.getAttribute('title')`)) === 'Open OMEN MAX 45L');
  await clickRow(send, 'Chassis lighting');
  check('desktop page: the row opens the page on its Chassis lighting tab, with the chassis editor, and the panel stays behind it',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .cl') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Chassis lighting' && document.querySelector('.device-panel.open')`, 6000),
    await evalJs(send, `document.querySelector('.dc-canvas .ds-ng3-title')?.textContent`));
  c = await evalJs(send, CANVAS);
  check('desktop page: the tabs are Performance · LCD cooler cap · Chassis lighting · Power supply — no Settings',
    JSON.stringify(c?.tabs) === JSON.stringify(['Performance', 'LCD cooler cap', 'Chassis lighting', 'Power supply']), c?.tabs?.join('/'));
  let walk = await evalJs(send, TAB_WALK);
  check('desktop page: every tab\'s panel is one height, and no tab is clipped',
    new Set(walk.map((w) => w.h)).size === 1 && walk.every((w) => !w.clipped) && walk.every((w) => w.title === w.tab), JSON.stringify(walk));
  await clickTab(send, 'Performance');
  await sleep(500);
  check('desktop page Performance: three vitals gauges on the shared numbers, and the machine\'s silicon',
    (await evalJs(send, `document.querySelectorAll('.dc-canvas .lc-vital').length`)) === 3
      && (await evalJs(send, `/RTX 5090/.test(document.querySelector('.dc-canvas .lc-spec')?.textContent || '')`))
      && (await evalJs(send, `[...document.querySelectorAll('.dc-canvas .lc-vital .gauge-temp-badge')].map(b => b.textContent.trim()).join(' ')`)) === '58°C 60°C 18.7 GB');
  let doors = await evalJs(send, DOORS);
  check('desktop page Performance: doors to System Vitals and Power Mode — no Fan Cleaner, a notebook\'s — each with its reading and a chevron, all inside the panel; no "Manage performance", no power-mode control',
    JSON.stringify(doors.map((d) => d.spot)) === JSON.stringify(['vitals', 'power-mode'])
      && doors.find((d) => d.spot === 'power-mode')?.reading === 'Performance'
      && (await evalJs(send, `document.querySelectorAll('.dc-canvas .lc-door .ds-list-item-trailing svg').length`)) === 2
      && (await evalJs(send, DOORS_IN_PANEL))
      && !(await evalJs(send, `!!document.querySelector('.dc-canvas [data-testid="fan-cleaner-line"]')`))
      && (await evalJs(send, `![...document.querySelectorAll('.dc-canvas button')].some(b => /manage performance/i.test(b.textContent)) && !document.querySelector('.dc-canvas [aria-label="Power mode"]')`)),
    JSON.stringify(doors));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-b-desktop-performance.png`, Buffer.from(shot.data, 'base64'));
  await clickTab(send, 'LCD cooler cap');
  await sleep(500);
  check('desktop page LCD cooler cap: the cap\'s presets and brightness, the DIY fan kit in a line, the views at the title row\'s right end, the cap beside the tower',
    await evalJs(send, `!!document.querySelector('.dc-canvas .cap-tab .pdm-presets') && !!document.querySelector('.dc-canvas .cap-tab .pdm-bright') && /DIY fan kit/.test(document.querySelector('.dc-canvas .cap-tab-more')?.textContent || '') && !!document.querySelector('.dc-canvas .ds-ng3-header [aria-label="Cooler cap view"]') && !!document.querySelector('.dc-canvas .cap-hero .pcp-cap')`));
  await clickView(send, 'Settings');
  await sleep(200);
  check('desktop page LCD cooler cap: Settings holds the cap\'s firmware, on the page itself — no other window',
    await evalJs(send, `!!document.querySelector('.dc-canvas.pc-canvas [data-firmware="Cooler cap"]') && document.querySelectorAll('.dc-canvas').length === 1`));
  check('desktop page: the cap\'s row opens the same page on the cap\'s tab',
    (await (async () => { await closeCanvas(send); if (!(await evalJs(send, `!!document.querySelector('.device-panel.open')`))) await openPanel(send); await clickRow(send, 'LCD cooler cap'); return waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .cap-tab')`, 6000); })()));
  await closeCanvas(send);
  for (const [label, title] of [['LCD cooler cap', 'LCD cooler cap'], ['Chassis lighting', 'Chassis lighting'], ['Power supply', 'Power supply']]) {
    check(`desktop page: the ${label} row opens the PC\'s page on its ${title} tab, every tab still there`, await rowOpensTab(send, label, title));
  }

  // The directory's three Performance rows go to the Performance page, not to
  // the PC page's Performance tab (the team's navigation for the directory).
  for (const [label, feature] of [['Power Mode', 'power-mode'], ['System Vitals', 'system-vitals']]) {
    check(`desktop page: the ${label} row goes to the Performance page and lights its card, in view; the panel closes and no PC window opens`, await rowLands(send, label, feature));
  }
  // The Performance tab's doors leave the window for the page: the window and
  // the panel behind it both close, and the card they point at is lit.
  for (const [spot, feature] of [['vitals', 'system-vitals'], ['power-mode', 'power-mode']]) {
    check(`desktop page Performance tab: the ${spot} door lands on its card, lit and in view; the window and the panel behind it are closed`,
      await doorLands(send, 'Chassis lighting', spot, feature));
  }
  await load(send, '#/perform');
  await waitFor(send, `document.querySelector('.pv5-maint-grid')`);
  check('desktop Performance page: no Fan Cleaner card — Maintenance is the System Cleaner alone',
    await evalJs(send, `![...document.querySelectorAll('.ds-feature-card-title')].some(e => /fan cleaner/i.test(e.textContent)) && !document.querySelector('[data-feature="fan-cleaner"]')`));

  await evalJs(send, `localStorage.setItem('thisPc', 'hx-omen-16-valorant')`);
  check('laptop page: the Lighting row opens the PC\'s page on its Lighting tab, every tab still there', await rowOpensTab(send, 'Lighting', 'Lighting'));
  await load(send);
  await openPanel(send);
  await clickRow(send, 'Macro');
  check('laptop page: the Macro row opens the page on Macro, and the first line says only four keys take a macro (keys-macros.7)',
    await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas [data-testid="macro-tab"]')`, 6000)
      && /4 macro keys, P1 to P4/.test(await evalJs(send, `document.querySelector('.lc-macro-note')?.textContent || ''`))
      && (await evalJs(send, `document.querySelectorAll('.dc-canvas .mp-keyrow').length`)) === 4,
    await evalJs(send, `document.querySelector('.lc-macro-note')?.textContent`));
  c = await evalJs(send, CANVAS);
  check('laptop page: the tabs are Performance · Lighting · Macro — no Keys & Macros, no Settings',
    JSON.stringify(c?.tabs) === JSON.stringify(['Performance', 'Lighting', 'Macro']), c?.tabs?.join('/'));
  walk = await evalJs(send, TAB_WALK);
  check('laptop page: every tab\'s panel is one height, and no tab is clipped',
    new Set(walk.map((w) => w.h)).size === 1 && walk.every((w) => !w.clipped) && walk.every((w) => w.title === w.tab), JSON.stringify(walk));
  await clickTab(send, 'Performance');
  await sleep(500);
  doors = await evalJs(send, DOORS);
  check('laptop page Performance: doors to System Vitals, Power Mode and Fan Cleaner, the last in the card\'s own words; no "Manage performance"',
    JSON.stringify(doors.map((d) => d.spot)) === JSON.stringify(['vitals', 'power-mode', 'fan-cleaner'])
      && doors.find((d) => d.spot === 'fan-cleaner')?.reading === 'Good · last cleaned 45 days ago'
      && /Good/.test(await evalJs(send, `document.querySelector('.dc-canvas [data-testid="fan-cleaner-line"]')?.textContent || ''`))
      && (await evalJs(send, DOORS_IN_PANEL))
      && (await evalJs(send, `![...document.querySelectorAll('.dc-canvas button')].some(b => /manage performance/i.test(b.textContent))`)),
    JSON.stringify(doors));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/pc-b-laptop-performance.png`, Buffer.from(shot.data, 'base64'));
  await clickTab(send, 'Lighting');
  await sleep(500);
  // The peripherals' layout (JY, 2026-10-21): the rail, the zones, the presets.
  const zoneRows = await evalJs(send, `[...document.querySelectorAll('.dc-canvas .pcz-zone')].map(z => z.dataset.zone)`);
  check('laptop page Lighting: the peripherals\' layout — brightness, the zones with All, the preset library',
    await evalJs(send, `!!document.querySelector('.dc-canvas .pcz .pdm-bright') && !!document.querySelector('.dc-canvas .pcz-zones') && document.querySelectorAll('.dc-canvas .pcz .pdm-preset').length > 10`)
      && JSON.stringify(zoneRows) === JSON.stringify(['*', 'left', 'center', 'right', 'numpad', 'logo']), JSON.stringify(zoneRows));
  // The page's hero is the 3D machine alone: no drawn board, no photo beside it.
  check('laptop page Lighting: no drawn board over the hero and no photo beside it',
    (await evalJs(send, `!document.querySelector('.dc-canvas .kbd-stage') && !document.querySelector('.dc-canvas .lp-frame')`)) === true);
  await closeCanvas(send);
  for (const [label, feature] of [['Power Mode', 'power-mode'], ['System Vitals', 'system-vitals'], ['Fan Cleaner', 'fan-cleaner']]) {
    check(`laptop page: the ${label} row goes to the Performance page and lights its card, in view; the panel closes`, await rowLands(send, label, feature));
  }
  for (const [spot, feature] of [['vitals', 'system-vitals'], ['power-mode', 'power-mode'], ['fan-cleaner', 'fan-cleaner']]) {
    check(`laptop page Performance tab: the ${spot} door lands on its card, lit and in view; the window and the panel behind it are closed`,
      await doorLands(send, 'Macro', spot, feature));
  }
  await evalJs(send, `localStorage.removeItem('board-layout')`);
  await load(send);
  await waitFor(send, `document.querySelector('[data-widget="dev-laptop"] .dev-shortcut')`);
  const bShortcuts = await evalJs(send, `[...document.querySelectorAll('[data-widget="dev-laptop"] .dev-shortcut')].map(b => b.getAttribute('title'))`);
  check('page: the board card\'s shortcuts are the page\'s tabs', JSON.stringify(bShortcuts) === JSON.stringify(['Performance', 'Lighting', 'Macro']), JSON.stringify(bShortcuts));

  // Hidden until asked (Chris, 2026-10-26): a first look has no Simulator; the
  // `sim=1` link (every `load` here) or Admin › Simulator turns it on.
  await evalJs(send, `localStorage.removeItem('showSimulator'); true`);
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/` });
  await waitFor(send, `document.querySelector('#root')?.firstElementChild`);
  await sleep(800);
  check('rig: hidden on a first visit', !(await evalJs(send, `!!document.querySelector('[data-testid="sim-rig"]')`)));

  // The Simulator (prototype-only), on every page: the review's switches
  // without leaving the page — This PC, scope, OMEN AI, session — and still
  // there when the page closes.
  await load(send, '#/?sku=hx-omen-16-valorant&tab=vitals');
  await waitFor(send, `document.querySelector('[data-testid="sim-rig"]')`);
  const rigRows = await evalJs(send, `[...document.querySelectorAll('[data-testid="sim-rig"] .pv3-rig-label')].map(e => e.textContent.trim())`);
  check('rig: the Simulator shows Machine, Scope, OMEN AI and Session over the PC\'s page — no "PC is" row, no Review section',
    JSON.stringify(rigRows) === JSON.stringify(['Machine', 'Scope', 'OMEN AI', 'Session'])
      && (await evalJs(send, `!document.querySelector('[data-testid="sim-rig"] [aria-label="PC is"]') && !/PC is|Review/.test(document.querySelector('[data-testid="sim-rig"]').textContent)`)), JSON.stringify(rigRows));
  await evalJs(send, `[...document.querySelectorAll('[data-testid="sim-rig"] [aria-label="Machine"] button')].find(b => b.textContent.trim() === 'Desktop')?.click()`);
  check('rig: Machine → Desktop swaps the open page to the desktop, on the same tab',
    await waitFor(send, `location.hash.includes('sku=forge-45l') && /45L/.test(document.querySelector('.dc-canvas')?.getAttribute('aria-label') || '') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === 'Performance'`, 4000)
      && (await evalJs(send, `localStorage.getItem('thisPc')`)) === 'forge-45l');

  // June 2027: one System Vitals row, and the tab keeps its
  // vitals and the one door; the Power Mode and Fan Cleaner doors are gone with
  // their cards.
  await evalJs(send, `localStorage.setItem('mvpScope', 'june27'); localStorage.setItem('thisPc', 'forge-45l')`);
  await load(send);
  await openPanel(send);
  check('june page: the directory is the one System Vitals row, to the page\'s vitals card',
    JSON.stringify(labelsOf(await evalJs(send, DIR), 'Performance')) === JSON.stringify(['System Vitals']) && (await rowLands(send, 'System Vitals', 'system-vitals')));
  await load(send, '#/?sku=forge-45l&tab=vitals');
  await waitFor(send, `document.querySelector('.dc-canvas.pc-canvas .lc-vital')`, 6000);
  doors = await evalJs(send, DOORS);
  check('june page: the Performance tab has the vitals and its one door, no Power Mode or Fan Cleaner door',
    (await evalJs(send, `document.querySelectorAll('.dc-canvas .lc-vital').length`)) === 3 && JSON.stringify(doors.map((d) => d.spot)) === JSON.stringify(['vitals']), JSON.stringify(doors));
  await evalJs(send, `document.querySelector('.dc-canvas [data-spot="vitals"]')?.click()`);
  check('june page: the vitals door lands on the vitals card, in view, and the window is closed',
    (await landed(send, 'system-vitals')) && (await evalJs(send, `!document.querySelector('.dc-canvas')`)));

  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

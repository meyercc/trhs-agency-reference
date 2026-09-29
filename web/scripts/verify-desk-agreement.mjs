// Do the two desk pictures agree — across every scenario, not the one someone
// happened to open?
//
// Why this file exists (2026-09-02, Cindy): "내가 이거 디바이스마다 각 상황
// 시나리오마다 다 스크린샷을 해서 확인을 해야 되는 거니?" No. Three separate
// bugs in two days all looked the same from the outside — the hero drawing a
// desk that did not match the Arrange window — and each was found by a person
// looking at one screenshot of one state. This walks the states instead.
//
// The matrix: display count 1/2/3 × how the layout got saved (never · straight
// from the editor's mode buttons · after a drag). For each cell it asserts the
// two things the 2026-08-29 call says both lenses must share:
//   · same left-to-right order
//   · and the hero does not pile displays on top of each other
// Spacing and tile size are deliberately NOT compared: the editor draws
// resolution, the hero draws hardware (2026-07-22, two lenses).
//
// Run: dev server on :5219, headless Chrome on :9270, from web/.
import WebSocket from 'ws';
// Desk hardware — the Admin axis since 2026-09-08. `displayCount`/`pcCount` are
// gone; the desk is a LIST of optional devices (`deskDevices`) and the numbers
// are derived. This maps the (screens, PCs) pairs these checks were written in
// onto the real desks: 3 screens = OMEN + laptop lid + Treehouse; 2 = laptop
// lid + Treehouse; 1 = the tower alone with the Treehouse (a laptop on the desk
// brings its screen, so a one-screen desk has no laptop). PCs 1 drops the tower.
const DESK = (screens, pcs = 2) => JSON.stringify(
  screens >= 3 ? ['pulse-27', 'macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : screens === 2 ? ['macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : ['tower']);

const PORT = process.env.PORT || '5219';
const CDP = process.env.CDP || '9270';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const target = tl.find((x) => x.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
const pend = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => { const i = ++msgId; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

let n = 0;
// Wait for the app rather than sleeping a guess — a cold dev server is slower
// than any fixed number, and that produced two false failures on 2026-09-01.
const open = async (hash) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?m=${++n}${hash}` });
  for (let waited = 0; waited < 20000; waited += 100) {
    if (await ev(`!!(document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild)`)) break;
    await sleep(100);
  }
  await sleep(600);
};

const HERO = `(() => {
  const st = document.querySelector('.dsa-stage');
  if (!st) return null;
  const sr = st.getBoundingClientRect();
  // Screens only here, like EDITOR below: this pair of checks is about the order
  // of DISPLAYS. The computer standing on the desk is checked by the roster
  // section at the end of this file.
  // Compared by device id (data-display), not caption: since 2026-09-21 the
  // hero calls the laptop "MacBook" and the editor keeps the OS word
  // "Built-in Display" — same device, two deliberate names.
  const t = [...st.querySelectorAll('.dsa-disp:not(.dsa-computer)')].map((e) => {
    const r = e.getBoundingClientRect();
    return { nm: e.dataset.display, x: r.left - sr.left, w: r.width };
  }).sort((a, b) => a.x - b.x);
  const gaps = [];
  for (let i = 1; i < t.length; i += 1) gaps.push(t[i].x - (t[i - 1].x + t[i - 1].w));
  return { names: t.map((d) => d.nm), gaps };
})()`;
const EDITOR = `(() => {
  const st = document.querySelector('.ae-stage');
  if (!st) return null;
  const sr = st.getBoundingClientRect();
  // Screens only. The editor also stands the COMPUTER in this row (2026-09-10),
  // and so does the hero since 2026-09-18 — but this check compares the two
  // lenses' left-to-right order of DISPLAYS; the computer has its own section.
  const t = [...st.querySelectorAll('.ae-tile:not(.ae-pc)')].map((e) => {
    const r = e.getBoundingClientRect();
    return { nm: e.dataset.display, x: r.left - sr.left };
  }).sort((a, b) => a.x - b.x);
  return { names: t.map((d) => d.nm) };
})()`;
const openEditor = `[...document.querySelectorAll('button, a')].find((b) => /^ARRANGE$/i.test(b.textContent.trim()))?.click()`;

// `saved` decides how this desk's layout came to exist.
async function scenario(count, saved) {
  await ev(`localStorage.setItem('deskDevices','${DESK(count)}')`);
  await ev(`localStorage.removeItem('displayArrange')`);
  if (saved === 'grown') {
    // Saved when the desk was smaller, then a display attached.
    await ev(`localStorage.setItem('deskDevices','${DESK(Math.max(1, count - 1))}')`);
    await open('#/?sku=treehouse-32&tab=display');
    await ev(openEditor); await sleep(1200);
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Extend')?.click()`);
    await sleep(700);
    await ev(`localStorage.setItem('deskDevices','${DESK(count)}')`);
  } else if (saved === 'editor') {
    // Saved by pressing Extend in the editor — the path that broke.
    await open('#/?sku=treehouse-32&tab=display');
    await ev(openEditor); await sleep(1200);
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Extend')?.click()`);
    await sleep(700);
  }
  await open('#/?sku=treehouse-32&tab=display');
  const hero = await ev(HERO);
  await ev(openEditor); await sleep(1400);
  const editor = await ev(EDITOR);
  const label = `${count} display${count > 1 ? 's' : ''} · ${saved}`;
  // One display has nothing to arrange, so the window has no `Arrange` door and
  // there is no second picture to disagree with. That is the design, not a gap:
  // the hero still has to draw the one display, and that is what is asserted.
  if (count === 1) {
    check(`${label}: the one display is drawn, and there is no editor to disagree with`,
      !!hero && hero.names.length === 1 && !editor, hero ? hero.names.join(' → ') : 'no hero');
    return;
  }
  if (!hero || !editor) { check(`${label}: both pictures render`, false, 'a stage was missing'); return; }
  check(`${label}: same left-to-right order`,
    hero.names.join('|') === editor.names.join('|'),
    `hero ${hero.names.join(' → ')} / editor ${editor.names.join(' → ')}`);
  check(`${label}: the hero stacks nothing`,
    hero.gaps.every((g) => g > -1),
    hero.gaps.map((g) => g.toFixed(0)).join(' / ') || '(single display)');
}

// Land on THIS server before the first write. `scenario` sets localStorage on
// whatever page the tab holds, and a tab left on another server's origin took
// the first desk setting there — the "1 display · never" case then read the
// previous desk and failed on CURRENT only (2026-09-18 and 09-21; gone when the
// run started on the right origin).
await open('#/');
for (const count of [1, 2, 3]) for (const saved of ['never', 'editor', 'grown']) await scenario(count, saved);

// ── Does every surface show the desk the Admin row describes? (2026-09-18) ────
// Cindy: "admin 설정값이랑 실제 디자인이 매칭이 안되는 문제 … 한군데만 고치면
// 어떻게 하니? 내가 고칠 부분을 일일이 너한테 설명을 다 해줘야 되는 거야?"
// The section above only compared two desk pictures. The computer, the home
// board, My Devices and its switch button read the desk from three different
// places, and each was found by a person, one screen at a time (09-02, 09-08,
// 09-18). This walks all six Admin desks across all of them.
// EVERY expected value is derived from the Admin list itself — no string that
// describes one decision is typed here, so a check cannot outlive its decision
// the way `/Drag them in Desk above/` did (2026-09-09).
const HOSTS = { macbook: 'MacBook', tower: 'OMEN 35L' }; // SKU gearSwitch.hosts
const ROSTER_DESKS = [
  ['pulse-27', 'macbook', 'tower'], ['macbook', 'tower'], ['pulse-27', 'macbook'],
  ['pulse-27', 'tower'], ['macbook'], ['tower'],
];
for (const desk of ROSTER_DESKS) {
  const label = `desk {${desk.join(', ')}}`;
  const pcs = desk.filter((d) => d === 'macbook' || d === 'tower');
  const oled = desk.includes('pulse-27');
  const expScreens = ['Treehouse 32', ...(oled ? ['OMEN OLED 27'] : []), ...(desk.includes('macbook') ? ['MacBook'] : [])].sort();
  const expComputer = desk.includes('tower') ? [HOSTS.tower] : [];
  const active = desk.includes('macbook') ? 'pc1' : 'pc2';
  await ev(`localStorage.setItem('deskDevices', ${JSON.stringify(JSON.stringify(desk))})`);
  await ev(`localStorage.setItem('kvm', JSON.stringify({ configured: true, activePc: '${active}', moveKbm: true }))`);
  await ev(`localStorage.removeItem('displayArrange')`);

  // Monitor window hero — the screens, and the tower when it is on the desk.
  await open('#/?sku=treehouse-32');
  const hero = await ev(`(() => {
    const st = document.querySelector('.dsa-stage'); if (!st) return null;
    const sr = st.getBoundingClientRect();
    const names = (sel) => [...st.querySelectorAll(sel)].map((e) => e.querySelector('.dsa-name')?.textContent.trim());
    const out = [...st.querySelectorAll('.dsa-disp')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < sr.left - 1 || r.right > sr.right + 1; }).length;
    return { screens: names('.dsa-disp:not(.dsa-computer)').sort(), computers: names('.dsa-computer') , out };
  })()`);
  check(`${label}: hero screens = Admin`, hero && hero.screens.join('|') === expScreens.join('|'), hero ? hero.screens.join(', ') : 'no hero');
  check(`${label}: hero computer = Admin`, hero && hero.computers.join('|') === expComputer.join('|'), hero ? hero.computers.join(', ') || '(none)' : 'no hero');
  check(`${label}: nothing in the hero leaves the stage`, hero && hero.out === 0, hero ? `${hero.out} outside` : '');

  // Home board — the OMEN OLED 27 card exists only on a desk that has it.
  await open('#/');
  const homeOled = await ev(`/OMEN OLED 27/.test(document.body.innerText)`);
  check(`${label}: home board OMEN OLED 27 card ${oled ? 'shown' : 'hidden'}`, homeOled === oled);

  // My Devices — the same roster as tabs, and a switch only with two computers.
  await open('#/?devices=1');
  const tabs = await ev(`[...document.querySelectorAll('.devp-tab')].map((b) => b.title)`);
  check(`${label}: My Devices lists OMEN OLED 27 ${oled ? 'yes' : 'no'}`, tabs.includes('OMEN OLED 27') === oled, tabs.join(', '));
  await ev(`[...document.querySelectorAll('.devp-tab')].find((b) => /Treehouse/.test(b.title))?.click()`);
  await sleep(300);
  const action = await ev(`[...document.querySelectorAll('.device-panel .devp-action')].map((e) => e.innerText.replace(/\\s+/g, ' ')).join(' | ')`);
  if (pcs.length > 1) {
    const other = HOSTS[active === 'pc1' ? 'tower' : 'macbook'];
    check(`${label}: My Devices offers the switch, to the computer that is here`, action.includes(`To ${other}`), action || '(no action row)');
  } else {
    check(`${label}: My Devices offers no switch with one computer`, !/Switch computer|Second PC/.test(action), action || '(no action row)');
  }

  // Personalize → Display — one skeleton on every desk (2026-09-21, second
  // pass, after Cindy read the missing picture on a one-screen desk as a bug):
  // the DESK picture always; beside it All monitors on a two-monitor desk, or
  // the monitor's own brightness card on a one-monitor desk. The Gear Switch row
  // only with two computers; no "with a second …" advert anywhere.
  await open('#/personalize');
  await sleep(800);
  const sec = await ev(`(() => {
    const titles = [...document.querySelectorAll('.w-label-text')].map((e) => e.textContent.trim());
    return {
      desk: titles.includes('Desk'), all: titles.includes('All monitors'),
      own: titles.includes('Treehouse 32'),
      gear: !!document.querySelector('.dov-gear'),
      advert: /with a second (PC|display)/i.test(document.body.innerText),
    };
  })()`);
  check(`${label}: Display section keeps the DESK picture`, sec.desk, JSON.stringify(sec));
  // The brightness card follows MONITORS, not displays (2026-09-21): a laptop's
  // own screen has no level in the app, so a laptop + one monitor desk gets that
  // monitor's card, and only two monitors get All monitors.
  if (!oled) {
    check(`${label}: one monitor — its own brightness card beside the picture`, sec.own && !sec.all, JSON.stringify(sec));
  } else {
    check(`${label}: two monitors — All monitors beside the picture`, sec.all && !sec.own, JSON.stringify(sec));
  }
  check(`${label}: Gear Switch row ${pcs.length > 1 ? 'shown' : 'absent'}`, sec.gear === (pcs.length > 1));
  check(`${label}: no "with a second …" advert on Personalize`, !sec.advert);

  // Admin Display scenario row (2026-09-22) — the picker is grouped by computers
  // (`Laptop` / `Laptop + desktop`), rows by monitor count, and closed it reads
  // `Laptop · 1 monitor`. A desk outside the list is not a scenario: opening
  // Admin sets it to the first one (Cindy, 09-22 — a test tool, nothing to lose),
  // so for those desks the check is that the desk BECAME `Laptop · 1 monitor`.
  // `data-desk` is the chosen scenario's own list, so the list stays in one file.
  await open('#/?modal=admin');
  const row = await ev(`(() => {
    const st = document.querySelector('.admin-desk-status');
    if (!st) return null;
    return { named: st.dataset.desk, picked: st.closest('.admin-tool').querySelector('.ds-dropdown-label')?.textContent.trim() ?? '', stored: localStorage.getItem('deskDevices') };
  })()`);
  const listed = desk.includes('macbook');
  const expDesk = listed ? desk : ['macbook'];
  const nMon = 1 + (expDesk.includes('pulse-27') ? 1 : 0);
  const expPick = `${expDesk.includes('tower') ? 'Laptop + desktop' : 'Laptop'} · ${nMon} monitor${nMon > 1 ? 's' : ''}`;
  const namedOk = row && row.named.split(',').sort().join('|') === [...expDesk].sort().join('|');
  check(`${label}: Admin picker reads ${listed ? 'this desk' : 'the first desk (unlisted desk reset)'}`,
    row && row.picked === expPick && namedOk && (listed || JSON.parse(row.stored || '[]').join() === 'macbook'),
    row && JSON.stringify(row));
}

// ── One floor, drawn three times (2026-09-22) ────────────────────────────────
// Cindy, on the same note for the fifth time in the record (08-05 · 08-06 ·
// 09-02 · 09-04 · 09-22): "디바이스 이미지 배치 이상한 거 … 매번 말해서 …
// 왜 자꾸 이래." SPEC desk-stage rule 1 (everything stands on the desk) and
// rule 11 (the computer's bottom IS the floor) existed since 2026-08-06 and
// 2026-09-03 — and were checked in ONE place, the DESK card, and ONLY while
// nothing was saved (verify-desk-card: `floorAnchored = !L.saved`). A real desk
// has a saved layout after one press of Extend, so the rule was exempt exactly
// where people live. Reproduced on CURRENT, 2026-09-22:
//   fresh desk        DESK 144/144/144 · hero 185/185/185 — one floor
//   after Extend      tower 35px below the screens on the DESK card, 73px in the hero
//   Arrange window    opens with the Built-in Display 50px above the floor, unsaved
// What is asserted is a RELATION, never a position: within each surface the
// computer stands where the lowest screen stands, and a screen is raised on one
// surface iff it is raised on the others. Tile sizes differ per lens on purpose
// (2026-07-22, two lenses) — nothing is compared across surfaces in px.
const FLOOR_TOL = 3;
const FLOOR_DESK = `(() => { const st = document.querySelector('.dov-stage'); if (!st) return null; st.scrollIntoView({ block: 'center' });
  const id = (el) => el.classList.contains('d-slab') ? 'computer' : el.classList.contains('d-mac') ? 'builtin' : el.classList.contains('d-tree') ? 'treehouse-32' : el.classList.contains('d-omen') ? 'oled-27' : '?';
  return [...st.querySelectorAll('.dov-disp')].map((el) => { const b = (el.querySelector('.dov-shot') || el.querySelector('.dov-slab')).getBoundingClientRect(); return { id: id(el), bottom: b.bottom, l: b.left, r: b.right }; }); })()`;
const FLOOR_HERO = `(() => { const st = document.querySelector('.dsa-stage'); if (!st) return null;
  return [...st.querySelectorAll('.dsa-disp')].map((el) => { const b = (el.querySelector('.dsa-bounds') || el).getBoundingClientRect(); return { id: el.classList.contains('dsa-computer') ? 'computer' : el.dataset.display, bottom: b.bottom, l: b.left, r: b.right }; }); })()`;
const FLOOR_EDITOR = `(() => { const st = document.querySelector('.ae-stage'); if (!st) return null;
  return [...st.querySelectorAll('.ae-tile')].map((el) => ({ id: el.classList.contains('ae-pc') ? 'computer' : el.dataset.display, bottom: el.getBoundingClientRect().bottom })); })()`;
const floorRelation = (rows) => {
  if (!rows) return null;
  const screens = rows.filter((r) => r.id !== 'computer');
  const floor = Math.max(...screens.map((r) => r.bottom));
  const pc = rows.find((r) => r.id === 'computer');
  // Neighbour spacing (2026-09-23, Cindy «간격은?»): one gap on a picture, not a
  // saved number read with that picture's ruler. Ratio, so the hero's zoom is moot.
  const byX = [...rows].sort((a, b) => a.l - b.l);
  const gaps = []; for (let i = 1; i < byX.length; i++) gaps.push(byX[i].l - byX[i - 1].r);
  return { pcGap: pc ? +(pc.bottom - floor).toFixed(1) : null, raised: Object.fromEntries(screens.map((r) => [r.id, floor - r.bottom > FLOOR_TOL])), gaps };
};
async function floorScenario(desk, how) {
  await open('#/');
  await ev(`localStorage.setItem('deskDevices', ${JSON.stringify(JSON.stringify(desk))}); localStorage.removeItem('displayArrange')`);
  if (how !== 'never') {
    await open('#/?sku=treehouse-32&tab=display'); await ev(openEditor); await sleep(1200);
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Extend')?.click()`); await sleep(700);
    // `raised`: the person lifted the laptop's screen above the desk in the Arrange window.
    if (how === 'raised') await ev(`(() => { const s = JSON.parse(localStorage.getItem('displayArrange') || 'null'); if (!s?.positions?.builtin) return; s.positions.builtin.top = Math.max(0, s.positions.builtin.top - 0.25); localStorage.setItem('displayArrange', JSON.stringify(s)); })()`);
  }
  await open('#/personalize'); const card = floorRelation(await ev(FLOOR_DESK));
  await open('#/?sku=treehouse-32&tab=display'); const hero = floorRelation(await ev(FLOOR_HERO));
  await ev(openEditor); await sleep(1400); const editor = floorRelation(await ev(FLOOR_EDITOR));
  const label = `floor · ${desk.length} screens · ${how}`;
  const S = { 'DESK card': card, hero, 'Arrange window': editor };
  for (const [nm, r] of Object.entries(S)) {
    check(`${label}: the computer stands on the ${nm}'s floor`, !!r && r.pcGap !== null && Math.abs(r.pcGap) <= FLOOR_TOL,
      r ? (r.pcGap === null ? 'no computer drawn' : `${r.pcGap}px below the lowest screen`) : `no ${nm} stage`);
  }
  for (const [nm, r] of Object.entries({ 'DESK card': card, hero })) {
    const g = r?.gaps ?? [];
    check(`${label}: the ${nm}'s neighbours sit one gap apart`, g.length > 0 && Math.max(...g) / Math.max(1, Math.min(...g)) <= 1.1,
      g.map((x) => x.toFixed(0)).join(' / ') || 'no gaps');
  }
  // The two desk PICTURES must agree on what is raised. The Arrange window is the
  // screen lens (2026-07-22): a stagger a person drags in there is a pointer path,
  // not a height on the desk — so it joins the agreement only while nobody has
  // raised anything, i.e. it must OPEN standing on one floor.
  const judged = how === 'raised' ? { 'DESK card': card, hero } : S;
  const disagree = Object.keys(card?.raised ?? {}).filter((id) => new Set(Object.values(judged).map((r) => r?.raised?.[id])).size > 1);
  check(`${label}: a screen is raised on one picture only if it is raised on ${how === 'raised' ? 'both desk pictures' : 'all three'}`, !!card && !!hero && !!editor && disagree.length === 0,
    disagree.map((id) => `${id}: ${Object.entries(judged).map(([nm, r]) => `${nm} ${r?.raised?.[id] ? 'raised' : 'on the floor'}`).join(' / ')}`).join(' · ') || 'agree');
}
for (const desk of [['macbook', 'tower'], ['pulse-27', 'macbook', 'tower']]) for (const how of ['never', 'extend', 'raised']) await floorScenario(desk, how);

// Leave the profile as found (2026-09-22, reported by the Admin window): the last
// roster desk used to stay in localStorage, and a script that runs next on the
// same headless profile and assumes the default desk (verify-device-button.mjs)
// then saw a desk without the OLED 27 and failed twice.
await ev(`localStorage.removeItem('deskDevices'); localStorage.removeItem('kvm'); localStorage.removeItem('displayArrange'); 1`);

ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} FAILED of ${results.length}` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

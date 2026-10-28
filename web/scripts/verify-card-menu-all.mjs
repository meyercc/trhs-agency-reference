// Every widget card on Home carries the ⋮ «More options» menu (2026-10-08 —
// Treehouse IC meeting 10-06, Chris: «build this as a component level feature …
// all of the widget cards»). Until today only the monitor card had it; every
// other card had a hover-only corner ×.
//
// Two boards — the default one (device cards + Last Played) and one of header
// widgets (`WidgetShell`, whose right-hand link the ⋮ must not cover). On each:
//   · every cell shows exactly ONE ⋮ (a monitor card draws its own, with
//     Customize; the board's copy must step aside, not double up)
//   · the ⋮ names its card («More options for <name>»)
//   · a header card shows no link beside the ⋮ — the link is the menu's first
//     row (Cindy 2026-10-08) — and the ⋮ sits on the header line
//   · pressed with a real pointer (`Input.dispatchMouseEvent`, not el.click(),
//     which never asks what is on top): the menu opens, a plain card's menu is
//     exactly «Remove from Home», the monitor card's is «Customize · Remove from
//     Home», and Remove takes the card off the board
//   · Customize swaps the menu for the chooser, in the same place
//   · two groups with a separator: the card's rows · the board's (Move to the
//     top on a narrow screen — absent on the card already first — and Remove);
//     no moves beside the carousel (dropped 10-09)
//   · the first-visit hint sits on the first card at the top of Home only
//
// Run: dev server + headless Chrome, from web/:
//   APP_PORT=5331 CDP_PORT=9366 node scripts/verify-card-menu-all.mjs
import { ports } from './lib/ports.mjs';
import WebSocket from 'ws';

const { app: PORT, cdp: CDP } = ports({ app: '5178', cdp: '9366' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = (await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json())).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

let fails = 0;
const check = (label, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);
};

/** Press the centre of whatever the selector finds, with a real pointer. */
async function press(sel) {
  const found = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.scrollIntoView({ block: 'center' }); return true; })()`);
  if (!found) return false;
  // The page scrolls smoothly: measure until the target stops moving, or the
  // press lands where it was a moment ago.
  let at = null;
  for (let t = 0; t < 20; t++) {
    await sleep(150);
    const now = await ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (at && Math.abs(now.x - at.x) < 0.5 && Math.abs(now.y - at.y) < 0.5) break;
    at = now;
  }
  // Hover first and let it land, as a hand does: a press dispatched in the same
  // instant as the measure missed the Fan Speed ⋮ about one run in three.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await sleep(150);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  await sleep(350);
  return true;
}

async function load(layout, { hintSeen = true } = {}) {
  // Seed the store from a page of the same origin that does not run the app: a
  // running board writes its own layout back as it unloads, over the seed.
  await send('Page.navigate', { url: `http://localhost:${PORT}/draco/README.md` });
  await sleep(400);
  // `board-seeded-dev-pc`: the tower card is offered once at the front of a stored
  // board, and it can land a moment after the board looks settled — which moved
  // «the first card» under the checks. The boards here name their cards.
  // 27C2 scope: the Fan Speed widget's Fan Control link (checked below) is not in June 2027.
  await ev(`localStorage.clear(); localStorage.setItem('mvpScope','27c2'); localStorage.setItem('board-seeded-dev-pc','1'); ${hintSeen ? "localStorage.setItem('cardMenuHintSeen','1');" : ''} localStorage.setItem('board-layout', JSON.stringify(${JSON.stringify(layout)})); true`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/?s=${Date.now()}#/` });
  for (let t = 0; t < 60; t++) {
    await sleep(150);
    if (await ev(`document.querySelectorAll('.wb-cell').length >= ${layout.length}`).catch(() => false)) break;
  }
  // Wait for the board's layout springs to settle (a PC card offered at the
  // front moves every cell): a press aimed at a moving card lands beside it.
  const at = `JSON.stringify([...document.querySelectorAll('.wb-cell')].map((c) => { const r = c.getBoundingClientRect(); return [c.dataset.widget, Math.round(r.x), Math.round(r.y)]; }))`;
  // Settled = the same for four reads in a row (a second): the tower card can
  // join the front of the board a moment after the first paint, and a press
  // aimed at Fan Speed then lands on the card that slid into its place.
  let last = '', same = 0;
  for (let t = 0; t < 60 && same < 4; t++) {
    await sleep(250);
    const now = await ev(at);
    same = now === last ? same + 1 : 0;
    last = now;
  }
}

const COUNT = `(() => {
  const shown = (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  return [...document.querySelectorAll('.wb-cell')].map((c) => {
    const menus = [...c.querySelectorAll('.card-menu')].filter(shown);
    const b = menus[0]?.querySelector('button');
    const label = c.querySelector('.w-label');
    const br = b?.getBoundingClientRect(), lr = label?.getBoundingClientRect();
    return {
      id: c.dataset.widget,
      menus: menus.length,
      name: b?.getAttribute('aria-label') ?? '',
      lineOff: br && lr ? Math.abs(br.top + br.height / 2 - (lr.top + lr.height / 2)) : null,
    };
  });
})()`;

// Where each card's ⋮ sits, measured the way an eye compares it (Cindy 2026-10-08,
// Light Studio · CPU: «the dots don't sit on the title» · «the box sticks out past
// the toggle»). The earlier check compared box centres and passed while the dots
// read 3px low: uppercase letters sit high in their line box. So:
//   corner  — the ⋮'s box from the card's outer top-right corner (same on every card)
//   capMid  — the title letters' middle, from the font's own metrics (baseline − cap height / 2)
//   ctlEnd  — the right end of the toggles / chips under the title (the content edge)
const CORNER = `(() => { const shown = (e) => getComputedStyle(e).display !== 'none'; const ctx = document.createElement('canvas').getContext('2d');
  return [...document.querySelectorAll('.wb-cell')].map((c) => {
    const m = [...c.querySelectorAll('.card-menu')].find(shown); if (!m) return null;
    const b = m.querySelector('button').getBoundingClientRect();
    const card = [...c.children].find((k) => !k.classList.contains('card-menu') && k.getBoundingClientRect().width > 0)?.getBoundingClientRect();
    const out = { id: c.dataset.widget, top: +(b.top - card.top).toFixed(1), right: +(card.right - b.right).toFixed(1), dotsMid: b.top + b.height / 2 };
    const t = c.querySelector('.w-label-text');
    if (t && t.firstChild) {
      const cs = getComputedStyle(t); ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const mm = ctx.measureText(t.textContent.toUpperCase()); const r = document.createRange(); r.selectNodeContents(t); const rr = r.getClientRects()[0];
      const baseline = rr.top + (rr.height - (mm.fontBoundingBoxAscent + mm.fontBoundingBoxDescent)) / 2 + mm.fontBoundingBoxAscent;
      out.capOff = +(out.dotsMid - (baseline - mm.actualBoundingBoxAscent / 2)).toFixed(1);
    }
    const ctl = [...c.querySelectorAll('.ds-toggle, [role=switch], .ds-chip, .ds-badge, .wg-temp')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.top - card.top < 120 && card.right - r.right < 60); // right-aligned ones only
    if (ctl.length) out.ctlOff = +(b.right - Math.max(...ctl.map((r) => r.right))).toFixed(1);
    return out; }).filter(Boolean); })()`;

// ── 1. The default board: device cards + Last Played ─────────────────────────
const DEVICES = [
  { id: 'dev-omen-35l', span: 3, rows: 2 }, { id: 'dev-treehouse', span: 3, rows: 2 }, { id: 'dev-mouse', span: 3, rows: 2 },
  { id: 'dev-monitor', span: 3, rows: 2 }, { id: 'dev-headset', span: 3, rows: 2 }, { id: 'dev-laptop', span: 3, rows: 2 },
  { id: 'lastplayed', span: 4, rows: 2 },
];
await load(DEVICES);
let cells = await ev(COUNT);
check('device board: every card has exactly one ⋮', cells.length > 0 && cells.every((c) => c.menus === 1), cells.filter((c) => c.menus !== 1).map((c) => `${c.id}=${c.menus}`).join(' ') || `${cells.length} cards`);
check('and each ⋮ names its card', cells.every((c) => /^More options for \S/.test(c.name)), cells.map((c) => c.name).join(' | '));
let spots = await ev(CORNER);
// Device cards only: a device card has no header, so its ⋮ takes the symmetric
// corner (TH-463, Chris 2026-10-13). A header card (Last Played) sets its ⋮ a
// step high onto its title's letters — section 2 measures those — so here it
// shares only the right edge.
const devSpots = spots.filter((x) => x.id.startsWith('dev-'));
const odd = (xs) => xs.filter((x) => Math.abs(x.top - devSpots[0].top) > 0.6 || Math.abs(x.right - devSpots[0].right) > 0.6);
check('every device card\u2019s ⋮ sits on the same spot from its corner (the Treehouse 32 card\u2019s own ⋮ included)', devSpots.length > 0 && odd(devSpots).length === 0, odd(devSpots).map((x) => `${x.id} ${x.top}/${x.right}`).join(' ') || `${devSpots[0].top}/${devSpots[0].right}`);
const offEdge = spots.filter((x) => Math.abs(x.right - devSpots[0].right) > 0.6);
check('and every card\u2019s ⋮, header cards too, ends the same distance from its right edge', offEdge.length === 0, offEdge.map((x) => `${x.id} ${x.right}`).join(' ') || `${devSpots[0].right}`);

// A peripheral on a narrow screen: Customize (it carries its controls since
// TH-460), Move to the top, then Remove (Cindy 2026-10-08 — no card's menu is
// Remove alone). The card already first has no Move to the top.
const rowsOf = () => ev(`[...document.querySelectorAll('.card-menu-pop [role=menuitem]')].map((e) => e.textContent.trim()).join(' · ')`);
const firstId = () => ev(`document.querySelector('.wb-grid .wb-cell')?.dataset.widget`);
const first0 = await firstId();
await press(`.wb-cell[data-widget="${first0}"] .card-menu button`);
const firstRows = await rowsOf();
check('the first card\u2019s ⋮ has no Move to the top', !/Move to the top/.test(firstRows), `${first0}: ${firstRows}`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(300);
await press('.wb-cell[data-widget="dev-mouse"] .card-menu button');
const plain = await rowsOf();
check('the mouse card ⋮: Customize, Move to the top, then Remove from Home', plain === 'Customize · Move to the top · Remove from Home', plain);
await press('.card-menu-pop [data-action="to-top"]');
await sleep(600);
check('and Move to the top puts it first on the board', (await firstId()) === 'dev-mouse', await firstId());
await press('.wb-cell[data-widget="dev-mouse"] .card-menu button');
check('and once first, its menu loses only the move', (await rowsOf()) === 'Customize · Remove from Home', await rowsOf());
await press('.card-menu-pop [data-action="remove"]');
check('and Remove from Home takes the card off the board', !(await ev(`!!document.querySelector('.wb-cell[data-widget="dev-mouse"]')`)) && !(await ev(`!!document.querySelector('.card-menu-pop')`)));
await sleep(600);

// The monitor card: its own ⋮ adds Customize; Customize opens the chooser in place.
await press('.wb-cell[data-widget="dev-treehouse"] .ds-devcard.rich .card-menu button');
const rich = await ev(`[...document.querySelectorAll('.card-menu-pop [role=menuitem]')].map((e) => e.textContent.trim()).join(' · ')`);
// With the mouse removed the Treehouse 32 card can be the board's first card
// (the tower has no board card), and the first card has no Move to the top.
const richFirst = (await firstId()) === 'dev-treehouse';
check('the Treehouse 32 card ⋮ opens Customize · (Move to the top unless first ·) Remove from Home', rich === (richFirst ? 'Customize · Remove from Home' : 'Customize · Move to the top · Remove from Home'), `${rich}${richFirst ? ' (first)' : ''}`);
// Treehouse office hour 2026-10-09 (Chris): a separator between what the card holds and what the board does.
const sep = await ev(`(() => { const kids = [...document.querySelector('.card-menu-pop [role=menu]').children]; return kids.map((k) => k.getAttribute('role') === 'menuitem' ? k.dataset.action : (k.matches('[role=separator], .ds-separator, hr') ? '|' : '?')).join(' '); })()`);
check('and a separator between the card\u2019s rows and the board\u2019s', sep === (richFirst ? 'customize | remove' : 'customize | to-top remove'), sep);
const menuAt = await ev(`(() => { const r = document.querySelector('.card-menu-pop').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.right)]; })()`);
await press('.card-menu-pop [data-action="customize"]');
const chooser = await ev(`(() => { const p = document.querySelector('.card-menu-pop[data-view="customize"]'); if (!p) return null; const r = p.getBoundingClientRect(); return { at: [Math.round(r.top), Math.round(r.right)], rows: p.querySelectorAll('[role=menuitemcheckbox], [role=switch]').length }; })()`);
// The panel is Kristy's chooser (her switches, her stores — Chris 2026-10-12),
// so its rows are switches rather than Cindy's menuitemcheckboxes.
check('and Customize swaps in the chooser, in the same place', !!chooser && chooser.rows > 0 && chooser.at.join() === menuAt.join(), JSON.stringify({ menuAt, chooser }));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(300);
check('and Escape closes it', !(await ev(`!!document.querySelector('.card-menu-pop')`)));

// The one-time hint, first visit: one bubble, on the first monitor card only,
// gone for good once its ⋮ has been pressed.
await load(DEVICES, { hintSeen: false });
await sleep(1500);
const hints = await ev(`[...document.querySelectorAll('.card-menu-hint .ds-tooltip-popup.show')].map((e) => e.textContent.trim() + '@' + (e.closest('.wb-cell')?.dataset.widget ?? '?'))`);
const topCard = await ev(`document.querySelector('.wb-cell')?.dataset.widget`);
// Cindy 2026-10-09: the first-visit hint goes on the first card at the top of Home only.
check('first visit: one «Card options are here», on the first card at the top of Home', hints.length === 1 && hints[0] === `Card options are here@${topCard}`, hints.join(' | ') + ` (top = ${topCard})`);
await press(`.wb-cell[data-widget="${topCard}"] .card-menu:not([style*="display: none"]) button`);
await press('body');
const after = await ev(`({ shown: document.querySelectorAll('.card-menu-hint').length, seen: localStorage.getItem('cardMenuHintSeen') })`);
check('and pressing that ⋮ retires it', after.shown === 0 && !!after.seen, JSON.stringify(after));

// ── 2. A board of header widgets ─────────────────────────────────────────────
const WIDGETS = ['fanspeed', 'cpu', 'thermal', 'light', 'storage', 'vitals', 'lighting', 'profile', 'quicklaunch', 'booster', 'omenai', 'power'];
await load(WIDGETS.map((w) => ({ id: w, span: 3, rows: 2 })));
cells = await ev(COUNT);
check('widget board: every card has exactly one ⋮', cells.length === WIDGETS.length && cells.every((c) => c.menus === 1), cells.filter((c) => c.menus !== 1).map((c) => `${c.id}=${c.menus}`).join(' ') || `${cells.length} cards`);
// The header link moved into the ⋮ (Cindy 2026-10-08 «코너에 텍스트 있는 것도 More Option 안에»).
const links = await ev(`document.querySelectorAll('.wb-cell .w-link').length`);
check('no header link left beside the ⋮ — the corner holds the ⋮ alone', links === 0, `${links} links`);
spots = await ev(CORNER);
const low = spots.filter((x) => x.capOff != null && Math.abs(x.capOff) > 1.5);
check('the ⋮\u2019s dots sit on the title\u2019s letters, not below them', low.length === 0, low.map((x) => `${x.id} ${x.capOff}px`).join(' ') || spots.filter((x) => x.capOff != null).map((x) => x.capOff).join(','));
const out_ = spots.filter((x) => x.ctlOff != null && Math.abs(x.ctlOff) > 1.5);
check('the ⋮\u2019s box ends where the toggles and chips under it end', out_.length === 0, out_.map((x) => `${x.id} ${x.ctlOff}px`).join(' ') || spots.filter((x) => x.ctlOff != null).map((x) => `${x.id} ${x.ctlOff}`).join(','));
// On a header card the ⋮ follows its title's letters (a badge beside the title,
// as on Booster, moves the line), so only the right edge is the same everywhere.
const offRight = spots.filter((x) => Math.abs(x.right - spots[0].right) > 0.6);
check('and every card\u2019s ⋮ ends the same distance from its right edge', offRight.length === 0, offRight.map((x) => `${x.id} ${x.right}`).join(' ') || `${spots[0].right}`);
// Open the Fan Speed ⋮ and make sure the menu that opened is ITS menu: the board
// can still slide a card into place after it looks settled (the tower card joins
// the front), and a press then opens the neighbour's menu or none. Two tries.
for (let t = 0; t < 2; t++) {
  await press('.wb-cell[data-widget="fanspeed"] .card-menu button');
  const whose = await ev(`document.querySelector('.card-menu-pop [role=menu]')?.getAttribute('aria-label') ?? ''`);
  if (whose === 'More options for Fan Speed') break;
  if (t === 0) console.log(`   (the board moved under the press — opened «${whose || 'nothing'}», pressing again)`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(600);
}
const w = await ev(`[...document.querySelectorAll('.card-menu-pop [role=menuitem]')].map((e) => e.textContent.trim()).join(' · ')`);
check('a header widget ⋮: its link first, in its own words, then the move, then Remove', /^Fan Control( · Move to the top)? · Remove from Home$/.test(w) && (w.includes('Move to the top') === ((await firstId()) !== 'fanspeed')), w);
const iconOf = () => ev(`(document.querySelector('.card-menu-pop [data-action="open"] use')?.getAttribute('href') || '').replace(/.*#icon-/, '')`);
check('a row that leaves Home wears the «another page» icon ↪ (Fan Control)', (await iconOf()) === 'shortcut', await iconOf());
await press('.card-menu-pop [data-action="open"]');
check('and the link row goes where the link went (Perform)', /perform/.test(await ev('location.hash')), await ev('location.hash'));

// A row that opens a window over Home wears the window icon instead (Cindy 2026-10-09).
await send('Page.navigate', { url: `http://localhost:${PORT}/#/` });
await sleep(1500);
await press('.wb-cell[data-widget="profile"] .card-menu button');
check('a row that opens a window over Home wears the «window» icon (Active Profile → Manage)', (await iconOf()) === 'browser', await iconOf());

// ── 3. The wide Home (1600px+): the same rows, and nothing about a carousel ──
// («Move beside the carousel» / «Move back to the board» were rows here while
// the carousel had slots, TH-440 → TH-463; the slots went when the board grew
// by whole columns instead, 2026-10-21.)
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1100, deviceScaleFactor: 1, mobile: false });
await load(DEVICES);
check('wide Home: ten columns', (await ev(`getComputedStyle(document.querySelector('.wb-grid')).gridTemplateColumns.split(' ').length`)) === 10);
// The mouse card's own ⋮ is the visible one (the board's steps aside).
await press('.wb-cell[data-widget="dev-mouse"] .card-menu:not(.wb-card-menu) button');
const wide = await ev(`[...document.querySelectorAll('.card-menu-pop [role=menuitem]')].map((e) => e.textContent.trim()).join(' · ')`);
check('wide Home: the ⋮ ends in Remove and names no carousel', /Remove from Home$/.test(wide) && !/carousel|back to the board/i.test(wide), wide);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(300);
await press('.wb-cell[data-widget="dev-treehouse"] .ds-devcard.rich .card-menu button');
const richWide = await ev(`[...document.querySelectorAll('.card-menu-pop [role=menuitem]')].map((e) => e.textContent.trim()).join(' · ')`);
check('the Treehouse 32 card on a wide screen: Customize, the move, then Remove', /^Customize( · Move to the top)? · Remove from Home$/.test(richWide), richWide);

ws.close();
console.log(fails ? `\n✗ ${fails} failed` : '\nALL PASS');
process.exit(fails ? 1 : 0);

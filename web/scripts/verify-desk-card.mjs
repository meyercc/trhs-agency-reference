// Regression checks for the Personalize → Display DESK card (`DeskWidget`).
//
// Why this file exists: the card had NO automated checks at all (2026-08-20,
// grep of design-assets/regression-invariants.md), and on that day it stopped
// drawing its own schematic and started drawing the monitor hero's renders. The
// invariants below are the ones that swap put at risk — the physical ruler, the
// stage it has to stay inside, the writing's floor size, and the card's own verb
// (a tile hands the keyboard to a computer; it does not open a device window).
//
// Run: dev server on :5194, headless Chrome on :9231, from web/.
// ⚠️ Launch that Chrome WITH software WebGL — `--headless=new --use-angle=swiftshader
//   --enable-unsafe-swiftshader` — and WITHOUT `--disable-gpu`. Personalize hosts Light
//   Studio (three.js); when no WebGL context can be made the renderer throws and the
//   whole React root unmounts, so every check here reads an empty page (2026-09-13).
//   node scripts/verify-desk-card.mjs
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

const PORT = process.env.PORT || '5194';
const CDP = process.env.CDP || '9231';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
const pend = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++msgId; pend.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });

// `[].every(...)` is true. A check that reads 0 tiles would pass on an empty
// desk — the stacked-desk collision check did, next to three honest failures
// that read the same 0 tiles (2026-09-23). Every "all of them" check here goes
// through this, so reading nothing is a failure, not a pass.
const allOf = (xs, f) => xs.length > 0 && xs.every(f);

let n = 0;
/**
 * Wait for the app to be ON SCREEN instead of sleeping a guessed number of ms.
 *
 * The fixed `sleep(3600)` this replaces was tuned against a warm dev server. On
 * a cold one — a server started for this run, which is the normal case in a
 * worktree — Vite still has the module graph to transform, `#root` is empty
 * when the checks start, and every card reads as missing. That produced two
 * false failures on 2026-09-01, one of which was nearly reported as a
 * regression in the code under test. A rail that fails for a reason unrelated
 * to the thing it guards is worse than no rail: it teaches you to discount it.
 *
 * Same shape as `verify-device-button.mjs`'s own waitFor (rule 15), and it
 * still returns rather than throwing, so a genuinely blank page fails on the
 * check that cares rather than here.
 */
async function waitForApp(timeoutMs = 20000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    const ready = await ev(`!!(document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild)`);
    if (ready) {
      // One more frame for the layout effects that measure and re-place cards.
      await sleep(250);
      return true;
    }
    await sleep(100);
  }
  return false;
}

const open = async () => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${++n}#/personalize` });
  await waitForApp();
};

const MEASURE = `(() => {
  const stage = document.querySelector('.dov-stage');
  if (!stage) return { err: 'no .dov-stage' };
  const sr = stage.getBoundingClientRect();
  const group = document.querySelector('.dov-group');
  const fit = group ? +(new DOMMatrixReadOnly(getComputedStyle(group).transform).a).toFixed(3) : null;
  const tiles = {};
  document.querySelectorAll('.dov-disp').forEach((el) => {
    const name = el.querySelector('.dov-name');
    const box = el.querySelector('.dov-shot') || el.querySelector('.dov-slab');
    if (!name || !box) return;
    const b = box.getBoundingClientRect(), nr = name.getBoundingClientRect();
    tiles[name.textContent.trim()] = {
      w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      inStageX: b.left >= sr.left - 0.5 && b.right <= sr.right + 0.5,
      writingInStage: nr.bottom <= sr.bottom + 0.5,
      nameSize: getComputedStyle(name).fontSize,
    };
  });
  return {
    stage: { w: +sr.width.toFixed(1), h: +sr.height.toFixed(1) }, fit, tiles,
    rendersLoaded: [...document.querySelectorAll('.dov-render')].every((i) => i.naturalWidth > 0),
    renderCount: document.querySelectorAll('.dov-render').length,
  };
})()`;

// The writing's DRAWN height, not its CSS size: on a shrinking desk the two part
// company, and only the drawn one is what a person has to read. Plus which side
// of its tile each caption is on, and whether the two ever touch.
const WRITING = `(() => {
  const out = { names: {}, worstDrawn: Infinity, collisions: [] };
  const els = [...document.querySelectorAll('.dov-disp')];
  els.forEach((el) => {
    const n = el.querySelector('.dov-name');
    const shot = el.querySelector('.dov-shot') || el.querySelector('.dov-slab');
    if (!n || !shot) return;
    const nr = n.getBoundingClientRect(), sr = shot.getBoundingClientRect();
    const drawn = +nr.height.toFixed(1);
    out.names[n.textContent.trim()] = {
      css: getComputedStyle(n).fontSize, drawn,
      side: nr.bottom <= sr.top + 1 ? 'above' : nr.top >= sr.bottom - 1 ? 'below' : 'over',
      up: el.classList.contains('label-up'),
    };
    out.worstDrawn = Math.min(out.worstDrawn, drawn);
  });
  // A caption must never land on another tile's hardware.
  els.forEach((a) => {
    const n = a.querySelector('.dov-name');
    if (!n) return;
    const nr = n.getBoundingClientRect();
    els.forEach((b) => {
      if (a === b) return;
      const s = b.querySelector('.dov-shot') || b.querySelector('.dov-slab');
      if (!s) return;
      const br = s.getBoundingClientRect();
      if (nr.right > br.left + 0.5 && nr.left < br.right - 0.5 && nr.bottom > br.top + 0.5 && nr.top < br.bottom - 0.5)
        out.collisions.push(n.textContent.trim() + ' on ' + (b.querySelector('.dov-name')?.textContent.trim() || '?'));
    });
  });
  return out;
})()`;

// ── 1. one-row desk: the physical ruler, drawn ──
await open();
// `deskDevices` is set EXPLICITLY, not assumed. It is shared browser state, so
// anything run against this profile earlier (a probe, another suite) can leave
// it at 2 and this section then measures a two-screen desk while asserting a
// three-screen one — a false failure that looks like a product bug (2026-09-04).
await ev(`localStorage.removeItem('displayArrange'); localStorage.removeItem('kvm'); localStorage.setItem('deskDevices','${DESK(3, 2)}');`);
await open();
const a = await ev(MEASURE);
check('renders load (3 of them)', a.rendersLoaded && a.renderCount === 3, `${a.renderCount} imgs`);
// Same numbers photoTile reports, i.e. the hero's ruler: width from the
// hardware's real width, floored at 90 so the laptop stays grabbable.
// `MacBook` again since 2026-09-21 (Cindy) — from 09-01 to 09-21 this card
// captioned the laptop `Built-in Display` (SPEC: desk-stage §7); the hardware
// pictures now use the name every other surface uses for that laptop.
// Since 2026-09-13 the card draws the desk to fill its column (`.pg-rail-fill`),
// so the tiles are the hero's ruler SCALED by one factor, not the hero's pixels:
// what must hold is the proportion (a 32" is wider than a 27" by the same ratio
// on both surfaces) and that the factor is ≥ 1 (never shrunk).
const EXPECT = { 'Treehouse 32': [132, 98], 'OMEN OLED 27': [113, 74], MacBook: [90, 67] };
const ref = a.tiles['Treehouse 32'];
const k = ref ? ref.w / EXPECT['Treehouse 32'][0] : 0;
check(`the desk is drawn at one factor of the hero's ruler, ≥ 1× (${k.toFixed(3)})`, k >= 0.999, `k=${k.toFixed(3)}`);
for (const [nm, [w, h]] of Object.entries(EXPECT)) {
  const t = a.tiles[nm];
  check(`${nm} keeps the hero's proportion (${w}×${h} × k)`,
    !!t && Math.abs(t.w - w * k) <= 1.5 && Math.abs(t.h - h * k) <= 1.5, t ? `${t.w}×${t.h}` : 'missing');
}
check('a 32" is wider than a 27" is wider than a laptop',
  a.tiles['Treehouse 32'].w > a.tiles['OMEN OLED 27'].w && a.tiles['OMEN OLED 27'].w > a.tiles.MacBook.w);
check('nothing clipped by the stage', allOf(Object.values(a.tiles), (t) => t.inStageX && t.writingInStage));
check('writing is 11px (the scale floor, not the desk zoom)',
  allOf(Object.values(a.tiles), (t) => parseFloat(t.nameSize) >= 11), Object.values(a.tiles).map((t) => t.nameSize).join(' '));
check('one-row desk is drawn at full size or larger — never shrunk', a.fit >= 1, `fit=${a.fit}`);
const wa = await ev(WRITING);
check('one-row: writing is drawn at full size (>= 13px line)', wa.worstDrawn >= 13, `worst ${wa.worstDrawn}px`);
check('one-row: every caption hangs below its tile',
  allOf(Object.values(wa.names), (n) => n.side === 'below' && !n.up));
// 2026-09-13 (Cindy): the DESK card takes the rail's height — two columns end
// together, the Ng3 panel's rule — and the desk is drawn to fill it (centred,
// ≥ 1×) instead of sitting above a band of air. This check used to pin the stage
// at its authored 248px, and with it 73px of air under a one-row desk.
const fill = await ev(`(() => {
  const rail = document.querySelector('.pg-rail');
  const bottoms = [...rail.children].map((k) => Math.round(k.getBoundingClientRect().bottom));
  const sr = document.querySelector('.dov-stage').getBoundingClientRect();
  const nb = Math.max(...[...document.querySelectorAll('.dov-name')].map((n) => n.getBoundingClientRect().bottom));
  // The keyboard·mouse badge above the Treehouse 32 is part of the drawing
  // (2026-09-21 — it had been cut off because nothing reserved its room), so the
  // top of the desk is the top of the badge when there is one.
  const ht = Math.min(...[...document.querySelectorAll('.dov-shot, .dov-slab, .dov-io-pill')].map((n) => n.getBoundingClientRect().top));
  const fit = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.dov-group')).transform).a;
  return { bottoms, stageH: Math.round(sr.height), gapAbove: Math.round(ht - sr.top), gapBelow: Math.round(sr.bottom - nb), fit: +fit.toFixed(2) };
})()`);
check('two columns end together — the DESK card takes the rail\'s height', Math.abs(fill.bottoms[0] - fill.bottoms[1]) <= 1,
  fill.bottoms.join(' vs '));
check('and the desk fills it — centred, drawn at ≥ 1×, no band of air',
  Math.abs(fill.gapAbove - fill.gapBelow) <= 6 && fill.fit >= 1, `above ${fill.gapAbove} / below ${fill.gapBelow} / fit ${fill.fit} / stage ${fill.stageH}`);
check('one-row: no caption sits on another tile', Object.keys(wa.names).length > 0 && wa.collisions.length === 0, wa.collisions.join(', '));

// ── 2. the card's verb: a tile hands over the keyboard ──
await ev(`localStorage.setItem('kvm', JSON.stringify({ configured: true, activePc: 'pc1' }))`);
await open();
const before = await ev(`JSON.parse(localStorage.kvm).activePc`);
await ev(`document.querySelector('.d-slab').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
await sleep(400);
const after = await ev(`JSON.parse(localStorage.kvm).activePc`);
check('clicking a tile switches the active computer (not opening a window)',
  before === 'pc1' && after === 'pc2', `${before} → ${after}`);
check('the desk map does not navigate away',
  (await ev(`location.hash.includes('personalize')`)) === true);

// ── 3. KVM state: one fact, two marks — the pill and the accent (2026-09-13) ──
// Until 2026-09-13 this section guarded a `KVM` tag on the render and a
// computer-name chip under it. Cindy's review of the page counted the same fact
// ("which computer does the keyboard reach") drawn five times on one card and
// kept the two that need no words: the gear pill (its home = §"always has a
// home" below) and the accent on the active computer's name. The footer row
// that replaced three sentences states its value closed (`Gear Switch · <name>
// ›`) and opens the Gear Switch card, where setup and explanation live.
const kvmMark = await ev(`(() => {
  const names = [...document.querySelectorAll('.dov-name')];
  const accent = names.filter((n) => getComputedStyle(n).color === 'rgb(0, 120, 215)').map((n) => n.textContent.trim());
  const foot = document.querySelector('.dov-gear');
  const val = foot && foot.querySelector('.dov-gear-val');
  return { tags: document.querySelectorAll('.dov-tag, .dov-kvm-chip, .dov-kvm-slot').length,
    accent, pill: !!document.querySelector('.d-tree .gear-pill, .d-tree [class*="gear"]'),
    footIsButton: !!foot && foot.tagName === 'BUTTON', footLabel: foot && foot.firstElementChild.textContent.trim(),
    footValue: val && val.textContent.trim(), footRows: foot ? Math.round(foot.getBoundingClientRect().height) : 0,
    towerName: document.querySelector('.d-slab .dov-name')?.textContent.trim() || null };
})()`);
check('KVM engaged: no tag on the render and no chip under the name — the fact is the pill + the accent',
  kvmMark.tags === 0, `${kvmMark.tags} tag(s)`);
check('exactly one name wears the accent, and it is the computer holding the keyboard',
  kvmMark.accent.length === 1 && kvmMark.accent[0] === kvmMark.towerName, kvmMark.accent.join(','));
check('the footer is one library row (`.wg-foot`) that is a button, labelled Gear Switch',
  kvmMark.footIsButton && kvmMark.footLabel === 'Gear Switch', String(kvmMark.footLabel));
check('closed, the row states its value: the active computer', kvmMark.footValue === kvmMark.towerName,
  `${kvmMark.footValue} vs ${kvmMark.towerName}`);
check('and it is one line, not a paragraph', kvmMark.footRows > 0 && kvmMark.footRows <= 28, `${kvmMark.footRows}px`);
// Not configured with two computers → the row invites setup. One computer → NO
// row (2026-09-21, Cindy: "기어 스위치는 컴퓨터가 두 대 이상 있어야 되는 거
// 아니니?") — retired: the `With a second PC` condition line, which stays only in
// the monitor window's Connectivity tab.
await ev(`localStorage.removeItem('kvm');`);
await open();
check('Gear Switch not set up: the row says `Set up`',
  (await ev(`document.querySelector('.dov-gear-val')?.textContent.trim()`)) === 'Set up');
await ev(`localStorage.setItem('deskDevices','${DESK(3, 1)}');`);
await open();
check('one computer: there is no Gear Switch row at all',
  (await ev(`!document.querySelector('.dov-gear') && !/with a second PC/i.test(document.body.innerText)`)) === true);
await ev(`localStorage.setItem('deskDevices','${DESK(3, 2)}');`);

// ── 4. a stacked desk still fits, and the desk shrinks rather than the stage ──
await ev(`localStorage.removeItem('kvm');`);
await open();
await ev(`(() => {
  const stage = document.querySelector('.dov-stage');
  // Fractions are of the AUTHORED box (--dov-vref), not the live stage — the
  // stage stopped being 248px on 2026-09-13 (it fills its column), and dividing
  // by the live height silently widened this 6px gap to 24px.
  const vref = parseFloat(getComputedStyle(stage).getPropertyValue('--dov-vref')) || 248;
  // Drawn height ÷ the group's zoom = the AUTHORED height the fraction needs.
  const zoom = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.dov-group')).transform).a || 1;
  const h = (id) => document.querySelector(id).querySelector('.dov-shot').getBoundingClientRect().height / zoom;
  // The OMEN's own height sets its top: it used to borrow the Treehouse's (98 vs
  // 74), which made this "6px gap" a 30px one — wide enough to fit a caption once
  // the caption reserve dropped to its true 19px (2026-09-13), so nothing flipped.
  const omenH = h('.d-omen');
  const pos = {
    'treehouse-32': { left: 0.42, top: 0.5 },
    'oled-27': { left: 0.43, top: 0.5 - (omenH + 6) / vref },
    'builtin': { left: 0.06, top: 0.55 },
  };
  localStorage.setItem('displayArrange', JSON.stringify({ mode: 'extend', positions: pos, space: 'fraction' }));
})()`);
await open();
const b = await ev(MEASURE);
check('a stacked desk still fits inside the stage',
  allOf(Object.values(b.tiles), (t) => t.inStageX && t.writingInStage), `fit=${b.fit}`);
// The invariant that changed on 2026-08-20: the CARD gives up height so the DESK
// does not give up size — and so the writing does not give up legibility.
// Since 2026-09-13 the stage already fills its column, so a stack may fit without
// the card growing; what must hold is that the desk is never SHRUNK to fit.
check('stacked: the desk is not shrunk to fit — stage no shorter than before, fit ≥ 1',
  b.stage.h >= a.stage.h - 1 && b.fit >= 1, `${a.stage.h} → ${b.stage.h}px, fit=${b.fit}`);
const wb = await ev(WRITING);
check('stacked: writing is STILL drawn at full size (>= 13px line)', wb.worstDrawn >= 13, `worst ${wb.worstDrawn}px`);
// A stack saved in the Arrange window is drawn standing on the desk in one row
// (2026-09-24, Cindy «응» — the 32" lifted over the 27" with its name across the
// 27"'s screen). So nothing wears its name above any more: every caption hangs
// below its own tile, the same as a one-row desk.
check('stacked save: the desk picture stands in one row — every caption below, none raised',
  Object.keys(wb.names).length > 0 && Object.values(wb.names).every((n) => n.side === 'below' && !n.up),
  Object.entries(wb.names).map(([k, v]) => `${k}:${v.side}${v.up ? '(up)' : ''}`).join(' · '));
check('stacked: no caption sits on another tile', Object.keys(wb.names).length > 0 && wb.collisions.length === 0, wb.collisions.join(', '));

// ── 5. mirror ──
await ev(`localStorage.setItem('displayArrange', JSON.stringify({ mode: 'mirror', positions: {}, space: 'fraction' }))`);
await open();
check('mirror still says so once, on the stage',
  (await ev(`!!document.querySelector('.dsa-mirror-badge')`)) === true);

// ── 6. Dragging: this card authors the GAPS (2026-08-21) ──
// The gap is the content — how far apart the monitors stand is what decides where
// the under-glow pools (Cindy). So what is checked is not how far one tile
// travelled on screen (the desk re-centres on release, so that number is smaller
// by design) but whether the SPACING the user authored changed and survived.
await ev(`localStorage.clear()`);
await open();
await ev(`document.querySelector('.dov-stage').scrollIntoView({ block: 'center' })`);
await sleep(400);
const GAP = `(() => {
  const b = (s) => document.querySelector(s).getBoundingClientRect();
  return +(b('.d-mac .dov-shot').left - b('.d-omen .dov-shot').right).toFixed(1);
})()`;
const gapBefore = await ev(GAP);
const grabAt = await ev(`(() => { const r = document.querySelector('.d-omen .dov-shot').getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, x: r.x }; })()`);
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', {
  type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse',
});
await mouse('mousePressed', grabAt.cx, grabAt.cy);
for (let i = 1; i <= 10; i++) await mouse('mouseMoved', grabAt.cx + 9 * i, grabAt.cy);
await sleep(250);
// Trap (a): the tile must follow the pointer WHILE dragging. Centring is computed
// from the positions, so without a freeze the group slid back as fast as the tile
// moved — measured 2026-08-20 at 4px of net travel for a 90px drag, which Cindy
// read as "드래그했는데 아예 안 움직인다".
const during = await ev(`+document.querySelector('.d-omen .dov-shot').getBoundingClientRect().x.toFixed(1)`);
// Reversed 2026-09-01: this card SHOWS the desk and the `Arrange` window edits
// it (Cindy). Dragging here was the second editor against our own "one editor"
// call, and it carried three faults measured that day — a tile meaning two
// things behind a 4px threshold, no keyboard path at all, and touch scrolling
// the page instead of the tile. So the assertion flips: a press that travels
// must move NOTHING.
check('a press that travels moves nothing — this card is not an editor',
  Math.abs(during - grabAt.x) < 4, `moved ${(during - grabAt.x).toFixed(1)}px`);
await mouse('mouseReleased', grabAt.cx + 90, grabAt.cy);
await sleep(700);
const gapAfter = await ev(GAP);
check('and the layout is untouched by it', Math.abs(gapBefore - gapAfter) < 2, `${gapBefore} → ${gapAfter}`);
// Trap (b): the same tile is also the switch for that computer. Finishing a drag
// must not be read as a click — `CLICK_SLOP` is the monitor window's own 4px.
check('releasing that press does NOT switch computers either',
  (await ev(`localStorage.getItem('kvm')`)) === null);
await open();
await ev(`document.querySelector('.dov-stage').scrollIntoView({ block: 'center' })`);
await sleep(400);
check('the gap survives a reload', Math.abs((await ev(GAP)) - gapAfter) < 2);
// And a plain click still does its old job.
await ev(`localStorage.setItem('kvm', JSON.stringify({ configured: true, activePc: 'pc1' }))`);
await open();
await ev(`document.querySelector('.dov-stage').scrollIntoView({ block: 'center' })`);
await sleep(400);
const slab = await ev(`(() => { const r = document.querySelector('.d-slab .dov-slab').getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; })()`);
await mouse('mousePressed', slab.cx, slab.cy);
await mouse('mouseReleased', slab.cx, slab.cy);
await sleep(500);
check('a click with no travel still switches the computer',
  /pc2/.test(String(await ev(`localStorage.getItem('kvm')`))));

await ev(`localStorage.removeItem('displayArrange'); localStorage.removeItem('kvm');`);
// ── The PCs axis reaches the desk picture (2026-09-02) ───────────────────────
// It did not. Cindy: "모니터는 1,2,3대 별로 디바이스 이미지 잘 뜨는데, 컴퓨터
// 1,2대는 안 뜨거든." Measured that day: `PCs 1` and `PCs 2` produced an
// identical DESK card — same tiles, the Gaming Laptop slab still there, the KVM
// chips still there, and a sentence still offering to switch between computers
// on a desk with one. `pcCount` was read by the Connectivity tab and by nothing
// that draws.
// Which computer leaves is not a new decision: the app numbers them pc1 =
// MacBook and pc2 = Gaming Laptop wherever the keyboard is routed, and Gear
// Switch is already locked behind `pcCount < 2`.
// The second computer's name, from the SKU the app reads — so a rename cannot
// silently turn these checks into assertions about a string nobody ships.
const pc2Name = await ev(`document.querySelector('.d-slab .dov-name')?.textContent.trim() || null`) || 'OMEN 35L';

for (const pcs of [1, 2]) {
  await ev(`localStorage.setItem('deskDevices','${DESK(3, pcs)}')`);
  await ev(`localStorage.removeItem('kvm')`);
  await open();
  await ev(`document.querySelector('.dov-stage')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  const desk = await ev(`(() => {
    const c = [...document.querySelectorAll('.w')].find((x) => /^DESK/m.test(x.innerText));
    if (!c) return null;
    return {
      names: [...c.querySelectorAll('.dov-disp')].map((e) => e.querySelector('.dov-name')?.textContent.trim()),
      slab: !!c.querySelector('.d-slab'),
      chips: c.querySelectorAll('.dov-tag').length,
      offersSwitch: /switch between computers|click a computer to switch/.test(c.innerText),
      namesCondition: /with a second PC/i.test(c.innerText),
      gearValue: c.querySelector('.dov-gear-val')?.textContent.trim() || null,
    };
  })()`);
  if (!desk) { check(`PCs ${pcs}: the desk card renders`, false); continue; }
  if (pcs === 1) {
    // Compared against what the app itself calls its second computer, not a
    // literal — the name lives in the SKU (`gearSwitch.hosts`) and changed on
    // 2026-09-03 when the sample became a desktop (2026-09-03).
    check('PCs 1: the second computer is not on the desk', !desk.slab && !desk.names.includes(pc2Name),
      desk.names.join(' / '));
    check('PCs 1: no KVM chip, because there is nothing to switch', desk.chips === 0, String(desk.chips));
    check('PCs 1: and nothing offers a switch or advertises a second PC',
      !desk.offersSwitch && !desk.namesCondition && !desk.gearValue);
  } else {
    check('PCs 2: the second computer is back', desk.slab && desk.names.includes(pc2Name),
      desk.names.join(' / '));
    // No chips in either state since 2026-09-13 — the fact they carried (which
    // computer the keyboard reaches) is the gear pill + the accent name now.
    check('PCs 2: still no chip — the pill and the accent carry it', desk.chips === 0, String(desk.chips));
    check('PCs 2: the footer row offers setup instead of a sentence', !desk.offersSwitch && desk.gearValue === 'Set up',
      String(desk.gearValue));
  }
}
await ev(`localStorage.setItem('deskDevices','${DESK(3, 2)}')`);

// ── The clamshell stands beside the desk, not on it (2026-09-03) ─────────────
// Cindy's screenshot: on a hand-saved two-display row with the Treehouse 32 on
// the LEFT, the Gaming Laptop slab was drawn on top of the Built-in Display —
// artwork over artwork and both captions in the same place. Cause: the slab is
// the one box on this desk with no saved position, so it sat at a FIXED offset
// from the monitor it feeds while every screen around it was spaced by a rule.
// `slabPlacement` (devices/arrangement.ts) gives it the same duty of care: the
// authored side first, the anchor's other side next, in front of the desk last.
//
// Both halves are checked — the pictures AND the names, because a caption
// landing on another caption is the same defect and the eye reads it first.
const DESK_LAYOUTS = [
  { tag: 'default row', disp: 3, saved: null },
  { tag: 'default, two screens', disp: 2, saved: null },
  // The exact shape from the report: the anchor on the left, a screen sitting
  // where the slab is authored to stand.
  { tag: 'saved row, Treehouse 32 on the left', disp: 2,
    saved: { 'treehouse-32': { left: 0.0357, top: 0.1613 }, builtin: { left: 0.2872, top: 0.2097 } } },
  { tag: 'saved row of three, Treehouse 32 on the left', disp: 3,
    saved: { 'treehouse-32': { left: 0.0357, top: 0.1613 }, builtin: { left: 0.2872, top: 0.2097 },
             'oled-27': { left: 0.49, top: 0.1613 } } },
];
const BOXES = `(() => {
  const stage = document.querySelector('.dov-stage'); if (!stage) return null;
  const b = stage.getBoundingClientRect();
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height }; };
  return [...stage.querySelectorAll('.dov-disp')].map((el) => ({
    name: el.querySelector('.dov-name')?.textContent.trim() ?? '?',
    art: rect(el.querySelector('.dov-shot, .dov-slab') ?? el),
    label: el.querySelector('.dov-name') ? rect(el.querySelector('.dov-name')) : null,
  }));
})()`;
const hits = (a, b) => a && b && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0
  && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
for (const L of DESK_LAYOUTS) {
  await ev(`localStorage.setItem('deskDevices','${DESK(L.disp)}')`);
  await ev(L.saved
    ? `localStorage.setItem('displayArrange', JSON.stringify({ space: 'fraction', mode: 'extend', positions: ${JSON.stringify(L.saved)} }))`
    : `localStorage.removeItem('displayArrange')`);
  await open();
  await ev(`document.querySelector('.dov-stage')?.scrollIntoView({ block: 'center' })`);
  await sleep(600);
  const tiles = await ev(BOXES);
  if (!tiles) { check(`${L.tag}: the desk draws`, false); continue; }
  const pairs = [];
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++) {
      if (hits(tiles[i].art, tiles[j].art)) pairs.push(`${tiles[i].name} × ${tiles[j].name} (picture)`);
      if (hits(tiles[i].label, tiles[j].label)) pairs.push(`${tiles[i].name} × ${tiles[j].name} (name)`);
    }
  check(`${L.tag}: nothing on the desk is drawn on top of anything else`, pairs.length === 0, pairs.join(', '));
  // The computer is found by the name the APP ships (`pc2Name`, read off the
  // screen above), not by a literal. These checks were written on 2026-09-03
  // against "Gaming Laptop" and were the sixteenth place that string lived —
  // the very duplication the tower commit removed, which is why they all went
  // `missing` the moment the sample became a desktop.
  const slab = tiles.find((t) => t.name === pc2Name);
  // The computer STANDS, so its bottom is the desk's floor line (SPEC:
  // desk-stage rule 1). Asserted only where the screens are floor-anchored —
  // i.e. the layouts with nothing saved.
  //
  // ⚠️ Do NOT define the floor as "the lowest screen". A SAVED layout puts
  // screens at whatever heights were stored, so they float above the surface
  // while the computer correctly stands on it: measured 2026-09-04 on the
  // saved-row fixture, Built-in ends at 134 and Treehouse at 153 while the
  // computer sits at 161 — which IS the floor (146 authored + the 15px the
  // grown stage offsets every tile by). Reading the screens as the floor made
  // the computer look 8px low when nothing was wrong with it.
  const floorAnchored = !L.saved;
  const deskFloor = Math.max(...tiles.filter((t) => t !== slab).map((t) => t.art.y + t.art.h));
  check(`${L.tag}: the computer is on the desk${floorAnchored ? ", on the screens' floor line" : ' and inside the stage'}`,
    !!slab && slab.art.x >= -1 && slab.art.y >= -1
      && (!floorAnchored || Math.abs(slab.art.y + slab.art.h - deskFloor) <= 1),
    slab ? `${Math.round(slab.art.x)},${Math.round(slab.art.y)}${floorAnchored ? ` · floor ${Math.round(deskFloor)} vs ${Math.round(slab.art.y + slab.art.h)}` : ''}` : 'missing');
}
// The default desk is the one picture that must not have moved: the slab keeps
// its authored place to the right of the Treehouse 32.
await ev(`localStorage.removeItem('displayArrange'); localStorage.setItem('deskDevices','${DESK(3, 2)}')`);
await open();
await ev(`document.querySelector('.dov-stage')?.scrollIntoView({ block: 'center' })`);
await sleep(600);
const home = await ev(BOXES);
const tree = home?.find((t) => t.name === 'Treehouse 32');
const clam = home?.find((t) => t.name === pc2Name);
// Written 2026-09-03 as `y === 127`, which was the CLAMSHELL's hanging top and
// broke the moment the sample became a tower (2026-09-04). The intent was never
// that number — it was "the resolver leaves the default desk alone" — so it is
// stated as the physical fact instead: the computer stands on the desk, on the
// same floor line as every screen (SPEC: desk-stage rule 1), to the right of the
// monitor it feeds. Tolerance 1px since 2026-09-04: the tower used to land 2px
// low because its 1px border sat OUTSIDE the 73px `towerTile()` height — fixed
// with `box-sizing` on `.dov-slab`. Drawn box == computed box now, so this is
// exact and a future 2px drift is a failure, not a rounding shrug.
const floor = tree ? tree.art.y + tree.art.h : 0;
check('the default desk is untouched — the computer still stands on the desk, right of the Treehouse 32',
  !!tree && !!clam && clam.art.x > tree.art.x + tree.art.w && Math.abs(clam.art.y + clam.art.h - floor) <= 1,
  clam ? `x ${Math.round(clam.art.x)} · floor ${Math.round(floor)} vs ${Math.round(clam.art.y + clam.art.h)}` : 'missing');
await ev(`localStorage.removeItem('displayArrange')`);

// ── The keyboard & mouse mark always has a home (2026-09-09) ────────────────
// It did not. The card used to draw this from its own binary — one pill glued
// to the laptop tile, another to the monitor, switched by the `is-kvm` root —
// so on a desk whose only computer is the tower, with Gear Switch off, BOTH
// were gone: measured that day as one pill in the DOM and none visible. The
// picture said nothing about where the keyboard was.
// The card now reads `deskGear()` (the same `hub`/`direct` model the Gear
// Switch card uses), and a home always exists because the Treehouse 32 never
// leaves the desk. Nothing here asserts WHICH tile — that follows the SKU, and
// pinning it would be the kind of check that outlives its decision.
for (const [tag, devices, kvm] of [
  ['every device', null, { configured: true, activePc: 'pc1' }],
  ['KVM engaged', null, { configured: true, activePc: 'pc2' }],
  ['tower alone, Gear Switch off', ['tower'], { configured: false, activePc: 'pc2' }],
  ['laptop alone', ['macbook'], { configured: false, activePc: 'pc1' }],
]) {
  await ev(devices
    ? `localStorage.setItem('deskDevices','${JSON.stringify(devices)}')`
    : `localStorage.removeItem('deskDevices')`);
  await ev(`localStorage.setItem('kvm', '${JSON.stringify(kvm)}')`);
  await open();
  await ev(`document.querySelector('.dov-stage')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  const seen = await ev(`(() => {
    const c = [...document.querySelectorAll('.w')].find((x) => /^DESK/m.test(x.innerText));
    if (!c) return null;
    const pills = [...c.querySelectorAll('.dov-io-pill')]
      .filter((p) => getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().width > 0);
    return { n: pills.length,
             on: pills.map((p) => p.closest('.dov-disp')?.querySelector('.dov-name')?.textContent.trim()),
             glyphs: pills.reduce((a, p) => a + p.querySelectorAll('svg').length, 0) };
  })()`);
  if (!seen) { check(`${tag}: the desk card renders`, false); continue; }
  // With two computers the mark is news (which computer the keyboard reaches);
  // with one it said the same thing on every desk, so since 2026-09-21 it is
  // drawn only on a two-computer desk (DeskWidget `GearPill`, `.two-pc`).
  const twoPcs = !devices || (devices.includes('macbook') && devices.includes('tower'));
  if (twoPcs) {
    check(`${tag}: the keyboard & mouse mark is somewhere on the desk`,
      seen.n >= 1 && seen.glyphs >= 1, `${seen.n} mark(s) on ${seen.on.join(', ') || '—'}`);
  } else {
    check(`${tag}: one computer — no keyboard & mouse mark`, seen.n === 0, `${seen.n} mark(s)`);
  }
}
await ev(`localStorage.removeItem('deskDevices'); localStorage.removeItem('kvm');`);

// ── A chosen end wins over the app's guess (2026-09-10) ─────────────────────
// Until today nothing in the app let a person say where their computer stands:
// `slabPlacement` picked a side and quietly moved it whenever a screen was in
// the way. The `Arrange` window now writes `displayArrange.computers.tower`,
// and the desk picture has to honour it — including when the guess would have
// chosen otherwise, which is the whole point of it being an answer rather than
// another candidate.
for (const side of ['left', 'right']) {
  await ev(`localStorage.removeItem('deskDevices')`);
  await ev(`localStorage.setItem('displayArrange', JSON.stringify({ mode: 'extend', space: 'fraction', positions: {}, computers: { tower: '${side}' } }))`);
  await open();
  await ev(`document.querySelector('.dov-stage')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  const got = await ev(`(() => {
    const c = [...document.querySelectorAll('.w')].find((x) => /^DESK/m.test(x.innerText));
    const slab = c && c.querySelector('.d-slab');
    const screens = c ? [...c.querySelectorAll('.dov-disp:not(.d-slab)')] : [];
    if (!slab || !screens.length) return null;
    const s = slab.getBoundingClientRect();
    const l = Math.min(...screens.map((e) => e.getBoundingClientRect().left));
    const r = Math.max(...screens.map((e) => e.getBoundingClientRect().right));
    return { leftOfAll: s.right <= l + 1, rightOfAll: s.left >= r - 1,
             x: Math.round(s.left), screensL: Math.round(l), screensR: Math.round(r) };
  })()`);
  if (!got) { check(`computer set to the ${side} end: the card renders it`, false); continue; }
  check(`the computer stands at the ${side} end because that is what was chosen`,
    side === 'left' ? got.leftOfAll : got.rightOfAll,
    `tower x ${got.x} · screens ${got.screensL}–${got.screensR}`);
}
await ev(`localStorage.removeItem('displayArrange'); localStorage.removeItem('deskDevices');`);

ws.close();
const fails = results.filter((r) => !r.ok).length;

console.log(fails ? `\n${fails} FAILED` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

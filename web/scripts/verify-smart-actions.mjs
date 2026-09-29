// Regression checks for the Smart actions card (Personalize → Display).
//
// The card is the desk-wide Zone 2 layer's front door: it explains itself, it
// asks, and a person answers. What is checked here is mostly about HONESTY —
// a suggestion may only appear when the state it describes is really readable,
// the umbrella switch must not reach the monitor window's own automation, and
// the explanation must stay readable, since flipping the switch is meant to be
// an informed act (2026-07-16 usability review).
//
// Run: dev server on :5196, headless Chrome on :9232, from web/.
// ⚠️ Launch that Chrome WITH software WebGL — `--headless=new --use-angle=swiftshader
//   --enable-unsafe-swiftshader` — and WITHOUT `--disable-gpu`. Personalize hosts Light
//   Studio (three.js); when no WebGL context can be made the renderer throws and the
//   whole React root unmounts, so every check here reads an empty page (2026-09-13).
//   node scripts/verify-smart-actions.mjs
// ⚠️ REWRITTEN 2026-09-21 for the new decision (Cindy: "스마트 액션은 왜 지금
// 아무 것도 없는데 카드는 왜 만들어 놓는 거야?"): the card has no switch and no
// policy line any more — it exists only while a suggestion does. The checks that
// guarded the switch (explanation spelled out while OFF, ⓘ once ON, suggestion
// only while watching) guarded a retired design, and a check that outlives its
// decision passes on a string rather than on behaviour (2026-09-09 lesson).
// History of those checks = git log of this file.
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

const PORT = process.env.PORT || '5196';
const CDP = process.env.CDP || '9232';
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });

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

let n = 0;
const open = async (hash = '#/personalize') => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${++n}${hash}` });
  await waitForApp();
};

const CARD = `(() => {
  const t = [...document.querySelectorAll('.w-label-text')].find((e) => e.textContent.trim() === 'Smart actions');
  const card = t?.closest('.w');
  if (!card) return null;
  return {
    text: card.innerText,
    toggles: card.querySelectorAll('.ds-toggle, [role="switch"], input[type="checkbox"]').length,
    buttons: [...card.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean),
    // Counted on the page: "Arrange N screens" exists only in this section.
    arrangeInSection: [...document.querySelectorAll('button, a')].filter((b) => /^Arrange\\b/i.test(b.textContent.trim())).length,
  };
})()`;

// ── 1. one screen: nothing to say, so no card ──
await open();
await ev(`localStorage.clear(); localStorage.setItem('deskDevices','${DESK(1)}')`);
await open();
check('one screen: no Smart actions card', (await ev(CARD)) === null);
check('one screen: no "With a second display" anywhere', !(await ev(`/with a second display/i.test(document.body.innerText)`)));

// ── 2. several screens, never arranged: the card speaks, once ──
// The row is the 2026-09-13 copy sheet's (sheets/smart-actions-copy-2026-09-13
// .html «화면 배치 제안»): the line + `Arrange`. 2026-09-21 second pass — the
// first pass had no button and an invented `Not now`.
for (const screens of [2, 3]) {
  await ev(`localStorage.clear(); localStorage.setItem('deskDevices','${DESK(screens)}')`);
  await open();
  await sleep(800);
  const c = await ev(CARD);
  check(`${screens} screens, not arranged: the card is there`, !!c);
  if (!c) continue;
  check(`${screens} screens: the sheet's line, with the count`,
    new RegExp(`Your ${screens} displays aren't arranged yet\\.`).test(c.text), c.text.replace(/\n/g, ' | '));
  check(`${screens} screens: no switch on the card`, c.toggles === 0, String(c.toggles));
  check(`${screens} screens: the only button is "Arrange"`, c.buttons.join('|') === 'Arrange', c.buttons.join(', '));
  check(`${screens} screens: nothing about brightness sync is suggested`, !/sync/i.test(c.text));
}

// ── 3. the button goes where the Desk card's corner goes ──
await ev(`[...document.querySelectorAll('.w button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);
await sleep(1500);
check('Arrange opens the one editor', await ev(`location.hash.includes('arrange=1') && !!document.querySelector('.arrange-modal, .ae-stage')`),
  await ev('location.hash'));

// ── 4. once arranged, nothing to say ──
await open();
await ev(`localStorage.setItem('displayArrange', JSON.stringify({ mode: 'extend', positions: { 'oled-27': { left: 0.05, top: 0.3 }, builtin: { left: 0.3, top: 0.35 }, 'treehouse-32': { left: 0.55, top: 0.25 } }, space: 'fraction' }))`);
await open();
check('arranged: no card', (await ev(CARD)) === null);

// ── 5. it never touches the monitor window's own automation ──
check('the monitor window key `smartActions` is untouched', (await ev(`localStorage.getItem('smartActions')`)) === null);

ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} FAILED` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

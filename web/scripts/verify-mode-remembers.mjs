// Regression checks for the `Remembers` fold in the Settings tab's
// `Modes & Presets` card.
//
// Why this file exists: a mode is the monitor's saved unit and it spans Display,
// Lights and Audio, but the only place that said so was a sentence in an
// InfoTip — you had to ENTER a mode to learn what switching would change
// (consultant review, design-assets/mode-memory-review-2026-08-21.md). The fold
// answers it in place. The invariants below are the ones that answer can get
// wrong: counting the settings that EXIST instead of the ones the user owns,
// printing a number that disagrees with the rows under it, drawing a value for a
// mode that has none, and — the reason this card has no room for a new card at
// all — pushing the neighbours when it opens.
//
// Harness notes (measured 2026-08-21, both expensive to rediscover):
//   · Headless needs SOFTWARE WebGL, or three.js throws and #root stays empty:
//     --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
//   · Set the route AFTER the load; the fragment does not survive the navigation
//     URL here, and a cold load with `?sku=` has its params cleaned by AppShell.
//
// Run: dev server on :5196, headless Chrome on :9242, from web/.
//   node scripts/verify-mode-remembers.mjs
import WebSocket from 'ws';

const PORT = process.env.PORT || '5196';
const CDP = process.env.CDP || '9242';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
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
const send = (me, pa = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: me, params: pa })); });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
  return result.value;
};
const wait = async (e, ms = 45000) => { const u = Date.now() + ms; while (Date.now() < u) { if (await ev(`!!(${e})`)) return true; await sleep(300); } return false; };
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });

/** The fold's button, found by its writing rather than its position. The label
 *  names the mode, so it doubles as "which mode is this about". */
const FOLD = `[...document.querySelectorAll('.mt-fold')].find(b => /^What .* changes/.test(b.textContent.trim()))`;
const SUMMARY = `(() => { const b = ${FOLD}; return b ? b.textContent.trim().replace(/\\s+/g, ' ') : null; })()`;
const ROWS = `(() => {
  const sec = ${FOLD}?.closest('.mp-sec');
  if (!sec) return null;
  const out = {};
  sec.querySelectorAll('.ds-ng3-spec-row, .dc-spec-row, li, .ds-ng3-row').forEach((r) => {
    const t = r.textContent.trim();
    ['Lights', 'Picture', 'Viewing Mode', 'EQ preset'].forEach((k) => { if (t.startsWith(k)) out[k] = t.slice(k.length).trim(); });
  });
  return out;
})()`;

/** Load, then set the route, then land on the Settings tab. */
const openSettingsTab = async (seed) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` });
  await sleep(800);
  await wait(`document.getElementById('root')?.children.length`);
  if (seed) { await ev(seed); await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` }); await sleep(800); await wait(`document.getElementById('root')?.children.length`); }
  await ev(`location.hash='#/?sku=treehouse-32&tab=utilities'`);
  await sleep(1500);
  return wait(`document.querySelector('.mp-sec')`);
};

/** Same three steps as above, for the tab whose controls Picture lives on.
 *  The hash has to be set AFTER a load here too — a tab that has never been
 *  visited is not mounted, so probing it without the reload finds nothing. */
const openDisplayTab = async (seed) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` });
  await sleep(800);
  await wait(`document.getElementById('root')?.children.length`);
  if (seed) { await ev(seed); await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` }); await sleep(800); await wait(`document.getElementById('root')?.children.length`); }
  await ev(`location.hash='#/?sku=treehouse-32&tab=display'`);
  await sleep(1800);
  return wait(CONTRAST);
};
/** The Contrast row's printed number — the one thing a mode switch must move. */
const CONTRAST = `(() => { const r = [...document.querySelectorAll('.ds-ng3-row')]
  .find(x => x.textContent.trim().startsWith('Contrast'));
  return r ? r.querySelector('.dc-mono-val')?.textContent.trim() : null; })()`;

// ── 1. a fresh install has picked no mode, so there is no subject ────────────
await openSettingsTab(`localStorage.clear()`);
check('the Modes & Presets card is on the Settings tab', await ev(`!!document.querySelector('.mp-sec')`));
check('with no mode picked there is no Remembers fold', (await ev(`!!(${FOLD})`)) === false);

// ── 2. a mode with nothing of its own: 0 of 3, and the rows still teach ──────
await openSettingsTab(`localStorage.setItem('monitorMode', 'Work')`);
check('picking a mode brings the fold', await wait(FOLD));
check('the label asks the reader\'s question and names the mode', (await ev(SUMMARY)) === 'What Work changes', String(await ev(SUMMARY)));
await ev(`(${FOLD}).click()`);
await sleep(700);
{
  const rows = await ev(ROWS);
  check('all four settings are listed, saved or not', rows && Object.keys(rows).length === 4, JSON.stringify(rows));
  check('the two with nothing stored print the no-value mark',
    rows && rows['Viewing Mode'] === '—' && rows['EQ preset'] === '—', JSON.stringify(rows));
  check('the lamp shows the mode default rather than nothing',
    !!(rows && /^#/.test(rows['Lights'] || '')), rows ? rows['Lights'] : 'no row');
}

// ── 3. values of the user's own: counted, and printed ────────────────────────
await openSettingsTab(`localStorage.setItem('monitorMode', 'Work');
  localStorage.setItem('underGlow', JSON.stringify({ enabled: true, color: '#22cc88', brightness: 55, byMode: { Work: '#22cc88' }, byModeLevel: { Work: 55 } }));
  localStorage.setItem('audioEq', JSON.stringify({ current: 'Music', byMode: { Work: 'Music' } }));`);
check('the label is the same whatever the mode is holding', (await ev(SUMMARY)) === 'What Work changes', String(await ev(SUMMARY)));
await ev(`(${FOLD}).click()`);
await sleep(700);
{
  const rows = await ev(ROWS);
  check('the saved lamp prints colour and level together', rows && rows['Lights'] === '#22cc88 · 55%', JSON.stringify(rows));
  check('the saved EQ prints its name', rows && rows['EQ preset'] === 'Music', JSON.stringify(rows));
  check('the untouched layout still prints the no-value mark', rows && rows['Viewing Mode'] === '—');
}

// ── 4. every row says something ──────────────────────────────────────────────
{
  const rows = await ev(ROWS);
  // No count on the summary any more (2026-08-24), so the invariant it guarded
  // — number vs list — is gone with it. What still has to hold is that no row
  // is blank: each either prints a value or the app's no-value mark.
  const blank = Object.entries(rows || {}).filter(([, v]) => !v).length;
  check('no row is blank — value or the no-value mark', blank === 0, JSON.stringify(rows));
}

// ── 4b. Picture: one row for four controls, and it actually follows the mode ─
{
  // A mode with no picture entry sits on the shipped baseline, so the row says
  // so rather than printing the no-value mark — unlike Layout and EQ, Picture
  // always HAS a value on screen.
  await openSettingsTab(`localStorage.clear(); localStorage.setItem('monitorMode', 'Work')`);
  await wait(FOLD);
  await ev(`(${FOLD}).click()`);
  await sleep(700);
  check('with nothing saved the picture row says Default', (await ev(ROWS))?.Picture === 'Default',
    JSON.stringify(await ev(ROWS)));

  // One saved control, one entry in the count — not four.
  await openSettingsTab(`localStorage.clear();
    localStorage.setItem('monitorMode', 'Work');
    localStorage.setItem('displayPicture', JSON.stringify({ contrast: 75, byMode: { Work: { contrast: 75 } } }));`);
  await ev(`(${FOLD}).click()`);
  await sleep(700);
  // Four controls changed, one row printed: the group is not four rows in a coat.
  check('the picture group is one row, not four', Object.keys((await ev(ROWS)) || {}).length === 4,
    JSON.stringify(await ev(ROWS)));
  check('and the row switches to Custom', (await ev(ROWS))?.Picture === 'Custom',
    JSON.stringify(await ev(ROWS)));

  // The whole point: the number on the Display tab moves when the mode moves.
  // Switching modes the way a person does: the mode bar is one grouped
  // Dropdown in the panel's tab strip (2026-09-24) — its trigger opens the
  // list, and the list is where the names are. Not a plain button — that row
  // dropped its segmented control, so a `button` whose text is the mode name
  // does not exist on this screen (measured 2026-08-24).
  const pickMode = async (t) => {
    const opened = await ev(`(() => {
      const trig = document.querySelector('.pb-select .ds-dropdown-trigger');
      if (!trig) return false;
      trig.click();
      return true;
    })()`);
    if (!opened) return false;
    await sleep(500);
    return ev(`(() => {
      const item = [...document.querySelectorAll('.pb-select .ds-list-item')]
        .find(e => e.querySelector('.ds-list-item-label')?.textContent.trim() === '${t}');
      if (!item) return false;
      item.click();
      return true;
    })()`);
  };
  const click = pickMode;
  await openDisplayTab(`localStorage.clear();
    localStorage.setItem('monitorMode', 'Work');
    localStorage.setItem('displayPicture', JSON.stringify({ contrast: 75, byMode: { Work: { contrast: 75 } } }));`);
  check('the saved mode shows its own contrast', (await ev(CONTRAST)) === '75', String(await ev(CONTRAST)));
  check('the mode list offers the other mode', (await click('Create')) === true);
  await sleep(1000);
  check('switching to a mode without one falls back to the baseline', (await ev(CONTRAST)) === '55', String(await ev(CONTRAST)));
  await click('Work');
  await sleep(1000);
  check('switching back brings the saved one home', (await ev(CONTRAST)) === '75', String(await ev(CONTRAST)));

  // It used to die with the window; that is what "mode-scoped" was missing.
  await openDisplayTab();
  check('and it survives closing the window', (await ev(CONTRAST)) === '75', String(await ev(CONTRAST)));
}

// ── 4c. Brightness: the mode wins, and matching happens inside the mode ─────
// The rule Cindy settled on 2026-08-29 (decision queue), and the reason it needed
// settling at all: Brightness already had a scope of its own — `displaySync`,
// "Matched across all displays" — so a second, per-mode scope had to be told
// which one outranks the other. It is the mode; Match then carries the mode's
// level to the rest of the desk, which keeps BOTH sentences on screen true.
// These checks are that rule written as behaviour: without them the two scopes
// settle whichever way the last edit happened to leave them, silently.
{
  /** The Brightness row's printed number. `%` is a suffix on this slider and not
   *  on Contrast, so the digits are read out rather than the whole string. */
  const BRIGHT = `(() => { const r = [...document.querySelectorAll('.ds-ng3-row')]
    .find(x => x.textContent.trim().startsWith('Brightness'));
    const v = r ? r.querySelector('.dc-mono-val')?.textContent.trim() : null;
    return v == null ? null : v.replace(/[^0-9]/g, ''); })()`;
  /** The desk's shared number, straight out of storage — what every OTHER display
   *  follows. A plain string: `displayBrightness` is a `number` in the schema and
   *  numbers persist unwrapped (Settings.tsx). */
  const desk = () => ev(`localStorage.getItem('displayBrightness')`);
  /** The mode's own filed copy, so a passing switch cannot be a coincidence.
   *  Read from this monitor's own picture (`displayPictureBySku`, 2026-09-18) —
   *  the single `displayPicture` blob is now only the seed the Treehouse 32
   *  starts from, so the fixtures above still write there. */
  const filed = (m) =>
    ev(`(() => { try { const s = JSON.parse(localStorage.getItem('displayPictureBySku') || '{}')['treehouse-32'] || JSON.parse(localStorage.getItem('displayPicture') || '{}'); return (s.byMode || {})['` + m + `']?.brightness ?? null; } catch { return null; } })()`);
  /** Switching modes the way a person does — through the mode bar's dropdown. */
  const pickMode = async (t) => {
    const opened = await ev(`(() => {
      const trig = document.querySelector('.pb-select .ds-dropdown-trigger');
      if (!trig) return false;
      trig.click();
      return true;
    })()`);
    if (!opened) return false;
    await sleep(500);
    const ok = await ev(`(() => {
      const item = [...document.querySelectorAll('.pb-select .ds-list-item')]
        .find(e => e.querySelector('.ds-list-item-label')?.textContent.trim() === '` + t + `');
      if (!item) return false;
      item.click();
      return true;
    })()`);
    await sleep(1000);
    return ok;
  };

  // Match OFF — the level is this monitor's alone, and it still follows the mode.
  await openDisplayTab(`localStorage.clear();
    localStorage.setItem('monitorMode', 'Work');
    localStorage.setItem('displaySync', '0');
    localStorage.setItem('displayBrightness', '55');
    localStorage.setItem('displayPicture', JSON.stringify({ brightness: 35, byMode: { Work: { brightness: 35 } } }));`);
  check('the saved mode shows its own brightness', (await ev(BRIGHT)) === '35', String(await ev(BRIGHT)));
  check('the mode list offers the other mode', (await pickMode('Create')) === true);
  check('a mode with no brightness of its own opens at the shipped 80',
    (await ev(BRIGHT)) === '80', String(await ev(BRIGHT)));
  await pickMode('Work');
  check('switching back brings the saved level home', (await ev(BRIGHT)) === '35', String(await ev(BRIGHT)));
  check('with Match off the desk keeps its own number', (await desk()) === '55', String(await desk()));

  // Match ON — the same switch moves every display on the desk.
  await openDisplayTab(`localStorage.clear();
    localStorage.setItem('monitorMode', 'Work');
    localStorage.setItem('displaySync', '1');
    localStorage.setItem('displayBrightness', '35');
    localStorage.setItem('displayPicture', JSON.stringify({ brightness: 35, byMode: { Work: { brightness: 35 } } }));`);
  check('matched, the tab opens on the mode-s level', (await ev(BRIGHT)) === '35', String(await ev(BRIGHT)));
  await pickMode('Create');
  check('and switching mode takes the whole desk with it',
    (await desk()) === '80' && (await ev(BRIGHT)) === '80', `desk=${await desk()} tab=${await ev(BRIGHT)}`);
  await pickMode('Work');
  check('back to Work, the desk follows again', (await desk()) === '35', String(await desk()));

  // The other direction: moved from Personalize while matched, the desk's number
  // is what every display shows — so this monitor adopts it and files it under
  // the mode it is in, because matched means one number rather than two.
  await openDisplayTab(`localStorage.clear();
    localStorage.setItem('monitorMode', 'Work');
    localStorage.setItem('displaySync', '1');
    localStorage.setItem('displayBrightness', '42');
    localStorage.setItem('displayPicture', JSON.stringify({ brightness: 35, byMode: { Work: { brightness: 35 } } }));`);
  await sleep(600);
  check('a level set on Personalize wins while Match is on', (await ev(BRIGHT)) === '42', String(await ev(BRIGHT)));
  check('and the mode files it, so switching away and back is not a surprise',
    (await filed('Work')) === 42, String(await filed('Work')));
}

// ── 5. opening it moves no other card (the reason a new card was not an option)
{
  await openSettingsTab(`localStorage.setItem('monitorMode', 'Work')`);
  await wait(FOLD);
  // Measured RELATIVE to the grid, not to the viewport: clicking can scroll the
  // panel, and a scroll moves every box by the same amount without re-flowing
  // anything. Viewport coordinates reported "all 7 moved" for exactly that
  // reason (2026-08-21) — the wrong alarm on the one invariant this card's
  // no-new-card budget rests on.
  const boxes = () => ev(`(() => {
    const g = document.querySelector('.mc-grid');
    if (!g) return [];
    const gr = g.getBoundingClientRect();
    return [...g.children].map((e) => { const r = e.getBoundingClientRect();
      return [Math.round(r.x - gr.x), Math.round(r.y - gr.y)]; });
  })()`);
  const before = await boxes();
  await ev(`(${FOLD}).click()`);
  await sleep(900);
  const after = await boxes();
  // What the 2026-08-21 decision actually banned is the SIDEWAYS jump — a card
  // reflowing into a different column when something else changed ("카드 전체가
  // 옮겨지는 건 디자인이 좀 이상하지 않아?"). Under the row layout (2026-08-26,
  // SPEC: tab-card-rows) a fold that grows its row pushes the rows BELOW it
  // down in normal document flow — that is an accordion doing what accordions
  // do, not the pathology. So: any horizontal shift fails; vertical shift is
  // allowed only downward, for elements that started below the one that grew.
  const sideways = before.filter((b, i) => after[i] && b[0] !== after[i][0]).length;
  const risers = before.filter((b, i) => after[i] && after[i][1] < b[1]).length;
  check('opening the fold jumps no card sideways', sideways === 0, `sideways=${sideways} of ${before.length}`);
  check('and nothing above the fold moves up', risers === 0, `rose=${risers}`);
  check('and the tab still does not scroll sideways',
    (await ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`)) === true);
}

// ── a mode with no level of its own opens at the resting brightness ─────────
// Not at whatever the mode you just left was showing. Create pins 10% (the only
// researched level); Game and Work have none on purpose, and before 2026-08-26
// they inherited the live value, so arriving from Create put them at 10 and the
// tab read as if that were their answer.
// Driven through the mode pill, not by seeding the store: the level is applied
// BY the switch (applyGlow), so a seeded mode with no switch never resolves and
// the probe would read the store's opening value whatever the code does — which
// is exactly the false pass this check first produced.
{
  await openSettingsTab(`localStorage.clear()`);
  const pick = async (mode) => {
    await ev(`document.querySelector('.pb-select .ds-dropdown-trigger')?.click()`);
    await sleep(500);
    const ok = await ev(`(() => { const b = [...document.querySelectorAll('.pb-select .ds-list-item')]
      .find(e => e.querySelector('.ds-list-item-label')?.textContent.trim() === ${JSON.stringify(mode)}); if (b) { b.click(); return true; } return false; })()`);
    await sleep(800);
    return ok;
  };
  const level = () => ev(`(() => { try { return JSON.parse(localStorage.getItem('underGlow') || '{}').brightness ?? null; } catch { return null; } })()`);

  const gotCreate = await pick('Create');
  const create = await level();
  check('Create opens at its researched level', gotCreate && create === 10, `switched=${gotCreate} level=${create}`);

  const gotGame = await pick('Game');
  const game = await level();
  check('a mode with no level of its own opens at 70, not the last one lit',
    gotGame && game === 70, `switched=${gotGame} Game=${game} (arrived from Create=${create})`);
}

await ev(`localStorage.clear()`);
ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} FAILED` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

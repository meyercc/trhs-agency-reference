// CDP walkthrough for the Performance page's record of changes (June 2027 step
// 3: who changed what, signed on the card, listed behind a door, revertible).
//
//   · perform.4 / network-booster.6 — a change software made is signed on the
//     card it changed; network-booster.7 — touching the control takes it back.
//   · perform.5 — every automatic write is listed behind the record's door;
//     perform.33 — nothing announces it as it happens.
//   · OMEN AI 2.0 §3.1 — every write carries user | omen_ai | system;
//     §3.5 (DR-3.5b) — Revert puts a change back whole, never half.
//   · booster.15 — when the game closes, Booster puts back what it changed;
//     omen-ai.18 — OMEN AI's change to a game can be undone.
//   · A clean's deleted files do not come back, and the record says so.
//
// The writers are the Simulator's game session (OMEN AI and Booster at launch),
// the System Cleaner, and the player. Network Booster has no automatic writer in
// June, so its signature is checked with a record written into storage.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

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

// The keys this suite reads or writes, cleared so a run starts from a fresh
// profile: the demo power mode, the seeded scheduled clean; June 2027 is set
// where the section needs it.
const OWN_KEYS = ['performChanges', 'mvpScope', 'powerModeEvent', 'powerMode', 'nonHpPc', 'omenAi', 'gameSession', 'perform-main-sections', 'perform-v7-sections'];

let loadN = 0;
// `sim=1`: the Simulator is hidden until asked (2026-10-26); these suites drive it.
async function load(send, hash = '#/perform-v7', ready = `document.querySelector('.pv5-root')`) {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}&sim=1${hash}` });
  await waitFor(send, APP_READY);
  await waitFor(send, ready);
  await sleep(250);
}

// ── What the page shows, as a person reads it ────────────────────────────────
const CARD = (title) => `(() => {
  const c = [...document.querySelectorAll('.ds-feature-card')].find(c => c.querySelector('.ds-feature-card-title')?.textContent.trim() === ${JSON.stringify(title)});
  if (!c) return null;
  const facts = {};
  c.querySelectorAll('.pv5-fact').forEach(f => { facts[f.querySelector('.pv5-fact-l').textContent.trim()] = f.querySelector('.pv5-fact-v').textContent.trim(); });
  return { status: c.querySelector('.pv5-feat-status')?.textContent.trim(), facts };
})()`;
const card = (send, title) => evalJs(send, CARD(title));

const door = `document.querySelector('.pv7-title-row .pv7-changes-door')`;
const ROWS = `[...document.querySelectorAll('.pv7-changes .pv7-change')].map(r => ({
  id: r.dataset.change,
  target: r.dataset.target,
  by: r.querySelector('.pv7-change-by')?.textContent.trim(),
  what: r.querySelector('.pv7-change-what')?.textContent.trim(),
  at: r.querySelector('.pv7-change-at')?.textContent.trim(),
  revert: !!r.querySelector('.pv7-change-act button'),
  state: r.querySelector('.pv7-change-state')?.textContent.trim() ?? null,
}))`;
async function openDoor(send) {
  await evalJs(send, `${door}?.click()`);
  await waitFor(send, `document.querySelector('.pv7-changes')`, 3000);
  return evalJs(send, ROWS);
}
const closeModal = (send) => evalJs(send, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`).then(() => sleep(200));
const revertRow = (send, target) => evalJs(send, `document.querySelector('.pv7-changes .pv7-change[data-target="${target}"] .pv7-change-act button')?.click()`).then(() => sleep(200));

const clickTabIn = (send, group, label) =>
  evalJs(send, `[...document.querySelectorAll('[aria-label=${JSON.stringify(group)}] [role=tab]')].find(t => t.textContent.trim() === ${JSON.stringify(label)})?.click()`).then(() => sleep(250));
const session = (send, on) => clickTabIn(send, 'Game session', on ? 'In game' : 'No game');
const openCardDoor = (send, feature, verb) =>
  evalJs(send, `[...document.querySelectorAll('[data-feature="${feature}"] .pv5-card-door')].find(b => new RegExp(${JSON.stringify(verb)}, 'i').test(b.textContent))?.click()`).then(() => sleep(300));

/** Anything that would announce a write on its own: a dialog, an alert, a toast. */
const ANNOUNCERS = `document.querySelectorAll('[role=dialog], [role=alert], [role=status], [aria-live], .toast, .ds-toast').length`;
const stored = `JSON.parse(localStorage.getItem('performChanges') ?? '[]')`;

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  let errors = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description ?? ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await load(send, '#/', `document.querySelector('#root')?.firstElementChild`);
  // A fresh profile. The scope is set to June 2027 here: the app's default is
  // full parity (verify-pc-device pins it), and this first section is the June
  // page's record.
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k)); localStorage.setItem('mvpScope', 'june27')`);
  errors = [];

  // ── A fresh profile, June 2027 ─────────────────────────────────────────────
  await load(send);
  check('door: the title row carries a Changes door beside the page title',
    await evalJs(send, `!!${door} && ${door}.closest('.pv7-title-row')?.querySelector('h1')?.textContent.trim() === 'Performance'`));
  let rows = await openDoor(send);
  check('door: a fresh profile lists the scheduled clean, by System Cleaner, 3 days ago',
    rows.length === 1 && rows[0].by === 'System Cleaner' && /Scheduled clean/.test(rows[0].what) && rows[0].at === '3 days ago', JSON.stringify(rows));
  check('door: the clean has no Revert and says its deleted files cannot be restored',
    rows[0]?.revert === false && rows[0]?.state === "Deleted files can't be restored", JSON.stringify(rows[0]));
  check('door, june: the power mode OMEN AI set is not listed — the page has no Power Mode card',
    !rows.some((r) => r.target === 'power-mode') && (await evalJs(send, `${stored}.some(r => r.target === 'power-mode' && r.source === 'omen_ai')`)),
    JSON.stringify(await evalJs(send, `${stored}.map(r => r.target + ':' + r.source)`)));
  await closeModal(send);
  check('cleaner: its receipt says when the last clean ran and who ran it',
    (await card(send, 'System Cleaner'))?.facts['Last cleaned'] === '3 days ago · Scheduled', JSON.stringify(await card(send, 'System Cleaner')));

  // ── A game launches: OMEN AI and Booster write, and say nothing ───────────
  const before = await evalJs(send, ANNOUNCERS);
  await session(send, true);
  check('session: OMEN AI and Booster write at launch without announcing it (perform.33)',
    (await evalJs(send, ANNOUNCERS)) === before && (await evalJs(send, `${stored}.length`)) === 4, `announcers ${before} → ${await evalJs(send, ANNOUNCERS)}`);
  check('session: Booster is optimizing with its 3 items applied',
    (await card(send, 'Booster'))?.status === 'Optimizing' && (await card(send, 'Booster'))?.facts.Optimizations === '3 applied', JSON.stringify(await card(send, 'Booster')));
  rows = await openDoor(send);
  const aiRow = rows.find((r) => r.target === 'omen-ai');
  const boostRow = rows.find((r) => r.target === 'booster');
  check('door: OMEN AI\'s change is listed, newest first, signed OMEN AI, with Revert',
    rows[0]?.target === 'booster' && aiRow?.by === 'OMEN AI' && aiRow.what === 'Applied its Cyberpunk 2077 profile (v1.4)' && aiRow.at === 'Just now' && aiRow.revert, JSON.stringify(rows));
  check('door: Booster\'s pack is ONE row naming all three items, with Revert (§3.5)',
    boostRow?.by === 'Booster' && /Applied 3 optimizations for Cyberpunk 2077: Disable Automatic Updates, Memory Boost, Set game process to High Priority/.test(boostRow.what) && boostRow.revert && rows.filter((r) => r.target === 'booster').length === 1,
    JSON.stringify(boostRow));
  check('door: the player\'s own writes are recorded but not listed',
    rows.every((r) => r.by !== null && r.by !== undefined) && (await evalJs(send, `${stored}.filter(r => r.source !== 'user').length`)) >= rows.length);

  // ── Revert, from the door ──────────────────────────────────────────────────
  await revertRow(send, 'booster');
  rows = await evalJs(send, ROWS);
  check('revert: the Booster row now reads Reverted, with no second Revert',
    rows.find((r) => r.target === 'booster')?.state === 'Reverted' && !rows.find((r) => r.target === 'booster')?.revert, JSON.stringify(rows.find((r) => r.target === 'booster')));
  await revertRow(send, 'omen-ai');
  rows = await evalJs(send, ROWS);
  check('revert: the OMEN AI row now reads Reverted', rows.find((r) => r.target === 'omen-ai')?.state === 'Reverted', JSON.stringify(rows.find((r) => r.target === 'omen-ai')));
  check('revert: a revert is the player\'s change — recorded as user, not listed',
    (await evalJs(send, `${stored}.filter(r => r.source === 'user' && /^Reverted:/.test(r.summary)).length`)) === 2 && rows.length === 3);
  await closeModal(send);
  let booster = await card(send, 'Booster');
  check('revert: Booster stops optimizing mid-game, and its receipt shows the boost',
    booster?.status === 'Idle' && booster.facts['Last boost'] === 'Cyberpunk 2077 · just now', JSON.stringify(booster));
  check('revert: OMEN AI is off for the game it changed, so its card idles (omen-ai.18)',
    (await card(send, 'OMEN AI'))?.status === 'Idle', JSON.stringify(await card(send, 'OMEN AI')));
  await openCardDoor(send, 'omen-ai', 'settings');
  const cyber = await evalJs(send, `(() => {
    const g = [...document.querySelectorAll('.pv5-omm-game')].find(g => /Cyberpunk/.test(g.textContent));
    return { on: g?.querySelector('[role=switch]')?.getAttribute('aria-checked'), badge: g?.querySelector('.pv5-omm-game-head')?.innerText };
  })()`);
  check('revert: OMEN AI\'s settings show Cyberpunk 2077 off and Paused', cyber.on === 'false' && /paused/i.test(cyber.badge ?? ''), JSON.stringify(cyber));
  await closeModal(send);

  // ── The next game: OMEN AI stays out, Booster restores at close ───────────
  await session(send, false);
  await session(send, true);
  const kinds = await evalJs(send, `${stored}.filter(r => r.source !== 'user').map(r => r.target)`);
  check('next session: OMEN AI writes nothing to a game it was reverted off; Booster applies again',
    kinds.filter((t) => t === 'omen-ai').length === 1 && kinds.filter((t) => t === 'booster').length === 2, JSON.stringify(kinds));
  await session(send, false);
  rows = await openDoor(send);
  check('game closes: Booster put its pack back — "Restored when the game closed", nothing to revert (booster.15)',
    rows[0]?.target === 'booster' && rows[0].state === 'Restored when the game closed' && !rows[0].revert, JSON.stringify(rows[0]));
  await closeModal(send);
  booster = await card(send, 'Booster');
  check('game closes: Booster idles and its receipt is the boost that ended',
    booster?.status === 'Idle' && booster.facts['Last boost'] === 'Cyberpunk 2077 · just now', JSON.stringify(booster));

  // ── The player cleans ──────────────────────────────────────────────────────
  await evalJs(send, `[...document.querySelectorAll('[data-feature="system-cleaner"] button')].find(b => b.textContent.trim() === 'Clean')?.click()`);
  check('clean: the clean runs to the end', await waitFor(send, `document.querySelector('.pv5-dialog-ring-done')`, 8000));
  await evalJs(send, `[...document.querySelectorAll('.pv5-dialog button')].find(b => b.textContent.trim() === 'Done')?.click()`);
  await sleep(200);
  check('clean: the receipt says the player just cleaned', (await card(send, 'System Cleaner'))?.facts['Last cleaned'] === 'Just now · You', JSON.stringify(await card(send, 'System Cleaner')));
  rows = await openDoor(send);
  check('clean: the player\'s clean is not listed behind the door', rows.filter((r) => r.target === 'system-cleaner').length === 1, JSON.stringify(rows.map((r) => r.what)));
  await closeModal(send);

  // ── Network Booster: the player is not signed; software is, until touched ──
  await openCardDoor(send, 'network-booster', 'manage');
  await clickTabIn(send, 'Network Booster mode', 'Custom');
  await closeModal(send);
  check('nb: the player\'s own mode is not signed', (await card(send, 'Network Booster'))?.facts.Mode === 'Custom', JSON.stringify(await card(send, 'Network Booster')));
  // No June feature writes Network Booster's mode, so OMEN AI's write is put in storage.
  await evalJs(send, `localStorage.setItem('performChanges', JSON.stringify([...${stored}, { id: 'verify-nb', at: Date.now() - 5 * 60000, source: 'omen_ai', target: 'network-booster', key: 'mode', before: 'custom', after: 'auto', summary: 'Set Network Booster to Auto', revertible: true }]))`);
  await load(send);
  check('nb: a mode software set is signed beside the mode (network-booster.6)',
    (await card(send, 'Network Booster'))?.facts.Mode === 'Auto · Set by OMEN AI', JSON.stringify(await card(send, 'Network Booster')));
  rows = await openDoor(send);
  check('reload: the record survives — every row is still there',
    rows.length === 5 && rows[0].id === 'verify-nb' && rows[0].revert && rows[0].at === '5 min ago', JSON.stringify(rows.map((r) => [r.target, r.state ?? 'revert'])));
  await closeModal(send);
  await openCardDoor(send, 'network-booster', 'manage');
  await clickTabIn(send, 'Network Booster mode', 'Off');
  await closeModal(send);
  check('nb: touching the mode takes it back — the signature goes (network-booster.7)',
    (await card(send, 'Network Booster'))?.facts.Mode === 'Off', JSON.stringify(await card(send, 'Network Booster')));
  rows = await openDoor(send);
  check('nb: the older change now says it was changed again since, with no Revert',
    rows[0]?.id === 'verify-nb' && rows[0].state === 'Changed again since' && !rows[0].revert, JSON.stringify(rows[0]));
  await closeModal(send);
  check('june: a clean run — no errors', errors.length === 0, errors.join(' | '));

  // ── 27C2: the power mode OMEN AI set, listed and reverted ─────────────────
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k)); localStorage.setItem('mvpScope', '27c2')`);
  errors = [];
  await load(send);
  const managed = `document.querySelectorAll('.pv5-managed, .pv5-gov-chip').length`;
  const activeMode = `document.querySelector('.pv5-mode-tile.active .power-mode-label')?.textContent.trim()`;
  check('27c2: a fresh profile opens with OMEN AI managing Performance', (await evalJs(send, managed)) > 0 && (await evalJs(send, activeMode)) === 'Performance');
  rows = await openDoor(send);
  const pmRow = rows.find((r) => r.target === 'power-mode');
  check('27c2: the door lists the power mode OMEN AI set, 2 h ago, with Revert',
    pmRow?.by === 'OMEN AI' && pmRow.what === 'Set power mode to Performance for Cyberpunk 2077' && pmRow.at === '2 h ago' && pmRow.revert, JSON.stringify(rows));
  await revertRow(send, 'power-mode');
  check('27c2: Revert reads Reverted', (await evalJs(send, ROWS)).find((r) => r.target === 'power-mode')?.state === 'Reverted');
  await closeModal(send);
  check('27c2: and the mode is back at Balanced, as the player\'s — the managed mark is gone',
    (await evalJs(send, activeMode)) === 'Balanced' && (await evalJs(send, managed)) === 0, `${await evalJs(send, activeMode)} · managed ${await evalJs(send, managed)}`);
  await load(send);
  check('27c2, reload: still Balanced, still no managed mark', (await evalJs(send, activeMode)) === 'Balanced' && (await evalJs(send, managed)) === 0);
  await evalJs(send, `[...document.querySelectorAll('.pv5-mode-tile')].find(t => /Performance/.test(t.textContent))?.click()`);
  await sleep(200);
  rows = await openDoor(send);
  check('27c2: the player picking a mode is recorded, not listed',
    rows.filter((r) => r.target === 'power-mode').length === 1 && (await evalJs(send, `${stored}.filter(r => r.target === 'power-mode' && r.source === 'user').length`)) === 2,
    JSON.stringify(await evalJs(send, `${stored}.filter(r => r.target === 'power-mode').map(r => r.source + ':' + r.after)`)));
  await closeModal(send);

  // A reload of a fresh profile keeps OMEN AI's demo mode as OMEN AI's: the
  // record and the card agree.
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k)); localStorage.setItem('mvpScope', '27c2')`);
  await load(send);
  await load(send);
  rows = await openDoor(send);
  check('27c2, fresh profile reloaded: the card still says OMEN AI, and so does the record',
    (await evalJs(send, managed)) > 0 && rows.find((r) => r.target === 'power-mode')?.revert === true, `managed ${await evalJs(send, managed)}`);
  await closeModal(send);

  // ── The shipped page has the same door ────────────────────────────────────
  await evalJs(send, `localStorage.removeItem('mvpScope')`);
  await load(send, '#/perform');
  rows = await openDoor(send);
  check('/perform: the shipped page carries the door and lists the scheduled clean',
    rows.some((r) => r.target === 'system-cleaner'), JSON.stringify(rows.map((r) => r.what)));
  await closeModal(send);
  check('27c2 and /perform: a clean run — no errors', errors.length === 0, errors.join(' | '));

  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

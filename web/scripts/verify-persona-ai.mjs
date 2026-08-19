// CDP walkthrough for persona surfaces round 2 — the OMEN AI modal's per-persona
// defaults and the persona-varied Perform subtitle.
// Dev server :5175, headless Chrome :9222, run from web/.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (p) => fetch('http://localhost:9222' + p).then((r) => r.json());

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

const AI_SNAP = `(() => {
  const m = document.querySelector('.omenai-modal');
  if (!m) return null;
  const rows = [...m.querySelectorAll('.ai-games-list > .ds-settings-group')];
  const first = rows[0];
  return {
    intro: m.querySelector('.modal-feature-desc')?.textContent.trim().slice(0, 60),
    goals: [...(first?.querySelectorAll('.ai-mode-group button') ?? [])].map(b => b.textContent.trim()),
    activeGoal: first?.querySelector('.ai-mode-group button.active, .ai-mode-group button[aria-pressed="true"]')?.textContent.trim()
      ?? first?.querySelector('.ai-mode-group [aria-checked="true"]')?.textContent.trim() ?? null,
    // Live header counts — "Optimizing" is the first stat cell.
    optimizing: Number(m.querySelector('.ai-right-stat-val')?.textContent.trim()),
    games: rows.length,
    bodies: m.querySelectorAll('.ai-widget-body').length,
    fpsRows: m.querySelectorAll('.ai-fps-row').length,
    autoNotes: m.querySelectorAll('.ai-auto-note').length,
    // Intro-panel counts — must agree with the live list, not be hardcoded.
    statusDetail: m.querySelector('.ai-status-detail')?.textContent.trim(),
    statusLabel: m.querySelector('.ai-status-label')?.textContent.trim(),
    introStats: [...m.querySelectorAll('.ds-stat-cell')].map(c => [
      c.querySelector('.ds-spark-lbl')?.textContent.trim(),
      c.querySelector('.ds-spark-val')?.textContent.trim(),
    ]),
    reverts: [...m.querySelectorAll('.ai-widget-body button')].filter(b => /Revert/.test(b.textContent)).length,
  };
})()`;

let loadN = 0;
async function load(send, { persona, route = '/perform', modal } = {}) {
  await evalJs(send, `
    localStorage.removeItem('persona');
    localStorage.removeItem('perform-sections');
    ${persona ? `localStorage.setItem('persona', ${JSON.stringify(persona)});` : ''}
  `);
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#${route}${modal ? '?modal=' + modal : ''}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
  if (modal) await waitFor(send, `document.querySelector('.omenai-modal .ai-games-list > *')`);
  else await waitFor(send, `document.querySelector('.page-sub')`);
}

const subtitle = (send) => evalJs(send, `document.querySelector('.page-sub')?.textContent.trim()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  // ── Perform subtitle per persona ───────────────────────────────────────────
  await load(send, {});
  const base = await subtitle(send);
  check('no persona: neutral subtitle', base === 'Monitor and tune your system.', base);

  await load(send, { persona: 'learner' });
  const learnerSub = await subtitle(send);
  check('learner: subtitle says AI is handling it', /OMEN AI is handling/.test(learnerSub), learnerSub);

  await load(send, { persona: 'tinkerer' });
  const tinkererSub = await subtitle(send);
  check('tinkerer: subtitle leads with manual control', /manual control/i.test(tinkererSub), tinkererSub);

  await load(send, { persona: 'minimalist' });
  const minimalSub = await subtitle(send);
  check('minimalist: short glance subtitle', /quick look/i.test(minimalSub), minimalSub);
  check('all four subtitles differ', new Set([base, learnerSub, tinkererSub, minimalSub]).size === 4);

  // ── OMEN AI modal: pre-onboarding baseline ─────────────────────────────────
  await load(send, { modal: 'omenai' });
  let s = await evalJs(send, AI_SNAP);
  check('no persona: 10 games, Performance/Quality only', s?.games === 10 && JSON.stringify(s?.goals) === JSON.stringify(['Performance', 'Quality']), s?.goals.join('/'));
  check('no persona: 6 optimizing (seed data untouched)', s?.optimizing === 6, String(s?.optimizing));
  check('no persona: every game keeps its tuning body', s?.bodies === 10 && s?.reverts === 10, `bodies=${s?.bodies} reverts=${s?.reverts}`);
  check('no persona: no Auto note', s?.autoNotes === 0);

  // ── learner: everything on, Auto goal, no FPS target ───────────────────────
  await load(send, { persona: 'learner', modal: 'omenai' });
  s = await evalJs(send, AI_SNAP);
  check('learner: Auto offered first', JSON.stringify(s?.goals) === JSON.stringify(['Auto', 'Performance', 'Quality']), s?.goals.join('/'));
  // 9, not 10: seeding never re-enables a profile that was explicitly reverted
  // (Overwatch 2) — a guided default must not undo a deliberate opt-out.
  check('learner: 9 of 10 games optimizing by default', s?.optimizing === 9, String(s?.optimizing));
  check('learner: the reverted game stays off and keeps its Reverted badge',
    await evalJs(send, `(() => {
      const g = [...document.querySelectorAll('.omenai-modal .ai-games-list > .ds-settings-group')]
        .find(el => /Overwatch/.test(el.querySelector('.ds-settings-group-title')?.textContent ?? ''));
      return !!g && g.querySelector('.ds-toggle')?.classList.contains('off')
             && /Reverted/.test(g.querySelector('.ds-badge')?.textContent ?? '');
    })()`));
  check('learner: every game on the Auto goal → 10 takeover notes', s?.autoNotes === 10, String(s?.autoNotes));
  check('learner: Auto hides the Target FPS row', s?.fpsRows === 0, String(s?.fpsRows));
  check('learner: intro copy is the plain-language one', /takes care of your game settings/.test(s?.intro ?? ''), s?.intro);
  // The intro panel used to hardcode "2 games tracked" / 5 / 2, which now
  // contradicts a persona that turns nearly everything on.
  const activeStat = (snap) => snap?.introStats.find(([l]) => l === 'Active Profiles')?.[1];
  const trackedStat = (snap) => snap?.introStats.find(([l]) => l === 'Games Tracked')?.[1];
  check('learner: intro stats agree with the live list',
    s?.statusDetail === '9 of 10 games' && activeStat(s) === '9' && trackedStat(s) === '10',
    `${s?.statusDetail} · tracked=${trackedStat(s)} active=${activeStat(s)}`);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/persona-ai-learner.png`, Buffer.from(shot.data, 'base64'));

  // Learner can still take over — picking Performance drops the note + Auto.
  await evalJs(send, `document.querySelector('.ai-games-list > .ds-settings-group .ai-mode-group')
    .querySelectorAll('button')[1].click()`);
  await sleep(350);
  s = await evalJs(send, AI_SNAP);
  check('learner: picking Performance takes over (one fewer Auto note)', s?.autoNotes === 9, String(s?.autoNotes));

  // Toggling a game off must move the intro stat too — proves it's live.
  await evalJs(send, `document.querySelector('.omenai-modal .ai-games-list > .ds-settings-group .ds-toggle').click()`);
  await sleep(350);
  s = await evalJs(send, AI_SNAP);
  check('learner: turning a game off updates the intro stat live',
    s?.optimizing === 8 && s?.statusDetail === '8 of 10 games',
    `${s?.optimizing} / ${s?.statusDetail}`);

  // ── tinkerer: Target FPS forward on every manual goal ──────────────────────
  await load(send, { persona: 'tinkerer', modal: 'omenai' });
  s = await evalJs(send, AI_SNAP);
  check('tinkerer: no Auto goal offered', JSON.stringify(s?.goals) === JSON.stringify(['Performance', 'Quality']), s?.goals.join('/'));
  check('tinkerer: Target FPS shown on all 10 games, not just Quality', s?.fpsRows === 10, String(s?.fpsRows));
  check('tinkerer: seed roster unchanged (6 optimizing)', s?.optimizing === 6, String(s?.optimizing));
  check('tinkerer: intro copy is the technical one', /cross-references telemetry/.test(s?.intro ?? ''), s?.intro);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/persona-ai-tinkerer.png`, Buffer.from(shot.data, 'base64'));

  // ── minimalist: on/off list only ───────────────────────────────────────────
  await load(send, { persona: 'minimalist', modal: 'omenai' });
  s = await evalJs(send, AI_SNAP);
  check('minimalist: all 10 games still listed', s?.games === 10, String(s?.games));
  check('minimalist: no per-game tuning body', s?.bodies === 0 && s?.reverts === 0, `bodies=${s?.bodies} reverts=${s?.reverts}`);
  check('minimalist: toggles remain (the list is still actionable)',
    (await evalJs(send, `document.querySelectorAll('.omenai-modal .ai-games-list .ds-toggle').length`)) === 10);
  check('minimalist: intro copy is the short one', /keeps your games tuned in the background/.test(s?.intro ?? ''), s?.intro);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/persona-ai-minimalist.png`, Buffer.from(shot.data, 'base64'));

  // ── the goal a persona can't reach is never persisted ─────────────────────
  // A learner who picked Auto then switches persona must not keep an `auto`
  // goal no other persona offers — the reseed effect covers it.
  await load(send, { persona: 'tinkerer', modal: 'omenai' });
  s = await evalJs(send, AI_SNAP);
  check('tinkerer: no Auto goal survives from a learner session', s?.autoNotes === 0 && !s?.goals.includes('Auto'), s?.goals.join('/'));

  // Leave storage clean for the other suites.
  await evalJs(send, `localStorage.removeItem('persona'); localStorage.removeItem('perform-sections');`);

  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

// CDP walkthrough for the Audio tab's EQ preset — the one Audio control a mode
// remembers (profile-proposal-2026-07.md:56). Volume is asserted NOT to follow,
// because that table puts it on the other side on purpose.
// Addresses come from the environment (PORT / CDP), defaults kept for the
// worktree this was written in. A port baked into a check is a check that dies
// the day its worktree does — fourteen of them were stranded that way
// (2026-08-24, same fix applied to verify-arrange-return).
import WebSocket from 'ws';

const PORT = process.env.PORT || 5193;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CDP = process.env.CDP || 9222;
const httpJson = (p) => fetch(`http://localhost:${CDP}` + p).then((r) => r.json());

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

// What the Audio tab is showing, plus the two stores this feature writes.
const SNAP = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  // Row-scoped, not card-scoped (2026-08-28): EQ preset moved INTO the Speaker
  // card (the 73px ragged bottom, SPEC: tab-card-rows' merge rule), so "every
  // button in the section" now also catches Mute. The label's own field is the
  // stable anchor either way.
  const eqLab = [...c.querySelectorAll('.ds-ng3-label')].find(e => e.textContent.trim() === 'EQ preset');
  const seg = eqLab ? (eqLab.closest('.ds-ng3-field') || eqLab.parentElement) : null;
  const btns = seg ? [...seg.querySelectorAll('button')] : [];
  const on = btns.find(b => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true' || b.classList.contains('active') || b.dataset.selected === 'true');
  return {
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map(b => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    eqValues: btns.map(b => b.textContent.trim()),
    eq: on ? on.textContent.trim() : null,
    volume: c.querySelector('input[type=range]')?.value ?? null,
    // The mode bar is one grouped Dropdown in the tab strip (2026-09-24): its
    // trigger names what drives this monitor.
    modeName: [...c.querySelectorAll('.pb-select .ds-dropdown-label')].map(e => e.textContent.trim()),
    note: c.querySelector('.pb-note')?.textContent.trim() ?? null,
    store: { eq: localStorage.getItem('audioEq'), mode: localStorage.getItem('monitorMode') },
  };
})()`;

const pickMode = (m) => `(async () => {
  // One grouped Dropdown (2026-09-24): the trigger opens the list; the rows
  // are the desk's profile, then this monitor's modes and presets.
  const trig = document.querySelector('.pb-select .ds-dropdown-trigger');
  if (!trig) return 'no mode bar';
  trig.click();
  await new Promise(r => setTimeout(r, 320));
  const opt = [...document.querySelectorAll('.pb-select .ds-list-item')]
    .find(o => o.querySelector('.ds-list-item-label')?.textContent.trim() === '${m}');
  if (!opt) return 'no option ' + '${m}';
  opt.click();
  return 'ok';
})()`;

const pickEq = (v) => `(() => {
  const lab = [...document.querySelectorAll('.ds-ng3-label')].find(e => e.textContent.trim() === 'EQ preset');
  const seg = lab && (lab.closest('.ds-ng3-field') || lab.parentElement);
  const b = seg && [...seg.querySelectorAll('button')].find(x => x.textContent.trim() === '${v}');
  if (!b) return 'no eq ' + '${v}';
  b.click();
  return 'ok';
})()`;

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  // Fresh install, Audio tab.
  await send('Page.navigate', { url: `http://localhost:${PORT}/?r=1#/?sku=treehouse-32&tab=audio` });
  await sleep(1200);
  await evalJs(send, `localStorage.clear()`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/?r=2#/?sku=treehouse-32&tab=audio` });
  await sleep(1400);
  let s = await evalJs(send, SNAP);
  console.log('tabs:', s?.tabs?.join('/'), '| title:', s?.title, '| eq values:', s?.eqValues?.join('/'), '| eq:', s?.eq, '| modes shown:', s?.modeName?.join('/'));
  check('Audio tab open', s?.title === 'Audio', String(s?.title));
  check('fresh install shows the first EQ value, nothing stored',
    s?.eq === s?.eqValues?.[0] && !s?.store.eq, `eq=${s?.eq} store=${s?.store.eq}`);
  const vol0 = s?.volume;

  // Work + Music → filed under Work
  console.log('pickMode(Work):', await evalJs(send, pickMode('Work')));
  await sleep(500);
  console.log('pickEq(Music):', await evalJs(send, pickEq('Music')));
  await sleep(400);
  s = await evalJs(send, SNAP);
  check('Work: picking Music files it under Work (quiet save)',
    s?.eq === 'Music' && /"Work":"Music"/.test(String(s?.store.eq)), `eq=${s?.eq} store=${s?.store.eq}`);
  check('the quiet save leaves a receipt', /saved/i.test(String(s?.note)), String(s?.note));

  // Game has nothing stored yet, so it leaves the speakers where they are —
  // there is no researched per-mode default, and inventing one here would be
  // deciding by code what no document decided.
  console.log('pickMode(Game):', await evalJs(send, pickMode('Game')));
  await sleep(600);
  s = await evalJs(send, SNAP);
  check('a mode with nothing stored leaves the preset alone', s?.eq === 'Music', `eq=${s?.eq}`);
  check('Volume did not follow the mode', s?.volume === vol0, `${vol0} → ${s?.volume}`);

  // Give Game one of its own, then prove the two modes hold different presets.
  console.log('pickEq(Video):', await evalJs(send, pickEq('Video')));
  await sleep(400);
  console.log('pickMode(Work):', await evalJs(send, pickMode('Work')));
  await sleep(600);
  s = await evalJs(send, SNAP);
  check('Work: Music returns', s?.eq === 'Music', `eq=${s?.eq}`);
  console.log('pickMode(Game):', await evalJs(send, pickMode('Game')));
  await sleep(600);
  s = await evalJs(send, SNAP);
  check('Game: its own Video returns', s?.eq === 'Video', `eq=${s?.eq}`);
  console.log('pickMode(Work):', await evalJs(send, pickMode('Work')));
  await sleep(600);

  // Reset — the EQ write alone is enough to make the mode "personalised", and
  // Reset has to clear it or a reset mode would come back holding a preset.
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Settings')?.click()`);
  await sleep(500);
  const resetSeen = await evalJs(send, `(() => {
    // Inside the panel body: the mode bar's Dropdown (tab strip) keeps its
    // "Work" row mounted while closed, and it has no Reset button (2026-09-24).
    const row = [...document.querySelectorAll('.dc-canvas .ds-ng3-body .ds-list-item')].find(r => r.textContent.includes('Work'));
    return !!(row && [...row.querySelectorAll('button')].some(b => b.textContent.trim() === 'Reset'));
  })()`);
  check('the EQ write alone marks Work as personalised (Reset offered)', resetSeen === true, String(resetSeen));
  await evalJs(send, `(() => {
    // Inside the panel body: the mode bar's Dropdown (tab strip) keeps its
    // "Work" row mounted while closed, and it has no Reset button (2026-09-24).
    const row = [...document.querySelectorAll('.dc-canvas .ds-ng3-body .ds-list-item')].find(r => r.textContent.includes('Work'));
    [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Reset')?.click();
  })()`);
  await sleep(400);
  await evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === 'Audio')?.click()`);
  await sleep(450);
  s = await evalJs(send, SNAP);
  // The store default is empty, so the tab resolves back to the SKU's first
  // value — a reset that left the sound as it was would claim work it did not do.
  check('Reset clears the stored EQ and the preset changes on screen',
    !/"Work"/.test(String(s?.store.eq)) && s?.eq === s?.eqValues?.[0], `eq=${s?.eq} store=${s?.store.eq}`);

  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FAILED` : `\nall ${results.length} passed`);
  ws.close();
  process.exit(bad.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

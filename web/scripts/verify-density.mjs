// CDP walkthrough for the Appearance > Density setting.
//
// The whole feature is one token re-point: `html[data-density='compact']` sets
// --gutter to the tablet step, and every padding/margin/gap in the system reads
// that token. So the thing worth testing is the indirection — that the setting
// reaches the token, the token reaches real layout, and comfortable stays the
// default with no attribute at all. None of that is visible to the type checker.
// Dev server :5175, headless Chrome :9222, run from web/.
import WebSocket from 'ws';

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

// Gutter token + a couple of places that actually consume it, so a passing
// token value can't hide a layout that ignored it.
const SNAP = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const pad = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).padding : null; };
  const gap = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).gap : null; };
  return {
    attr: document.documentElement.dataset.density ?? null,
    gutter: cs.getPropertyValue('--gutter').trim(),
    gutterSm: cs.getPropertyValue('--gutter-sm').trim(),
    stored: localStorage.getItem('density'),
    widgetPad: pad('.w'),
    boardGap: gap('.wb-grid'),
    docHeight: document.documentElement.scrollHeight,
  };
})()`;

let loadN = 0;
async function load(send, hash) {
  await send('Page.navigate', { url: `http://localhost:5175/?r=${++loadN}#${hash}` });
  await waitFor(send, `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`);
}

/** Click a labelled button in the open Settings modal. */
const clickLabel = (send, text) =>
  evalJs(send, `[...document.querySelectorAll('.settings-modal button')]
    .find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await evalJs(send, `localStorage.removeItem('density')`);

  // ── Comfortable is the default, and carries no attribute ─────────────────
  await load(send, '/');
  await waitFor(send, `document.querySelector('.w')`);
  let s = await evalJs(send, SNAP);
  const comfortable = s;
  check('default is comfortable — no data-density attribute at all', s.attr === null, `attr=${s.attr}`);
  check('default gutter is the 24px comfortable step', s.gutter === '24px', s.gutter);
  check('default: real layout consumes it (widget padding, board gap)',
    s.widgetPad === '24px' && s.boardGap === '24px', `pad=${s.widgetPad} gap=${s.boardGap}`);

  // ── The control lives in Settings > Appearance ───────────────────────────
  await load(send, '/?modal=settings');
  await waitFor(send, `document.querySelector('.settings-modal')`);
  check('Appearance has a Density row', await evalJs(send,
    `[...document.querySelectorAll('.settings-modal')].some(m => /Density/.test(m.textContent))`));
  check('it offers exactly Comfortable and Compact', await evalJs(send,
    `['Comfortable','Compact'].every(l => [...document.querySelectorAll('.settings-modal button')]
      .some(b => b.textContent.trim() === l))`));

  // ── Compact re-points the token, live ────────────────────────────────────
  await clickLabel(send, 'Compact');
  await waitFor(send, `document.documentElement.dataset.density === 'compact'`);
  s = await evalJs(send, SNAP);
  check('compact: attribute set and the token re-points to the tablet step',
    s.attr === 'compact' && s.gutter === '12px', `attr=${s.attr} gutter=${s.gutter}`);
  check('compact: the smaller steps are deliberately untouched', s.gutterSm === '16px', s.gutterSm);
  check('compact: persisted for next launch', s.stored === 'compact', String(s.stored));

  // ── …and that reaches actual layout, not just the token ──────────────────
  await load(send, '/');
  await waitFor(send, `document.querySelector('.w')`);
  s = await evalJs(send, SNAP);
  check('compact survives a reload', s.attr === 'compact' && s.gutter === '12px', `${s.attr}/${s.gutter}`);
  check('compact: widget padding and board gap both halve',
    s.widgetPad === '12px' && s.boardGap === '12px', `pad=${s.widgetPad} gap=${s.boardGap}`);
  check('compact: the page genuinely gets shorter',
    s.docHeight < comfortable.docHeight,
    `${comfortable.docHeight}px → ${s.docHeight}px`);

  // ── Back to comfortable clears the attribute rather than setting one ─────
  await load(send, '/?modal=settings');
  await waitFor(send, `document.querySelector('.settings-modal')`);
  await clickLabel(send, 'Comfortable');
  await waitFor(send, `!document.documentElement.dataset.density`);
  s = await evalJs(send, SNAP);
  check('comfortable removes the attribute — absence IS the default',
    s.attr === null && s.gutter === '24px', `attr=${s.attr} gutter=${s.gutter}`);

  // ── Density and theme are independent axes ───────────────────────────────
  await clickLabel(send, 'Compact');
  await waitFor(send, `document.documentElement.dataset.density === 'compact'`);
  await clickLabel(send, 'Light');
  await waitFor(send, `document.documentElement.classList.contains('light')`);
  s = await evalJs(send, SNAP);
  check('density is orthogonal to theme — light + compact hold together',
    s.attr === 'compact' && s.gutter === '12px', `attr=${s.attr} gutter=${s.gutter}`);

  await evalJs(send, `localStorage.removeItem('density'); localStorage.setItem('theme','dark')`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

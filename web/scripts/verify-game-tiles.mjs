// CDP check for the game library's tiles (#/play → My Games).
//
// Why this suite exists: v0.2.27 shipped a silent regression nothing watched.
// The Quick Control tile was added to shared/components.css declaring a bare
// `.ds-tile` — the class the thumbnail tile has always used — and, sitting
// later in the file, it put a widget's padding, surface and border on every
// cover in the library. The art shrank inside an empty card and no suite
// noticed, because nothing covered the library at all. This is that cover.
//
// What is protected:
//  1. The library renders tiles at all, with their art.
//  2. The ART FILLS THE TILE. A cover is the whole card; any meaningful gap
//     between the tile box and its art means something is padding the tile.
//  3. No game tile carries the Quick Control shell — the specific way it broke.
//  4. The two namespaces stay apart: nothing in the page is both a game tile
//     and a Quick Control tile.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. Read-only: navigates, writes no storage.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || process.env.CDP || 9222;
const APP_PORT = process.env.APP_PORT || process.env.PORT || 5175;

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

const targets = await httpJson('/json/list');
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error(`no page target on CDP ${CDP_PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on('open', r));
const send = makeSend(ws);
await send('Page.enable');
await send('Runtime.enable');

const pageErrors = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text);
});

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  }
  return result.value;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

try {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  // Warm the route first: against a cold Vite the page is measured before it
  // mounts and every check reads false. See the HANDOFF reference block.
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/play` });
  await sleep(2000);
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/play` });
  await sleep(1800);

  const lib = await evalJs(`(() => {
    const grid = document.querySelector('.library-grid');
    if (!grid) return null;
    const tiles = [...grid.querySelectorAll('.ds-tile')];
    return {
      count: tiles.length,
      withArt: tiles.filter((t) => t.querySelector('.ds-tile-art')).length,
      // How much of the tile box the art does NOT cover, per side.
      gaps: tiles.map((t) => {
        const a = t.querySelector('.ds-tile-art');
        if (!a) return null;
        const r = t.getBoundingClientRect(), b = a.getBoundingClientRect();
        return {
          l: Math.round(b.left - r.left),
          t: Math.round(b.top - r.top),
          r: Math.round(r.right - b.right),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }).filter(Boolean),
      // The exact shape of the v0.2.27 break.
      shelled: tiles.filter((t) => {
        const s = getComputedStyle(t);
        return parseFloat(s.paddingLeft) > 1 || s.borderLeftWidth !== '0px';
      }).length,
      bothNamespaces: tiles.filter((t) => t.classList.contains('ds-quick-tile')).length,
    };
  })()`);

  check('the library renders game tiles', (lib?.count ?? 0) >= 6, String(lib?.count));
  check('every tile has its cover art', lib && lib.count === lib.withArt, `${lib?.withArt}/${lib?.count}`);

  // The art IS the card: a cover that stops short of its own tile means
  // something is padding the tile. 2px of tolerance for subpixel rounding.
  const padded = (lib?.gaps ?? []).filter((g) => g.l > 2 || g.t > 2 || g.r > 2);
  check('the art fills the tile — nothing pads the cover',
    padded.length === 0,
    padded.length ? `${padded.length} of ${lib.gaps.length} inset, e.g. ${JSON.stringify(padded[0])}` : '');

  check('no game tile wears the Quick Control shell (padding / border)',
    lib?.shelled === 0, `${lib?.shelled} of ${lib?.count}`);
  check('the two tile namespaces stay apart', lib?.bothNamespaces === 0, String(lib?.bothNamespaces));

  // A tile is still a 2:3 cover, not a squashed or stretched box.
  const ratios = (lib?.gaps ?? []).map((g) => +(g.h / g.w).toFixed(2));
  check('tiles keep a portrait cover proportion',
    ratios.length > 0 && ratios.every((r) => r > 1.2 && r < 1.8),
    ratios.slice(0, 4).join(' · '));

  check('no page exceptions throughout', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

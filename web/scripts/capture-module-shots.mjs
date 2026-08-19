// Capture real screenshots of each module's live surface for the Module Browser.
// These become Assets/modules/<id>.webp (the store hero art, detail bands, and
// card banners). Re-run whenever a module's surface changes.
//
//   1. npx vite --port 5175                       # dev server
//   2. "Google Chrome" --headless=new --remote-debugging-port=9222 \
//        --use-gl=angle --use-angle=swiftshader   # software WebGL for Light Studio
//   3. node web/scripts/capture-module-shots.mjs /tmp/mod-shots [ids…]  (run from web/)
//   4. for f in …; do cwebp -q 80 -resize 1600 0 /tmp/mod-shots/$f.png \
//        -o ../Assets/modules/$f.webp; done
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5175/';
const OUT = process.argv[2] || '/tmp/mod-shots';
const ONLY = process.argv.slice(3); // optional list of ids to (re)capture
const VW = 1440, VH = 900, DSF = 2;

// Every shot is a framed 1440×900 viewport centered on the module's surface —
// a consistent, store-quality set. `scroll` centers a below-the-fold surface;
// `prep` runs before waiting (e.g. force-load lazy images).
const SHOTS = [
  { id: 'omenai',      hash: '#/?modal=omenai',  wait: '.omenai-modal' },
  { id: 'booster',     hash: '#/?modal=booster', wait: '.booster-modal' },
  { id: 'vitals',      hash: '#/?modal=vitals',  wait: '.vitals-modal', settle: 900 },
  { id: 'shop',        hash: '#/shop',           wait: '.page-title' },
  { id: 'lightstudio', hash: '#/personalize',    wait: '.ls-viewport.ls-loaded', scroll: '.ls-stage', settle: 1500 },
  { id: 'gallery',     hash: '#/play',           wait: '.gal-img',
    prep: `document.querySelectorAll('.gal-img').forEach(i=>{i.loading='eager'})`,
    scroll: '.gal-grid', settle: 1400 },
  // System Cleaner + Fan Cleaner share the Perform → Maintenance surface.
  { id: 'cleaner',     hash: '#/perform', scroll: 'MAINT', wait: '.feature-card-grid', settle: 500 },
  { id: 'fancleaner',  hash: '#/perform', scroll: 'MAINT', wait: '.feature-card-grid', settle: 500 },
];

// Locate the Maintenance section's card grid (Perform has several grids).
const MAINT_EL = `(() => {
  const sec = [...document.querySelectorAll('.rs-section')].find(s => s.textContent.trim().startsWith('Maintenance'));
  return sec ? sec.querySelector('.feature-card-grid') : null;
})()`;

const httpJson = (p) => fetch('http://localhost:9222' + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function waitFor(send, sel, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalJs(send, `!!document.querySelector(${JSON.stringify(sel)})`)) return true;
    await sleep(200);
  }
  return false;
}

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DSF, mobile: false });

  const shots = ONLY.length ? SHOTS.filter((s) => ONLY.includes(s.id)) : SHOTS;
  for (const shot of shots) {
    try {
      // Reset to a blank hash first so a stale scroll position / prior modal doesn't bleed through.
      await evalJs(send, `location.hash = '#/blank-${shot.id}'`);
      await sleep(150);
      await evalJs(send, `location.hash = ${JSON.stringify(shot.hash.replace('#', ''))}`);
      await sleep(400);
      if (shot.prep) await evalJs(send, shot.prep).catch(() => {});
      const found = shot.wait ? await waitFor(send, shot.wait) : true;
      if (!found) { console.log(`✗ ${shot.id}: waited for ${shot.wait}, not found`); continue; }
      if (shot.scroll) {
        const expr = shot.scroll === 'MAINT' ? MAINT_EL : `document.querySelector(${JSON.stringify(shot.scroll)})`;
        await evalJs(send, `(${expr})?.scrollIntoView({block:'center'})`);
      }
      await sleep(shot.settle || 500);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(`${OUT}/${shot.id}.png`, Buffer.from(data, 'base64'));
      console.log(`✓ ${shot.id} → ${OUT}/${shot.id}.png`);
    } catch (e) {
      console.log(`✗ ${shot.id}: ${e.message}`);
    }
  }
  ws.close();
}
main().catch((e) => { console.error(e); process.exit(1); });

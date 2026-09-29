// Quick CDP screenshot helper for eyeballing a surface during development:
//   node scripts/dev-shot.mjs '<hash>' <outfile.png> ['<prep js>']
// e.g. node scripts/dev-shot.mjs '/?sku=relay-01&tab=clips' /tmp/relay.png
// Dev server :5175 (PORT env overrides), headless Chrome :9222 — the same
// harness the verify-*.mjs suites use, minus the checks.
import WebSocket from 'ws';
import { writeFileSync } from 'fs';

const [, , loc = '/', out = 'shot.png', prep = ''] = process.argv;
const PORT = process.env.PORT || '5175';
const httpJson = (p) => fetch(`http://localhost:${process.env.CDP || 9222}` + p).then((r) => r.json());

let msgId = 0;
const targets = await httpJson('/json');
// Chrome may hold pages from OTHER checkouts/ports (e.g. the old repo on
// :5175) — always pick the tab on OUR port, or localStorage reads/writes and
// clicks land on the wrong origin entirely.
const page =
  targets.find((t) => t.type === 'page' && t.url.includes(`localhost:${PORT}`)) ??
  targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
};
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.W || 1440), height: Number(process.env.H || 900), deviceScaleFactor: 2, mobile: false });
// Router params live inside the hash (HashRouter); ?r busts SPA-state reuse.
await send('Page.navigate', { url: `http://localhost:${PORT}/?r=${Date.now() % 1e7}#${loc}` });
for (let i = 0; i < 60; i++) { if (await evalJs(`document.readyState === 'complete' && !!document.querySelector('.shell, .dc-canvas, main')`)) break; await new Promise((r) => setTimeout(r, 100)); }
if (prep) { await evalJs(prep); }
await new Promise((r) => setTimeout(r, 600));
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(data, 'base64'));
console.log('saved', out);
ws.close();

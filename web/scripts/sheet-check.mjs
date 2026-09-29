// Sheet check (make-sheet 4-b/4-c): light+dark render, a11y-check.js, press a checkbox, reload, confirm it stuck.
// Run from web/ (needs `ws`): CDP=9235 node scripts/sheet-check.mjs <out-dir>
import WebSocket from 'ws';
import { readFileSync, writeFileSync } from 'node:fs';
const CDP = process.env.CDP || '9235', OUT = process.argv[2] || '.';
const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
let id = 0;
const send = (method, params = {}) => new Promise((res) => { const i = ++id; ws.on('message', function h(d) { const j = JSON.parse(d); if (j.id === i) { ws.off('message', h); res(j.result); } }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); };
await send('Page.enable'); await send('Page.reload', { ignoreCache: true }); await sleep(1500);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }); await sleep(300); await shot('sheet-light');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await sleep(300); await shot('sheet-dark');
const a11y = readFileSync('/Users/cindyjung/Shared Assets/a11y-check.js', 'utf8');
await send('Runtime.enable');
const logs = [];
ws.on('message', (d) => { const j = JSON.parse(d); if (j.method === 'Runtime.consoleAPICalled') logs.push(j.params.args.map((a) => a.value ?? a.description).join(' ')); });
const res = await ev(a11y);
await sleep(300);
console.log('a11y:', JSON.stringify(res && typeof res === 'object' ? Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Array.isArray(v) ? v.slice(0, 4) : v])) : res).slice(0, 900));
console.log('a11y console:', logs.join(' | ').slice(0, 700));
await ev(`(() => { const cb = document.querySelector('input[type=checkbox][data-c]'); cb.click(); return cb.checked; })()`);
await send('Page.reload'); await sleep(1500);
console.log('checkbox after reload:', JSON.stringify(await ev(`(() => { const cb = document.querySelector('input[type=checkbox][data-c]'); return { checked: cb.checked, done: cb.closest('li').classList.contains('done'), msg: document.querySelector('.nl-msg')?.textContent || '' }; })()`)));
await ev(`(() => { const cb = document.querySelector('input[type=checkbox][data-c]'); if (cb.checked) cb.click(); })()`);
ws.close();

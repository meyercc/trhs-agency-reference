// One-shot geometry + text probe for Personalize → Display (2026-09-13).
// Run: PORT=5178 CDP=9233 node scripts/measure-personalize.mjs   (Chrome with software WebGL)
import WebSocket from 'ws';
const PORT = process.env.PORT || '5178', CDP = process.env.CDP || '9233';
const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
let id = 0;
const send = (method, params = {}) => new Promise((res) => { const i = ++id; ws.on('message', function h(d) { const j = JSON.parse(d); if (j.id === i) { ws.off('message', h); res(j.result); } }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await ev('localStorage.clear()');
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}#/personalize` });
for (let i = 0; i < 20; i++) { await sleep(1000); if (await ev(`!!document.querySelector('.dov-stage')`)) break; }
await sleep(800);
const out = await ev(`(() => {
  const n = document.querySelector('.sa-note');
  const cs = n && getComputedStyle(n);
  const rail = document.querySelector('.pg-rail');
  const st = document.querySelector('.dov-stage').getBoundingClientRect();
  const fit = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.dov-group')).transform).a;
  const nb = Math.max(...[...document.querySelectorAll('.dov-name')].map((x) => x.getBoundingClientRect().bottom));
  const ht = Math.min(...[...document.querySelectorAll('.dov-shot, .dov-slab')].map((x) => x.getBoundingClientRect().top));
  return {
    note: n ? { clip: n.scrollWidth > n.clientWidth + 1, lines: Math.round(n.getBoundingClientRect().height / parseFloat(cs.lineHeight)), type: cs.fontSize + '/' + cs.fontWeight } : null,
    columnBottoms: rail ? [...rail.children].map((k) => Math.round(k.getBoundingClientRect().bottom)) : null,
    stageH: Math.round(st.height), fit: +fit.toFixed(2), gapAbove: Math.round(ht - st.top), gapBelow: Math.round(st.bottom - nb),
    cards: [...document.querySelectorAll('.w')].map((el) => ({ name: (el.querySelector('.w-label-text')?.textContent || '').trim(), h: Math.round(el.getBoundingClientRect().height) })),
  };
})()`);
console.log(JSON.stringify(out));
ws.close();

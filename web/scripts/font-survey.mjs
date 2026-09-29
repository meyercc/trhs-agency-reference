// Font survey — which face each kind of text wears, per page (2026-09-13).
// Run: PORT=5178 CDP=9233 node scripts/font-survey.mjs '#/' '#/perform' ...
// Chrome must be launched with software WebGL (see verify-desk-card.mjs header).
import WebSocket from 'ws';
const PORT = process.env.PORT || '5178', CDP = process.env.CDP || '9233';
const routes = process.argv.slice(2);
const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
let id = 0;
const send = (method, params = {}) => new Promise((res) => { const i = ++id; ws.on('message', function h(d) { const j = JSON.parse(d); if (j.id === i) { ws.off('message', h); res(j.result); } }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COLLECT = `(() => {
  const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const rows = new Map();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim(); if (!t) continue;
    const el = n.parentElement; if (!el || !vis(el)) continue;
    const cs = getComputedStyle(el);
    const font = cs.fontFamily.split(',')[0].replace(/["']/g, '');
    const cls = (e) => (typeof e.className === 'string' ? e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
    const key = [font, cs.fontSize, cs.fontWeight, cs.textTransform, cls(el) + ' < ' + cls(el.parentElement)].join('|');
    const row = rows.get(key) || { font, size: cs.fontSize, weight: cs.fontWeight, tt: cs.textTransform, cls: cls(el) + ' < ' + cls(el.parentElement), n: 0, chars: 0, ex: t.slice(0, 26) };
    row.n++; row.chars += t.length; rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.chars - a.chars);
})()`;
for (const route of routes) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}${route}` });
  await sleep(10000);
  const rows = await ev(COLLECT);
  const tot = {}; rows.forEach((r) => { tot[r.font] = (tot[r.font] || 0) + r.chars; });
  console.log(`\n=== ${route}  chars: ${Object.entries(tot).map(([f, c]) => `${f} ${c}`).join(' · ')}`);
  rows.slice(0, 22).forEach((r) => console.log(`${String(r.n).padStart(3)}× ${r.font.padEnd(9)} ${r.size.padEnd(5)} ${r.weight} ${r.tt.padEnd(9)} ${r.cls.padEnd(44).slice(0, 44)} "${r.ex}"`));
}
ws.close();

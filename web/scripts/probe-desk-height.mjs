// One number, on demand: how tall is the Personalize desk card drawn, and where
// does the computer stand? Used to attribute a height change to ONE variable at
// a time (2026-09-04) instead of inferring cause from a full-suite diff.
//
//   PORT=5178 CDP=9333 node scripts/probe-desk-height.mjs
import WebSocket from 'ws';

// Desk hardware — the Admin axis since 2026-09-08. `displayCount`/`pcCount` are
// gone; the desk is a LIST of optional devices (`deskDevices`) and the numbers
// are derived. This maps the (screens, PCs) pairs these checks were written in
// onto the real desks: 3 screens = OMEN + laptop lid + Treehouse; 2 = laptop
// lid + Treehouse; 1 = the tower alone with the Treehouse (a laptop on the desk
// brings its screen, so a one-screen desk has no laptop). PCs 1 drops the tower.
const DESK = (screens, pcs = 2) => JSON.stringify(
  screens >= 3 ? ['pulse-27', 'macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : screens === 2 ? ['macbook', ...(pcs >= 2 ? ['tower'] : [])]
  : ['tower']);

const PORT = process.env.PORT || '5178';
const CDP = process.env.CDP || '9333';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tabs = await fetch(`http://localhost:${CDP}/json`).then((r) => r.json());
const page = tabs.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1150, deviceScaleFactor: 1, mobile: false });
const load = async () => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?r=${Date.now()}#/personalize` });
  for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector('.dov-stage')`)) break; await sleep(250); }
  await sleep(1500);
};
await load();
// RESET=1 reproduces verify-desk-card's section 1 ("one-row"): no saved layout,
// no KVM. Without it the probe reads whatever the browser last left behind,
// which is a different desk and therefore a different height.
if (process.env.RESET) {
  await ev(`localStorage.removeItem('displayArrange'); localStorage.removeItem('kvm');`);
  await load();
}

const out = await ev(`(() => {
  const st = document.querySelector('.dov-stage');
  if (!st) return { error: 'no .dov-stage' };
  const sr = st.getBoundingClientRect();
  const slab = st.querySelector('.dov-slab, .dov-pc, [class*="slab"]');
  const tiles = [...st.querySelectorAll('.dov-disp')].map((t) => {
    const r = t.getBoundingClientRect();
    return { name: (t.textContent || '').trim().slice(0, 18), l: Math.round(r.left - sr.left), t: Math.round(r.top - sr.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const s = slab && slab.getBoundingClientRect();
  return {
    stage: { w: Math.round(sr.width), h: Math.round(sr.height) },
    slab: s ? { cls: slab.className, l: Math.round(s.left - sr.left), t: Math.round(s.top - sr.top), w: Math.round(s.width), h: Math.round(s.height) } : null,
    tiles,
  };
})()`);
console.log(JSON.stringify(out, null, 1));
// Put the browser back the way it was found. This profile is shared with the
// verify suites, and a leftover `deskDevices` from a measurement makes the next
// run fail on a desk nobody asked for (2026-09-04, one wasted run).
await ev(`localStorage.removeItem('displayArrange'); localStorage.setItem('deskDevices','${DESK(3, 2)}');`);
ws.close();

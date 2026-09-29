// Change the desk while a desk picture is open, then reload — the two pictures
// must be the same.
//
// Why this file exists (2026-09-23, Cindy: «모니터 두 대에서 한 대로 바꿨을 때
// 갑자기 중간에 붕 떠 있어»): with the Treehouse 32 window open, switching the
// Admin `Display scenario` dropped the missing display but left the rest where
// they stood — a hole, the group parked to one side, the zoom still sized for the
// old desk. The Personalize DESK card did the same. Every desk check in this
// folder writes `deskDevices` and RELOADS before measuring, so none of them could
// see it: the bug only lives between one desk and the next, on a page that stays
// open. This check is that missing axis: it presses the Admin menu at its pixels
// with the picture mounted, measures, reloads the same address, measures again.
//
// Run: dev server + headless Chrome with --remote-debugging-port, from web/:
//   PORT=5178 CDP=9251 node scripts/verify-live-desk.mjs
// QUIET=1 prints only ✗ lines and the total. Exit 1 on any ✗. Never edits the app.
import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = process.env.PORT || '5178';
const CDP = process.env.CDP || '9251';
const OUT_DIR = process.env.OUT_DIR || join(homedir(), 'Treehouse-monitor/design-loop/reports');
const QUIET = !!process.env.QUIET;
const TOL = 2; // px — sub-pixel rounding, not a layout difference
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
let msgId = 0;
const pend = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++msgId; pend.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
};
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, pointerType: 'mouse' });
const press = async (sel, pick = '') => {
  const p = await ev(`(() => { const el = ${pick || `document.querySelector(${JSON.stringify(sel)})`}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2 }; })()`);
  if (!p) throw new Error(`nothing to press: ${sel}`);
  await mouse('mouseMoved', p.x, p.y); await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y);
};
const waitFor = async (sel, ms = 15000) => {
  for (let t = 0; t < ms; t += 250) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return; await sleep(250); }
  throw new Error(`never appeared: ${sel}`);
};

// The desk pictures. Each child of the group is keyed by what it is, and measured
// from the stage the group is centred in — so a group parked off-centre shows up.
const SURFACES = [
  { name: 'Treehouse 32 window (hero)', url: '#/?sku=treehouse-32', group: '.dsa-group', disp: '.dsa-disp', tile: '.dsa-bounds', label: '.dsa-name',
    key: `(e) => e.dataset.display || [...e.classList].find((c) => /^dsa-(tower|slab|floor)/.test(c)) || e.className.split(' ')[0]` },
  { name: 'Personalize DESK card', url: '#/personalize', group: '.dov-group', disp: '.dov-disp', tile: '.dov-shot', label: '.dov-name',
    key: `(e) => [...e.classList].find((c) => /^d-/.test(c)) || e.className.split(' ')[0]` },
];
const measure = (s) => ev(`(() => { const g = document.querySelector(${JSON.stringify(s.group)}); if (!g) return null; const S = g.parentElement.getBoundingClientRect(); const key = ${s.key}; const out = {}; for (const e of g.children) { const r = e.getBoundingClientRect(); if (r.width < 2) continue; out[key(e)] = [r.left - S.left, r.right - S.left, r.bottom - S.top].map(Math.round); } return out; })()`);
const settle = async (s) => { let prev = ''; for (let i = 0; i < 16; i++) { await sleep(250); const m = JSON.stringify(await measure(s)); if (m === prev && m !== 'null') return JSON.parse(m); prev = m; } return JSON.parse(prev); };

// A chain through every scenario: removes a monitor, swaps the tower for a
// monitor, removes one again, then adds two back — both directions of change.
const CHAIN = [['Laptop + desktop', '1 monitor'], ['Laptop', '2 monitors'], ['Laptop', '1 monitor'], ['Laptop + desktop', '2 monitors']];

let n = 0;
// Wait for THIS navigation's URL: right after Page.navigate the old document can
// still answer, and a group from the page being left would be measured.
const go = async (url) => { const v = ++n; await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${v}${url}` }); for (let i = 0; i < 60 && (await ev(`new URLSearchParams(location.search).get('v')`).catch(() => '')) !== String(v); i++) await sleep(250); };
const bad = [], good = [];
const say = (ok, line) => { (ok ? good : bad).push(line); if (!QUIET || !ok) console.log(`${ok ? '✓' : '✗'} ${line}`); };

for (const s of SURFACES) {
  await go('#/'); await waitFor('#root');
  await ev(`localStorage.clear(); localStorage.setItem('trhs-modules', JSON.stringify({ lightstudio: false })); true`);
  await go(s.url); await waitFor(s.group);
  let from = 'Laptop + desktop · 2 monitors';
  for (const [group, row] of CHAIN) {
    const to = `${group} · ${row}`;
    const base = s.url.includes('?') ? `${s.url}&modal=admin` : `${s.url}?modal=admin`;
    await ev(`location.hash = ${JSON.stringify(base)}; true`);
    await waitFor('.admin-desk-pick .ds-dropdown-trigger');
    await press('.admin-desk-pick .ds-dropdown-trigger');
    await waitFor('.admin-desk-menu');
    await press(to, `(() => { let g = null; for (const el of document.querySelectorAll('.admin-desk-menu > *')) { const t = el.textContent.trim(); if (el.classList.contains('ds-context-menu-group')) { g = t; continue; } if (el.getAttribute('role') === 'menuitemradio' && g === ${JSON.stringify(group)} && t.startsWith(${JSON.stringify(row)})) return el; } return null; })()`);
    await sleep(300);
    await press('admin close', `document.querySelector('.admin-desk').closest('.modal-shell').querySelector('.modal-close')`);
    const live = await settle(s);
    await go(s.url); await waitFor(s.group);
    const fresh = await settle(s);
    const keys = [...new Set([...Object.keys(live || {}), ...Object.keys(fresh || {})])].sort();
    const diffs = keys.filter((k) => !live?.[k] || !fresh?.[k] || live[k].some((v, i) => Math.abs(v - fresh[k][i]) > TOL))
      .map((k) => `${k} ${live?.[k] ? live[k].join('/') : '없음'} → 새로고침 ${fresh?.[k] ? fresh[k].join('/') : '없음'}`);
    say(!diffs.length, `${s.name} · ${from} → ${to}: ${diffs.length ? '열어둔 채 바꾼 그림 ≠ 새로고침 그림 — ' + diffs.join(' · ') + ' (왼/오른/바닥 px)' : `같음 (${keys.length}개)`}`);
    from = to;
  }
}

// ── A layout saved in Arrange with the laptop BELOW a monitor (2026-09-24) ──
// Cindy: «시나리오를 바꾸면 기기들이 이상하게 겹쳐 … 한두 번이 아니다». Reproduced
// only with THIS kind of saved layout — the Arrange drag that puts the Built-in
// Display under the Treehouse 32 (a laptop in front of its monitor, in screen
// terms). The pictures then drew two rows: the Treehouse lifted, a name laid over
// the MacBook. Every earlier check used no saved layout or a monitor-over-monitor
// stack, so none of them could see it. Asked here for every scenario: no name
// sits on another device's picture. (Numbers = the positions that drag saved.)
const LAPTOP_BELOW = { mode: 'extend', space: 'fraction', positions: { 'oled-27': { left: 0.0219, top: 0.137 }, 'treehouse-32': { left: 0.2831, top: 0.0548 }, builtin: { left: 0.1812, top: 0.4041 } } };
const DESKS = [['Laptop + desktop · 2 monitors', ['pulse-27', 'macbook', 'tower']], ['Laptop + desktop · 1 monitor', ['macbook', 'tower']], ['Laptop · 2 monitors', ['pulse-27', 'macbook']], ['Laptop · 1 monitor', ['macbook']]];
// Two window sizes: the check's own and a 14" MacBook Pro's (1512×900) — the
// collision is size-dependent and only showed on the laptop size.
for (const [VW, VH] of [[1440, 1100], [1512, 900]]) {
await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
for (const s of SURFACES) {
  for (const [dname, desk] of DESKS) {
    await go('#/'); await waitFor('#root');
    await ev(`localStorage.clear(); localStorage.setItem('trhs-modules', JSON.stringify({ lightstudio: false })); localStorage.setItem('deskDevices', ${JSON.stringify(JSON.stringify(desk))}); localStorage.setItem('displayArrange', ${JSON.stringify(JSON.stringify(LAPTOP_BELOW))}); true`);
    await go(s.url); await waitFor(s.group); await settle(s);
    const hits = await ev(`(() => { const out = []; const disps = [...document.querySelectorAll(${JSON.stringify(s.disp)})]; for (const d of disps) { const lab = d.querySelector(${JSON.stringify(s.label)}); if (!lab) continue; const L = lab.getBoundingClientRect(); for (const o of disps) { if (o === d) continue; const t = o.querySelector(${JSON.stringify(s.tile)}); if (!t) continue; const T = t.getBoundingClientRect(); const w = Math.min(L.right, T.right) - Math.max(L.left, T.left), h = Math.min(L.bottom, T.bottom) - Math.max(L.top, T.top); if (w > 2 && h > 2) out.push(lab.textContent.trim() + ' 이름표가 ' + ((o.querySelector(${JSON.stringify(s.label)}) || {}).textContent || '?').trim() + ' 그림을 ' + Math.round(w) + '×' + Math.round(h) + 'px 덮음'); } } return out; })()`);
    say(!hits.length, `${s.name} · ${VW}×${VH} · 노트북을 아래에 둔 저장값 · ${dname}: ${hits.length ? hits.join(' · ') : '이름표가 다른 기기를 안 덮음'}`);
  }
}
}

const date = new Date().toISOString().slice(0, 10);
mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, `${date}-live-desk.md`);
writeFileSync(file, `# 책상을 열어둔 채 바꾸기 — ${date}\n\n> \`web/scripts/verify-live-desk.mjs\` · Admin \`Display scenario\`를 픽셀로 눌러 바꾸고, 같은 주소를 새로고침해 비교 · 허용 ${TOL}px · :${PORT}\n> 안 보는 것: OMEN OLED 27 창의 그림 · Arrange 창(열 때마다 새로 그려져 이 축이 없다) · Light Studio(꺼 두고 잰다)\n${bad.length ? `\n## ✗ 다름\n${bad.map((l) => `- ${l}`).join('\n')}\n` : ''}\n## ✓ 같음\n${good.map((l) => `- ${l}`).join('\n')}\n`);
console.log(`\n${bad.length} ✗ · ${good.length} ✓ → ${file}`);
ws.close();
process.exit(bad.length ? 1 : 0);

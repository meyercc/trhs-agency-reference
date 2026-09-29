// Walk one monitor tab the way a hand does — every control pressed at its
// pixel, every ⓘ hovered, every row label counted — and write down what the
// hand would have found.
//
// Why this file exists (2026-09-22, Cindy: "내가 이런 거 다 일일이 너한테 말을
// 해줘야 되니?"): on the Connectivity tab, three Viewing Mode tiles opened the
// X-ray overlay when pressed, `PIP size` saved a value that nothing drew, a
// tooltip painted under the mode bar, and two row labels wrapped while their
// siblings sat on one line. Every one of those had a check nearby that passed —
// because the 26 `verify-*` scripts in this folder press controls with
// `el.click()`, which dispatches to the ELEMENT and never asks what is on top
// of that pixel. The plate's invisible hit box (`.pm-crop .pm`, 135% wide)
// reached 106px into the next column and no script could see it.
//
// So this one clicks the pixel (CDP `Input.dispatchMouseEvent`), the way the
// desk-card check drags, and asks four questions no per-card check asks:
//   1. Is this control actually on top at its own centre? (covered → by what)
//   2. When pressed, did something open that its name did not promise?
//   3. When pressed, did anything change OUTSIDE its own row/group? A control
//      that only changes storage and its own selected state is a dead engine.
//   4. When hovered, is its tooltip on top at the popup's centre?
// Plus two per-card measurements the copy rules want each time, not only when
// a card is next touched: rows whose label wraps while siblings don't, and
// characters ÷ controls (08-19 worst = 88; 09-13 Personalize = 247/159).
//
// Run: dev server on :5178 (CURRENT), headless Chrome with
// --remote-debugging-port, from web/:
//   PORT=5178 CDP=9241 node scripts/verify-tab-walk.mjs connectivity treehouse-32
//   SEED='{"monitorFirstHour":true}' … walks the tab in a state fresh storage never shows
// Report → ~/Treehouse-monitor/design-loop/reports/<date>-tab-walk-<sku>-<tab>.md
// Exit 1 when any 🔴 line exists. Never edits the app.
import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TAB = process.argv[2] || 'connectivity';
const SKU = process.argv[3] || 'treehouse-32';
const PORT = process.env.PORT || '5178';
const CDP = process.env.CDP || '9241';
const OUT_DIR = process.env.OUT_DIR || join(homedir(), 'Treehouse-monitor/design-loop/reports');
// QUIET=1 prints only 🔴/🟠 and the total — the full list is in the report. The
// sweep (verify-walk-all.mjs) runs every surface this way so a clean pass costs
// one line of reading, not one line per control.
const QUIET = !!process.env.QUIET;

// Surfaces that are not a monitor-window tab (2026-09-23, Cindy «셀프 QC 모드
// 그런 거 없어?»). The walker only knew `#/perform?sku=…&tab=…`, so the home
// Treehouse 32 card and its Customize card were never walked — and every toggle
// in that chooser opened the device window behind it. A surface = where to go,
// what to press first (`pre`), the box whose controls are pressed (`root`), and
// where their result lands when that is outside the box (`effect`: a Customize
// toggle redraws the card, not the chooser).
const SURFACES = {
  'home-card': { url: '#/', root: '.ds-devcard.rich' },
  'customize-card': { url: '#/', pre: '.ds-devcard.rich .devw-face-link', root: '.modal-shell-narrow', effect: '.ds-devcard.rich' },
  // Light Studio off: it is three.js, and headless WebGL makes this page crawl. It
  // is Chris's section, not the one walked here.
  'personalize-display': { url: '#/personalize', root: '.pg-rail.pg-rail-fill', seed: { 'trhs-modules': { lightstudio: false } } },
};
const SURF = SURFACES[TAB];
const ROOT = SURF ? SURF.root : '[role="dialog"]';
const READY = SURF ? SURF.root : '[role="dialog"] .ds-ng3-section';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;

const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
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
const crashes = [];
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.method === 'Runtime.exceptionThrown') crashes.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0].slice(0, 160)); });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

const mouse = (type, x, y) => send('Input.dispatchMouseEvent', {
  type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, pointerType: 'mouse',
});
const clickAt = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); };
const escape = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
};

let n = 0;
const has = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const open = async () => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${++n}${SURF ? SURF.url : `#/perform?sku=${SKU}&tab=${TAB}`}` });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    // Right after Page.navigate the OLD document can still answer — a previous
    // run's dialog made READY true at once and the walk read a page that was
    // about to vanish (0 controls, 2026-09-23). Wait for this navigation's own URL.
    if ((await ev(`new URLSearchParams(location.search).get('v')`)) !== String(n)) continue;
    // The chooser is reached the way a hand reaches it: press its door at the pixel.
    if (SURF?.pre && !(await has(ROOT)) && (await has(SURF.pre))) {
      const p = await ev(`(() => { const el = document.querySelector(${JSON.stringify(SURF.pre)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await clickAt(p.x, p.y);
      continue;
    }
    if (await has(READY)) { await sleep(600); return; }
  }
  throw new Error(`${TAB} never rendered`);
};

// ── in-page helpers ──────────────────────────────────────────────────────────
const HELPERS = `
window.__walk = window.__walk || (() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 48);
  const card = (el) => { const s = el.closest('.ds-ng3-section'); if (!s) { const w = el.closest('.w'); const t = w && (w.querySelector('.w-label') || w.querySelector('.devw-title') || w.querySelector('.dov-title')); return (t ? t.textContent.trim().slice(0, 30) : '') || ${JSON.stringify(SURF ? TAB : '(카드 밖)')}; } const l = s.querySelector('.ds-ng3-label'); if (!l) return '(제목 없음)'; const c = l.cloneNode(true); c.querySelectorAll('.ds-tooltip-wrap, .ds-tooltip-popup, .ds-tooltip').forEach((x) => x.remove()); return c.textContent.trim().slice(0, 30) || '(제목 없음)'; };
  const desc = (el) => { if (!el) return 'null'; const id = el.id ? '#' + el.id : ''; const cls = (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.'); const near = el.closest('[aria-label]'); return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '') + (near && near !== el ? ' in [' + near.getAttribute('aria-label').slice(0, 30) + ']' : ''); };
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
  const dialog = () => document.querySelector(${JSON.stringify(ROOT)});
  const groupOf = (el) => el.closest('[role="radiogroup"], .ds-toggle-group, .ds-ng3-row, .ds-ng3-field') || el;
  const snapshot = (skipEl) => { const d = dialog(); if (!d) return 0; const g = skipEl ? groupOf(skipEl) : null; let html = d.innerHTML; if (g) html = html.replace(g.outerHTML, ''); const fx = ${JSON.stringify(SURF?.effect || '')} && document.querySelector(${JSON.stringify(SURF?.effect || 'body')}); if (fx && !d.contains(fx)) html += fx.innerHTML; return hash(html.replace(/ aria-(checked|pressed|selected|expanded|current)="[^"]*"/g, '')); };
  const menus = () => [...document.querySelectorAll('[role="listbox"], [role="menu"], .ds-dropdown-menu, .ds-menu')].filter(vis).length + document.querySelectorAll('[aria-expanded="true"]').length;
  const portals = () => [...document.body.children].filter((e) => !e.matches('#root, script, style') && (vis(e) || (e.firstElementChild && vis(e.firstElementChild)))).map((e) => desc(e.firstElementChild && !vis(e) ? e.firstElementChild : e));
  const store = () => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
  const controls = () => { const d = dialog(); if (!d) return []; const sel = 'button, [role="button"], [role="radio"], [role="tab"], [role="switch"], [role="checkbox"], input[type="checkbox"], input[type="range"], a[href]'; const out = []; const seen = {}; const map = {}; [...d.querySelectorAll(sel)].forEach((el) => { if (!vis(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return; if (el.matches('[aria-label^="Close"], [aria-label^="close"]') || el.closest('.ds-ng3-tab') || /^close/i.test(name(el)) || /^Open .+ settings$/.test(name(el))) return; if (el.closest('.xray-ov, [role="listbox"]')) return; if (el.closest('.ds-tooltip-trigger, .ds-tooltip-wrap')) return; const r = el.getBoundingClientRect(); const base = el.tagName + '|' + (el.getAttribute('role') || '') + '|' + name(el) + '|' + card(el); seen[base] = (seen[base] || 0) + 1; map[base + '#' + seen[base]] = el; if ((el.getAttribute('role') === 'radio' && el.getAttribute('aria-checked') === 'true') || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true') return; out.push({ key: base + '#' + seen[base], name: name(el), role: el.getAttribute('role') || el.tagName.toLowerCase(), card: card(el), chev: !!el.querySelector('use[href*="chevron-right"]'), cx: r.left + r.width / 2, cy: r.top + r.height / 2 }); }); window.__walkMap = map; return out; };
  const byKey = (key) => { const c = controls().find((x) => x.key === key); return c; };
  const elAt = (cx, cy) => document.elementFromPoint(cx, cy);
  const findEl = (key) => { controls(); const el = window.__walkMap[key]; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = el.getBoundingClientRect(); const c = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; const hit = elAt(c.cx, c.cy); /* an ANCESTOR on top is the component's own chrome (the DS slider paints its track over the native input) — only a stranger counts as cover */ return { c, hitDesc: desc(hit), covered: !(hit === el || el.contains(hit) || hit.contains(el)) }; };
  const snapFor = (key) => { controls(); return snapshot(window.__walkMap[key] || null); };
  const tooltips = () => { const d = dialog(); if (!d) return []; return [...d.querySelectorAll('.ds-tooltip-wrap')].filter(vis).map((w, i) => { const t = w.querySelector('.ds-tooltip-trigger') || w.firstElementChild || w; const r = t.getBoundingClientRect(); return { i, card: card(w), cx: r.left + r.width / 2, cy: r.top + r.height / 2, text: (w.querySelector('.ds-tooltip-popup, .ds-tooltip')?.textContent || '').trim().slice(0, 60) }; }); };
  const tooltipState = (i, tx, ty) => { const w = [...dialog().querySelectorAll('.ds-tooltip-wrap')].filter(vis)[i]; const p = w && w.querySelector('.ds-tooltip-popup, .ds-tooltip'); if (!p) return { shown: false, at: 'popup 없음' }; const cs = getComputedStyle(p); const r = p.getBoundingClientRect(); const shown = +cs.opacity > 0.5 && cs.visibility !== 'hidden' && r.width > 4; if (!shown) return { shown, at: desc(elAt(tx, ty)) }; const prev = p.style.pointerEvents; p.style.pointerEvents = 'auto'; const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = elAt(x, y); const stack = document.elementsFromPoint(x, y); const idx = stack.indexOf(p); const above = idx > 0 ? stack.slice(0, idx).filter((el) => !p.contains(el)) : []; p.style.pointerEvents = prev; return { shown, occluded: !(hit === p || p.contains(hit)), by: above.map(desc).slice(0, 2).join(' > ') || desc(hit), offscreen: r.top < 0 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight }; };
  const labels = () => { const d = dialog(); if (!d) return []; return [...d.querySelectorAll('.ds-ng3-section')].map((s) => { const title = card(s); const rows = [...s.querySelectorAll('.ds-ng3-row, .ds-ng3-field')].map((row) => { const l = row.querySelector('.ds-ng3-label'); if (!l || !vis(l)) return null; const cs = getComputedStyle(l); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; const r = l.getBoundingClientRect(); return { label: l.textContent.trim().slice(0, 30), lines: Math.max(1, Math.round(r.height / lh)), labelW: Math.round(r.width), rowW: Math.round(row.getBoundingClientRect().width) }; }).filter(Boolean); return { title, rows }; }); };
  const density = () => { const d = dialog(); if (!d) return []; return [...d.querySelectorAll('.ds-ng3-section')].map((s) => { const chars = (s.innerText || '').replace(/\\s+/g, ' ').trim().length; const ctrls = [...s.querySelectorAll('button, [role="button"], [role="radio"], [role="switch"], [role="checkbox"], input, select, a[href]')].filter(vis).length; return { title: card(s), chars, ctrls, ratio: Math.round(chars / Math.max(1, ctrls)) }; }); };
  // Side-by-side cards end on one line (2026-09-23, Cindy: «메뉴 전부 다 높이 사이즈 체크»).
  const bottoms = () => { const d = dialog(); if (!d) return []; const SEL = '.mc-row, .mc-toprow, .mc-grid--wide, .pg-rail'; const rows = [...d.querySelectorAll(SEL)]; if (d.matches(SEL)) rows.unshift(d); return rows.map((row) => { const kids = [...row.children].filter((k) => k.getBoundingClientRect().width > 150); if (kids.length < 2) return null; const tops = kids.map((k) => k.getBoundingClientRect().top); if (Math.max(...tops) - Math.min(...tops) > 4) return null; const b = kids.map((k) => Math.round(k.getBoundingClientRect().bottom)); const nm = (k) => { const l = k.querySelector('.ds-ng3-label, .w-label, .dov-title'); return (l ? l.textContent : '').trim().replace(/\\s+/g, ' ').slice(0, 20) || k.className.split(' ')[0]; }; return { names: kids.map(nm), b, gap: Math.max(...b) - Math.min(...b) }; }).filter(Boolean); };
  return { controls, findEl, snapFor, snapshot, portals, menus, store, tooltips, tooltipState, labels, density, desc, bottoms };
})();
true`;

// ── report accumulators ──────────────────────────────────────────────────────
const red = [], orange = [], yellow = [], okLines = [];
const say = (mark, line) => { if (!QUIET || mark === '🔴' || mark === '🟠') console.log(`${mark} ${line}`); ({ '🔴': red, '🟠': orange, '🟡': yellow, '✓': okLines })[mark].push(line); };

await open();
await ev(`localStorage.clear(); true`);
if (SURF?.seed) await ev(`(() => { const o = ${JSON.stringify(SURF.seed)}; for (const k in o) localStorage.setItem(k, JSON.stringify(o[k])); return true; })()`);
if (process.env.SEED) await ev(`(() => { const o = ${process.env.SEED}; for (const k in o) localStorage.setItem(k, typeof o[k] === 'string' ? o[k] : JSON.stringify(o[k])); return true; })()`);
await open();
await ev(HELPERS);

// ── 0. characters per control, per card — on the fresh tab, before a press can dismiss a card ──
const dens = (await ev(`__walk.density()`)).sort((a, b) => b.ratio - a.ratio);
const rows0 = await ev(`__walk.bottoms()`);

// ── 1. press every control at its pixel ──────────────────────────────────────
const visited = new Set();
console.log(`controls at start: ${(await ev(`__walk.controls().length`))}`);
for (let iter = 0; iter < 90; iter++) {
  await ev(HELPERS);
  const list = await ev(`__walk.controls()`);
  const next = list.find((c) => !visited.has(c.key));
  if (process.env.DEBUG) console.log(`  [iter ${iter}] controls=${list.length} visited=${visited.size} dialogs=${await ev(`document.querySelectorAll('[role="dialog"]').length`)} next=${next?.key || '-'}`);
  if (!next) { if (list.length < visited.size / 2) { await open(); await ev(HELPERS); continue; } break; }
  visited.add(next.key);
  const probe = await ev(`__walk.findEl(${JSON.stringify(next.key)})`);
  if (!probe) continue;
  const label = `${next.card} › ${next.role} "${next.name}"`;
  const before = await ev(`({ snapAll: __walk.snapshot(null), snapOut: __walk.snapFor(${JSON.stringify(next.key)}), portals: __walk.portals(), store: __walk.store(), menus: __walk.menus(), hash: location.hash })`);
  await clickAt(probe.c.cx, probe.c.cy);
  await sleep(400);
  const after = await ev(`({ snapAll: __walk.snapshot(null), snapOut: __walk.snapFor(${JSON.stringify(next.key)}), portals: __walk.portals(), store: __walk.store(), menus: __walk.menus(), hash: location.hash })`);
  after.menu = after.menus > before.menus;
  const gone = !(await has(READY));
  const promised = next.chev || /open|view|x-ray|xray|arrange|edit|more|show|identify|manage|rename|customize|→|›/i.test(next.name);
  // The address is the other way a press can open a window: the device window
  // is not a portal, so a toggle that opened it behind the Customize card left
  // every portal count unchanged (2026-09-23).
  if (before.hash !== after.hash) { say(promised ? '✓' : '🔴', `${label} — 누르니 주소가 바뀜 ${before.hash || '#'} → ${after.hash}${promised ? '' : ' (이름이 약속하지 않은 이동)'}`); await open(); await ev(HELPERS); continue; }
  if (gone) { say('🔴', `${label} — 누르니 창 자체가 사라졌다${crashes.length ? ' · 마지막 예외: ' + crashes[crashes.length - 1] : ''} · hash=${await ev('location.hash')}`); await open(); await ev(HELPERS); continue; }
  const opened = after.portals.filter((p) => !before.portals.includes(p));
  if (probe.covered) say('🔴', `${label} — 그 자리 맨 위가 이 컨트롤이 아니다: ${probe.hitDesc}`);
  if (opened.length && !probe.covered) say(promised ? '✓' : '🔴', `${label} — 누르니 ${opened.join(', ')} 열림${promised ? '' : ' (이름이 약속하지 않은 문)'}`);
  else if (opened.length && probe.covered) say('🔴', `${label} — 눌렀더니 가린 것이 ${opened.join(', ')}을 열었다`);
  else if (after.menu) say('✓', `${label} — 메뉴 열림`);
  // A radio that moves the selection inside its own group IS drawn — the group is the drawing (the Viewing Mode
  // tiles since 2026-09-22). Only a control that saves while nothing at all redraws is an engine-less one.
  else if (before.snapOut === after.snapOut && before.store !== after.store && next.role === 'radio' && before.snapAll !== after.snapAll) say('✓', `${label} — 선택 저장 · 자기 그룹이 그림`);
  else if (before.snapOut === after.snapOut && before.store !== after.store) say('🟠', `${label} — 값은 저장됐는데 자기 행 밖 화면은 안 바뀜 (엔진 없는 컨트롤)`);
  else if (before.snapOut === after.snapOut && before.store === after.store && before.snapAll !== after.snapAll) say('🟡', `${label} — 자기 행만 바뀜, 다른 곳은 그대로 (맞나 확인)`);
  else if (before.snapOut === after.snapOut && before.store === after.store) say('🟡', `${label} — 눌러도 화면·저장 둘 다 그대로 (확인 필요)`);
  else say('✓', `${label}`);
  if (opened.length || after.menu) { await escape(); await sleep(250); const still = await ev(`__walk.portals().length > ${before.portals.length} || __walk.menus() > ${before.menus}`); if (still) { const c = await ev(`(() => { const b = [...document.querySelectorAll('button')].reverse().find(b => /close/i.test(b.textContent + (b.getAttribute('aria-label')||'')) && b.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`); if (c) { await clickAt(c.x, c.y); await sleep(300); } } const stillOpen = await ev(`__walk.portals().length > ${before.portals.length}`); if (stillOpen) { await open(); await ev(HELPERS); } }
}

// ── 2. hover every ⓘ ─────────────────────────────────────────────────────────
await open(); await ev(HELPERS);
const tips = await ev(`__walk.tooltips()`);
for (const t of tips) {
  await ev(`(() => { const w = [...document.querySelectorAll('[role="dialog"] .ds-tooltip-wrap')][${t.i}]; w && w.scrollIntoView({ block: 'center' }); return true; })()`);
  const at = await ev(`(() => { const w = [...document.querySelector('[role="dialog"]').querySelectorAll('.ds-tooltip-wrap')].filter((e) => e.getBoundingClientRect().width > 2)[${t.i}]; const tt = w.querySelector('.ds-tooltip-trigger') || w.firstElementChild || w; const r = tt.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await mouse('mouseMoved', at.x - 40, at.y + 40); await sleep(80); await mouse('mouseMoved', at.x, at.y); await sleep(700);
  let st = await ev(`__walk.tooltipState(${t.i}, ${at.x}, ${at.y})`);
  if (!st.shown) { await mouse('mouseMoved', at.x + 1, at.y + 1); await sleep(900); st = await ev(`__walk.tooltipState(${t.i}, ${at.x}, ${at.y})`); }
  const label = `${t.card} › ⓘ "${t.text || '(빈 툴팁)'}"`;
  if (!st.shown) say('🟡', `${label} — hover해도 안 뜸 (그 자리 맨 위 = ${st.at})`);
  else if (st.occluded) say('🔴', `${label} — 툴팁 가운데가 다른 것에 덮임: ${st.by}`);
  else if (st.offscreen) say('🔴', `${label} — 툴팁이 화면 밖으로 나감`);
  else say('✓', `${label} — 툴팁 온전`);
  await mouse('mouseMoved', 5, 5); await sleep(150);
}

// ── 3. row labels: siblings must agree on line count ─────────────────────────
await ev(`__walk.controls(); true`);
// Put the tab in its fullest state first: a divided layout shows the depth rows.
await ev(`(() => { const t = [...document.querySelectorAll('.vm-tile')].find(b => !b.disabled && /PBP|PIP/.test(b.getAttribute('aria-label')||'')); t && t.click(); return true; })()`); await sleep(400);
for (const sec of await ev(`__walk.labels()`)) {
  if (sec.rows.length < 2) continue;
  const multi = sec.rows.filter((r) => r.lines > 1), single = sec.rows.filter((r) => r.lines === 1);
  if (multi.length && single.length) say('🟡', `${sec.title} — 라벨 줄수 섞임: ${multi.map((r) => `"${r.label}" ${r.lines}줄(라벨 ${r.labelW}px/행 ${r.rowW}px)`).join(', ')} vs 1줄 ${single.length}개`);
}

// ── 3b. side-by-side cards end on one line — fresh, layout chosen, every fold open ──
// A rule since 2026-09-23 (SPEC: tab-card-rows 2 now covers Connectivity's top row):
// the shorter side takes the height, the extra sits under its last row.
const rowCheck = (list, state) => { for (const r of list) say(r.gap > 2 ? '🔴' : '✓', `${r.names.join(' | ')} — 나란한 칸 바닥 ${r.gap > 2 ? `${r.gap}px 어긋남` : '맞음'} (${r.b.join(' / ')}) · ${state}`); };
rowCheck(rows0, '처음 연 상태');
rowCheck(await ev(`__walk.bottoms()`), 'PBP/PIP 고른 상태');
await ev(`(() => { const d = document.querySelector(${JSON.stringify(ROOT)}); if (d) for (const b of d.querySelectorAll('[aria-expanded="false"]:not([aria-haspopup])')) if (!b.closest('.ds-ng3-tab')) b.click(); return true; })()`); await sleep(500);
rowCheck(await ev(`__walk.bottoms()`), '접는 줄 전부 연 상태');

// ── 4. characters per control, per card ──────────────────────────────────────
for (const d of dens) say(d.ratio > 88 ? '🟡' : '✓', `${d.title} — 글자 ${d.chars} ÷ 컨트롤 ${d.ctrls} = ${d.ratio}${d.ratio > 88 ? ' (08-19 최악값 88 초과)' : ''}`);

// ── report ───────────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, `${date}-tab-walk-${SURF ? TAB : `${SKU}-${TAB}`}${process.env.WALK_TAG ? '-' + process.env.WALK_TAG : ''}.md`);
const sec = (title, arr) => arr.length ? `\n## ${title}\n${arr.map((l) => `- ${l}`).join('\n')}\n` : '';
writeFileSync(file, `# 탭 한 바퀴 — ${SKU} · ${TAB} · ${date}\n\n> \`web/scripts/verify-tab-walk.mjs\` · 실제 포인터로 컨트롤 ${visited.size}개 누름 · ⓘ ${tips.length}개 hover · 1440×1100 · CURRENT :${PORT}\n> 판정: 🔴 = 사람이 눌렀을 때 틀린 일이 난다 · 🟠 = 엔진 없는 컨트롤 · 🟡 = 확인 필요/패턴 · ✓ = 손으로 눌러도 같다\n` + sec('🔴 사람 손에서 틀리는 것', red) + sec('🟠 엔진 없는 컨트롤 (값만 저장)', orange) + sec('🟡 확인 필요 · 패턴', yellow) + sec('✓ 통과', okLines));
console.log(`\n${red.length} 🔴 · ${orange.length} 🟠 · ${yellow.length} 🟡 · ${okLines.length} ✓ → ${file}`);
ws.close();
process.exit(red.length ? 1 : 0);

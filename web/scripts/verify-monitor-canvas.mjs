// CDP walkthrough for the MonitorCanvas — the monitor modal's TAB IA and the
// two behavioural contracts that hang off it, checked on `pulse-27` (the plain
// OMEN OLED 27).
//
// Why this file exists, and why it is pulse-27: the monitor tab list is a
// CLOSED five-tab set (deviceTabs.ts, Cindy 2026-08-18/19) whose middle three
// are FEATURE-GATED — Lights appears only with `underGlow`, Audio only with
// `audio.speakers`. Every other live monitor suite (verify-mode-remembers,
// -pbp-depth, -audio-eq, -desk-card, -smart-actions, -arrange-return) runs on
// `treehouse-32`, which carries every feature and therefore exercises the gate
// in one position only: open. pulse-27 is the other position — it is the SKU
// that proves a display without a lamp or speakers still gets a coherent
// modal instead of empty tabs.
//
// ⚠️ 2026-09-23 — that second reason USED to read "the only monitor whose
// Connectivity tab is the plain KVM one". It is no longer true and the file
// no longer relies on it: pulse-27's Connectivity was rebuilt on 2026-09-21
// in the treehouse-32's two columns (Cindy; Chris approved it at the 09-22
// 1:1). The gate reason stands on its own — pulse-27 is still the SKU with
// no lamp and no speakers.
//
// The contracts carried since TH-320/TH-327: a KVM switch writes
// `Settings.kvm`, and Mirror writes `Settings.displayArrange` through the
// Arrange editor.
//
// ── Ported 2026-08-25. The suite had been dead since e76e76c (2026-08-18) ────
// It last passed against the pre-Overview-retirement IA and then failed 5 of
// its first 7 checks and threw on the 8th, identically at every commit from
// e76e76c to HEAD — nothing recent broke it. Four causes, all fixed here:
//   · The roster moved. Overview retired (e76e76c) and Connectivity took second
//     place behind Display (793af18), so the DEFAULT tab is now Display — the
//     old file opened with no `tab=` and then asserted Connectivity's contents
//     against the Display tab. The last tab's label is `Settings` now; only its
//     id is still `utilities`.
//   · `.ds-ng3-label` stopped being just the label. `InfoTip` renders inside
//     it (MonitorTabs.tsx), so `textContent` returns "BrightnessWith
//     Auto-Brightness on, …" — every exact-match label check silently died.
//     `LABELS` below strips `[role="tooltip"]` before reading.
//   · The status chips are gone on purpose (MonitorCanvas.tsx, 2026-08-20 —
//     a lit panel IS the connected evidence). The old `chips:` check asserted
//     their presence; it is inverted here so their return would be caught.
//   · `fits` was measured on the FIRST `.ds-ng3-body`, which is the hero, not
//     the tab panel — so it passed on a tab hanging ~550px off the bottom. It
//     measures `.mc-panel-wrap` now, and see the Connectivity note below.
//
// Harness (2026-08-25): PORT/CDP env vars, like verify-mode-remembers.mjs —
// this file used to hardcode :5175/:9222 and could not share a machine with
// another session's server. Headless Chrome wants software WebGL or three.js
// throws and #root stays empty:
//   --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
// Run from web/:  node scripts/verify-monitor-canvas.mjs [outDir]
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

// Both spellings: `APP_PORT`/`CDP_PORT` is Chris's (upstream), `PORT`/`CDP` is
// what the other verify-* suites here take. Neither invocation is broken.
const PORT = process.env.PORT || process.env.APP_PORT || '5175';
const CDP = process.env.CDP || process.env.CDP_PORT || '9222';
const OUT = process.argv[2] || '/tmp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let msgId = 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const targets = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
};
/** Poll rather than sleep — six suites still pace off fixed sleeps and flake
 *  under rapid serial runs (HANDOFF 2026-08); this one no longer does. */
const wait = async (expr, ms = 15000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(`!!(${expr})`).catch(() => false)) return true;
    await sleep(150);
  }
  return false;
};

await send('Page.enable');
await send('Runtime.enable');
// 1100 tall, matching verify-mode-remembers — the height at which a settled
// monitor tab is expected to fit without the canvas scrolling.
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });

/** Section/row labels with the InfoTip copy taken back out. */
const LABELS = `[...document.querySelectorAll('.dc-canvas .ds-ng3-label')].map((e) => {
  const c = e.cloneNode(true);
  c.querySelectorAll('[role="tooltip"]').forEach((t) => t.remove());
  return c.textContent.trim();
})`;

const SNAP = `(() => {
  const c = document.querySelector('.dc-canvas');
  if (!c) return null;
  // The tab panel, NOT the hero — .dc-canvas is itself the scroll container,
  // so a tab that overruns is reachable but is not the fixed-height panel the
  // desk map was given one for (358365e).
  const panel = c.querySelector('.mc-panel-wrap');
  const pr = panel?.getBoundingClientRect();
  const body = c.querySelector('.mc-panel-wrap .ds-ng3-body');
  return {
    tabs: [...c.querySelectorAll('.ds-ng3-tool')].map((b) => b.getAttribute('aria-label')),
    title: c.querySelector('.ds-ng3-title')?.textContent.trim(),
    labels: ${LABELS},
    statusChips: c.querySelectorAll('.dc-status, .dc-chip').length,
    deskMap: !!c.querySelector('.dc-hero .dsa-stage'),
    // Scrolling is sanctioned inside .ds-ng3-scroll and, since 2026-09-24, in
    // the tab body itself (.mc-grid): the canvas is fixed like every other
    // device canvas and a tab taller than the room the hero leaves scrolls
    // inside the panel. Flag any OTHER scrollable region (closed dropdown
    // menus inflate scrollHeight without scrolling, so only count elements
    // whose computed overflow can scroll).
    bodyScrolls: body ? [...body.querySelectorAll('*')].some((e) =>
      !e.closest('.ds-ng3-scroll') && !e.classList.contains('mc-grid') &&
      /(auto|scroll)/.test(getComputedStyle(e).overflowY) &&
      e.scrollHeight > e.clientHeight + 1) : null,
    overrun: pr ? Math.max(0, Math.round(pr.bottom - innerHeight)) : null,
    kvmStage: !!c.querySelector('.kvm-stage'),
    kvmBanner: !!c.querySelector('.kvm-setup'),
    inputRows: c.querySelectorAll('.ds-ng3-scroll .ds-list-item').length,
    specFold: (() => {
      const f = [...c.querySelectorAll('.mt-fold')].find((b) => /Specs/.test(b.textContent));
      return f ? { open: f.getAttribute('aria-expanded') === 'true', summary: f.querySelector('.dc-mono-val')?.textContent.trim() } : null;
    })(),
    specRows: Object.fromEntries([...c.querySelectorAll('.ds-ng3-spec-row')]
      .map((r) => [r.querySelector('.ds-ng3-spec-key')?.textContent.trim(), r.querySelector('.ds-ng3-spec-val')?.textContent.trim()])),
  };
})()`;

let loadN = 0;
/** Cold-load a SKU/tab. The `?r=N` search param is load-bearing: Page.navigate
 *  between URLs differing only in the hash does NOT reload the SPA, so the
 *  providers never re-read the localStorage the `pre` script just wrote. */
async function open(tab, { sku = 'pulse-27', pre = '' } = {}) {
  await ev(`localStorage.removeItem('kvm'); localStorage.removeItem('displayArrange'); ${pre}`).catch(() => {});
  await send('Page.navigate', { url: `http://localhost:${PORT}/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await wait(`document.querySelector('.dc-canvas .ds-ng3-title')`);
  await sleep(400);
  return ev(SNAP);
}
const shoot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};

// ── The roster: a closed set, feature-gated, in this product's order ─────────
let s = await open();
check('pulse-27 rosters Display · Connectivity · Settings — no lamp, no speakers, no Overview',
  JSON.stringify(s?.tabs) === JSON.stringify(['Display', 'Connectivity', 'Settings']), s?.tabs.join(' / '));
check('the modal opens on Display — the primary-capability tab, the family grammar',
  s?.title === 'Display', String(s?.title));
check('no status chips on a monitor canvas — the lit panel is the evidence (2026-08-20)',
  s?.statusChips === 0, `found ${s?.statusChips}`);

{
  const t = await open('', { sku: 'treehouse-32' });
  check('treehouse-32 opens all five gates, in the 2026-08-19 order',
    JSON.stringify(t?.tabs) === JSON.stringify(['Display', 'Connectivity', 'Lights', 'Audio', 'Settings']), t?.tabs.join(' / '));
}

// ── Display ─────────────────────────────────────────────────────────────────
s = await open('display');
check('?tab=display deep-links to Display', s?.title === 'Display', String(s?.title));
check('Display carries Brightness · Contrast · HDR · RGB Gain',
  ['Brightness', 'Contrast', 'HDR', 'RGB Gain'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
check('Display: the desk map is the hero', s?.deskMap === true);
check('Display fits the viewport, and scrolls only inside the tab body or .ds-ng3-scroll',
  s?.overrun === 0 && s?.bodyScrolls === false, `overrun=${s?.overrun}px scrolls=${s?.bodyScrolls}`);
await shoot('monitor-display');

// Extend/Mirror live in the Arrange editor (Chris 1:1 2026-07-30): the hero
// desk map is the view lens; the editor owns the arrangement. The contract is
// unchanged — Mirror still writes Settings.displayArrange.
await ev(`[...document.querySelectorAll('.dsa-actions button')].find((b) => b.textContent.trim() === 'Arrange')?.click()`);
check('Arrange opens the editor', await wait(`document.querySelector('.arrange-modal')`));
await ev(`[...document.querySelectorAll('.arrange-modal .ds-toggle-group-btn')].find((b) => b.textContent.trim() === 'Mirror')?.click()`);
await wait(`/mirror/.test(localStorage.getItem('displayArrange') || '')`);
const arrange = await ev(`localStorage.getItem('displayArrange')`);
check('editor: Mirror writes Settings.displayArrange', /"mode":"mirror"/.test(String(arrange)), String(arrange).slice(0, 40));

// ── Connectivity — OUR two columns now, not Chris's plain KVM tab ───────────
// Rebuilt 2026-09-21: an INPUTS card (this monitor's own inputs + USB Hub + a
// `This connection ›` fold) beside the Gear Switch column, the same shape the
// treehouse-32 wears. `MonitorKvmTab` is mounted nowhere in this branch, so the
// setup banner, the routing stage and the `.kvm-src` buttons are gone ON
// PURPOSE — the check below is inverted so their return would be caught.
//
// The TH-320 contract did NOT die with them. "A switch writes
// Settings.kvm.activePc" now lives on the desk's Gear Switch and is asserted
// before/after in verify-desk-card.mjs (~line 214), so it is covered, just not
// from here. Do not re-add a KVM step to this file to chase it.
s = await open('connectivity');
check('?tab=connectivity deep-links to Connectivity', s?.title === 'Connectivity', String(s?.title));
// 2026-09-23: the card is the Treehouse 32's rear-panel card without the plate —
// `Rear ports` with the same `Inputs` and `This connection` folds. The spec list
// and its `USB Hub · Enabled` line are gone on purpose (Cindy: one Inputs design).
check('Connectivity: Rear ports · Inputs · This connection · Gear Switch, no USB Hub line',
  ['Rear ports', 'Inputs', 'This connection', 'Gear Switch'].every((l) => s?.labels.includes(l)) && !s?.labels.includes('USB Hub'),
  s?.labels.join(', '));
check('Connectivity: a one-computer desk says what a second computer would add',
  s?.labels.includes('With a second PC'), s?.labels.join(', '));
check("Connectivity: the plain KVM tab is not mounted here any more — no banner, no routing stage, no source buttons",
  s?.kvmBanner === false && s?.kvmStage === false && (await ev(`!document.querySelector('.kvm-src')`)) === true,
  `banner=${s?.kvmBanner} stage=${s?.kvmStage}`);
check('Connectivity: the desk map stays the hero here too (2026-08-08 / built 2026-08-20)', s?.deskMap === true);
// Tightened to `overrun === 0` on 2026-09-23. The old file could not assert it:
// the pre-rebuild five-card layout hung ~550px past a 1100-tall viewport, so a
// note was printed instead. The two columns fit, so this is a real check again.
check('Connectivity: fits the viewport, and scrolls only inside the tab body or .ds-ng3-scroll',
  s?.overrun === 0 && s?.bodyScrolls === false, `overrun=${s?.overrun}px scrolls=${s?.bodyScrolls}`);
await shoot('monitor-connectivity');

// ── Settings — id `utilities` is plumbing, the LABEL is the family word ──────
s = await open('utilities');
check('?tab=utilities opens the tab whose label is Settings', s?.title === 'Settings', String(s?.title));
check('Settings: Power · Hub firmware · OSD',
  // `Hub firmware`, not `Firmware` — this monitor doubles as the dock, so the
  // row says whose firmware it is (renamed 2026-09-22 with the OLED Care pass).
  ['Power', 'Hub firmware', 'OSD'].every((l) => s?.labels.includes(l)), s?.labels.join(', '));
check('Settings: the specs are folded away, and the closed row still says size · resolution · refresh',
  s?.specFold?.open === false && s?.specFold?.summary === '27" · QHD · 240 Hz', JSON.stringify(s?.specFold));
check('Settings fits the viewport, and scrolls only inside the tab body or .ds-ng3-scroll',
  s?.overrun === 0 && s?.bodyScrolls === false, `overrun=${s?.overrun}px scrolls=${s?.bodyScrolls}`);
await ev(`[...document.querySelectorAll('.mt-fold')].find((b) => /Specs/.test(b.textContent))?.click()`);
await wait(`document.querySelector('.dc-canvas .ds-ng3-spec-row')`);
{
  const rows = (await ev(SNAP))?.specRows || {};
  check('Settings: opening the fold gives the panel facts (OLED, 240 Hz)',
    rows.Panel === 'OLED' && rows.Refresh === '240 Hz', JSON.stringify(rows));
}
await shoot('monitor-settings');

await ev(`localStorage.removeItem('kvm'); localStorage.removeItem('displayArrange');`);
ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} of ${results.length} FAILED` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

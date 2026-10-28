// CDP check for Nova's floating door (TH-507, October 27, 2026): Admin → Nova
// entry → Floating puts a `.ds-fab` in the bottom-right corner that opens Nova
// as a chat window over the page, instead of the top bar's button and the rail.
//
// What is protected, in order of how expensive it would be to lose:
//  1. THE DEFAULT. A fresh browser gets the floating button (Chris,
//     2026-10-28: promoted from the alternate); Top bar stays in Admin.
//  2. ONE NOVA. The FAB sets the same `novaPinned` every other door sets, so
//     a preference saved open opens the WINDOW, and the window holds the same
//     log the page does.
//  3. IT RESERVES NOTHING. The window floats over the page; the page does not
//     reflow when it opens (no `nova-open`, no padding on `.shell-scroll`).
//  4. THE STATES. Busy runs the FAB's ring and says "Thinking…" in the
//     header in words; a reply that lands while minimized leaves the badge AND
//     says so in the label — never the dot alone.
//  5. FOCUS. Opened from the FAB, focus is in the composer; minimized or
//     Escaped from inside, it comes back to the FAB, not to <body>.
//  6. THE CORNER. The window stands above the FAB, the toast stack lifts over
//     it, and on a phone the FAB rides above the bottom nav and stands down
//     while the sheet is open.
//  7. Reduced motion stops the orbit and keeps the ring visible.
//  8. IT RESIZES like the rail, from its left edge, into its OWN remembered
//     width (`novaWindowW`) — never the rail's (`novaPanelW`) — and in height
//     from its top edge (`novaWindowH`), growing upward off the button.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default
// 9222), run from web/. It writes `novaEntry`, `novaPinned`, `trhs-modules`
// and `trhs-nova`, and clears them at the end. Set SHOTS_DIR for pictures.
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
  if (m.method === 'Inspector.targetCrashed') console.log('  ✗ the page crashed (Inspector.targetCrashed)');
  if (m.method === 'Inspector.detached') console.log(`  ✗ CDP detached: ${m.params.reason}`);
});
// A socket that closes mid-suite otherwise ends as a bare "unsettled top-level await".
ws.on('close', (code) => {
  console.log(`  ✗ the CDP socket closed (${code}) — Chrome went away mid-suite`);
  process.exit(1);
});
await send('Inspector.enable');

const W = 1440;
const H = 1000;
const viewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
await viewport(W, H);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
// A hash-only change does not remount, and `Page.reload` after one races the
// router (gotcha 33). Force a real document load and wait for it.
let nav = 0;
const go = async (hash) => {
  const loaded = new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Page.loadEventFired') {
        ws.off('message', onMsg);
        resolve();
      }
    };
    ws.on('message', onMsg);
  });
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?n=${++nav}#${hash}` });
  await loaded;
  await sleep(1600);
};
const waitFor = async (expr, ms = 10000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(expr).catch(() => false)) return true;
    await sleep(80);
  }
  return false;
};
const key = (k, code = k) => ['keyDown', 'keyUp'].reduce((p, type) => p.then(() => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: k === 'Escape' ? 27 : k === 'Enter' ? 13 : 0 })), Promise.resolve());
const shot = async (name) => {
  if (!process.env.SHOTS_DIR) return;
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(process.env.SHOTS_DIR, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${process.env.SHOTS_DIR}/${name}.png`, Buffer.from(data, 'base64'));
};

const FAB = `document.querySelector('.nova-fab .ds-fab')`;
const PANEL = `document.getElementById('nova-panel')`;
const rect = (sel) => ev(`(() => { const r = ${sel}?.getBoundingClientRect(); return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null; })()`);
const windowOpen = `${PANEL}?.classList.contains('open') && ${PANEL}?.classList.contains('window')`;
// Types into the composer the way a person does — React only sees a value set through the native setter.
const typeAndSend = (text) =>
  ev(`(() => {
    const t = document.querySelector('#nova-panel textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(text)});
    t.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`).then(async () => {
    await sleep(100);
    await ev(`document.querySelector('#nova-panel button[aria-label="Send"]')?.click()`);
  });

// Nova is opt-in; the replies run at the demo's own pace so "thinking" lasts long enough to see.
const seed = async () => {
  await ev(`localStorage.setItem('mvpScope', '27c2'); localStorage.setItem('trhs-modules', JSON.stringify({ nova: true })); localStorage.setItem('trhs-nova', JSON.stringify({ v: 1, settings: { demoSpeed: 'compressed' } })); localStorage.removeItem('novaPinned'); localStorage.removeItem('novaEntry'); 1`);
};

console.log('\n1 · The default');
await go('/');
await seed();
await go('/');
check('a fresh browser gets the FAB', await ev(`!!document.querySelector('.nova-fab .ds-fab')`));
check('and the top bar gives its slot to Forge', await ev(`!document.querySelector('.shell-util button[aria-label="Ask Nova"]')`));

console.log('\n2 · The way in');
await go('/?modal=admin');
const row = await ev(`(() => {
  const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Nova entry');
  return r ? [...r.querySelectorAll('.ds-toggle-group button')].map((b) => b.innerText.trim()) : null;
})()`);
check('Admin has a Nova entry row naming both doors, Floating first', JSON.stringify(row) === JSON.stringify(['Floating', 'Top bar']), JSON.stringify(row));
check('Floating reads as selected with nothing saved', await ev(`(() => { const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Nova entry'); return [...r.querySelectorAll('button')].find((b) => /floating/i.test(b.innerText))?.getAttribute('aria-selected') === 'true'; })()`));
await ev(`(() => {
  const r = [...document.querySelectorAll('.admin-tool')].find((t) => t.querySelector('.admin-tool-name')?.textContent === 'Nova entry');
  [...r.querySelectorAll('button')].find((b) => /floating/i.test(b.innerText))?.click();
})()`);
await sleep(400);
check('choosing Floating stores it', (await ev(`localStorage.getItem('novaEntry')`)) === 'fab');

console.log('\n3 · The floating button');
await go('/');
const fab = await rect(FAB);
// `right` is measured from the content edge, so a scrollbar is not "the corner".
const cw = await ev(`document.documentElement.clientWidth`);
check('a FAB is in the bottom-right corner', !!fab && Math.abs(cw - fab.r - 24) <= 2 && Math.abs(H - fab.b - 24) <= 2, JSON.stringify({ fab, cw }));
check('it is 56px and round', !!fab && Math.round(fab.w) === 56 && (await ev(`getComputedStyle(${FAB}).borderRadius`)) !== '0px', JSON.stringify(fab));
check('named "Ask Nova", collapsed', (await ev(`${FAB}.getAttribute('aria-label')`)) === 'Ask Nova' && (await ev(`${FAB}.getAttribute('aria-expanded')`)) === 'false');
check('the top bar gives its slot back to Forge', await ev(`!document.querySelector('.shell-util button[aria-label="Ask Nova"]') && !!document.querySelector('.shell-util button[aria-label="Forge"]')`));
check('the window is shut and out of the tab order', await ev(`getComputedStyle(${PANEL}).visibility === 'hidden'`));
await shot('fab-closed');
// The scripted reply is quicker than a screenshot, so the busy picture forces the class for one frame.
if (process.env.SHOTS_DIR) {
  await ev(`${FAB}.classList.add('busy'); 1`);
  await sleep(700);
  await shot('fab-busy');
  await ev(`${FAB}.classList.remove('busy'); 1`);
}

console.log('\n4 · Opening');
const padBefore = await ev(`getComputedStyle(document.querySelector('.shell-scroll')).paddingRight`);
await ev(`${FAB}.focus(); ${FAB}.click()`);
await sleep(700);
check('the FAB opens the window', await ev(windowOpen));
check('it says so: expanded, and named for what a press does now', (await ev(`${FAB}.getAttribute('aria-expanded')`)) === 'true' && (await ev(`${FAB}.getAttribute('aria-label')`)) === 'Minimize Nova');
check('focus is in the composer', await ev(`document.activeElement === document.querySelector('#nova-panel textarea')`));
check('the page reserves nothing for it', !(await ev(`document.querySelector('.shell').classList.contains('nova-open')`)) && (await ev(`getComputedStyle(document.querySelector('.shell-scroll')).paddingRight`)) === padBefore, padBefore);
// The window opens on a spring that overshoots; measure once it has settled.
await waitFor(`getComputedStyle(${PANEL}).transform === 'none' && getComputedStyle(${PANEL}).opacity === '1'`, 3000);
const win = await rect(PANEL);
const fab2 = await rect(FAB);
check('it stands above the FAB, its right edge on the FAB’s', !!win && win.b <= fab2.t - 8 && Math.abs(win.r - fab2.r) <= 2, JSON.stringify({ win, fab2 }));
check('it fits under the top bar', !!win && win.t >= 64, JSON.stringify(win));
// Resizable from its left edge, as the rail is (Chris, October 27) — its own width, remembered.
// The box measures the width plus the panel's two 1px borders.
const near = (w, want) => Math.abs(w - want) <= 2;
const HANDLE = `document.querySelector('#nova-panel .ds-resize-handle')`;
check('it opens at its own default width, 400', !!win && near(win.w, 400), JSON.stringify(win));
check('it has the rail’s resize handle on its left edge', await ev(`(() => { const h = ${HANDLE}; if (!h) return false; const r = h.getBoundingClientRect(), p = ${PANEL}.getBoundingClientRect(); return h.getAttribute('aria-label') === 'Resize Nova' && Math.abs(r.left - p.left) <= 2; })()`));
await ev(`${HANDLE}.focus(); 1`);
await key('ArrowLeft');
await sleep(250);
const grown = await rect(PANEL);
check('← widens it, growing leftward: the right edge stays on the FAB', !!grown && near(grown.w, 424) && Math.abs(grown.r - fab2.r) <= 2, JSON.stringify(grown));
check('the width is remembered as the window’s, not the rail’s', (await ev(`localStorage.getItem('novaWindowW')`)) === '424' && (await ev(`localStorage.getItem('novaPanelW')`)) === null, JSON.stringify(await ev(`[localStorage.getItem('novaWindowW'), localStorage.getItem('novaPanelW')]`)));
await key('Home');
await sleep(250);
check('Home is the narrowest, 320', near((await rect(PANEL)).w, 320), JSON.stringify(await rect(PANEL)));
// And its height, from the top edge (Chris, October 27): the bottom stays on the button.
const VHANDLE = `document.querySelector('#nova-panel .ds-resize-handle.top')`;
const tall0 = await rect(PANEL);
check('it opens at its own default height, 640', near(tall0.h, 640), JSON.stringify(tall0));
check('a second handle lies along its top edge, a horizontal splitter', await ev(`(() => { const h = ${VHANDLE}; if (!h) return false; const r = h.getBoundingClientRect(), p = ${PANEL}.getBoundingClientRect(); return h.getAttribute('aria-label') === 'Resize Nova height' && h.getAttribute('aria-orientation') === 'horizontal' && Math.abs(r.top - p.top) <= 2 && r.width > p.width - 4 && getComputedStyle(h).cursor === 'row-resize'; })()`));
await ev(`${VHANDLE}.focus(); 1`);
await key('ArrowUp');
await sleep(250);
const tall1 = await rect(PANEL);
check('↑ makes it taller, growing upward: the bottom stays above the FAB', near(tall1.h, 664) && Math.abs(tall1.b - tall0.b) <= 1 && tall1.t < tall0.t, JSON.stringify({ tall0, tall1 }));
check('the height is remembered as the window’s', (await ev(`localStorage.getItem('novaWindowH')`)) === '664');
await key('End');
await sleep(250);
const tallMax = await rect(PANEL);
check('End is the tallest — still clear of the top bar', tallMax.h > 664 && tallMax.t >= 64 + 8, JSON.stringify(tallMax));
await key('Home');
await sleep(250);
check('Home is the shortest, 360', near((await rect(PANEL)).h, 360), JSON.stringify(await rect(PANEL)));
await ev(`localStorage.removeItem('novaWindowH'); 1`);
// Back to the default for the rest of the suite. Open is remembered, so the reload reopens it.
await ev(`localStorage.removeItem('novaWindowW'); 1`);
await go('/');
if (!(await ev(windowOpen))) await ev(`${FAB}.click()`);
await sleep(700);
check('the header reads "Ready"', /Ready/.test(await ev(`document.querySelector('#nova-panel .novp-status')?.innerText ?? ''`)));
check('its close is Minimize', await ev(`!!document.querySelector('#nova-panel button[aria-label="Minimize Nova"]')`));
await shot('window-open');

console.log('\n5 · Thinking');
await typeAndSend('hello there');
// The wiring: Nova's busy reaches the FAB, the panel and the header's words.
check('busy, the FAB takes .busy', await waitFor(`${FAB}.classList.contains('busy')`, 3000));
check('and the window does, saying "Thinking…" in words', await waitFor(`${PANEL}.classList.contains('busy') && /Thinking/.test(document.querySelector('#nova-panel .novp-status')?.innerText ?? '')`, 1000));
await waitFor(`!${FAB}.classList.contains('busy')`, 15000);
// The drawing. A scripted reply is busy for a few hundred milliseconds — less
// than a transition and a measurement — so the classes are held for this.
// A React re-render rewrites className and would drop a class added by hand,
// so the hold re-adds it until released.
const hold = (on) =>
  ev(on
    ? `(() => {
        const els = [${FAB}, ${PANEL}];
        const keep = () => els.forEach((e) => e.classList.contains('busy') || e.classList.add('busy'));
        window.__busyHold = new MutationObserver(keep);
        els.forEach((e) => window.__busyHold.observe(e, { attributes: true, attributeFilter: ['class'] }));
        keep();
        return 1;
      })()`
    : `window.__busyHold?.disconnect(); ${FAB}.classList.remove('busy'); ${PANEL}.classList.remove('busy'); 1`);
await hold(true);
await sleep(500);
check('busy, the ring is drawn and orbiting', (await ev(`(() => { const s = getComputedStyle(document.querySelector('.nova-fab .ds-fab-ring')); return +s.opacity > 0.9 && s.animationName === 'ds-fab-orbit'; })()`)) === true);
check('and the header’s scan line shows', +(await ev(`getComputedStyle(document.querySelector('#nova-panel .ds-panel-header'), '::after').opacity`)) > 0.5);
await shot('window-thinking');
await hold(false);

console.log('\n6 · A reply that lands while minimized');
await waitFor(`!${FAB}.classList.contains('busy')`, 15000);
// Watch the FAB's class rather than poll it: a scripted reply can be shorter
// than a poll under load. Then send and minimize in ONE tick, so the reply is
// always still coming when the window shuts.
await ev(`(() => {
  window.__fabBusyWhileShut = false;
  const f = ${FAB};
  new MutationObserver(() => { if (f.classList.contains('busy') && !f.classList.contains('open')) window.__fabBusyWhileShut = true; }).observe(f, { attributes: true, attributeFilter: ['class'] });
  const t = document.querySelector('#nova-panel textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'what is the airspeed of an unladen swallow');
  t.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(100);
await ev(`document.querySelector('#nova-panel button[aria-label="Send"]').click(); const m = document.querySelector('#nova-panel button[aria-label="Minimize Nova"]'); m.focus(); m.click(); 1`);
await sleep(200);
check('Minimize shuts the window', !(await ev(windowOpen)));
check('focus comes back to the FAB, not <body>', await ev(`document.activeElement === ${FAB}`));
const busyNow = await ev(`${FAB}.classList.contains('busy')`);
if (busyNow) check('the FAB is named for it while it thinks', /thinking/.test(await ev(`${FAB}.getAttribute('aria-label')`)));
check('the reply finishes', await waitFor(`!${FAB}.classList.contains('busy')`, 15000));
await sleep(300);
check('the ring ran while the window was shut', await ev(`window.__fabBusyWhileShut === true`));
check('the badge lands', await ev(`!!document.querySelector('.nova-fab .ds-fab-badge')`));
check('and the label says so — not the dot alone', (await ev(`${FAB}.getAttribute('aria-label')`)) === 'Ask Nova — new reply');
check('and it is announced', /Nova replied/.test(await ev(`[...document.querySelectorAll('.ds-sr-only[role="status"]')].map((e) => e.textContent).join('|')`)));
await shot('fab-unread');
await ev(`${FAB}.click()`);
await sleep(700);
check('opening clears the badge', await ev(`!document.querySelector('.nova-fab .ds-fab-badge')`));
check('and the reply is in the log', (await ev(`document.querySelectorAll('#nova-panel .ds-chat-msg.assistant').length`)) >= 1);

console.log('\n7 · Escape');
await ev(`document.querySelector('#nova-panel textarea')?.focus()`);
await key('Escape');
await sleep(200);
check('Escape from an empty composer shuts the window', !(await ev(windowOpen)));
check('and hands focus to the FAB', await ev(`document.activeElement === ${FAB}`));

console.log('\n8 · One Nova');
await ev(`localStorage.setItem('novaPinned', 'true')`);
await go('/');
check('a preference saved open opens the WINDOW, not the rail', (await ev(windowOpen)) && !(await ev(`document.querySelector('.shell').classList.contains('nova-open')`)));
check('opened another way, focus is not moved into it', await ev(`!${PANEL}.contains(document.activeElement)`));
await go('/nova');
check('on /nova the page is the chat: no FAB', await ev(`!document.querySelector('.ds-fab')`));
check('and the way back names the window', await ev(`!!document.querySelector('.shell-util button[aria-label="Back to chat window"]')`));

console.log('\n9 · The corner');
await go('/');
const stack = await ev(`(() => {
  const s = document.createElement('div'); s.className = 'ds-toast-stack'; s.style.height = '10px'; s.style.width = '10px';
  document.querySelector('.shell').appendChild(s);
  const b = s.getBoundingClientRect().bottom; s.remove();
  return { b, fabTop: ${FAB}.getBoundingClientRect().top };
})()`);
check('the toast stack lifts above the FAB', stack.b <= stack.fabTop - 8, JSON.stringify(stack));
await shot('window-dark');
await ev(`localStorage.setItem('theme', 'light')`);
await go('/');
await shot('window-light');
check('light: the FAB face keeps its contrast (white on the accent)', await ev(`getComputedStyle(${FAB}).color === 'rgb(255, 255, 255)'`));
await ev(`localStorage.removeItem('theme')`);

// The right-hand rails stop above the FAB: it sat on the game panel's last action (October 27).
await ev(`localStorage.setItem('novaPinned', 'false'); 1`); // Nova open takes the rail from the game panel
await go('/play?game=eldenring');
await sleep(600);
const railFab = await ev(`(() => { const p = document.querySelector('.game-panel.open')?.getBoundingClientRect(); const f = ${FAB}?.getBoundingClientRect(); return p && f ? { pb: p.bottom, ft: f.top } : null; })()`);
check('the game panel ends above the FAB, not under it', !!railFab && railFab.pb <= railFab.ft - 8, JSON.stringify(railFab));
await shot('game-panel-fab');

console.log('\n10 · A phone');
await ev(`localStorage.setItem('novaPinned', 'false')`);
await viewport(390, 844);
await go('/');
const phone = await ev(`(() => {
  const f = ${FAB}?.getBoundingClientRect(); const n = document.querySelector('.shell-bottom-nav')?.getBoundingClientRect();
  return f && n ? { fabB: f.bottom, navT: n.top, r: f.right } : null;
})()`);
check('the FAB rides above the bottom nav', !!phone && phone.fabB <= phone.navT - 8, JSON.stringify(phone));
await shot('phone-closed');
await ev(`${FAB}.click()`);
await sleep(700);
const sheet = await rect(PANEL);
check('open, the window is the sheet between the bars', !!sheet && Math.round(sheet.w) === (await ev(`document.documentElement.clientWidth`)) && sheet.t >= 60, JSON.stringify(sheet));
check('and the FAB stands down over it', await ev(`!document.querySelector('.ds-fab')`));
await shot('phone-open');
await ev(`document.querySelector('#nova-panel button[aria-label="Minimize Nova"]').click()`);
await sleep(500);
check('Minimize brings the FAB back', await ev(`!!document.querySelector('.ds-fab')`));
await viewport(W, H);

console.log('\n11 · Reduced motion');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await go('/');
await ev(`${FAB}.classList.add('busy'); 1`);
await sleep(300);
const rm = await ev(`(() => { const s = getComputedStyle(document.querySelector('.nova-fab .ds-fab-ring')); return { busy: ${FAB}.classList.contains('busy'), anim: s.animationName, op: s.opacity }; })()`);
check('reduced motion: the ring stops orbiting but stays visible', rm.busy && rm.anim === 'none' && +rm.op > 0.9, JSON.stringify(rm));
await ev(`${FAB}.classList.remove('busy'); 1`);
await send('Emulation.setEmulatedMedia', { features: [] });

console.log('\n12 · The top bar is untouched');
await ev(`localStorage.setItem('novaEntry', 'topbar'); localStorage.setItem('novaPinned', 'false')`);
await go('/');
await ev(`document.querySelector('.shell-util button[aria-label="Ask Nova"]')?.click()`);
await sleep(600);
check('back on Top bar, the button docks the rail and the page makes room', (await ev(`${PANEL}.classList.contains('open') && !${PANEL}.classList.contains('window')`)) && (await ev(`document.querySelector('.shell').classList.contains('nova-open')`)));
check('with no FAB', await ev(`!document.querySelector('.ds-fab')`));
check('and the rail has no height handle — it runs top bar to foot', await ev(`!document.querySelector('#nova-panel .ds-resize-handle.top')`));
check('and the rail keeps its own width — the window’s drag never reached it', near((await rect(PANEL)).w, 380), JSON.stringify(await rect(PANEL)));

check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
await ev(`['novaEntry', 'novaPinned', 'novaWindowW', 'novaWindowH', 'novaPanelW', 'trhs-modules', 'trhs-nova', 'mvpScope'].forEach((k) => localStorage.removeItem(k)); 1`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
ws.removeAllListeners('close');
ws.close();
process.exit(failed.length ? 1 : 0);

// Where the "Arrange displays" editor puts you DOWN.
//
// The Personalize `Desk` card's `Arrange` opens the editor by deep link
// (`&arrange=1`, 2026-08-19, so one press ends where the label promised). Closing
// it used to leave the user in the monitor modal — a window they never opened
// (Cindy, 2026-08-21). The fix adds `&from=personalize`, read ONCE at mount, so
// the two doors into one editor can close differently. Both halves are checked
// here: the marked door returns, the unmarked door stays.
//
// Two harness facts, both measured 2026-08-21 and both expensive to rediscover:
//   · Headless needs SOFTWARE WebGL. This page mounts Light Studio (three.js);
//     with `--disable-gpu` the renderer throws and #root stays empty, which reads
//     as "the Desk card is missing". Launch with
//     `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
//   · Set the route AFTER the load. Passing `#/personalize` on the navigation URL
//     came up with an empty `location.hash`; assigning `location.hash` once the
//     app has mounted is reliable (and is what a user does anyway).
//
// Run: dev server on :5196, headless Chrome on :9241, from web/.
//   node scripts/verify-arrange-return.mjs
import WebSocket from 'ws';
// Address comes from the environment, not the file: work happens in a fresh
// worktree per task, so a port written into the script goes stale the day it is
// written (2026-08-24 — fourteen older checks are stranded that way).
const CDP = process.env.CDP || '9241', PORT = process.env.PORT || '5196';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); let id=0;
const tl=await fetch(`http://localhost:${CDP}/json/list`).then(r=>r.json());
const t=tl.find(x=>x.type==='page');
const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});
await new Promise(r=>ws.once('open',r));
const pend=new Map();
ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
const send=(me,pa={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{resolve:res,reject:rej});ws.send(JSON.stringify({id:i,method:me,params:pa}));});
const ev=async e=>{const{result,exceptionDetails}=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(exceptionDetails)throw new Error(JSON.stringify(exceptionDetails).slice(0,400));return result.value;};
const wait=async(e,ms=45000)=>{const u=Date.now()+ms;while(Date.now()<u){if(await ev(`!!(${e})`))return true;await sleep(300);}return false;};
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '\u2713' : '\u2717'} ${name}${detail ? ' \u2014 ' + detail : ''}`);
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:2,mobile:false});

const DESK=`(()=>{const c=[...document.querySelectorAll('.w')].find(w=>w.querySelector('.w-label-text')?.textContent.trim()==='Desk');return c?c.querySelector('.w-link'):null;})()`;
const S=`({hash:location.hash,editor:!!document.querySelector('.arrange-modal'),device:!!document.querySelector('.dc-canvas, .modal-shell:not(.arrange-modal)'),desk:!!${DESK}})`;

await send('Page.navigate',{url:`http://localhost:${PORT}/?v=${Date.now()}`});
await sleep(1000);
await wait(`document.getElementById('root')?.children.length`);
await ev(`location.hash='#/personalize'`);
await sleep(1500);
check('Personalize shows a Desk card', await wait(DESK));
// `Arrange N displays` since 2026-09-21 (`screens` from 09-08): the card stands
// computers too, the window moves displays only, so the door says how many it
// opens onto — in the window's own word (its title is `Arrange displays`).
check('its link is named Arrange, and says how many displays it opens onto',
  /^Arrange \d displays$/.test(String(await ev(`(()=>{const b=${DESK};return b?b.textContent.trim():null;})()`))));
await ev(`(()=>{const b=${DESK};b.click();})()`);
check('pressing it opens the editor', await wait(`document.querySelector('.arrange-modal')`));
const opened = await ev(S);
check('the deep link carries the way back', /from=personalize/.test(opened.hash), opened.hash);
await ev(`document.querySelector('.arrange-modal .modal-close').click()`);
await sleep(2000);
const closed = await ev(S);
check('closing lands back on Personalize', closed.hash === '#/personalize', closed.hash);
check('the monitor window is not left standing open', !closed.device);
check('the editor is gone', !closed.editor);
check('the Desk card is on screen again', closed.desk);

// ── the unmarked door must NOT navigate ─────────────────────────────────────
// Same editor, opened with no way back. This is the shape the hero's own
// `Arrange` link produces, and the shape a test can reach: a cold load with
// `?sku=` alone gets its params cleaned by AppShell before the modal mounts.
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` });
await sleep(1000);
await wait(`document.getElementById('root')?.children.length`);
await ev(`location.hash='#/?sku=treehouse-32&arrange=1'`);
await sleep(1500);
check('a deep link with no marker still opens the editor', await wait(`document.querySelector('.arrange-modal')`));
const plainOpen = await ev(S);
check('and the monitor window is underneath it', plainOpen.device);
await ev(`document.querySelector('.arrange-modal .modal-close').click()`);
await sleep(2000);
const plainClosed = await ev(S);
check('closing it leaves you in the monitor window', plainClosed.device && !plainClosed.editor,
  `device=${plainClosed.device} editor=${plainClosed.editor}`);
check('and does not wander off to Personalize', !/personalize/.test(plainClosed.hash), plainClosed.hash);

// Not covered on purpose: clicking the dimmed background. `ArrangeEditor` hands
// the Backdrop the SAME `onClose` prop as the close button one line below it, so
// a browser check there would be re-testing React, not our branch.
// ── the desk map is a set of doors ───────────────────────────────────────────
// Regression 2026-08-24: `pointerup` bubbles to the stage BEFORE a tile's
// `click`, and the stage cleared the press mark, so every click on another
// display measured nothing and returned early — the map looked interactive and
// opened nothing. Driven with real mouse events on purpose: the bug lived in
// the ORDER of pointerup and click, which a synthetic `.click()` never rehearses.
await send('Page.navigate', { url: `http://localhost:${PORT}/?v=${Date.now()}` });
await sleep(900);
await ev(`location.hash='#/?sku=treehouse-32&tab=display'`);
await sleep(2000);
{
  const spot = await ev(`(() => { const t = [...document.querySelectorAll('.dsa-disp.navigable')][0];
    if (!t) return null; const r = t.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  const before = await ev(`location.hash`);
  if (spot) {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', clickCount: 1 });
      await sleep(60);
    }
    await sleep(1000);
  }
  const after = await ev(`location.hash`);
  check('clicking another display on the desk map opens that display', !!spot && before !== after,
    `${before} → ${after}`);
}

// ── The hero's tiles land where their own numbers say (2026-09-01) ───────────
// A COLD mount straight into the monitor window is the case that broke: the
// stage's reference box arrives in two steps, and the tiles' left/top
// transition then animated from a place they were never meant to be — and
// stalled there. Measured that day: inline `--dsa-l` 0.0328 and `--dsa-href`
// 732px, computed `left` frozen at 217.35px (the PREVIOUS layout's pixel) for
// 6.8s, both displays parked against the right edge. Any resize repaired it,
// which is why it read as intermittent.
//
// So this asserts the invariant rather than the pixel: whatever the layout is,
// a tile's computed `left` must equal its own fraction times the stage's own
// reference. If someone puts a transition back on these tiles, this is what
// says so.
await send('Page.navigate', { url: `http://localhost:${PORT}/?cold=1#/?sku=treehouse-32&tab=display` });
await sleep(3000);
const geom = await ev(`(() => {
  const st = document.querySelector('.dsa-stage');
  if (!st) return null;
  const href = parseFloat(getComputedStyle(st).getPropertyValue('--dsa-href'));
  const sr = st.getBoundingClientRect();
  const tiles = [...st.querySelectorAll('.dsa-disp')].map((e) => ({
    frac: parseFloat(e.style.getPropertyValue('--dsa-l')),
    left: parseFloat(getComputedStyle(e).left),
    x: e.getBoundingClientRect().left - sr.left,
    w: e.getBoundingClientRect().width,
  }));
  return { href, stageW: sr.width, tiles };
})()`);
if (geom && geom.tiles.length) {
  const off = geom.tiles.map((t) => Math.abs(t.left - t.frac * geom.href));
  check('cold mount: every tile sits at its own fraction of the stage',
    off.every((d) => d < 1.5), off.map((d) => d.toFixed(1)).join(' / '));
  const l = Math.min(...geom.tiles.map((t) => t.x));
  const r = geom.stageW - Math.max(...geom.tiles.map((t) => t.x + t.w));
  check('cold mount: and the desk is centred on the stage', Math.abs(l - r) < 6,
    `${Math.round(l)} left / ${Math.round(r)} right`);
}

ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} FAILED` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

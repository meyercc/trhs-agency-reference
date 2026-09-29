// Does the room only ever move what the sensor is allowed to move?
//
// Why this file exists (2026-09-23, Cindy chose the sensor over the clock): the
// Display tab has promised since 2026-08 that "with Auto-Brightness on, the
// room's light or what's on screen sets the level", and nothing could make the
// room change, so the sentence was a claim with no engine. Admin → Room light
// is the engine for a demo. Four promises hang off it:
//   · Ambient follows the room — the slider actually settles where the room says
//   · `Off` and `Content` do NOT — the person took the wheel, or another source has it
//   · the DISPLAY side only — the room must not reach the profile store, the
//     app's appearance, or any other device (Cindy: "디스플레이쪽에서만 적용")
//   · our Admin rows stay one block at the bottom (2026-09-21, repeated 09-23)
//
// The third is the one worth a script: an absence is what nobody notices
// regressing.
//
// Run: dev server on :5212, headless Chrome (software WebGL) on :9331, from web/.
import WebSocket from 'ws';

const PORT = process.env.PORT || '5212';
const CDP = process.env.CDP || '9331';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const tl = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
const ws = new WebSocket(tl.find((x) => x.type === 'page').webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.once('open', r));
const pend = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++msgId; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1250, deviceScaleFactor: 1, mobile: false });

let n = 0;
const open = async (hash) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/?t=${++n}${hash}` });
  for (let waited = 0; waited < 20000; waited += 100) {
    if (await ev(`!!(document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild)`)) break;
    await sleep(100);
  }
  await sleep(900);
};
/** The bar's question row, as text — '' when the bar is saying nothing. */
const setStore = (pairs) => ev(Object.entries(pairs).map(([k, v]) => `localStorage.setItem('${k}','${v}')`).join(';'));

/** Per-monitor storage, the way the app writes it (2026-09-18 split by sku). */
const setRoom = (room) => setStore({ roomLight: room });
const setSource = (src) =>
  ev(`localStorage.setItem('autoBrightnessBySku', JSON.stringify({ 'treehouse-32': '${src}' }))`);
const setLevelNow = (n) =>
  ev(`localStorage.setItem('displayPictureBySku', JSON.stringify({ 'treehouse-32': { brightness: ${n}, contrast: 55, sharpness: 30, blackStretch: 'Off', colorPreset: '', byMode: {} } }))`);

// ── Ambient follows the room ────────────────────────────────────────────────
const levelOf = () => ev(`(() => {
  // The monitor window's own slider, not the home card's and not the other
  // monitor's — scoped to the open canvas and read from the input, because the
  // page text also carries a promo that ends in a percent sign (the first cut
  // of this check read "96% off 500+ PC titles" and failed everything).
  const el = document.querySelector('.mc-canvas input[aria-label="Brightness"], .dc-canvas input[aria-label="Brightness"]');
  return el ? Number(el.value) : null;
})()`);

for (const [room, want] of [['dark', 30], ['bright', 90], ['dim', 55]]) {
  await setRoom(room);
  await setSource('Ambient');
  await open('#/?sku=treehouse-32&tab=display');
  const got = await levelOf();
  check(`a ${room} room settles the slider near ${want}%`, got === want, `${got}%`);
}

// ── The two sources the room may not touch ──────────────────────────────────
for (const source of ['Off', 'Content']) {
  await setRoom('bright');
  await setSource(source);
  await setLevelNow(42);
  await open('#/?sku=treehouse-32&tab=display');
  const got = await levelOf();
  check(`Auto-Brightness ${source}: the room leaves the level alone`, got === 42, `${got}%`);
}

// ── Off means off ───────────────────────────────────────────────────────────
await setRoom('off');
await setSource('Ambient');
await setLevelNow(42);
await open('#/?sku=treehouse-32&tab=display');
check('Room light Off makes no claim about the room', (await levelOf()) === 42, `${await levelOf()}%`);

// ── The display side only ───────────────────────────────────────────────────
// The room must leave everything outside the monitor window exactly as it found
// it: the active profile, the app's appearance. Read before and after, compare.
await setRoom('off');
await setSource('Ambient');
await open('#/?sku=treehouse-32&tab=display');
const outside = () => ev(`JSON.stringify({
  profiles: localStorage.getItem('profiles'),
  activeProfileId: localStorage.getItem('activeProfileId'),
  accent: localStorage.getItem('accent'),
  wallpaper: localStorage.getItem('wallpaper'),
  theme: localStorage.getItem('theme'),
  monitorMode: localStorage.getItem('monitorMode'),
})`);
const before = await outside();
await setRoom('dark');
await open('#/?sku=treehouse-32&tab=display');
const after = await outside();
check('a darker room touches nothing outside the monitor', before === after, before === after ? '' : `${before} → ${after}`);

// ── The card says which room it is on ───────────────────────────────────────
// Through the control itself, not a sentence beside it: the dropdown already
// reads `Dark`, and a status line repeating it is the kind of added wording
// this screen keeps being told to stop growing.
await open('#/?modal=admin');
const roomShown = await ev(`document.querySelector('.admin-desk-room .ds-dropdown-label, .admin-desk-room [aria-label="Room light"]')?.textContent?.trim() || ''`);
check('the card shows the room it is on', /Dark/.test(roomShown), roomShown || '(control not found)');

// ── Ours is ONE card ────────────────────────────────────────────────────────
// Ownership has to be readable in the LAYOUT, and "readable" means countable:
// our whole demo block is ONE card at the end of Testing tools, not a run of
// adjacent ones. The rule was written as "one block, at the end" on 2026-09-23
// and the next thing built under it was a second card sitting next to the first
// — the letter kept, the point missed (Cindy, third time: "왜 같은 실수 재반복
// 이니?"). So the check counts cards instead of checking order.
await open('#/?modal=admin');
const cards = await ev(`[...document.querySelectorAll('.admin-tool-name')].map((e) => e.textContent.trim())`);
const OURS = ['Display scenario'];
const THEIRS = ['First-boot onboarding', 'Device simulator'];
check('our demo block is a single card', cards.filter((n) => !THEIRS.includes(n)).length === 1, cards.join(' · '));
check('and it is the last one', cards[cards.length - 1] === OURS[0], cards.join(' · '));
check(
  'the room control lives inside that card',
  await ev(`!!document.querySelector('.admin-desk .admin-desk-room [aria-label="Room light"]')`),
);

ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} FAILED` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

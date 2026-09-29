// CDP walkthrough for the software-profile foundation — the half of the model
// that only exists once it's running in a browser.
//
// Two claims to protect:
//   1. RESOLUTION. A profile's `overrides` sit on top of the Settings baseline.
//      An overridden key wins, an unset key falls through, and the baseline is
//      never written by either. Settings resolves this internally, so every
//      `useSettings()` consumer is profile-aware without knowing profiles exist.
//   2. CAPTURE. Software-scope device settings live on the active profile, so
//      they survive the panel closing. They used to be `useState({})` — set in
//      software scope, gone on unmount.
//
// The arbitration rules are NOT tested here; they're pure, and tested directly
// in verify-profiles.mjs.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

const httpJson = (p) => fetch(`http://localhost:${CDP_PORT}` + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = (await httpJson('/json/list')).find((x) => x.type === 'page');
if (!target) throw new Error(`No page target on :${CDP_PORT} — is headless Chrome running?`);
const ws = new WebSocket(target.webSocketDebuggerUrl);

let msgId = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((r) => ws.on('open', r));
await send('Runtime.enable');
await send('Page.enable');

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}

// Poll until `expr` is truthy. Replaces fixed sleeps: under CPU contention (the
// parallel verify lane) even a 3s sleep read the panel before it rendered. An
// eval that throws (context torn down by a navigation) counts as not-yet.
async function waitFor(expr, timeoutMs = 8000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    try { if (await evalJs(`!!(${expr})`)) return true; } catch {}
    await sleep(100);
  }
  return false;
}
const BOOTED = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild
  && getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()`;

// Always Page.reload, never a hash change: under HashRouter a hash-only
// navigate doesn't re-boot the app, so it would go on running with the OLD
// localStorage and every persistence check would silently read stale state.
// The old document is marked before the reload so the wait cannot be satisfied
// by it — a reload keeps the URL, so there is no ?r= to tell the two apart.
const reload = async () => {
  await evalJs(`window.__stale = 1`);
  await send('Page.reload');
  await waitFor(`!window.__stale && ${BOOTED}`);
};
let loadN = 0;
/** Open a device panel. `?r=N` before the hash forces a real boot — a hash-only
 *  change never re-boots the app under HashRouter. */
const openDevice = async (sku, tab) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await waitFor(`location.search.includes('r=${loadN}') && ${BOOTED}
    && document.querySelector('.dc-canvas .ds-ng3-body') && document.querySelector('.pb')`);
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Leave the app as we found it. These suites rewrite the profile store and the
// appearance baseline, and other suites (verify-device-button drives the Active
// Profile widget by button label) read that state — a renamed profile left
// behind fails a suite that has nothing to do with profiles.
async function cleanup() {
  try {
    await evalJs(`['trhs-profiles','accent','theme','wallpaper','wpBlur','wpOpacity'].forEach((k) => localStorage.removeItem(k))`);
  } catch {
    /* page already gone — nothing to restore */
  }
}

const cssVar = (n) => evalJs(`getComputedStyle(document.documentElement).getPropertyValue('${n}').trim()`);
// --accent-color is set to `var(--accent-<id>)`, so the computed value is the
// resolved hex — compare against the token, never against the id string.
const accentIs = async (id) => (await cssVar('--accent-color')) === (await cssVar(`--accent-${id}`));

const storeWith = (overrides, activeId = 'gaming') => {
  const p = (id, name, color, ov) =>
    `{id:'${id}',name:'${name}',color:'${color}',overrides:${ov},devices:{},` +
    `gameLink:{enabled:false,gameIds:[]},schedule:{enabled:false,start:540,end:1020,days:[1,2,3,4,5]}}`;
  return `localStorage.setItem('trhs-profiles', JSON.stringify({profiles:[${p('gaming', 'Gaming', 'red', overrides)},${p('silent', 'Silent', 'indigo', '{}')}],activeId:'${activeId}',source:'manual',revertTo:null}))`;
};

await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` });
await waitFor(BOOTED);

// ── 1. Resolution ───────────────────────────────────────────────────────────
await evalJs(`localStorage.clear(); localStorage.setItem('accent','orange')`);
await reload();
check('baseline applies when no profile overrides it', await accentIs('orange'), await cssVar('--accent-color'));

await evalJs(storeWith(`{accent:'purple'}`));
await reload();
check('an override beats the baseline', await accentIs('purple'), await cssVar('--accent-color'));
check('overriding never writes the baseline', (await evalJs(`localStorage.getItem('accent')`)) === 'orange');

await evalJs(storeWith(`{}`));
await reload();
check('an unset key falls through to the baseline', await accentIs('orange'), await cssVar('--accent-color'));

// Only the OVERRIDABLE list can be taken over. `theme` isn't on it, so a
// profile claiming it must be ignored rather than quietly honoured.
await evalJs(storeWith(`{accent:'purple',theme:'dark'}`));
await evalJs(`localStorage.setItem('theme','light')`);
await reload();
check('a key outside OVERRIDABLE is ignored', await evalJs(`document.documentElement.classList.contains('light')`));
await evalJs(`localStorage.setItem('theme','dark')`);

// Switching profiles swaps the resolved value with no reload.
await evalJs(storeWith(`{accent:'purple'}`));
await reload();
await evalJs(`(()=>{const s=JSON.parse(localStorage.getItem('trhs-profiles'));s.activeId='silent';localStorage.setItem('trhs-profiles',JSON.stringify(s))})()`);
await reload();
check('switching to a profile with no override restores the baseline', await accentIs('orange'), await cssVar('--accent-color'));

// ── 2. Migration ────────────────────────────────────────────────────────────
// Pre-profiles installs stored only `activeProfileId`. Nothing is persisted
// until the first write, so the proof is what the app RENDERS, not storage.
await evalJs(`localStorage.clear(); localStorage.setItem('activeProfileId','silent')`);
await openDevice('origins-65', 'lighting');
const barText = await evalJs(`document.querySelector('.pb')?.innerText.replace(/\\n/g,' | ') || 'no bar'`);
check('a pre-profiles install keeps the profile it was on', /Silent/.test(barText), barText);

// ── 3. Capture ──────────────────────────────────────────────────────────────
// The keyboard's lighting brightness is one of only TWO controls in the app
// wired through `profile.value/setValue` (the other is `settings.pollingRate`).
// Everything else — mouse DPI, headset volume — keeps local state and only
// reports dirtiness, so it lands in neither a profile nor a flash slot. That is
// pre-existing scope, not something this foundation changed; widening it is a
// per-tab job. Test what's actually wired.
await evalJs(`localStorage.clear()`);
await openDevice('origins-65', 'lighting');
await waitFor(`document.querySelector('.pdm-bright-slider input[type=range]') || document.querySelector('.pb-scope-body input[type=range]')`);

const moved = await evalJs(`(() => {
  const el = document.querySelector('.pdm-bright-slider input[type=range]')
          || document.querySelector('.pb-scope-body input[type=range]');
  if (!el) return 'no-slider';
  const before = Number(el.value);
  const next = before > Number(el.min || 0) + 10 ? before - 10 : before + 10;
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  set.call(el, String(next));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return before + '→' + el.value;
})()`);
check('the lighting tab offers a profile-wired control', moved !== 'no-slider', moved);
// The capture lands in storage on the profile store's next write, not synchronously.
await waitFor(`(() => { try {
  const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null');
  const p = s && s.profiles.find((x) => x.id === s.activeId);
  return !!p && Object.keys(p.devices || {}).length > 0;
} catch { return false; } })()`);

const captured = await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null');
  if (!s) return 'no-store';
  const p = s.profiles.find((x) => x.id === s.activeId) || {};
  const keys = Object.keys(p.devices || {});
  return keys.length ? JSON.stringify({ sku: keys[0], bag: p.devices[keys[0]] }) : 'empty';
})()`);
check('a software-scope edit lands on the active profile', !['empty', 'no-store'].includes(captured), String(captured).slice(0, 100));

await openDevice('origins-65', 'lighting');
const survived = await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null');
  if (!s) return 'no-store';
  const p = s.profiles.find((x) => x.id === s.activeId) || {};
  const keys = Object.keys(p.devices || {});
  return keys.length ? JSON.stringify(p.devices[keys[0]]) : 'empty';
})()`);
check('and survives a reload — it used to be session-local', !['empty', 'no-store'].includes(survived), String(survived).slice(0, 100));

// A second profile must not see the first one's capture.
await evalJs(`(()=>{const s=JSON.parse(localStorage.getItem('trhs-profiles'));
  s.profiles.push({id:'other',name:'Other',color:'cyan',overrides:{},devices:{},gameLink:{enabled:false,gameIds:[]},schedule:{enabled:false,start:540,end:1020,days:[1,2,3,4,5]}});
  s.activeId='other'; localStorage.setItem('trhs-profiles',JSON.stringify(s))})()`);
await openDevice('origins-65', 'lighting');
const isolated = await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles'));
  const p = s.profiles.find((x) => x.id === 'other');
  return Object.keys(p.devices || {}).length;
})()`);
check('captures are per-profile, not shared', isolated === 0, `other has ${isolated} device bags`);

await cleanup();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

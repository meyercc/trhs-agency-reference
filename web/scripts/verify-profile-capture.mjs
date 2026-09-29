// Coverage probe: does changing a device control actually reach the profile?
//
// This one MEASURES rather than asserts a hand-written list. For each device
// tab it finds every control in the panel, changes each one, and diffs the
// active profile's captured bag. A control that moves the UI but writes nothing
// is state that dies when the panel closes — which is what the whole widening
// pass was about.
//
// Reported per tab as `driven` (control interactions) vs `keys` (distinct
// settings captured). The two do NOT have to match, and a gap is not a bug:
// a radio group is five controls writing one key, and some controls must never
// be captured at all (mute is live status, not a setting). What matters is that
// `keys` is never zero on a tab that has controls — that was the old world,
// where a panel full of controls wrote nothing at all.
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}

let loadN = 0;
const open = async (sku, tab) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}#/?sku=${sku}${tab ? '&tab=' + tab : ''}` });
  await sleep(2600);
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

/** Keys the active profile has captured for one device. */
const bagKeys = (sku) => evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null');
  if (!s) return [];
  const p = s.profiles.find(x => x.id === s.activeId) || {};
  return Object.keys((p.devices || {})[${JSON.stringify(sku)}] || {});
})()`);

/**
 * Drive every control in the open panel once.
 *
 * Sliders are nudged by a step, toggles/checkboxes clicked, radios moved to an
 * unchecked sibling, dropdowns opened and set to a different option. Returns
 * how many were driven so the ratio below means something.
 */
async function driveAll() {
  const n = await evalJs(`(() => {
    const root = document.querySelector('.pb-scope-body') || document.querySelector('.ds-ng3-panel');
    if (!root) return 0;
    let driven = 0;
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

    root.querySelectorAll('input[type=range]').forEach((el) => {
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
      const min = Number(el.min || 0), max = Number(el.max || 100);
      const step = Number(el.step || 1) || 1;
      const cur = Number(el.value);
      set.call(el, String(cur - step >= min ? cur - step : Math.min(max, cur + step)));
      fire(el, 'input'); fire(el, 'change');
      driven++;
    });

    root.querySelectorAll('.ds-toggle').forEach((el) => { el.click(); driven++; });

    root.querySelectorAll('.ds-checkbox input[type=checkbox], input[type=checkbox]').forEach((el) => {
      el.click(); driven++;
    });

    root.querySelectorAll('input[type=radio]').forEach((el) => {
      if (!el.checked) { el.click(); driven++; }
    });

    // Segmented groups mark the current option with .active, not aria-pressed.
    root.querySelectorAll('.ds-toggle-group').forEach((group) => {
      const other = [...group.querySelectorAll('.ds-toggle-group-btn')].find((b) => !b.classList.contains('active'));
      if (other) { other.click(); driven++; }
    });

    // role=radio list rows (pickup pattern, EQ presets).
    root.querySelectorAll('[role=radio]').forEach((el) => {
      if (el.getAttribute('aria-checked') !== 'true') { el.click(); driven++; }
    });

    window.__driven = driven;
    return driven;
  })()`);

  // Dropdowns need two ticks: open, then pick a different option.
  const dropdowns = await evalJs(`(() => {
    const root = document.querySelector('.pb-scope-body') || document.querySelector('.ds-ng3-panel');
    return root ? root.querySelectorAll('.ds-dropdown').length : 0;
  })()`);
  let ddDriven = 0;
  for (let i = 0; i < dropdowns; i++) {
    const ok = await evalJs(`(() => {
      const root = document.querySelector('.pb-scope-body') || document.querySelector('.ds-ng3-panel');
      const dd = root.querySelectorAll('.ds-dropdown')[${i}];
      if (!dd) return false;
      const trigger = dd.querySelector('.ds-dropdown-trigger');
      if (!trigger) return false;
      trigger.click();
      return true;
    })()`);
    if (!ok) continue;
    await sleep(160);
    // The popup is a ListBox of [role=option] rows, not `.ds-dropdown-item`, and
    // nothing marks the current one — so pick by text differing from the trigger.
    const picked = await evalJs(`(() => {
      const pop = document.querySelector('.ds-dropdown.open .ds-dropdown-pop');
      if (!pop) return false;
      const current = document.querySelector('.ds-dropdown.open .ds-dropdown-trigger')?.textContent.trim();
      const items = [...pop.querySelectorAll('[role=option]')];
      if (items.length < 2) { document.body.click(); return false; }
      const other = items.find(i => i.textContent.trim() !== current) || items[1];
      other.click();
      return true;
    })()`);
    await sleep(160);
    if (picked) ddDriven++;
  }
  return n + ddDriven;
}

/** Open a tab, drive everything, and report how much of it stuck. */
async function coverage(label, sku, tab) {
  await evalJs(`localStorage.removeItem('trhs-profiles')`);
  await open(sku, tab);
  const before = await bagKeys(sku);
  const driven = await driveAll();
  await sleep(600);
  const after = await bagKeys(sku);
  const landed = after.filter((k) => !before.includes(k)).length;
  return { label, driven, landed, keys: after };
}

const TABS = [
  ['mouse/sensor', 'saga-pro', 'sensor'],
  ['kbd/lighting', 'origins-65', 'lighting'],
  ['kbd/settings', 'origins-65', 'settings'],
  ['headset/audio', 'cloud-iii', 'audio'],
  ['headset/spatial', 'cloud-iii', 'spatial'],
  ['headset/settings', 'cloud-iii', 'settings'],
  ['mic/audio', 'quadcast-2-s', 'audio'],
  ['mic/effects', 'quadcast-2-s', 'effects'],
  ['mic/lighting', 'quadcast-2-s', 'lighting'],
];

console.log('tab                    driven    keys');
const cov = [];
for (const [label, sku, tab] of TABS) {
  const c = await coverage(label, sku, tab);
  cov.push(c);
  console.log(`${label.padEnd(22)} ${String(c.driven).padStart(6)} ${String(c.landed).padStart(7)}`);
}
console.log('');

// Every tab that has controls must capture at least one of them. A zero here is
// the exact failure this pass existed to remove.
for (const c of cov) {
  if (c.driven === 0) {
    check(`${c.label}: no controls to drive (nothing to capture)`, true);
  } else {
    check(`${c.label}: changing a control reaches the profile`, c.landed > 0, `${c.keys.length} keys from ${c.driven} controls · ${c.keys.slice(0, 4).join(', ')}`);
  }
}

// The mouse sensor is the densest tab and the one that had NOTHING wired
// before, so it gets a real floor rather than "at least one".
const sensor = cov.find((c) => c.label === 'mouse/sensor');
check('mouse sensor captures its whole panel', (sensor?.landed ?? 0) >= 5, `${sensor?.landed} keys: ${sensor?.keys.join(', ')}`);

// Keys must stay tab-namespaced — the Profiles manifest groups on the prefix.
const allKeys = cov.flatMap((c) => c.keys);
check('every captured key is namespaced by its tab', allKeys.every((k) => k.includes('.')),
  allKeys.filter((k) => !k.includes('.')).join(', ') || 'all namespaced');

// Mute is live status, not a setting: a profile that muted you on activation
// would be a bug. It must never appear in a captured bag.
const muteKeys = allKeys.filter((k) => /mute$/i.test(k) && !/tapToMute$/i.test(k));
check('mute is never captured — it is live status, not a setting', muteKeys.length === 0,
  muteKeys.join(', ') || 'none');

// Captures are per device, so one device's keys must not land on another's.
check('captures stay on the device they came from', await evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null');
  if (!s) return true;
  const p = s.profiles.find(x => x.id === s.activeId) || {};
  return Object.keys(p.devices || {}).length <= 1;
})()`));

// ── Lighting paint and key assignments ──────────────────────────────────────
// The two settings that were Maps, and so sat out the one-line migration. They
// persist as records; what matters is that a reload shows the same board.
const kbdBag = () => evalJs(`(() => {
  const s = JSON.parse(localStorage.getItem('trhs-profiles') || 'null');
  if (!s) return {};
  const p = s.profiles.find(x => x.id === s.activeId) || {};
  return (p.devices || {})['origins-65'] || {};
})()`);
const painted = () => evalJs(`[...document.querySelectorAll('.kbd-key')].filter(k => k.style.getPropertyValue('--key-rgb')).length`);
const activePresetIndex = () => evalJs(`[...document.querySelectorAll('.pdm-preset')].findIndex(p => p.classList.contains('active'))`);

await evalJs(`['trhs-profiles','lightPresets'].forEach(k => localStorage.removeItem(k))`);
await open('origins-65', 'lighting');
check('an unpainted board has no paint to show', (await painted()) === 0);
await evalJs(`document.querySelectorAll('.pdm-preset-pick')[1]?.click()`);
await sleep(500);
let kb = await kbdBag();
check('picking a preset captures the preset and every key\'s color',
  typeof kb['lighting.preset'] === 'string' && Object.keys(kb['lighting.keyColors'] || {}).length > 60,
  `${kb['lighting.preset']} · ${Object.keys(kb['lighting.keyColors'] || {}).length} keys`);
await open('origins-65', 'lighting');
check('the paint is still on the board after a reload', (await painted()) > 60, `${await painted()} painted`);
check('and the picked preset is still the one highlighted', (await activePresetIndex()) === 1, `index ${await activePresetIndex()}`);

// ── The preset library persists (Settings.lightPresets) ─────────────────────
// Presets made in the editor used to die with the tab. The library is a
// Settings list now: create one, reload, it is there; delete it, it is gone.
const presetCount = () => evalJs(`document.querySelectorAll('.pdm-preset').length`);
const firstPresetName = () => evalJs(`document.querySelector('.pdm-preset .pdm-preset-pick span:last-child')?.textContent`);
const storedPresets = () => evalJs(`(JSON.parse(localStorage.getItem('lightPresets') || 'null') || []).length`);
const factoryCount = await presetCount();
await evalJs(`document.querySelector('.pdm-preset-fab')?.click()`);
await sleep(200);
await evalJs(`document.querySelector('.pdm-editor .ds-btn.accent')?.click()`);
await sleep(300);
check('saving in the preset editor adds a preset at the front',
  (await presetCount()) === factoryCount + 1 && (await firstPresetName()) === 'New Preset',
  `${await presetCount()} presets · first "${await firstPresetName()}"`);
check('and the library is stored in Settings', (await storedPresets()) === factoryCount + 1, `${await storedPresets()} stored`);
await open('origins-65', 'lighting');
check('the new preset is still there after a reload',
  (await presetCount()) === factoryCount + 1 && (await firstPresetName()) === 'New Preset',
  `${await presetCount()} presets · first "${await firstPresetName()}"`);
await evalJs(`document.querySelector('.pdm-preset .pdm-preset-menu')?.click()`);
await sleep(200);
await evalJs(`document.querySelector('.pdm-preset .pdm-cmenu-item.danger')?.click()`);
await sleep(300);
check('deleting it takes it out of the stored library',
  (await presetCount()) === factoryCount && (await storedPresets()) === factoryCount,
  `${await presetCount()} presets · ${await storedPresets()} stored`);

await open('origins-65', 'keys');
await evalJs(`document.querySelector('.pdm-cat')?.click()`);
await sleep(200);
await evalJs(`document.querySelector('.pdm-keycap')?.click()`);
await evalJs(`document.querySelector('.kbd-key[aria-label="Q"]')?.click()`);
await sleep(500);
kb = await kbdBag();
check('assigning a key captures the binding', Object.keys(kb['keys.binds'] || {}).length === 1, JSON.stringify(kb['keys.binds'] || null));
await open('origins-65', 'keys');
const qKind = await evalJs(`document.querySelector('.kbd-key[aria-label="Q"]')?.dataset.kind`);
check('the assignment is still on the key after a reload', qKind === 'custom', `data-kind=${qKind}`);

// Leave the app as we found it — other suites read this state.
await evalJs(`['trhs-profiles','lightPresets','accent','theme'].forEach(k => localStorage.removeItem(k))`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

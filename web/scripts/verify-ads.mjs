// CDP check for the advertising placement concepts (Admin → Testing tools →
// Advertising), added 2026-09-29.
//
// What is protected, in order of how expensive it would be to lose:
//  1. OFF BY DEFAULT. A fresh browser renders no ad markup at all and reserves
//     no space. This is the one that must never regress: a shared link must
//     not open with an ad in it unless the sharer put one there.
//  2. Each placement's GEOMETRY, as specified: the tile 300×250 and 12px from
//     the left and bottom edges; the banner 728×90, flush with the bottom edge
//     and centered; the "Obscure background" strip full-width and the banner's
//     height, behind the ad; the page reserving exactly the banner's height
//     under its content so the last row is never stuck behind the ad.
//  3. SCOPE. The two fixed placements follow every page. Banner Below Carousel
//     belongs to Home alone — in flow, below the carousel, above the board —
//     and is absent everywhere else.
//  4. The WAY IN. The Admin row's dropdown lists the four options in the named
//     order, actually changes the placement, and shows the Obscure toggle only
//     under Bottom Banner.
//  5. Every slot is labelled as an advertisement for assistive tech.
//  6. THE LOCK. The Admin row is hidden until ↑↑↓↓←→←→ B A Enter is typed while
//     the modal is open; a wrong sequence does nothing; the unlock persists per
//     browser; the final Enter does not press a focused button; a placement
//     left in storage renders nothing while locked; typing the code again
//     re-locks and turns the ad off. Driven with real CDP key events.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. Leaves the browser as it found it: the two ad keys are restored
// at the end.
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
});

async function evalJs(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  }
  return result.value;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

// Set the ad keys, then boot the route fresh so the Settings provider reads them.
/**
 * Seed the ad prefs, then land on `hash` with them already in force.
 *
 * This used to navigate, `sleep(500)`, `location.reload()` and `sleep(1800)` —
 * two page loads and 2300ms of blind waiting, twelve times over. The reload was
 * there because a hash-only change does not remount (gotcha 33); a
 * cache-busting query makes the FIRST navigation a real load, so the second one
 * is unnecessary. And the fixed sleep was the "no readiness guard" this suite
 * was recorded crashing on under lane contention — it now waits for the app to
 * mount and paint instead (TH-449).
 */
const boot = async (hash, placement, obscure, unlocked = true) => {
  await evalJs(`localStorage.setItem('adPlacement', ${JSON.stringify(placement)}); localStorage.setItem('adObscure', ${JSON.stringify(obscure ? 'true' : 'false')}); localStorage.setItem('adUnlocked', ${JSON.stringify(unlocked ? 'true' : 'false')}); 1`);
  const loaded = new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Page.loadEventFired') { ws.off('message', onMsg); resolve(); }
    };
    ws.on('message', onMsg);
  });
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?v=${Date.now()}#${hash}` });
  await Promise.race([loaded, sleep(8000)]);
  // Not `.ad-slot` — "off by default" is one of the things checked here, so the
  // ad layer is legitimately absent. The shell is what must be up.
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    if (await evalJs(`!!document.querySelector('.shell') && document.body.innerText.trim().length > 50`).catch(() => false)) break;
    await sleep(50);
  }
  await evalJs(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`).catch(() => {});
  await sleep(250);
};

// Everything the checks read, in one trip.
const GEO = `(() => {
  const slot = document.querySelector('.ad-slot');
  const host = document.querySelector('.ad-host');
  const obs = document.querySelector('.ad-obscure');
  const content = document.querySelector('.shell-content');
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), left: Math.round(b.left), right: Math.round(innerWidth - b.right), top: Math.round(b.top), bottom: Math.round(innerHeight - b.bottom) }; };
  const z = (el) => el ? parseInt(getComputedStyle(el).zIndex, 10) : null;
  return {
    slot: r(slot), host: r(host), obs: r(obs),
    label: slot ? slot.textContent.trim() : null,
    aria: slot ? slot.getAttribute('aria-label') : null,
    hostPos: host ? getComputedStyle(host).position : null,
    inline: !!document.querySelector('.ad-inline .ad-slot'),
    zHost: z(host), zObs: z(obs),
    shellFlag: !!document.querySelector('.shell.ad-bottom-banner'),
    pad: parseFloat(getComputedStyle(content).paddingBottom),
    carouselBottom: (() => { const c = document.querySelector('.home-carousel'); return c ? Math.round(c.getBoundingClientRect().bottom) : null; })(),
    boardTop: (() => { const b = document.querySelector('.wb-grid'); return b ? Math.round(b.getBoundingClientRect().top) : null; })(),
    slotCount: document.querySelectorAll('.ad-slot').length,
  };
})()`;

// Remember the browser's own settings so they can be put back.
const saved = await (async () => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` });
  await sleep(1200);
  return evalJs(`({ p: localStorage.getItem('adPlacement'), o: localStorage.getItem('adObscure'), u: localStorage.getItem('adUnlocked') })`);
})();

try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  // ── 1. Off by default ────────────────────────────────────────────────────
  await evalJs(`localStorage.removeItem('adPlacement'); localStorage.removeItem('adObscure'); localStorage.removeItem('adUnlocked'); 1`);
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` });
  await sleep(400);
  await evalJs('location.reload(); 1').catch(() => {});
  await sleep(1800);
  let g = await evalJs(GEO);
  const basePad = g.pad;
  check('a fresh browser shows no ad at all', g.slotCount === 0 && !g.obs, `${g.slotCount} slots`);
  check('and reserves no space for one', !g.shellFlag && basePad > 0, `pad ${basePad}`);

  // ── 2. Bottom Left Tile ──────────────────────────────────────────────────
  await boot('/', 'bottom-left-tile', false);
  g = await evalJs(GEO);
  check('Bottom Left Tile renders one 300×250 unit', g.slot && g.slot.w === 300 && g.slot.h === 250 && g.slotCount === 1, JSON.stringify(g.slot));
  check('it is fixed to the viewport', g.hostPos === 'fixed', g.hostPos);
  check('12px from the left edge and 12px from the bottom', g.slot && g.slot.left === 12 && g.slot.bottom === 12, JSON.stringify(g.slot));
  check('its caption is the unit size', g.label === '300x250', g.label);
  check('the page does not reserve space for a corner tile', !g.shellFlag && g.pad === basePad, `pad ${g.pad} vs ${basePad}`);
  await boot('/play', 'bottom-left-tile', false);
  g = await evalJs(GEO);
  check('the tile follows to another page, same place', g.slot && g.slot.w === 300 && g.slot.left === 12 && g.slot.bottom === 12, JSON.stringify(g.slot));

  // ── 3. Bottom Banner ─────────────────────────────────────────────────────
  await boot('/', 'bottom-banner', false);
  g = await evalJs(GEO);
  check('Bottom Banner renders one 728×90 unit', g.slot && g.slot.w === 728 && g.slot.h === 90 && g.slotCount === 1, JSON.stringify(g.slot));
  check('flush with the bottom edge', g.slot && g.slot.bottom === 0, JSON.stringify(g.slot));
  check('centered', g.slot && Math.abs(g.slot.left - g.slot.right) <= 1, `${g.slot?.left} / ${g.slot?.right}`);
  check('the page reserves exactly the banner’s height under its content', g.shellFlag && Math.round(g.pad - basePad) === 90, `pad ${g.pad} vs base ${basePad}`);
  check('no Obscure strip unless asked for', !g.obs, JSON.stringify(g.obs));
  check('the banner sits below the modal layer (z < 50) so a dialog covers it', g.zHost !== null && g.zHost < 50 && g.zHost > 0, String(g.zHost));
  await boot('/personalize', 'bottom-banner', false);
  g = await evalJs(GEO);
  check('the banner follows to another page and still reserves its height', g.slot && g.slot.h === 90 && g.slot.bottom === 0 && g.shellFlag, JSON.stringify(g.slot));

  // ── 3b. Obscure background ───────────────────────────────────────────────
  await boot('/', 'bottom-banner', true);
  g = await evalJs(GEO);
  check('Obscure background: a strip the full viewport width', g.obs && g.obs.w === 1440 && g.obs.left === 0, JSON.stringify(g.obs));
  check('the banner’s height, flush with the bottom', g.obs && g.obs.h === 90 && g.obs.bottom === 0, JSON.stringify(g.obs));
  check('behind the ad and above the content', g.zObs !== null && g.zObs < g.zHost && g.zObs > 0, `obscure ${g.zObs} vs host ${g.zHost}`);
  check('it blurs what is behind it', await evalJs(`getComputedStyle(document.querySelector('.ad-obscure')).backdropFilter !== 'none'`));

  // ── 4. Banner Below Carousel ─────────────────────────────────────────────
  await boot('/', 'banner-below-carousel', false);
  g = await evalJs(GEO);
  check('Banner Below Carousel renders a 728×90 unit in flow', g.slot && g.slot.w === 728 && g.slot.h === 90 && g.inline && !g.host, JSON.stringify(g.slot));
  check('below the carousel', g.slot && g.carouselBottom !== null && g.slot.top > g.carouselBottom, `slot top ${g.slot?.top} vs carousel bottom ${g.carouselBottom}`);
  check('above the dashboard board', g.slot && g.boardTop !== null && (g.slot.top + g.slot.h) < g.boardTop, `slot bottom ${g.slot ? g.slot.top + g.slot.h : null} vs board top ${g.boardTop}`);
  check('centered', g.slot && Math.abs(g.slot.left - g.slot.right) <= 1, `${g.slot?.left} / ${g.slot?.right}`);
  check('the page reserves no space for an in-flow banner', !g.shellFlag && g.pad === basePad, `pad ${g.pad}`);
  await boot('/play', 'banner-below-carousel', false);
  g = await evalJs(GEO);
  check('it exists on Home only — absent on another page', g.slotCount === 0, `${g.slotCount} slots on /play`);

  // ── 5. Accessibility ─────────────────────────────────────────────────────
  await boot('/', 'bottom-left-tile', false);
  g = await evalJs(GEO);
  check('the slot is labelled as an advertisement', /advertisement/i.test(g.aria || ''), g.aria);

  // ── 6. The way in: the Admin row ─────────────────────────────────────────
  await boot('/?modal=admin', 'none', false);
  const row = await evalJs(`(() => {
    const trig = document.querySelector('[aria-label="Ad placement"]');
    if (!trig) return { found: false };
    const rowEl = trig.closest('.admin-tool');
    return { found: true, label: trig.textContent.trim(), toggle: !!rowEl?.querySelector('[role="switch"]'), name: rowEl?.querySelector('.admin-tool-name')?.textContent.trim() };
  })()`);
  check('the Admin row exists and reads No ads', row.found && row.name === 'Advertising' && /No ads/.test(row.label), JSON.stringify(row));
  check('no Obscure toggle when no banner is chosen', row.found && !row.toggle);

  // Open the dropdown and pick Bottom Banner through the real control.
  await evalJs(`document.querySelector('[aria-label="Ad placement"]').click(); 1`);
  await sleep(300);
  const options = await evalJs(`(() => {
    const els = [...document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], .ds-dropdown-option, .ds-dropdown-item, li')]
      .filter((e) => e.offsetParent !== null && e.textContent.trim());
    return els.map((e) => e.textContent.trim());
  })()`);
  const want = ['No ads', 'Bottom Left Tile', 'Bottom Banner', 'Banner Below Carousel'];
  check('the dropdown lists the four concepts in the named order', want.every((w, i) => options.indexOf(w) >= 0 && (i === 0 || options.indexOf(w) > options.indexOf(want[i - 1]))), options.join(' · '));
  const picked = await evalJs(`(() => {
    const el = [...document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], .ds-dropdown-option, .ds-dropdown-item, li')]
      .find((e) => e.offsetParent !== null && e.textContent.trim() === 'Bottom Banner');
    if (!el) return false; el.click(); return true;
  })()`);
  await sleep(500);
  const after = await evalJs(`(() => {
    const trig = document.querySelector('[aria-label="Ad placement"]');
    const rowEl = trig?.closest('.admin-tool');
    return { label: trig?.textContent.trim(), toggle: !!rowEl?.querySelector('[role="switch"]'), stored: localStorage.getItem('adPlacement'), live: !!document.querySelector('.ad-host--bottom-banner') };
  })()`);
  check('choosing Bottom Banner from the dropdown changes the placement', picked && after.stored === 'bottom-banner' && after.live, JSON.stringify(after));
  check('and the Obscure background toggle appears under it', after.toggle, JSON.stringify(after));

  // ── 7. The lock: the Advertising row is hidden until the Konami code is typed ──
  // Real key events through CDP (trusted, with default actions), not synthetic
  // KeyboardEvents — so the "final Enter must not press a focused button" check
  // exercises the actual browser behavior.
  const KEYS = {
    ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40],
    ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
    b: ['KeyB', 66, 'b'], a: ['KeyA', 65, 'a'], Enter: ['Enter', 13, '\r'],
  };
  // Only key / code / windowsVirtualKeyCode — the recipe every other suite here
  // uses. NEVER add nativeVirtualKeyCode: on macOS native code 38 is the J key,
  // so passing the Windows arrow code as a native code makes Chrome see a
  // contradictory key that never gets its keyUp and auto-repeats forever — a
  // trusted-keydown storm that pegs the renderer, hangs the suite, and resets
  // the Konami progress between every real key (found 2026-09-29).
  const press = async (k) => {
    const [code, vk, text] = KEYS[k];
    const base = { key: k, code, windowsVirtualKeyCode: vk };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(40);
  };
  const typeKeys = async (seq) => { for (const k of seq) await press(k); await sleep(250); };
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a', 'Enter'];
  const rowVisible = () => evalJs(`!!document.querySelector('[aria-label="Ad placement"]')`);

  await boot('/?modal=admin', 'none', false, /* unlocked */ false);
  check('the Advertising row is HIDDEN by default', !(await rowVisible()));
  await typeKeys(['ArrowUp', 'ArrowDown', 'b', 'a', 'Enter']);
  check('a wrong sequence does not unlock it', !(await rowVisible()));
  await typeKeys(['ArrowUp', 'ArrowUp', 'ArrowUp']); // one ↑ too many — must not poison the real attempt
  await typeKeys(KONAMI);
  check('↑↑↓↓←→←→ B A Enter reveals it', await rowVisible());

  // Persistence: the unlock survives a reload, per browser.
  await evalJs('location.reload(); 1').catch(() => {});
  await sleep(1800);
  check('the unlock persists across a reload', await rowVisible() && ['1', 'true'].includes(await evalJs(`localStorage.getItem('adUnlocked')`)));

  // The final Enter must not press whichever button has focus. Focus "Launch"
  // (first-boot onboarding) — if Enter reached it, the app would navigate to
  // /onboarding and the modal would be gone.
  await boot('/?modal=admin', 'none', false, false);
  await evalJs(`document.querySelector('.admin-tool-actions button').focus(); 1`);
  await typeKeys(KONAMI);
  const hashAfter = await evalJs('location.hash');
  check('the final Enter does not press the focused button', /modal=admin/.test(hashAfter) && await rowVisible(), hashAfter);

  // Locked + a placement left in storage = still no ad. Nothing may render with
  // no visible control over it.
  await boot('/', 'bottom-banner', true, false);
  let lg = await evalJs(GEO);
  check('a placement in storage renders nothing while locked', lg.slotCount === 0 && !lg.obs && !lg.shellFlag, `${lg.slotCount} slots`);

  // Typing the code again re-locks, and locking turns the ad off so nothing is
  // left showing with its control hidden.
  await boot('/?modal=admin', 'bottom-banner', true, true);
  check('(setup) unlocked with Bottom Banner showing', await rowVisible() && await evalJs(`!!document.querySelector('.ad-host--bottom-banner')`));
  await typeKeys(KONAMI);
  const relocked = await evalJs(`({ row: !!document.querySelector('[aria-label="Ad placement"]'), ad: !!document.querySelector('.ad-host'), p: localStorage.getItem('adPlacement'), o: localStorage.getItem('adObscure'), u: localStorage.getItem('adUnlocked') })`);
  check('the code again re-locks the row', !relocked.row, JSON.stringify(relocked));
  check('and locking turns the ad off and clears the choice', !relocked.ad && (relocked.p === 'none' || relocked.p === null) && ['0', 'false', null].includes(relocked.o), JSON.stringify(relocked));

  check('no page exceptions throughout', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  // Put the browser back the way it was found.
  await evalJs(`(() => {
    ${saved?.p ? `localStorage.setItem('adPlacement', ${JSON.stringify(saved.p)});` : `localStorage.removeItem('adPlacement');`}
    ${saved?.o ? `localStorage.setItem('adObscure', ${JSON.stringify(saved.o)});` : `localStorage.removeItem('adObscure');`}
    ${saved?.u ? `localStorage.setItem('adUnlocked', ${JSON.stringify(saved.u)});` : `localStorage.removeItem('adUnlocked');`}
    return 1; })()`).catch(() => {});
  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#/` }).catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

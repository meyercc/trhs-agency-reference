// Light-theme contrast audit. Walks a set of routes/modals with html.light on,
// measures every visible text node against its effective (composited) background,
// and reports WCAG failures. Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222). Run from web/.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

const OUT = process.argv[2] || '/tmp';
const THEME = process.argv[3] || 'light';
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
async function evalJs(send, expr) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
}

// The measuring probe, run in the page.
const PROBE = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

  // Composite the backgrounds behind an element, walking up to the root.
  const bgAt = (el) => {
    let stack = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') stack.push({ img: true, n });
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
    }
    stack.push({ r: 255, g: 255, b: 255, a: 1 });
    let hasImg = false;
    let acc = null;
    for (let i = stack.length - 1; i >= 0; i--) {
      const s = stack[i];
      if (s.img) { hasImg = true; continue; }
      acc = acc ? over(s, acc) : s;
    }
    return { bg: acc, hasImg };
  };

  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
    return s;
  };

  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue.trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // skip elements inside a fully-transparent ancestor
    let faded = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (o === 0) { faded = true; break; }
    }
    if (faded) continue;
    const fgRaw = parse(cs.color);
    if (!fgRaw) continue;
    const { bg, hasImg } = bgAt(el);
    if (!bg) continue;
    const fg = over(fgRaw, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < need) {
      out.push({
        sel: sel(el), text: text.slice(0, 44), ratio: +cr.toFixed(2), need,
        color: cs.color, bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
        size, weight, hasImg,
      });
    }
  }
  return out;
})()`;

const ROUTES = [
  ['home', '#/'],
  ['performance', '#/perform'],
  ['personalize', '#/personalize'],
  ['play', '#/play'],
  ['shop', '#/shop'],
  ['registry', '#/registry'],
  ['configurator', '#/configurator'],
  ['metro', '#/metro'],
  ['map', '#/map'],
  ['onboarding', '#/onboarding'],
  ['modal:settings', '#/?modal=settings'],
  ['modal:profiles', '#/?modal=profiles'],
  ['modal:modules', '#/?modal=modules'],
  // Device canvases are `?sku=` deep links (`?device=` is only a legacy alias
  // for a few ids), and each tab is its own surface, so tabs are covered too.
  ['dev:mouse/buttons', '#/?sku=haste-3&tab=buttons'],
  ['dev:mouse/sensor', '#/?sku=haste-3&tab=sensor'],
  ['dev:mouse/settings', '#/?sku=haste-3&tab=settings'],
  ['dev:kbd/lighting', '#/?sku=origins-65&tab=lighting'],
  ['dev:kbd/keys', '#/?sku=origins-65&tab=keys'],
  ['dev:kbd/settings', '#/?sku=origins-65&tab=settings'],
  ['dev:headset/audio', '#/?sku=cloud-iii-s&tab=audio'],
  ['dev:headset/spatial', '#/?sku=cloud-iii-s&tab=spatial'],
  ['dev:headset/settings', '#/?sku=cloud-iii-s&tab=settings'],
  ['dev:monitor/display', '#/?sku=pulse-27&tab=display'],
  ['dev:monitor/connect', '#/?sku=pulse-27&tab=connectivity'],
  ['dev:monitor/utils', '#/?sku=pulse-27&tab=utilities'],
  // `pulse-27` is the monitor with the FEWEST surfaces — no lamp, no speakers,
  // and the plain KVM tab. Every screen the display work actually built lives on
  // `treehouse-32`: the Lights and Audio tabs the feature gates open, the hero
  // desk picture, the X-ray plate and the rear-port photograph, Gear Switch.
  // None of it was in this audit, so "the monitor passes in light" meant the one
  // monitor we did not design (added 2026-09-08, on the v0.2.19 merge).
  ['dev:th32/display', '#/?sku=treehouse-32&tab=display'],
  ['dev:th32/connect', '#/?sku=treehouse-32&tab=connectivity'],
  ['dev:th32/lights', '#/?sku=treehouse-32&tab=lighting'],
  ['dev:th32/audio', '#/?sku=treehouse-32&tab=audio'],
  ['dev:th32/utils', '#/?sku=treehouse-32&tab=utilities'],
  ['dev:mic/audio', '#/?sku=quadcast-2-s&tab=audio'],
  ['dev:mic/effects', '#/?sku=quadcast-2-s&tab=effects'],
  ['dev:mic/lighting', '#/?sku=quadcast-2-s&tab=lighting'],
  ['dev:headset/audio+onboard', '#/?sku=cloud-iii-s&tab=audio'],
  ['dev:mouse/buttons+onboard', '#/?sku=haste-3&tab=buttons'],
  ['dev:kbd/lighting+onboard', '#/?sku=origins-65&tab=lighting'],
  ['dev:spec/desktop', '#/?sku=forge-45l'],
  ['dev:spec/notebook', '#/?sku=omen-max-16'],
];

(async () => {
  const targets = await httpJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on('open', r));
  const send = makeSend(ws);
  await send('Runtime.enable');
  await send('Page.enable');

  const report = {};
  for (const [name, hash] of ROUTES) {
    await send('Page.navigate', { url: `http://localhost:${APP_PORT}/` + hash });
    await sleep(300);
    // force light theme + a known accent, then re-navigate so the app boots into it
    await evalJs(send, `localStorage.setItem('theme','${THEME}'); localStorage.setItem('accent','cyan'); 1`);
    // Page.navigate to an identical URL is a no-op under HashRouter, so the app
    // would never re-boot with the new theme. Reload for real.
    await send('Page.reload', { ignoreCache: true });
    await sleep(2600);
    // Some surfaces only exist in a state no URL reaches -- the software-only
    // lock and its .ds-status-overlay appear only while an ONBOARD profile is
    // selected. Routes suffixed `+onboard` switch to it before measuring.
    if (name.endsWith('+onboard')) {
      await evalJs(send, `(() => { const b = [...document.querySelectorAll('button,[role=option]')]
        .find((e) => /on the (headset|mouse|keyboard|device)/i.test(e.textContent || ''));
        if (b) b.click(); return !!b; })()`);
      await sleep(1400);
    }
    const isLight = await evalJs(send, `document.documentElement.classList.contains('light')`);
    if (THEME === 'light' && !isLight) throw new Error('light theme did not apply on ' + name);
    let fails = [];
    try { fails = await evalJs(send, PROBE); } catch (e) { fails = [{ sel: 'PROBE ERROR', text: e.message }]; }
    report[name] = { hash, isLight, count: fails.length, fails };
    const worst = fails.filter((f) => f.ratio < 2).length;
    console.log(`${name.padEnd(20)} light=${isLight ? 'y' : 'N'}  fails=${String(fails.length).padStart(3)}  severe(<2:1)=${worst}`);
  }
  writeFileSync(OUT + `/audit-${THEME}.json`, JSON.stringify(report, null, 2));
  console.log('\nwrote ' + OUT + `/audit-${THEME}.json`);
  ws.close();
})();

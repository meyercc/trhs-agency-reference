// CDP walkthrough for the dashboard concept (#/home-v2) — the four-card reading
// of Home we put beside our partners' visual concepts.
//
// What is protected here, in order of how expensive it would be to lose:
//  1. The WAY IN. The page is not in the nav: it is reached from the account
//     avatar → Admin Panel → Dashboard Concept, next to Metro. A concept nobody
//     can open during a review is the same as no concept, so the suite walks the
//     real menu rather than typing the URL.
//  2. The COMPOSITION, which is the whole argument: exactly four cards — headset,
//     monitor, system vitals, last played — every one of them two rows tall, at
//     two thirds and one third of a six-column grid, mirrored on the second row.
//     And NO carousel; the devices are meant to be the first thing on the page.
//  3. That each card is the SAME widget the real board renders, so the
//     comparison is about composition and not about a mock.
//  4. That no text is cut off. The cards run at widths the board rarely uses,
//     and a widget hides its overflow — System Vitals ships four columns wide
//     and lost its RAM and Network cells at one third until vitals.css learned
//     a narrow 2 × 2 layout. That loss was silent, which is why it is a check.
//
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222),
// run from web/. Read-only: it navigates and opens a menu, writes no storage,
// and returns to the dashboard at the end.
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
const go = async (hash) => {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/#${hash}` });
  await sleep(1400);
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

try {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await go('/');
  await sleep(1200);

  // ── 1. The way in ───────────────────────────────────────────────────────
  const opened = await evalJs(`(() => {
    const av = document.querySelector('.account-menu-btn');
    if (!av) return 'no account avatar';
    av.click();
    return 'ok';
  })()`);
  check('the account menu opens from the avatar', opened === 'ok', opened);
  await sleep(300);

  const adminOpened = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ds-list-item, [role="menuitem"], li, button')]
      .find((n) => n.textContent.trim() === 'Admin Panel');
    if (!el) return 'no Admin Panel row';
    el.click();
    return 'ok';
  })()`);
  check('Admin Panel opens its submenu', adminOpened === 'ok', adminOpened);
  await sleep(300);

  const rows = await evalJs(`(() => {
    const menu = document.querySelector('.am-submenu');
    if (!menu) return [];
    return [...menu.querySelectorAll('*')]
      .filter((n) => !n.children.length && n.textContent.trim())
      .map((n) => n.textContent.trim());
  })()`);
  check('the Admin submenu offers "Dashboard Concept"', rows.includes('Dashboard Concept'), rows.join(' · '));
  check('it sits with the other alternate views, right after Metro',
    rows.indexOf('Dashboard Concept') === rows.indexOf('Metro') + 1, rows.join(' · '));

  const clicked = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.am-submenu *')]
      .find((n) => n.textContent.trim() === 'Dashboard Concept' && !n.children.length);
    if (!el) return 'row vanished';
    (el.closest('[role="menuitem"]') || el.closest('li') || el).click();
    return 'ok';
  })()`);
  check('choosing it navigates', clicked === 'ok', clicked);
  await sleep(1200);
  check('it lands on the concept page', (await evalJs('location.hash')) === '#/home-v2');
  check('the menu closes behind it', !(await evalJs('!!document.querySelector(".am-submenu")')));

  // ── 2 & 3. The composition ──────────────────────────────────────────────
  const grid = await evalJs(`(() => {
    const g = document.querySelector('.hv2-grid');
    if (!g) return null;
    return {
      cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
      cards: [...g.children].map((c) => ({
        card: c.dataset.card,
        col: getComputedStyle(c).gridColumnStart,
        row: getComputedStyle(c).gridRowStart,
        top: Math.round(c.getBoundingClientRect().top),
        widget: !!c.querySelector('.ds-widget, .w'),
      })),
    };
  })()`);
  check('the grid is the board’s six columns', grid?.cols === 6, String(grid?.cols));
  check('exactly four cards', grid?.cards.length === 4, String(grid?.cards.length));

  // The decided shape: headset 2/3 + monitor 1/3, then vitals 1/3 + last played 2/3.
  const WANT = [
    ['headset', 4], ['monitor', 2], ['vitals', 2], ['lastplayed', 4],
  ];
  for (const [card, span] of WANT) {
    const c = grid?.cards.find((x) => x.card === card);
    check(`${card} takes ${span === 4 ? 'two thirds' : 'one third'} of the row`,
      c?.col === `span ${span}`, c?.col);
    check(`${card} is two rows tall`, c?.row === 'span 2', c?.row);
    check(`${card} renders a real board widget`, !!c?.widget);
  }
  const tops = grid?.cards.map((c) => c.top) ?? [];
  check('the four cards sit on two bands', new Set(tops).size === 2, tops.join(' · '));
  check('no carousel on this page', !(await evalJs('!!document.querySelector(".home-carousel")')));

  // ── 4. Nothing cut off, at every width the page claims to support ───────
  // Decorative art is allowed to bleed (the Last Played backdrop is meant to),
  // so only elements holding their own text are measured.
  const OVERFLOW = `(() => {
    const bad = [];
    document.querySelectorAll('.hv2-cell .ds-widget, .hv2-cell .w').forEach((card) => {
      const c = card.getBoundingClientRect();
      card.querySelectorAll('*').forEach((el) => {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        if (r.right > c.right + 1 || r.bottom > c.bottom + 1 || r.left < c.left - 1 || r.top < c.top - 1) {
          bad.push(el.className + ' "' + el.textContent.trim().slice(0, 18) + '"');
        }
      });
    });
    return [...new Set(bad)];
  })()`;
  for (const [w, h, label] of [[1440, 900, 'desktop'], [900, 1150, 'tablet'], [600, 1400, 'mobile']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const bad = await evalJs(OVERFLOW);
    check(`no text is cut off at ${label} (${w}px)`, bad.length === 0, bad.slice(0, 3).join(' | '));
  }
  // The System Vitals reflow this page needed: all four cells present at 1/3.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  const vitalCells = await evalJs(`(() => {
    const w = document.querySelector('.hv2-cell[data-card="vitals"] .wv-widget');
    if (!w) return null;
    const c = w.getBoundingClientRect();
    return [...w.querySelectorAll('.wv-cell')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1;
    }).length;
  })()`);
  check('System Vitals shows all four cells at one third width', vitalCells === 4, String(vitalCells));

  check('no page exceptions throughout', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
  await go('/').catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');
process.exit(0);

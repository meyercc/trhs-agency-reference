// CDP walkthrough for the OMEN power supply inside System Vitals (JY, 2026-10-22):
// the Performance page's System Vitals window gets a Power supply tab on a
// desktop that has an OMEN supply, and only there (OpenGSW system-vitals.2,
// perform.11) — not on a notebook, not under June 2027, and not when the supply
// has no link to read. Four live trends in order (Total power, Temperature,
// Fan speed, Efficiency) from the stores the supply's own window reads; the
// rails stay in that window. The temperature draws the player's own warning
// level as its line, read-only. Two doors leave the window for the PC's page at
// tab=psu: "Power supply settings" (Status view) and "Fan" (psu=fan, Fan view);
// the window closes, and psu= is dropped with the rest on close (lcd-diy.25).
// The same desktop gets a Power supply CARD on the Performance page (designer,
// 2026-10-22: the supply has a fan control, which System Vitals does not): in
// the Performance section, with the status word, Total power and Fan mode +
// RPM, read-only — Settings and the Fan row are doors to the supply's window,
// which is where the fan is edited (lcd-diy.25). Absent where the supply is.
// Dev server $APP_PORT (default 5175), headless Chrome $CDP_PORT (default 9222), run from web/.
import WebSocket from 'ws';

const CDP_PORT = process.env.CDP_PORT || 9222;
const APP_PORT = process.env.APP_PORT || 5175;

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

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

async function waitFor(send, expr, timeoutMs = 6000) {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    if (await evalJs(send, `!!(${expr})`)) return true;
    await sleep(100);
  }
  return false;
}

const APP_READY = `document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild`;
// The keys this suite writes, cleared so a run starts from defaults.
const OWN_KEYS = ['thisPc', 'mvpScope', 'psuSettings', 'omenAi', 'gameSession', 'nonHpPc'];
let loadN = 0;
async function load(send, hash = '#/perform') {
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/?r=${++loadN}${hash}` });
  await waitFor(send, APP_READY);
}

/** Open the System Vitals window from the page's card, and wait for it. */
async function openVitals(send) {
  await waitFor(send, `document.querySelector('[data-feature="system-vitals"] .pv5-card-door')`, 8000);
  await evalJs(send, `document.querySelector('[data-feature="system-vitals"] .pv5-card-door')?.click()`);
  return waitFor(send, `document.querySelector('.pv5-svm .pv7-svm-metrics')`, 5000);
}
const TABS = `[...document.querySelectorAll('.pv5-svm-left button')].map(b => b.textContent.trim())`;
const clickVitalsTab = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.pv5-svm-left button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`);
const clickMetric = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.pv7-svm-metric')].find(b => b.querySelector('.pv7-svm-metric-l')?.textContent.trim() === ${JSON.stringify(label)})?.click()`);
/** The metric row as a person reads it: label, value text. */
const METRICS = `[...document.querySelectorAll('.pv7-svm-metric')].map(b => [b.querySelector('.pv7-svm-metric-l')?.textContent.trim(), b.querySelector('.pv7-svm-metric-v')?.textContent.trim()])`;
const num = (t) => parseFloat(String(t).replace(/,/g, ''));
const hasPsuTab = async (send) => (await evalJs(send, TABS)).includes('Power supply');
const clickDoor = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.pv5-svm .pv7-svm-door button')].find(b => b.textContent.replace('→', '').trim() === ${JSON.stringify(label)})?.click()`);
/** The warning rule's height as a value on the trend's 0–100 scale (top = 100). */
const WARN_LEVEL = `(() => { const l = document.querySelector('.pv7-trend-rule-warn'); return l ? Math.round((100 - parseFloat(l.getAttribute('y1'))) * 100) / 100 : null; })()`;
const pcPage = (send, title) =>
  waitFor(send, `document.querySelector('.dc-canvas.pc-canvas') && document.querySelector('.dc-canvas .ds-ng3-title')?.textContent.trim() === ${JSON.stringify(title)}`, 6000);
const STATUS_VIEW = `!!document.querySelector('.dc-canvas .pcp-status-tab')`;
const FAN_VIEW = `!document.querySelector('.dc-canvas .pcp-status-tab') && [...document.querySelectorAll('.dc-canvas button')].some(b => b.textContent.trim() === 'Start fan clean')`;

// ── The Power supply card ─────────────────────────────────────────────────
const CARD = `document.querySelector('[data-feature="power-supply"]')`;
const CARD_DOOR = `${CARD}?.querySelector('.pv5-card-door')`;
const CARD_FAN = `${CARD}?.querySelector('.pv5-fact--door')`;
/** The card as a person reads it. */
const CARD_FACE = `(() => { const c = ${CARD}; if (!c) return null; const f = c.querySelector('.ds-feature-card');
  return { title: f.querySelector('.ds-feature-card-title')?.textContent.trim(), door: f.querySelector('.pv5-card-door')?.textContent.replace('→', '').trim(),
    word: f.querySelector('.pv5-feat-status')?.textContent.trim(),
    rows: [...f.querySelectorAll('.pv5-fact')].map(r => [r.querySelector('.pv5-fact-l')?.textContent.trim(), r.querySelector('.pv5-fact-v')?.textContent.replace('→', '').trim()]) }; })()`;
const closePcPage = async (send) => {
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await waitFor(send, `!document.querySelector('.dc-canvas')`);
};

async function main() {
  const targets = await httpJson('/json');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = makeSend(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await load(send);
  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k)); localStorage.setItem('onboarded', 'true')`);

  // ── The desktop, full scope ───────────────────────────────────────────────
  await load(send);
  check('desktop: the System Vitals window opens from the card', await openVitals(send));
  let tabs = await evalJs(send, TABS);
  check('desktop: the Power supply tab sits after RAM, before Network and Storage',
    JSON.stringify(tabs) === JSON.stringify(['CPU', 'GPU', 'RAM', 'Power supply', 'Network', 'Storage']), tabs.join(' · '));
  // System Vitals' card's face is the glance — CPU / GPU / RAM — and has no fan reading; the supply's fan is on the Power supply card (designer, 2026-10-22).
  const face = await evalJs(send, `(() => { const c = document.querySelector('[data-feature="system-vitals"]'); return { text: c?.textContent ?? '', features: [...document.querySelectorAll('[data-feature]')].map(e => e.dataset.feature) }; })()`);
  check('desktop: the System Vitals card still reads CPU / GPU / RAM, and the page has no fan card besides the Power supply and Fan Cleaner cards',
    ['CPU', 'GPU', 'RAM'].every((w) => face.text.includes(w)) && !/Power supply|Fan speed/.test(face.text)
      && !face.features.some((f) => /fan/.test(f) && f !== 'fan-cleaner'), JSON.stringify(face.features));
  await clickVitalsTab(send, 'Power supply');
  await sleep(300);
  let m = await evalJs(send, METRICS);
  check('psu tab: four readings in order — Total power, Temperature, Fan speed, Efficiency',
    JSON.stringify(m.map((x) => x[0])) === JSON.stringify(['Total power', 'Temperature', 'Fan speed', 'Efficiency']), JSON.stringify(m));
  check('psu tab: no rail reading (12V, 5V, 3.3V, 5V Standby stay in the supply\'s window)',
    !(await evalJs(send, `/\\b(12V|5V|3\\.3V|Standby|amps?|volts?)\\b/i.test(document.querySelector('.pv5-svm').textContent)`)));
  const watts = num(m[0][1]);
  const temp = num(m[1][1]);
  const rpm = num(m[2][1]);
  const eff = num(m[3][1]);
  check('psu tab: the units are W, °C, RPM and %, and the numbers are the supply\'s (a simulated 180–540 W, 36–48 °C, ~88–92 %)',
    /^\d+W$/.test(m[0][1]) && /^\d+°C$/.test(m[1][1]) && /^[\d,]+ RPM$/.test(m[2][1]) && /^\d+%$/.test(m[3][1])
      && watts >= 180 && watts <= 540 && temp >= 36 && temp <= 48 && eff >= 86 && eff <= 92,
    JSON.stringify(m));
  // The fan reads what the supply's window reads: Auto with 0 RPM allowed idles
  // under 30 % of its 1200 W, otherwise 600 + load × 1600 (fanRpm).
  const want = watts / 1200 < 0.3 ? 0 : Math.round(600 + (watts / 1200) * 1600);
  check('psu tab: the fan speed follows the supply\'s own setting and its load (Auto, 0 RPM allowed)', rpm === want, `${watts} W → ${rpm} RPM, want ${want}`);
  check('psu tab: the trend is drawn for the selected reading, with its scale in W up to the supply\'s rating',
    (await evalJs(send, `document.querySelector('.pv7-trend-scale')?.textContent.trim()`)) === '0–1200W');
  check('psu tab: it is read-only — no field or slider anywhere in the window',
    await evalJs(send, `document.querySelectorAll('.pv5-svm input, .pv5-svm [role="slider"], .pv5-svm select').length === 0`));

  // ── The temperature's warning line is the player's own level ───────────────
  await clickMetric(send, 'Temperature');
  await sleep(200);
  check('temperature: the warning line is at the supply\'s default level, 55 °C', (await evalJs(send, WARN_LEVEL)) === 55, String(await evalJs(send, WARN_LEVEL)));
  check('temperature: only a warning line, no danger line (the player sets one level)',
    await evalJs(send, `document.querySelectorAll('.pv7-trend-rule-danger').length === 0`));
  // The level moves with the store: set it in the supply's own window, come back.
  await evalJs(send, `location.hash = '#/perform?sku=forge-45l&tab=psu'`);
  await waitFor(send, `document.querySelector('.dc-canvas .pcp-reading')`, 6000);
  await evalJs(send, `document.querySelector('.dc-canvas [aria-label="Temperature options"]')?.click()`);
  await waitFor(send, `document.querySelector('.pcp-menu-pop input')`, 3000);
  await evalJs(send, `(() => {
    const input = document.querySelector('.pcp-menu-pop input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus(); set.call(input, '62');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.blur();
  })()`);
  await evalJs(send, `[...document.querySelectorAll('.pcp-menu-pop button')].find(b => b.textContent.trim() === 'Apply')?.click()`);
  await sleep(200);
  check('temperature: the level set in the supply\'s window is saved (62 °C)', await evalJs(send, `JSON.parse(localStorage.getItem('psuSettings')).warn.temp === 62`));
  await evalJs(send, `location.hash = '#/perform'`);
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await clickMetric(send, 'Temperature');
  await sleep(200);
  check('temperature: back in System Vitals, with no reload, the line has moved to 62 °C', (await evalJs(send, WARN_LEVEL)) === 62, String(await evalJs(send, WARN_LEVEL)));
  await load(send);
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await clickMetric(send, 'Temperature');
  await sleep(200);
  check('temperature: after a reload the line is still at 62 °C', (await evalJs(send, WARN_LEVEL)) === 62, String(await evalJs(send, WARN_LEVEL)));
  await evalJs(send, `localStorage.setItem('psuSettings', JSON.stringify({ ...JSON.parse(localStorage.getItem('psuSettings')), warn: { ...JSON.parse(localStorage.getItem('psuSettings')).warn, temp: 55 } })); true`);

  // ── The fan reading follows the fan's setting, as the supply's window shows it ──
  await evalJs(send, `localStorage.setItem('psuSettings', JSON.stringify({ fanMode: 'max' }))`);
  await load(send);
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await sleep(200);
  m = await evalJs(send, METRICS);
  check('fan: on Max the reading is 2,400 RPM', m[2]?.[1] === '2400 RPM' || num(m[2]?.[1]) === 2400, JSON.stringify(m[2]));
  await evalJs(send, `localStorage.setItem('psuSettings', JSON.stringify({ fanMode: 'manual', manualPct: 50, dynamicCurve: false }))`);
  await load(send);
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await sleep(200);
  m = await evalJs(send, METRICS);
  check('fan: on Manual at 50 % the reading is 1,200 RPM', num(m[2]?.[1]) === 1200, JSON.stringify(m[2]));
  await evalJs(send, `localStorage.removeItem('psuSettings')`);

  // ── The two doors ─────────────────────────────────────────────────────────
  await load(send);
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await sleep(200);
  const doors = await evalJs(send, `[...document.querySelectorAll('.pv5-svm .pv7-svm-door button')].map(b => b.textContent.replace('→', '').trim())`);
  check('doors: Power supply settings and Fan, and nothing else', JSON.stringify(doors) === JSON.stringify(['Power supply settings', 'Fan']), JSON.stringify(doors));
  await clickDoor(send, 'Fan');
  check('fan door: the PC page opens on Power supply, on its Fan view (psu=fan in the address)',
    (await pcPage(send, 'Power supply')) && (await waitFor(send, FAN_VIEW, 3000))
      && (await evalJs(send, `location.hash.includes('sku=forge-45l') && location.hash.includes('tab=psu') && location.hash.includes('psu=fan')`)),
    await evalJs(send, `location.hash`));
  check('fan door: the System Vitals window is closed, and the PC page keeps all its tabs',
    await evalJs(send, `!document.querySelector('.pv5-svm') && document.querySelectorAll('.dc-canvas .ds-ng3-tool').length === 4`));
  await evalJs(send, `document.querySelector('.dc-close')?.click()`);
  await waitFor(send, `!document.querySelector('.dc-canvas')`);
  check('fan door: closing the page drops sku, tab and psu from the address',
    await evalJs(send, `!/sku=|tab=|psu=/.test(location.hash)`), await evalJs(send, `location.hash`));
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await clickDoor(send, 'Power supply settings');
  check('settings door: the PC page opens on Power supply, on its Status view, no psu= left over from the Fan door',
    (await pcPage(send, 'Power supply')) && (await waitFor(send, STATUS_VIEW, 3000))
      && (await evalJs(send, `location.hash.includes('sku=forge-45l') && location.hash.includes('tab=psu') && !location.hash.includes('psu=')`)),
    await evalJs(send, `location.hash`));
  check('settings door: the System Vitals window is closed', await evalJs(send, `!document.querySelector('.pv5-svm')`));
  // psu=fan reaches only the Power supply tab: by address, on another tab it changes nothing.
  await load(send, '#/perform?sku=forge-45l&tab=lighting&psu=fan');
  await pcPage(send, 'Chassis lighting');
  await clickTabIn(send, 'Power supply');
  check('psu=fan is read for tab=psu only: on another tab\'s address, the Power supply tab still opens on Status',
    await waitFor(send, STATUS_VIEW, 3000));

  // ── The Power supply card on the Performance page ─────────────────────────
  await load(send);
  await waitFor(send, CARD, 8000);
  let card = await evalJs(send, CARD_FACE);
  check('card: the desktop with an OMEN supply has a Power supply card, titled Power supply, with a Settings door', card?.title === 'Power supply' && card.door === 'Settings', JSON.stringify(card));
  check('card: it is in the Performance section, after the Power Mode and OMEN AI cards, and nowhere else',
    await evalJs(send, `(() => { const c = ${CARD}; const sec = c?.closest('section'); if (!sec) return false;
      const order = [...sec.querySelectorAll('[data-feature]')].map(e => e.dataset.feature);
      return sec.dataset.section === 'performance' && order.indexOf('power-mode') < order.indexOf('power-supply') && order.indexOf('omen-ai') < order.indexOf('power-supply')
        && document.querySelectorAll('[data-feature="power-supply"]').length === 1; })()`));
  check('card: it has the status word, then two rows — Total power and Fan', card?.word === 'Good' && JSON.stringify(card.rows.map((r) => r[0])) === JSON.stringify(['Total power', 'Fan']), JSON.stringify(card));
  const cardW = num(card?.rows[0]?.[1]);
  check('card: Total power reads like the supply (a simulated 180–540 W)', /^\d+ W$/.test(card?.rows[0]?.[1]) && cardW >= 180 && cardW <= 540, card?.rows[0]?.[1]);
  check('card: Fan reads the mode and the speed — Auto · 0 RPM on a light load', /^Auto · [\d,]+ RPM$/.test(card?.rows[1]?.[1]) && card.rows[1][1] === (cardW / 1200 < 0.3 ? 'Auto · 0 RPM' : `Auto · ${Math.round(600 + (cardW / 1200) * 1600).toLocaleString()} RPM`), card?.rows[1]?.[1]);
  check('card: it is read-only — no input, switch, slider or select, and its only buttons are the two doors',
    await evalJs(send, `(() => { const c = ${CARD}; return c.querySelectorAll('input, select, textarea, [role="slider"], [role="switch"], [role="radio"], [role="checkbox"]').length === 0 && c.querySelectorAll('button').length === 2; })()`));
  // The card and the supply's window read the same numbers: the window opens over the page, the card stays under it, and
  // both are read in one go so a 2 s tick cannot fall between them.
  await evalJs(send, `${CARD_DOOR}?.click()`);
  check('settings door: opens the PC page on Power supply, on its Status view (tab=psu, no psu=)',
    (await pcPage(send, 'Power supply')) && (await waitFor(send, STATUS_VIEW, 3000))
      && (await evalJs(send, `location.hash.includes('sku=forge-45l') && location.hash.includes('tab=psu') && !location.hash.includes('psu=')`)), await evalJs(send, `location.hash`));
  await waitFor(send, `document.querySelector('.dc-canvas .pcp-reading')`, 4000);
  const same = await evalJs(send, `(() => {
    const read = (l) => [...document.querySelectorAll('.dc-canvas .pcp-reading')].find(r => r.textContent.toUpperCase().includes(l))?.innerText.split('\\n').pop().trim();
    const rows = Object.fromEntries([...${CARD}.querySelectorAll('.pv5-fact')].map(r => [r.querySelector('.pv5-fact-l').textContent.trim(), r.querySelector('.pv5-fact-v').textContent.replace('→', '').trim()]));
    return { cardW: rows['Total power'], winW: read('TOTAL POWER'), cardFan: rows['Fan'], winFan: read('FAN SPEED'), word: ${CARD}.querySelector('.pv5-feat-status').textContent.trim(), winWord: document.querySelector('.dc-canvas .pcp-summary')?.textContent ?? '' };
  })()`);
  check('window: the card\'s Total power is the window\'s', same.cardW === same.winW, JSON.stringify(same));
  check('window: the card\'s fan speed is the window\'s Fan speed', same.cardFan.endsWith(` · ${same.winFan}`), JSON.stringify(same));
  check('window: the card\'s status word is the window\'s', same.winWord.includes(same.word), JSON.stringify(same));
  await closePcPage(send);
  check('window: closing it leaves the Performance page with the card', await evalJs(send, `!!${CARD} && !/sku=|tab=|psu=/.test(location.hash)`), await evalJs(send, `location.hash`));
  // The same numbers as System Vitals' Power supply tab, again in one go.
  await openVitals(send);
  await clickVitalsTab(send, 'Power supply');
  await sleep(300);
  const vit = await evalJs(send, `(() => ({ card: ${CARD}.querySelector('.pv5-fact-v').textContent.trim(), tab: ${METRICS}[0][1] }))()`);
  check('System Vitals: the card\'s Total power is the Power supply tab\'s Total power', vit.card.replace(' ', '') === vit.tab, JSON.stringify(vit));
  await evalJs(send, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await waitFor(send, `!document.querySelector('.pv5-svm')`);
  // The Fan row is itself a door, to the fan.
  await evalJs(send, `${CARD_FAN}?.click()`);
  check('fan row: opens the PC page on Power supply, on its Fan view (psu=fan in the address)',
    (await pcPage(send, 'Power supply')) && (await waitFor(send, FAN_VIEW, 3000))
      && (await evalJs(send, `location.hash.includes('sku=forge-45l') && location.hash.includes('tab=psu') && location.hash.includes('psu=fan')`)), await evalJs(send, `location.hash`));
  // The fan is edited here, in the window — and the card follows.
  await evalJs(send, `[...document.querySelectorAll('.dc-canvas [aria-label="Power supply fan"] button')].find(b => b.textContent.trim() === 'Max')?.click()`);
  await sleep(300);
  check('window: Max in the supply\'s window is saved', await evalJs(send, `JSON.parse(localStorage.getItem('psuSettings')).fanMode === 'max'`));
  check('window: the card under it already says Max · 2,400 RPM', (await evalJs(send, CARD_FACE))?.rows[1][1] === 'Max · 2,400 RPM', JSON.stringify((await evalJs(send, CARD_FACE))?.rows));
  await closePcPage(send);
  check('fan mode: back on the page, the card\'s Fan row reads Max · 2,400 RPM', (await evalJs(send, CARD_FACE))?.rows[1][1] === 'Max · 2,400 RPM', JSON.stringify((await evalJs(send, CARD_FACE))?.rows));
  await evalJs(send, `localStorage.setItem('psuSettings', JSON.stringify({ fanMode: 'manual', manualPct: 50, dynamicCurve: false }))`);
  await load(send);
  await waitFor(send, CARD, 8000);
  check('fan mode: Manual at 50 % reads Manual · 1,200 RPM', (await evalJs(send, CARD_FACE))?.rows[1][1] === 'Manual · 1,200 RPM', JSON.stringify((await evalJs(send, CARD_FACE))?.rows));
  await evalJs(send, `localStorage.removeItem('psuSettings')`);
  // ?spot=power-supply lights the card, then lets go, and is dropped from the address.
  await load(send, '#/perform?spot=power-supply');
  check('spot: ?spot=power-supply lights the card and is dropped from the address',
    (await waitFor(send, `${CARD}?.classList.contains('pv5-spotlight')`, 3000)) && (await evalJs(send, `!location.hash.includes('spot=')`)));
  await load(send);
  await waitFor(send, CARD, 8000);
  check('card: with no PSU settings kept, the Fan row is back to Auto', (await evalJs(send, CARD_FACE))?.rows[1][1].startsWith('Auto · '));

  // ── June 2027 ─────────────────────────────────────────────────────────────
  await evalJs(send, `localStorage.setItem('mvpScope', 'june27')`);
  await load(send);
  check('june: the System Vitals window opens', await openVitals(send));
  tabs = await evalJs(send, TABS);
  check('june: no Power supply tab (OMEN hardware control is out of the scope)',
    JSON.stringify(tabs) === JSON.stringify(['CPU', 'GPU', 'RAM', 'Network', 'Storage']), tabs.join(' · '));
  check('june: no Power supply card either (the Performance section is the Booster family, without Power Mode)', await evalJs(send, `!${CARD}`));
  await evalJs(send, `localStorage.removeItem('mvpScope')`);

  // ── The notebook ──────────────────────────────────────────────────────────
  await evalJs(send, `localStorage.setItem('thisPc', 'hx-omen-16-valorant')`);
  await load(send);
  await openVitals(send);
  tabs = await evalJs(send, TABS);
  check('notebook: no Power supply tab',
    JSON.stringify(tabs) === JSON.stringify(['CPU', 'GPU', 'RAM', 'Network', 'Storage']), tabs.join(' · '));
  check('notebook: no Power supply card, and the Performance section still has its other cards',
    await evalJs(send, `!${CARD} && !!document.querySelector('[data-feature="power-mode"]') && !!document.querySelector('[data-feature="omen-ai"]')`));
  await evalJs(send, `localStorage.setItem('thisPc', 'omen-max-16')`);
  await load(send);
  await openVitals(send);
  check('second notebook: no Power supply tab either', !(await hasPsuTab(send)));
  check('second notebook: no Power supply card either', await evalJs(send, `!${CARD}`));
  // The Storage tab still has its own door, and only that one.
  await clickVitalsTab(send, 'Storage');
  await sleep(200);
  check('the Storage tab keeps its System Cleaner door',
    JSON.stringify(await evalJs(send, `[...document.querySelectorAll('.pv5-svm .pv7-svm-door button')].map(b => b.textContent.replace('→', '').trim())`)) === JSON.stringify(['System Cleaner']));
  await evalJs(send, `localStorage.removeItem('thisPc')`);

  // ── A PC that is not HP's (the desktop's own supply is OMEN's) ─────────────
  await evalJs(send, `localStorage.setItem('nonHpPc', 'true')`);
  await load(send);
  await openVitals(send);
  check('non-HP PC: no Power supply tab and no Power supply card (the page is the desktop\'s, the supply is not OMEN\'s to show)',
    !(await hasPsuTab(send)) && (await evalJs(send, `!${CARD}`)));
  await evalJs(send, `localStorage.removeItem('nonHpPc')`);

  await evalJs(send, `${JSON.stringify(OWN_KEYS)}.forEach(k => localStorage.removeItem(k))`);
  ws.close();
  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} passed`);
  console.log(fails.length ? `${fails.length} FAILED: ${fails.map((f) => f.name).join(', ')}` : 'ALL PASS');
  process.exit(fails.length ? 1 : 0);
}

const clickTabIn = (send, label) =>
  evalJs(send, `[...document.querySelectorAll('.ds-ng3-tool')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)})?.click()`);

main().catch((e) => { console.error(e); process.exit(1); });

// Does the Connectivity tab describe the desk the Admin row sets?
//
// Why this file exists (2026-09-21 flow audit, Cindy: "새로운 디자인에 맞춰서
// 관련된 디자인 플로 전체를 고치는 거야"): the desk roster reached the pictures and
// the device lists on 09-18, but three lines on this tab still spoke from
// literals — DP 1 glowed as occupied on a desk with no tower, the Gear Switch
// note said the second PC was "on USB-C" while the port map put it on DP 1, and
// `This connection` named the MacBook's cable on a tower-only desk.
//
// Nothing here types a port name or a sentence. Every expectation is read from
// a SECOND place on the same screen and the two are compared, so a check cannot
// outlive its decision (2026-09-09: a typed string passed for eight days after
// the design it guarded had retired):
//   · a port is lit            ⇔ its own hover card has a `Connected` row
//   · computers named on ports  = the computers in the Admin list
//   · the Gear Switch note      names the label of the port the second computer is on
//   · `This connection`         = the `Standard` of the port this computer is on
//
// ⏭ Belongs in verify-desk-agreement.mjs' roster section; it is a file of its
// own only because that script was held by the Admin-scenario work on the day
// this was written. Fold it in once that lands.
//
// Run: dev server on :5202, headless Chrome (software WebGL) on :9377, from web/.
import WebSocket from 'ws';

const PORT = process.env.PORT || '5202';
const CDP = process.env.CDP || '9377';
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
  await send('Page.navigate', { url: `http://localhost:${PORT}/?c=${++n}${hash}` });
  for (let waited = 0; waited < 20000; waited += 100) {
    if (await ev(`!!(document.readyState === 'complete' && document.querySelector('#root')?.firstElementChild)`)) break;
    await sleep(100);
  }
  await sleep(900);
};

// The SKU's computer names, in routing order — the one mapping this file needs
// (same line as verify-desk-agreement.mjs; both move to the shared scenario file).
const HOSTS = { macbook: 'MacBook', tower: 'OMEN 35L' };
const DESKS = [
  ['macbook'], ['pulse-27', 'macbook'], ['macbook', 'tower'],
  ['pulse-27', 'macbook', 'tower'], ['pulse-27', 'tower'], ['tower'],
];

// One row per port: its printed label, whether the plate lights it, and what
// its own hover card says (the card is in the DOM whether or not it is shown).
const PORTS = `(() => [...document.querySelectorAll('.pm-panel .pmport, .pmport')].map((e) => {
  const rows = [...e.querySelectorAll('*')].filter((x) => x.children.length === 0).map((x) => x.textContent.trim()).filter(Boolean);
  const after = (k) => { const i = rows.indexOf(k); return i >= 0 ? rows[i + 1] : undefined; };
  return { label: rows[0], lit: e.classList.contains('plug'), connected: after('Connected'), standard: after('Standard') };
}))()`;

await open('#/'); // land on this server before the first write
for (const desk of DESKS) {
  const label = `desk {${desk.join(', ')}}`;
  const pcs = desk.filter((d) => d in HOSTS).map((d) => HOSTS[d]);
  await ev(`localStorage.setItem('deskDevices', ${JSON.stringify(JSON.stringify(desk))}); localStorage.removeItem('kvm'); localStorage.removeItem('portNames'); 1`);
  await open('#/?sku=treehouse-32&tab=connectivity');
  // De-duplicate: the plate is drawn once here, but be safe against a second mount.
  const seen = new Set();
  const ports = (await ev(PORTS)).filter((p) => p.label && !seen.has(p.label) && seen.add(p.label));
  check(`${label}: the port plate rendered`, ports.length >= 8, `${ports.length} ports`);

  const disagree = ports.filter((p) => p.lit !== !!p.connected);
  check(`${label}: a port is lit exactly when its hover card says Connected`, disagree.length === 0,
    disagree.map((p) => `${p.label} lit=${p.lit} connected=${p.connected ?? '—'}`).join(' · '));

  const named = ports.map((p) => p.connected).filter((c) => Object.values(HOSTS).includes(c)).sort();
  check(`${label}: computers on the ports = computers in Admin`, named.join('|') === [...pcs].sort().join('|'),
    `ports say ${named.join(', ') || '(none)'} / Admin says ${pcs.join(', ')}`);

  // `This connection` — the cable from the first computer on this desk.
  const thisConn = await ev(`(() => { const b = [...document.querySelectorAll('.mt-fold')].find((x) => /This connection/.test(x.textContent)); return b?.querySelector('.dc-mono-val')?.textContent.trim() ?? null; })()`);
  const mine = ports.find((p) => p.connected === pcs[0]);
  check(`${label}: This connection = the ${pcs[0]}'s port`, !!mine && thisConn === mine.standard,
    `${thisConn} vs ${mine?.label} (${mine?.standard})`);

  // Gear Switch, before setup — only a two-computer desk shows the note.
  if (pcs.length > 1) {
    const note = await ev(`[...document.querySelectorAll('.mt-note')].map((x) => x.textContent.trim()).find((t) => /Second PC/.test(t)) ?? null`);
    const theirs = ports.find((p) => p.connected === pcs[1]);
    check(`${label}: the Gear Switch note names the ${pcs[1]}'s port`, !!note && !!theirs && note.includes(theirs.label),
      `"${note}" vs ${theirs?.label}`);
  }

  // Inputs fold — a row per plugged, renameable port; none for an empty one.
  await ev(`[...document.querySelectorAll('.mt-fold')].find((x) => /^Inputs/.test(x.textContent.trim()))?.click()`);
  await sleep(300);
  const rowLabels = await ev(`[...document.querySelectorAll('.ds-ng3-row')].filter((r) => r.querySelector('input[type="text"], input:not([type])')).map((r) => r.querySelector('.ds-ng3-label')?.textContent.trim())`);
  const empties = rowLabels.filter((l) => { const p = ports.find((x) => x.label === l); return p && !p.lit; });
  check(`${label}: Inputs offers no row for an empty port`, empties.length === 0, empties.join(', ') || rowLabels.join(', '));
}
await ev(`localStorage.removeItem('deskDevices'); localStorage.removeItem('kvm'); 1`);

ws.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails ? `\n${fails} FAILED of ${results.length}` : `\nALL ${results.length} PASS`);
process.exit(fails ? 1 : 0);

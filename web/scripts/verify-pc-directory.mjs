// The PC directory's rows per machine and scope (src/devices/pcDirectory.ts).
//
// No browser: `pcDirectory` and `hasFanCleaner` are pure functions of the
// machine's registry record and the product scope. verify-pc-device checks the
// same rows as a person sees them in the panel; this one covers what the
// registry cannot offer there — a desktop WITHOUT an OMEN power supply (the
// registry has one desktop, the OMEN MAX 45L, and it has the supply), made here
// by giving a copy of it an id no part belongs to.
//
// Run from web/:  node scripts/verify-pc-directory.mjs
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'trhs-pcdir-'));
const outfile = join(dir, 'pcDirectory.mjs');
// One bundle: the directory and the registry it reads. The registry globs the
// device photos through Vite (`import.meta.glob`), which node has no use for.
await build({
  stdin: {
    contents: "export * from './src/devices/pcDirectory'; export { getResolvedSku } from './src/devices/skus';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile,
  format: 'esm',
  platform: 'node',
  bundle: true,
  logLevel: 'silent',
  define: { 'import.meta.glob': '__noGlob' },
  banner: { js: 'const __noGlob = () => ({});' },
});
const D = await import(pathToFileURL(outfile).href);
const { getResolvedSku } = D;
rmSync(dir, { recursive: true, force: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const LIVE = { mode: 'Performance', capShows: 'System Vitals', psuStatus: 'Good', vitals: 'CPU 58°C', fanCleaner: 'Good' };
const desktop = getResolvedSku('forge-45l');
const notebook = getResolvedSku('hx-omen-16-valorant');
const maxNotebook = getResolvedSku('omen-max-16');
// The tower with no part of its own: no power supply, cap or anything else.
const bare = { ...desktop, id: 'forge-45l-without-parts' };

const rows = (pc, scope) =>
  Object.fromEntries(D.pcDirectory(pc, LIVE, scope).map((g) => [g.id, g.rows.map((r) => r.label)]));
const perf = (pc, scope) => rows(pc, scope).performance ?? [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Fan Cleaner is a notebook's (JY, 2026-10-22): the desktop's supply cleans
// its own fan on the PC page's Power supply tab.
check('the desktop with an OMEN power supply: Power Mode, System Vitals, Power supply — no Fan Cleaner',
  same(perf(desktop, 'full'), ['Power Mode', 'System Vitals', 'Power supply']), perf(desktop, 'full').join(' · '));
for (const [name, pc] of [['OMEN 16', notebook], ['OMEN Max 16', maxNotebook]]) {
  check(`the notebook (${name}): Power Mode, System Vitals, Fan Cleaner`, same(perf(pc, 'full'), ['Power Mode', 'System Vitals', 'Fan Cleaner']), perf(pc, 'full').join(' · '));
}
check('a desktop without an OMEN power supply: Power Mode and System Vitals, no Fan Cleaner, no Power supply',
  same(perf(bare, 'full'), ['Power Mode', 'System Vitals']), perf(bare, 'full').join(' · '));
check('hasFanCleaner: notebooks yes, a desktop no, with the supply or without',
  D.hasFanCleaner(notebook, 'full') && D.hasFanCleaner(maxNotebook, 'full') && !D.hasFanCleaner(desktop, 'full') && !D.hasFanCleaner(bare, 'full'));
for (const [name, pc] of [['desktop', desktop], ['notebook', notebook], ['bare desktop', bare]]) {
  check(`june 2027 ${name}: System Vitals alone, no Fan Cleaner, no Personalize`,
    same(perf(pc, 'june27'), ['System Vitals']) && !('personalize' in rows(pc, 'june27')) && !D.hasFanCleaner(pc, 'june27'), JSON.stringify(rows(pc, 'june27')));
}

// Where the rows go. The three Performance cards are on the Performance page,
// and the page lights the card. Everything else is a tab of the PC's page.
const dest = (pc, scope, id) => D.pcDirectory(pc, LIVE, scope).flatMap((g) => g.rows).find((r) => r.id === id)?.to;
for (const [pc, id, spot] of [[desktop, 'power-mode', 'power-mode'], [desktop, 'vitals', 'vitals'], [notebook, 'fan-cleaner', 'fan-cleaner']]) {
  const t = dest(pc, 'full', id);
  check(`the ${id} row goes to /perform and lights ${spot}`, t?.kind === 'page' && t.path === '/perform' && t.spot === spot, JSON.stringify(t));
}
const j = dest(desktop, 'june27', 'vitals');
check('june: the System Vitals row goes to the vitals card', j?.kind === 'page' && j.path === '/perform' && j.spot === 'vitals', JSON.stringify(j));
const tabOf = (pc, id) => {
  const t = dest(pc, 'full', id);
  return t?.kind === 'device' && t.sku === pc.id && !('part' in t) ? t.tab : `not a tab of the PC's page: ${JSON.stringify(t)}`;
};
check('the desktop: Power supply, LCD cooler cap and Chassis lighting open the PC page at psu / cooler-cap / lighting',
  tabOf(desktop, 'psu') === 'psu' && tabOf(desktop, 'cooler-cap') === 'cooler-cap' && tabOf(desktop, 'lighting') === 'lighting',
  [tabOf(desktop, 'psu'), tabOf(desktop, 'cooler-cap'), tabOf(desktop, 'lighting')].join(' · '));
for (const [name, pc, macro] of [['OMEN 16', notebook, 'macros'], ['OMEN Max 16', maxNotebook, null]]) {
  const lighting = tabOf(pc, 'lighting');
  const m = macro ? tabOf(pc, 'macros') : null;
  check(`the notebook (${name}): Lighting opens the PC page at lighting${macro ? ', Macro at macros' : ''}`, lighting === 'lighting' && (!macro || m === macro), `${lighting}${m ? ' · ' + m : ''}`);
}
check('no destination opens a part alone: no row carries `part`',
  [desktop, notebook, maxNotebook].every((pc) => D.pcDirectory(pc, LIVE, 'full').flatMap((g) => g.rows).every((r) => !r.to || r.to.kind !== 'device' || !('part' in r.to))));
const readings = Object.fromEntries(D.pcDirectory(desktop, LIVE, 'full').flatMap((g) => g.rows).map((r) => [r.id, r.reading]));
const nbReadings = Object.fromEntries(D.pcDirectory(notebook, LIVE, 'full').flatMap((g) => g.rows).map((r) => [r.id, r.reading]));
check('the rows read what the caller gives them', readings['power-mode'] === 'Performance' && readings.vitals === 'CPU 58°C' && nbReadings['fan-cleaner'] === 'Good' && readings.psu === 'Good', JSON.stringify({ ...readings, nbFanCleaner: nbReadings['fan-cleaner'] }));

const fails = results.filter((r) => !r.ok);
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);

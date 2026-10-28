// The verification runner — one command, one digest.
//
//   npm run verify                     every suite
//   npm run verify -- nova home-wide   substring match, for the inner loop
//   npm run verify -- --dev            against the dev server instead of a build
//   npm run verify -- --list           print what would run, start nothing
//
// WHY THIS EXISTS. Until now there was no runner in the repo: the boot sequence,
// the lane policy, the timeouts and the port rules lived as prose in
// `.claude/agents/verify-runner.md`, and every run re-improvised them. The
// improvisations were not equivalent. One used a 120s per-suite cap and killed
// four passing suites; `HANDOFF.md` had already recorded that 240s killed
// `verify-desk-card` mid-pass at 117 checks and that 900s is right. Another
// fanned out 4 lanes; the best recorded run used 2, with a fresh browser profile
// per SUITE, which is what kept the cross-suite localStorage coupling out of it.
// Everything below is the version that is known to work, written down once.
//
// WHY A BUILD — and NOT for the reason you would guess. The suites drive ~338
// full page loads, so serving a built bundle instead of the dev server looked
// like the big win. Measured: `verify-nova` is 155s on dev and 147s on preview.
// About 5%. Vite caches its transforms once warm, so the loads were never the
// bottleneck; half of that suite's runtime is its own `go()` helper sleeping
// 1400ms after every navigation, 55 times.
//
// The build stays anyway, on the honest justification: it is the artifact
// `npm run deploy` ships, and until now nothing verified it. `--dev` is there
// for when you are iterating on source and do not want to rebuild.
//
// The real win is this file existing. The 30-70 minute runs were orchestration
// waste — a wrong timeout, two runs that stalled and reported nothing, retries
// caused by contention, and false failures from state the previous suite left
// behind. None of that was the suites.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const WEB = dirname(SCRIPTS);

/**
 * Matched by the glob but NOT suites. Never a hardcoded roster of what to RUN —
 * `docs/gotchas.md` forbids inventories, and this one has grown 38 → 44 while
 * the written counts lagged. Discover, then subtract.
 */
const EXCLUDED = new Set(['verify-light-theme.mjs', 'capture-module-shots.mjs']);

/** No browser at all — pure functions through esbuild. Run first, as a smoke check. */
const NO_BROWSER = ['verify-profiles.mjs', 'verify-css-crops.mjs', 'verify-pc-directory.mjs'];

/**
 * Run alone, after the lanes. Both read state mid-transition (a 350ms panel
 * slide, a 0.28s reservation ease, a framer drag release) and red under
 * contention while passing clean standalone — recorded across two sessions.
 */
const ALONE = new Set(['verify-nova.mjs', 'verify-home-wide.mjs']);

/**
 * Coupled suites share state, so they run in the poisoning order when both are
 * in the set: `device-button` seeds its own `board-layout`; `simple-eq` creates
 * `eqPresets` and then clears it, which `headset-canvas` reads. Expressed as a
 * rank — anything unlisted sorts after.
 */
const ORDER = ['verify-device-button.mjs', 'verify-simple-eq.mjs', 'verify-headset-canvas.mjs'];

/**
 * `verify-walk-all` SPAWNS these — 12 `tab-walk` invocations and one
 * `live-desk` — so running them standalone as well does the same work twice.
 * Its `connectivity treehouse-32` run is exactly the standalone default
 * (`verify-walk-all.mjs:32`), and its `live-desk` call is identical
 * (`:38`). Dropped only when walk-all is actually in the selection, so
 * `npm run verify -- tab-walk` still runs it on its own.
 */
const SUBSUMED_BY_WALK_ALL = ['verify-tab-walk.mjs', 'verify-live-desk.mjs'];

/**
 * A scheduling hint, not a correctness rule: start the long poles first so the
 * lanes finish together instead of one lane still holding an 8-minute suite
 * after the others are idle. Measured 2026-10-04 — walk-all 512s (13 child
 * processes), desk-card 315s, desk-agreement 155s. Stale entries cost nothing
 * but a slightly worse packing.
 */
const LONG_FIRST = ['verify-walk-all.mjs', 'verify-desk-card.mjs', 'verify-desk-agreement.mjs', 'verify-personalize.mjs'];

/**
 * The cap is a HANG catcher, not a budget. 240s once killed `verify-desk-card`
 * mid-pass at 117 checks; 900s looked like plenty until the same suite measured
 * **876s under four lanes** — a 3% margin, where one more unit of load turns a
 * passing suite into a false failure that then costs another 876s to retry.
 * macOS has no `timeout` command, so this is enforced in-process below.
 */
const SUITE_TIMEOUT_MS = 1_200_000;

/**
 * Two, measured 2026-10-04 on this machine:
 *
 *   2 lanes → 43/43, 25m02 wall, 38.9m suite time, desk-card 315s
 *   4 lanes → 41/41, 18m15 wall, 48.7m suite time, desk-card 876s
 *
 * Four is seven minutes faster and the suites still pass, but the machine is
 * saturated — total suite time rises 25% and the longest suite nearly triples,
 * which is how a contention flake becomes a timeout. Seven minutes does not buy
 * that risk. `--lanes=4` is there when you want it.
 */
const LANES_DEFAULT = 2;

// Windows too (2026-10-12, Kristy's PC): Chrome's two usual homes there.
const WIN_CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
const CHROME =
  process.env.CHROME ||
  (process.platform === 'win32' && WIN_CHROME) ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/**
 * Software WebGL, never `--disable-gpu` alone. The Personalize page mounts a
 * three.js canvas per profile card; with no WebGL backend
 * `verify-profile-surfaces` fails three checks with
 * "THREE.WebGLRenderer: Error creating WebGL context" — an environment fault
 * that reads exactly like a product bug.
 */
const GL_FLAGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const filters = argv.filter((a) => !a.startsWith('--'));
const useDev = flag('dev');
const listOnly = flag('list');
const skipBuild = flag('no-build');
const lanes = Math.max(1, Number(opt('lanes', LANES_DEFAULT)) || LANES_DEFAULT);
const timeoutMs = Number(opt('timeout', SUITE_TIMEOUT_MS)) || SUITE_TIMEOUT_MS;

// ── discovery ────────────────────────────────────────────────────────────────
const all = readdirSync(SCRIPTS)
  .filter((f) => /^verify-.*\.mjs$/.test(f) && !EXCLUDED.has(f))
  .sort();
const selected = filters.length
  ? all.filter((f) => filters.some((q) => f.includes(q)))
  : all;

if (!selected.length) {
  console.error(`No suite matches ${filters.join(', ')}. Available:\n  ${all.join('\n  ')}`);
  process.exit(2);
}

const rank = (f) => {
  const coupled = ORDER.indexOf(f);
  if (coupled >= 0) return coupled;
  const long = LONG_FIRST.indexOf(f);
  return long >= 0 ? ORDER.length + long : ORDER.length + LONG_FIRST.length;
};
const pure = selected.filter((f) => NO_BROWSER.includes(f));
const alone = selected.filter((f) => ALONE.has(f));
const walkAll = selected.includes('verify-walk-all.mjs');
const skipped = walkAll ? selected.filter((f) => SUBSUMED_BY_WALK_ALL.includes(f)) : [];
const fanned = selected
  .filter((f) => !NO_BROWSER.includes(f) && !ALONE.has(f) && !skipped.includes(f))
  .sort((a, b) => rank(a) - rank(b));

if (listOnly) {
  console.log(`no browser (${pure.length}):\n  ${pure.join('\n  ') || '—'}`);
  console.log(`\n${lanes} lanes (${fanned.length}):\n  ${fanned.join('\n  ') || '—'}`);
  console.log(`\nalone (${alone.length}):\n  ${alone.join('\n  ') || '—'}`);
  if (skipped.length) console.log(`\nrun by walk-all, not again (${skipped.length}):\n  ${skipped.join('\n  ')}`);
  process.exit(0);
}

// ── ports ────────────────────────────────────────────────────────────────────
const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const children = new Set();
const tempDirs = new Set();
let shuttingDown = false;
function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
  cleanup();
  process.exit(130);
});

const spawnTracked = (cmd, args, opts) => {
  const c = spawn(cmd, args, opts);
  children.add(c);
  c.on('exit', () => children.delete(c));
  return c;
};

const waitForHttp = async (url, ms = 60_000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  return false;
};

// Vite's own entry, run with this Node: `npx` is `npx.cmd` on Windows, which
// spawn cannot start without a shell (2026-10-12).
const VITE = join(WEB, 'node_modules', 'vite', 'bin', 'vite.js');

// ── the app server ───────────────────────────────────────────────────────────
if (!useDev && !skipBuild) {
  console.log('Building…');
  execFileSync(process.execPath, [VITE, 'build'], { cwd: WEB, stdio: 'inherit' });
}
const appPort = await freePort();
const serverArgs = useDev
  ? [VITE, '--port', String(appPort), '--strictPort']
  : [VITE, 'preview', '--port', String(appPort), '--strictPort'];
const server = spawnTracked(process.execPath, serverArgs, { cwd: WEB, stdio: 'ignore' });
const appUrl = `http://localhost:${appPort}/`;
if (!(await waitForHttp(appUrl))) {
  console.error(`The app server never came up on ${appPort}.`);
  process.exit(2);
}
/**
 * Warm it before the first suite. Against a cold Vite the on-demand transform
 * outruns the suites' fixed sleeps, the page is measured before it mounts, and
 * checks fail with every selector empty — a false 3-check failure in
 * verify-desk-agreement, clean on every warm run after.
 */
await fetch(appUrl).catch(() => {});
await fetch(`${appUrl}?warm=1#/personalize`).catch(() => {});
console.log(`${useDev ? 'dev server' : 'preview build'} on :${appPort}`);
if (skipped.length) console.log(`(${skipped.map((f) => f.replace(/^verify-|\.mjs$/g, '')).join(', ')} run inside walk-all, not again)`);
console.log('');

// ── running one suite ────────────────────────────────────────────────────────
/**
 * A virgin Chrome per suite. Some suites are not idempotent — they persist to
 * `trhs-profiles` and then fail their own default-state checks on a second run
 * in the same browser — and 36 of 44 never reset storage at startup, so one
 * suite's leftovers are the next one's defaults. A fresh profile makes every
 * run a "run 1". Launching on the APP URL rather than about:blank matters just
 * as much: several suites seed localStorage before their first navigation, and
 * on about:blank there is no origin to store against.
 */
async function runOnce(file, outDir) {
  const cdpPort = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'trhs-verify-'));
  tempDirs.add(profile);
  const chrome = spawnTracked(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      ...GL_FLAGS,
      appUrl,
    ],
    // CHROME_LOG=<dir> keeps each Chrome's stderr: a browser that dies
    // mid-suite otherwise leaves only a closed socket behind.
    { stdio: process.env.CHROME_LOG ? ['ignore', 'ignore', openSync(join(process.env.CHROME_LOG, `${file}-${cdpPort}.log`), 'w')] : 'ignore' },
  );
  try {
    if (!(await waitForHttp(`http://localhost:${cdpPort}/json/version`, 30_000))) {
      return { ok: false, out: `Chrome never opened a debugging port on ${cdpPort}`, timedOut: false };
    }
    mkdirSync(outDir, { recursive: true });
    // BOTH pairs, always. Most suites read APP_PORT/CDP_PORT; the monitor suites
    // read only PORT/CDP and silently dial hardcoded defaults (5219/9270,
    // 5194/9231) otherwise, then fail or hang against nothing.
    const env = {
      ...process.env,
      APP_PORT: String(appPort),
      CDP_PORT: String(cdpPort),
      PORT: String(appPort),
      CDP: String(cdpPort),
      OUT_DIR: outDir,
      QUIET: '1',
    };
    // verify-tab-walk takes a TAB NAME as argv[2], not an output directory — it
    // reads OUT_DIR from the environment. Passing a path makes it walk a tab
    // that does not exist.
    const args = file === 'verify-tab-walk.mjs' ? [join(SCRIPTS, file)] : [join(SCRIPTS, file), outDir];
    const proc = spawnTracked('node', args, { cwd: WEB, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (out += d));
    let timedOut = false;
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }, timeoutMs);
      proc.on('exit', (c) => {
        clearTimeout(timer);
        resolve(c);
      });
    });
    return { ok: code === 0 && !timedOut, out, timedOut };
  } finally {
    // Wait for Chrome to actually exit before touching its profile. SIGKILL
    // returns immediately while the process is still flushing, and `rmSync`
    // then fails with ENOTEMPTY — which is not an ENOENT, so `force: true` does
    // not cover it. That crashed the whole run mid-roster the first time.
    const gone = new Promise((resolve) => chrome.once('exit', resolve));
    try {
      chrome.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    await Promise.race([gone, sleep(5_000)]);
    try {
      rmSync(profile, { recursive: true, force: true });
      tempDirs.delete(profile);
    } catch {
      // Leave it registered so the exit handler tries again; a stray temp dir
      // is never worth failing a run over.
    }
  }
}

/** The headline a suite printed, for the digest. Formats differ; take the last one that looks like a tally. */
function tallyOf(out) {
  const lines = out.trim().split('\n').reverse();
  for (const l of lines) {
    const m = l.match(/(\d+\/\d+ passed|ALL PASS|\d+ ✗ · \d+ ✓|\d+ 🔴[^\n]*)/);
    if (m) return m[1].trim();
  }
  return '';
}
/** The failing check names, for a report that does not need the full log. */
function failuresOf(out) {
  return out
    .split('\n')
    .filter((l) => /^\s*✗/.test(l))
    .slice(0, 6)
    .map((l) => l.trim());
}

const results = [];
async function run(file, laneOut) {
  const started = Date.now();
  let r = await runOnce(file, laneOut);
  let retried = false;
  // A failure may be a flake. Re-run ONCE, on a fresh profile. Never more than
  // once — that manufactures a pass.
  let firstFails = '';
  if (!r.ok) {
    retried = true;
    // Keep what the first run said: a retry that passes otherwise throws away
    // the only record of the flake, and a flake nobody can name is never fixed.
    firstFails = (r.out || '').split('\n').filter((l) => /^\s*✗/.test(l) || /TIMED OUT|Error/.test(l)).slice(0, 12).join('\n');
    r = await runOnce(file, laneOut);
  }
  const seconds = (Date.now() - started) / 1000;
  results.push({ file, ...r, retried, firstFails, seconds });
  const mark = r.ok ? (retried ? '✓ (retried)' : '✓') : '✗';
  console.log(`${mark} ${file.replace(/^verify-|\.mjs$/g, '')} · ${seconds.toFixed(0)}s · ${tallyOf(r.out) || (r.timedOut ? 'TIMED OUT' : '')}`);
}

// ── the run ──────────────────────────────────────────────────────────────────
const outRoot = mkdtempSync(join(tmpdir(), 'trhs-verify-out-'));
tempDirs.add(outRoot);

for (const file of pure) await run(file, join(outRoot, 'pure'));

let next = 0;
await Promise.all(
  Array.from({ length: Math.min(lanes, fanned.length) }, async (_, lane) => {
    const laneOut = join(outRoot, `lane-${lane}`);
    while (next < fanned.length) await run(fanned[next++], laneOut);
  }),
);

for (const file of alone) await run(file, join(outRoot, 'alone'));

// ── digest ───────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
const total = (results.reduce((a, r) => a + r.seconds, 0) / 60).toFixed(1);
console.log(`\n${results.length - failed.length}/${results.length} suites passed · ${total} min of suite time`);
const retries = results.filter((r) => r.retried && r.ok);
if (retries.length) console.log(`needed a retry: ${retries.map((r) => r.file).join(', ')}`);
for (const r of retries) if (r.firstFails) console.log(`  ${r.file}, first run:\n${r.firstFails.replace(/^/gm, '    ')}`);
for (const f of failed) {
  console.log(`\n✗ ${f.file}${f.timedOut ? ` — TIMED OUT after ${timeoutMs / 1000}s` : ''}`);
  for (const l of failuresOf(f.out)) console.log(`    ${l}`);
  if (!failuresOf(f.out).length) console.log(`    ${f.out.trim().split('\n').slice(-6).join('\n    ')}`);
}

cleanup();
process.exit(failed.length ? 1 : 0);

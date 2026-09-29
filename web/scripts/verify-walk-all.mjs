// Walk every surface we own, once, and say in a few lines what a hand would find.
//
// Why this file exists (2026-09-23, Cindy: «너 이런 버그를 내가 일일이 테스트를
// 해서 너한테 이걸 말을 해야 되니? 너 셀프 QC 모드 그런 거 없어?»). The hand-like
// walker existed since 09-22 but was run one monitor tab at a time, only on the
// tab just edited — so a surface nobody touched was never walked (the Customize
// card, built 08-20) and nothing changed the desk with a picture open (the
// scenario bug). This runs all of it after every merge into CURRENT.
//
// Cost is time, not reading: each child runs QUIET and writes its full list to
// its own report; this prints only red lines (capped), one line for everything
// clean, and the line of what was NOT walked — so a clean sweep is ~6 lines.
//
// Run: dev server + headless Chrome (software WebGL) with --remote-debugging-port, from web/:
//   PORT=5178 CDP=9251 node scripts/verify-walk-all.mjs
// Report → ~/Treehouse-monitor/design-loop/reports/<date>-walk-all.md (carries the
// HEAD it walked, which is how a later turn can tell the sweep is stale).
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = process.env.PORT || '5178';
const CDP = process.env.CDP || '9251';
const OUT_DIR = process.env.OUT_DIR || join(homedir(), 'Treehouse-monitor/design-loop/reports');
const LOGS = join(OUT_DIR, 'walk-all-logs');
mkdirSync(LOGS, { recursive: true });

// Our surfaces. Monitor windows: every tab of both monitors we own. Then the
// surfaces that are not a tab, then the desk changed with a picture open.
const RUNS = [
  ...['display', 'connectivity', 'lighting', 'audio', 'utilities'].map((t) => ({ name: `Treehouse 32 · ${t}`, args: ['scripts/verify-tab-walk.mjs', t, 'treehouse-32'] })),
  // Gear Switch set up = the state Cindy demos; its side column is the tall one.
  { name: 'Treehouse 32 · connectivity (Gear Switch on)', args: ['scripts/verify-tab-walk.mjs', 'connectivity', 'treehouse-32'], env: { SEED: JSON.stringify({ kvm: { configured: true, activePc: 'pc1' } }), WALK_TAG: 'gear-on' } },
  ...['display', 'connectivity', 'utilities'].map((t) => ({ name: `OMEN OLED 27 · ${t}`, args: ['scripts/verify-tab-walk.mjs', t, 'pulse-27'] })),
  { name: 'Home Treehouse 32 card', args: ['scripts/verify-tab-walk.mjs', 'home-card'] },
  { name: 'Customize card', args: ['scripts/verify-tab-walk.mjs', 'customize-card'] },
  { name: 'Personalize Display', args: ['scripts/verify-tab-walk.mjs', 'personalize-display'] },
  { name: 'Desk changed while open', args: ['scripts/verify-live-desk.mjs'] },
];
// Said in every output so a clean total is never read as "everything".
const NOT_WALKED = 'Arrange 창 안쪽 · OMEN OLED 27 그림을 열어둔 채 바꾸기 · Light Studio(크리스 · 3D) · 크리스 주변기기 창 · 보기에 어색한 것(눈 점검 몫)';

const run = (r) => new Promise((resolve) => {
  const t0 = Date.now();
  const p = spawn('node', r.args, { env: { ...process.env, PORT, CDP, OUT_DIR, QUIET: '1', ...(r.env || {}) } });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => {
    const file = join(LOGS, r.name.replace(/[^\w]+/g, '-') + '.log');
    writeFileSync(file, out);
    const reds = out.split('\n').filter((l) => /^(🔴|✗) /.test(l));
    const orange = out.split('\n').filter((l) => /^🟠 /.test(l)).length;
    const total = out.split('\n').reverse().find((l) => /→ .*\.md$/.test(l)) || '';
    const broke = code !== 0 && !reds.length; // crashed or never rendered — not a finding, a blind spot
    resolve({ ...r, code, reds, orange, total: total.replace(/ → .*$/, ''), report: (total.match(/→ (.*\.md)$/) || [])[1], secs: Math.round((Date.now() - t0) / 1000), broke, tail: out.trim().split('\n').slice(-1)[0] });
  });
});

const t0 = Date.now();
let head = '?';
try { head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
const results = [];
for (const r of RUNS) results.push(await run(r));

const hot = results.filter((r) => r.reds.length);
const blind = results.filter((r) => r.broke);
const clean = results.filter((r) => !r.reds.length && !r.broke);
const lines = [];
lines.push(`walk-all @ ${head} · ${results.length} surfaces · ${Math.round((Date.now() - t0) / 1000)}s`);
for (const r of hot) {
  lines.push(`${r.name} — ${r.total}`);
  for (const l of r.reds.slice(0, 3)) lines.push(`  ${l.slice(0, 180)}`);
  if (r.reds.length > 3) lines.push(`  … 외 ${r.reds.length - 3}줄 (${(r.report || '').split('/').pop()})`);
}
for (const r of blind) lines.push(`⚠️ 못 걸음: ${r.name} — ${r.tail.slice(0, 140)}`);
const og = results.filter((r) => r.orange);
if (og.length) lines.push(`🟠 값만 저장되고 화면이 안 바뀌는 컨트롤 ${og.reduce((a, r) => a + r.orange, 0)}개 — ${og.map((r) => `${r.name} ${r.orange}`).join(' · ')} (목록은 각 리포트)`);
if (clean.length) lines.push(`🔴 0: ${clean.map((r) => r.name).join(' · ')}`);
lines.push(`안 걸은 화면: ${NOT_WALKED}`);

const date = new Date().toISOString().slice(0, 10);
const file = join(OUT_DIR, `${date}-walk-all.md`);
writeFileSync(file, `# 우리 화면 전부 한 바퀴 — ${date}\n\n> HEAD \`${head}\` · :${PORT} · \`web/scripts/verify-walk-all.mjs\`\n\n${lines.map((l) => (l.startsWith('  ') ? `  - ${l.trim()}` : `- ${l}`)).join('\n')}\n\n## 표면별 리포트\n${results.map((r) => `- ${r.name} — ${r.broke ? '못 걸음' : r.total} · ${r.secs}s${r.report ? ` · ${r.report}` : ''}`).join('\n')}\n`);
console.log(lines.join('\n'));
console.log(`→ ${file.split('/').slice(-2).join('/')}`);
process.exit(hot.some((r) => r.reds.some((l) => /^(🔴|✗)/.test(l))) || blind.length ? 1 : 0);

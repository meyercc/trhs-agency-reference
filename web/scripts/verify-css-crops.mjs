// Crop windows carry the app radius themselves — a clip-path inset() that
// shows a partial view of something must say `round`, or its visible corners
// are square no matter what border-radius the element wears (the element's
// rounding sits on the OUTER edge; the clip cuts inside it).
//
// Born 2026-08-31: the port-run window on REAR PORTS shipped square corners
// and Cindy caught it by eye — the second radius line under the open
// "UI Done-Gate ②-④" rail candidate (plan.md 재지시 장부). This is the narrow,
// machine-checkable slice of that class.
//
// Exempt: full-hide insets (`inset(50%)`, `inset(100%)`) — the visually-hidden
// accessibility idiom hides everything, so it has no visible corners.
//
// Run: node scripts/verify-css-crops.mjs   (pure file scan, no browser)
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const roots = ['src'];
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.css')) files.push(p);
  }
};
roots.forEach(walk);

let bad = 0, seen = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    // One level of nesting allowed: inset(calc(...) calc(...) … round …) — a
    // plain [^)]* stopped at the first calc's close and truncated the value.
    const m = line.match(/clip-path\s*:\s*inset\(((?:[^()]|\([^()]*\))*)\)/);
    if (!m) return;
    seen++;
    const args = m[1].trim();
    if (/\bround\b/.test(args)) return;
    if (/^(50|100)%$/.test(args)) return; // visually-hidden idiom, no window
    bad++;
    console.log(`✗ ${f}:${i + 1} — inset() window without \`round\`: ${line.trim().slice(0, 90)}`);
  });
}
console.log(`${bad === 0 ? '✓' : '✗'} css crop windows — inset() ${seen}곳 중 round 누락 ${bad}곳`);
process.exit(bad ? 1 : 0);

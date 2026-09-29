// Direct test of the software-profile arbitration rules (src/state/profileModel.ts).
//
// Unlike the other verify-* scripts this one drives no browser: the rules are
// pure functions, and the clause worth protecting — "a game close only reverts
// if a game is still what's reigning" — is invisible in the UI once it's wrong.
// esbuild (a Vite dependency) strips the types so node can import the module.
//
// Run from web/:  node scripts/verify-profiles.mjs
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'trhs-profiles-'));
const outfile = join(dir, 'profileModel.mjs');
await build({
  entryPoints: ['src/state/profileModel.ts'],
  outfile,
  format: 'esm',
  platform: 'node',
  bundle: true,
  logLevel: 'silent',
});
const M = await import(outfile);
rmSync(dir, { recursive: true, force: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

// ── Fixtures ────────────────────────────────────────────────────────────────
// Work owns weekday 09:00–17:00. Gaming owns the game "apex". Music owns
// nothing — it only ever arrives by hand, which is what makes it the right
// profile for testing that a manual pick survives.
const profile = (id, extra = {}) => ({
  id,
  name: id,
  image: 'wp:blue',
  overrides: {},
  devices: {},
  gameLink: M.EMPTY_GAME_LINK,
  schedule: M.EMPTY_SCHEDULE,
  ...extra,
});
const PROFILES = [
  profile('work', { schedule: { enabled: true, start: 9 * 60, end: 17 * 60, days: [1, 2, 3, 4, 5] } }),
  profile('gaming', { gameLink: { enabled: true, gameIds: ['apex'] } }),
  profile('music'),
  profile('night', { schedule: { enabled: true, start: 22 * 60, end: 2 * 60, days: [5] } }),
];
const store = (over = {}) => ({ profiles: PROFILES, activeId: 'work', source: 'manual', revertTo: null, ...over });

// Wednesday 2026-09-16: 10:00 is inside the Work window, 20:00 is outside.
const WED_10 = new Date(2026, 8, 16, 10, 0);
const WED_20 = new Date(2026, 8, 16, 20, 0);

// ── Schedule matching ───────────────────────────────────────────────────────
const workSched = PROFILES[0].schedule;
check('schedule matches inside its window', M.scheduleMatches(workSched, WED_10));
check('schedule misses outside its window', !M.scheduleMatches(workSched, WED_20));
check('schedule misses on an excluded day', !M.scheduleMatches(workSched, new Date(2026, 8, 13, 10, 0)));
check('disabled schedule never matches', !M.scheduleMatches({ ...workSched, enabled: false }, WED_10));
check('zero-length window never matches', !M.scheduleMatches({ ...workSched, start: 600, end: 600 }, WED_10));

// A Friday 22:00 → 02:00 window: the tail after midnight belongs to Friday, so
// Saturday 00:30 is IN and Friday 00:30 (the tail of an unscheduled Thursday)
// is OUT. Getting this backwards is the classic wrapped-window bug.
const night = PROFILES[3].schedule;
check('wrapped window: Friday 23:00 is inside', M.scheduleMatches(night, new Date(2026, 8, 18, 23, 0)));
check('wrapped window: Saturday 00:30 is inside (Friday tail)', M.scheduleMatches(night, new Date(2026, 8, 19, 0, 30)));
check('wrapped window: Friday 00:30 is outside (Thursday tail)', !M.scheduleMatches(night, new Date(2026, 8, 18, 0, 30)));
check('wrapped window: Saturday 23:00 is outside', !M.scheduleMatches(night, new Date(2026, 8, 19, 23, 0)));

// ── Lookups ─────────────────────────────────────────────────────────────────
check('linkedProfile finds the claiming profile', M.linkedProfile(PROFILES, 'apex')?.id === 'gaming');
check('linkedProfile ignores an unclaimed game', M.linkedProfile(PROFILES, 'doom') === null);
check(
  'linkedProfile ignores a disabled link',
  M.linkedProfile([profile('x', { gameLink: { enabled: false, gameIds: ['apex'] } })], 'apex') === null,
);
check('scheduledProfile finds the open window', M.scheduledProfile(PROFILES, WED_10)?.id === 'work');
check('scheduledProfile finds nothing out of hours', M.scheduledProfile(PROFILES, WED_20) === null);

// ── Arbitration ─────────────────────────────────────────────────────────────
let s = M.applySelect(store(), 'music');
check('manual pick switches and records intent', s.activeId === 'music' && s.source === 'manual');
check('manual pick drops any revert claim', M.applySelect(store({ revertTo: 'work' }), 'music').revertTo === null);
check('manual pick to an unknown id is a no-op', M.applySelect(store(), 'nope').activeId === 'work');

s = M.applyGameLaunch(store(), 'apex');
check('game launch switches to the linked profile', s.activeId === 'gaming' && s.source === 'game');
check('game launch remembers where it came from', s.revertTo === 'work');
check('unclaimed game launch is a no-op', M.applyGameLaunch(store(), 'doom').activeId === 'work');

// A game launch outranks an open schedule window — the whole point of "game
// link is top priority on a gaming PC".
check('game launch beats an open schedule window', M.applyGameLaunch(store({ source: 'schedule' }), 'apex').activeId === 'gaming');

// A schedule edge must not steal focus mid-game, and must not clobber the
// revert target either.
s = M.applyScheduleOpen(store({ activeId: 'gaming', source: 'game', revertTo: 'music' }), 'work');
check('schedule does not steal from a running game', s.activeId === 'gaming' && s.source === 'game');
check('schedule leaves the revert target alone mid-game', s.revertTo === 'music');
check('schedule switches when no game reigns', M.applyScheduleOpen(store(), 'work').source === 'schedule');

// Game close, out of hours: back where we came from.
s = M.applyGameClose(store({ activeId: 'gaming', source: 'game', revertTo: 'music' }), WED_20);
check('game close reverts to where it came from', s.activeId === 'music' && s.source === 'manual');
check('game close clears the revert claim', s.revertTo === null);

// Game close, inside a window that opened during play: the newer standing
// intent takes over instead of the stale revert target.
s = M.applyGameClose(store({ activeId: 'gaming', source: 'game', revertTo: 'music' }), WED_10);
check('game close prefers an open schedule window', s.activeId === 'work' && s.source === 'schedule');

// A game close with nothing to go back to leaves you put rather than guessing.
s = M.applyGameClose(store({ activeId: 'gaming', source: 'game', revertTo: null }), WED_20);
check('game close with no target stays put', s.activeId === 'gaming' && s.source === 'manual');

// ── THE rule: Chris's walkthrough, end to end ───────────────────────────────
// Work (scheduled) → launch a game → manually pick Music → quit the game.
// We must END ON MUSIC: the manual pick superseded the game's claim to revert.
let w = store({ activeId: 'work', source: 'schedule' });
w = M.applyGameLaunch(w, 'apex');
check('walkthrough · launching moves to Gaming', w.activeId === 'gaming' && w.source === 'game');
w = M.applySelect(w, 'music');
check('walkthrough · the hand pick moves to Music', w.activeId === 'music' && w.source === 'manual');
w = M.applyGameClose(w, WED_20);
check('walkthrough · quitting the game LEAVES YOU ON MUSIC', w.activeId === 'music' && w.source === 'manual');

// The same walkthrough without the manual pick still reverts, so the clause
// above narrows the revert rather than disabling it.
let v = store({ activeId: 'work', source: 'schedule' });
v = M.applyGameLaunch(v, 'apex');
v = M.applyGameClose(v, WED_20);
check('walkthrough · without a hand pick, quitting still reverts', v.activeId === 'work');

// Game-to-game handoff keeps the ORIGINAL pre-gaming profile as the target.
let g = M.applyGameLaunch(store({ activeId: 'music' }), 'apex');
g = M.applyGameLaunch({ ...g, activeId: 'work' }, 'apex');
check('game-to-game handoff keeps the pre-gaming target', g.revertTo === 'music');

// ── Export / import ─────────────────────────────────────────────────────────
// A file carries profiles only; importing adds options and never chooses one.
const FIXED = new Date(Date.UTC(2026, 8, 22, 12, 0, 0));
const text = M.serializeProfiles(PROFILES, FIXED);
const file = JSON.parse(text);
check('export · file is marked as ours and dated', file.format === 'trhs-profiles' && file.exported === '2026-09-22T12:00:00.000Z');
check('export · carries every profile and nothing about this machine',
  file.profiles.length === 4 && !('activeId' in file) && !('source' in file));
check('export · round-trips through parse', M.parseProfilesFile(text)?.map((p) => p.id).join() === 'work,gaming,music,night');
check('import · an unrelated JSON file is refused, not mangled', M.parseProfilesFile('{"profiles":[1,2]}') === null);
check('import · garbage is refused', M.parseProfilesFile('not json') === null);
check('import · a partial record is filled out', M.parseProfilesFile('{"format":"trhs-profiles","profiles":[{"name":"Bare"}]}')[0].schedule.days.length === 5);

let fresh = 0;
const freshId = () => `fresh-${++fresh}`;
// Re-importing your own export changes nothing and adds nothing.
const same = M.applyImport(store(), M.parseProfilesFile(text), freshId);
check('import · re-importing your own export is idempotent',
  same.store.profiles.length === 4 && same.ids.join() === 'work,gaming,music,night' && fresh === 0);
// The same profile (id + name) from another machine refreshes in place.
const refreshed = M.applyImport(store(), [profile('work', { image: 'wp:red' })], freshId);
check('import · the same profile from elsewhere is updated in place',
  refreshed.store.profiles.length === 4 && refreshed.store.profiles[0].image === 'wp:red' && refreshed.ids[0] === 'work');
// A different profile that happens to reuse an id is added under a fresh one.
const clash = M.applyImport(store(), [profile('work', { name: 'Someone else' })], freshId);
check('import · a different profile with a taken id gets a fresh id',
  clash.store.profiles.length === 5 && clash.ids[0] === 'fresh-1' && clash.store.profiles[0].name === 'work');
// New profiles are appended; the active profile and trigger state are untouched.
const added = M.applyImport(store({ activeId: 'music', source: 'game', revertTo: 'work' }), [profile('stream')], freshId);
check('import · adds options without choosing one',
  added.store.profiles.length === 5 && added.store.activeId === 'music' && added.store.source === 'game' && added.store.revertTo === 'work');
check('import · nothing to import leaves the store untouched', M.applyImport(store(), [], freshId).store === store() || M.applyImport(store(), [], freshId).ids.length === 0);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
console.log('ALL PASS');

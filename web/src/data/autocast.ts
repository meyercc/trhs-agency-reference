/**
 * Autocast's fixture (TH-509, docs/autocast-demo-plan.md): the simulated
 * game session the clipping skill records, the moments it flags, and how a
 * typed request becomes a clip plan. Pure — no React, no store, no assets —
 * so the scripts, the store and the verify suite (through esbuild) all read
 * the same numbers.
 *
 * Ported from the colleague's userscript demo (treehouse-autocast,
 * autocast-nova-skill.js, 2026-10-28); the moments, captions and crops are
 * its, the session length its 68:14.
 */

/** The game the demo records when none is playing — the catalog id (data/games.ts). */
export const AUTOCAST_GAME = 'cyberpunk';

/** The simulated session's length in game seconds, and how long it takes on screen at `compressed`. */
export const SESSION_SECONDS = 68 * 60 + 14;
export const SESSION_REAL_MS = 15_000;
/** Armed → the game "launches" on its own after this (800 ms when the plan says "this session"). */
export const WAIT_FOR_GAME_MS = 5_000;
export const WAIT_FOR_GAME_NOW_MS = 800;
/** The "Adding Autocast…" bar. */
export const INSTALL_MS = 1_900;
/** Per clip while cutting: reframe/trim, then caption. */
export const CUT_STEP_MS = 260;
export const CAPTION_STEP_MS = 240;

export interface Moment {
  /** Session second it happened at. */
  at: number;
  label: string;
  /** The caption burned onto the clip. */
  caption: string;
  /** 0–100: how worth keeping. The best `count` are kept. */
  hype: number;
}

/** What Autocast flags during the session, in session order. */
export const MOMENTS: readonly Moment[] = [
  { at: 212, label: 'Mantis blade double', caption: 'TWO DOWN. ONE BLADE.', hype: 78 },
  { at: 498, label: 'Car chase near-miss', caption: 'THREADED THE NEEDLE', hype: 64 },
  { at: 771, label: 'Sandevistan takedown ×3', caption: "TIME STOPS. THEY DON'T.", hype: 94 },
  { at: 1090, label: 'Rooftop headshot', caption: '200M. ONE SHOT.', hype: 88 },
  { at: 1385, label: 'Quickhack chain ×4', caption: 'FOUR HACKS. ZERO ALARMS.', hype: 91 },
  { at: 1622, label: 'Grenade bounce kill', caption: 'BANK SHOT', hype: 57 },
  { at: 1904, label: 'Clutch revive escape', caption: '1 HP. STILL HERE.', hype: 83 },
  { at: 2310, label: 'Monowire combo', caption: 'WHIP IT.', hype: 72 },
  { at: 2655, label: 'Bike jump over barricade', caption: 'AIRBORNE', hype: 61 },
  { at: 3011, label: 'Boss finisher', caption: 'LIGHTS OUT.', hype: 97 },
  { at: 3420, label: 'Silent takedown streak ×5', caption: 'NOBODY HEARD A THING', hype: 86 },
  { at: 3902, label: 'Last-second extraction', caption: 'OUT WITH 0:01 LEFT', hype: 80 },
];

/**
 * How a clip is "cut" from the game's art: where the frame sits at the start
 * and the end of the clip (background-position) and how far in it is
 * (background-size, %). The player pans between the two.
 */
export interface Crop {
  from: string;
  to: string;
  size: number;
}
export const CROPS: readonly Crop[] = [
  { from: '42% 35%', to: '50% 40%', size: 175 },
  { from: '68% 40%', to: '60% 30%', size: 210 },
  { from: '50% 58%', to: '55% 48%', size: 190 },
  { from: '74% 25%', to: '66% 35%', size: 230 },
  { from: '38% 62%', to: '46% 54%', size: 200 },
  { from: '58% 22%', to: '50% 30%', size: 220 },
  { from: '46% 46%', to: '52% 52%', size: 185 },
  { from: '64% 70%', to: '58% 62%', size: 205 },
  { from: '40% 22%', to: '48% 30%', size: 215 },
  { from: '72% 58%', to: '64% 50%', size: 195 },
  { from: '55% 40%', to: '47% 46%', size: 240 },
  { from: '36% 42%', to: '44% 48%', size: 180 },
];

export type ClipAspect = '9:16' | '16:9' | '1:1';

export interface ClipPlan {
  count: number;
  seconds: number;
  aspect: ClipAspect;
  /** Your next session, or the one you are in. */
  when: 'next' | 'now';
  /** What the sentence left out and the plan filled in. */
  assumed: ('count' | 'length' | 'format')[];
}

export const PLAN_DEFAULTS: Pick<ClipPlan, 'count' | 'seconds' | 'aspect'> = { count: 5, seconds: 15, aspect: '9:16' };

const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1 };

/** A clip word AND a session word make it a clip request: "record 8 highlights from my next game". */
const CLIP_WORD = /\b(clip|clips|highlight|highlights|record|recording|capture|reel|reels|shorts?)\b/;
const SESSION_WORD = /\b(game|gaming|session|match|play|playing|tonight|next|round|raid|stream)\b/;

/**
 * The clip plan a sentence asks for, or null when it is not asking for clips.
 * Reads a count, a length and a format; what it does not say is filled from
 * the defaults and named in `assumed`, so the reply can say "I filled in …".
 */
export function parsePlan(text: string): ClipPlan | null {
  const s = text.toLowerCase();
  if (!CLIP_WORD.test(s) || !(SESSION_WORD.test(s) || /\bautocast\b/.test(s))) return null;
  const plan: ClipPlan = { ...PLAN_DEFAULTS, when: 'next', assumed: [] };
  const c = s.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:[a-z0-9:]+\s+){0,3}?(?:highlights?|clips?|videos?|moments?|shorts?|reels?)\b/);
  if (c) plan.count = Math.min(12, Math.max(1, WORDNUM[c[1]] ?? parseInt(c[1], 10)));
  else plan.assumed.push('count');
  const d = s.match(/\b(\d{1,3})\s*-?\s*(?:s|sec|secs|second|seconds)\b/);
  if (d) plan.seconds = Math.min(60, Math.max(3, parseInt(d[1], 10)));
  else plan.assumed.push('length');
  if (/9\s*[:x×/]\s*16|vertical|portrait|tiktok|shorts|reels/.test(s)) plan.aspect = '9:16';
  else if (/16\s*[:x×/]\s*9|landscape|widescreen|horizontal/.test(s)) plan.aspect = '16:9';
  else if (/1\s*[:x×/]\s*1|square/.test(s)) plan.aspect = '1:1';
  else plan.assumed.push('format');
  if (/\b(right now|this session|current (game|session)|already playing)\b/.test(s)) plan.when = 'now';
  return plan;
}

/** "yes", "add it", "go ahead" — the consent, typed. */
export const YES = /^(y|yes|yeah|yep|yup|sure|ok|okay|go|go ahead|do it|add it|add autocast|please|sounds good|let'?s do it|agree|i agree)\b/i;
export const NO = /^(n|no|nope|not now|cancel|never ?mind|skip)\b/i;

/** The moments flagged by a point in the session — their indices into `MOMENTS`, in order. */
export function flaggedAt(sessionSeconds: number): number[] {
  return MOMENTS.map((m, i) => (m.at <= sessionSeconds ? i : -1)).filter((i) => i >= 0);
}

/** The best `count` of the flagged moments (by hype), back in session order. */
export function keepOf(flagged: readonly number[], count: number): number[] {
  return [...flagged]
    .sort((a, b) => MOMENTS[b].hype - MOMENTS[a].hype)
    .slice(0, count)
    .sort((a, b) => a - b);
}

/** 0:00 · 12:34 · 1:08:14 */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const r = s % 60;
  return (h ? `${h}:` : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(r).padStart(2, '0');
}

/** "1h 8m" · "45m" */
export function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return (h ? `${h}h ` : '') + `${m}m`;
}

export const aspectWord = (a: ClipAspect): string => ({ '9:16': '9:16 vertical', '16:9': '16:9 widescreen', '1:1': '1:1 square' })[a];

/** "0:06" — a clip's length as the tile and the player show it. */
export const fmtClipLen = (seconds: number): string => `0:${String(seconds).padStart(2, '0')}`;

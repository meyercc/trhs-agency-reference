// ══════════════════════════════════════════════════════════════════════════
// Forge listings — the converted concept data plus the Agent Catalog's agents,
// and the pure maths the store ranks and rates them by.
//
// The agents are folded in, not copied: their copy still lives in
// `agents/registry.ts` (Nova names its replies through `AGENT_BY_ID`), and this
// file only gives each one the store fields an agent never had — a type, a
// Forge category, a tone and some illustrative counts.
// ══════════════════════════════════════════════════════════════════════════
import type { IconName } from '../components';
import { AGENTS, AGENT_BY_ID, type AgentCategory, type AgentDef } from '../agents/registry';
import { FORGE_DATA } from './listings.data';
import type { ForgeCategory, ForgeCategoryDef, ForgeListing, ForgeTone, ForgeType } from './types';

export const FORGE_TYPES: Record<ForgeType, string> = { app: 'App', skill: 'Skill', recipe: 'Recipe', assistant: 'Assistant' };
export const FORGE_TYPE_HELP: Record<ForgeType, string> = {
  app: 'A full application with its own window',
  skill: 'A recipe plus tools that can act on your PC or accounts',
  recipe: 'Plain-language instructions Nova follows; no code',
  assistant: 'A ready-made assistant with its own personality and skills',
};

/** The browsable categories, in nav order. Discover and Yours lead the nav ahead of these. */
export const FORGE_CATEGORIES: ForgeCategoryDef[] = [
  { id: 'find', label: 'Find games', icon: 'library' },
  { id: 'together', label: 'Play together', icon: 'game-mode' },
  { id: 'better', label: 'Get better', icon: 'target' },
  { id: 'stream', label: 'Stream & create', icon: 'stream' },
  { id: 'tune', label: 'Tune my PC', icon: 'performance' },
  { id: 'gear', label: 'Lights & gear', icon: 'lights' },
  { id: 'deals', label: 'Deals & news', icon: 'shop' },
  { id: 'community', label: 'Community', icon: 'chat-support' },
  { id: 'family', label: 'Family & comfort', icon: 'emoji' },
  // Not `library` again: Find games already wears it, and two identical marks
  // in one nav name two different places.
  { id: 'lore', label: 'Lore & music', icon: 'audio' },
];
export const forgeCategoryLabel = (id: ForgeCategory) => FORGE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

// ── Agents → listings ───────────────────────────────────────────────────────
const AGENT_CAT: Record<string, ForgeCategory> = {
  'backlog-triage': 'find',
  'catch-me-up': 'find',
  'clip-keeper': 'stream',
  'setup-assistant': 'gear',
  // Lore & music held two soundtrack recipes and no credits one.
  'who-made-this': 'lore',
};
const AGENT_CAT_BY_CATEGORY: Record<AgentCategory, ForgeCategory> = {
  performance: 'tune',
  personalization: 'gear',
  play: 'find',
  shop: 'deals',
  support: 'tune',
};
const AGENT_TONE: Record<AgentCategory, ForgeTone> = {
  performance: 'red',
  personalization: 'purple',
  play: 'green',
  shop: 'yellow',
  support: 'blue',
};
/** "updated 2 days ago" → 2. The registry stores the wording, the store sorts by days. */
function daysFrom(updated: string): number {
  if (/yesterday/.test(updated)) return 1;
  if (/today/.test(updated)) return 0;
  const n = Number(updated.match(/(\d+)/)?.[1] ?? 1);
  if (/week/.test(updated)) return (/last/.test(updated) ? 1 : n) * 7;
  if (/month/.test(updated)) return (/last/.test(updated) ? 1 : n) * 30;
  return n;
}
/** A small deterministic generator, so an agent's counts are the same on every load. */
function seeded(id: string) {
  let seed = id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 233280, 7);
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
function fromAgent(a: AgentDef): ForgeListing {
  const rnd = seeded(a.id);
  const dl = Math.round(20000 + rnd() * 120000);
  const listing: ForgeListing = {
    id: a.id,
    agentId: a.id,
    name: a.name,
    pub: a.publisher,
    pubKind: 'official',
    type: a.type,
    cat: AGENT_CAT[a.id] ?? AGENT_CAT_BY_CATEGORY[a.category],
    icon: a.icon,
    tone: AGENT_TONE[a.category],
    summary: a.tagline,
    dl,
    dl30: Math.round(dl * (0.12 + rnd() * 0.15)),
    saves: Math.round(dl * (0.05 + rnd() * 0.06)),
    likes: Math.round(dl * (0.06 + rnd() * 0.08)),
    up: Math.round(dl * (0.03 + rnd() * 0.03)),
    down: Math.round(10 + rnd() * 120),
    ver: a.version,
    upd: daysFrom(a.updated),
    isNew: !!a.isNew,
    featured: !!a.recommended,
    games: ['Any game'],
    access: a.access.map((x) => ({ icon: x.icon, label: x.label, note: x.note ?? '' })),
    desc: a.description,
    does: a.capabilities,
    asks: a.commands.map((c) => `"${c}"`),
    risk: 'It acts on what is listed under What it can touch, so a wrong call changes something real.',
    mit: 'It says what it is about to do before it changes anything, and every change can be undone.',
    side: a.access.some((x) => x.icon === 'link-on') ? 'Contacts outside services; changes settings with your OK' : 'Changes settings with your OK',
    tier: 'core',
    src: 'agent',
  };
  return listing;
}

/**
 * The concept already carried most agents as listings, under its own short
 * ids and with the store's fields filled in properly (a type, a trust card).
 * Those keep the concept's store content and take the agent's id, so Nova's
 * `agentId`s and the catalog's old `?agent=` links still resolve — and its
 * name, type and version, which the registry owns (2026-10-26: the store and
 * Nova had drifted to different versions). An agent the concept never listed
 * is converted from the registry instead. verify-agents holds them together.
 */
const CONCEPT_AGENT: Record<string, string> = {
  framedoc: 'frame-doctor',
  thermal: 'thermal-warden',
  lightdir: 'lighting-director',
  backlog: 'backlog-triage',
  'catch-me-up': 'catch-me-up',
  dealwatch: 'deal-watcher',
  driver: 'driver-concierge',
  setup: 'setup-assistant',
  // TH-484: the concept already listed this recipe under the agent's own id.
  'did-i-just-waste-my-money': 'did-i-just-waste-my-money',
  // TH-509: the featured concept IS the clipping skill Nova hands sessions to.
  autocast: 'autocast',
};

const CONCEPT: ForgeListing[] = FORGE_DATA.map((d) => {
  const agentId = CONCEPT_AGENT[d.id];
  return {
    ...d,
    ...(agentId && {
      id: agentId,
      agentId,
      src: 'agent' as const,
      name: AGENT_BY_ID[agentId].name,
      type: AGENT_BY_ID[agentId].type,
      ver: AGENT_BY_ID[agentId].version,
    }),
    icon: d.icon as IconName,
    access: d.access.map((x) => ({ ...x, icon: x.icon as IconName })),
  };
});
const listed = new Set(Object.values(CONCEPT_AGENT));

export const FORGE_LISTINGS: ForgeListing[] = [...CONCEPT, ...AGENTS.filter((a) => !listed.has(a.id)).map(fromAgent)];
export const FORGE_BY_ID: Record<string, ForgeListing> = Object.fromEntries(FORGE_LISTINGS.map((l) => [l.id, l]));
/** The hero's subject. */
export const FORGE_FEATURED_ID = 'autocast';

// ── Engagement maths ──────────────────────────────────────────────────────
/** What this browser has done to a listing — the overlay on its illustrative counts. */
export interface ForgeMine {
  added: boolean;
  saved: boolean;
  liked: boolean;
  vote: -1 | 0 | 1;
  rating?: number;
}

export const isLater = (l: ForgeListing) => l.tier === 'later';

export function counts(l: ForgeListing, m: ForgeMine) {
  return {
    dl: l.dl + (m.added ? 1 : 0),
    saves: l.saves + (m.saved ? 1 : 0),
    likes: l.likes + (m.liked ? 1 : 0),
    up: l.up + (m.vote === 1 ? 1 : 0),
    down: l.down + (m.vote === -1 ? 1 : 0),
  };
}
export const score = (l: ForgeListing, m: ForgeMine) => {
  const c = counts(l, m);
  return c.up - c.down;
};
/** The last 30 days, not lifetime — the Trending rule note says so in words. */
export const trend = (l: ForgeListing, m: ForgeMine) => {
  const c = counts(l, m);
  return l.dl30 + c.saves * 3 + c.likes * 2 + (c.up - c.down) * 5 + (l.upd < 7 ? 2000 : 0) - (isLater(l) ? 50000 : 0);
};

const RCACHE: Record<string, number[]> = {};
/** An illustrative 1–5 star histogram, index 0 = one star. Nothing for unreleased listings. */
function ratingBase(l: ForgeListing): number[] | null {
  if (isLater(l)) return null;
  if (RCACHE[l.id]) return RCACHE[l.id];
  const rnd = seeded(l.id);
  const v = l.up + l.down;
  const p = l.up / Math.max(1, v);
  const n = Math.max(9, Math.round(v * (0.55 + rnd() * 0.35)));
  const mu = Math.max(2.8, Math.min(5.3, 3.7 + 1.6 * rnd() + (p - 0.95) * 6));
  const w = [1, 2, 3, 4, 5].map((k) => Math.exp(-Math.pow(k - mu, 2) / 0.9) + (k === 1 ? 0.02 : 0));
  const sw = w.reduce((a, b) => a + b, 0);
  return (RCACHE[l.id] = w.map((x) => Math.max(Math.round((n * x) / sw), Math.round(n * 0.004))));
}
export function ratingStats(l: ForgeListing, mine?: number) {
  const b = ratingBase(l);
  if (!b) return null;
  const d = b.slice();
  if (mine) d[mine - 1]++;
  const n = d.reduce((a, x) => a + x, 0);
  const sum = d.reduce((a, x, i) => a + x * (i + 1), 0);
  return { d, n, avg: n ? sum / n : 0 };
}
/** Bayesian average: a handful of 5-star ratings can't beat thousands of 4.7s. */
export const weightedRating = (l: ForgeListing, mine?: number) => {
  const r = ratingStats(l, mine);
  return r ? (r.avg * r.n + 3.8 * 150) / (r.n + 150) : 0;
};

export const fmtCount = (n: number) =>
  Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.abs(n) >= 1e5 ? Math.round(n / 1e3) + 'K' : n.toLocaleString('en-US');

/** The card's count: 27.4K, not 27,400 — the stats row has to fit one line at
 *  --fg-card-min. The detail aside keeps the exact figures. */
export const fmtCompact = (n: number) => {
  const a = Math.abs(n);
  const one = (x: number) => x.toFixed(1).replace(/\.0$/, '');
  return a >= 1e6 ? one(n / 1e6) + 'M' : a >= 1e4 ? one(n / 1e3) + 'K' : n.toLocaleString('en-US');
};

export const updatedText = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

/** The download trend for the detail aside — illustrative, seeded per listing. */
export function downloadSeries(l: ForgeListing, range: 'all' | '30d' | '7d') {
  const n = range === '7d' ? 7 : range === '30d' ? 30 : 52;
  const rnd = seeded(l.id + range);
  const values = Array.from({ length: n }, (_, i) => Math.max(0.05, (range === 'all' ? (i / n) * 0.7 + 0.3 : 0.65) + (rnd() - 0.5) * 0.35));
  const total = range === '7d' ? Math.round(l.dl30 / 4.3) : range === '30d' ? l.dl30 : l.dl;
  return { values, total };
}

const HANDLES = ['NightOwl_GG', 'pixelpanda', 'r4zorFox', 'LowPingLuna', 'mossy_tank', 'Kestrel77', 'quietqueue', 'BunnyHopBen', 'ClutchOrKick', 'sable.wav', 'tiltproof', 'ArcadeMoth'];
export interface ForgeReview {
  who: string;
  stars: number;
  text: string;
  days: number;
  ver: string;
  helpful: number;
}
/** Three illustrative reviews whose tone follows the listing's average. */
export function sampleReviews(l: ForgeListing): ForgeReview[] {
  const r = ratingStats(l);
  if (!r) return [];
  const rnd = seeded(l.id + 'reviews');
  const d1 = l.does[1] ?? l.does[0] ?? 'The main feature';
  const g = l.games[0] ?? 'my games';
  const T: [number, string][] = [
    [5, 'Works exactly as described. Set it up once and forgot about it.'],
    [4, `Best part for me: ${d1.charAt(0).toLowerCase() + d1.slice(1)}. I'd like a bit more control over the defaults.`],
    [5, 'Nova asked before it changed anything, which I appreciated. Runs fine on my OMEN.'],
    [3, `Does the job, but it took a couple of tries to get right with ${g}.`],
    [2, 'Worked for a week, then needed setting up again after an update.'],
  ];
  const pick = r.avg >= 4.4 ? [0, 1, 2] : r.avg >= 3.8 ? [1, 0, 3] : [3, 1, 4];
  const h0 = Math.floor(rnd() * HANDLES.length);
  return pick.map((k, i) => ({ who: HANDLES[(h0 + i * 5) % HANDLES.length], stars: T[k][0], text: T[k][1], days: Math.floor(rnd() * 40) + i * 3 + 1, ver: l.ver, helpful: Math.floor(rnd() * 180) + 4 }));
}

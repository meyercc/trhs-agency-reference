/**
 * "Did I Just Waste My Money" — the agent demo's fixture (TH-484,
 * docs/refund-window-demo-plan.md).
 *
 * What the app knows about your recent purchases: where you bought each one,
 * when, for how much, and how long you have played it — and each store's
 * refund rule. Pure, no React, so the verify suite, Nova's scripts and the
 * Home card all read the same rows and the same maths.
 *
 * The rules (checked 2026-10-20 against each store's own policy page; the
 * agent states them as fact, so re-check them before press):
 *   · Steam — within 14 days of purchase AND under 2 hours played.
 *   · Epic  — within 14 days AND under 2 hours, for titles marked refundable.
 *   · GOG   — within 30 days, even if played; Support reviews each request.
 *
 * Time is fixed. `REFUND_NOW` is the demo's "now", the CATCH_UP_NOW pattern,
 * and purchases are dated relative to it, so "2 days ago" holds on any machine
 * on any day. The UI shows days and minutes, never a calendar date. Playtime
 * at the demo's start is `playedMin`; the live clock (state/Playtime.tsx) adds
 * to it while a game is being played.
 */

export const REFUND_NOW = new Date(2026, 9, 20, 20, 0);

export type StoreId = 'steam' | 'epic' | 'gog';

export interface StoreRule {
  id: StoreId;
  name: string;
  /** Where space is short — a widget row. */
  short: string;
  /** Days from purchase the window stays open. */
  days: number;
  /** Playtime, in minutes, the window allows — `null` when playtime does not count. */
  minutes: number | null;
  /** The exact way to ask, in order. */
  steps: string[];
  /** Where the request starts. Opened in a new tab, never inside the app. */
  url: string;
  /** One sentence the agent adds about how this store decides. */
  note: string;
}

export const STORES: Record<StoreId, StoreRule> = {
  steam: {
    id: 'steam',
    name: 'Steam',
    short: 'Steam',
    days: 14,
    minutes: 120,
    steps: [
      'Open Steam Support and choose Purchases.',
      'Pick the game from your recent purchases.',
      'Choose “I would like a refund”, then “I’d like to request a refund”.',
      'Pick a reason — “It doesn’t run well on my PC” is one of them — and submit.',
    ],
    url: 'https://help.steampowered.com/',
    note: 'Steam refunds any game for any reason inside the window, to your Steam Wallet or the card you paid with.',
  },
  epic: {
    id: 'epic',
    name: 'Epic Games Store',
    short: 'Epic',
    days: 14,
    minutes: 120,
    steps: [
      'Open your Epic account and go to Transactions.',
      'Find the purchase and expand it.',
      'Choose Request refund and pick a reason.',
    ],
    url: 'https://www.epicgames.com/account/transactions',
    note: 'Epic only refunds titles marked refundable; this one is.',
  },
  gog: {
    id: 'gog',
    name: 'GOG',
    short: 'GOG',
    days: 30,
    minutes: null,
    steps: ['Open your GOG Order History.', 'Find the order.', 'Choose “Ask for a refund” and say why.'],
    url: 'https://www.gog.com/account/settings/orders',
    note: 'GOG gives you 30 days even if you have played it; Support reviews each request.',
  },
};

export interface Purchase {
  /** A `GAMES` id (data/games.ts). */
  gameId: string;
  store: StoreId;
  /** What the person calls it — matched in typed requests. */
  aliases: string[];
  purchasedDaysAgo: number;
  price: number;
  /** Minutes played when the demo starts. */
  playedMin: number;
  /** What this PC saw while it was played — the honest "or fix it first" option. */
  performance?: { summary: string; detail: string };
}

export const PURCHASES: Purchase[] = [
  {
    gameId: 'monsterhunterwilds',
    store: 'steam',
    aliases: ['monster hunter', 'wilds', 'mh wilds', 'mhw'],
    purchasedDaysAgo: 2,
    price: 69.99,
    playedMin: 103,
    performance: {
      summary: 'It has been stuttering on this PC: frame time spikes every few seconds in the open areas.',
      detail:
        'The spikes line up with shader compiling and with VRAM running out at High textures. Dropping textures to Medium and turning on frame generation usually smooths it; Booster can also clear the background load before you launch.',
    },
  },
  { gameId: 'civ7', store: 'epic', aliases: ['civ', 'civilization', 'civ 7', 'civ vii'], purchasedDaysAgo: 5, price: 69.99, playedMin: 40 },
  { gameId: 'baldursgate3', store: 'gog', aliases: ["baldur's gate", 'baldurs gate', 'bg3'], purchasedDaysAgo: 12, price: 59.99, playedMin: 540 },
];

export const PURCHASE_BY_ID: Record<string, Purchase> = Object.fromEntries(PURCHASES.map((p) => [p.gameId, p]));

/** The hero purchase — what the warning watches and the demo launches. */
export const HERO_PURCHASE = PURCHASES[0];

/** The warning fires when this many minutes of playtime are left. */
export const WARN_AT_MIN = 15;

export interface RefundWindow {
  /** Still refundable. */
  open: boolean;
  /** Minutes of playtime left, or `null` when playtime does not count (GOG). */
  minutesLeft: number | null;
  daysLeft: number;
  /** Which limit will close it first, assuming you keep playing. */
  closesBy: 'playtime' | 'days';
}

export function windowFor(p: Purchase, playedMin: number = p.playedMin): RefundWindow {
  const rule = STORES[p.store];
  const daysLeft = Math.max(0, rule.days - p.purchasedDaysAgo);
  const minutesLeft = rule.minutes == null ? null : Math.max(0, rule.minutes - Math.floor(playedMin));
  const open = daysLeft > 0 && (minutesLeft == null || minutesLeft > 0);
  // Days left is wall-clock time; playtime only runs while you play. Playtime
  // closes it first whenever it would run out before the days do.
  const closesBy = minutesLeft != null && minutesLeft < daysLeft * 24 * 60 ? 'playtime' : 'days';
  return { open, minutesLeft, daysLeft, closesBy };
}

/** "1 h 43 min", "17 min", "2 h". */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** A store's limit, in prose: "2 hours". */
export function fmtLimit(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h} ${h === 1 ? 'hour' : 'hours'}` : fmtMinutes(min);
}

export const fmtPrice = (n: number) => `$${n.toFixed(2)}`;

/** The purchase a typed request names, or null. */
export function refundFor(text: string, titles: Record<string, string>): Purchase | null {
  const t = text.toLowerCase();
  return PURCHASES.find((p) => t.includes((titles[p.gameId] ?? '').toLowerCase()) || p.aliases.some((a) => t.includes(a))) ?? null;
}

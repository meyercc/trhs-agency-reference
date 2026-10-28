/**
 * "Did I Just Waste My Money"'s scripts (TH-484, docs/refund-window-demo-plan.md)
 * — built from the fixture, because the reply is the purchase's: its store,
 * its playtime, its days left.
 *
 * Every route is scripted and none carries `refine`, so a configured model is
 * never asked: the rule it quotes and the steps it gives are the checked ones,
 * every time. Tried in `send()` (state/Nova.tsx) right after Catch Me Up (the
 * second entry of `RECIPE_SCRIPTS`); the
 * matchers are narrow — a refund question, a "worth keeping", a "how do I
 * refund" — so the phrases the other scripts own still reach them.
 *
 * Playtime is live (state/Playtime.tsx), so the caller passes `playedMin`:
 * the reply says the minutes left NOW, and the card it carries keeps ticking.
 */
import { HERO_PURCHASE, PURCHASES, PURCHASE_BY_ID, STORES, WARN_AT_MIN, fmtLimit, fmtMinutes, fmtPrice, refundFor, windowFor, type Purchase } from '../data/refunds';
import { newCard } from '../state/overlays';
import { agentCardStep, keepInViewOffers, titleOf } from '../agents/recipeKit';
import type { RecipeScripts } from '../agents/recipeScripts';
import type { RefundRef } from './RefundCard';
import { cardSteps, type NovaScript, type ScriptStep } from './scripts';

export const REFUND_AGENT = 'did-i-just-waste-my-money';

/** The warning's three answers — chips, and matched when typed. */
export const ASK_WORTH = 'Is it worth keeping?';
export const ASK_HOW = 'How do I refund it?';
export const ASK_KEEP = 'Keep playing';

/** The widget's exact title — the suite asserts it. */
export const REFUND_TITLE = 'Refund windows';

const WINDOW = /\b(waste[ds]? my money|wasted? (my )?money on|can i (still )?(get a )?(refund|return)|refund window|still refundable|am i (still )?in the clear|can i return)\b/i;
const HOW = /\bhow (do|can|would) i (get a |ask for a |request a )?(refund|return)\b|\brefund it\b|\brequest a refund\b/i;
const WORTH = /\b(worth keeping|should i keep|is it worth it|keep or refund|refund or keep)\b/i;
const KEEP = /^\s*keep playing\s*$/i;
const FINALE = /\bkeep an eye on (everything|what|anything) i can (still )?(return|refund)\b|\b(what|everything) (can i|i can) (still )?(return|refund)\b|\brefund windows\b/i;

const T = 650;

/** The refund card in a reply — `cards.refund` in the UI recipe. */
const refundStep = (props: RefundRef, delay?: number) => agentCardStep(REFUND_AGENT, 'refund', { ...props }, delay);
const TITLES: Record<string, string> = Object.fromEntries(PURCHASES.map((p) => [p.gameId, titleOf(p.gameId)]));

/**
 * The purchase the conversation is about. A follow-up ("how do I refund it?")
 * names no game, so it means the one just discussed. Module state, as Catch
 * Me Up's `lastRecapped`: it only has to outlive the gap between two sends.
 */
let lastAbout: string = HERO_PURCHASE.gameId;

/** "1 h 45 min of the 2 hours Steam allows" / "9 of GOG's 30 days". */
function standing(p: Purchase, played: number): string {
  const rule = STORES[p.store];
  const w = windowFor(p, played);
  if (!w.open) return `the ${rule.name} refund window for ${titleOf(p.gameId)} has closed`;
  if (w.minutesLeft == null) return `${w.daysLeft} of ${rule.name}’s ${rule.days} days left, and playtime does not count there`;
  return `${fmtMinutes(w.minutesLeft)} of playtime left of the ${fmtLimit(rule.minutes!)} ${rule.name} allows, and ${w.daysLeft} of ${rule.days} days`;
}

/** The monitor's title, on the board and in the HUD alike. */
export const WATCH_TITLE = 'Refund window';

/**
 * Keep the clock in view (Chris, 2026-10-20): the card in the reply, as a Home
 * widget or as an overlay over the game. Both hold the `refund-watch` block,
 * which follows the game being played (or the window closing soonest), so the
 * one you place keeps telling the truth. Minted here, once per reply, so
 * pressing a chip twice re-adds the same thing instead of making two.
 */
function monitorOffers(): ScriptStep[] {
  return keepInViewOffers([{ kind: 'bound', bind: 'refund-watch' }], WATCH_TITLE, 250);
}

function answers(p: Purchase): ScriptStep[] {
  const steps: ScriptStep[] = [];
  if (p.performance) steps.push({ offer: { type: 'ask', text: ASK_WORTH }, label: ASK_WORTH, delay: 250 });
  steps.push({ offer: { type: 'ask', text: ASK_HOW }, label: ASK_HOW, delay: p.performance ? 0 : 250 });
  return steps;
}

/** "Did I just waste my money on Monster Hunter Wilds?" — where you stand. */
function windowScript(p: Purchase, played: number): NovaScript {
  const title = titleOf(p.gameId);
  const w = windowFor(p, played);
  const lead = w.open
    ? `You are still in the clear on ${title}: ${standing(p, played)}. You would get the full ${fmtPrice(p.price)} back.`
    : `${standing(p, played)[0].toUpperCase()}${standing(p, played).slice(1)}. ${STORES[p.store].name} can still be asked outside the window, but it is their call.`;
  const why = w.open && w.closesBy === 'playtime' && w.minutesLeft != null && w.minutesLeft <= 30 ? 'Playtime is what will close it, so the clock only runs while you play.' : null;
  return {
    id: `refund-window-${p.gameId}`,
    kind: 'phrase',
    match: [],
    agentId: REFUND_AGENT,
    logText: `Did I Just Waste My Money checked the ${STORES[p.store].name} window on ${title}`,
    steps: [
      { say: lead, typing: T },
      refundStep({ gameId: p.gameId, section: 'window' }, 250),
      ...(why ? [{ say: why, delay: 250, typing: 400 } as ScriptStep] : []),
      ...(w.open ? answers(p) : []),
      ...(w.open ? monitorOffers() : []),
    ],
  };
}

/** "Is it worth keeping?" — what the agent can see, and the honest alternative. */
function worthScript(p: Purchase, played: number): NovaScript {
  const title = titleOf(p.gameId);
  const perf = p.performance;
  return {
    id: `refund-worth-${p.gameId}`,
    kind: 'phrase',
    match: [],
    agentId: REFUND_AGENT,
    logText: `Did I Just Waste My Money weighed keeping ${title}`,
    steps: perf
      ? [
          { say: `Only you can say whether you are enjoying it, and not enjoying it is reason enough to refund. What I can see is the other half: ${perf.summary.charAt(0).toLowerCase()}${perf.summary.slice(1)}`, typing: T },
          { say: `${perf.detail} If you want to try that first, you have ${fmtMinutes(windowFor(p, played).minutesLeft ?? 0)} of window left to decide.`, delay: 250, typing: 500 },
          { offer: { type: 'openModal', id: 'booster' }, label: 'Try fixing the stutter with Booster', delay: 250 },
          { offer: { type: 'ask', text: ASK_HOW }, label: ASK_HOW },
        ]
      : [
          { say: `Only you can say whether you are enjoying ${title}, and not enjoying it is reason enough. It has run fine on this PC, so that is not the problem. You have ${standing(p, played)}.`, typing: T },
          { offer: { type: 'ask', text: ASK_HOW }, label: ASK_HOW, delay: 250 },
        ],
  };
}

/** "How do I refund it?" — the store's exact steps and its page. */
function howScript(p: Purchase, played: number): NovaScript {
  const rule = STORES[p.store];
  const title = titleOf(p.gameId);
  const w = windowFor(p, played);
  const host = rule.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return {
    id: `refund-how-${p.gameId}`,
    kind: 'phrase',
    match: [],
    agentId: REFUND_AGENT,
    logText: `Did I Just Waste My Money gave the ${rule.name} refund steps for ${title}`,
    steps: [
      {
        say: w.open
          ? `${rule.note} Here is how, while you still have ${w.minutesLeft != null ? fmtMinutes(w.minutesLeft) + ' of playtime' : w.daysLeft + ' days'}. I cannot file it for you, but it takes about a minute.`
          : `The window has closed, but you can still ask. ${rule.note} Here is how.`,
        typing: T,
      },
      refundStep({ gameId: p.gameId, section: 'steps' }, 250),
      { offer: { type: 'openUrl', url: rule.url }, label: `Open ${rule.name} refunds (${host})`, delay: 250 },
    ],
  };
}

function keepScript(p: Purchase, played: number): NovaScript {
  const w = windowFor(p, played);
  return {
    id: `refund-keep-${p.gameId}`,
    kind: 'phrase',
    match: [],
    agentId: REFUND_AGENT,
    logText: `Did I Just Waste My Money stood down on ${titleOf(p.gameId)}`,
    steps: [
      {
        say:
          w.open && w.minutesLeft != null
            ? `Understood. I will stay quiet. You have ${fmtMinutes(w.minutesLeft)} before the window closes; if you change your mind, ask me how to refund it.`
            : 'Understood. I will stay quiet.',
        typing: 450,
      },
    ],
  };
}

/** The finale: Nova composes the Home card from one sentence — the ordinary card reply. */
function finaleScript(playedMin: (id: string) => number): NovaScript {
  const open = PURCHASES.filter((p) => windowFor(p, playedMin(p.gameId)).open);
  const names = open.map((p) => `${titleOf(p.gameId)} on ${STORES[p.store].name}`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? 'nothing';
  // Three columns, as Catch Me Up's finale: at two, each title and its line clip
  // (measured on the board 2026-10-20).
  const spec = { ...newCard([{ kind: 'bound', bind: 'refunds', count: PURCHASES.length }], REFUND_TITLE), span: 3 };
  return {
    id: `refund-finale:${spec.id}`,
    kind: 'phrase',
    match: [],
    agentId: REFUND_AGENT,
    logText: `Did I Just Waste My Money built ${REFUND_TITLE} from your purchases`,
    steps: [
      { say: `You can still return ${open.length} ${open.length === 1 ? 'game' : 'games'}: ${list}. Here is a card that keeps each window in view, with the time it has left.`, typing: T },
      ...cardSteps({ spec, unavailable: [], absent: [], better: [], insteadOf: [], guessed: false }),
    ],
  };
}

/**
 * The unprompted warning (`speak()`): fifteen minutes of playtime left. The
 * three answers are chips, so a player mid-session presses rather than types.
 */
export function warningScript(gameId: string, playedMin: number): NovaScript {
  const p = PURCHASE_BY_ID[gameId];
  const title = titleOf(gameId);
  const rule = STORES[p.store];
  lastAbout = gameId;
  return {
    id: `refund-warning-${gameId}`,
    kind: 'phrase',
    match: [],
    agentId: REFUND_AGENT,
    logText: `Did I Just Waste My Money warned: ${WARN_AT_MIN} minutes left to refund ${title}`,
    steps: [
      { say: `${WARN_AT_MIN} minutes of playtime left before ${title} can no longer be refunded on ${rule.name}. If you are not sure about it, now is the time to decide. I will not bring it up again.`, typing: T },
      refundStep({ gameId, section: 'window' }, 250),
      ...answers(p),
      { offer: { type: 'ask', text: ASK_KEEP }, label: ASK_KEEP },
      ...monitorOffers(),
    ],
  };
}

/** The warning's toast copy — one place, so the toast and the suite agree. */
export function warningToast(gameId: string, playedMin: number) {
  const p = PURCHASE_BY_ID[gameId];
  const rule = STORES[p.store];
  return {
    title: `${WARN_AT_MIN} minutes left to refund ${titleOf(gameId)}`,
    message: `You have played ${fmtMinutes(playedMin)} of the ${fmtLimit(rule.minutes ?? 0)} ${rule.name} allows.`,
  };
}

/** The scripted reply for a refund sentence, or null to let the others try. */
export function refundScriptFor(text: string, playedMin: (id: string) => number): NovaScript | null {
  const t = text.trim();
  if (!t) return null;
  if (FINALE.test(t)) return finaleScript(playedMin);
  const named = refundFor(t, TITLES);
  const about = (named ?? PURCHASE_BY_ID[lastAbout])!;
  const go = (p: Purchase) => {
    lastAbout = p.gameId;
    return p;
  };
  if (KEEP.test(t)) return keepScript(about, playedMin(about.gameId));
  if (WORTH.test(t)) return worthScript(go(about), playedMin(about.gameId));
  if (HOW.test(t)) return howScript(go(about), playedMin(about.gameId));
  // The window question needs a purchase named — "can I return" alone could be anything.
  if (WINDOW.test(t) && named) return windowScript(go(named), playedMin(named.gameId));
  return null;
}

/** The refund agent in the manifest's routing layer (agents/recipeScripts.ts). */
export const refundScripts: RecipeScripts = {
  id: REFUND_AGENT,
  scriptFor: (text, ctx) => refundScriptFor(text, ctx.playedMin),
  examples: ['Did I just waste my money on Monster Hunter Wilds?', 'How do I refund Monster Hunter Wilds?', 'Keep an eye on everything I can still return'],
};

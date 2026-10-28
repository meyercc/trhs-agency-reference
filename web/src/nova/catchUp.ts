/**
 * Catch Me Up's scripts (TH-478, docs/catch-me-up-demo-plan.md) — built from
 * the fixture rather than written into the SCRIPTS table, because the reply
 * is the game's: its days away, its marker, the updates that touched its build.
 *
 * Every route is scripted and none carries `refine`, so a configured model is
 * never asked: on a press stage the reply is the same, on time, every time,
 * and the spoiler check in verify-catch-up covers everything it can say.
 *
 * Tried FIRST in `send()` (state/Nova.tsx), as the first entry of
 * `RECIPE_SCRIPTS`. The matchers are narrow on purpose — a recap needs a game
 * named, a follow-up needs "my build" — so the phrases the other scripts own
 * still reach them.
 */
import { CATCH_UP, CATCH_UP_BY_ID, catchUpFor, daysAway, type CatchUpEntry } from '../data/catchUp';
import { newCard } from '../state/overlays';
import { agentCardStep, keepInViewOffers, titleOf } from '../agents/recipeKit';
import type { RecipeScripts } from '../agents/recipeScripts';
import type { RecapRef } from './RecapCard';
import { cardSteps, type NovaScript, type ScriptStep } from './scripts';

export const CATCH_UP_AGENT = 'catch-me-up';

/** The follow-up chip's question, also matched when typed. */
export const ASK_BUILD = 'How does that affect my build?';

const RECAP = /\b(catch me up|caught up on|recap|where (did|was) i (leave|left) off|where was i)\b/i;
const FINALE = /\bkeep me caught up\b|\b(everything|every game|games?) i['’]?ve drifted from\b|\b(everything|games?) i (have )?drifted from\b/i;
const DEEPER = /\b(affects?|affected|changed?) my build\b|\bexplain the perks\b|\bwhat happened to my perks\b/i;

const T = 700;

/** The recap card in a reply — `cards.recap` in the UI recipe. */
const recapStep = (props: RecapRef, delay?: number) => agentCardStep(CATCH_UP_AGENT, 'recap', { ...props }, delay);

/**
 * The game the last recap was about. A follow-up — "how does that affect my
 * build?" — names no game, so it means the one just recapped. Module state,
 * not React: it only has to outlive the gap between two sends.
 */
let lastRecapped: string = CATCH_UP[0].gameId;

/**
 * Keep the recap in view (Chris, 2026-10-20), as the refund agent does: the
 * summary recap as a Home widget or an overlay over the game. Both hold the
 * `catch-up-recap` block with the GAME as its subject, so what is placed keeps
 * showing the game it was made for. Minted once per reply.
 */
function monitorOffers(e: CatchUpEntry): ScriptStep[] {
  return keepInViewOffers([{ kind: 'bound', bind: 'catch-up-recap', subject: e.gameId }], `${titleOf(e.gameId)} recap`);
}

function offersFor(e: CatchUpEntry): ScriptStep[] {
  return [
    { offer: { type: 'resumeGame', gameId: e.gameId }, label: 'Resume where I left off', delay: 300 },
    // The backlight is the visible half of Resume: the keyboard's photo board
    // on Play, lit by the profile the game links to.
    { offer: { type: 'navigate', to: `/play?playing=${e.gameId}&sku=origins-65` }, label: 'Show my keyboard' },
    ...monitorOffers(e),
  ];
}

function recapScript(e: CatchUpEntry): NovaScript {
  const title = titleOf(e.gameId);
  const days = daysAway(e);
  const hitsBuild = e.changes.find((c) => c.affectsBuild);
  const updates = e.changes.length;
  return {
    id: `catch-up-${e.gameId}`,
    kind: 'phrase',
    match: [],
    agentId: CATCH_UP_AGENT,
    logText: `Catch Me Up read your ${title} save and ${updates} ${updates === 1 ? 'update' : 'updates'} since`,
    steps: [
      { say: `Welcome back. It has been ${days} days since you last played ${title}, so here is where you are — and nothing past where you stopped.`, typing: T },
      recapStep({ gameId: e.gameId, section: 'all' }, 300),
      hitsBuild
        ? { say: `One thing before you go back in: ${hitsBuild.title}. ${hitsBuild.impact}`, delay: 300, typing: 500 }
        : { say: 'None of the updates since then change how you play.', delay: 300, typing: 450 },
      ...(hitsBuild ? [{ offer: { type: 'ask', text: ASK_BUILD }, label: ASK_BUILD, delay: 300 } as ScriptStep] : []),
      ...offersFor(e),
    ],
  };
}

function deeperScript(e: CatchUpEntry): NovaScript {
  return {
    id: `catch-up-build-${e.gameId}`,
    kind: 'phrase',
    match: [],
    agentId: CATCH_UP_AGENT,
    logText: `Catch Me Up explained what changed for your ${e.build.name} build`,
    steps: [
      { say: e.deeper.build, typing: T },
      recapStep({ gameId: e.gameId, section: 'build' }, 300),
      ...offersFor(e),
    ],
  };
}

/** The widget's exact title — the suite asserts it. */
export const CATCH_UP_TITLE = 'Pick Up Where You Left Off';

/**
 * The finale: Nova composes the widget from one sentence. The card itself is
 * the ordinary card reply (`cardSteps`) — the same preview, "Add to
 * dashboard" and "Take it off" every composed card gets — so the only new
 * thing on stage is what it holds.
 */
function finaleScript(): NovaScript {
  const titles = CATCH_UP.map((e) => `${titleOf(e.gameId)} (${daysAway(e)} days)`);
  const list = `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
  // Three columns: at the default two the title wraps and each row's line is
  // cut to its first clause (measured on the board 2026-10-19).
  const spec = { ...newCard([{ kind: 'bound', bind: 'catch-up', count: CATCH_UP.length }], CATCH_UP_TITLE), span: 3 };
  return {
    id: `catch-up-finale:${spec.id}`,
    kind: 'phrase',
    match: [],
    agentId: CATCH_UP_AGENT,
    logText: `Catch Me Up built ${CATCH_UP_TITLE} from your library`,
    steps: [
      { say: `You have drifted from ${CATCH_UP.length} games: ${list}. Here is a card that keeps all of them in reach, each with where you were and what changed.`, typing: T },
      ...cardSteps({ spec, unavailable: [], absent: [], better: [], insteadOf: [], guessed: false }),
    ],
  };
}

/** The scripted reply for a Catch Me Up sentence, or null to let the others try. */
export function catchUpScriptFor(text: string): NovaScript | null {
  const t = text.trim();
  if (!t) return null;
  if (FINALE.test(t)) return finaleScript();
  if (DEEPER.test(t)) {
    const e = catchUpFor(t) ?? CATCH_UP_BY_ID[lastRecapped];
    return e ? deeperScript(e) : null;
  }
  if (RECAP.test(t)) {
    const e = catchUpFor(t);
    if (!e) return null;
    lastRecapped = e.gameId;
    return recapScript(e);
  }
  return null;
}

/** Catch Me Up in the manifest's routing layer (agents/recipeScripts.ts). */
export const catchUpScripts: RecipeScripts = {
  id: CATCH_UP_AGENT,
  scriptFor: (text) => catchUpScriptFor(text),
  examples: ['Catch me up on Cyberpunk 2077', 'keep me caught up on everything I’ve drifted from'],
};

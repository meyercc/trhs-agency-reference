/**
 * Autocast's scripts (TH-509, docs/autocast-demo-plan.md) — the clipping
 * skill Nova hands your game session to. Every route is scripted and none
 * carries `refine`: the plan, the session and the clips are the fixture's.
 *
 * Two voices. Before the skill is added, NOVA speaks (`pitchFor`): it cannot
 * clip on its own, it names Autocast in Forge and offers to add it, and the
 * consent — a chip or a typed "yes" — adds it through Forge's own Add
 * (`confirms`). From then on AUTOCAST speaks (`scriptFor`), by phase: the
 * launch, the end of the session, the decision. The stages that arrive on
 * their own (the game launching, the session ending, the clips landing) are
 * the same scripts, spoken by the watcher (app/AutocastWatch.tsx) into the
 * conversation the request was made in.
 *
 * Every chip is an `ask` of the line the person could have typed, so the
 * chip and the keyboard are one route and the label lands in the log as
 * their turn. Fourth in `RECIPE_SCRIPTS`: its matchers need a clip word AND a
 * session word, or the skill's name, so the other recipes' lines never
 * reach it.
 */
import { AUTOCAST_GAME, NO, YES, fmtDur, parsePlan, type ClipPlan } from '../data/autocast';
import { agentCardStep, recipeScript, titleOf } from '../agents/recipeKit';
import type { RecipeCtx, RecipeScripts } from '../agents/recipeScripts';
import type { NovaActionCall, NovaScript, ScriptStep } from './scripts';

export const AUTOCAST_AGENT = 'autocast';
/** What Forge shows and the "added" card says. */
export const AUTOCAST_VERSION = '1.4.0';

const T = 650;

/** The demo's own line — the quick prompt; the game panel's row builds the same shape. */
export const EXAMPLE_REQUEST = 'Record 8 highlight videos of 6 seconds in 9:16 format from my next game session';
/** The game panel's row (TH-504): the plan's defaults, for one game. */
export const askClips = (gameId: string) => `Record 5 highlight clips of 15 seconds from my next ${titleOf(gameId)} session`;

// The chips' words — typed, they route to the same scripts.
export const ADD = 'Add Autocast';
export const NOT_NOW = 'Not now';
export const LAUNCH = 'Launch game now';
export const END = 'End session now';
export const APPROVE_ALL = 'Approve all';
export const DISCARD_ALL = 'Discard all';
export const REVIEW = 'Review one by one';

const NAME = /\bauto\s?cast\b/i;
const LAUNCH_RE = /^launch (the )?game( now)?$/i;
const END_RE = /\b(end|stop|finish)\b.*\b(session|game|recording)\b|\bi'?m done\b/i;
const APPROVE_RE = /^(approve( them| all)?|looks good|ship (it|them))\b/i;
const DISCARD_RE = /^discard( them| all)\b/i;
const STOP_RE = /^(stop|remove|turn off) autocast\b/i;
const RESET_RE = /^reset autocast( demo)?$/i;

/**
 * The plan the pitch offered, waiting on a "yes". Module state, as Who Made
 * This's `lastAbout`: the consent names no plan, so it means the one just
 * offered.
 */
let pendingPlan: ClipPlan | null = null;

const card = (name: string, props: Record<string, unknown> = {}, delay?: number) => agentCardStep(AUTOCAST_AGENT, name, props, delay);
const ask = (text: string, label = text, delay?: number): ScriptStep => ({ offer: { type: 'ask', text }, label, ...(delay != null ? { delay } : {}) });
type Op = Extract<NovaActionCall, { type: 'autocast' }>['op'];
const confirms = (op: Op, label: string, plan?: ClipPlan): NovaScript['confirms'] => ({ call: { type: 'autocast', op, ...(plan ? { plan } : {}) }, label });

const assumedNote = (plan: ClipPlan) => (plan.assumed.length ? ` I filled in ${plan.assumed.join(', ')} — tell me if you want something different.` : '');

/** Nova's: "I can line that up, but clipping needs Autocast." */
function pitchScript(plan: ClipPlan): NovaScript {
  pendingPlan = plan;
  return {
    id: 'autocast-pitch',
    kind: 'phrase',
    match: [],
    logText: 'Nova offered Autocast for a clip request',
    steps: [
      // One paragraph: a reply's text is drawn above its cards (ChatMessage), so
      // the question cannot follow the plan — it closes the paragraph instead.
      { say: `I can line that up. Clipping is not something I do on my own — it needs Autocast, a clipping skill from Forge. It records locally while you play, picks the moments worth keeping and cuts them for you.${assumedNote(plan)} Here is the plan — add Autocast to Nova to run it?`, typing: T },
      card('plan', { plan }, 250),
      ask(ADD, ADD, 250),
      ask(NOT_NOW),
    ],
  };
}

/** What Autocast is — Nova's before it is added, its own after. */
function explainScript(added: boolean): NovaScript {
  return {
    id: 'autocast-explain',
    kind: 'phrase',
    match: [],
    ...(added ? { agentId: AUTOCAST_AGENT } : {}),
    logText: added ? 'Autocast explained itself' : 'Nova explained Autocast',
    steps: [
      {
        say: added
          ? 'I am a clipping skill from Forge. Hand me a clip request and I watch your game locally, mark the moments worth keeping and cut them into short clips. You see them here; nothing posts without you.'
          : 'Autocast is a clipping skill from Forge. Once it is added to me, I can hand it a clip request: it watches your game locally, marks the moments worth keeping and cuts them into short clips. You see the clips here; nothing posts without you.',
        typing: T,
      },
      { say: added ? 'Ask me for clips and I will set it up.' : 'Try asking for clips from your next game.', delay: 250, typing: 400 },
      ask(EXAMPLE_REQUEST, 'Record 8 highlights, 6 s, 9:16', 250),
    ],
  };
}

function declineScript(): NovaScript {
  pendingPlan = null;
  return {
    id: 'autocast-decline',
    kind: 'phrase',
    match: [],
    logText: 'Autocast stays off',
    steps: [{ say: 'No problem. Autocast stays off. Ask again whenever you want clips.', typing: 500 }],
  };
}

/** Autocast's first words: added, and armed for the session. `confirms` has already added it. */
function consentScript(plan: ClipPlan, gameId: string): NovaScript {
  pendingPlan = null;
  return {
    ...recipeScript(AUTOCAST_AGENT, 'autocast-armed', 'Autocast was added and armed', [
      { say: 'Adding me to Nova…', typing: 400 },
      card('added', {}, 150),
      {
        say: `You are set. Start ${titleOf(gameId)} whenever you are ready — I pick it up on my own and put your ${plan.count} clips here when you finish. You do not need to keep this open.`,
        delay: 250,
        typing: T,
      },
      ask(LAUNCH, LAUNCH, 250),
    ]),
    confirms: confirms('arm', ADD, plan),
  };
}

/** Already added and idle: the plan, armed at once. */
function reofferScript(plan: ClipPlan, gameId: string): NovaScript {
  return {
    ...recipeScript(AUTOCAST_AGENT, 'autocast-rearmed', 'Autocast took a clip plan', [
      { say: `On it.${assumedNote(plan)} Here is the plan — start ${titleOf(gameId)} whenever you are ready and I will put the clips here when you finish.`, typing: T },
      card('plan', { plan }, 250),
      ask(LAUNCH, LAUNCH, 250),
    ]),
    confirms: confirms('arm', 'Armed Autocast', plan),
  };
}

/** The game launched — typed or pressed (`confirms`), or on its own (the watcher, no `confirms`). */
export function launchScript(gameId: string, typed: boolean): NovaScript {
  const s = recipeScript(AUTOCAST_AGENT, 'autocast-recording', `Autocast started recording ${titleOf(gameId)}`, [
    { say: `${titleOf(gameId)} just launched. I am recording.`, typing: 500 },
    card('live', {}, 150),
    ask(END, END, 250),
  ]);
  return typed ? { ...s, confirms: confirms('launch', LAUNCH) } : s;
}

/** The session is over: what was marked, and the cut. */
export function endScript(gameId: string, plan: ClipPlan, sessionSeconds: number, marked: number, typed: boolean): NovaScript {
  const keeping = Math.min(plan.count, marked);
  const s = recipeScript(AUTOCAST_AGENT, 'autocast-cutting', 'Autocast is cutting the clips', [
    {
      say: `Good session — ${fmtDur(sessionSeconds)} of ${titleOf(gameId)}, ${marked} ${marked === 1 ? 'moment' : 'moments'} marked. Cutting your best ${keeping} into ${plan.seconds}-second ${plan.aspect} clips.`,
      typing: 500,
    },
    card('cutting', {}, 150),
  ]);
  return typed ? { ...s, confirms: confirms('end', END) } : s;
}

/** The clips landed (the watcher's). */
export function readyScript(count: number): NovaScript {
  return recipeScript(AUTOCAST_AGENT, 'autocast-ready', `Autocast delivered ${count} clips`, [
    { say: `Your ${count} ${count === 1 ? 'highlight is' : 'highlights are'} ready. Tap any clip to watch it. They are on this PC only — nothing has been posted.`, typing: 500 },
    card('clips', {}, 150),
    ask(APPROVE_ALL, APPROVE_ALL, 250),
    { offer: { type: 'openModal', id: 'autocast-clip', params: { i: '0' } }, label: REVIEW },
    ask(DISCARD_ALL),
  ]);
}

/** The review is over: what was kept. `op` when the line was the decision; null after the player's last review. */
export function finishScript(gameId: string, approved: number, op: 'approveAll' | 'discardAll' | null): NovaScript {
  const when = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const s = recipeScript(AUTOCAST_AGENT, 'autocast-done', approved ? `Autocast saved ${approved} clips to Gallery` : 'Autocast discarded the clips', [
    {
      say: approved
        ? `Done — ${approved} ${approved === 1 ? 'clip' : 'clips'} approved and saved to Gallery under ${titleOf(gameId)} · ${when}. Nothing has been posted.`
        : 'All clips discarded. Nothing was saved or posted.',
      typing: 500,
    },
    { say: 'I stay added. Ask me for clips any time, or say "stop Autocast" to turn me off.', delay: 250, typing: 400 },
  ]);
  return op ? { ...s, confirms: confirms(op, op === 'approveAll' ? APPROVE_ALL : DISCARD_ALL) } : s;
}

function busyScript(plan: ClipPlan, phase: RecipeCtx['autocast']['phase']): NovaScript {
  return recipeScript(AUTOCAST_AGENT, 'autocast-busy', 'Autocast is already on a session', [
    { say: `I am already on your ${phase === 'armed' ? 'next' : 'current'} session with ${plan.count} clips at ${plan.seconds} s. I will drop them here when it finishes.`, typing: 500 },
  ]);
}

function stopScript(): NovaScript {
  return {
    ...recipeScript(AUTOCAST_AGENT, 'autocast-stopped', 'Autocast was turned off', [
      { say: 'I am off and removed from Nova. Any clips already saved stay in Gallery.', typing: 500 },
    ]),
    confirms: confirms('stop', 'Stop Autocast'),
  };
}

function resetScript(): NovaScript {
  return {
    ...recipeScript(AUTOCAST_AGENT, 'autocast-reset', 'Autocast demo reset', [{ say: 'Reset, and removed. Ask Nova for clips from your next game to start again.', typing: 400 }]),
    confirms: confirms('reset', 'Reset Autocast'),
  };
}

/** NOVA's words about a skill that is not added. */
function autocastPitchFor(text: string): NovaScript | null {
  const t = text.trim();
  if (!t) return null;
  if (pendingPlan && YES.test(t)) return consentScript(pendingPlan, AUTOCAST_GAME);
  if (pendingPlan && NO.test(t)) return declineScript();
  const plan = parsePlan(t);
  if (plan) return pitchScript(plan);
  if (NAME.test(t)) return explainScript(false);
  return null;
}

/** AUTOCAST's words, by where its session is. */
function autocastScriptFor(text: string, ctx: RecipeCtx): NovaScript | null {
  const t = text.trim();
  if (!t) return null;
  // A context without the session (an older suite's) reads as idle.
  const { phase, plan, gameId, sessionSeconds, marked, kept } = ctx.autocast ?? IDLE_SNAPSHOT;
  const game = gameId ?? AUTOCAST_GAME;
  if (RESET_RE.test(t)) return resetScript();
  if (STOP_RE.test(t)) return stopScript();
  if (phase === 'armed' && LAUNCH_RE.test(t)) return launchScript(game, true);
  if (phase === 'recording' && plan && END_RE.test(t)) return endScript(game, plan, sessionSeconds, marked, true);
  if (phase === 'ready' && APPROVE_RE.test(t)) return finishScript(game, kept, 'approveAll');
  if (phase === 'ready' && DISCARD_RE.test(t)) return finishScript(game, 0, 'discardAll');
  const asked = parsePlan(t);
  if (asked) {
    if ((phase === 'armed' || phase === 'recording' || phase === 'cutting') && plan) return busyScript(plan, phase);
    return reofferScript(asked, AUTOCAST_GAME);
  }
  if (NAME.test(t)) return explainScript(true);
  return null;
}

const IDLE_SNAPSHOT: RecipeCtx['autocast'] = { phase: 'idle', plan: null, gameId: null, sessionSeconds: 0, marked: 0, kept: 0 };

export const autocastScripts: RecipeScripts = {
  id: AUTOCAST_AGENT,
  pitchFor: (text) => autocastPitchFor(text),
  scriptFor: (text, ctx) => autocastScriptFor(text, ctx),
  examples: [EXAMPLE_REQUEST, 'What is Autocast?'],
};

/**
 * The scripted interactions — what Nova says and does for the prompts it
 * knows. A plain table, deliberately: the copy is the product here, and it is
 * edited in this file, not in a component. Anything the table does not match
 * goes to the local model when one is configured, and otherwise to the
 * `demo-mode` reply at the bottom.
 *
 * Voice: OMEN AI's. Plain, concrete, one change at a time. It says what it
 * can do and hands over the button; it never does it uninvited.
 *
 * A step is one of:
 *   { say }   — a reply paragraph. `typing` is how long the dots show first;
 *               `delay` is the pause before this step. Both at "compressed"
 *               speed, scaled by SPEED[demoSpeed].
 *   { offer } — something Nova can do in the app, offered as a chip under the
 *               reply. Pressing the chip performs it; the reply itself never
 *               navigates, opens a modal or switches a profile. Until TH-435
 *               (2026-10-02) this step was `act` and it DID: the page moved
 *               out from under the person mid-sentence, which was the most
 *               jarring thing in the first build. Copy must not claim to be
 *               opening anything — it points at the chip.
 *   { control } — a LIVE control inside the reply (TH-437): the real
 *               brightness slider, fan curve, EQ presets, DPI, power mode —
 *               bound to the same state as everywhere else in the app, so
 *               moving it here IS moving it there. The reply names the device
 *               it bound to. Pair it with an { offer } to the full window.
 *   { pause } — a beat.
 */
import type { DemoSpeed } from '../state/Nova';
import type { MvpScope } from '../state/Settings';
import { bindingOfItem, type CardSpec, type OverlayControl, type OverlayItem, type OverlaySpec } from '../state/overlays';

/** Items a card could hold but this install cannot bind, with the one reason they share (TH-450). */
export interface AbsentGroup {
  /** Lower-case labels: "volume", "mic monitoring". */
  labels: string[];
  /** The clause: "there is no headset on this desk". */
  reason: string;
}

/** What `cardSteps` needs from a parsed request (nova/cardBuilder.ts). */
export interface CardRequestLike {
  spec: CardSpec | null;
  unavailable: string[];
  absent: AbsentGroup[];
  better: string[];
  insteadOf: string[];
  guessed: boolean;
  /** Words the parser did not read (TH-450) — admitted when no model is there to read them. */
  leftover?: string[];
  /** The model's own first sentence (TH-452), already guarded — shown in place of the templated opening. */
  note?: string;
}
import { META_BY_ID, type BoardItem } from '../widgets/catalog';
import { nameFor, type LayoutContext } from '../widgets/layout';

/**
 * The live controls a reply can carry (controls/LiveControl.tsx) — every bound
 * control a card can hold (TH-450) — plus the three built things previewed in
 * the bubble: `overlay` (TH-439), `layout` (TH-442) and `card` (TH-443) — and
 * `agent-card`, a card a Nova recipe draws (Catch Me Up's recap, the refund
 * agent's window), rendered from the recipe's own `cards` (agents/recipes.tsx).
 */
export type NovaControlKind = OverlayControl | 'overlay' | 'layout' | 'card' | 'agent-card';

/**
 * Which recipe card an `agent-card` control shows, and with what. Data only —
 * the message persists, and the card is rebuilt from the recipe when the log
 * renders — so `props` must be plain JSON.
 */
export interface AgentCardRef {
  /** The recipe's agent id (`AGENT_BY_ID`). */
  agent: string;
  /** A key of that recipe's `cards`. */
  card: string;
  props: Record<string, unknown>;
}

export type NovaActionCall =
  | { type: 'navigate'; to: string }
  | { type: 'openModal'; id: string; params?: Record<string, string> }
  | { type: 'selectProfile'; id: 'gaming' | 'work' | 'silent' }
  /** Put a built overlay on screen (or bring a hidden one back) — TH-439. */
  | { type: 'placeOverlay'; spec: OverlaySpec }
  | { type: 'removeOverlay'; id: string }
  /**
   * Replace the home dashboard's arrangement (TH-442). The whole array rides on
   * the call, exactly as `placeOverlay` carries its whole spec — so the chip
   * performs what was offered rather than re-deriving it, and an old
   * conversation's chip still means what it meant when it was written.
   */
  | { type: 'applyLayout'; items: BoardItem[] }
  /** The undo, holding the arrangement that was there before. */
  | { type: 'restoreLayout'; items: BoardItem[] }
  /**
   * Put a card Nova composed on the board (TH-443). The whole spec rides on the
   * call for the same reason `placeOverlay`'s does: the chip performs what was
   * previewed, and a conversation reopened next week still means it.
   */
  | { type: 'addCard'; spec: CardSpec }
  /** The undo — off the board, the way the cell's own ✕ is. The spec stays. */
  | { type: 'takeCardOff'; id: string }
  /**
   * Put ONE catalog widget on the board, keeping everything already there.
   *
   * Deliberately not `applyLayout` with a one-item array: that call is a
   * REPLACEMENT — its merge keeps only the widgets a proposal could not see
   * (hidden ones), so a single-item proposal would delete every visible widget
   * on the board. "Add Storage" wiping someone's dashboard is exactly the kind
   * of quiet catastrophe the offer-don't-act rule exists to prevent, and the
   * chip label would have promised the opposite.
   */
  | { type: 'addWidget'; id: string }
  /**
   * Ask Nova the next question (TH-478) — a follow-up the presenter clicks
   * instead of types. It sends `text` as if typed; nothing in the app moves.
   */
  | { type: 'ask'; text: string }
  /**
   * Pick a game back up (TH-478): its linked profile applies (the Game Link
   * rule, `gameLaunched`), then Play opens on it.
   */
  | { type: 'resumeGame'; gameId: string }
  /**
   * Open a page outside the app in a new tab (TH-484) — a store's refund page.
   * The one action that leaves the app, so it is always an offer with the
   * destination in its label, never something a reply does by itself.
   */
  | { type: 'openUrl'; url: string }
  /**
   * Autocast's session (TH-509): arm the plan (which adds the skill from
   * Forge), launch the game, end the session, decide the clips, stop. The
   * shell's handler moves the store (state/Autocast.tsx); `convId` is stamped
   * by `send()` so the stages land in the conversation the request was made
   * in — the store ref is stale during the very send that created it.
   */
  | { type: 'autocast'; op: 'arm' | 'launch' | 'end' | 'approveAll' | 'discardAll' | 'stop' | 'reset'; plan?: import('../data/autocast').ClipPlan; convId?: string };

export type ScriptStep =
  | { say: string; delay?: number; typing?: number }
  | { offer: NovaActionCall; label: string; delay?: number }
  | { control: NovaControlKind; spec?: OverlaySpec; card?: CardSpec; layout?: BoardItem[]; agentCard?: AgentCardRef; delay?: number }
  | { pause: number };

export type ScriptKind = 'pill' | 'topic' | 'phrase' | 'system';

/** What a structured model call would be asked to improve (TH-444). */
export type RefineKind = 'widget' | 'layout';

export interface NovaScript {
  id: string;
  kind: ScriptKind;
  /** Chip text for pills and topics; also an exact (case-insensitive) match. */
  label?: string;
  /** Typed-input matchers, tried after the exact label. */
  match: RegExp[];
  steps: ScriptStep[];
  /** The agent who answers, whoever is selected (TH-478) — Catch Me Up speaks its own recap. */
  agentId?: string;
  /** The activity feed's line for this run, in place of "answered “…”". */
  logText?: string;
  /**
   * This reply answers a line that IS the press (TH-509): "yes" to an offer,
   * "end session now", "approve all". `send()` performs the call before the
   * reply runs and logs it as a chip press would — the person's own doing,
   * typed — so the rule that a reply never acts by itself (TH-435) holds:
   * nothing navigates, nothing moves the page. A recipe sets it only on the
   * scripts its own chips (`ask` offers with the same words) would have run.
   */
  confirms?: { call: NovaActionCall; label: string };
  /**
   * Set when the builder could not read the WHOLE sentence and a
   * schema-constrained model call could do better (TH-444). The provider takes
   * the structured path when this is present and a local model is configured,
   * and falls back to these steps on any failure.
   *
   * Two shapes. A GUESS — the kind of request was recognised and none of its
   * content — has no `seed`. A PARTLY-READ one (TH-450) carries what the regex
   * did read as `seed`: "a widget with my discord and my fps" found `fps`, and
   * before this that made it "not a guess", so Discord was silently dropped.
   * The model reads the whole sentence; the seed is kept as certain and its
   * additions are appended, so the reply is never slower AND emptier.
   *
   * Since TH-453 it is set on every built card and every overlay that names
   * something. A fully-read sentence carries `readAll`: its items are settled
   * and the model supplies only the title and the sentence. The bubble shows
   * `built` as a preview meanwhile, so the wait is never an empty bubble.
   */
  refine?: {
    kind: RefineKind;
    /** A card on the board or a HUD over the game — the sentence decided (TH-452). */
    surface?: 'card' | 'overlay';
    seed?: OverlayItem[];
    absent?: AbsentGroup[];
    /**
     * The parser read every substantive word (TH-453): the model's additions
     * and its `unavailable` are not read, only its title and sentence.
     * Measured 2026-10-06 on six fully-read sentences: the additions were never
     * useful and once wrong; the titles and sentences were good every time.
     */
    readAll?: boolean;
    /**
     * The spec the deterministic reply minted — shown at once as a preview
     * while the model composes, and the id the model's card keeps, so the card
     * in the bubble never jumps and "Add" adds one thing (TH-453).
     */
    built?: CardSpec | OverlaySpec;
  };
}

/**
 * What an item IS, by its registry row rather than its legacy kind (TH-452): a
 * reading, a control the person can move, or a panel from the app.
 */
function roleOf(i: OverlayItem): 'reading' | 'control' | 'panel' {
  const b = bindingOfItem(i);
  if (!b) return i.kind === 'metric' ? 'reading' : i.kind === 'block' ? 'panel' : 'control';
  if (b.source.kind === 'block') return 'panel';
  if (b.source.kind === 'vitals' || b.source.kind === 'series' || b.source.kind === 'nova') return 'reading';
  return 'control';
}

/** Multiplier on every delay. `instant` collapses the whole run to one tick. */
export const SPEED: Record<DemoSpeed, number> = { compressed: 1, fast: 0.5, instant: 0 };

const T = 700; // the usual typing beat

/** The classic corner readout — what "overlay" with nothing named builds. */
export const DEFAULT_OVERLAY: OverlaySpec = {
  id: 'ov-default',
  title: 'FPS overlay',
  items: [{ kind: 'metric', metric: 'fps' }, { kind: 'metric', metric: 'cpu-temp' }, { kind: 'metric', metric: 'gpu-temp' }],
  x: 24,
  y: 96,
  visible: true,
  createdAt: 0,
};

/**
 * The reply for a built overlay (TH-439): what it holds, how placing works,
 * then the preview with the live numbers and the chip that puts it on screen.
 * Shared by the Overlay pill and by every typed request, so one copy.
 */
/**
 * The shared layout reply (TH-442): what was arranged, the diagram, then the
 * offer — and only then, after it is applied, the undo.
 *
 * The widget NAMES go in the prose, not only in the diagram. At 380px in the
 * pinned panel a diagram cell is ~40px and its label ellipses to nothing, so the
 * diagram carries the shape and the sentence carries the content. Neither is
 * load-bearing alone.
 *
 * It offers and does not act (TH-435). Replacing someone's whole dashboard
 * uninvited is the strongest case for that rule there is.
 */
export function layoutSteps(req: { name: string; why: string; items: BoardItem[]; note?: string }, prev: readonly BoardItem[], ctx?: LayoutContext): ScriptStep[] {
  // `nameFor`, so a proposal naming a card Nova composed reads as its title
  // rather than as `card-m8x1q4` (TH-443).
  const names = req.items.map((i) => nameFor(i.id, ctx));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return [
    // The model's own sentence when it wrote one — it is asked to name the
    // widgets, which is what the prose has to carry at 380px (below).
    { say: req.note ? req.note : `A ${req.name} board: ${list}. ${req.why.charAt(0).toUpperCase()}${req.why.slice(1)}.`, typing: T },
    { say: 'Here is how it would sit. Nothing moves until you say so.', delay: 300, typing: 450 },
    { control: 'layout', layout: req.items },
    { offer: { type: 'applyLayout', items: req.items }, label: 'Use this layout', delay: 300 },
    // The undo carries the board that was really there, so it restores rather
    // than recomputes. Offered up front because the moment to want it is the
    // moment after pressing Apply, not a scroll back up the log.
    { offer: { type: 'restoreLayout', items: [...prev] }, label: 'Put it back' },
  ];
}

export function overlaySteps(spec: OverlaySpec, note?: string): ScriptStep[] {
  const metrics = spec.items.filter((i) => roleOf(i) === 'reading').length;
  const controls = spec.items.filter((i) => roleOf(i) === 'control').length;
  const blocks = spec.items.filter((i) => roleOf(i) === 'panel').length;
  const what = listOf(
    [
      metrics ? 'live readouts, drawn over the game without touching its settings' : '',
      controls ? (controls > 1 ? 'controls you can use without leaving the game' : 'a control you can use without leaving the game') : '',
      blocks ? (blocks > 1 ? 'panels from the app' : 'a panel from the app') : '',
    ].filter(Boolean),
  );
  // Only a readout has numbers to vouch for; a controls-only HUD saying so was
  // claiming a kinship with System Vitals it did not have (TH-450).
  const numbers = metrics ? ' \u2014 the numbers are the system\u2019s own, the same ones System Vitals shows' : '';
  return [
    // The model's own sentence when it wrote one (TH-452); the template otherwise.
    { say: note ?? `Here is your ${spec.title}: ${what}. It is a small card${numbers}.`, typing: T },
    { say: 'Place it, then drag it by its grip to anywhere on the screen; it stays where you leave it, and its \u00d7 hides it. The grip takes the arrow keys too.', delay: 400, typing: 500 },
    { control: 'overlay', spec },
    { offer: { type: 'placeOverlay', spec }, label: 'Place on screen', delay: 300 },
    { offer: { type: 'navigate', to: '/perform' }, label: 'Open Performance' },
  ];
}

/**
 * The reply for a card request (TH-443) — the board's answer to
 * `overlaySteps`, and deliberately parallel to it: the same vocabulary, the
 * same "here it is, nothing is placed yet", the same preview of the REAL thing.
 *
 * The difference worth saying out loud is where it lives. An overlay floats over
 * the game and is about not leaving it; a card sits on the dashboard and is
 * about what you see when you arrive. So the copy names the board, and the undo
 * chip is offered up front — the moment to want it is the moment after pressing
 * Add, not a scroll back up the log (`layoutSteps` learned that first).
 *
 * THREE SHAPES, because a card request has three honest answers:
 *
 *  - **A card.** What it holds, the preview, the chips.
 *  - **A card plus an admission.** They asked for something a card cannot hold
 *    — storage, battery, the network — so the reply says so IN THE SAME BREATH
 *    and offers the widget that does show it. Half an answer stated plainly
 *    beats a whole answer to a question nobody asked.
 *  - **No card at all.** Everything they named is already a designed widget.
 *    Composing a generic one would be the system competing with itself.
 *
 * And when nothing was named, the card is a GUESS and says so. "Build me a
 * widget" has to produce a widget — but the reply then lists what else can go on
 * one, which is how the vocabulary gets taught without a prompt reciting it.
 */
function listOf(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}

/**
 * What a card can hold, said in one breath — built from the tables so it can
 * never promise a control that was removed or omit one that was added (TH-450).
 * Three clauses, because the three kinds are three different promises: a
 * reading is watched, a control is moved, a panel is the app's own.
 */
export const CARD_KINDS = 'live readings, controls bound to your devices and settings, and panels from the app';
/**
 * What a card can hold, said in one breath. A SUMMARY by group rather than
 * every label: the registry (`state/bindings.ts`) is sixty rows and growing,
 * and a sentence that recites sixty labels teaches nothing (TH-452). The model's
 * own request carries the full list, where it costs no reading time.
 */
export const CARD_VOCAB =
  'live readings (frame rate, temperatures, clocks, memory, network and drives), controls bound to your devices and settings (volume and mic levels, equalizer, DPI and polling, lighting, power mode, brightness, spatial audio, theme, accent, wallpaper, the display’s picture and more), Nova’s own totals (tokens, cloud cost, energy), and panels from the app (recent games, deals, tokenomics, Nova and the games you have drifted from)';

/**
 * "I left out volume and mic monitoring — there is no headset on this desk."
 * One sentence per reason, said before the preview so the gap is never
 * something the person has to notice for themselves (TH-450).
 */
function absentSteps(absent: AbsentGroup[]): ScriptStep[] {
  return absent.map((a) => ({ say: `I left out ${listOf(a.labels)} \u2014 ${a.reason}.`, delay: 300, typing: 450 }));
}

export function cardSteps(req: CardRequestLike): ScriptStep[] {
  const { spec, unavailable, absent, better, insteadOf, guessed } = req;
  const widgets = insteadOf.map((id) => META_BY_ID[id]?.name ?? id);
  const offers: ScriptStep[] = insteadOf.map((id, i) => ({ offer: { type: 'addWidget', id }, label: `Add ${widgets[i]}` }));

  // Nothing to compose. Three reasons, and they need different sentences: the
  // catalog already covers it (a better answer exists), nothing on this machine
  // does (no answer exists, and saying so is the answer), or everything named
  // binds to a device or module this install does not have.
  if (!spec) {
    if (!unavailable.length && absent.length) {
      return [
        { say: `A card could hold ${listOf(absent.flatMap((a) => a.labels))}, but not on this desk.`, typing: T },
        ...absentSteps(absent),
        { say: 'Plug one in, or add it from the Admin desk roster, and ask again — the card will bind to it.', delay: 300, typing: 450 },
      ];
    }
    const named = listOf(unavailable);
    const Named = `${named.charAt(0).toUpperCase()}${named.slice(1)}`;
    if (!widgets.length) {
      return [
        { say: `A card holds ${CARD_KINDS}. ${Named} is not one of them, and nothing else on this machine reports it either.`, typing: T },
        { say: 'I would rather say so than put a tile there that only looks like it is measuring something.', delay: 300, typing: 450 },
      ];
    }
    return [
      { say: `A card holds ${CARD_KINDS}. ${Named} is not one of them, but ${widgets.length > 1 ? 'these widgets already show' : `the ${widgets[0]} widget already shows`} it.`, typing: T },
      { say: 'That is the better answer here — it is designed for exactly this, and a card would be a worse version of it.', delay: 300, typing: 450 },
      ...offers,
    ];
  }

  const metrics = spec.items.filter((i) => roleOf(i) === 'reading').length;
  const controls = spec.items.filter((i) => roleOf(i) === 'control').length;
  const panels = spec.items.filter((i) => roleOf(i) === 'panel');
  const parts = [
    metrics ? (metrics > 1 ? 'the readings you asked for, live' : 'the reading you asked for, live') : '',
    controls ? (controls > 1 ? 'controls that work from the card itself' : 'a control that works from the card itself') : '',
    // A panel says what it IS — "the games you played most recently" — because
    // "the app's own panel" told nobody anything (measured 2026-10-04).
    ...panels.map((i) => bindingOfItem(i)?.what ?? bindingOfItem(i)?.label.toLowerCase() ?? 'a panel'),
  ].filter(Boolean);
  const what = listOf(parts);
  // Controls write where their home does, and that is worth saying: a slider on
  // a card that silently went nowhere would be the quiet failure this app
  // specialises in, so the reply names the destination — and names the profile
  // only for a control that really lands there (the lights are a desk setting).
  const toProfile = spec.items.some((i) => bindingOfItem(i)?.profile);
  const where = controls
    ? ` Moving a control here moves it everywhere${toProfile ? ', and a device setting is saved to your active profile' : ''}.`
    : metrics ? ' The numbers are the system\u2019s own, the same ones System Vitals shows.' : '';

  // The model's own sentence leads when it wrote one (TH-452). The templated
  // opening remains for the regex path and for a note the guard rejected.
  const opening: ScriptStep = req.note
    ? { say: `${req.note}${where}`, typing: T }
    : guessed
      ? { say: `Here is a card to start from \u2014 ${spec.title}, live. A card can hold ${CARD_VOCAB}; name the ones you want and I will rebuild it.`, typing: T }
      : { say: `${spec.title} \u2014 ${what}.${where}`, typing: T };

  return [
    opening,
    // Said before the preview, not after, so the gap is never something the
    // person has to notice for themselves.
    ...(unavailable.length
      ? [{
          say: widgets.length
            ? `I could not put ${listOf(unavailable)} on it — that is not one of the readings a card can hold. ${widgets.length > 1 ? 'Those widgets show' : `The ${widgets[0]} widget shows`} it instead.`
            // Nothing in the catalog covers it either. Saying so plainly is the
            // whole point of asking the model for `unavailable`: it names what
            // was asked for in the person's own words, and there is no table of
            // mine that could have anticipated it.
            : `I could not put ${listOf(unavailable)} on it — this machine has no reading for that, so there is nothing honest to show.`,
          delay: 300,
          typing: 500,
        } as ScriptStep]
      : []),
    ...absentSteps(absent),
    { say: 'Add it and it goes to the end of your dashboard, where you can drag, resize and remove it like any other widget. Nothing moves until you say so.', delay: 300, typing: 500 },
    { control: 'card', card: spec },
    // A reading one designed widget shows better. Said AFTER the preview, not
    // before: they asked for a card, so the card is the answer and this is the
    // alternative — leading with it would read as an argument.
    ...(better.length
      ? [{ say: `${listOf(widgets)} ${widgets.length > 1 ? 'are the designed widgets' : 'is the designed widget'} for ${listOf(better.map((b) => b.toLowerCase()))}, with more room than a card gives it \u2014 if you would rather have that.`, delay: 300, typing: 450 } as ScriptStep]
      : []),
    // Words nobody read. Said only here, on the deterministic path: when a model
    // is configured the whole sentence went to it instead (`refine.seed`).
    ...(req.leftover?.length
      ? [{ say: `I did not recognize ${listOf(req.leftover.map((w) => `\u201c${w}\u201d`))}. If that is a reading, a control or a panel, name it the way the app does and I will add it \u2014 or turn on a local model in settings and I will read the whole sentence.`, delay: 300, typing: 450 } as ScriptStep]
      : []),
    { offer: { type: 'addCard', spec }, label: 'Add to dashboard', delay: 300 },
    { offer: { type: 'takeCardOff', id: spec.id }, label: 'Take it off' },
    ...offers,
  ];
}

export const SCRIPTS: NovaScript[] = [
  // ── Quick prompts (the pills, in wireframe order) ─────────────────────
  {
    // The pill is the default build; any typed overlay request is built the
    // same way, from what it names (nova/overlayBuilder.ts, TH-439).
    id: 'overlay',
    kind: 'pill',
    label: 'Overlay',
    match: [/\boverlay\b/i, /\bfps counter\b/i, /\bhud\b/i],
    steps: overlaySteps(DEFAULT_OVERLAY),
  },
  {
    id: 'training-hud',
    kind: 'pill',
    label: 'Training HUD',
    match: [/training hud/i, /\baim (trainer|training)\b/i, /\bpractice\b/i],
    steps: [
      { say: 'The Training HUD is the overlay’s practice mode: it keeps a running tally of the session — time on target, flicks, how your accuracy drifts as you tire — and shows it in the corner so you can see the number change while you play.', typing: T },
      { say: 'It is an OMEN AI feature, so it is on when OMEN AI is on for the game. The button below opens it.', delay: 400, typing: 500 },
      { offer: { type: 'openModal', id: 'omenai' }, label: 'Open OMEN AI', delay: 500 },
    ],
  },
  {
    id: 'omen-ai',
    kind: 'pill',
    label: 'OMEN AI',
    match: [/\bomen ai\b/i, /\boptimi[sz]e (my|the) (game|settings)\b/i, /\bone[- ]click\b/i],
    steps: [
      { say: 'OMEN AI tunes a game for this machine in one pass — graphics settings, power mode and fan curve together — toward a goal you pick: highest frame rate, best image, or quiet. It only touches the game it is on for, and it can put everything back.', typing: T },
      { say: 'Here it is. Pick a goal per game; the target frame rate is the one worth setting by hand.', delay: 400, typing: 500 },
      { offer: { type: 'openModal', id: 'omenai' }, label: 'Open OMEN AI', delay: 500 },
    ],
  },
  {
    id: 'power-modes',
    kind: 'pill',
    label: 'Power modes',
    match: [/power ?modes?/i, /\b(performance|balanced|eco) mode\b/i, /\bgaming profile\b/i],
    steps: [
      { say: 'Power modes are what the profiles carry. Gaming runs the chips at full tilt and lets the fans follow; Work holds a balanced curve; Silent caps power so the fans stay down. A profile can also switch itself when a linked game launches.', typing: T },
      { say: 'The mode itself is here — the same control as the Performance page.', delay: 300, typing: 300 },
      { control: 'power-mode' },
      { offer: { type: 'selectProfile', id: 'gaming' }, label: 'Switch to Gaming', delay: 500 },
      { say: 'Switch with the button below. You will see it change in the switcher at the top right, and in the context panel beside this chat.', delay: 300, typing: 400 },
    ],
  },
  {
    id: 'booster-training',
    kind: 'pill',
    label: 'Booster training',
    match: [/booster/i, /\bfree (up )?memory\b/i, /\bbackground (apps|processes)\b/i],
    steps: [
      { say: 'Booster pauses the background apps that steal frames while a game is running and wakes them when it closes. Training is how it learns which ones: it watches a few sessions, scores what each process cost, and asks before it adds one to the list.', typing: T },
      { say: 'Booster is one press away below. The training list is on its first tab.', delay: 400, typing: 400 },
      { offer: { type: 'openModal', id: 'booster' }, label: 'Open Booster', delay: 500 },
    ],
  },
  {
    id: 'cpu-training',
    kind: 'pill',
    label: 'CPU training',
    match: [/cpu training/i, /\bcpu\b.*\b(learn|train|tune)/i, /\bcore (parking|usage)\b/i],
    steps: [
      { say: 'CPU training lets OMEN AI learn how a game actually loads the processor — which cores it leans on, where the boost clock helps and where it only makes heat — and shape the power limit to match. It takes a couple of sessions per game to settle.', typing: T },
      { say: 'The live picture is in System Vitals, on the CPU tab. Open it below and watch the cores while something runs.', delay: 400, typing: 500 },
      { offer: { type: 'openModal', id: 'vitals' }, label: 'Open System Vitals', delay: 500 },
    ],
  },
  {
    id: 'recorder',
    kind: 'pill',
    label: 'Recorder',
    match: [/\brecord(er|ing)?\b/i, /\bclips?\b/i, /\bcapture\b/i, /\breplay\b/i],
    steps: [
      { say: 'The recorder keeps a rolling buffer of the last few minutes of play, so a clip is one key press after the thing happened rather than before. Clips land in the library next to the game they came from.', typing: T },
      { say: 'If you want it to keep only the thirty seconds worth keeping, the Clip Keeper agent does that. Play, where the clips are, is one press away below.', delay: 400, typing: 500 },
      { offer: { type: 'navigate', to: '/play' }, label: 'Open Play', delay: 600 },
    ],
  },
  {
    id: 'optimus',
    kind: 'pill',
    label: 'Optimus',
    match: [/optimus/i, /\b(hybrid|discrete|integrated) graphics\b/i, /\bgraphics switch/i, /\bmux\b/i],
    steps: [
      { say: 'Optimus is the graphics switch: the integrated GPU drives the desktop and the discrete one wakes for games, which is what makes the battery last. Discrete-only skips the hand-off for a few frames more at the cost of battery; it needs a restart to change.', typing: T },
      { say: 'The switch is on the Performance page under Graphics. Hybrid is the right default unless you are plugged in and chasing the last few frames.', delay: 400, typing: 500 },
      { offer: { type: 'navigate', to: '/perform' }, label: 'Open Performance', delay: 600 },
    ],
  },
  {
    id: 'overclocking',
    kind: 'pill',
    label: 'Overclocking',
    match: [/overclock/i, /\boc\b/i, /\bboost clock\b/i],
    steps: [
      { say: 'Manual overclocking raises the GPU and memory clocks past their rated speed and holds them there. On this notebook it is not exposed — the OMEN 16 VALORANT edition ships without manual OC — so OMEN AI’s per-game tuning is the way to get the same frames without the heat.', typing: T },
      { say: 'OMEN AI is below. Set the goal to highest frame rate for the game you care about and let it find the ceiling.', delay: 400, typing: 500 },
      { offer: { type: 'openModal', id: 'omenai' }, label: 'Open OMEN AI', delay: 500 },
    ],
  },
  {
    id: 'fan-curve',
    kind: 'pill',
    label: 'Fan curve',
    match: [/fan curve/i, /fan speeds?\b/i, /\bfans? (faster|slower|quieter|louder|higher|lower)\b/i, /\bcurve\b/i],
    steps: [
      { say: 'The fan curve is fan speed against temperature: eight stops, and you drag the speed at each. Higher on the left means cooler and louder at idle; higher on the right is what keeps a long session from throttling.', typing: T },
      { say: 'Here it is — the same curve Advanced Tuning edits. Drag a point, or focus one and use the arrow keys.', delay: 300, typing: 400 },
      { control: 'fan-curve' },
      { offer: { type: 'navigate', to: '/perform' }, label: 'Open Performance', delay: 400 },
    ],
  },
  {
    id: 'fan-learning',
    kind: 'pill',
    label: 'Fan learning',
    match: [/fan/i, /\bnoise\b/i, /\bloud\b/i, /\bquiet\b/i, /\bthermal/i],
    steps: [
      { say: 'Fan learning holds a noise target rather than a fan speed. It watches how the room, the dust and the season move the temperatures and shifts the curve underneath to keep the sound where you set it — and tells you when quiet and cool can no longer both be had.', typing: T },
      { say: 'The Thermal Warden agent runs it per profile. The current temperatures and curve are in System Vitals, below.', delay: 400, typing: 500 },
      { offer: { type: 'openModal', id: 'vitals' }, label: 'Open System Vitals', delay: 500 },
    ],
  },
  {
    id: 'launch-game',
    kind: 'pill',
    label: 'Launch Game',
    match: [/launch/i, /\bplay (a|some|my) game\b/i, /\bstart (a|the) game\b/i, /\bwhat should i play\b/i],
    steps: [
      { say: 'Your recent games are at the top of Play, and launching one there applies its linked profile first — power mode, lighting, the lot — before the game starts.', typing: T },
      { say: 'Play is one press away below.', delay: 300, typing: 300 },
      { offer: { type: 'navigate', to: '/play' }, label: 'Open Play', delay: 500 },
    ],
  },

  {
    id: 'brightness',
    kind: 'pill',
    label: 'Brightness',
    match: [/bright/i, /\bdim(mer|\b)/i, /\b(screen|display|monitor) (level|too dark|too bright)/i],
    steps: [
      { say: 'Brightness is per display, and the slider here is the display\u2019s own: it moves the monitor window\u2019s control and the home card together. With display sync on, every screen on the desk follows it.', typing: T },
      { control: 'brightness' },
      { offer: { type: 'navigate', to: '/' }, label: 'Open Home', delay: 400 },
    ],
  },
  {
    id: 'eq-preset',
    kind: 'pill',
    label: 'EQ preset',
    match: [/\beq\b/i, /equali[sz]er/i, /\b(bass|treble)\b/i, /\bsound (profile|preset)\b/i],
    steps: [
      { say: 'The headset\u2019s equalizer is a curve preset applied by Treehouse, not by the headset. Balanced is flat; Gaming lifts the footsteps band; Bass Boost is for music. One you drew yourself shows up in the same list.', typing: T },
      { control: 'eq-preset' },
      { offer: { type: 'navigate', to: '/' }, label: 'Open Home', delay: 400 },
    ],
  },
  {
    id: 'dpi',
    kind: 'pill',
    label: 'DPI',
    match: [/\bdpi\b/i, /\bsensitivity\b/i, /\bmouse (speed|faster|slower)\b/i, /\bcpi\b/i],
    steps: [
      { say: 'DPI is how far the cursor moves per inch of mouse. The five presets are the ones the DPI button cycles; the slider sets anything between. 800 and 1600 are where most people land.', typing: T },
      { control: 'dpi' },
      { offer: { type: 'navigate', to: '/' }, label: 'Open Home', delay: 400 },
    ],
  },

  // ── Topics (the context rail) ─────────────────────────────────────────
  {
    id: 'topic-performance',
    kind: 'topic',
    label: 'Performance',
    match: [/^perf(ormance)?$/i, /\bmake it faster\b/i, /\bmore fps\b/i],
    steps: [
      { say: 'Performance is where the machine is tuned: power modes, the graphics switch, the overlay, and OMEN AI’s per-game settings. The honest order is OMEN AI first, then a power mode, then anything by hand.', typing: T },
      { offer: { type: 'navigate', to: '/perform' }, label: 'Open Performance', delay: 500 },
    ],
  },
  {
    id: 'topic-play',
    kind: 'topic',
    label: 'Play',
    match: [/^play$/i, /\bmy (games|library)\b/i],
    steps: [
      { say: 'Play is the library — what is installed, what you were last in, the clips, and the deals on what you have been watching. A game launched from here carries its profile with it.', typing: T },
      { offer: { type: 'navigate', to: '/play' }, label: 'Open Play', delay: 500 },
    ],
  },
  {
    id: 'topic-personalize',
    kind: 'topic',
    label: 'Personalize',
    match: [/^personali[sz]e$/i, /\blighting\b/i, /\brgb\b/i, /\bwallpaper\b/i],
    steps: [
      { say: 'Personalize is lighting, wallpaper and the quick controls — per profile, so a Gaming scene and a Work scene are different rooms. The Lighting Director agent can build a scene from a game’s art if you would rather not pick colors.', typing: T },
      { offer: { type: 'navigate', to: '/personalize' }, label: 'Open Personalize', delay: 500 },
    ],
  },
  {
    id: 'topic-discover',
    kind: 'topic',
    label: 'Discover',
    match: [/^discover$/i, /\bwhat'?s new\b/i, /\bmodules?\b/i, /\bnew features?\b/i],
    steps: [
      { say: 'Discover is the Module Browser: everything optional in the hub, what each one adds, and what removing it takes away. Nova itself is a module — you are in one now.', typing: T },
      { offer: { type: 'openModal', id: 'modules' }, label: 'Open the Module Browser', delay: 500 },
    ],
  },

  // ── Typed phrases ─────────────────────────────────────────────────────
  {
    id: 'hello',
    kind: 'phrase',
    match: [/^(hi|hello|hey|yo|hiya)\b/i, /^good (morning|afternoon|evening)\b/i],
    steps: [{ say: 'Hello. I am Nova — I know this machine, the devices on the desk and the profile you are in. Ask about any of it, or pick a prompt below.', typing: 500 }],
  },
  {
    id: 'help',
    kind: 'phrase',
    match: [/^help\b/i, /\bwhat can you do\b/i, /\bwhat (do|can) you (know|help)/i, /\bhow does this work\b/i],
    steps: [
      { say: 'I can explain any part of the hub and, where it makes sense, do the thing: open the page, switch the profile, start the tool. The prompts below are the things people ask most; the topics on the right are the rooms I can walk you into.', typing: T },
      { say: 'Anything I do not have a script for goes to a local model if you have one configured in settings — the gear at the top right. Nothing leaves this machine.', delay: 400, typing: 500 },
    ],
  },
  {
    id: 'thanks',
    kind: 'phrase',
    match: [/^(thanks|thank you|ty|cheers)\b/i],
    steps: [{ say: 'Any time.', typing: 300 }],
  },

  // ── System replies ────────────────────────────────────────────────────
  {
    id: 'demo-mode',
    kind: 'system',
    match: [],
    steps: [{ say: 'I do not have a scripted answer for that, and no local model is connected. Turn one on in settings — the gear at the top right — and I will send anything I do not recognize there. Nothing leaves this machine.', typing: 500 }],
  },
  {
    id: 'llm-unreachable',
    kind: 'system',
    match: [],
    steps: [{ say: 'I tried the local model and could not reach it. Check the endpoint in settings — Test connection will say what it sees — and try again.', typing: 400 }],
  },
];

export const SCRIPT_BY_ID: Record<string, NovaScript> = Object.fromEntries(SCRIPTS.map((s) => [s.id, s]));

/**
 * June 2027 leaves out OMEN hardware control: fan curves, power modes,
 * graphics switching, overclocking (deck "Treehouse MVP Modules June 2027",
 * slide 7). These passages offer exactly those controls, so under June they
 * say so instead, and their chips are not offered. OMEN Gaming Hub stays
 * available in June (GSW-24353), which is where an OMEN owner still finds them.
 */
const JUNE_OUT_OF_SCOPE: Record<string, ScriptStep[]> = (() => {
  const notHere = (what: string): ScriptStep => ({
    say: `${what} are not in this version of Treehouse. On an OMEN PC, OMEN Gaming Hub still has them.`,
    typing: T,
  });
  const vitals: ScriptStep[] = [
    { say: 'Temperatures and fan speeds are in System Vitals, below.', delay: 400, typing: 400 },
    { offer: { type: 'openModal', id: 'vitals' }, label: 'Open System Vitals', delay: 500 },
  ];
  return {
    'power-modes': [notHere('Power modes')],
    optimus: [notHere('Graphics switching and the MUX')],
    overclocking: [notHere('Overclocking controls')],
    'fan-curve': [notHere('Fan curves'), ...vitals],
    'fan-learning': [notHere('Fan settings'), ...vitals],
  };
})();

/** OMEN AI as the June deck describes it, without the power mode and fan curve it
 *  no longer touches there (whether it still does in the background is open: PM). */
const JUNE_OMEN_AI: ScriptStep[] = [
  { say: 'OMEN AI looks at how a game ran and tells you, in plain words, what held your frames back, with the fix. You can apply the fix and undo it.', typing: T },
  { offer: { type: 'openModal', id: 'omenai' }, label: 'Open OMEN AI', delay: 500 },
];

/** The ids whose chips June does not offer. */
export const JUNE_HIDDEN_PILLS: ReadonlySet<string> = new Set(Object.keys(JUNE_OUT_OF_SCOPE));

/** A script as the given MVP scope tells it. */
export function scriptForScope(script: NovaScript, scope: MvpScope): NovaScript {
  if (scope !== 'june27') return script;
  if (script.id === 'omen-ai') return { ...script, steps: JUNE_OMEN_AI };
  const steps = JUNE_OUT_OF_SCOPE[script.id];
  return steps ? { ...script, steps } : script;
}
export const PILLS = SCRIPTS.filter((s) => s.kind === 'pill');
export const TOPICS = SCRIPTS.filter((s) => s.kind === 'topic');

/** Exact label first (a chip press), then the regexes, else null. */
export function matchScript(text: string): NovaScript | null {
  const t = text.trim();
  if (!t) return null;
  const exact = SCRIPTS.find((s) => s.label && s.label.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  return SCRIPTS.find((s) => s.match.some((re) => re.test(t))) ?? null;
}

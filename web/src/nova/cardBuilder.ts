/**
 * Nova composes a dashboard widget (TH-443) — the deterministic half.
 *
 * Third in a row of three builders that all read the same sentence, so the
 * ORDER and the GATES are the whole design. It runs after `overlayScriptFor`
 * and before `layoutScriptFor`:
 *
 *  - after the overlay builder, because `parseOverlayRequest` requires the
 *    literal word "overlay"/"hud" and that word is a decision about *where* the
 *    thing goes. "an fps overlay" is an overlay even though it would make a
 *    perfectly good card.
 *  - before the layout builder, because `BOARD_NOUN` includes `widgets?` and
 *    `CHANGE_VERB` includes `make`, so "make me a widget with cpu temp and fps"
 *    is otherwise read as "rearrange my dashboard" and answered with the
 *    performance recipe — the request's actual content thrown away.
 *
 * And like both of them it is **model-free on purpose**. The pill works with no
 * Ollama running, which is what makes it survive a demo on a laptop; the
 * structured call (`cardSchema`) only ever improves a reply that already exists.
 *
 * Since TH-450 the vocabulary it reads is the three META tables in
 * `state/overlays.ts` — readings, bound controls and app panels — rather than
 * eight hand-written probes, and it says which words it did NOT read
 * (`leftoverWords`), so a sentence it only half understood is handed to the
 * model with the half it did understand kept as certain.
 */
import { itemAbsence, itemMeta, itemKey, namedItemsIn, newCard, type CardSpec, type ItemMeta, type NamedItem, type OverlayItem } from '../state/overlays';
import { isWidgetAvailable, type LayoutContext } from '../widgets/layout';
import { cardSteps, type AbsentGroup, type NovaScript } from './scripts';

/**
 * A request is about ONE card only if it names one, in the SINGULAR.
 *
 * The plural is the whole difference between composing and arranging: "build me
 * a widget" is this builder's, "show me my widgets" and "rearrange my widgets"
 * are the board's. Without the plural guard `show` in `COMPOSE_VERB` would turn
 * "show me my widgets" into a newly composed card.
 */
const CARD_NOUN = /\b(widget|card|tile|panel|readout)\b/i;
const CARD_NOUN_PLURAL = /\b(widgets|cards|tiles|panels|readouts)\b/i;
/**
 * It has to ask for one to be MADE — or name something a card can hold, which
 * is asking by other means: "a widget showing my fps" has no verb in this list
 * and is as clear a request as there is (TH-450).
 */
const COMPOSE_VERB = /\b(make|build|create|compose|design|put\s*together|give\s*me|add|want|need|show)\b/i;
/** The layout builder's verbs. Any of these and the sentence is about arranging. */
const ARRANGE_VERB = /\b(rearrange|arrange|re-?organi[sz]e|organi[sz]e|tidy|clean\s*up|clear|rebuild|redo|reset|lay\s*out)\b/i;
/** Verbs about a card that already exists. "Resize my cpu widget" is not a request for a new one. */
const EDIT_VERB = /\b(resize|move|remove|delete|hide|forget|shrink|enlarge|drag|rename)\b/i;

/**
 * What a card CANNOT hold, and what already shows it.
 *
 * Every word here points at the catalog widget that CAN. Saying "a card can't
 * show storage — the Storage widget does, want it?" is both honest and more
 * useful than composing anything. The model path reports the same thing in
 * `CardProposal.unavailable`; this is the deterministic half of it, so the
 * reply shape is one shape.
 *
 * Shorter each release: fan speed, lighting, what you played and the deals left
 * in TH-450; storage and the network in TH-452. Each became a thing a card holds.
 */
const COVERED_BY: { match: RegExp; what: string; widget: string }[] = [
  // Storage and the network left this list in TH-452: a drive's use and the
  // link's speed are registry rows now, and the Storage / System Vitals widgets
  // are offered as the designed alternative through `shownBy` instead.
  { match: /\b(batter(y|ies)|charge)\b/i, what: 'battery', widget: 'dev-mouse' },
  { match: /\b(profile|profiles)\b/i, what: 'your profile', widget: 'profile' },
  { match: /\b(clock|clocks|ghz|mhz|frequency)\b/i, what: 'clock speeds', widget: 'cpu' },
  // Named catalog widgets. "Add the thermal widget" is a request for THAT
  // widget, not for a composed card that happens to hold temperatures — and
  // without this row it became the default guess, which is worse than the
  // layout recipe it replaced.
  { match: /\bthermal\b/i, what: 'thermal', widget: 'thermal' },
  { match: /\b(game\s*pass)\b/i, what: 'Game Pass', widget: 'gamepass' },
  { match: /\b(quick\s*launch)\b/i, what: 'quick launch', widget: 'quicklaunch' },
  { match: /\b(play\s*next|what\s*to\s*play)\b/i, what: 'what to play next', widget: 'playnext' },
];

/**
 * What a card holds when the request names nothing from the vocabulary.
 *
 * "build me a widget" is the most natural thing a person can type and it has to
 * produce a card, not a dashboard. Same answer `parseOverlayRequest` gives to a
 * bare "overlay": the classic trio. The reply then says what else can go on one,
 * so the next sentence can be specific — which is the part that teaches the
 * vocabulary without a prompt having to list it.
 */
const DEFAULT_CARD_ITEMS = [
  { kind: 'bound', bind: 'fps' },
  { kind: 'bound', bind: 'cpu-temp' },
  { kind: 'bound', bind: 'gpu-temp' },
] as const;
/** Named rather than derived: a starting point should read as a thing, not a list. */
const DEFAULT_CARD_TITLE = 'Frame rate & temps';

export interface CardRequest {
  /**
   * The card, minted once so pressing "Add to dashboard" twice re-adds the same
   * card rather than making two (`newOverlay` set the idiom). Null only when
   * everything named is something a card cannot hold at all.
   */
  spec: CardSpec | null;
  /** Things asked for that a card cannot hold, in words a person would use. */
  unavailable: string[];
  /**
   * Things a card CAN hold but not on this install — the headset's volume with
   * no headset on the desk, the deals with the Shop module gone — grouped by
   * the reason, so the reply says each reason once (TH-450).
   */
  absent: AbsentGroup[];
  /**
   * Things a card CAN hold but a designed widget shows better — one reading on
   * its own, where the catalog already has a widget for it.
   *
   * This started out as a refusal: a single named reading returned null and fell
   * through to the layout builder, on the theory that handing over the designed
   * widget beats composing a one-tile card. Two things were wrong with that.
   * The layout builder answered "a widget that shows my cpu temp" with a whole
   * performance DASHBOARD, so the person got neither; and deciding on someone's
   * behalf that the thing they asked for is not what they want is the opposite
   * of offering. Now the card is built AND the alternative is named, with a chip
   * for each — which is what "offer, do not act" means when there are two
   * reasonable answers.
   */
  better: string[];
  /** The catalog widget ids answering `unavailable` then `better`, in order. */
  insteadOf: string[];
  /** True when nothing from the vocabulary was named and `spec` is the default. */
  guessed: boolean;
  /**
   * Words the parser did not read and could not dismiss as filler (TH-450) —
   * "discord" in "a widget showing my discord and my fps". Non-empty means the
   * model should see the sentence, with `spec`'s items kept as its seed.
   */
  leftover: string[];
}

/**
 * The words a card request is made of that are NOT content: the ask itself,
 * the filler around it, the device and place nouns the vocabulary's gates have
 * already consumed, and the number words a count is written in. Anything else
 * left standing after the vocabulary is removed is something the parser did
 * not understand.
 */
const FILLER = new Set(
  (
    'a an the my me i we you your our it its this that these those and or but with without plus also too of for from to on in at by as ' +
    'is are be been being was were am do does did have has had can could would should will shall may might must want wants wanted need needs ' +
    'like love please nova hey hi ok okay so just only very really quite some any all both each every few more most much many new now here there ' +
    'where when what which who how why one ones thing things stuff settings setting info information data details detail status level levels ' +
    'current live latest recent recently top last next then up down out over into about along way kind sort bit little big small quick simple ' +
    'basic nice cool good great real actual full own same different another other else etc using use uses used see view watch look looking ' +
    'track tracking keep keeping check checking showing shows show display displaying displays put get give gives giving got add adding make ' +
    'making build building create creating compose composing design designing card widget tile panel readout dashboard board home screen desk ' +
    'pc machine computer system game games device devices hardware peripheral peripherals controls control readings reading number numbers ' +
    'stats stat metrics metric value values thanks mate yeah yes no not ' +
    // Device and place nouns — the vocabulary's own gates read these.
    'headset headphones mouse keyboard monitor mic microphone laptop speaker speakers shop store nova ' +
    // Number words, which `countNear` reads.
    'one two three four five six seven eight'
  ).split(' '),
);

/** A regex with the global flag, so `replace` takes every mention. */
const global = (re: RegExp) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);

/**
 * The substantive words left after everything the parser understood is removed:
 * the named items' own spans, the ask, the catalog pointers, the filler.
 * Possessives are dropped ("nova's" is "nova"); anything under three letters
 * is noise. Exported for the suite.
 */
export function leftoverWords(text: string, named: readonly NamedItem[]): string[] {
  // Blank the spans the vocabulary claimed, keeping the indices honest.
  let chars = text.split('');
  for (const n of named) for (let i = n.at; i < n.end && i < chars.length; i++) chars[i] = ' ';
  let t = chars.join('');
  for (const re of [CARD_NOUN, COMPOSE_VERB, ARRANGE_VERB, EDIT_VERB]) t = t.replace(global(re), ' ');
  for (const c of COVERED_BY) t = t.replace(global(c.match), ' ');
  const words = t.toLowerCase().replace(/['’]s\b/g, '').match(/[a-z][a-z'’-]{2,}/g) ?? [];
  const out: string[] = [];
  for (const w of words) if (!FILLER.has(w) && !out.includes(w)) out.push(w);
  return out;
}

/**
 * What this text is asking for, if it is asking for a card at all. Null when it
 * is not — the layout builder and then the ordinary scripts take it from there.
 *
 * Three outcomes rather than two, which is the whole fix: a card, a card plus an
 * honest note about what it could not hold, or no card and a pointer at the
 * widget that already does the job.
 */
export function parseCardRequest(text: string, ctx: LayoutContext): CardRequest | null {
  if (!CARD_NOUN.test(text) || CARD_NOUN_PLURAL.test(text)) return null;
  if (ARRANGE_VERB.test(text) || EDIT_VERB.test(text)) return null;

  const named = namedItemsIn(text);
  // A card noun with no verb and nothing named is a mention, not a request —
  // "what is a widget?" belongs to the scripts.
  if (!COMPOSE_VERB.test(text) && !named.length) return null;

  // What they named that a card cannot serve, and what can.
  const covered = COVERED_BY.filter((c) => c.match.test(text) && isWidgetAvailable(c.widget, ctx));
  const unavailable = covered.map((c) => c.what);
  const insteadOf = covered.map((c) => c.widget);

  // What they named that a card CAN hold — split into what this install can
  // bind and what it cannot (no such device on the desk, module not installed).
  const items: OverlayItem[] = [];
  const absentBy = new Map<string, string[]>();
  for (const { item } of named) {
    const why = itemAbsence(itemMeta(item), ctx.gate);
    if (why) absentBy.set(why, [...(absentBy.get(why) ?? []), itemMeta(item).label.toLowerCase()]);
    else items.push(item);
  }
  const absent: AbsentGroup[] = [...absentBy].map(([reason, labels]) => ({ labels, reason }));
  const leftover = leftoverWords(text, named);

  if (items.length) {
    const better: string[] = [];
    // One reading on its own that a designed widget already shows: build the
    // card they asked for, and name the alternative rather than decide for them.
    if (items.length === 1 && !covered.length) {
      const meta: ItemMeta = itemMeta(items[0]);
      if (meta.shownBy && isWidgetAvailable(meta.shownBy, ctx)) {
        better.push(meta.label);
        insteadOf.push(meta.shownBy);
      }
    }
    return { spec: newCard(items), unavailable, absent, better, insteadOf, guessed: false, leftover };
  }

  // Nothing bindable from the vocabulary. If they named something a card cannot
  // hold at all, or something this desk cannot bind, that IS the answer and
  // composing anything would be noise.
  if (covered.length || absent.length) return { spec: null, unavailable, absent, better: [], insteadOf, guessed: false, leftover };

  // Otherwise they asked for a widget and left it open — compose the classic
  // trio and let the reply say what else a card can hold.
  return { spec: newCard([...DEFAULT_CARD_ITEMS], DEFAULT_CARD_TITLE), unavailable, absent, better: [], insteadOf, guessed: true, leftover };
}

/** The script for a composed card. Null when the text is not asking for one. */
export function cardScriptFor(text: string, ctx: LayoutContext): NovaScript | null {
  const req = parseCardRequest(text, ctx);
  if (!req) return null;
  // The model sees every card request the parser could build (TH-453). What it
  // may change follows how much was read: a guess (nothing named) is the
  // model's to fill; a partly-read sentence keeps what was read as the seed and
  // takes the model's additions (TH-450); a fully-read one keeps its items and
  // takes only the model's title and sentence (`readAll`). The built spec rides
  // along as the preview the bubble shows while the model works. Nothing
  // bindable — a pointer at a widget, an absent device — stays deterministic:
  // that answer IS the answer, and composing would be noise.
  const refine: NovaScript['refine'] = req.guessed
    ? { kind: 'widget', surface: 'card' }
    : req.spec
      ? { kind: 'widget', surface: 'card', seed: req.spec.items, absent: req.absent, readAll: !req.leftover.length, built: req.spec }
      : undefined;
  return {
    id: req.spec ? `card:${req.spec.id}` : `card:instead:${[...req.insteadOf, ...req.absent.flatMap((a) => a.labels)].join('-')}`,
    kind: 'pill',
    label: undefined,
    match: [],
    steps: cardSteps(req),
    ...(refine ? { refine } : {}),
  };
}

/** The dedupe both the deterministic and the model path need: first mention wins. */
export function mergeItems(...lists: readonly (readonly OverlayItem[])[]): OverlayItem[] {
  const seen = new Set<string>();
  const out: OverlayItem[] = [];
  for (const list of lists) for (const it of list) {
    const k = itemKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

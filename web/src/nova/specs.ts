/**
 * What Nova is allowed to ask the model for, as JSON Schema — and the one place
 * the taught vocabulary is built, so it cannot drift from the enforced one.
 *
 * TWO RULES, both measured on granite4.2:8b through Ollama's `/v1`:
 *
 *  1. **Flat.** A schema using `anyOf` with `const` discriminators produced NO
 *     RESPONSE in 90 seconds; the flattened form of the identical request
 *     answered in 6.1s. `OverlayItem` is a tagged union, so the schema cannot
 *     mirror our own type — it carries two parallel enum arrays and the union is
 *     rebuilt in TypeScript.
 *
 *  2. **Enums, not strings.** Inside an `enum` an invalid id is not unlikely, it
 *     is impossible: the decoder cannot emit one. Asked for Spotify, a stock
 *     ticker and a Discord panel against a catalog holding none of them, the
 *     model invented nothing and named all three in `unavailable`.
 *
 * The ids are **not** put in the prompt. `CONTEXT_CHAR_BUDGET` is 1600 and
 * asserted, and 27 ids with names is ~600 chars — it would either blow the check
 * or push the desk line out through the block's line-boundary truncation. In the
 * schema they cost nothing in context and cannot be ignored the way prose can.
 */
import { availableWidgetIds, MAX_ITEMS, metaFor, nameFor, type LayoutContext } from '../widgets/layout';
import { countNear, itemAbsence, itemMeta, newCard, newOverlay, type CardSpec, type OverlayItem, type OverlaySpec } from '../state/overlays';
import type { Binding } from '../state/bindings';
import { fitToRows } from '../widgets/cardMeta';
import { mergeItems } from './cardBuilder';
import { cardSteps, layoutSteps, overlaySteps, type AbsentGroup, type NovaScript, type RefineKind } from './scripts';
import { cleanNote, cleanTitle, proposalToBoundItems, type Surface, type WidgetProposal } from './widgetSpec';
import type { BoardItem } from '../widgets/catalog';

/** What the model returns for a layout request. Ids only — never geometry. */
export interface LayoutProposal {
  /** A sentence Nova can say. The model's own words, shown as prose. */
  note: string;
  /** Board widgets, in reading order. */
  items: string[];
  /** Things the person asked for that this install does not have. */
  unavailable: string[];
}

/** Kept under the board's own cap so a proposal is a dashboard, not a dump. */
const MAX_BOARD_ITEMS = Math.min(10, MAX_ITEMS);

/**
 * The layout schema, built from what is renderable right now.
 *
 * **Geometry is deliberately absent.** Two reasons, and the first is a freeze:
 * `pack.ts`'s row loop has no exit condition, so a non-numeric span spins it
 * forever with nothing thrown — and a CDP suite that hits it hangs rather than
 * failing red. `cellSize` guards that now, but the narrower contract removes the
 * whole class from the model's reach. The second is product: `verify-home-v2`
 * records that System Vitals silently lost its RAM and Network cells at a third
 * of its width until its CSS learned a narrow layout, and exactly one of 27
 * widgets has that layout. A model choosing spans reintroduces that clipping
 * across the catalog, and no validator can detect it. The catalog's own size IS
 * the designed size, so `normalizeLayout` takes span/rows from `META_BY_ID`.
 */
export function layoutSchema(ctx: LayoutContext) {
  const ids = availableWidgetIds(ctx);
  return {
    name: 'layout',
    ids,
    /**
     * `id = Name`, one per line, for the request's OWN system message.
     *
     * The ids are not self-describing, and the gap is measurable: with only the
     * bare enum the model answered "mic and headset status not available as no
     * widget exists" while `dev-mic` and `dev-headset` were both right there,
     * and it missed `lastplayed` for "what I was playing". With the names it
     * picked all three. The cost is ~165 to ~280 completion tokens and a few
     * seconds, which buys choices that are actually right.
     *
     * This is why the names belong HERE and not in `grounding.tsx`: a layout
     * request is its own call, so the cost lands only on layout turns rather
     * than every chat turn, and it never competes with CONTEXT_CHAR_BUDGET.
     */
    catalog: ids.map((id) => `${id} = ${nameFor(id, ctx)}`).join('\n'),
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['note', 'items', 'unavailable'],
      properties: {
        note: { type: 'string' },
        // `maxItems` is not tidiness — it is the stop signal. An unbounded array
        // of enums gave the model nothing to stop on and it looped:
        // cpu-status, gpu-status, fanspeed, cpu-status, gpu-status, … until
        // max_tokens cut the JSON mid-string, which then surfaced as "the reply
        // was not JSON". Raising the cap did not help; bounding the array did.
        items: { type: 'array', minItems: 3, maxItems: MAX_BOARD_ITEMS, items: { enum: ids } },
        unavailable: { type: 'array', items: { type: 'string' } },
      },
    },
  };
}

/**
 * The system message for a layout request. Short on purpose: a prompt carrying
 * 26 ids measured 16.7s against 6s for a small card, and every line is paid for
 * on every request. The ids live in the schema, so this only has to explain the
 * *job*.
 */
export const LAYOUT_SYSTEM =
  'You arrange the widgets on a gaming PC dashboard. Choose between four and eight widgets — never repeat one — in reading order, most important first. Anything the person asks for that is not available goes in `unavailable`, named in their words. `note` is one short sentence saying what you arranged and why, naming the widgets. Do not invent widgets.';

// The card's system message and schema moved to `widgetSpec.ts` in TH-452,
// where the measurement script can load them without a component in the graph.

/**
 * A proposal's ids → board items. Geometry comes from the catalog.
 * `normalizeLayout` still has the final say — this only shapes the model's
 * answer into something it can validate.
 */
export function proposalToItems(p: LayoutProposal, ctx?: LayoutContext): { id: string; span: number; rows: number }[] {
  const seen = new Set<string>();
  const out: { id: string; span: number; rows: number }[] = [];
  for (const id of p?.items ?? []) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    // `metaFor`, not `META_BY_ID`: a proposal is allowed to name a card Nova
    // composed earlier (TH-443), and that id has no catalog row.
    const meta = metaFor(id, ctx);
    if (!meta) continue;
    seen.add(id);
    out.push({ id, span: meta.span, rows: meta.rows });
  }
  return out;
}

/**
 * A model proposal → the reply that shows it (TH-444). The one place a
 * structured answer becomes something a person sees, so it is also the one
 * place a structured answer can be REJECTED.
 *
 * Returns null when the proposal holds nothing renderable, and the provider
 * then shows the deterministic reply instead. That is not a safety net bolted
 * on — it is the contract: a model that answers slowly, wrongly or not at all
 * must cost the person nothing, because the reply it is improving was already
 * complete before the call was made.
 *
 * The `unavailable` case is the reason the schema asks for that array at all.
 * "A widget for my Spotify" has no readings in it, so there is no card to
 * build — but there IS an honest answer, in the person's own words, which no
 * table of mine could have anticipated.
 */
export function refineScript(
  kind: RefineKind,
  value: LayoutProposal | WidgetProposal,
  ctx: LayoutContext,
  prev: readonly BoardItem[],
  askedFor = '',
  /**
   * What the regex read for certain, kept ahead of the model's additions
   * (TH-450); `readAll` when it read the whole sentence, so the additions are
   * not taken at all; `built` is the deterministic spec whose id the model's
   * card keeps (TH-453).
   */
  seed?: { items?: OverlayItem[]; absent?: AbsentGroup[]; readAll?: boolean; built?: CardSpec | OverlaySpec },
  /** The bindings the request's enum was built from — a pair naming another is dropped (TH-452). */
  candidates: readonly Binding[] = [],
  surface: Surface = 'card',
): NovaScript | null {
  const base = { kind: 'pill' as const, label: undefined, match: [] as RegExp[] };

  if (kind === 'widget') {
    const p = value as WidgetProposal;
    // The seed first — it was read, not chosen — then the model's additions,
    // re-gated even though the enum was narrowed (a stored conversation or the
    // suite's fake server is not a constrained decoder), then trimmed to what
    // three board rows can hold with the seed never on the chopping block.
    const seedItems = seed?.items ?? [];
    // A sentence read whole settles its own items (TH-453): the model's
    // additions and its `unavailable` are not read — no words were left for
    // them to answer — and only its title and sentence are taken. Measured
    // 2026-10-06: on six such sentences the additions were never useful and
    // once wrong, while the titles and sentences were good every time.
    const proposed = proposalToBoundItems(p, candidates, (b) => countFromSentence(b, askedFor));
    // The FORM the model chose for an item the parser read is taken even when
    // the item itself was never in question (TH-454): "a gauge for my cpu temp"
    // seeds `cpu-temp` and the model answers `cpu-temp:gauge` — before this the
    // seed-first merge kept the parser's tile and dropped the model's pair with
    // the form on it, so a form request was honoured only on items the parser
    // had missed. Items are the parser's; forms, title and sentence are the model's.
    const formFor = new Map(proposed.map((c) => [c.bind, c.as]));
    const seeded = seedItems.map((s) => (s.kind === 'bound' && !s.as && formFor.get(s.bind) ? { ...s, as: formFor.get(s.bind) } : s));
    const chosen = seed?.readAll ? [] : proposed.filter((it) => !itemAbsence(itemMeta(it), ctx.gate));
    const items = fitToRows(mergeItems(seeded, chosen), seeded.length);
    const unavailable = seed?.readAll ? [] : cleanUnavailable(p?.unavailable, askedFor);
    const absent = seed?.absent ?? [];
    if (!items.length) {
      // Nothing to build. Only worth saying so when the model named what it
      // could not do; an empty proposal with no explanation is just a failure,
      // and the deterministic reply is better than a shrug.
      if (!unavailable.length) return null;
      return { ...base, id: `card:none:${unavailable.join('-')}`, steps: cardSteps({ spec: null, unavailable, absent, better: [], insteadOf: [], guessed: false }) };
    }
    const title = cleanTitle(p.title);
    const note = cleanNote(p.note, askedFor);
    // The built spec's id is kept (TH-453): the preview in the bubble and the
    // model's card are one card, so nothing jumps and "Add" adds one thing.
    const keep = seed?.built ? { id: seed.built.id, createdAt: seed.built.createdAt } : {};
    if (surface === 'overlay') {
      const spec: OverlaySpec = { ...newOverlay(items, title ? `${title} overlay` : undefined), ...keep };
      return { ...base, id: `overlay:${spec.id}`, steps: overlaySteps(spec, note) };
    }
    const spec: CardSpec = { ...newCard(items, title), ...keep };
    // `guessed` when there was no seed: the model CHOSE these readings rather
    // than being told them, and "just the readings you asked for" would be a
    // lie. With a seed the regex read the request and the model only filled in
    // what it missed, so the confident copy is honest. Either way the model's
    // own sentence leads when the guard let it through.
    return { ...base, id: `card:${spec.id}`, steps: cardSteps({ spec, unavailable, absent, better: [], insteadOf: [], guessed: !seedItems.length, note }) };
  }

  const p = value as LayoutProposal;
  const items = proposalToItems(p, ctx);
  // One widget is not a dashboard, and the default board the builder already
  // produced is a better answer than a board of one.
  if (items.length < 2) return null;
  const note = typeof p.note === 'string' && p.note.trim() ? p.note.trim() : undefined;
  return { ...base, id: `layout:model`, steps: layoutSteps({ name: 'custom', why: '', items, note }, prev, ctx) };
}

/** A model can name anything here, and the reply has to stay a sentence. */
const MAX_UNAVAILABLE = 4;
/** Longer than this is a phrase, not the name of a thing. */
const MAX_UNAVAILABLE_CHARS = 28;

/**
 * `unavailable` is free text — the one field in either schema that is not an
 * enum — so it is the one field a model can fill with anything.
 *
 * An earlier system message produced `unavailable: ["build me a widget"]` for
 * "build me a widget": the request echoed back as the thing that could not be
 * done, which the reply then read out loud. The prompt was fixed, but the field
 * stays free text, so the guard stays: drop anything long enough to be a phrase
 * and anything that is just the request again.
 */
export function cleanUnavailable(raw: unknown, askedFor: string): string[] {
  const asked = askedFor.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of Array.isArray(raw) ? raw : []) {
    if (typeof u !== 'string') continue;
    const t = u.trim();
    const k = t.toLowerCase();
    if (!t || t.length > MAX_UNAVAILABLE_CHARS || seen.has(k)) continue;
    // The request itself, or a long stretch of it, is not the name of a thing.
    if (asked && (asked.includes(k) ? k.length > asked.length / 2 : k.includes(asked))) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_UNAVAILABLE) break;
  }
  return out;
}

/**
 * A list panel's row count, read from the person's sentence — "my 3 games" —
 * never asked of the model: a free integer in the schema would be one more
 * field a model could fill with anything. Null when the sentence names none.
 */
function countFromSentence(b: Binding, text: string): number | null {
  if (!b.count) return null;
  for (const re of b.match) {
    const m = new RegExp(re.source, re.flags.replace('g', '')).exec(text);
    if (m) return countNear(text, m.index);
  }
  return null;
}

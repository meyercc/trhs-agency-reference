/**
 * The `widget` schema (TH-452) — what Nova asks the model for when it composes
 * a card or an overlay, and the retrieval that keeps that request small.
 *
 * PURE, and it must stay so: `web/scripts/measure-nova.mjs` loads this module in
 * plain Node to time the real model against the schema, so nothing in here may
 * import a component, a hook or a stylesheet. The only imports are the bindings
 * registry and the item type.
 *
 * TWO RULES, both measured on granite4.2:8b through Ollama's `/v1`:
 *
 *  1. **Flat.** A schema using `anyOf` with `const` discriminators produced NO
 *     RESPONSE in 90 seconds; the flattened form answered in 6.1s. So an item is
 *     one enum string, `bind:form`, and the pair is split back in TypeScript.
 *     Only compatible pairs are in the enum, which makes an incompatible
 *     presentation impossible rather than unlikely — the same principle that
 *     made an invalid id impossible in TH-444.
 *  2. **Prompt length is the latency dial.** 26 ids with their names measured
 *     16.7s against 6s for a small card. So the registry is never sent whole:
 *     `retrieveBindings` narrows it to the rows the sentence is about — the
 *     ones it named, their domain siblings, and an always-on core — and
 *     `RETRIEVE_N` caps the count. The number comes from measurement, not
 *     from a guess (see the comment on it).
 *
 * Every array has a small explicit `maxItems`: an unbounded enum array made
 * the model loop until `max_tokens` cut the JSON mid-string.
 */
import {
  allowedFor,
  availableBindings,
  bindingAbsence,
  BINDINGS,
  CORE,
  DOMAIN_WORDS,
  type Binding,
  type BindingGate,
  type BoundItem,
  type Domain,
  type Presentation,
} from '../state/bindings';

export type Surface = 'card' | 'overlay';

/**
 * How many candidates a request carries — the largest N that passed every gate
 * in `measure-nova.mjs` (granite4.2:8b, M1 Pro 16GB, 2026-10-06; 24 sentences ×
 * 2 passes per cell):
 *
 *   N    p50    p95   valid  dupes  forms-used  unavailable✗  note✗  changed(full)
 *    8   4.3s   5.2s  100%    0%      75%          13%          4%      33%
 *   16   4.9s   6.8s  100%    4%      75%           8%         13%      33%
 *   24   4.5s   5.5s  100%    0%      75%           4%          0%      33%
 *   32   4.8s   6.8s  100%    0%      75%           8%          0%      33%
 *
 * Latency is flat across the grid — the request is ~400 prompt tokens at N=32
 * and the catalog lines cost ~3 tokens each — so the cap is the registry's
 * reach, not the clock. The `parallel` variant measured 0.3–1s slower with
 * ~15% more completion tokens, so the composite enum stays. Re-run the script
 * after changing `WIDGET_SYSTEM` or the schema; this comment is its receipt.
 */
export const RETRIEVE_N = 32;

/** A card holds at most six items; an overlay is a small readout kept over a game. */
export const MAX_WIDGET_ITEMS: Record<Surface, number> = { card: 6, overlay: 4 };

// ── Retrieval ─────────────────────────────────────────────────────────────────

/** Does this row's vocabulary accept the sentence? */
export function bindingMatches(b: Binding, text: string): number | null {
  if (b.requires && !b.requires.test(text)) return null;
  if (b.unless && b.unless.test(text)) return null;
  let at: number | null = null;
  for (const re of b.match) {
    const m = new RegExp(re.source, re.flags.replace('g', '')).exec(text);
    if (m && (at === null || m.index < at)) at = m.index;
  }
  return at;
}

/** The rows the sentence names, in sentence order — what the regex read for certain. */
export function hitsIn(text: string, gate?: BindingGate | null): Binding[] {
  const found: { b: Binding; at: number }[] = [];
  for (const b of Object.values(BINDINGS)) {
    const at = bindingMatches(b, text);
    if (at !== null) found.push({ b, at });
  }
  found.sort((x, y) => x.at - y.at);
  return found.map((f) => f.b).filter((b) => !bindingAbsence(b, gate));
}

/**
 * The candidate set for one request: the rows the sentence named, then their
 * domains' other rows by rank, then the core, cut at `n`. When nothing was named
 * and no domain word appears, the core plus one top row per domain — so a bare
 * "build me a widget" still offers something from every room in one call.
 *
 * Deterministic, so the suite can assert exactly what the enum held. Absent
 * devices and uninstalled modules never enter it.
 */
export function retrieveBindings(text: string, gate?: BindingGate | null, n = RETRIEVE_N): Binding[] {
  const hits = hitsIn(text, gate);
  const have = new Set(hits.map((b) => b.id));
  const domains = new Set<Domain>(hits.map((b) => b.domain));
  for (const d of Object.keys(DOMAIN_WORDS) as Domain[]) if (DOMAIN_WORDS[d].test(text)) domains.add(d);

  const pool = availableBindings(gate);
  const byRank = (a: Binding, b: Binding) => a.rank - b.rank;
  const out: Binding[] = [...hits];
  const push = (b: Binding) => {
    if (have.has(b.id) || out.length >= n) return;
    have.add(b.id);
    out.push(b);
  };

  if (hits.length || domains.size) {
    for (const b of pool.filter((b) => domains.has(b.domain)).sort(byRank)) push(b);
    for (const id of CORE) {
      const b = BINDINGS[id];
      if (b && !bindingAbsence(b, gate)) push(b);
    }
    return out.slice(0, n);
  }

  // Nothing named, nowhere pointed: the core, then the best of each room.
  for (const id of CORE) {
    const b = BINDINGS[id];
    if (b && !bindingAbsence(b, gate)) push(b);
  }
  const perDomain = new Map<Domain, Binding[]>();
  for (const b of pool) perDomain.set(b.domain, [...(perDomain.get(b.domain) ?? []), b]);
  for (const list of perDomain.values()) list.sort(byRank);
  let added = true;
  while (added && out.length < n) {
    added = false;
    for (const list of perDomain.values()) {
      const next = list.find((b) => !have.has(b.id));
      if (next) {
        push(next);
        added = true;
      }
    }
  }
  return out.slice(0, n);
}

// ── The schema ────────────────────────────────────────────────────────────────

export type SchemaVariant = 'composite' | 'parallel';

/** `cpu-temp:gauge` — one enum value per compatible pair; a bespoke or panel row is its bare id. */
export function pairsFor(b: Binding): string[] {
  const forms = allowedFor(b);
  return forms.length ? forms.map((as) => `${b.id}:${as}`) : [b.id];
}

export function splitPair(pair: string): { bind: string; as?: Presentation } {
  const i = pair.lastIndexOf(':');
  if (i < 0) return { bind: pair };
  return { bind: pair.slice(0, i), as: pair.slice(i + 1) as Presentation };
}

/** What the model returns. `items` are `bind:form` pairs (composite) or bare ids (parallel, with `forms` beside them). */
export interface WidgetProposal {
  title: string;
  items: string[];
  /** Parallel variant only: a form per item, zipped by index. */
  forms?: string[];
  note: string;
  unavailable: string[];
}

export interface WidgetSchema {
  name: 'widget';
  /** `id = Label`, one per line, for this request's own system message. */
  catalog: string;
  candidates: Binding[];
  variant: SchemaVariant;
  schema: Record<string, unknown>;
}

/**
 * The schema for one request. Flat: one object, one enum array, two strings,
 * one bounded string array. `maxItems` is the stop signal, not tidiness.
 *
 * The `parallel` variant exists to be measured against the composite one: it
 * carries fewer enum values (ids + a short forms enum) at the cost of a second
 * array the validator has to zip and may have to discard.
 */
export function widgetSchema(candidates: Binding[], surface: Surface, variant: SchemaVariant = 'composite'): WidgetSchema {
  const max = MAX_WIDGET_ITEMS[surface];
  const catalog = candidates.map((b) => `${b.id} = ${b.label}`).join('\n');
  const base = {
    title: { type: 'string' },
    note: { type: 'string' },
    unavailable: { type: 'array', maxItems: 4, items: { type: 'string' } },
  };
  if (variant === 'parallel') {
    const ids = candidates.map((b) => b.id);
    const forms = [...new Set(candidates.flatMap(allowedFor))];
    return {
      name: 'widget',
      catalog,
      candidates,
      variant,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'items', 'forms', 'note', 'unavailable'],
        properties: {
          ...base,
          items: { type: 'array', minItems: 1, maxItems: max, items: { enum: ids } },
          forms: forms.length ? { type: 'array', maxItems: max, items: { enum: forms } } : { type: 'array', maxItems: 0 },
        },
      },
    };
  }
  const pairs = candidates.flatMap(pairsFor);
  return {
    name: 'widget',
    catalog,
    candidates,
    variant,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'items', 'note', 'unavailable'],
      properties: {
        ...base,
        items: { type: 'array', minItems: 1, maxItems: max, items: { enum: pairs } },
      },
    },
  };
}

/**
 * Every measured clause of `CARD_SYSTEM` (specs.ts) kept, plus what the
 * `id:form` pair means. The names ride in the catalog lines appended per
 * request, never in the chat's grounding block.
 */
export const WIDGET_SYSTEM =
  'You compose ONE dashboard widget for a gaming PC from the vocabulary listed below as id = name. Choose ONLY what the person asked to watch, change or see — do not add related things they did not mention. If they named nothing at all, choose three that are broadly useful. Never list the same id twice. ' +
  // The forms are NAMED here because the model cannot infer them: asked for "a
  // level meter with marks" it chose `slider`, never `vu`, until `vu` was
  // described (measure-nova.mjs, 2026-10-06).
  'Each item is written id:form. The forms: slider (a slider you move), vu (a level meter with marks), balance (a two-sided slider), toggle (an on/off switch), choice (pick one of a few), tile (a plain number you read, not a control), meter (a level bar for a percentage), gauge (a round dial), sparkline (the last two minutes drawn as a line). Choose the form that suits what they asked — "as a number" or "read-only" means tile, "level meter" means vu, "dial" means gauge, "bar" means meter, "graph", "over time" or "trend" means sparkline; when you are not sure, use the first form a vocabulary line allows. ' +
  'Title it in at most three words, naming what it shows. `note` is ONE short sentence, in plain words, saying what you put on it and why — never a list of ids, and never a repeat of what is in `unavailable`, which is read out on its own. ' +
  '`unavailable` is ONLY for a specific thing they named that this vocabulary cannot show — an app, a game, a service, a piece of hardware. Put their words for it there, not your own, and never their whole request. If they named no such thing, leave it empty.';

/** Appended for an overlay: it floats over the game, so readings before controls, and few of them. */
export const OVERLAY_CLAUSE = ' This one is a small readout kept over a game: prefer readings over controls, and at most four items.';

// ── From a proposal to items ──────────────────────────────────────────────────

/**
 * A proposal's pairs → items. Dedupes on the binding (the renderer keys by
 * index, so a repeat renders twice and looks correct), drops a pair whose
 * binding is not among the candidates, and re-checks the form against
 * `allowedFor` even though the enum already enforced it — a stored conversation
 * or the suite's fake server is not a constrained decoder.
 */
export function proposalToBoundItems(p: WidgetProposal, candidates: readonly Binding[], countFor?: (b: Binding) => number | null): BoundItem[] {
  const byId = new Map(candidates.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const out: BoundItem[] = [];
  const pairs: { bind: string; as?: Presentation }[] = Array.isArray(p?.forms)
    ? (p.items ?? []).map((id, i) => ({ bind: id, as: p.forms?.[i] as Presentation | undefined }))
    : (p?.items ?? []).map(splitPair);
  for (const { bind, as } of pairs) {
    const b = byId.get(bind);
    if (!b || seen.has(bind)) continue;
    seen.add(bind);
    const forms = allowedFor(b);
    const form = as && forms.includes(as) ? as : undefined;
    const count = b.count ? countFor?.(b) : null;
    out.push({ kind: 'bound', bind, ...(form && form !== forms[0] ? { as: form } : {}), ...(count != null ? { count } : {}) });
  }
  return out;
}

// ── Guards on the two free-text fields ────────────────────────────────────────

/** Longer than this is a paragraph, not a title. */
const MAX_TITLE_CHARS = 32;
/** Longer than this is a paragraph, not a sentence. */
const MAX_NOTE_CHARS = 160;

/** A title Nova can show, or undefined (the caller falls back to `cardTitleFor`). */
export function cleanTitle(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  if (!t || t.length > MAX_TITLE_CHARS || /[:\n]/.test(t)) return undefined;
  return t;
}

/**
 * The model's own sentence, or undefined (the caller uses the templated
 * opening). It must be one line, short, free of raw `id:form` pairs and not the
 * request read back — the echo failure `cleanUnavailable` was written for.
 */
export function cleanNote(raw: unknown, askedFor = ''): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t.length > MAX_NOTE_CHARS) return undefined;
  if (/[`*#]|\b[a-z-]+:(tile|gauge|meter|sparkline|slider|vu|balance|toggle|choice|badge|rows|price)\b/i.test(t)) return undefined;
  const asked = askedFor.trim().toLowerCase();
  const k = t.toLowerCase();
  if (asked && (k.includes(asked) || (asked.includes(k) && k.length > asked.length / 2))) return undefined;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

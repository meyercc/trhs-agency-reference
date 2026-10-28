/**
 * Nova rearranges the dashboard (TH-442) — the deterministic half.
 *
 * Mirrors `overlayBuilder.ts`: a request becomes a reply built from what it
 * names, not matched against a table. And like the overlay builder it is
 * **model-free on purpose.** The Overlay pill works with no server running,
 * which is why it survives a demo on a laptop with no Ollama; a layout pill that
 * needed the model would be dead in exactly that moment. So the recipes below
 * always produce something, and the structured call only ever *improves* a reply
 * that already exists.
 *
 * It must also run BEFORE `matchScript`. The topic regexes in `scripts.ts`
 * include `/fan/i`, `/\bthermal/i`, `/bright/i`, `/\bdpi\b/i` and
 * `/\blighting\b/i`, so "add the thermal widget" and "put fan speed on my
 * dashboard" are stolen by a topic script otherwise. The board-noun gate below
 * is what keeps this from over-reaching in the other direction.
 */
import { META_BY_ID, type BoardItem } from '../widgets/catalog';
import { isWidgetAvailable, type LayoutContext } from '../widgets/layout';
import { layoutSteps, type NovaScript } from './scripts';

/**
 * A request is about the board only if it names the board. Without this gate a
 * bare `/\brearrange\b/` or `/\bbuild\b/` would swallow "build me a dpi overlay"
 * — which the suite types, and which belongs to the overlay builder.
 */
const BOARD_NOUN = /\b(dashboard|board|home\s*screen|widgets?|layout|cards?)\b/i;
/**
 * The nouns that mean the WHOLE board rather than something on it. Only these
 * may fall through to the default recipe when nothing else matched: "sort out my
 * dashboard" deserves a guess, "a widget that shows my storage" does not.
 */
const WHOLE_BOARD = /\b(dashboard|board|home\s*screen|layout|widgets)\b/i;
/** And it has to ask for a CHANGE, or "what widgets do I have" becomes a rebuild. */
const CHANGE_VERB = /\b(rearrange|arrange|re-?organi[sz]e|organi[sz]e|sort|tidy|clean\s*up|clear|rebuild|build|set\s*up|lay\s*out|redo|reset|optimi[sz]e|make|show|give|add|put|focus)\b/i;

/** Ordered recipes, first match wins. Each is a wish-list of ids, filtered by availability. */
const RECIPES: { match: RegExp; name: string; ids: string[]; why: string }[] = [
  {
    match: /\b(stream|streaming|broadcast|obs)\b/i,
    name: 'streaming',
    ids: ['vitals', 'cpu-status', 'gpu-status', 'thermal', 'fanspeed', 'dev-mic', 'dev-headset'],
    why: 'what a stream can ruin — load, heat, and whether your mic and headset are actually there',
  },
  {
    match: /\b(perform|performance|fps|frame|thermal|temp|temperature|heat|overclock|tun(e|ing)|struggl)/i,
    name: 'performance',
    ids: ['vitals', 'cpu-status', 'gpu-status', 'cpu', 'thermal', 'fanspeed', 'power', 'storage'],
    why: 'the readings that tell you whether the machine is keeping up',
  },
  {
    match: /\b(play|playing|game|games|gaming|library|backlog)\b/i,
    name: 'playing',
    ids: ['lastplayed', 'playnext', 'quicklaunch', 'gamepass', 'vitals', 'profile'],
    why: 'what you were playing, what to play next, and a way back in',
  },
  {
    match: /\b(minimal|simple|simpler|clean|tidy|less|declutter|quiet|empty|bare)\b/i,
    name: 'minimal',
    ids: ['vitals', 'profile', 'lastplayed'],
    why: 'three things and nothing else',
  },
  {
    match: /\b(device|devices|peripheral|peripherals|desk|hardware|mouse|keyboard|headset|mic)\b/i,
    name: 'my devices',
    ids: ['dev-mouse', 'dev-keyboard', 'dev-headset', 'dev-mic', 'dev-monitor', 'dev-treehouse', 'dev-laptop'],
    why: 'the things on the desk, and nothing competing with them',
  },
];

/** The recipe's ids as real board items, geometry from the catalog. */
function itemsFor(ids: readonly string[], ctx: LayoutContext): BoardItem[] {
  return ids
    .filter((id) => isWidgetAvailable(id, ctx))
    .map((id) => {
      const meta = META_BY_ID[id];
      return { id, span: meta.span, rows: meta.rows };
    });
}

export interface LayoutRequest {
  /** Which recipe matched, for the reply's own words. */
  name: string;
  why: string;
  items: BoardItem[];
  /**
   * No recipe matched and this is the default board (TH-444). Five keyword
   * recipes cannot cover what a person might want from a dashboard, so this is
   * the case the model exists for — and the case where swapping the answer
   * costs nothing, because the answer was a fallback.
   */
  guessed: boolean;
  /** The model's own sentence, when the structured call wrote one. */
  note?: string;
}

/**
 * Does this text ask for the board to change, and if so what does the
 * model-free answer look like? Null when it is not about the board at all —
 * the ordinary scripts take it from there.
 */
export function parseLayoutRequest(text: string, ctx: LayoutContext): LayoutRequest | null {
  if (!BOARD_NOUN.test(text) || !CHANGE_VERB.test(text)) return null;
  const hit = RECIPES.find((r) => r.match.test(text));
  // No recipe matched. The fallback is only honest when the sentence is about
  // the BOARD as a whole — `?? RECIPES[1]` used to apply to everything, so any
  // board-noun sentence nobody else claimed came back as a performance
  // dashboard. "Build me a widget that shows my storage" was answered that way:
  // a considered-looking reply to a question nobody asked, which is harder to
  // spot than no reply at all (TH-443).
  if (!hit && !WHOLE_BOARD.test(text)) return null;
  const items = itemsFor((hit ?? RECIPES[1]).ids, ctx);
  // A recipe that survives availability filtering down to nothing is not an
  // answer. Better to fall through to the ordinary scripts than to offer an
  // empty board nobody asked for.
  if (items.length < 2) return null;
  const recipe = hit ?? RECIPES[1];
  return { name: recipe.name, why: recipe.why, items, guessed: !hit };
}

/**
 * The script for a layout reply. `prev` rides on the undo chip, so pressing it
 * restores the board that was actually there rather than a recomputed guess.
 */
export function layoutScriptFor(text: string, ctx: LayoutContext, prev: readonly BoardItem[]): NovaScript | null {
  const req = parseLayoutRequest(text, ctx);
  if (!req) return null;
  return {
    id: `layout:${req.name}`,
    kind: 'pill',
    label: undefined,
    match: [],
    steps: layoutSteps(req, prev, ctx),
    ...(req.guessed ? { refine: { kind: 'layout' as const } } : {}),
  };
}

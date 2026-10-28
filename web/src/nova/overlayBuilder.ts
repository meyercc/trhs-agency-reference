import { namedItemsIn, newOverlay, parseOverlayRequest } from '../state/overlays';
import { leftoverWords } from './cardBuilder';
import { overlaySteps, type NovaScript } from './scripts';

/**
 * Nova builds an overlay from what was asked (TH-439): "fps overlay",
 * "an overlay with gpu temp and my dpi", "hud". The request is parsed for
 * metrics and controls (state/overlays.ts); the script is the shared
 * overlay reply around the built spec. Null when the text is not about an
 * overlay — the ordinary scripts take it from there.
 *
 * The spec is minted here, once, with its own id: pressing "Place on
 * screen" twice re-places the same overlay rather than making two.
 *
 * Since TH-453 a HUD that NAMES something composes the way a card does: the
 * named items are the seed, the model adds what the parser missed (or, for a
 * sentence read whole, only a title and a sentence), capped at four by the
 * overlay schema. A bare "overlay" — the pill, "make me a hud" — stays the
 * classic corner readout, instantly and without a call: a HUD has a canonical
 * default in a way a card does not, and the pill is a promise of that one.
 */
export function overlayScriptFor(text: string): NovaScript | null {
  const items = parseOverlayRequest(text);
  if (!items) return null;
  const spec = newOverlay(items);
  const named = namedItemsIn(text);
  // "overlay" and "hud" were read — blanked in place so the named spans keep
  // their indices (`leftoverWords` works on positions).
  const rest = text.replace(/\b(overlay|hud)\b/gi, (m) => ' '.repeat(m.length));
  const refine: NovaScript['refine'] = named.length
    ? { kind: 'widget', surface: 'overlay', seed: items, readAll: !leftoverWords(rest, named).length, built: spec }
    : undefined;
  return { id: `overlay:${spec.id}`, kind: 'pill', label: undefined, match: [], steps: overlaySteps(spec), ...(refine ? { refine } : {}) };
}

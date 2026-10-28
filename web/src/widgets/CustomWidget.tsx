import type React from 'react';
/**
 * A card Nova built, on the board (TH-443).
 *
 * There is no new component here and that is the point: the chassis is
 * `WidgetShell` — the same `.w` shell 18 of the 20 catalog widgets use, which
 * is also where the board's drag handle lives (`.w-label`), so a custom card is
 * dragged, resized, slotted and removed by exactly the code that moves every
 * other widget. The body is `OverlayItems`, the same renderer the HUD uses, so
 * one spec reads the same on the board and on screen.
 *
 * The snapshot arrives as a PROP rather than from a hook in here, because
 * `useVitalsStream` is an independent random walk per call: three cards each
 * calling it would show three different CPU numbers side by side on one screen,
 * and cost three tickers. `OverlayHost` already solved this — one stream at the
 * host, fanned out — and the board does the same.
 */
import { WidgetShell } from '../components';
import './board.css';
import { OverlayItems } from '../overlays/OverlayHost';
import { useSettings } from '../state/Settings';
import type { CardSpec } from '../state/overlays';
import { useVitalsStream, type VitalsStream } from '../modals/vitalsData';
import { cardMeta } from './cardMeta';

export function CustomWidget({ spec, stream }: { spec: CardSpec; stream: VitalsStream }) {
  return (
    <WidgetShell title={spec.title} data-card={spec.id}>
      <div className="wb-card-items">
        <OverlayItems items={spec.items} stream={stream} />
      </div>
    </WidgetShell>
  );
}

/**
 * A composed card inside a Nova reply (TH-443): the real widget with the real
 * tiles and live numbers, so what is previewed is what gets added — not a
 * picture of it. `OverlayPreview` is the same idea for the HUD, and this follows
 * it, including running its own stream: a chat bubble shows one card at a time,
 * and the reply is not on the board yet so there is no host to fan one out.
 *
 * The preview is sized to the card's real footprint — `cardMeta`'s rows, as
 * `--wb-card-rows` — because a `.w` in normal flow would grow to its content
 * and the proportions would be a guess (and a body that clips on the board
 * would look fine in the bubble).
 *
 * `composing` (TH-453): the regex card shown while the model works — the state
 * line says so, and the chips are not there yet. The model's card arrives under
 * the same id, so this element is the one that gets its final contents.
 */
export function CardPreview({ spec, composing = false }: { spec: CardSpec; composing?: boolean }) {
  const { boardLayout, cards } = useSettings();
  const stream = useVitalsStream(true);
  const onBoard = (boardLayout ?? []).some((i) => i.id === spec.id);
  const known = cards.some((c) => c.id === spec.id);
  // The footprint `cardMeta` will give it on the board, so a two-row card
  // previews at two rows and a body that would clip there clips here too.
  const { rows, span } = cardMeta(spec);
  return (
    <div className="wb-card-preview" data-card-preview={spec.id} data-rows={rows} style={{ '--wb-card-rows': rows, '--wb-card-span': span } as React.CSSProperties}>
      <CustomWidget spec={spec} stream={stream} />
      <span className="wb-preview-state" data-state={composing ? 'composing' : onBoard ? 'on' : known ? 'off' : 'none'}>
        {composing ? 'Composing with the local model\u2026' : onBoard ? 'On your dashboard' : known ? 'Taken off — add it again to put it back' : 'Not added yet'}
      </span>
    </div>
  );
}

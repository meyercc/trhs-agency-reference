import { Hud } from '../components';
import { useSettings } from '../state/Settings';
import type { OverlaySpec } from '../state/overlays';
import { useVitalsStream } from '../modals/vitalsData';
import { OverlayItems } from './OverlayHost';

/**
 * A built overlay inside a Nova reply (TH-439): the real Hud with the real
 * tiles and live numbers, so what is previewed is what gets placed — not a
 * picture of it. No grip and no ✕: it is not on screen yet. A line under it
 * says whether it is — or, while the model composes (TH-453), that it is the
 * built HUD standing in until the model's arrives under the same id.
 */
export function OverlayPreview({ spec, composing = false }: { spec: OverlaySpec; composing?: boolean }) {
  const { overlays } = useSettings();
  const stream = useVitalsStream(true);
  const placed = overlays.find((o) => o.id === spec.id);
  const state = composing ? 'Composing with the local model\u2026' : placed ? (placed.visible ? 'On screen' : 'Hidden — place it again to show it') : 'Not placed yet';
  return (
    <div className="overlay-preview" data-overlay-preview={spec.id}>
      <Hud title={spec.title} grip={false}>
        <OverlayItems items={spec.items} stream={stream} />
      </Hud>
      <span className="overlay-preview-state ds-live-control-value" data-state={composing ? 'composing' : placed ? (placed.visible ? 'on' : 'hidden') : 'none'}>
        {state}
      </span>
    </div>
  );
}

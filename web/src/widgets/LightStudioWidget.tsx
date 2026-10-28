import { WidgetShell } from '../components';
import { LightsBody } from '../controls/LiveControl';
import { DEVICE_WIDGET_SKU } from './catalog';
import './board.css';

/**
 * The desk's lights, bound (TH-450). Until now this card held a toggle and a
 * slider on local `useState` — it rendered perfectly and changed nothing, the
 * same inert port the Lighting widget's notes describe for its own old
 * controls. It now renders the same `LightsBody` a composed card's lights
 * control does, bound to `Settings.underGlow`, so switching it here switches
 * the strip the hero desk map draws, and a mode that pins the light locks it.
 *
 * The display is the board's monitor card's SKU rather than a hook of its own,
 * so the mode this widget files the level under is the one that card shows.
 */
export function LightStudioWidget() {
  return (
    <WidgetShell title="Light Studio">
      <div className="wb-card-items" style={{ alignContent: 'start' }}>
        <div className="ds-live-control">
          <LightsBody skuId={DEVICE_WIDGET_SKU['dev-monitor']} />
        </div>
      </div>
    </WidgetShell>
  );
}

import { useSearchParams } from 'react-router-dom';
import { WidgetShell } from '../components';
import { useSettings } from '../state/Settings';
import './widgets.css';

/**
 * The desk's lighting, as a status and a door — no controls of its own.
 *
 * This card was a port of the vanilla `w-lighting` widget: an effect picker,
 * a speed slider, a brightness slider and a `Sync All` toggle, all on local
 * `useState`. Every one of them was inert — the port carried the markup across
 * before `Settings.underGlow` existed, and nothing came back to wire it once it
 * did. The Lights tab in the monitor window was wired (MonitorTabs `LightsTab`)
 * and this card was not, which left one page showing a live Display section
 * beside a dead Lighting section.
 *
 * They were removed rather than wired, for three reasons measured 2026-08-26:
 *
 *  · `Sync All` already exists and already works, one click away — Light Studio
 *    has `Sync all devices` (LightStudio.tsx, backed by `scene.ts`, which puts
 *    every DEVICE_ID into the edit target). Wiring this one would have made two
 *    switches for one idea, and their defaults already disagreed: this card
 *    started `true`, Light Studio starts `false`.
 *  · The brightness slider would have become a back door around a lock. Glow
 *    brightness is mode-scoped (`byMode`) and Create holds it down deliberately
 *    — bias lighting is not supposed to exceed roughly a tenth of the screen it
 *    sits behind (verifier-log.md, 2026-08-06). A desk-level slider does not
 *    know about that lock, so wiring it would quietly undo the research.
 *  · Effect and speed live in Light Studio and in the monitor's Lights tab. A
 *    third copy here would put one value on three screens with one of them real.
 *
 * What is left is what this page is for: Personalize personalises the DESK, and
 * the desk-level job for lighting is to say what it is doing and open the room
 * where it is edited. No new vocabulary — `WidgetShell` and the `.wg-foot` row
 * this file already used for its label/value lines (rule 15).
 */
export function LightingWidget() {
  const [, setParams] = useSearchParams();
  const { underGlow } = useSettings();

  /* Names the display on purpose. Six devices carry light (`scene.ts`
     DEVICE_IDS), but the monitor's is the only glow this app persists —
     Light Studio keeps the rest in its scene, which does not survive a
     reload. An unlabelled `On · 70%` on a desk-level card would read as a
     claim about all six. Naming it keeps the sentence true and leaves the
     gap visible instead of papering over it. */
  const status = underGlow.enabled ? `On · ${underGlow.brightness}%` : 'Off';

  return (
    <WidgetShell
      title="Lighting"
      /* Opened the mouse from a lighting card until 2026-08-26 — a hardcoded
         `device: 'mouse'` that predates the monitor section. It opens on the
         display now, which is the device this card reports on. */
      action={{ label: 'Light Studio', onClick: () => setParams({ device: 'monitor' }) }}
    >
      {/* `margin: 0` is this app's idiom for a `.wg-foot` that is the card's
          body rather than its trailing footer — DisplayWidgets and
          SmartActionsWidget both write it that way. Without it the class's own
          `margin-top: var(--gutter-sm)` lands on top of the shell's 11px and
          the row sits 27px under the title, against the 11px the DESK card
          next door uses (measured 2026-08-26, 1440×1000). */}
      <div className="wg-foot" style={{ margin: 0 }}>
        <span className="ds-text-label">Treehouse 32</span>
        <span style={{ color: 'var(--text-dim)' }}>{status}</span>
      </div>
    </WidgetShell>
  );
}

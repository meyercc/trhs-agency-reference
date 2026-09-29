import { useEffect, useState } from 'react';
import './device-canvas.css';
import './monitor-canvas.css';
import { Icon, Ng3Panel, Ng3Tool, Toggle } from '../components';
import { type ResolvedSku } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileActions, ProfileScopeBody, useDeviceProfileBar } from './ProfileBar';
import { MonitorModeBar, MonitorModeActions } from './monitor/ModeBar';
import { MonitorModeProvider } from './monitor/monitorMode';
import { DisplayArrange } from './DisplayArrange';
import {
  ConnectivityTab,
  DisplayTab,
  LightsTab,
  UtilitiesTab,
  AudioTab,
} from './monitor/MonitorTabs';
import { useSettings } from '../state/Settings';

/**
 * Full-canvas monitor modal on the Ng3Panel canvas. The hero is the
 * interactive multi-display arrangement (DisplayArrange, shared via
 * Settings.displayArrange) — the monitor's equivalent of the keyboard's
 * interactive hero, and the surface the Perform desk map writes to.
 *
 * Tabs come from `deviceTabs` and their bodies live in monitor/MonitorTabs:
 * Display · Connectivity · Lights · Audio · Settings — the monitor section's
 * task-oriented IA (Cindy; Overview retired 2026-08-18, see deviceTabs.ts). Lights is the exception to "bodies live in
 * MonitorTabs": it is the keyboard's own tab, imported, with only its wiring here
 * (Chris, 1:1 2026-08-11). The hero stays the arrangement on every tab: a
 * photo hero would take the arrangement surface away from the very monitor most
 * likely to own it (parked with Chris, 1:1 2026-07-30).
 *
 * Content strategy ("columns + section scroll"): every tab redistributes its
 * vertical stack into the shared Ng3Grid columns at panel width; long lists
 * scroll inside their section (Ng3Scroll) — the panel itself never scrolls.
 */

export function MonitorCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const f = sku.features;
  const profile = useDeviceProfileBar(sku);
  // The Under-Glow master switch state — read here so the panel header can
  // carry the toggle on the Lights tab (see headerExtra below).
  const { underGlow, setUnderGlow } = useSettings();
  const tabs = deviceTabs(sku);

  const [tabId, setTabId] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id,
  );
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];

  /* Hold the page behind the modal still while it is open.
   *
   * The device canvas is `position: fixed` (device-canvas.css), so the Devices
   * page underneath keeps its own scroll — put the pointer anywhere and the
   * wheel moves the BACKGROUND, not the modal (Cindy, 2026-08-19; reproduced
   * with the modal open, window scrolled 0 → 600px).
   *
   * Nothing locks it: searched web/src and shared/ and the only scroll lock in
   * the app is the X-ray full-screen's (monitor/XrayCard.tsx), which is ours.
   * This is that same pattern, so the two behave alike.
   *
   * ⚠️ Scoped to the monitor because that is what this change owns. The gap is
   * the shared shell's — DeviceModalHost.tsx is Chris's (meyercc, 2026-06-17)
   * and every device modal has it. Logged for him rather than fixed in his
   * file; see chris-next-outbound.md.
   */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // The "Add new preset" editor lives in the strip's trailing slot while the
  // row that opens it is in the leading slot's menu, so the flag sits here,
  // between them.
  const [addingPreset, setAddingPreset] = useState(false);

  return (
    <MonitorModeProvider skuId={sku.id} features={f}>
    <div className="dc-canvas mc-canvas" role="dialog" aria-label={sku.name}>
      {/* No `.dc-status` chips here, unlike every sibling canvas (2026-08-20,
          Cindy). A peripheral has no screen of its own, so its chip is the only
          place "this is connected" can be said — on a monitor the lit panel you
          are reading IS that evidence. The two we had said nothing a monitor
          needs: the green dot had no disconnected branch at all (always on),
          and `240 Hz` is a spec constant, not live state — nothing in this
          window changes it, and it already reads in Settings › Specs and on the
          My Devices card. The chip row stays available for a monitor state that
          is genuinely live (active input, real running refresh) if one gets an
          engine. `.dc-status` itself is untouched — this canvas just does not
          use it. */}

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      {/* Hero — the shared arrangement on every tab. PROTOTYPE 2026-08-04:
          Connectivity used to swap it for a rear photo, which was the one tab
          where you lost sight of which computer holds the keyboard & mouse —
          and that tab is where Gear Switch lives. Now it keeps the arrangement
          and just turns the selected display around; port detail moved down
          into the panel. `monitorHeroIsDeskMap` is left alone on purpose: it
          also picks the tab desk-map navigation lands on. */}
      {/* The desk map sits on the SAME library panel as the tab body below, in
          the SAME wrap — `.dc-panel-wrap` fixes the width, `Ng3Panel` brings the
          surface, border, corner and shadow. 2026-08-05 (Cindy): the canvas is
          glass (`.dc-canvas` = --ksg-b60 over blur(24px)), so 40% of whatever is
          behind the modal came through and the under-glow pool landed on a
          colour that shifted with the wallpaper — a lamp you cannot read is not
          a state display. An opaque floor fixes that, and taking it from the
          panel rather than styling a div is what keeps the band's width, colour
          and radius equal to the card row's by construction instead of by three
          numbers copied here. No `tools`/`header`: this panel is a surface, and
          the tab strip belongs to the one below. */}
      <div className="dc-hero mc-hero">
        <div className="dc-panel-wrap mc-hero-wrap">
          <Ng3Panel className="mc-hero-panel" bare>
            {/* The hero keeps the monitor's FRONT on every tab, Connectivity
                included (2026-08-08 Cindy, `ia-section5.md` 「Connectivity
                앞면」 — that decision replaced the 2026-08-04 "turn around on
                entry" one and its code side was never done; implemented
                2026-08-20).
                Why front: a tab you walk into should not answer a question you
                did not ask. Turning the display around was a navigation side
                effect — you pressed Connectivity and the product spun — and the
                port map below already gives the rear its full-width drawing. The
                turn keeps its job as FEEDBACK for pressing `X-ray view`, which is
                a separate piece of work.
                `rearSku` stays in DisplayArrange's API for exactly that. */}
            {/* No `viewingLayout` prop: the layout is persisted state and
                DisplayArrange already reads `useSettings()`, so passing it from
                here would mean lifting the value out of a provider this very
                component owns. It reads `viewingMode.current` itself and applies
                it to `currentSku` — the display being configured. */}
            <div className="mc-arrange">
              <DisplayArrange currentSku={sku.id} />
            </div>
          </Ng3Panel>
        </div>
      </div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap mc-panel-wrap">
        {/* Each tab's name on hover — `Ng3Tool` since the 2026-09-07 upstream
            merge. Icon-only tabs made the panel's sections discoverable only by
            clicking through them, so this was composed here from the DS Tooltip
            while the library had no answer for its own tab bar. v0.2.19 gave it
            one ("device panel tabs name themselves") and the hand-rolled version
            was dropped for it — a library part beats a local copy of the same
            idea, and the naming is now every canvas's, not just this one's.
            The clip-path lift in monitor-canvas.css stays: it is what keeps the
            popup from being cut off at the tab edge.
            No header `actions`: the Duplicate button the sibling canvases put
            there is the DS story's example action, wired to nothing — and above
            Display it reads as "copy these settings". Real duplication lives in
            Utilities → Modes & Presets (2026-08-08, Cindy). Re-checked on the
            2026-09-07 merge, which brought that button back on every canvas:
            still out here, same reason. */}
        <Ng3Panel
          // The mode bar is the monitor's saved unit — what Display, Lights and
          // Audio all save into — so it sits in the strip beside the tabs, in
          // the slot the profile selector holds on every other device (which
          // renders nothing here: a monitor has no onboard slots).
          leading={
            <>
              <ProfileBar state={profile} />
              <MonitorModeBar onAddPreset={() => setAddingPreset(true)} />
            </>
          }
          trailing={
            <>
              <ProfileActions state={profile} />
              <MonitorModeActions adding={addingPreset} onDone={() => setAddingPreset(false)} />
            </>
          }
          width={active.width}
          header={active.title}
          headerExtra={
            // The Under-Glow master switch, in the same header slot the
            // keyboard and headset canvases use for their power toggles
            // (Ng3Panel headerExtra — its own doc names this use). Moved from
            // the retired Overview card on 2026-08-18 (Cindy) so the light
            // has one switch in one home, beside the tab that owns it.
            active.id === 'lighting' ? (
              <Toggle
                checked={underGlow.enabled}
                onChange={(on) => setUnderGlow({ ...underGlow, enabled: on })}
                aria-label="Lights power"
              />
            ) : undefined
          }
          tools={tabs.map((t) => (
            <Ng3Tool key={t.id} icon={t.icon} title={t.title} active={t.id === active.id} onClick={() => setTabId(t.id)} />
          ))}
          bare
        >
          <ProfileScopeBody state={profile}>
          {active.id === 'connectivity' ? (
            <ConnectivityTab features={f} />
          ) : active.id === 'display' ? (
            <DisplayTab features={f} skuName={sku.name} />
          ) : active.id === 'lighting' ? (
            <LightsTab />
          ) : active.id === 'audio' ? (
            <AudioTab features={f} />
          ) : (
            <UtilitiesTab sku={sku} />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
    </MonitorModeProvider>
  );
}

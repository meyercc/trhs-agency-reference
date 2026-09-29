// ══════════════════════════════════════════════════════════════════════════
// Personalize → Display. What every display shares.
//
// Why this page and not a device window (2026-08-07, Cindy): a device window is
// about ONE piece of hardware, and this is only meaningful across several.
// Personalize is where the app already keeps the cross-device version of a
// thing — `Lighting` is every device's light in one card. Lighting is the
// desk's light; this is the desk's screens.
//
// Restored 2026-08-18 from the 2026-08-08 original (git 45438ce) after the
// section was cleared for the desk-map redesign. One card is still out: Smart
// actions, whose design is being written in a parallel session, not decided
// here.
//
// What IS settled, and the reason this file says anything about it: the two
// are different things, decided 2026-08-07 (Cindy, plan.md:119) — the
// Personalize umbrella keeps the name `Smart Actions`, while the monitor
// window's single row is `Auto-switch by activity`. That row lives in the
// monitor window alone (Settings tab, since Overview was retired in e76e76c
// the same day) and must not be duplicated onto this page. A Smart actions
// card here is not that duplicate: it is the desk-wide AI layer that WATCHES
// and ASKS (Zone 2 — project-context.md:82, corrected by Cindy 2026-08-18),
// e.g. "your brightness sync is off — did you mean that?".
//
// Nothing here is a placeholder: the roster is the real `DISPLAYS` list the
// desk map draws, the level is persisted, and the monitor's own Display tab
// follows it while sync is on.
// ══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WidgetShell, Slider, Button } from '../components';
import { useSettings } from '../state/Settings';
import { visibleDisplays } from '../devices/arrangement';
import { getResolvedSku } from '../devices/skus';
import { useBrightnessLevel } from '../devices/monitor/monitorMode';
import './widgets.css';

/** The modes a monitor offers, read off its SKU (empty for one without modes). */
const modesOf = (skuId: string): string[] => {
  const f = (getResolvedSku(skuId)?.features ?? {}) as Record<string, unknown>;
  return Array.isArray(f.modes) ? (f.modes as string[]) : [];
};

/**
 * The rail card on a ONE-screen desk — the Treehouse 32 alone with a desktop
 * (2026-09-21, second pass).
 *
 * First pass (same morning) replaced the whole section with a summary row, and
 * Cindy read the missing desk picture as a bug: «한 대의 책상에 책상이 아예
 * 없어졌는데». The section is now ONE skeleton on every desk — DESK picture on
 * the left, controls on the right — and only the right side changes: several
 * screens get ALL DISPLAYS, one screen gets its own brightness here. Same card
 * shape as ALL DISPLAYS (label + value row, then the library `Slider`) so the
 * two read as the same control at different scope; the title names the monitor
 * and the corner opens its window, the way LIGHTING's corner opens Light Studio.
 * Values go through the monitor window's own hooks, so this cannot say a
 * different brightness from the window it opens.
 */
export function DisplaySummaryWidget() {
  const [, setParams] = useSearchParams();
  const skuId = 'treehouse-32';
  const { level, setLevel } = useBrightnessLevel(modesOf(skuId), skuId);
  const name = getResolvedSku(skuId)?.name ?? 'Treehouse 32';
  return (
    <WidgetShell
      title={name}
      action={{ label: 'Settings', onClick: () => setParams({ sku: skuId, tab: 'display' }) }}
    >
      <div style={{ marginTop: 'var(--gutter-sm)', display: 'grid', gap: 'var(--gutter-sm)' }}>
        <div className="wg-foot" style={{ margin: 0 }}>
          <span className="ds-text-label">Brightness</span>
          <span style={{ color: 'var(--text-dim)' }}>{level}%</span>
        </div>
        <Slider value={level} onChange={setLevel} aria-label={`Brightness for the ${name}`} />
      </div>
    </WidgetShell>
  );
}

/**
 * The section has no job with one screen — Personalize gates on this.
 *
 * A HOOK since 2026-09-01, and the word is the whole fix. It was a plain
 * function, and `visibleDisplays()` reads `displayCount` straight out of
 * localStorage — correct value, but read once per render and with nothing
 * telling React to render again. So the gate froze at whatever the count was
 * when Personalize last drew, and changing the Admin `Desk` axis with that page
 * open left the section behind while the DESK card beside it moved (that card
 * consumes settings, so it re-rendered on its own).
 *
 * Reading `displayCount` through `useSettings` is what subscribes the caller.
 * The value still comes from `visibleDisplays()` — the roster logic and its
 * KEEP_PRIORITY stay in one place — but the freshness is now declared rather
 * than borrowed from whatever else the component happened to be reading.
 *
 * `visibleDisplays()` itself stays a plain function: the arrangement maths runs
 * outside React (`arrangement.ts`) and cannot call hooks.
 */
/**
 * How many MONITORS are on this desk — the screens this app can set a level on.
 * The laptop's own screen is a display (it is arranged, it is counted by
 * `useHasMultipleDisplays`) but not a monitor: the app has no brightness for it.
 * The right column of the Display section follows THIS count (2026-09-21, Cindy
 * «그렇게 바꿔줘»): one monitor → that monitor's own card; two → All monitors.
 * Subscribed the same way as the hook below (reading `displayCount`).
 */
export function useMonitorCount(): number {
  const { displayCount } = useSettings();
  void displayCount;
  return visibleDisplays().filter((d) => d.kind === 'monitor').length;
}

export function useHasMultipleDisplays() {
  const { displayCount } = useSettings();
  // Referenced so the subscription is real and cannot be dropped as unused —
  // the count IS the input, `visibleDisplays()` just applies KEEP_PRIORITY.
  void displayCount;
  return visibleDisplays().length > 1;
}

export function AllDisplaysWidget() {
  const {
    displaySync,
    setDisplaySync,
    displayBrightness,
    setDisplayBrightness,
    autoBrightnessFor,
    setAutoBrightnessFor,
  } = useSettings();
  // What each matched monitor's Auto-Brightness was before the match, so Undo
  // gives back the sensor too, not just the level. `null` = nothing to undo.
  const [undo, setUndo] = useState<Record<string, string> | null>(null);
  /* What the screens hold right now, so the value can say it (2026-09-21 flow
     audit). It read `—` until the slider was first moved, beside a handle
     standing at 80% — the card contradicted itself on every first visit. Each
     monitor keeps its own level (displayPictureBySku, 2026-09-18), so this asks
     each one through the window's own hook. Both monitors, always, in a fixed
     order — hooks cannot be called for a list that changes — then filtered to
     the ones on this desk. The laptop's own screen has no level in this app, so
     it is not counted. */
  const levels = {
    'treehouse-32': useBrightnessLevel(modesOf('treehouse-32'), 'treehouse-32').level,
    'pulse-27': useBrightnessLevel(modesOf('pulse-27'), 'pulse-27').level,
  } as Record<string, number>;
  const here = visibleDisplays()
    .map((d) => ('sku' in d ? levels[d.sku] : undefined))
    .filter((v): v is number => v != null);
  const same = here.length > 0 && here.every((v) => v === here[0]);
  const shown = displaySync ? displayBrightness : same ? here[0] : null;

  /* ONE control since 2026-09-21 (Cindy review: the section was "대충"). A
     `Brightness` slider above a `Match all displays` switch split one intent
     across two controls — with Match off, nothing on the card said which screen
     the slider was moving. On a card titled All monitors, moving the slider IS
     matching them, so it does both; the receipt below is the way back. Until it
     is moved each display keeps its own level — the value says that level when
     they agree, `Mixed` when they do not (see `levels` above). */
  /* Matching takes the matched monitors off their sensors (2026-09-23, Cindy's
     HyperX review). Before this the match wrote one level onto a display whose
     Auto-Brightness was still `Ambient` — the default in every mode — so the
     sensor and the match both owned one number, the monitor window's Brightness
     slider stayed a read-only meter under a caption saying "change it here",
     and the next change of room light broke the match silently. Moving this
     slider is an explicit hand, and the latest hand wins; handing a display
     back to its sensor ends the match the same way (`useAutoBrightness`). The
     setter used here is the store's own, so restoring on Undo does not trip
     that rule. */
  const move = (v: number) => {
    if (!displaySync) {
      const skus = visibleDisplays().flatMap((d) => (d.kind === 'monitor' && 'sku' in d ? [d.sku] : []));
      const before = Object.fromEntries(skus.map((s) => [s, autoBrightnessFor(s)]));
      skus.forEach((s) => setAutoBrightnessFor(s, 'Off'));
      setDisplaySync(true);
      setUndo(before);
    }
    setDisplayBrightness(v);
  };
  const undoMatch = () => {
    setDisplaySync(false);
    if (undo) Object.entries(undo).forEach(([s, src]) => setAutoBrightnessFor(s, src));
    setUndo(null);
  };

  // No corner action. `Arrange` used to sit here too, pointing at the same place
  // as the DESK card's — two identical buttons in adjacent cards of one section,
  // which costs a reader the pause of "do these do different things?" for no
  // gain (Cindy, 2026-08-19). Arranging is a picture job, so the one door stays
  // on the card that draws the picture. This card is about the number every
  // display shares, and it has no second errand.
  return (
    /* `All monitors`, not `All displays` (2026-09-21, Cindy «그렇게 바꿔줘»): this
       slider moves the monitors and cannot move a laptop's own screen — the app
       has no level for it — so "all displays" promised a screen it never
       touched. The card only appears with two or more monitors (Personalize). */
    <WidgetShell title="All monitors">
      <div style={{ marginTop: 'var(--gutter-sm)', display: 'grid', gap: 'var(--gutter-sm)' }}>
        {/* No roster line. "OMEN OLED 27 · Built-in Display · Treehouse 32" read as
            one sentence, not three screens (Cindy, 2026-09-13: "한 줄로 보여서 이게
            디바이스 세 개라는 게 한 눈에 안 들어와"), and the DESK card beside this
            one already shows exactly which screens "all" means, with their names.
            Sentence-case labels below wear Chris's type ramp (`.ds-text-label`,
            platform font); numbers keep the RBNo3.1 that `.wg-foot` gives them. */}
        <div className="wg-foot" style={{ margin: 0 }}>
          <span className="ds-text-label">Brightness</span>
          <span style={{ color: 'var(--text-dim)' }}>{shown != null ? `${shown}%` : 'Mixed'}</span>
        </div>
        <Slider
          value={shown ?? displayBrightness}
          onChange={move}
          aria-label="Brightness for all monitors — moving it sets every monitor to the same level"
        />

        {/* A receipt, not a question (2026-08-24, Cindy: "왜 유저가 한 번 더
            컨펌을 해야 되는 거야? 그냥 바로 싱크하면 안 돼?"). Asking again
            after someone has already flipped the switch treats their own action
            as a proposal — this is not an AI suggestion, it is a control they
            reached for. The switch now takes effect on the flip, and the thing
            they might actually want is the way back, which a confirm never gave
            them: `Not now` cancelled, but nothing undid a Match once made. */}
        {undo && (
          <div className="wg-foot" style={{ margin: 0, gap: 'var(--gutter-xs)' }}>
            <span className="ds-text-label" style={{ color: 'var(--text-dim)' }}>
              Matched {visibleDisplays().filter((d) => d.kind === 'monitor').length} monitors to {displayBrightness}%.
            </span>
            <Button size="sm" onClick={undoMatch}>
              Undo
            </Button>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

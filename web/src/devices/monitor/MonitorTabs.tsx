// ══════════════════════════════════════════════════════════════════════════
// Monitor tab IA — Display / Connectivity / Lights / Audio / Settings (id 'utilities').
// Overview retired 2026-08-18 (Cindy): its Automation row lives in Settings →
// Modes & Presets, the first-hour card opens Display, and the Under-Glow
// master toggle sits in the panel header on the Lights tab (MonitorCanvas).
// Lights is not authored here: it is the keyboard's tab imported whole, with the
// display wiring in `LightsTab` (Chris, 1:1 2026-08-11).
// Owned by the monitor section (Cindy); registered in devices/deviceTabs.ts and
// rendered by MonitorCanvas on the Ng3Panel canvas.
//
// Vocabulary: the NG3 panel primitives (Ng3Section / Ng3Row / Ng3Field /
// Ng3Label / Ng3Spec / Ng3Scroll) plus library controls — the same
// set the mouse/keyboard/headset canvases use. The earlier port of these tabs
// spoke the old card-modal `dm-*` vocabulary; that stack was re-assembled here
// rather than pasted, so one canvas never shows two design systems.
//
// Folded in from the upstream 4-tab scaffold so nothing regressed for the
// other monitor SKUs: HDR + color gamut (was Color) live in Display's Color
// section; device identity and OSD (was Settings) live in Utilities. The inputs
// list and USB hub went to Connectivity instead, and the text list only appears
// when there is no X-ray card — the port map is already the single source for
// ports (Cindy, 2026-07-23).
//
// ⚠️ Inherited, not chosen: what came across in that fold-in had never passed
// the entrance test in deviceTabs.ts, because the test was written for NEW
// features and this was furniture that arrived with the building. Audited
// 2026-08-24 — four items across five tabs were in that state and all four sat
// on this tab (`Firmware`, `Device Manager`, `Get Support`, the OSD card).
// Everything on Display, Connectivity and Audio had been re-decided since.
//
// Craft decisions applied here (reports/2026-07-21-craft-review-polish-todo.md):
//   B4①  mode pills are the real modes with real selection — the old
//         Active/Secondary/Scheduled slot labels were hardcoded by position and
//         did not follow the choice (false state display, not just cosmetics).
//   B4②③ the parallel profile UIs are gone (Overview dropdown, Utilities
//         PROFILE MANAGEMENT). What replaces them was left open on 07-21 and
//         is now answered: the mode *is* the monitor's saved unit ("what a
//         mode remembers"), so there is no separate profile layer here. Not
//         the canvas ProfileBar — that renders nothing on a monitor (no
//         onboard slots), so naming it the profile home left the modal with
//         no profile at all until it was measured on 2026-07-31.
//   B4④  Smart Actions says "mode", the monitor's word, not "profile".
//   B8   auto-switch defaults OFF (input hand-off stays Zone 2/3).
//   B10  the Under-Glow master toggle actually gates color + brightness.
// ══════════════════════════════════════════════════════════════════════════
import {
  Children,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Slider,
  Dropdown,
  Toggle,
  ToggleButtonGroup,
  Chip,
  Button,
  Badge,
  Icon,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  Ng3Spec,
  Ng3Scroll,
  ListItem,
  IconButton,
  Input,
  Tooltip,
} from '../../components';
import type { Features, ResolvedSku } from '../skus';
import { useSettings, LEVEL_FOR_ROOM, type DisplayPictureState } from '../../state/Settings';
import {
  MAX_CUSTOM_PRESETS,
  MODES_LOCKING_GLOW,
  useMonitorMode,
  usePicture,
  useBrightnessLevel,
  useAutoBrightness,
} from './monitorMode';
// The keyboard's Lights tab, imported whole rather than re-drawn for displays
// (rule 15; Chris's instruction, 1:1 2026-08-11). Wired for the monitor in
// `LightsTab` below — the only display-specific part is which light it drives.
import { LightingTab } from '../LightingTab';
import { PortMapPanel } from './XrayCard';
import { ViewingModeTiles, screenLayout } from './ViewingModeTiles';
import { PORTS, connectedName, hostPort, isPlugged, specPorts, type PortNames } from './ports';
import { DESK_HOSTS_FALLBACK, deskPcNames, deskPcs as pcsOnDesk } from '../arrangement';
import './monitor-tabs.css';

/**
 * A tab body: its sections, packed into columns by height (see .mc-grid).
 *
 * Sections are passed as a flat list rather than pre-sorted into Ng3Col groups
 * because the list is SKU data — Gear Switch, OLED Care, Under-Glow, OSD and
 * the inputs list each appear only when the hardware has them. A hand-written
 * grouping is correct for exactly one monitor and wrong for the next one.
 * Falsy children (a gated-out section) drop out before the count, so the
 * column count follows what actually rendered.
 */
/**
 * A tab body lays its cards in ROWS — the grammar every sibling canvas already
 * uses (mouse 266|266, mic 175|175, keyboard 340|340: one row, level bottoms).
 * The monitor stacked COLUMNS instead, and every complaint of 2026-08-25/26 —
 * staggered bottoms, holes between cards, a crumb of a card — was that
 * deviation showing (Cindy: "패턴 설정 그래서 하라고 한거잖아").
 *
 * THE PATTERN, which is also the rule for what comes next:
 *   · a tab is one or two rows of cards, two cards to a row (three cards make
 *     a pair-row plus one full-width row — the keyboard's Lights card is the
 *     full-width precedent);
 *   · cards in a row stretch to the row's height, so bottoms are level by
 *     construction (the library's own flex behaviour, not new CSS);
 *   · rows are PAIRED BY HEIGHT — tallest with next-tallest — so the stretch
 *     a card absorbs is the smallest possible (Display pairs 282|265 and
 *     205|169: slack 17 and 36, spread over each card's own rows);
 *   · a card that would still carry more than ~70px of slack at its row's
 *     height is a GROUPING problem, not a layout one — it merges into a
 *     neighbour or earns more content. CSS may never pad it (the EQ-preset
 *     hole, removed 2026-08-25).
 *   · a NEW FEATURE lands as a row inside the card whose subject it shares;
 *     a new card only for a new subject, and then its row re-pairs by height.
 *
 * Spec of record: design-assets/component-specs.md, SPEC: tab-card-rows.
 */
function MonitorGrid({ children, stack }: { children: ReactNode; stack?: boolean }) {
  const sections = Children.toArray(children);
  const mode = stack ? 'mc-grid--stack' : sections.length > 2 ? 'mc-grid--rows' : 'mc-grid--wide';

  /* Which cards share a row. Measured once per set of cards, exactly like the
     column packing this replaces: natural heights are read, cards are sorted
     tallest-first and chunked into pairs, and the assignment is frozen until
     the SET changes. Before the first measurement the rows follow writing
     order, which is one un-flashed layout pass (`useLayoutEffect`). */
  const gridRef = useRef<HTMLDivElement>(null);
  const sig = useRef<string>('');
  const [rowsIdx, setRowsIdx] = useState<number[][] | null>(null);

  const fallback: number[][] = [];
  for (let i = 0; i < sections.length; i += 2) fallback.push(sections.slice(i, i + 2).map((_, k) => i + k));
  const rows = rowsIdx ?? fallback;
  const domOrder = rows.flat();

  useLayoutEffect(() => {
    if (mode !== 'mc-grid--rows' || !gridRef.current) return;
    const cards = [...gridRef.current.querySelectorAll<HTMLElement>(':scope > .mc-row > .ds-ng3-section')];
    if (cards.length !== sections.length) return;
    const now = cards
      .map((c) => c.querySelector('.ds-ng3-label')?.textContent?.trim().slice(0, 24) ?? '')
      .join('|');
    if (now === sig.current) return;
    sig.current = now;
    const heights: number[] = Array(sections.length).fill(0);
    cards.forEach((el, k) => {
      heights[domOrder[k]] = el.getBoundingClientRect().height;
    });
    /* Tallest with next-tallest. Pairing far-apart heights is what forces a
       short card to swallow the difference; adjacent ranks keep each row's
       stretch as small as the set allows. An odd card out (5th, 3rd of three)
       takes a row of its own, full width. */
    const order = heights.map((h, i) => ({ i, h })).sort((a, b) => b.h - a.h).map((x) => x.i);
    const next: number[][] = [];
    for (let i = 0; i < order.length; i += 2) next.push(order.slice(i, i + 2));
    setRowsIdx((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });

  if (mode !== 'mc-grid--rows') {
    return (
      <div className={`ds-ng3-grid mc-grid ${mode}`}>
        {sections}
      </div>
    );
  }
  return (
    <div ref={gridRef} className={`ds-ng3-grid mc-grid ${mode}`}>
      {rows.map((idxs, i) => (
        <div className="mc-row" key={i}>
          {idxs.map((j) => sections[j])}
        </div>
      ))}
    </div>
  );
}

// ── row shapes shared by the tabs (thin over the Ng3 primitives) ─────────────

/** Label ↔ toggle row. */
function ToggleRow({
  label,
  on = false,
  info,
  disabled,
}: {
  label: string;
  on?: boolean;
  /** Tooltip copy for the label's ⓘ. Same prop name and same rule as
   *  SliderField: no copy, no icon. Added so a toggle whose NAME does not
   *  explain it can carry the explanation without spending a surface line —
   *  the depth rule's ⓘ layer (copy-rules.md 깊이 규칙, 2026-08-20). */
  info?: string;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(on);
  return (
    <Ng3Row>
      <Ng3Label plain>
        {label}
        {info && <InfoTip tip={info} />}
      </Ng3Label>
      <Toggle checked={checked} onChange={setChecked} aria-label={label} disabled={disabled} />
    </Ng3Row>
  );
}

/**
 * Card-title ⓘ that has something to say: the DS Tooltip around the label's
 * info glyph. Composed locally — the same choice as the tab tooltips in
 * MonitorCanvas — so the shared `Ng3Label` and the other canvases stay
 * untouched. Titles with nothing to add dropped their ⓘ instead (2026-08-08,
 * Cindy): an info icon that opens nothing is decoration.
 */
function InfoTip({ tip }: { tip: string }) {
  // `bottom`, not `top` (2026-09-24, Chris): the tab body scrolls inside the
  // panel now, and a scroll box clips at its top edge — where every top-row
  // card's header ⓘ sits whenever the tab is unscrolled, so an upward popup
  // lost most of itself. Below the ⓘ is inside the card, which is always in
  // the box. (A tooltip that escapes clipping altogether needs a portal-based
  // Tooltip — a library question, not this file's.)
  return (
    <Tooltip content={tip} placement="bottom" className="mt-infotip">
      <button type="button" className="ds-tooltip-trigger" aria-label="More info">
        <Icon name="info" size={13} />
      </button>
    </Tooltip>
  );
}

/** Section-titled slider with its live value in the header row. */
function SliderField({
  label,
  init = 50,
  suffix = '',
  max,
  step,
  format,
  info,
  disabled,
  plain,
  value,
  onChange,
  onCommit,
  managed,
  tag,
}: {
  label: string;
  /** A standing state beside the label — a library `Badge`, not a sentence.
   *  Brightness uses it for `All monitors` (2026-09-23): the caption line it
   *  replaced was 63 of the card's 142 characters. */
  tag?: React.ReactNode;
  init?: number;
  suffix?: string;
  /** Upper bound / granularity, for a slider whose scale is not 0–100. */
  max?: number;
  step?: number;
  /** Render the value as a word instead of a number. A slider over NAMED steps
   *  (Off / Low / Medium / High) is still a slider — the steps are ordered, and
   *  the reader should see the name, not its index. */
  format?: (v: number) => string;
  /** Tooltip copy for the title ⓘ. No copy, no icon — see InfoTip. */
  info?: string;
  disabled?: boolean;
  /**
   * This slider is a control ROW inside a section that already has its own
   * title, so its label drops the mono-caps treatment — the library's rule, in
   * Chris's words on `.ds-ng3-label.plain` (shared/components.css:7340): "Keeps
   * the section title the only caps line in a section", and on the prop itself:
   * "Use for the label beside a toggle/control inside a section". His own tabs
   * follow it both ways (KvmTab rows are plain under a `Sources`/`Switching`
   * title; HeadsetCanvas `Volume` stays caps because there it IS the section
   * title). Default stays caps because three of our five sliders are their
   * section's only control, which makes the label the title.
   */
  plain?: boolean;
  /** Controlled value. Omit and the field keeps its own, as every other caller does. */
  value?: number;
  onChange?: (v: number) => void;
  /** Fired when the drag (or key repeat) ends — for things that should happen
   *  once per gesture, not once per tick. `Slider` forwards unknown props to its
   *  input, so this is the DOM's own end-of-gesture events, not a new mechanism. */
  onCommit?: () => void;
  /** The display is setting this itself — read-only meter, no handle. Drawn by
   *  `.ds-slider.is-managed` (widgets/device-card.css), the SAME class the
   *  Dashboard card's Brightness uses, so the two screens cannot draw one auto
   *  state two ways. Spec = design-assets/component-specs.md SPEC: managed-slider. */
  managed?: boolean;
}) {
  const [internal, setInternal] = useState(init);
  const val = value ?? internal;
  const set = (v: number) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  };
  return (
    <>
      <Ng3Row>
        <Ng3Label strong={!plain} plain={plain}>
          {label}
          {info && <InfoTip tip={info} />}
          {tag && <span className="mc-label-tag">{tag}</span>}
        </Ng3Label>
        <span className="dc-mono-val">
          {format ? format(val) : val}
          {format ? '' : suffix}
        </span>
      </Ng3Row>
      <Slider
        value={val}
        onChange={set}
        max={max}
        step={step}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        aria-label={label}
        disabled={disabled}
        gradient={managed}
        className={managed ? 'is-managed' : undefined}
      />
    </>
  );
}

// `usePicture` / `useBrightnessLevel` moved to `monitorMode.tsx` on 2026-08-31
// so the home board's device card reads and writes the same values this tab
// does — it had been holding its own numbers (rule 15, and the note on those
// hooks says why they are one copy rather than two).

/**
 * Stacked label + segmented control.
 *
 * Uncontrolled by default — most of these are prototype switches whose value
 * nothing else reads. Pass `value`/`onChange` when something outside the field
 * depends on the answer (Port power mode does: it decides whether the port map
 * shows the hub ports as off).
 */
function SegField({
  label,
  values,
  right,
  value,
  onChange,
}: {
  label: string;
  values: string[];
  right?: ReactNode;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [own, setOwn] = useState(values[0]);
  const val = value ?? own;
  const setVal = onChange ?? setOwn;
  return (
    <Ng3Field>
      {right ? (
        <Ng3Row>
          <Ng3Label>{label}</Ng3Label>
          {right}
        </Ng3Row>
      ) : (
        <Ng3Label>{label}</Ng3Label>
      )}
      <ToggleButtonGroup
        aria-label={label}
        value={val}
        onChange={setVal}
        options={values.map((v) => ({ label: v, value: v }))}
      />
    </Ng3Field>
  );
}

/** Label ↔ arbitrary trailing content (badge, value, button). */
function InfoRow({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <Ng3Row>
      <Ng3Label plain>
        {label}
        {sub && <span className="mt-sub"> · {sub}</span>}
      </Ng3Label>
      {children}
    </Ng3Row>
  );
}

// ── Mode helpers ─────────────────────────────────────────────────────────────

/**
 * What a mode actually carries on *this* SKU. The line used to promise
 * "Screen, audio and under-glow" on every monitor, including one with neither
 * speakers nor under-glow — a card describing hardware the device does not
 * have. Built from the feature data instead, so it shrinks with the SKU.
 */
function modeScopeNote(features: Features): string {
  const carried = [
    'Screen',
    features.audio?.speakers ? 'audio' : null,
    features.underGlow ? 'lights' : null,
  ].filter(Boolean) as string[];
  if (carried.length === 1) return 'Screen settings follow the mode.';
  const last = carried.pop();
  return `${carried.join(', ')} and ${last} follow the mode.`;
}

// The Lights tab speaks two colour dialects: a preset's `glow` is a bare "r,g,b"
// and the editor's live paint arrives as "rgb(r, g, b)" (hslToRgbStr). Settings
// stores a hex, so both land here and one parser takes them.
function rgbToHex(rgb: string): string | null {
  const n = rgb.match(/\d+/g)?.slice(0, 3).map(Number);
  if (!n || n.length < 3 || n.some((v) => v > 255)) return null;
  return '#' + n.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * The Lights tab — Chris's engine, mounted as-is. `LightingTab` is the very
 * component the keyboard renders (devices/LightingTab.tsx, imported rather than
 * re-drawn: rule 15, and his own instruction on the 1:1 of 2026-08-11 — "grab
 * the lights tab from keyboard or whatever device… Just bring that in as is").
 * Everything display-specific is in the wires below, not in a second lighting UI:
 *   · picking a preset becomes this mode's under-glow colour, remembered against
 *     the mode the way the old swatch row did
 *   · the editor's live paint previews without claiming a save
 *   · the brightness rail is the strip's level, shared through Settings so the
 *     hero desk map and the Perform card show the same light
 * The master toggle sits in the panel header beside this tab's title — the
 * same `headerExtra` slot the keyboard and headset canvases use for their
 * power toggles (moved from the retired Overview card, 2026-08-18, Cindy).
 * One switch, one home, and it never duplicates into the tab body.
 */
export function LightsTab() {
  const { underGlow, setUnderGlow } = useSettings();
  const modeState = useMonitorMode();
  const { enabled } = underGlow;
  // Same source the header toggle and the hero desk map read. The light is
  // remembered against the
  // mode, so this tab has to know which mode is in view before it writes — and
  // it reads it here rather than taking a prop because MonitorCanvas mounts the
  // tabs from inside its own provider, where it cannot call the hook itself.
  const mode = modeState?.mode ?? '';
  const locked = MODES_LOCKING_GLOW.includes(mode);
  const gated = !enabled || locked;

  const paint = (rgb: string, remember: boolean) => {
    if (gated) return;
    const hex = rgbToHex(rgb);
    if (!hex) return;
    setUnderGlow({
      ...underGlow,
      color: hex,
      // Picking remembers; dragging inside the editor does not. A per-mode write
      // on every tick of a colour drag stores sixty answers to one question.
      // And nothing is remembered before a mode is chosen — the modal opens with
      // no mode selected (regression-invariants.md), so writing then would file
      // this colour under the empty string and hand it to whichever mode reads
      // that key next. Measured on the first run of this wiring: byMode {"": …}.
      ...(remember && mode ? { byMode: { ...underGlow.byMode, [mode]: hex } } : {}),
    });
    if (remember) modeState?.markSaved();
  };

  return (
    <>
      {gated && (
        <Ng3Section>
          <p className="mt-note">
            <span>
              {locked ? (
                <>
                  {/* Inline in a sentence, so this one is sized to the text it
                      sits in rather than to the 14 the fold labels use. 11 → 13
                      is as far as it goes before the line grows. */}
                  <Icon name="lock-on" size={13} aria-hidden /> {mode} holds the light at neutral
                  white and low, so presets are read-only here. Switch mode above to change it.
                </>
              ) : (
                <>Lights are off — turn them on with the switch beside the <b>Lights</b> title above.</>
              )}
            </span>
          </p>
        </Ng3Section>
      )}
      {/* The same gate this card already used for its master toggle (dim + inert
          + aria-disabled), so "off" is not a lie the presets keep contradicting. */}
      <div className={'mt-gate' + (gated ? ' is-off' : '')} aria-disabled={gated}>
        <LightingTab
          onApplyAll={(glow) => paint(glow, true)}
          onPaintSelected={(c) => paint(c, false)}
          brightness={underGlow.brightness}
          onBrightness={(v) => {
            setUnderGlow({
              ...underGlow,
              brightness: v,
              byModeLevel: { ...(underGlow.byModeLevel ?? {}), [mode]: v },
            });
          }}
        />
      </div>
    </>
  );
}

// The JUST CONNECTED first-hour card that lived here (08-06 → 09-22) is gone —
// Cindy, 2026-09-22: three sentences and one `Done`; nothing to do but read.
// Admin's `First-time setup` button keeps working: it still resets Gear Switch
// to its not-set-up state, which is the first-hour moment Connectivity shows.
// Only its `monitorFirstHour` flag no longer draws anything here.


// ── Connectivity ─────────────────────────────────────────────────────────────

/**
 * Where each wireless receiver physically lives — the axis of the state model
 * (design-assets/kvm-redesign-2026-08.md, sheet v2): all 'hub' = KVM active,
 * all 'direct' = screen-only (a legitimate setup, not an error), mixed = gear
 * misalignment. No SKU sets `receivers` yet, so data defaults to state ③; the
 * branches are data-driven, not demo switches.
 */
type GearPlacement = Record<string, 'hub' | 'direct'>;

// Four options, Cindy 2026-08-03. `Ctrl ×2` STAYS in the list — it is the
// documented convention for a monitor's built-in KVM (verifier-log 2026-07-30,
// 🟢: shipped OMEN 27k default, HP Display Center's KVM hotkey, ATEN/IOGEAR
// boxes offering it as the alternative). What it no longer is: this SKU's
// shipped value. Software sync on 2026-08-13 said *"control control doesn't
// work anymore, it's something else"* and the replacement is unknown
// (verifier-log 2026-08-13, 🔴), so asserting it as the default would put a
// retired value on the surface of a prototype that goes outside — the exact
// failure `Ctrl + Alt + 1` caused in 2026-07-09, where a demo value hardened
// into a spec and reached a team review.
//
// `Off` is the default instead, and it is a real state rather than a stand-in:
// the hotkey is a user-assigned value (verifier-log 2026-07-29 action), so
// shipping with none set is honest, and the switch caption already falls back
// to the monitor's KVM button when there is no working hotkey. Put a default
// back only when the new shipping value is known.
/**
 * The pixel count behind a resolution NAME, for the one row that talks about a
 * signal rather than a panel.
 *
 * Why a map and not a reuse: `arrangement.ts` already holds 3840×2160 and
 * 2560×1440 in `LOGICAL`, and borrowing it would have been wrong. That table is
 * the space the CURSOR travels — its own comment says the numbers are logical
 * points that a real implementation reads from the user's scaling, which is why
 * a 16" MacBook is 3456×2234 physical and 1728×1117 there. A signal is native.
 * The two agree for these monitors today and would diverge the moment scaling
 * enters, so they stay separate on purpose (searched web/src + shared/ for an
 * existing name→pixel map: none, this is the first).
 *
 * Unknown names fall through to the name itself rather than to a guess — a SKU
 * whose resolution we have not mapped says `WQHD · 240 Hz`, which is true, and
 * never borrows another monitor's pixels. That borrowing is what this fixes:
 * both rows were literals, so OMEN OLED 27 (QHD, no Thunderbolt input) was
 * reporting 3840 × 2160 over Thunderbolt 4.
 */
const RESOLUTION_PX: Record<string, string> = {
  '4K UHD': '3840 × 2160',
  QHD: '2560 × 1440',
  FHD: '1920 × 1080',
};

function signalLine(display: Features): string | null {
  const name = typeof display.resolution === 'string' ? display.resolution : '';
  const px = RESOLUTION_PX[name] ?? name;
  const hz = typeof display.refreshRate === 'number' ? `${display.refreshRate} Hz` : '';
  return [px, hz].filter(Boolean).join(' · ') || null;
}

const GEAR_HOTKEYS = ['Ctrl ×2', 'Scroll Lock ×2', 'Ctrl + Alt + K', 'Off'];
const GEAR_HOTKEY_UNSET = 'Off';

/**
 * Sharing — the half of Gear Switch the monitor cannot do alone. All three
 * need the app on the other computer too, which is the one thing they have in
 * common and the reason they share a fold (verifier-log 2026-07-30: cursor
 * position is OS-layer information, and the other two are the same Device
 * Bridge family).
 *
 * The card reads as two layers, and this is the lower one. Switching — active
 * computer, hotkey, auto-switch on input change — stays on the surface because
 * the monitor sees the signal itself and works on a PC with nothing installed.
 * That split is not ours: OMEN ships one name with layers stacked on it, where
 * the hardware switch works alone and Gaming Hub adds cursor crossing, file
 * transfer and clipboard sharing on top (verifier-log 2026-08-27, 🟢 Verified
 * against two independent reviews). We converged on it rather than invented it.
 *
 * `Clipboard sharing` joined on 2026-08-28: the same research found OMEN does
 * it, and the 2026-08-19 call was to build every feature rather than scope one
 * out. `File transfer` is the settled label, sentence case, matching HPX rather
 * than a name invented here (`hpx-setup-guides-copy-direction.md`, "Copy
 * rules").
 *
 * They are NAMED here, not drawn as controls. Until 2026-08-28 these were
 * `disabled` toggles, and Cindy's redefinition that day retired that shape: a
 * padlock (or a dead toggle, which reads as one) belongs only on something the
 * person themselves locked. What they cannot use yet is not shown as a broken
 * switch — it is named, with the thing that makes it arrive. The count stays in
 * the closed line for the reason it was put there on 2026-08-20: an external
 * reviewer with no context has to be able to see that more exists here.
 */
const GEAR_SHARING = ['Auto-switch on cursor crossing', 'File transfer', 'Clipboard sharing'];

/**
 * `pcs` = how many computers are cabled to THIS monitor, when that is a fact of
 * the monitor rather than of the desk. The OMEN OLED 27 is MacBook's screen and
 * nothing else (the desk model, chris-decisions 2026-07), so its card sits in the
 * one-computer state whatever Admin says the desk holds. Omitted = the desk's
 * count, which is what the Treehouse 32 — the monitor both computers share — reads.
 */
function GearSwitchSection({ gear, pcs }: { gear: Features; pcs?: number }) {
  const [enabled, setEnabled] = useState(true);
  const [softOpen, setSoftOpen] = useState(false);
  const hosts: string[] = Array.isArray(gear.hosts) ? gear.hosts : DESK_HOSTS_FALLBACK;

  // Routing lives in shared Settings, same as the upstream KVM tab, so the
  // peripheral cards keep reading "on PC 1" vs "handed off" (KvmTab.tsx:20).
  // `configured` gates the set-up state the same way.
  const { kvm, setKvm, pcCount: deskPcs } = useSettings();
  // The layout decides whether switching moves the screen at all (see `moved`).
  const modeState = useMonitorMode();
  const pcCount = pcs ?? deskPcs;
  // Its own state, not `softOpen`: that fold belongs to the two-computer card
  // and reusing it would make one card's fold remember the other's.
  const [oneOpen, setOneOpen] = useState(false);
  const active = kvm.activePc === 'pc2' ? hosts[1] : hosts[0];
  const other = kvm.activePc === 'pc2' ? hosts[0] : hosts[1];
  const setActive = (h: string) => setKvm({ ...kvm, activePc: h === hosts[1] ? 'pc2' : 'pc1' });

  // The hotkey is a user-assignable control, not a fixed badge; 'Off' answers
  // the shipped-OMEN-27k pain "can't disable it" (verifier-log 2026-07-30).
  // The SKU may still name one — the fallback is unset, not the first option
  // (see GEAR_HOTKEYS above for why the first option must not be the default).
  const [hotkey, setHotkey] = useState(
    typeof gear.hotkey === 'string' && GEAR_HOTKEYS.includes(gear.hotkey)
      ? gear.hotkey
      : GEAR_HOTKEY_UNSET,
  );

  const placement: GearPlacement = {
    keyboard: 'hub',
    mouse: 'hub',
    ...(gear.receivers && typeof gear.receivers === 'object' ? gear.receivers : {}),
  };
  const followers = Object.keys(placement).filter((g) => placement[g] === 'hub');
  const strays = Object.keys(placement).filter((g) => placement[g] === 'direct');

  // State ①: second PC detected, Gear Switch not set up. Same parts the
  // first-hour card used until 2026-09-22 — no new CSS.
  //
  // One PC: the whole feature is off the table, and it says so where the pitch
  // used to be (2026-08-20, Cindy's Admin `Desk` axis). This branch comes FIRST
  // and ignores `kvm.configured` on purpose — a desk that has been set up and
  // then lost its second computer must not keep showing switching controls for a
  // computer that is not there. The lock line is the grammar this card already
  // uses at its foot for `Needs Treehouse on both PCs`, so the tab says
  // "possible, not now" in one voice rather than two.
  if (pcCount < 2) {
    return (
      <Ng3Section>
        <Ng3Row>
          <Ng3Label strong>
            Gear Switch
            <InfoTip tip="Built-in KVM — moves your keyboard and mouse between the computers connected to this monitor." />
          </Ng3Label>
        </Ng3Row>
        {/* A fold, not a paragraph (2026-08-20 evening, consultant review).
            The two sentences that used to sit here said what the ⓘ on the title
            two lines up already says — "moves your keyboard and mouse between
            the computers connected to this monitor" — so the card spent 90px of
            the most common desk state (verifier-log 2026-07-13: two-computer
            desks are established in our target segments but NOT the consumer
            majority) repeating its own tooltip.

            What replaces it is this tab's own grammar, not a new one: the same
            `condition + count` line the software rows use at this card's
            foot, and the one VIEWING MODE grew this evening. Before this, one
            fact — one PC — was answered by two different shapes in the same
            tab: a prose card here, a fold there.

            The card itself STAYS. If most desks have one computer, the title is
            the only place its owner ever learns this monitor has a built-in KVM,
            so collapsing the card away would trade a text problem for a
            discoverability one. Only the prose folds. */}
        <button
          type="button"
          className={'mt-fold' + (oneOpen ? ' is-open' : '')}
          aria-expanded={oneOpen}
          onClick={() => setOneOpen((v) => !v)}
        >
          {/* No padlock, and the condition instead of the refusal (2026-08-21,
              Cindy). One glyph had come to carry three different meanings on
              this screen: "another setting holds this value", "we have not
              built it yet", and "your desk is missing a piece". Only the first
              is a lock the person cannot open. A second PC is something they
              CAN add, so the line names what arrives rather than what is
              withheld — same fold, same count, no padlock. The glyph keeps its
              job where the value really is held elsewhere (`Set by
              calibration`; the mode line on Lights). */}
          <span className="ds-ng3-label plain">With a second PC</span>
          <span className="dc-mono-val">3</span>
          <Icon name="chevron-right" size={14} aria-hidden />
        </button>
        {oneOpen && (
          <div className="mt-locked-rows">
            {/* Opened, it shows what arrives with a second computer — the three
                controls this card runs, in the order they appear there. Not a
                mock-up of them: `Active computer` is a FACT with one PC (it is
                that PC), so it shows the name rather than a two-way segment
                that would contradict the state one line above. */}
            <Ng3Row>
              <Ng3Label plain>Active computer</Ng3Label>
              {/* The computer that IS on the desk — `hosts[0]` is the SKU's first
                  name and said MacBook on a tower-only desk (2026-09-18). */}
              <span className="dc-mono-val">{deskPcNames()[0]}</span>
            </Ng3Row>
            <Ng3Row>
              <Ng3Label plain>Switch hotkey</Ng3Label>
              {/* Not a disabled dropdown. With one PC no hotkey is SET, and the
                  wrapper falls back to the first option for any value it does
                  not know (Dropdown.tsx:49) — so a dropdown here would print a
                  real key combination as though someone had chosen it. That is
                  the same error `Off` made: a stand-in read as a state. `—` is
                  this repo's own mark for "no value yet" (NetworkBoosterCard,
                  ChangelogTable) and it matches the value shape of the row
                  above, where the answer is also a fact rather than a control. */}
              <span className="dc-mono-val">—</span>
            </Ng3Row>
            <Ng3Row>
              <Ng3Label plain>Auto-switch on input change</Ng3Label>
              {/* Was a disabled Toggle — the last dead control on this card
                  after the sharing fold dropped its own (2026-08-28, Cindy: a
                  switch that cannot be pressed reads as broken, not as absent).
                  `—` matches the hotkey row one line up, where the answer is
                  also "nothing yet, arrives with the second PC". */}
              <span className="dc-mono-val">—</span>
            </Ng3Row>
          </div>
        )}
      </Ng3Section>
    );
  }
  if (!kvm.configured) {
    return (
      <Ng3Section>
        <Ng3Row>
          <Ng3Label strong>
            Gear Switch
            <InfoTip tip="Built-in KVM — moves your keyboard and mouse between the computers connected to this monitor." />
          </Ng3Label>
        </Ng3Row>
        {/* .mt-note is a flex row (icon + text); mixed inline content must be
            one flex item or the <b> becomes its own column.
            One sentence shorter than it was (2026-08-20, depth rule): the middle
            sentence — "share this display, keyboard and mouse across both
            computers" — said what the title's ⓘ already says, one line apart.
            What stays is what only this moment knows: the trigger fact, and the
            reason it is safe to press the button on a PC that has nothing
            installed. */}
        {/* Down to the trigger fact alone (2026-08-24). In the narrow column
            this card lives in since the tab became three subjects, the second
            sentence — "Saved to the monitor — it works even on a PC without
            Treehouse" — ran the note to three lines to answer a question nobody
            has yet: whether pressing this is safe on a machine with nothing
            installed. That is reassurance about an outcome, so it belongs where
            the outcome is, and the title's ⓘ already carries what the feature
            is. Same move the one-PC state made on 2026-08-21, one state over. */}
        <p className="mt-note">
          <span>
            {/* The port is read, not typed: it said `USB-C`, which is where the
                MacBook is, while the port map puts the second computer on `DP 1`
                (2026-09-21 flow audit). It is the port's own `label` — what its
                hover card and its Inputs row are titled (the plate itself draws
                the DisplayPort logo over that port, not the words). */}
            <b>Second PC detected on {hostPort(pcsOnDesk()[1] ?? 1)?.label ?? 'a second input'}.</b>
          </span>
        </p>
        <Ng3Row>
          {/* `Turn on`, not `Set up Gear Switch`: the title above already names
              the feature (it was said three times in one card), and the button
              does not open a set-up flow — there is nothing to ask, and the
              defaults are safe (auto-switch OFF, 2026-07-21). The old label
              promised a wizard the design deliberately does not have. */}
          <Button size="sm" variant="accent" onClick={() => setKvm({ ...kvm, configured: true })}>
            Turn on
          </Button>
        </Ng3Row>
      </Ng3Section>
    );
  }

  // Gear status appears only when it deviates from "everything follows":
  // state ② (all receivers direct) gets a neutral screen-only note, state ④
  // (mixed) gets a warning row per stray gear. In the normal state the switch
  // caption below the segment already says what follows — a standing summary
  // line would repeat it (the duplication class decision 4 removed).
  const gears = (list: string[]) => {
    const s = list.join(' & ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // The switch-result caption is a function of the state: say what actually
  // moves, and only promise a way back that physically works — the monitor
  // cannot see the hotkey unless the keyboard sits on its hub.
  // A divided screen (PBP/PIP) already shows both computers, and which one
  // takes the main pane is `Main screen`'s job on the VIEWING MODE card — so
  // here switching moves the keyboard & mouse only. Saying "the screen" too
  // gave one question two doors (2026-09-22, Cindy — Connectivity structure
  // review: Active computer = OMEN 35L sat beside Main screen = MacBook).
  const hotkeyWorks = hotkey !== 'Off' && placement.keyboard === 'hub';
  const split = !!(screenLayout(modeState?.layout)?.units || screenLayout(modeState?.layout)?.pip);
  const moved = split
    ? `your ${followers.join(' & ')}`
    : followers.length === 0
      ? 'the screen only'
      : `the screen and your ${followers.join(' & ')}`;
  const switchTip =
    split && followers.length === 0
      ? 'Both computers are already on screen, and the keyboard & mouse stay with the computer they are plugged into.'
      : `Switching moves ${moved} to ${other}. ${
          hotkeyWorks ? `Press ${hotkey} to come back.` : 'Use the KVM button to come back.'
        }`;

  return (
    <Ng3Section>
      <Ng3Row>
        <Ng3Label strong>
          Gear Switch
          <InfoTip tip="Built-in KVM — moves your keyboard and mouse between the computers connected to this monitor." />
        </Ng3Label>
        <Toggle checked={enabled} onChange={setEnabled} aria-label="Gear Switch" />
      </Ng3Row>
      {followers.length === 0 && (
        <p className="mt-note">
          <span>
            Screen only — the keyboard & mouse receivers are plugged into the computer, so they
            stay put.
          </span>
        </p>
      )}
      {strays.length > 0 && followers.length > 0 && (
        <Ng3Row>
          <Ng3Label plain>{gears(strays)}</Ng3Label>
          <Badge variant="status" tone="warn">
            {strays.length === 1 ? 'Stays' : 'Stay'} put — receiver on the computer
          </Badge>
        </Ng3Row>
      )}

      <Ng3Field>
        {/* A row label, not a second card title (2026-09-23, Cindy's review of
            this card): `ACTIVE COMPUTER` in the section-label caps sat under
            `GEAR SWITCH` in the same caps, so the card read as two titles. The
            third type level this wants is the library request already queued;
            until then it takes the row voice `Switch hotkey` uses two lines down. */}
        <Ng3Label plain>
          Active computer
          {/* This sentence used to sit UNDER the segment as a standing caption
              (2026-08-03 decision 2 put it there). It is on demand now, by
              Cindy's call on 2026-08-20: *"캡션 문구는 항상 떠 있는 거야? 필요할
              때만 볼 수 있는 식으로 가야 되는 거 아니니?"* — and the measurement
              agrees. Visible text on this tab was 482 characters, 292 of them in
              this one card, and 150 of THOSE were two always-on sentences: half
              the card was prose, in the tab whose own `VIEWING MODE` runs nine
              controls on seven characters each.
              What it says is unchanged, including the branch that only promises
              a way back that physically works. It is a question you ask BEFORE
              the first press and never after, which is the depth rule's own test
              for `Folded`/ⓘ (copy-rules.md, 2026-08-20). Dynamic tips are the
              existing pattern here, not a new one — `MODES & PRESETS`'s ⓘ has
              interpolated `modeScopeNote(features)` since 2026-08-08. */}
          <InfoTip tip={switchTip} />
        </Ng3Label>
        <ToggleButtonGroup
          aria-label="Active computer"
          value={active}
          onChange={setActive}
          options={hosts.map((h) => ({ label: h, value: h }))}
        />
      </Ng3Field>

      <Ng3Row>
        <Ng3Label plain>Switch hotkey</Ng3Label>
        <Dropdown
          aria-label="Switch hotkey"
          value={hotkey}
          onChange={setHotkey}
          options={GEAR_HOTKEYS.map((k) => ({ label: k, value: k }))}
        />
      </Ng3Row>

      {/* Zone 2/3: the app never takes the keyboard on its own guess (B8).
          Three toggles, split across two layers by ONE fact — whether the
          monitor can do it alone.

          `Auto-switch on input change` stays on the surface because the monitor
          detects the signal itself, so it works on a PC with nothing installed.
          The other two are the software path (verifier-log 2026-07-30: cursor
          position is OS-layer information, so both hosts need the app; file
          transfer is the same Device Bridge family), and they arrive folded.

          Why the fold's LABEL is the requirement: it was a 56-character note
          under the rows saying "Both need Treehouse installed on the other
          computer too." As the label it does the same job with the sentence
          gone from the surface — and rule 10 ⓒ still holds, because the reason
          a control is locked is now the first thing you read about it instead
          of a line below it.

          ⚠️ This does NOT hide that the features are designed — the call Cindy
          made earlier today was to keep them visible for an external prototype,
          and that is why the count is IN the closed line. `2` in a line that
          names the condition says "two more exist and here is the catch" more
          legibly than three greyed toggles, which a reviewer with no context
          reads as broken rather than deliberate. Shape borrowed from
          `Eye comfort`, landed the same evening (`c336edf`): a count, not the
          feature names — the names are the longest string the slot can hold and
          the place translation expands worst. */}
      <ToggleRow label="Auto-switch on input change" />
      <button
        type="button"
        className={'mt-fold' + (softOpen ? ' is-open' : '')}
        aria-expanded={softOpen}
        onClick={() => setSoftOpen((v) => !v)}
      >
        {/* Padlock gone, condition kept (2026-08-21, Cindy) — see the one-PC
            fold above for why. This is the one gate on this card a person can
            actually clear today, so the wording names the thing they'd install
            rather than the wall. No `Get Treehouse` button sits here on
            purpose: the product has no install flow to point at (searched
            `web/src` + `shared/` for install/download affordances — only
            `Installed` badges), and a button that does nothing is the exact
            shape we are removing from this card. Logged as not-built instead. */}
        <span className="ds-ng3-label plain">With Treehouse on both PCs</span>
        <span className="dc-mono-val">{GEAR_SHARING.length}</span>
        <Icon name="chevron-right" size={14} aria-hidden />
      </button>
      {softOpen && (
        <>
          {/* Names, not switches (2026-08-28). What sat here was three
              `disabled` toggles, and a dead toggle is a padlock wearing another
              coat — it says "broken" to a reviewer with no context, which is
              the reading rule 10 ⓒ exists to prevent. Opened, the fold now
              answers the question its own label raises: what arrives. */}
          {/* `—` on the right (2026-08-28, Cindy): every other row in this card
              is name-left, something-right, so a bare name reads as a row whose
              CONTROL fell off rather than a fact with no value yet. `—` is this
              file's own mark for "no value yet" (the one-PC hotkey row, the
              This-connection fallback) — the row shape stays, the promise of a
              control goes. */}
          {GEAR_SHARING.map((label) => (
            <Ng3Row key={label}>
              <Ng3Label plain>{label}</Ng3Label>
              <span className="dc-mono-val">—</span>
            </Ng3Row>
          ))}
          {/* The other computer BY NAME, because that is the only thing this
              fold knows that its label does not. Still not a button: the
              product has no install flow to point at (searched `web/src` +
              `shared/` — only `Installed` badges and Network Booster's
              `Download`), and the backlog entry that owns this gap forbids a
              dead `Get Treehouse` here for the same reason the toggles above
              just left (`phase2-backlog.md`, 2026-08-21). When an install flow
              exists, this line is where its door goes. */}
          <p className="mt-note">
            <span>Install Treehouse on {other}.</span>
          </p>
        </>
      )}
    </Ng3Section>
  );
}

/**
 * How the display shows its sources — the layout picker (Full Screen/PBP/PIP).
 * Back on Connectivity (2026-08-08 afternoon, Cindy). The morning move to
 * Display leaned on "Connectivity's hero shows the rear", and the same day's
 * Connectivity-front decision (`ia-section5.md` "Connectivity 앞면") removed
 * that: the hero stays front and DRAWS this layout, and PBP's depth (which
 * two inputs, PIP position/size, audio side) is folded into this tab's
 * redesign — one feature, one tab. The 07-31 call was only ever "own
 * section, out of the KVM card", never a tab move.
 * Data stays `display.viewingModes` (a screen attribute); no fallback, so a
 * SKU without the field has no card instead of claiming PBP it may not have.
 */
function ViewingModeSection({ display, gear }: { display: Features; gear: Features }) {
  const modes: string[] = Array.isArray(display.viewingModes) ? display.viewingModes : [];
  const m = useMonitorMode();
  /* The same fallback pair `GearSwitchSection` uses, read from the same SKU
     field: the depth rows name computers, and this is where their names live. */
  const hosts: string[] = Array.isArray(gear.hosts) ? gear.hosts : DESK_HOSTS_FALLBACK;
  // Splitting a screen needs two things ON it. The count lives on the desk, not
  // in this card, which is why it is read here and passed down rather than
  // guessed from the layout list (2026-08-20, Cindy: the picker should only be
  // there when two computers are).
  const { pcCount, viewingMode, setViewingMode } = useSettings();
  if (modes.length === 0) return null;
  return (
    <Ng3Section>
      {/* Wired to the mode state, not to a local useState. Left unwired this
          control changed nothing at all — the same trap `portPower` was in on
          Connectivity — and a layout is mode-scoped state
          (`profile-proposal-2026-07.md:59`), so the value has to live where the
          mode can restore it. Outside a monitor canvas there is no mode state,
          so the picker falls back to being its own local control rather than
          crashing.

          Tiles, not a segmented control (2026-08-20, Cindy). Three words became
          eight diagrams drawn from her own `Screen Layout` component — see
          ViewingModeTiles for the geometry and why the set is eight. */}
      <ViewingModeTiles
        modes={modes}
        value={m ? m.layout : undefined}
        onChange={m ? m.setLayout : undefined}
        secondSource={pcCount > 1}
        /* One computer: name the one on the desk, not the SKU's first. */
        sources={pcCount > 1 ? hosts : deskPcNames()}
        /* The three depth answers save straight to `viewingMode`, beside the
           layout they belong to — see `ViewingModeState` for why they are not
           under `byMode` with it. */
        detail={viewingMode}
        onDetail={(patch) => setViewingMode({ ...viewingMode, ...patch })}
      />
    </Ng3Section>
  );
}

export function ConnectivityTab({ features }: { features: Features }) {
  const conn = features.connectivity || {};
  const inputs: string[] = Array.isArray(conn.inputs) ? conn.inputs : [];

  /**
   * Both of these describe the rear ports, so they live here — one level above
   * the port map and the fullscreen X-ray, which are the two things that draw
   * them (2026-08-06).
   *
   * `portPower` used to be trapped inside SegField's own useState, so Limited
   * changed the toggle and nothing else; `names` used to not exist at all, and
   * the rename fields were two hardcoded rows that went nowhere.
   */
  const [portPower, setPortPower] = useState('Full');
  const [names, setNames] = useState<PortNames>({});
  /**
   * The port being pointed at, tab-wide (2026-08-20, Cindy). Lives here because
   * two cards share it: pointing at a `RENAME INPUTS` row lights that port on
   * the REAR PORTS plate above. The cards themselves stay plain library cards —
   * linking them is state, not layout (a card split into zones was tried and
   * reverted the same day).
   *
   * TWO states, not one, and this is the bug Cindy caught: *"선택이 되어져 있는
   * 것은 Realports 맵에 안 뜨거든"*. With a single value, clicking into a field
   * (which selects it — it keeps the focus ring) and then moving the mouse off
   * the row fired `mouseleave` and cleared the lamp, so the map went dark while
   * the field was still selected. Hover is transient, selection is not; the map
   * shows the pointer when there is one and falls back to the selection.
   */
  const [hoverPort, setHoverPort] = useState<string | null>(null);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  // Sketch 2026-08-24: the two folds the rear-panel card carries.
  const [inputsOpen, setInputsOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);

  // `Signal` comes from this SKU's panel, and the link from the port list. Both
  // were literals until 2026-08-20, so every monitor claimed the Treehouse 32's
  // cable — verified live on OMEN OLED 27, which is QHD with no Thunderbolt
  // input (`connectivity.inputs` = HDMI 2.1 ×2 · DP 1.4 · USB-C 65W) and was
  // still reporting `3840 × 2160 · 240 Hz` over `Thunderbolt 4`.
  //
  // The link reads `PORTS`, which is the Treehouse 32's rear panel and says so
  // in its header — that file exists BECAUSE these same facts had drifted across
  // three copies (2026-08-06), and these two rows were the fourth. `inputs[0]`
  // is not the alternative it looks like: that array is what the monitor
  // ACCEPTS, so reading it as what is plugged in now would call OMEN's HDMI
  // capability an active HDMI connection. So the row is gated on having a port
  // list at all — `features.xray`, the same field that gates the port map — and
  // a monitor without one shows signal and power mode, which is all we know.
  const signal = signalLine(features.display || {});
  // The cable from THIS computer — the one the app is running on, which is the
  // first computer on the desk (the peripherals' "handed off" badge is already
  // written from that seat). It was pinned to `c2`, the MacBook's port, so a
  // tower-only desk said `USB-C Thunderbolt 4` about a DisplayPort cable
  // (2026-09-21 flow audit).
  const upstream = features.xray ? hostPort(pcsOnDesk()[0]) ?? PORTS.find((pt) => pt.id === 'c2') : undefined;
  const pointedPort = hoverPort ?? selectedPort;
  const limited = portPower === 'Limited';

  // PROTOTYPE 2026-08-04 — the hero keeps the arrangement and turns the selected
  // display around, so the port map comes back down here where it has the full
  // panel width. The text inputs list stays suppressed: the map carries the
  // ports (Cindy 2026-07-23).
  /* Built here rather than inline, because where it goes depends on whether
     this monitor has a port map: beside the plate when there is one, back in
     the column pack when there is not. */
  /* The rows come from the port list, and typing here changes what the port map
     and the X-ray call that device. Pointing at a row lights that port on the
     REAR PORTS plate beside it — the answer to "which one is my MacBook plugged
     into" is the wiring, not a layout move (the rows were moved INTO the port
     map card for one afternoon and reverted: a card split into zones is not a
     library pattern; Cindy, 2026-08-20). Handlers sit on the row, not the
     input, so pointing at the label works too; focus covers keyboard users. */
  // Only what is plugged in on THIS desk — DP 1 had a row to rename on a desk
  // with no tower (2026-09-21).
  // A monitor with no plate lists every video input from its spec instead —
  // same rows, same fold (2026-09-23, `specPorts`).
  const renameRows = features.xray ? PORTS.filter((p) => p.renameable && isPlugged(p)) : specPorts(inputs);
  // What a row shows: the plugged device's name, or a name typed for a port
  // that is empty today (only reachable on the spec rows, which list empties).
  const rowName = (p: (typeof renameRows)[number]) => connectedName(p, names) ?? names[p.id] ?? '';
  const namedCount = renameRows.filter((p) => rowName(p)).length;

  /* SKETCH 2026-08-24 — the rear panel as ONE card, the way Cindy put it: the
     plate, the names that point at it, and the cable that arrives in it are one
     subject with one physical anchor. They were three cards in a row of five,
     which is why the tab's bottoms were ragged (measured 1440px: 177 / 191 /
     228 / 196 / 153).
     They arrive as FOLDS, not as zones — the 2026-08-20 revert was a card cut
     into regions, and a `.mt-fold` is a row, the same row OLED Care and the
     mode card already use. Closed, each still answers its question. */
  const inputsFold = (
    <>
      {/* The rule under the plate. With no plate the fold sits right under the
          card title, the way `This connection` does on every other card. */}
      {features.xray && <span className="dc-divider" />}
      <button
        type="button"
        className={'mt-fold' + (inputsOpen ? ' is-open' : '')}
        aria-expanded={inputsOpen}
        onClick={() => setInputsOpen((v) => !v)}
      >
        <span className="ds-ng3-label plain">Inputs</span>
        <span className="dc-mono-val">
          {namedCount ? `${namedCount} named` : `${renameRows.length} connected`}
        </span>
        <Icon name="chevron-right" size={14} aria-hidden />
      </button>
      {inputsOpen &&
        renameRows.map((p) => (
          <Ng3Row
            key={p.id}
            onMouseEnter={() => setHoverPort(p.id)}
            onMouseLeave={() => setHoverPort(null)}
          >
            <Ng3Label plain>{p.label}</Ng3Label>
            <input
              className="ds-input mt-rename"
              value={rowName(p)}
              placeholder={isPlugged(p) ? undefined : 'Not connected'}
              onChange={(e) => setNames((n) => ({ ...n, [p.id]: e.target.value }))}
              onFocus={() => setSelectedPort(p.id)}
              onBlur={() => setSelectedPort(null)}
              aria-label={`Rename ${p.label}`}
            />
          </Ng3Row>
        ))}
    </>
  );
  const connFold = (
    <>
      <span className="dc-divider" />
      <button
        type="button"
        className={'mt-fold' + (connOpen ? ' is-open' : '')}
        aria-expanded={connOpen}
        onClick={() => setConnOpen((v) => !v)}
      >
        <span className="ds-ng3-label plain">This connection</span>
        <span className="dc-mono-val">{upstream?.standard ?? signal ?? '—'}</span>
        <Icon name="chevron-right" size={14} aria-hidden />
      </button>
      {connOpen && (
        <>
          {/* Only when the fold line named the cable instead: with no port map
              the line above IS the signal, and repeating it one row down said the
              same `2560 × 1440 · 240 Hz` twice (OMEN OLED 27, 2026-09-21). */}
          {signal && upstream && <Ng3Spec items={[{ label: 'Signal', value: signal }]} />}
          {/* No `Link` row (2026-09-22, Cindy — Connectivity structure review).
              Its badge printed `upstream.standard`, the value the fold line
              above already shows, and its `Calibrated` badge is a colour fact
              the Display tab owns, not a property of the cable. */}
          {upstream && features.gearSwitch && (
            <InfoRow label="Charging">
              <Badge variant="status" tone="info">90W</Badge>
            </InfoRow>
          )}
          <SegField
            label="Port power mode"
            values={['Full', 'Limited']}
            value={portPower}
            onChange={setPortPower}
          />
        </>
      )}
    </>
  );

  return (
    <>
    {/* The plate and the names that point at it, side by side (2026-08-21,
        Cindy). The plate is a 680px drawing that was sitting alone in a
        934px card — 254px of empty margin — while the rows that light its
        ports sat diagonally across the tab in the third column. Putting them
        in one row spends that margin on the thing that was furthest from it:
        pointing at `C2` now lights a port a hand's width away instead of
        across the panel, and the tab loses ~190px of height because the rows
        cost nothing new (191px of card inside a 194px row).
        Two cards, not one — a card split into zones was tried and reverted
        (2026-08-20). Only their placement is shared, the same way only their
        pointing state is. */}
    {features.xray ? (
      <div className="mc-toprow">
        <PortMapPanel
          skuName="Treehouse 32"
          limited={limited}
          names={names}
          hoverId={pointedPort}
          onHover={setHoverPort}
        >
          {inputsFold}
          {connFold}
        </PortMapPanel>
        {/* The column beside it holds what is NOT about the rear panel: how the
            screen is divided, and the two-computer business. Stacked so their
            two heights add up against the plate's one instead of leaving the
            ragged bottom five cards in three columns produced. */}
        <div className="mc-sidecol">
          <ViewingModeSection display={features.display || {}} gear={features.gearSwitch || {}} />
          {features.gearSwitch ? <GearSwitchSection gear={features.gearSwitch} /> : null}
        </div>
      </div>
    ) : null}
    {/* A monitor with no port map (the OMEN OLED 27) now wears the same two
        columns (2026-09-21, Cindy: "크리스가 만든 OLED 27 디자인을 우리 스타일대로").
        It used to keep the old five-card pack, and the pack carried three things
        that were not this monitor's:
          · Chris's KVM panel — "Second PC detected… Set up KVM", `Switch to Work
            Laptop`, the `Ctrl ×2` hotkey the 08-20 software sync retired — on a
            screen the desk model fixes to MacBook alone. He offered it up on
            08-04 ("totally fine if you just kill this entirely… fix it with your
            design"); `KvmTab.tsx` itself is untouched, only no longer mounted here.
          · `Rename Inputs` rows read from PORTS, which is the Treehouse 32's rear
            panel — so this window renamed C2 / DP 1 / HDMI 1 to MacBook / OMEN
            35L / Console on a monitor with different ports. Dropped until this
            SKU has a port list of its own.
          · Every section open at once, where the Treehouse 32 folds them.
        What replaces it is the Treehouse 32's grammar with nothing new: its
        inputs in one card with the same `This connection ›` fold beside the
        plate, and Gear Switch in its one-computer state in the 306px column. */}
    {!features.xray && (
      <div className="mc-toprow">
        {/* The Treehouse 32's rear-panel card without the plate (2026-09-23,
            Cindy: the two monitors' inputs had become two designs). It was a spec
            list — `HDMI 2.1 ×2` with a link glyph that read as nothing — and a
            `USB Hub · Enabled` line with no action behind it. Now the same two
            folds under the same title: `Inputs` opens one row per port with its
            name field, `This connection` the cable. */}
        <Ng3Section className="mc-inputs">
          <Ng3Label strong>Rear ports</Ng3Label>
          {inputsFold}
          {connFold}
        </Ng3Section>
        {/* `.mc-sidecol` stretches its cards to the left card's height — right
            for the Treehouse 32, whose two cards share that height, and wrong for
            one card: measured 2026-09-21, Gear Switch's single line in a 252px
            box, 180px of it blank (the 08-25 lesson: height added to a short card
            becomes emptiness INSIDE it). So the column only exists when there is
            a second card to stack; alone, the card is `.mc-toprow`'s last child
            and hugs its line. */}
        {Array.isArray((features.display as Features | undefined)?.viewingModes) ? (
          <div className="mc-sidecol">
            <ViewingModeSection display={features.display || {}} gear={features.gearSwitch || {}} />
            {(features.gearSwitch || conn.kvm) && (
              <GearSwitchSection gear={features.gearSwitch || {}} pcs={features.gearSwitch ? undefined : 1} />
            )}
          </div>
        ) : (
          (features.gearSwitch || conn.kvm) && (
            <GearSwitchSection gear={features.gearSwitch || {}} pcs={features.gearSwitch ? undefined : 1} />
          )
        )}
      </div>
    )}
    </>
  );
}

// ── Display ──────────────────────────────────────────────────────────────────

const RGB_GAIN: { ch: string; className: string; val: number }[] = [
  { ch: 'R', className: 'mt-ch-r', val: 100 },
  { ch: 'G', className: 'mt-ch-g', val: 97 },
  { ch: 'B', className: 'mt-ch-b', val: 94 },
];

/**
 * Who is driving the brightness, as ONE exclusive choice.
 *
 * This was two independent switches that could both be on at once while making
 * the same claim — Ambient Sensor here, Dynamic Contrast on the Contrast card —
 * so the tab could say the room sets the level AND the scene sets the level and
 * offer no way to read which one won. One segment, one answer (2026-08-08,
 * Cindy).
 *
 * `Content` is where Dynamic Contrast went, and the 2026-08-04 call on it
 * survives the move intact: it is offered, not defaulted. The costs recorded
 * then are why — 4–8ms of added lag at 144Hz+, brightness pumping on scene
 * changes, crushed shadow detail (verifier-log 2026-08-04) — and the default
 * here is `Ambient`, so nobody meets those by accident.
 */
const AUTO_BRIGHTNESS = ['Off', 'Ambient', 'Content'];

/*
 * (`AUTO_BRIGHTNESS_SOURCE` lived here — a surface line naming whichever source
 * was driving the level. Removed 2026-08-20 (Cindy): the Brightness slider's own
 * ⓘ already says it, and better, because one sentence there covers both sources
 * — "With Auto-Brightness on, the room's light or what's on screen sets the
 * level." One statement was being paid for twice, once on the surface and once
 * in the tooltip. The depth rule's ⓘ layer is where it belongs.)
 */
/**
 * Brightness and the thing that sets it, as ONE control.
 *
 * They were two independent widgets until 2026-08-04: the sensor switch was
 * hardcoded `checked={false}` with an empty handler, and the slider kept its
 * handle no matter what the switch said. So the tab could sit there claiming the
 * room sets the brightness while offering a manual handle to set it yourself —
 * Cindy's question, verbatim: "토글이 켜져 있으면 Auto인데 왜 슬라이더가 Manual
 * Slider야?"
 *
 * Auto ON → the slider is the read-only meter (`managed`), same drawing as the
 * Dashboard card. The segment is the only way back to manual; a managed slider
 * is inert by design, so it cannot be dragged out of auto by accident. That
 * answer now covers `Content` too, because the control is named after being
 * automatic: every setting except `Off` has something other than you moving the
 * number, and a handle you can drag while that happens is a second author for
 * one value.
 *
 * Default auto in every mode, damped response — profile-proposal "What a mode
 * remembers" (2026-07-21). The port had carried the OMEN original's OFF default
 * (prototype.html:15213) and the decision never reached the code.
 */
/**
 * Watts at a given screen level. A floor the panel draws regardless, plus a
 * share that rises with the level — calibrated so 80% (what this SKU ships at)
 * lands on 30.3 W, the figure that was hardcoded here before, so nobody sees the
 * number change for reasons that are not theirs. One decimal, because the row is
 * read as a response to a drag and whole watts would sit still through half of
 * one.
 */
function estimatedDraw(level: number): string {
  const FLOOR = 12.3;
  const PER_PCT = 0.225;
  return (FLOOR + PER_PCT * Math.max(0, Math.min(100, level))).toFixed(1);
}

/**
 * Eye comfort — the two upstream `comfort` toggles that were defined in the spec
 * schema and never given a control (`specSchema.ts`, group `comfort`). Scoped to
 * this SKU by `features.comfort`, like every other optional block.
 *
 * Only two, not three: the group's third field is `adaptiveBrightness`, and that
 * is ALREADY on this card as `Auto-Brightness`'s `Ambient` setting. Shipping all
 * three would have put one value in two places on one card — the failure this
 * window has had to undo twice already.
 *
 * They live in the Brightness card because that is the mechanism, not just a
 * free slot: PWM flicker is an artefact of how brightness is DIMMED and is worst
 * at low levels, so the control that causes it and the control that steadies it
 * belong together.
 */
const EYE_COMFORT = ['Blue Light Filter', 'Flicker-Free'];

/**
 * `Off` / `1 of 2 on` / `All on` — `protectionSummary`'s shape, in the card
 * beside it, on purpose.
 *
 * The first cut named the single feature that was on (`Blue Light Filter`), and
 * that is the longest string this slot can be asked to hold — in the one place
 * where translation expands worst (copy-rules.md rule 1, the 60% budget). A
 * count says the same thing about state, never grows past `1 of 2 on`, and
 * matches what the reader just saw one card over.
 */
function eyeComfortSummary(on: string[], total: number): string {
  if (on.length === 0) return 'Off';
  return on.length === total ? 'All on' : `${on.length} of ${total} on`;
}

function BrightnessSection({ comfort }: { comfort?: Record<string, unknown> | false }) {
  // Persisted since 2026-08-31, and shared with the home card's `Auto` switch:
  // this used to be a local `useState`, so a display someone had put on manual
  // claimed to be automatic again the next time the window was opened, and the
  // card beside it never heard about either answer. The shipped default is
  // unchanged (`Ambient`). Per monitor since 2026-09-18 — each display has its
  // own sensor, so each keeps its own answer.
  const { autoBrightness: autoSource, setAutoBrightness: setAutoSource } = useAutoBrightness();
  const auto = autoSource !== 'Off';
  const [comfortOpen, setComfortOpen] = useState(false);
  // Both OFF at rest. Each costs something real to have on — Blue Light Filter
  // warms every colour on a screen people also grade video on, and steadying the
  // dimming trades away low-brightness image quality — so they are offered, not
  // defaulted. Same call, and the same wording, as Dynamic Contrast's in 2026-08-04.
  const [comfortOn, setComfortOn] = useState<string[]>([]);
  const eyeComfort = comfort
    ? EYE_COMFORT.filter((n) =>
        n === 'Blue Light Filter' ? comfort.blueLightFilter !== false : comfort.flickerFree !== false,
      )
    : [];
  // The level this monitor is on IS the mode's (2026-08-29): "the mode wins, and
  // matching happens inside the mode" — the rule is stated once, on
  // `DisplayPictureState` in Settings.tsx, and this is the surface that obeys it.
  //
  // Before this the slider held `displayBrightness` outright while Match was on
  // and an uncontrolled local number otherwise, so the one control on this tab
  // that everyone touches first was also the only one a mode could not carry.
  //
  // While Personalize → Display holds every screen at one level, this slider is
  // still that level: the write lands on the mode AND on the shared number, so
  // the master slider on that page is not a control that changes nothing you can
  // see (wired-state audit), and the `All monitors` tag below stays true.
  //
  // Both directions of that promise live in `useBrightnessLevel` — the home
  // card calls the same hook, so the two surfaces cannot disagree about what
  // this display's level is.
  const { ecoMode, roomLight } = useSettings();
  const { level, setLevel, synced: displaySync } = useBrightnessLevel();
  // The room moves the slider — but only while the sensor is the source.
  //
  // The caption under this slider has promised since 2026-08 that "the room's
  // light or what's on screen sets the level", and nothing in the prototype
  // could make the room change, so the sentence was a claim with no engine
  // (wired-state audit's own category). Admin → Room light is that engine for
  // a demo: pick Dark and this slider settles low, the way the sensor would.
  //
  // `Off` and `Content` are left alone on purpose. Off means the person took
  // the wheel, and Content is the other source — a room reading has no business
  // overriding either, and that boundary is what makes the caption true rather
  // than merely satisfied.
  useEffect(() => {
    if (roomLight === 'off' || autoSource !== 'Ambient') return;
    const want = LEVEL_FOR_ROOM[roomLight];
    if (level !== want) setLevel(want);
    // `level` is deliberately out of the deps: the person may nudge the slider
    // afterwards and the room should not snatch it back until the room changes.
  }, [roomLight, autoSource]); // eslint-disable-line react-hooks/exhaustive-deps
  // Contrast shares this card with Brightness (one card, two groups — see the
  // divider below), so it reads the same picture store.
  const { picture, setValue } = usePicture();
  return (
    <Ng3Section>
      {/* `All monitors` is a tag on the label, and the sentence it replaced is
          the ⓘ (2026-09-23, Cindy's HyperX review: "글자가 너무 많아 보인다").
          The caption line was 63 of this card's 142 characters and said a
          standing state at sentence length; the state is a word, the "where
          else can I change it" is a question asked once, which is the depth
          rule's own test for ⓘ (copy-rules.md 깊이 규칙).
          Only while this display is on manual: matching sets the matched
          displays to Auto-Brightness Off and turning Auto back on ends the
          match (`useAutoBrightness`), so `synced && auto` is only a state saved
          before that rule. In it the sensor owns the number — the old caption
          said "change it here" over a slider nobody could drag. */}
      <SliderField
        label="Brightness"
        suffix="%"
        info={
          displaySync && !auto
            ? 'Matched across all monitors — change it here or in Personalize.'
            : "With Auto-Brightness on, the room's light or what's on screen sets the level."
        }
        tag={displaySync && !auto ? <Badge variant="status">All monitors</Badge> : undefined}
        value={level}
        onChange={setLevel}
        managed={auto}
      />
      <SegField
        label="Auto-Brightness"
        values={AUTO_BRIGHTNESS}
        value={autoSource}
        onChange={setAutoSource}
      />

      {/* `Estimated draw` — only while Eco Mode is on, and it MOVES.
          Cindy's call, and a better one than mine: I had moved it to Settings
          because it is read-only, which groups by KIND of data; she grouped by
          WHEN anyone wants it, which is what this IA does everywhere else.
          Someone who has not asked to spend less is not owed a watt figure.

          It sits HERE and not beside the Eco switch two tabs away, because the
          only handle that moves it is the slider directly above — a number you
          cannot watch respond is a number you cannot act on.

          What was here was the hardcoded string `30.3 W`, which never changed no
          matter where the level went: a power reading that cannot fall is worse
          than no reading, since it invites exactly the action it will not
          reward. `estimatedDraw` is a straight line instead — a panel floor plus
          a share that scales with the level, landing on the old 30.3 W at the
          80% this ships at, so the number people have seen is preserved and now
          has somewhere to go. It is an ESTIMATE on a concept device; the honest
          part is not the coefficient, it is that the figure responds. */}
      {ecoMode && (
        <Ng3Row>
          <Ng3Label plain>Estimated draw</Ng3Label>
          <span className="dc-mono-val">{estimatedDraw(level)} W</span>
        </Ng3Row>
      )}

      {/* EYE COMFORT — a fold, not two more rows.
          Rarely touched and never after the first time, which is the depth
          rule's Folded case; closed it still says its value, so it is not a
          click toll (copy-rules.md rules 1 and 3). It sits below the brightness
          controls and above Contrast because it belongs to the level, not to
          the picture.

          ⚠️ `Flicker-Free`'s tooltip names Adaptive Sync on purpose. OLED has
          TWO unrelated flickers and this window now has a control for each:
          PWM/dimming flicker, which is an artefact of lowering brightness and is
          worst at low levels, and VRR flicker, which happens while a game's
          frame rate swings. A user who sees flicker cannot tell those apart from
          the labels — and `Adaptive Sync`'s own tooltip, written earlier today,
          says "turn off if dark scenes look like they pulse", which points
          straight at this row. Pointing back is the fix; both controls exist and
          both are in this tab, so this is not the 2026-08-08 mistake of naming a
          screen the design does not have. */}
      {eyeComfort.length > 0 && (
        <>
          <button
            type="button"
            className={'mt-fold' + (comfortOpen ? ' is-open' : '')}
            aria-expanded={comfortOpen}
            onClick={() => setComfortOpen((v) => !v)}
          >
            <span className="ds-ng3-label plain">Eye comfort</span>
            <span className="dc-mono-val">{eyeComfortSummary(comfortOn, eyeComfort.length)}</span>
            <Icon name="chevron-right" size={14} aria-hidden />
          </button>
          {comfortOpen &&
            eyeComfort.map((name) => (
              <Ng3Row key={name}>
                <Ng3Label plain>
                  {name}
                  {name === 'Flicker-Free' && (
                    <InfoTip tip="Steadies the panel at low brightness. Flicker only while gaming is Adaptive Sync instead, on the Sharpness card." />
                  )}
                  {name === 'Blue Light Filter' && (
                    <InfoTip tip="Warms every colour to cut blue light. Leave it off while grading video — it shifts what you are judging." />
                  )}
                </Ng3Label>
                <Toggle
                  checked={comfortOn.includes(name)}
                  onChange={(on) =>
                    setComfortOn((prev) => (on ? [...prev, name] : prev.filter((x) => x !== name)))
                  }
                  aria-label={name}
                />
              </Ng3Row>
            ))}
        </>
      )}

      {/* CONTRAST — a titled group under a divider, not a card of its own.
          The divider is what a shared card costs: `BRIGHTNESS & CONTRAST` as one
          title measured 178px EN / 189px FR into a 199px slot, so a single title
          would ship with nothing left for translation (copy-rules.md rule 2,
          2026-08-08). Two groups, two titles, one card.

          Dynamic Contrast is not here any more — it is `Content` on the
          Auto-Brightness segment above. Its 2026-08-04 reasoning is preserved
          verbatim at that constant. */}
      <span className="dc-divider" />
      <SliderField
        label="Contrast"
        value={picture.contrast}
        onChange={(v) => setValue('contrast', v)}
      />
    </Ng3Section>
  );
}

/** The burn-in protections, and how many of them are on. */
/** Black Stretch's four steps, in order — the slider's scale, not a menu. */
const BLACK_STRETCH = ['Off', 'Low', 'Medium', 'High'];

const OLED_PROTECTIONS = [
  'Static Content Detection',
  'Logo Burn-in Detection',
  'Letterbox & Split Screen Detection',
  'Lower Third Detection',
];

/** How many protections are on, in the words both tabs use. */
function protectionSummary(off: string[]): string {
  const on = OLED_PROTECTIONS.filter((p) => !off.includes(p)).length;
  // "All on" while nothing has been touched, a count the moment one is off —
  // the number is only worth reading once it is not the full set. Same shape as
  // the preset counter in Utilities.
  return on === OLED_PROTECTIONS.length ? 'All on' : `${on} of ${OLED_PROTECTIONS.length} on`;
}

/**
 * OLED Care, with the four detections folded behind one row.
 *
 * INTERIM, and the reason is measured rather than aesthetic (2026-08-08). The
 * tab body is a fixed 380px over three columns, and the four cards here already
 * spend it: 309 / 167 / 202 / 313, which packs only because this card is the
 * short one. Opened, it stands at 324 and leaves 45px beside it — nothing fits
 * there, so Color is pushed into a fourth column and painted outside the panel.
 *
 * So folded is the shipped state and open is a known, temporary break. Two exits
 * were measured and neither works:
 *  · Move the switches to Utilities — that tab is also at 100%. A sixth card
 *    spills it no matter how short (tested down to 77px).
 *  · Give them the library's scroll valve (`Ng3Scroll`) — its own rule excludes
 *    them (monitor-canvas.css:113: a real list whose length is data; fixed
 *    control stacks never get a scrollbar), and capping the one Utilities card
 *    that IS such a list only fits at a ~20px peephole.
 * What is left is a capacity decision about the modal, which is not this card's
 * to make. Open item: progress.md.
 *
 * Vocabulary: the DS collapsible is `.ds-settings-group`
 * (shared/components.css:2777, driven live in `BoosterModal.tsx`) and it is NOT
 * reused here, because it is a card in its own right — own surface, radius and
 * margin — so nesting it inside this Ng3Section would draw a card inside a card.
 * What IS taken from it is its disclosure convention, value for value: a 14px
 * muted chevron rotating 90° over `--dur-normal` (components.css:2844-2853).
 * Same motion as the rest of the app, at the scale of a row. The header is a
 * real `<button>` rather than Booster's `role="button"` div because this row has
 * no nested control to keep clickable, and a button brings Enter/Space with it.
 *
 * The switch states live in Settings, not in this component: folded, the summary
 * is the only thing reporting them, and a `useState` here would reset that
 * summary to "All on" every time the tab is left — the card would forget a
 * protection someone deliberately turned off.
 */
function OledCareSection() {
  const [open, setOpen] = useState(false);
  const { oledProtectionsOff, setOledProtectionOff } = useSettings();

  return (
    <Ng3Section>
      <Ng3Label strong>
        OLED Care
        <InfoTip tip="Automatic burn-in protection — dims or shifts static content before it marks the panel." />
      </Ng3Label>
      {/* When it last ran rides on the row that runs it (2026-09-22, Cindy
          «다 지워»). It had its own `Last pixel refresh` row under a divider —
          the same subject told twice, and the second row had nothing to do. */}
      <InfoRow label="Pixel Refresh" sub="4 days ago">
        <Button variant="ghost" size="sm">
          Run now
        </Button>
      </InfoRow>
      <button
        type="button"
        className={'mt-fold' + (open ? ' is-open' : '')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ds-ng3-label plain">Protections</span>
        <span className="dc-mono-val">{protectionSummary(oledProtectionsOff)}</span>
        <Icon name="chevron-right" size={14} aria-hidden />
      </button>
      {open &&
        OLED_PROTECTIONS.map((p) => (
          <Ng3Row key={p}>
            <Ng3Label plain>{p}</Ng3Label>
            <Toggle
              checked={!oledProtectionsOff.includes(p)}
              onChange={(v) => setOledProtectionOff(p, !v)}
              aria-label={p}
            />
          </Ng3Row>
        ))}
    </Ng3Section>
  );
}

export function DisplayTab({ features, skuName }: { features: Features; skuName: string }) {
  const display = features.display || {};
  const color = features.color || {};
  const presets: string[] = Array.isArray(color.presets) ? color.presets : ['Native', 'sRGB', 'DCI-P3'];
  const { picture, setValue } = usePicture();
  // '' = nobody has picked in this build yet, so the SKU's first preset stands
  // in — the same convention monitor mode uses for an unpicked mode.
  const preset = picture.colorPreset || presets[0];
  const setPreset = (v: string) => setValue('colorPreset', v);
  const [hdr, setHdr] = useState(!!color.hdr);
  const oled = features.care?.oled || display.panel === 'OLED';
  // Demo state: the prototype ships a calibrated display, so the gain channels
  // are lock-protected. Real state will come from the calibration service.
  const calibrationLocked = true;
  const [gainOpen, setGainOpen] = useState(false);

  // Four cards, listed in reading order and packed into columns by height (see
  // MonitorGrid). Was seven, which overflowed the panel into a fourth column
  // that fell off the right edge — Color and RGB Gain were the two that landed
  // there (2026-08-08, confirmed structure).
  //
  // Brightness leads, not OLED Care. Brightness / Contrast / Sharpness are the
  // three every monitor has (copy-rules.md, device variability rule 3), so the
  // conditional card sits behind them and the constants always start in the same
  // place — open a monitor without OLED and the tab still opens on Brightness.
  return (
    <>
    <MonitorGrid>
        {/* Panel facts (size / resolution / refresh / response / panel type)
            are not here: they are device identity, not display controls, and
            Utilities already owns the identity card. Keeping a second facts
            card on Display made the tab the heaviest in the modal — the one
            that pushed the arrangement hero past its own height. */}
        <BrightnessSection comfort={features.comfort as Record<string, unknown> | undefined} />
        <Ng3Section>
          {/* PICTURE — a real card title, and the reason it did not have one.
              `SHARPNESS` was never a title: it is the slider's own label drawn
              in caps, which SliderField does by default because "three of our
              five sliders are their section's only control, which makes the
              label the title". That stopped being true here — this card holds
              three things now — so the first control was wearing the card's
              name and describing a third of it (2026-08-20, Cindy).
              The library is explicit about the two roles: `.ds-ng3-label.plain`
              is "the label beside a toggle/control inside a section", caps is
              the section title. So the card takes a title and Sharpness goes
              plain, which is the same shape BRIGHTNESS/CONTRAST and COLOR/RGB
              GAIN already use. `Picture` at 7 characters sits well inside the
              199px title slot that rejected `BRIGHTNESS & CONTRAST` at 178px EN
              / 189px FR (copy-rules.md rule 1). */}
          <Ng3Label strong>Picture</Ng3Label>
          {/* No `Soft` / `Sharp` end labels. They were this tab's only slider
              with them — Brightness and Contrast carry none — and the header
              already shows the number. An end label on one of three sliders
              reads as a difference in kind where there is none (2026-08-20,
              Cindy). */}
          <SliderField
            label="Sharpness"
            plain
            value={picture.sharpness}
            onChange={(v) => setValue('sharpness', v)}
          />
          <span className="dc-divider" />
          {/* Black Stretch is a SLIDER over named steps, not four buttons.
              Off → Low → Medium → High is one ordered scale — how far the
              shadows get lifted — and a segmented control says "four unrelated
              choices" while spending a full row of buttons to do it. Cindy's own
              rule against segmented controls past two or three options, and the
              same call `ia-section5.md` recorded when the MODE row dropped its
              segmented control.
              It also closes a measured defect: the four buttons overran this
              card's 16px inner padding by 9px (measured 2026-08-20, 1440px).
              A slider is bounded by the card the way the two above it are. */}
          <SliderField
            label="Black Stretch"
            max={BLACK_STRETCH.length - 1}
            step={1}
            plain
            /* Stored as the word, moved as the index: the scale is what the
               slider needs, the word is what a saved mode should carry — an
               index would break the moment the steps are reordered. */
            value={Math.max(0, BLACK_STRETCH.indexOf(picture.blackStretch))}
            onChange={(v) => setValue('blackStretch', BLACK_STRETCH[v] ?? BLACK_STRETCH[0])}
            format={(v) => BLACK_STRETCH[v] ?? BLACK_STRETCH[0]}
          />
          {/* Adaptive Sync rides in this card rather than a sixth one: the tab
              spills into a fourth column past five cards (measured 2026-08-08 —
              Color and RGB Gain were the two that fell off), so a new card is
              not available to spend. Not OLED Care either, tempting as the
              flicker symptom makes it: that card is gated `oled &&`, and VRR is
              not an OLED feature — the row would vanish on every other monitor.

              `Adaptive Sync` is HP's own OSD word for it (OMEN 27i / 27qs use
              this single item to switch VRR on and off — not two rows, whatever
              our OGH inventory line reads like), so we take the vocabulary
              rather than invent one (rule 27).

              The explanation is a tooltip, not a line, because the surface has
              no room to spare and because the sentence is only wanted once.
              Written as the SYMPTOM, not the mechanism: HP's own support forum
              has threads from people who cannot tell what this setting does, so
              "what Adaptive Sync is" is demonstrably not the sentence that helps
              — "your dark scenes pulse" is. Reasons to switch it off, both
              measured against our panel: OLED VRR flicker (we are OLED) and
              motion-blur-reduction exclusivity (nothing to conflict with yet —
              revisit when Dual Mode's 480 Hz side brings one). Research and
              badges = research.md 「VRR / Adaptive Sync 리서치」 (2026-08-20).

              On by default; turning it off is Zone 3 — deliberately not Zone 2,
              because nothing here can detect the flicker to offer the fix. */}
          <span className="dc-divider" />
          <ToggleRow
            label="Adaptive Sync"
            on
            info="Matches the refresh rate to the game. Turn off if dark scenes look like they pulse."
          />
        </Ng3Section>
        {/* OLED Care moved here from second place (2026-08-21). The note at the
            top of this tab already states the principle — Brightness / Contrast
            / Sharpness are the three every monitor has, so the CONDITIONAL card
            sits behind the constants — but Sharpness lives in Picture, so a
            conditional card was sitting between two constant cards. Behind them
            now, which is what that note asks for.
            It also balances the columns, and that was the visible symptom:
            measured before the move, the three columns ran 282 / 434 / 205px
            because OLED Care (169) and Picture (265) landed in one column while
            Color (205) sat alone. Order is the only lever here — the body packs
            cards into columns by height and a card cannot be split, so which
            cards share a column is decided by the order they are written in. */}
        {oled && <OledCareSection />}

      <Ng3Section>
        <Ng3Label strong>
          Color
          <InfoTip tip="Factory-tuned color spaces — sRGB for web work, DCI-P3 for film and video." />
        </Ng3Label>
        {/* A Dropdown, not a row of chips (2026-08-20, Cindy).
            Six chips wrapped to two lines at this card's 274px of content, and
            the count is not fixed: custom presets are a feature of this card
            (`MAX_CUSTOM_PRESETS`), so the list GROWS with use. Chips break when
            the list grows; a dropdown does not — the "what happens when this
            scales" test, which is the one Cindy applies to any visual first.

            This is not the Color Gamut dropdown that came out of this card (see
            the note below): that one was removed for offering the SAME choice a
            second time, not for being a dropdown. One choice, one control. */}
        <Dropdown
          aria-label="Color"
          value={preset}
          onChange={setPreset}
          options={presets.map((p) => ({ label: p, value: p }))}
        />
        {color.hdr != null && (
          <Ng3Row>
            <Ng3Label plain>HDR</Ng3Label>
            <Toggle checked={hdr} onChange={setHdr} aria-label="HDR" />
          </Ng3Row>
        )}
        {/* No Color Gamut dropdown. It listed `color.gamuts`, which on both
            monitor SKUs is a SUBSET of the preset chips directly above it:
            treehouse-32's chips are Native/sRGB/DCI-P3/Warm/Cool/Custom against
            gamuts Native/sRGB/DCI-P3, and pulse-27 ships no chips of its own, so
            the fallback list already contains both of its gamuts. The card was
            offering one choice twice — once pressable, once not (the dropdown
            had `defaultValue` and no `onChange`, so it never went anywhere).
            Wiring it would have been worse than removing it: two controls for
            one setting hand the user the job of deciding which is real.
            It also carried this tab's only 15px, so the screen loses a type size
            with it (2026-08-19, measured beside Play — 2 sizes there, 5 here). */}

        {/* RGB GAIN — a titled group under a divider, back inside Color
            (2026-08-08, confirmed). It was split into its own card because the
            gain stack ran ~230px, making Color a single block taller than a
            balanced column; that height is not here any more, because locked is
            both the resting state and the compact one — two rows, not three
            sliders showing numbers nobody can move.

            The channels still come back when the lock is off, and that open
            state is the tall one. If a SKU ever ships unlocked by default, this
            group goes back to being its own card rather than growing this one. */}
        <span className="dc-divider" />
        {/* Locked, this group is now a fold, and the lock has a reason attached
            (2026-08-20, Cindy: "이거 무슨 소리인지 하나도 모르겠어").
            What was here put `🔒 Set by calibration` on the surface and left it
            at that — a padlock with nothing saying who locked it or how it
            opens. Two changes: the ⓘ carries the reason, and the row folds, so
            the channel values are reachable instead of merely absent. Per-channel
            gain is fine-tuning, which the depth rule sends below the surface
            without a hearing (copy-rules.md rule 5). Closed, the row still says
            its value, so the fold is not a click toll (rule 3). */}
        <Ng3Row>
          <Ng3Label strong>
            RGB Gain
            {/* Says WHAT holds the channels, and deliberately not WHERE to go
                undo it: the 2026-08-08 line that pointed at "Advanced →
                Calibration settings" was cut for naming a screen this design
                does not have, and a tooltip repeating that would repeat the
                error one layer down. */}
            {calibrationLocked && (
              <InfoTip tip="A calibration profile is holding these channels — keeping them fixed is what calibration is for." />
            )}
          </Ng3Label>
        </Ng3Row>
        {calibrationLocked ? (
          // "unlock in Advanced → Calibration settings" is gone (2026-08-08,
          // Cindy): it pointed at a screen this design does not have, so it was
          // a direction nobody could follow. What is left is the fact — this is
          // set by calibration — which is the part that is true.
          //
          // The `Calibration lock` badge that used to sit on the title row is
          // gone with it (2026-08-19): it and this line said the same thing one
          // above the other, and the badge said it in the tab's only 10px — a
          // whole type size spent on a repeat. The lock glyph moved down here,
          // so the fact and its mark are one line instead of two.
          //
          // 2026-08-20: the fact became a fold. It was a dead-end line — a
          // padlock, a claim, and no way to see what had been set. Closed it
          // still states the value ("Set by calibration" IS the state, depth
          // rule 3); open it shows the channels the profile is holding, as
          // read-only figures. `.mt-fold` verbatim from OLED Care.
          <>
            <button
              type="button"
              className={'mt-fold' + (gainOpen ? ' is-open' : '')}
              aria-expanded={gainOpen}
              onClick={() => setGainOpen((v) => !v)}
            >
              <span className="ds-ng3-label plain">
                {/* One of the two places the padlock still means what it says —
                    a calibration owns this value, so the person cannot open it
                    from here. Raised 11 → 14 because at 11 the shackle
                    collapses and the glyph reads as a box lying on its side
                    (2026-08-21, Cindy). 14 rather than the library's 16 `sm`:
                    the chevron closing this same row is already 14, and the row
                    measures 17px tall, so a 16px lock would be the tallest
                    thing in it. */}
                <Icon name="lock-on" size={14} aria-hidden /> Set by calibration
              </span>
              <Icon name="chevron-right" size={14} aria-hidden />
            </button>
            {gainOpen &&
              RGB_GAIN.map((g) => (
                <Ng3Row key={g.ch}>
                  <Ng3Label plain>
                    <span className={`dc-mono-val ${g.className}`}>{g.ch}</span>
                  </Ng3Label>
                  <span className="dc-mono-val">{g.val}</span>
                </Ng3Row>
              ))}
          </>
        ) : (
          RGB_GAIN.map((g) => (
            <div className="mt-gain" key={g.ch}>
              <span className={`dc-mono-val ${g.className}`}>{g.ch}</span>
              <Slider value={g.val} onChange={() => {}} aria-label={`${g.ch} gain`} />
              <span className="dc-mono-val">{g.val}</span>
            </div>
          ))
        )}
      </Ng3Section>
    </MonitorGrid>
    </>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Modes & Presets — the management surface (2026-08-07, Cindy: "겉에 보여지는
 * 거는 깔끔하게 디자인 가되, 자주 안 쓰는 물건들은 조금 안쪽에 숨겨놓는").
 *
 * The bar above the hero is for PICKING; everything you do rarely — reset a
 * built-in mode, rename / duplicate / delete a preset — lives here. That split
 * is the app's own habit, not a new idea: Perform shows a status card and puts
 * its settings in a Manage modal, and the keyboard's Lights tab keeps its
 * preset list with a per-row menu rather than hanging actions off the picker.
 * Utilities is where `ia-section5.md` has always listed profile management.
 *
 * Vocabulary is the DS's: `ListItem` rows with a trailing slot, and the
 * `ContextMenu` + `ListItem` composition its own docstring prescribes. The
 * Lights tab's `.pdm-preset*` classes were NOT reused — they live in
 * `keyboard-canvas.css`, a canvas the monitor never loads, so borrowing them
 * would mean depending on another device's stylesheet.
 */
function ModesPresetsSection({ features }: { features: Features }) {
  const m = useMonitorMode();
  // The automation ABOUT modes — whether the app may move the mode by itself.
  // Lived on the retired Overview tab (2026-08-18, Cindy); it governs how this
  // set behaves, so it joins the card that manages the set — and costs a row,
  // not a sixth card (this tab is at 100% of its 380px × 3-column budget, see
  // UtilitiesTab's note).
  const { smartActions, setSmartActions } = useSettings();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // Closed by default, like every other fold in this modal: this answers a
  // question people ask once ("what does switching actually change?"), and a
  // list of values nobody is editing does not earn permanent height.
  const [remembersOpen, setRemembersOpen] = useState(false);

  if (!m || m.modes.length === 0) return null;
  const custom = m.modes.filter((x) => !m.builtIn.includes(x));

  const commitRename = () => {
    if (renaming) m.renamePreset(renaming, draft);
    setRenaming(null);
    setDraft('');
  };

  return (
    <Ng3Section className="mp-sec">
      {/* The ⓘ carries the OTHER half of the answer — what a mode leaves alone.
          It is the half people cannot deduce from the rows below, and it is the
          half that stops a switch from feeling unsafe: our own table puts volume
          on the device side because "a mode switch must never jolt loudness"
          (`profile-proposal-2026-07.md`, What a mode remembers). In the tip
          rather than a caption for the reason recorded on the Auto-switch row:
          this tab's three columns share one fixed body, and prose here is what
          pushed a card out of it before. */}
      <Ng3Label strong>
        Modes & Presets
        <InfoTip tip="Switching a mode never changes volume, calibration, or which computer the keyboard is on." />
      </Ng3Label>

      {m.builtIn.map((name) => (
        <ListItem
          key={name}
          label={name}
          selected={m.mode === name}
          /* Reset appears per row and only where there is something to undo — a
             built-in mode holding the user's own values. This is the button that
             used to sit on the mode bar; here it is beside the thing it acts on
             instead of beside the things you choose between. */
          /* Nothing at all when a mode is untouched (2026-08-24, Cindy: too
             much text on this screen). `Default` was printed on every row that
             had no user values, which on a fresh monitor is all three — the
             same word three times, saying what the ABSENCE of a Reset button
             already says. The presence of Reset is the signal now, and the
             fold below spells out what a mode is holding for anyone who wants
             the detail. */
          /* No per-mode auto-switch mark here or in the bar's list (2026-09-24,
             fourth cut of Cindy's HyperX review). Which modes switch by
             themselves is an explanation, said once — the ⓘ on the Auto-switch
             row below ("Create asks first.") — and the standing state is one
             tag on the mode bar. Marking rows put three signs in a 190px list
             and a mark beside modes the user had not chosen, which read as a
             value of the row. */
          trailing={
            m.isDirty(name) ? (
              <Button size="sm" onClick={() => m.resetMode(name)}>
                Reset
              </Button>
            ) : undefined
          }
        />
      ))}

      {custom.length > 0 && <span className="dc-divider" />}

      {custom.map((name) =>
        renaming === name ? (
          <Input
            key={name}
            value={draft}
            autoFocus
            aria-label={`Rename ${name}`}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setRenaming(null);
                setDraft('');
              }
            }}
          />
        ) : (
          <ListItem
            key={name}
            label={name}
            selected={m.mode === name}
            /* The two actions Cindy asked for, in the row itself rather than
               behind a ⋮ menu. A menu was tried first and lost on two counts
               measured here: `.mc-grid--packed` uses `column-count`, and a
               multi-column container fragments an absolutely-positioned panel
               (the popup opened with Rename/Duplicate in this column and Delete
               stranded in the next); opening it in flow instead pushed the
               section past the 380px body and clipped its last line. Two icons
               cost no height and no popup. Duplicate went with the menu — it
               came from the Lights tab, not from the ask, and "Add new" already
               starts from whatever is on screen. */
            trailing={
              <>
                <IconButton
                  label={`Rename ${name}`}
                  variant="ghost"
                  onClick={() => {
                    setRenaming(name);
                    setDraft(name);
                  }}
                >
                  <Icon name="edit" size={16} />
                </IconButton>
                <IconButton label={`Delete ${name}`} variant="ghost" onClick={() => m.deletePreset(name)}>
                  <Icon name="trash" size={16} />
                </IconButton>
              </>
            }
          />
        ),
      )}

      {/* Only once the user owns a preset, and as a value rather than a
          sentence (2026-08-24, Cindy). "0 of 3 presets used." was a line of
          prose under an EMPTY list — it explained a limit nobody had reached,
          in the card that already spends its height on rows. The limit still
          enforces itself where it is met: `+ Add new preset` on the mode bar
          refuses the fourth and says so. Sat directly under the rows it counts,
          so the bare number has its subject. */}
      {custom.length > 0 && (
        <p className="mt-note mp-count">
          <span className="dc-mono-val">
            {custom.length} / {MAX_CUSTOM_PRESETS}
          </span>
        </p>
      )}

      {/* What the selected mode is actually holding. A mode spans Display,
          Lights and Audio, and until now the only place that said so was a
          sentence in an InfoTip — you had to ENTER a mode to find out what it
          would change. The rows are the app's own answer to "why did my screen
          just look different?".

          Three decisions worth keeping:
          · No count in the summary any more (2026-08-24). It counted the
            values the user had changed — true, but an answer to a question
            nobody was asking, and Cindy could not read what it meant. The
            label carries the meaning now and the rows carry the detail.
          · Rows show a value even where nothing is saved — the mode's default,
            or `—` where there is no default. The scope IS the lesson here, and
            hiding the unsaved rows would teach half of it.
          · The colour is TEXT, not a dot. A coloured circle is `.ds-swatch` in
            this library — a picker button — so a read-only one reads as
            something to press (measured 2026-08-20, and the library part is in
            Chris's queue; `monitorMode.tsx` carries the note). When it lands,
            this hex becomes the dot and nothing else moves.

          Hidden entirely until a mode is picked: with nothing selected there is
          no subject, and a "What ___ changes" with no mode in it is noise. `.mt-fold`
          is OLED Care's, verbatim (rule 15). */}
      {m.mode && (
        <>
          <span className="dc-divider" />
          <button
            type="button"
            className={'mt-fold' + (remembersOpen ? ' is-open' : '')}
            aria-expanded={remembersOpen}
            onClick={() => setRemembersOpen((v) => !v)}
          >
            {/* The label answers the reader's actual question — "what happens
                when I switch?" — instead of naming a mechanism. `Remembers · Work
                · 2 of 4` said neither: Cindy could not tell what it meant
                (2026-08-24), and the count was of the values the USER had
                changed, a distinction that lives in our code, not on this
                screen. Switching always moves all four rows; the rows below say
                which four and what they are set to. Shorter, too. */}
            <span className="ds-ng3-label plain">What {m.mode} changes</span>
            <Icon name="chevron-right" size={14} aria-hidden />
          </button>
          {remembersOpen && (
            <Ng3Spec
              items={[
                {
                  label: 'Lights',
                  value:
                    [m.glowFor(m.mode), m.levelFor(m.mode) == null ? null : `${m.levelFor(m.mode)}%`]
                      .filter(Boolean)
                      .join(' · ') || '\u2014',
                },
                /* Five controls on one row — Brightness joined them on
                   2026-08-29. `Default` / `Custom` rather than the numbers
                   themselves: the fold teaches SCOPE — what moves when you
                   switch — and five values would not fit the slot in any
                   language (copy-rules.md, the 60% budget). `Default` is
                   already the word the mode rows in this same card use. */
                { label: 'Picture', value: m.pictureFor(m.mode) },
                { label: 'Viewing Mode', value: m.layoutFor(m.mode) ?? '\u2014' },
                { label: 'EQ preset', value: m.eqFor(m.mode) ?? '\u2014' },
              ]}
            />
          )}
        </>
      )}

      <span className="dc-divider" />

      {/* Default OFF, persisted: the 2026-07-21 call on auto-switch is that an
          automation which moves someone's setup asks first (Zone 2). Named
          against its sibling in Connectivity ("Auto-switch on input change")
          so the two automations that both move something read as one family.
          The scope sentence rides in the InfoTip, not a caption: this tab's
          three columns share one fixed 380px body (monitor-canvas.css
          `.mc-grid`) and a three-line caption here is what pushed OSD into a
          fourth column outside the panel (measured 2026-08-18, 1440px). */}
      <Ng3Row>
        <Ng3Label plain>
          Auto-switch by activity
          {/* `Create asks first.` (2026-09-23, Cindy's HyperX review — "왜
              Create에는 없는 거야?"). The glyph is on Game and Work only because
              Create's signal is ambiguous and it arrives as a suggestion
              (MODES_AUTO_SWITCHED), and until now no surface said so. */}
          <InfoTip tip={`Switch mode automatically when launching games or apps. Create asks first. ${modeScopeNote(features)}`} />
        </Ng3Label>
        <Toggle
          checked={smartActions}
          onChange={setSmartActions}
          aria-label="Auto-switch by activity — switch mode automatically when launching games or apps"
        />
      </Ng3Row>
    </Ng3Section>
  );
}

export function UtilitiesTab({ sku }: { sku: ResolvedSku }) {
  const features = sku.features as Features;
  const display = features.display || {};
  const power = features.power || {};
  const osd = features.osd || {};
  const sleep: string[] = Array.isArray(power.autoSleep) ? power.autoSleep : ['5 min', '10 min', '30 min', 'Never'];
  const { ecoMode, setEcoMode, osdLock, setOsdLock } = useSettings();
  // Identity card's spec fold — closed by default (copy-rules.md 깊이 규칙:
  // read-only facts fold first). The summary is the three facts people quote;
  // a SKU missing all three reads '—', the app's own no-value mark.
  const [specsOpen, setSpecsOpen] = useState(false);
  const specSummary =
    [display.size, display.resolution, display.refreshRate ? `${display.refreshRate} Hz` : null]
      .filter(Boolean)
      .join(' · ') || '—';
  // (An `OLED Protection` card lived here for one revision on 2026-08-08, holding
  //  the four detection switches moved off Display. It came out the same day:
  //  this tab is at 100% of the same 380px × 3-column budget, and a sixth card
  //  spills Firmware and OSD outside the panel at any height — measured down to
  //  77px. The switches went back to the Display card's fold. See
  //  OledCareSection for the full measurement and the open capacity question.)

  return (
    <MonitorGrid>
      {/* Management first: this is the tab you open to change the set, and the
          identity card below is a reference, not a task. */}
      <ModesPresetsSection features={features} />
        {/* Device identity — the panel facts moved here from Display, where
            they were a second identity card competing with this one.

            The hardware spec list ships FOLDED (2026-08-20, Cindy — the depth
            rule this landed as is copy-rules.md 「깊이 규칙」). This card was the
            heaviest read-only block in the modal — 203 chars over 3 controls,
            measured 2026-08-19 — and every line of it is an immutable fact
            nobody acts on twice. The fold is OLED Care's `.mt-fold` verbatim
            (rule 15), and its closed row still says the three facts people
            actually quote: size · resolution · refresh. What stays on the
            surface is the RUNNING state — firmware versions, the update that
            wants a click, the two support doors — because state can demand
            action and a spec cannot. */}
        <Ng3Section>
          <Ng3Label strong>{sku.name}</Ng3Label>
          <button
            type="button"
            className={'mt-fold' + (specsOpen ? ' is-open' : '')}
            aria-expanded={specsOpen}
            onClick={() => setSpecsOpen((v) => !v)}
          >
            <span className="ds-ng3-label plain">Specs</span>
            <span className="dc-mono-val">{specSummary}</span>
            <Icon name="chevron-right" size={14} aria-hidden />
          </button>
          {specsOpen && (
            <Ng3Spec
              items={[
                ...(display.size ? [{ label: 'Size', value: display.size }] : []),
                ...(display.resolution ? [{ label: 'Resolution', value: display.resolution }] : []),
                ...(display.refreshRate ? [{ label: 'Refresh', value: `${display.refreshRate} Hz` }] : []),
                ...(display.responseTime ? [{ label: 'Response', value: display.responseTime }] : []),
                ...(display.panel ? [{ label: 'Panel', value: display.panel }] : []),
                /* The monitor's physical buttons — a fact about the hardware,
                   not a control, so the depth rule puts it here with the other
                   immutable facts rather than on the surface of the OSD card
                   where it sat until 2026-08-24 (copy-rules.md 깊이 규칙).
                   The value says only what our own rear render shows: a control
                   cluster on the back panel. It used to read `Rear · 5-way`,
                   which was Chris's generic monitor default (his SKU registry,
                   2026-06-01) and not something this concept ever decided —
                   `treehouse32-back.png` draws a centre button flanked by two,
                   so the count was a claim our own art did not support. */
                ...(osd.joystick ? [{ label: 'Controls', value: 'Rear panel' }] : []),
                // Up-to-date versions fold in with the facts (2026-09-22, Cindy
                // «다 지워»): a row reading "Up to date" gives nothing to do.
                // Only a version that wants an update stays on the surface.
                { label: 'Firmware', value: 'v2.1.4' },
                { label: 'OMEN Software', value: 'v5.0.2' },
              ]}
            />
          )}
          {/* Hub firmware + companion software join the identity card rather
              than keeping a FIRMWARE card of their own — one card = the device
              and the state of everything running it. The device's own firmware
              row moved down here from the spec list with the fold (2026-08-20):
              it is running state, not an immutable fact. 2026-09-22 narrowed
              that — only a version with something to do (an update) is on the
              surface; up-to-date versions went back into the Specs fold. */}
          <span className="dc-divider" />
          <InfoRow label="Hub firmware">
            <Button variant="ghost" size="sm">
              Update available →
            </Button>
          </InfoRow>
          <div className="dc-btns">
            <Button size="sm">
              <Icon name="screen-mirror" size={16} />
              Device Manager
            </Button>
            <Button size="sm">
              <Icon name="question" size={16} />
              Get Support
            </Button>
          </div>
        </Ng3Section>
        <Ng3Section>
          <Ng3Label strong>
            Power
          </Ng3Label>
          {/* Shared state, not this row's own (2026-08-20): Display's
              `Estimated draw` appears only while this is on, and a switch two
              tabs away cannot read a local `useState`. */}
          <Ng3Row>
            <Ng3Label plain>Eco Mode</Ng3Label>
            <Toggle checked={ecoMode} onChange={setEcoMode} aria-label="Eco Mode" />
          </Ng3Row>
          <Ng3Field>
            <Ng3Label>Auto sleep after</Ng3Label>
            <Dropdown
              aria-label="Auto sleep after"
              defaultValue={sleep[0]}
              options={sleep.map((s) => ({ label: s, value: s }))}
            />
          </Ng3Field>
        </Ng3Section>

        {/* One row, and it is the only one here that is a CONTROL. This card
            arrived with the upstream Settings tab (Chris, `5f675fe`) and was
            carried into our IA by the 07-30 replay without ever passing the
            entrance test in deviceTabs.ts — the joystick row was a hardware
            fact wearing a control's clothes, and it has moved into the Specs
            fold above. What is left earns the card: locking the on-screen menu
            is the app asserting that IT is the primary control surface and the
            rear buttons are the fallback, which is the monitor section's whole
            argument (Presentation 5, 2026-07-11). */}
        {osd.lockable && (
          <Ng3Section>
            <Ng3Label strong>
              OSD
              <InfoTip tip="The monitor's own on-screen menu, driven by its hardware buttons." />
            </Ng3Label>
            <Ng3Row>
              <Ng3Label plain>Lock OSD</Ng3Label>
              <Toggle checked={osdLock} onChange={setOsdLock} aria-label="Lock OSD" />
            </Ng3Row>
          </Ng3Section>
        )}
    </MonitorGrid>
  );
}

// ── Audio ────────────────────────────────────────────────────────────────────

export function AudioTab({ features }: { features: Features }) {
  const audio = features.audio || {};
  const m = useMonitorMode();
  const modes: string[] = Array.isArray(audio.outputModes) ? audio.outputModes : ['Game', 'Music', 'Video', 'EQ'];
  return (
    <MonitorGrid>
      {/* "Output" used to name three different things across the card and this
          tab — the speaker device, the loudness, and the EQ preset. The OMEN
          original never had that collision: Speaker / Volume / Mute
          (prototype.html:15590-15604) and "EQ preset" for the presets
          (prototype.html:16392). Same words here. */}
      {/* One card, not two (2026-08-28, Cindy: the tab bottoms did not meet).
          Measured 1440: Speaker 154, EQ preset 81 — 73px apart, which is past
          the row spec's own line ("~70px 넘게 남으면 CSS가 아니라 묶음 문제 —
          합치거나 내용을 준다", component-specs.md SPEC: tab-card-rows). Both
          answers were already tried here and recorded: stretching the short
          card was reverted on 2026-08-25 ("밑에 텅 비어있잖아" — EQ drawn at
          154 with ~100px blank), so what is left is the merge, and the subject
          allows it: Volume, Mute and EQ preset are all the speaker. */}
      <Ng3Section>
        <Ng3Label strong>
          Speaker
        </Ng3Label>
        <SliderField label="Volume" init={65} suffix="%" plain />
        <ToggleRow label="Mute" />
        {/* Wired to the mode, which the window has been promising since the note
            under the mode bar started reading "Screen, audio and under-glow
            follow the mode" — audio was the third of that sentence with nothing
            behind it (`modeScopeNote`). Our own scope table put it here:
            `profile-proposal-2026-07.md` "What a mode remembers" lists "Audio EQ
            / output mode (Game·Music·Video)" as mode-scoped.

            Volume and Mute above are deliberately NOT wired, from the same
            table's other column — "moment-to-moment, like a TV remote — a mode
            switch must never jolt loudness". Brightness sits outside the mode for
            the matching reason (2026-08-11): loudness and room light are about
            where you are, not what you are doing.

            Outside a monitor canvas there is no mode state, so the field falls
            back to its own local value rather than crashing — the same guard
            `ViewingModeSection` uses. */}
        <SegField
          label="EQ preset"
          values={modes}
          value={m ? m.eq || modes[0] : undefined}
          onChange={m ? m.setEq : undefined}
        />
      </Ng3Section>
    </MonitorGrid>
  );
}

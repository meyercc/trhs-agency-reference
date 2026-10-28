import { useState, type ReactNode } from 'react';
import { Icon, Slider, Badge, Toggle, type IconName } from '../components';
import { getResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from '../devices/skus';
import { useSettings } from '../state/Settings';
import {
  SPEAKER_VOLUME,
  useBrightnessLevel,
  usePicture,
  useResolvedMode,
  useAutoBrightness,
} from '../devices/monitor/monitorMode';
import { deviceTabs } from '../devices/deviceTabs';
import './device-card.css';
import { CardMenu, type CardMenuItem } from './CardMenu';
import { useCellActions } from './cellActions';

// ── Shared device card ──────────────────────────────────────────────────────
// The React port of the vanilla `.w-devcard` home widget: battery + name +
// subtitle + per-tab shortcut buttons + the device photo. Presentational and
// data-resolution are separate so the *same* card renders in both the main app
// board and the Metro dashboard from one source of truth (the SKU registry).
//
// Monitor cards additionally carry the RICH size-tier design — the monitor
// section's dashboard-card proposal (decided 2026-07-01, audio row 2026-07-06):
//   • Compact  2×1 — name + type + photo + 2 shortcuts (launcher)
//   • Standard 3×2 — + color-preset readout + brightness slider
//   • Expanded 6×3 — photo stays LARGE right (identity register: the render
//     shows the physical design incl. under-glow — not live state); left column
//     keeps the base card's bottom gravity: identity, then a readout line
//     (preset·connection·output), then sliders. AI-managed sliders carry the
//     DS `omen-ai` Badge; manual sliders are unmarked (absence = manual).
// Tiers ride the same container-query mechanism the base card already uses,
// and everything is scoped to `.ds-devcard.rich` — non-monitor cards untouched.

export interface DeviceShortcut {
  /** device-modal tab id this shortcut opens */
  tab: string;
  label: string;
  icon: IconName;
}
/**
 * What the SKU OFFERS. What the display is currently doing is read live from
 * the store by the components below — it is not resolved here, because
 * `deviceCardModel` is a plain function and the live values are hooks.
 *
 * That split is the fix for 2026-08-31: this object used to carry `mode:
 * 'Game'` and `preset: presets[0]` as literals, so the card asserted a mode
 * even while the monitor window showed none selected, and never moved when
 * anyone changed either.
 */
export interface MonitorRich {
  /** the modes this SKU offers — the live one is resolved against this list */
  modes: string[];
  /** the colour presets it offers; the first is the fallback until one is picked */
  presets: string[];
  /** active input · resolution · refresh */
  conn: string;
  /** audio output route */
  output: string;
  /** The SKU declares speakers. Without them the Speaker readout and the Volume
   *  slider are claims about hardware the display does not have (OMEN OLED 27). */
  hasAudio: boolean;
}
export interface DeviceCardModel {
  skuId: string;
  name: string;
  /** SKU type (mouse, keyboard, desktop…). Drives the photo scale, so a mouse
   *  is not rendered the size of a tower. */
  type: string;
  subtitle: string;
  image?: string;
  /** battery %, or null when wired (battery row hidden) */
  batteryPct: number | null;
  shortcuts: DeviceShortcut[];
  /** monitor-only rich size-tier content */
  rich?: MonitorRich;
  /** This hardware actually has the under-glow LED strip, so the pool of light
   *  behind its render follows the live Under-Glow control instead of the tuned
   *  literal. A monitor without the strip (OMEN OLED 27) must not repaint itself
   *  when the Treehouse's lamp changes. */
  underGlow?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  mouse: 'Mouse',
  keyboard: 'Keyboard',
  headset: 'Headset',
  monitor: 'Monitor',
  mic: 'Microphone',
  mousepad: 'Mousepad',
};
// Rule A (2026-07-23, Cindy): a shortcut jumps to a tab you CAN'T act on from
// the card face. The rich monitor face already carries Display (brightness/
// contrast/preset), Connectivity (signal readout) and Audio volume inline, so
// those tabs are dropped — leaving the tabs with no on-face control (Lights,
// Settings — the `utilities` id). Peripheral cards have no inline controls, so
// the same rule leaves ALL their tabs (see the filter in DeviceCard below).
// (The old TAB_ICON map is gone: deviceTabs entries carry their own icon.)
//
// ⚠️ THE RULE IS ABOUT THIS CARD'S FACE, so the filter lives in the CARD, not
// in `deviceCardModel` (moved 2026-08-20, Cindy). The model is shared with the
// My Devices panel (`app/DevicePanel.tsx`), and that panel has no inline
// controls at all — its face is a photo and two badges. Filtering there
// removed Display and Connectivity for a reason that did not apply, leaving
// the concept monitor with `Lights · Settings` while a plain OMEN OLED 27 next
// to it still offered Display and Connectivity.
const RICH_INLINE_TABS = ['display', 'connectivity', 'audio'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Card titles drop the "HyperX" brand prefix (the product name carries it),
// matching the device-card design (e.g. "Pulsefire Saga Pro", not "HyperX …").
const stripBrand = (n: string) => n.replace(/^HyperX\s+/i, '');
const batteryIcon = (pct: number): IconName =>
  `battery-${Math.max(0, Math.min(100, Math.round(pct / 10) * 10))}` as IconName;

// ── Card face — which rich rows this card shows (scope 1.0) ───────────────
// At 0.5 the face is fixed: the size tier decides what appears and there is no
// chooser (`Claude HP/plan.md`, "DeviceCard 위젯 — 사이즈 3단계"). The chooser
// below is the 1.0 half, built now so the card carries its CTA slot from the
// start rather than being re-laid-out when it lands — the reason it is drawn
// early is in `Claude HP/design-assets/phase2-backlog.md` (꺼내는 문).
// Monitor-only by construction: it lives inside RichPanel, and monitorRich()
// returns undefined for every other type, so no peripheral card gains a CTA.
const FACE_ROWS = [
  { key: 'preset', label: 'Preset' },
  { key: 'conn', label: 'Input' },
  { key: 'output', label: 'Speaker' },
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'volume', label: 'Volume' },
] as const;
type FaceKey = (typeof FACE_ROWS)[number]['key'];
const FACE_ALL: FaceKey[] = FACE_ROWS.map((r) => r.key);
const FACE_KEY = 'trhs-devcard-face';

function loadFace(): FaceKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FACE_KEY) || 'null');
    if (Array.isArray(saved)) {
      // An empty face is a real answer, kept as one. It used to be refused
      // because the chooser was reached from inside the rows it would hide —
      // it is the card's own ⋮ now (CardMenu), which is always there, so
      // turning everything off can no longer strand anybody (Chris, 2026-10-13).
      return saved.filter((k): k is FaceKey => FACE_ALL.includes(k as FaceKey));
    }
  } catch {
    /* corrupt value → fall through to the default face */
  }
  return FACE_ALL;
}

/**
 * Where a card's control choices are kept. Per device AND per surface: the
 * Home widget's choices are carried over from Personalize when the card is
 * added (`copyControlChoices`) and go their own way after that — Personalize
 * is the workbench, Home the glance, and they are allowed to differ
 * (Chris, 2026-10-13).
 */
export type CardScope = 'personalize' | 'home';
export const controlsKey = (skuId: string, scope: CardScope) =>
  scope === 'home' ? `trhs-devcard-controls:home:${skuId}` : `trhs-devcard-controls:${skuId}`;

/** Take a snapshot of one surface's choices onto another — the add-time carry-over. */
export function copyControlChoices(skuId: string, from: CardScope, to: CardScope) {
  try {
    const v = localStorage.getItem(controlsKey(skuId, from));
    if (v) localStorage.setItem(controlsKey(skuId, to), v);
  } catch {
    /* storage blocked: the Home card opens on its defaults */
  }
}

/** Which controls a card with `controls` shows, kept per device and surface. */
function loadShown(skuId: string, scope: CardScope, all: string[], defaults: string[], fallback = all.slice(0, 1)): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(controlsKey(skuId, scope)) || 'null');
    // An empty list is kept as the choice it is — see loadFace.
    if (Array.isArray(saved)) return all.filter((k) => saved.includes(k));
  } catch {
    /* corrupt value → the defaults */
  }
  const d = all.filter((k) => defaults.includes(k));
  return d.length ? d : fallback;
}

/**
 * What the Customize row opens: a switch per control the card can show, and —
 * off the board, where there is no «Remove from Home» — the Show on Home
 * switch. One control always stays on; a card with nothing on it reads as
 * broken.
 *
 * The ⋮ itself, its open/close, the press-outside and Escape are `CardMenu`'s
 * (Cindy 2026-10-06, one ⋮ for every card). This is only the panel it swaps in,
 * so the rows and their store are unchanged — the switches still write
 * `trhs-devcard-controls:<sku>` and `trhs-devcard-face`.
 */
function ChooserPanel({
  name,
  rows,
  isOn,
  onToggle,
  home,
}: {
  name: string;
  rows: { key: string; label: string }[];
  isOn: (key: string) => boolean;
  onToggle: (key: string) => void;
  home?: { on: boolean; onChange: (on: boolean) => void };
}) {
  return (
    <div className="devw-face-menu" role="group" aria-label={`What the ${name} card shows`}>
      {home && (
        <>
          <div className="devw-face-row devw-face-home">
            <span>Show on Home</span>
            <Toggle checked={home.on} onChange={home.onChange} aria-label="Show on Home" />
          </div>
          <div className="devw-face-rule" role="separator" />
        </>
      )}
      {rows.map((r) => (
        <div className="devw-face-row" key={r.key}>
          <span>{r.label}</span>
          <Toggle checked={isOn(r.key)} onChange={() => onToggle(r.key)} aria-label={r.label} />
        </div>
      ))}
    </div>
  );
}

/** The card's own ⋮ — Customize, plus whatever the board adds below it. */
function CardCustomizeMenu({ skuId, ...props }: React.ComponentProps<typeof ChooserPanel> & { skuId: string }) {
  // In a board cell the menu already ends in «Remove from Home», so neither the
  // Show on Home switch nor an Add row belongs there — they would be the same
  // decision twice, one of them inverted.
  const inCell = !!useCellActions();
  const home = props.home;
  const items: CardMenuItem[] = [
    { id: 'customize', icon: 'edit', label: 'Customize', panel: <ChooserPanel {...props} home={undefined} /> },
  ];
  // Off the board — Personalize — the card can put itself ON the board. The
  // controls it is showing go with it, ONCE: the Home widget opens on the same
  // rows and then keeps its own (Chris, 2026-10-13), so a lean glance and a
  // full workbench can be the same device.
  if (!inCell && home) {
    items.push(
      home.on
        ? { id: 'home-off', icon: 'minus', label: 'Remove from Home Dashboard', onSelect: () => home.onChange(false) }
        : {
            id: 'home-on',
            // `add`, the board's own + for putting a card on it — not a device
            // icon: the row is about the dashboard, not about the device.
            icon: 'add',
            label: 'Add to Home Dashboard',
            onSelect: () => {
              copyControlChoices(skuId, 'personalize', 'home');
              home.onChange(true);
            },
          },
    );
  }
  return <CardMenu name={props.name} items={items} />;
}

// Rich content for the concept monitor. Gated by SKU, not device type, while
// size-tier density is still a prototype (2026-08 call with Chris): only
// treehouse-32 carries the rich face; every other card — including other
// monitors — keeps the standard one. Widen deliberately if density becomes a
// DeviceCard capability. Defensive reads: the concept SKU and existing
// monitor SKUs carry different feature shapes.
//
// 2026-09-18: the OMEN OLED 27 joins. Displays are ours (Chris, 07-29: "Cindy,
// you got displays"), and a second monitor filling the same slots with no new
// code is the test the density idea needed — the slots are declared by the
// tier, the content by the device type. It fills what it has: no speakers, so
// no Speaker row and no Volume (see `hasAudio`).
const RICH_SKUS = ['treehouse-32', 'pulse-27'];
function monitorRich(skuId: string, type: string, features: unknown): MonitorRich | undefined {
  if (type !== 'monitor' || !RICH_SKUS.includes(skuId)) return undefined;
  const f = (features ?? {}) as Record<string, unknown>;
  const display = (f.display ?? {}) as Record<string, unknown>;
  const color = (f.color ?? {}) as Record<string, unknown>;
  const connectivity = (f.connectivity ?? {}) as Record<string, unknown>;
  const presets = Array.isArray(color.presets) ? (color.presets as string[]) : [];
  const inputs = Array.isArray(connectivity.inputs) ? (connectivity.inputs as string[]) : [];
  const res = typeof display.resolution === 'string' ? display.resolution : '';
  const hz = typeof display.refreshRate === 'number' ? `${display.refreshRate}Hz` : '';
  const input = (inputs[0] ?? '').split(' ×')[0];
  return {
    modes: Array.isArray(f.modes) ? (f.modes as string[]) : [],
    presets,
    conn: [input, res, hz].filter(Boolean).join(' · '),
    // Reads "Speaker · Built-in" — the label carries the noun, so the value
    // does not repeat it.
    output: 'Built-in',
    hasAudio: !!f.audio,
  };
}

/**
 * Resolve a SKU id into the data the card renders. Shortcuts come from
 * `deviceTabs` — the same list the modal's tool bar is built from — so a
 * shortcut can never open a tab the device doesn't have, and each carries the
 * tab's own icon rather than a second mapping that could drift from it.
 * The list is the device's WHOLE tab list; trimming it to what a given face
 * does not already control is that face's job, not the model's.
 */
export function deviceCardModel(skuId: string): DeviceCardModel | null {
  const sku = getResolvedSku(skuId);
  if (!sku) return null;
  const conn = connectionStatus(sku.features);
  const rich = monitorRich(skuId, sku.type, sku.features);
  // Every tab this device has, unfiltered — each surface decides for itself
  // which of them its own face already covers (see RICH_INLINE_TABS above).
  const shortcuts: DeviceShortcut[] = deviceTabs(sku).map((t) => ({
    tab: t.id,
    label: t.title,
    icon: t.icon,
  }));
  return {
    skuId,
    name: stripBrand(sku.name),
    type: sku.type,
    subtitle: `${conn.wireless ? 'Wireless ' : ''}${TYPE_LABEL[sku.type] ?? cap(sku.type)}`,
    image: deviceImageUrl(heroImageFile(sku)),
    batteryPct: conn.batteryLevel,
    shortcuts,
    rich,
    // Same gate as `rich` (type must be 'monitor') AND the feature must be
    // present — read from the SKU, never from a list of ids, so a second
    // under-glow display needs no edit here.
    underGlow: sku.type === 'monitor' && !!(sku.features as { underGlow?: unknown }).underGlow,
  };
}

/**
 * One piece of a card's status line. `repeats` names the control(s) whose
 * value the piece restates: while any of them is on the card's face the piece
 * is left out, because the control already says it (Chris, 2026-10-14 — the
 * DPI buttons and «1600 DPI» under the name were the same fact twice).
 */
export interface DeviceStatusPart {
  text: string;
  repeats?: string[];
}

export interface DeviceCardProps {
  model: DeviceCardModel;
  /** click the card body to open the device modal */
  onOpen?: () => void;
  /** click a shortcut to open the modal to that tab */
  onShortcut?: (tab: string) => void;
  /** When set, this peripheral is routed away by KVM (e.g. "Work Laptop") — the
   *  card reads "handed off" instead of its normal connected subtitle. */
  routedAway?: string;
  /** What this device is doing right now, under its type — the line people came
   *  to check (Personalize › Your desk). Without it the card is only a door.
   *  As parts, a piece drops out while the control it repeats is shown, and
   *  the line goes when nothing is left; an `attention` status never does. */
  status?: string | DeviceStatusPart[];
  /** `attention` when the status is something to fix (muted, disconnected). */
  statusTone?: 'attention';
  /**
   * Controls the card carries on its face (Personalize, 2026-10-12: the device
   * IS where you change it). The ⋮ on the card picks which of them show — the
   * card chooser Cindy drew for the monitor, now on every card that has
   * controls. A monitor's own rich rows give way to these.
   */
  controls?: DeviceCardControl[];
  /**
   * Which surface is drawing this card. It decides two things, and they are
   * separate on purpose (Chris, 2026-10-12/13):
   *  · WHERE the control choices are kept — Personalize's and Home's diverge
   *    after the card is added to the board.
   *  · HOW the card sizes. In Personalize a card with controls grows to its
   *    content; on Home it fills its board cell as every other widget does, so
   *    the photo keeps scaling with the card. Personalize's sizing on a board
   *    cell is what left the keyboard a thumbnail in a narrow cell (TH-440's
   *    slot, then).
   */
  scope?: CardScope;
  /** Which `controls` show in Personalize until the person picks their own.
   *  Defaults to the first. On Home a card starts with none. */
  defaultControls?: string[];
  /**
   * "Show on Home" at the top of the ⋮ (Kristy, 2026-10-12): Personalize is
   * where devices live, and this puts one on the Home board too. Omitted for a
   * device the board has no card for.
   */
  homeSwitch?: { on: boolean; onChange: (on: boolean) => void };
  /**
   * The device's parts with a window of their own, one line each under the
   * controls, always shown: they are ways in, not settings, so the ⋮ does not
   * choose them (JY, 2026-10-22: the desktop's cooler cap belongs to the PC,
   * so it shows on the PC's card rather than as a card of its own).
   */
  parts?: DeviceCardPart[];
  className?: string;
}

/** One control on a device card's face. */
export interface DeviceCardControl {
  key: string;
  /** Its name — above the control, and on its switch in the ⋮ chooser. */
  label: string;
  node: ReactNode;
}

/** A part of the device with a window of its own (the desktop's cooler cap):
 *  one line on the card, a way into that window. */
export interface DeviceCardPart {
  key: string;
  label: string;
  /** What is true of it now, in a word or two. */
  reading: string;
  /** A small picture of it, at the start of the line. */
  visual?: ReactNode;
  onOpen: () => void;
}

function SliderCell({
  cls,
  icon,
  label,
  value,
  onChange,
  autoCapable,
  managed,
  onGoAuto,
  onTakeManual,
}: {
  cls: string;
  icon: IconName;
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** control supports an Auto setting. Brightness only — Contrast and Volume have
   *  no auto feature on this monitor, so they get a plain slider and no switch. */
  autoCapable?: boolean;
  /** true when Auto is on and the display is setting this itself (read-only
   *  track, no handle, Auto switch on). Ignored when !autoCapable. */
  managed?: boolean;
  /** switch Auto ON — let the display set this */
  onGoAuto?: () => void;
  /** switch Auto OFF — take manual control (also happens on drag) */
  onTakeManual?: () => void;
}) {
  const isAuto = !!autoCapable && !!managed;
  return (
    <div
      className={'devr-cell ' + cls + (isAuto ? ' managed' : '')}
      title={isAuto ? `${label} is set automatically — switch Auto off for manual control` : undefined}
    >
      <Icon name={icon} size={14} aria-hidden />
      {/* `is-managed` carries the read-only drawing (device-card.css) — the same
          class the Display tab's Brightness uses, so card and modal cannot drift. */}
      <Slider
        min={0}
        max={100}
        value={value}
        onChange={onChange}
        aria-label={label}
        gradient={isAuto}
        className={isAuto ? 'is-managed' : undefined}
      />
      <span className="devr-val devr-pct">{value}%</span>
      {/* Fixed-width slot → all tracks align. Holds the Auto switch only for
          auto-capable controls; stays empty (but reserved) for manual-only ones
          like Contrast and Volume. The switch is the ONLY way back to manual —
          a managed slider is inert (`pointer-events: none`), so dragging cannot
          take it over. Corrected 2026-08-04; this note used to claim otherwise. */}
      <span className="devr-toggle">
        {autoCapable && (
          <>
            <span className="devr-auto-lbl">Auto</span>
            <Toggle
              checked={!!managed}
              onChange={(next) => (next ? onGoAuto?.() : onTakeManual?.())}
              aria-label={`Auto ${label.toLowerCase()}`}
              title={managed ? `${label} is set automatically — switch off for manual` : `Switch on to set ${label.toLowerCase()} automatically`}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        )}
      </span>
    </div>
  );
}

/** Rich tier rows — interaction stays inside the card (no modal open).
 *  Which rows are drawn is the card's business, not the panel's, so `shows`
 *  comes from DeviceCard — the same place the chooser link lives. */
function RichPanel({ skuId, rich, shows }: { skuId: string; rich: MonitorRich; shows: (k: FaceKey) => boolean }) {
  // Wired 2026-08-31. These three rows held `useState(72)` / `useState(50)` /
  // `useState(40)`, so the card reported numbers that were never this display's
  // and could not become them: the monitor window said 80% while the card said
  // 72%, for one screen, on one desk.
  //
  // Read and written through the monitor window's OWN hooks rather than through
  // the store directly (rule 15) — brightness in particular carries a rule with
  // it ("the mode wins, and matching happens inside the mode"), and a second
  // hand-written copy of that rule is how two surfaces drift apart.
  const { level: bright, setLevel: setBright } = useBrightnessLevel(rich.modes, skuId);
  const { picture, setValue } = usePicture(rich.modes, skuId);
  // Auto-Brightness — the ambient sensor, a display setting and NOT an AI state
  // (the OMEN gradient stays reserved for genuinely AI-held controls so the two
  // never read alike — Chris 1:1, 2026-08-04). Shared with the Display tab's
  // segmented control since 2026-08-31; before that each surface had its own
  // answer and neither survived a close.
  //
  // The switch is a two-state view of a three-state setting: off writes `Off`,
  // on writes `Ambient` (the shipped default) rather than restoring `Content`.
  // Choosing the SOURCE is the tab's job; the card only answers "is the display
  // doing this itself".
  const { autoBrightness, setAutoBrightness } = useAutoBrightness(skuId);
  const autoOn = autoBrightness !== 'Off';
  // Volume stays deliberately unwired, mode-scoped by nobody — see SPEAKER_VOLUME.
  const [volume, setVolume] = useState(SPEAKER_VOLUME);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="devr" onClick={stop} onPointerDown={stop}>
      {/* Readouts — grouped, non-interactive status. Labels make each value
          self-explanatory (esp. "Speaker · Built-in"). Expanded card has room. */}
      <div className="devr-meta">
        {shows('preset') && (
        <div className="devr-cell devr-preset" title="Color preset">
          <Icon name="color-palette" size={14} aria-hidden />
          <span className="devr-lbl">Preset</span>
          {/* The picked preset, not the SKU's first one. `''` means nobody has
              picked yet, which is the same convention the Display tab's Color
              chips use — so the fallback is that tab's fallback, not a second
              guess. */}
          <span className="devr-val">{picture.colorPreset || rich.presets[0] || 'Native'}</span>
        </div>
        )}
        {shows('conn') && (
        <div className="devr-cell devr-conn" title="Connection">
          <Icon name="bolt" size={14} aria-hidden />
          <span className="devr-lbl">Input</span>
          <span className="devr-val">{rich.conn}</span>
        </div>
        )}
        {/* "Speaker", not "Output": the Audio tab already spends that word on
            the EQ preset and the volume, and one word naming three things is
            how the card and the modal stopped agreeing. Matches the tab's
            Speaker section. (RichPanel is monitor-only — monitorRich() returns
            undefined for every other type, so no peripheral card is touched.) */}
        {shows('output') && (
        <div className="devr-cell devr-output" title="Audio output">
          <Icon name="spatial-audio" size={14} aria-hidden />
          <span className="devr-lbl">Speaker</span>
          <span className="devr-val">{rich.output}</span>
        </div>
        )}
      </div>
      {/* Live controls. Auto state is shown by SHAPE, not colour — no handle and a
          meter-faint track; the fill stays the ordinary accent either way. */}
      <div className="devr-sliders">
        {shows('brightness') && (
        <SliderCell cls="devr-brightness" icon="brightness" label="Brightness" value={bright} autoCapable managed={autoOn} onChange={(v) => { setBright(v); setAutoBrightness('Off'); }} onGoAuto={() => setAutoBrightness('Ambient')} onTakeManual={() => setAutoBrightness('Off')} />
        )}
        {/* Contrast is manual-only. The Display tab's "Dynamic Contrast" is a
            picture effect, not an auto setting, so there is nothing here for an
            Auto switch to hand over to (verifier-log 2026-08-04). */}
        {shows('contrast') && (
        <SliderCell cls="devr-contrast" icon="contrast" label="Contrast" value={picture.contrast} onChange={(v) => setValue('contrast', v)} />
        )}
        {/* Volume is manual-only — no Auto (no such feature in the Audio tab). */}
        {shows('volume') && (
        <SliderCell cls="devr-volume" icon="audio" label="Volume" value={volume} onChange={setVolume} />
        )}
      </div>
    </div>
  );
}

/** Presentational device card — see module note. Renders the DS `.w` surface. */
export function DeviceCard({
  model,
  onOpen,
  onShortcut,
  routedAway,
  status,
  statusTone,
  controls,
  defaultControls,
  scope = 'personalize',
  homeSwitch,
  parts,
  className,
}: DeviceCardProps) {
  const low = model.batteryPct != null && model.batteryPct <= 20;
  // Rule A applied at the face that owns it: drop the tabs this card already
  // controls inline. Only the rich monitor face has such controls.
  // A Personalize card carries no tab shortcuts: its controls sit on the card
  // and the card itself opens the device (Kristy, 2026-10-13).
  const shortcuts =
    controls && scope === 'personalize'
      ? []
      : model.rich && !controls
        ? model.shortcuts.filter((s) => !RICH_INLINE_TABS.includes(s.tab))
        : model.shortcuts;
  // Which rich rows this card draws, and the chooser that edits it (scope 1.0).
  const [face, setFace] = useState<FaceKey[]>(loadFace);
  // A card with its own controls: which of them it shows, kept per device.
  const ctlKeys = (controls ?? []).map((c) => c.key);
  // On Home a card starts with no controls, only its tab shortcuts (Chris,
  // 2026-10-26): the default board reads as a clean grid of devices, and ⋮ ›
  // Customize adds what someone wants there. Personalize keeps its defaults.
  const [shownCtl, setShownCtl] = useState<string[]>(() =>
    scope === 'home'
      ? loadShown(model.skuId, scope, ctlKeys, [], [])
      : loadShown(model.skuId, scope, ctlKeys, defaultControls ?? ctlKeys.slice(0, 1)),
  );
  const toggleCtl = (k: string) =>
    setShownCtl((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : ctlKeys.filter((x) => prev.includes(x) || x === k);
      try {
        localStorage.setItem(controlsKey(model.skuId, scope), JSON.stringify(next));
      } catch {
        /* storage blocked: the choice lasts this visit */
      }
      return next;
    });
  // The status line says only what the face does not: a part whose control is
  // shown is the same fact twice. An attention status (muted) is the warning
  // the line exists for, so it stays whatever is shown.
  const repeated = (part: DeviceStatusPart) =>
    statusTone !== 'attention' && !!controls && !!part.repeats?.some((k) => shownCtl.includes(k));
  const statusText = Array.isArray(status)
    ? status
        .filter((part) => !repeated(part))
        .map((part) => part.text)
        .join(' · ')
    : status;
  // Controls replace a monitor's own rich rows (and their chooser).
  const rich = controls ? undefined : model.rich;
  const stopHere = (e: React.SyntheticEvent) => e.stopPropagation();
  // The mode badge, resolved live (2026-08-31). It used to read `Game` as a
  // literal, so the card asserted an activity on a display whose own window
  // showed NO mode selected — the unselected state has been deliberate since
  // 2026-08-07 ("the product must not assert an activity nobody chose"), and
  // this card was quietly contradicting it on the home page.
  //
  // Custom presets count: they sit beside the built-in three everywhere else
  // (`customModes`, Settings.tsx), so a card that only knew the built-ins would
  // blank out for anyone using their own.
  const { customModes } = useSettings();
  const mode = useResolvedMode(
    model.rich ? [...model.rich.modes, ...(Array.isArray(customModes) ? customModes : [])] : [],
  );
  // A row the hardware cannot back is never drawn and never offered.
  const fits = (k: FaceKey) => !!model.rich?.hasAudio || (k !== 'output' && k !== 'volume');
  const shows = (k: FaceKey) => face.includes(k) && fits(k);
  const toggleRow = (k: FaceKey) =>
    setFace((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : FACE_ALL.filter((x) => prev.includes(x) || x === k);
      localStorage.setItem(FACE_KEY, JSON.stringify(next));
      return next;
    });
  return (
    <div
      data-kind={model.type}
      className={[
        'w',
        'ds-devcard',
        rich ? 'rich' : '',
        controls && shownCtl.length ? 'has-controls' : '',
        // Personalize keeps its card shape with every control off too: the name
        // and photo stay on the same top line as their neighbours (Kristy, 2026-10-13).
        controls && scope === 'personalize' ? 'fit-content' : '',
        model.underGlow ? 'has-underglow' : '',
        routedAway ? 'routed-away' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Configure ${model.name}` : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      {/* Card-scope action, top-right of the CARD — the line `Full Details →`
          and `Manage →` sit on in every WidgetShell card. It is a child of the
          card rather than of the title row because the title row lives in the
          text column only: right-aligning inside that column parks the link in
          the dead space beside the title instead of on the card's edge, which
          is what it looked like on the first pass. Absolute for the same reason
          the device card has no `.w-label` at all — its identity block is the
          big title, and adding a header row would say the name twice. */}
      {rich && (
        <CardCustomizeMenu
          skuId={model.skuId}
          name={model.name}
          rows={FACE_ROWS.filter((r) => fits(r.key))}
          isOn={(k) => shows(k as FaceKey)}
          onToggle={(k) => toggleRow(k as FaceKey)}
          home={homeSwitch}
        />
      )}
      {controls && (controls.length > 1 || homeSwitch) && (
        <CardCustomizeMenu
          skuId={model.skuId}
          name={model.name}
          rows={controls}
          isOn={(k) => shownCtl.includes(k)}
          onToggle={toggleCtl}
          home={homeSwitch}
        />
      )}
      <div className="devw-body">
        <div className="devw-main">
          {model.batteryPct != null && (
            <span className={'dev-battery' + (low ? ' low' : '')} title={`Battery ${model.batteryPct}%`}>
              <Icon name={batteryIcon(model.batteryPct)} className="dev-battery-icon" width={22} height={11} aria-hidden />
              <span className="dev-battery-pct">{model.batteryPct}%</span>
            </span>
          )}
          <div className="devw-textblock">
            <div className="devw-title-row">
              <div className="devw-title">{model.name}</div>
              {/* No mode picked = no badge. An empty chip or a `—` would still
                  occupy the slot beside the name and read as a value; nothing
                  is the honest drawing, and it matches the mode bar in the
                  window, which simply has nothing selected. */}
              {rich && mode && (
                <Badge variant="status" className="devw-mode">
                  {mode}
                </Badge>
              )}
            </div>
            {routedAway ? (
              <div className="devw-sub devw-away">
                <Icon name="devices" size={12} aria-hidden /> On {routedAway}
              </div>
            ) : (
              <div className="devw-sub">{model.subtitle}</div>
            )}
            {statusText && (
              <div className={'devw-status' + (statusTone === 'attention' ? ' attention' : '')}>
                {statusTone === 'attention' && <Icon name="alert" size={12} aria-hidden />}
                {statusText}
              </div>
            )}
            {shortcuts.length > 0 && (
              <div className="dev-shortcuts">
                {shortcuts.map((s) => (
                  <button
                    key={s.tab}
                    type="button"
                    className="dev-shortcut"
                    title={s.label}
                    aria-label={`Open ${s.label}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShortcut?.(s.tab);
                    }}
                  >
                    <Icon name={s.icon} size={16} aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {model.image && <div className="devw-photo" style={{ backgroundImage: `url(${model.image})` }} />}
        {rich && <RichPanel skuId={model.skuId} rich={rich} shows={shows} />}
      </div>
      {controls && shownCtl.length > 0 && (
        // Changing a control never opens the device: the press stops here.
        <div className="devw-controls" onClick={stopHere} onPointerDown={stopHere} onKeyDown={stopHere}>
          {controls
            .filter((c) => shownCtl.includes(c.key))
            .map((c) => (
              <div className="devw-ctl" key={c.key}>
                <span className="devw-ctl-label">{c.label}</span>
                {c.node}
              </div>
            ))}
        </div>
      )}
      {parts && parts.length > 0 && (
        // A part opens its own window, not the device's: the press stops here.
        <div className="devw-parts" onClick={stopHere} onPointerDown={stopHere} onKeyDown={stopHere}>
          {parts.map((pt) => (
            <button key={pt.key} type="button" className="devw-part" data-part={pt.key} onClick={pt.onOpen} aria-label={`${pt.label}: ${pt.reading}. Open`}>
              {pt.visual && <span className="devw-part-visual" aria-hidden>{pt.visual}</span>}
              <span className="devw-part-label">{pt.label}</span>
              <span className="devw-part-reading">{pt.reading}</span>
              <Icon name="chevron-right" size={12} aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

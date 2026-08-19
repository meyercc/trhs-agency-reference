import { useState } from 'react';
import { Icon, Slider, Badge, Toggle, type IconName } from '../components';
import { getResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from '../devices/skus';
import { deviceTabs } from '../devices/deviceTabs';
import './device-card.css';

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
export interface MonitorRich {
  /** active mode, shown as a chip next to the name (Expanded tier only) */
  mode: string;
  /** active color preset */
  preset: string;
  /** active input · resolution · refresh */
  conn: string;
  /** audio output route */
  output: string;
  /** controls the active profile / OMEN AI currently drives (managed state);
   *  keys: 'brightness' | 'contrast' | 'volume'. Anything not listed is
   *  user-owned (manual). Prototype default marks brightness managed (OMEN AI
   *  adaptive tuning). The final managed-state model is a Thursday card-review
   *  item — this is our proposal ahead of that. */
  managed: string[];
}
export interface DeviceCardModel {
  skuId: string;
  name: string;
  subtitle: string;
  image?: string;
  /** battery %, or null when wired (battery row hidden) */
  batteryPct: number | null;
  shortcuts: DeviceShortcut[];
  /** monitor-only rich size-tier content */
  rich?: MonitorRich;
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
// those tabs are dropped as shortcuts — leaving the tabs with no on-face
// control (Overview, Utilities). Peripheral cards have no inline controls, so
// the same rule leaves ALL their tabs as shortcuts (see the filter below).
// (The old TAB_ICON map is gone: deviceTabs entries carry their own icon.)
const RICH_INLINE_TABS = ['display', 'connectivity', 'audio'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Card titles drop the "HyperX" brand prefix (the product name carries it),
// matching the device-card design (e.g. "Pulsefire Saga Pro", not "HyperX …").
const stripBrand = (n: string) => n.replace(/^HyperX\s+/i, '');
const batteryIcon = (pct: number): IconName =>
  `battery-${Math.max(0, Math.min(100, Math.round(pct / 10) * 10))}` as IconName;

// Rich content for the concept monitor. Gated by SKU, not device type, while
// size-tier density is still a prototype (2026-08 call with Chris): only
// treehouse-32 carries the rich face; every other card — including other
// monitors — keeps the standard one. Widen deliberately if density becomes a
// DeviceCard capability. Defensive reads: the concept SKU and existing
// monitor SKUs carry different feature shapes.
const RICH_SKUS = ['treehouse-32'];
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
    mode: 'Game',
    preset: presets[0] ?? 'Native',
    conn: [input, res, hz].filter(Boolean).join(' · '),
    output: 'Built-in speakers',
    // Auto-capable controls (grounded in the Treehouse Display tab): Brightness
    // (IA "Auto vs Manual" + ambient sensor) and Contrast ("Dynamic Contrast"
    // toggle, MonitorTabs). Volume is NOT auto (no such feature) — manual only.
    managed: ['brightness', 'contrast'],
  };
}

/**
 * Resolve a SKU id into the data the card renders. Shortcuts come from
 * `deviceTabs` — the same list the modal's tool bar is built from — so a
 * shortcut can never open a tab the device doesn't have, and each carries the
 * tab's own icon rather than a second mapping that could drift from it.
 */
export function deviceCardModel(skuId: string): DeviceCardModel | null {
  const sku = getResolvedSku(skuId);
  if (!sku) return null;
  const conn = connectionStatus(sku.features);
  const rich = monitorRich(skuId, sku.type, sku.features);
  const shortcuts: DeviceShortcut[] = deviceTabs(sku)
    .map((t) => ({ tab: t.id, label: t.title, icon: t.icon }))
    .filter((s) => (rich ? !RICH_INLINE_TABS.includes(s.tab) : true));
  return {
    skuId,
    name: stripBrand(sku.name),
    subtitle: `${conn.wireless ? 'Wireless ' : ''}${TYPE_LABEL[sku.type] ?? cap(sku.type)}`,
    image: deviceImageUrl(heroImageFile(sku)),
    batteryPct: conn.batteryLevel,
    shortcuts,
    rich,
  };
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
  className?: string;
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
  /** control supports OMEN AI auto (Brightness, Contrast). Volume does NOT —
   *  it gets a plain slider with no Auto switch and no orange track. */
  autoCapable?: boolean;
  /** true when OMEN AI currently drives an auto-capable control (orange track +
   *  Auto switch on). Ignored when !autoCapable. */
  managed?: boolean;
  /** switch Auto ON — hand the control to OMEN AI */
  onGoAuto?: () => void;
  /** switch Auto OFF — take manual control (also happens on drag) */
  onTakeManual?: () => void;
}) {
  const isAuto = !!autoCapable && !!managed;
  return (
    <div
      className={'devr-cell ' + cls + (isAuto ? ' managed' : '')}
      title={isAuto ? `${label} is set by OMEN AI — switch Auto off (or drag) for manual control` : undefined}
    >
      <Icon name={icon} size={14} aria-hidden />
      <Slider min={0} max={100} value={value} onChange={onChange} aria-label={label} gradient={isAuto} />
      <span className="devr-val devr-pct">{value}%</span>
      {/* Fixed-width slot → all tracks align. Holds the Auto switch only for
          auto-capable controls; stays empty (but reserved) for manual-only ones
          like Volume. The switch flips EITHER way; dragging also flips it off. */}
      <span className="devr-toggle">
        {autoCapable && (
          <>
            <span className="devr-auto-lbl">Auto</span>
            <Toggle
              checked={!!managed}
              onChange={(next) => (next ? onGoAuto?.() : onTakeManual?.())}
              aria-label={`${label} set by OMEN AI`}
              title={managed ? `${label} is set by OMEN AI — switch off for manual` : `Switch on to let OMEN AI set ${label}`}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        )}
      </span>
    </div>
  );
}

/** Rich tier rows — interaction stays inside the card (no modal open). */
function RichPanel({ rich }: { rich: MonitorRich }) {
  const [bright, setBright] = useState(72);
  const [contrast, setContrast] = useState(50);
  const [volume, setVolume] = useState(40);
  // Which controls the AI currently drives — local state so the OMEN AI tag can
  // hand a control back to manual on click. Seeded from the SKU's managed set.
  const [managed, setManaged] = useState<string[]>(rich.managed);
  const isManaged = (k: string) => managed.includes(k);
  const takeManual = (k: string) => setManaged((m) => m.filter((x) => x !== k));
  const goAuto = (k: string) => setManaged((m) => (m.includes(k) ? m : [...m, k]));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="devr" onClick={stop} onPointerDown={stop}>
      {/* Readouts — grouped, non-interactive status. Labels make each value
          self-explanatory (esp. "Audio · Speakers"). Expanded card has room. */}
      <div className="devr-meta">
        <div className="devr-cell devr-preset" title="Color preset">
          <Icon name="color-palette" size={14} aria-hidden />
          <span className="devr-lbl">Preset</span>
          <span className="devr-val">{rich.preset}</span>
        </div>
        <div className="devr-cell devr-conn" title="Connection">
          <Icon name="bolt" size={14} aria-hidden />
          <span className="devr-lbl">Input</span>
          <span className="devr-val">{rich.conn}</span>
        </div>
        <div className="devr-cell devr-output" title="Audio output">
          <Icon name="spatial-audio" size={14} aria-hidden />
          <span className="devr-lbl">Output</span>
          <span className="devr-val">{rich.output}</span>
        </div>
      </div>
      {/* Live controls. Track colour shows the state (orange = OMEN AI / auto,
          accent = manual); dragging a managed slider hands it back to manual. */}
      <div className="devr-sliders">
        <SliderCell cls="devr-brightness" icon="brightness" label="Brightness" value={bright} autoCapable managed={isManaged('brightness')} onChange={(v) => { setBright(v); takeManual('brightness'); }} onGoAuto={() => goAuto('brightness')} onTakeManual={() => takeManual('brightness')} />
        <SliderCell cls="devr-contrast" icon="contrast" label="Contrast" value={contrast} autoCapable managed={isManaged('contrast')} onChange={(v) => { setContrast(v); takeManual('contrast'); }} onGoAuto={() => goAuto('contrast')} onTakeManual={() => takeManual('contrast')} />
        {/* Volume is manual-only — no Auto (no such feature in the Audio tab). */}
        <SliderCell cls="devr-volume" icon="audio" label="Volume" value={volume} onChange={setVolume} />
      </div>
    </div>
  );
}

/** Presentational device card — see module note. Renders the DS `.w` surface. */
export function DeviceCard({ model, onOpen, onShortcut, routedAway, className }: DeviceCardProps) {
  const low = model.batteryPct != null && model.batteryPct <= 20;
  return (
    <div
      className={['w', 'ds-devcard', model.rich ? 'rich' : '', routedAway ? 'routed-away' : '', className]
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
              {model.rich && (
                <Badge variant="status" className="devw-mode">
                  {model.rich.mode}
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
            {model.shortcuts.length > 0 && (
              <div className="dev-shortcuts">
                {model.shortcuts.map((s) => (
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
        {model.rich && <RichPanel rich={model.rich} />}
      </div>
    </div>
  );
}

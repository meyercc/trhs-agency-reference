/**
 * The generic renderer for a registry-bound item (TH-452): a `Binding` row, a
 * presentation, and the value read from — and written to — wherever the row
 * says it lives.
 *
 * TWO LAYERS, deliberately. The RESOLVERS are components, one per `Source`
 * kind, because each is a different hook chain and a hook cannot be called
 * conditionally: `BoundItem` switches on the source at a component boundary and
 * every resolver calls its hooks unconditionally (the `AudioControl → AudioFor`
 * two-step in `LiveControl.tsx` was the idiom). The PRESENTATION is one pure
 * switch, `Present`, over `{ value, set, locked }` — it does not know or care
 * where the value came from.
 *
 * Nothing here keeps a value of its own. A slider on a card IS the slider in
 * the device window: a profile key through `useProfileValue`, saved to the
 * active profile; a Settings key through `useSettings().set`; a reading from
 * the ONE vitals stream the host fans out (`snapshot` is a prop, never a hook —
 * three cards each calling `useVitalsStream` would show three different CPU
 * numbers side by side).
 *
 * Data attributes carry the suite's and the HUD's expectations forward: a
 * reading tile is `[data-metric]`, a control frame is `[data-control]`, and
 * every bound item is `[data-bind][data-as]`.
 */
import { BalanceSlider, Chip, Dropdown, Meter, Slider, SoftwareOnly, Sparkline, StatTile, Toggle, ToggleButtonGroup, VuSlider } from '../components';
import { Gauge } from '../widgets/Gauge';
import { useSettings } from '../state/Settings';
import { useDeviceProfileBar, useProfileValue } from '../devices/ProfileBar';
import { useAutoBrightness, useBrightnessLevel, usePicture } from '../devices/monitor/monitorMode';
import { useNova } from '../state/Nova';
import { fmtTokens, fmtUsd, fmtWh } from '../nova/format';
import { WALLPAPERS } from '../app/wallpapers';
import { modesOf } from '../widgets/DisplayWidgets';
import type { ResolvedSku } from '../devices/skus';
import type { VitalsStream } from '../modals/vitalsData';
import { allowedFor, BINDINGS, type Binding, type BoundItem as BoundItemSpec, type Option, type OptionsFrom, type Presentation, type Source } from '../state/bindings';
import { defaultFormOf } from '../state/overlays';
import { Absent, LiveControlFrame, usePrimary } from './frame';
import { LiveControl } from './LiveControl';
import { CardBlock } from '../widgets/CardBlocks';

const DEVICE_WHAT: Record<string, string> = { monitor: 'Display', headset: 'Headset', mouse: 'Mouse', microphone: 'Microphone', keyboard: 'Keyboard' };

/** The form an item renders in: its own `as` when the row allows it, else the row's default. */
export function formOf(b: Binding, item: BoundItemSpec): Presentation {
  return item.as && allowedFor(b).includes(item.as) ? item.as : defaultFormOf(b);
}

export function BoundItem({ item, stream }: { item: BoundItemSpec; stream?: VitalsStream }) {
  const b = BINDINGS[item.bind];
  if (!b) return null;
  const as = formOf(b, item);
  const src = b.source;
  switch (src.kind) {
    case 'vitals':
      return <VitalsBound b={b} src={src} as={as} stream={stream} />;
    case 'setting':
      return <SettingBound b={b} name={src.name} as={as} />;
    case 'profile':
      return <ProfileBound b={b} src={src} as={as} />;
    case 'monitor':
      return <MonitorBound b={b} field={src.field} as={as} />;
    case 'nova':
      return <NovaBound b={b} src={src} as={as} />;
    case 'custom':
      return <LiveControl kind={src.control} />;
    case 'block':
      return <CardBlock item={{ kind: 'block', block: src.block, ...(item.count != null ? { count: item.count } : {}), ...(item.subject ? { subject: item.subject } : {}) }} />;
    default:
      // `series`, `spec` — declared for Phase B, not renderable yet.
      // Saying so beats an empty cell that looks like it is measuring something.
      return <Absent what={b.label} data-bind={b.id} />;
  }
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function fmt(v: unknown, digits = 0): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return digits > 0 ? v.toFixed(digits) : Math.round(v).toLocaleString();
}

/**
 * A reading, from the host's one stream. Read-only, so never a control — but
 * since TH-454 it has four forms: a tile (the number), a meter (a level bar on
 * the row's scale), a gauge (a dial on it), and a sparkline where the stream
 * keeps a history series for the row.
 */
function VitalsBound({ b, src, as, stream }: { b: Binding; src: Extract<Source, { kind: 'vitals' }>; as: Presentation; stream?: VitalsStream }) {
  const raw = stream ? getPath(stream.snapshot, src.path) : undefined;
  const v = typeof raw === 'number' ? raw / (src.scale ?? 1) : NaN;
  const shown = fmt(v, src.digits);
  const common = { 'data-metric': b.id, 'data-bind': b.id, 'data-as': as } as const;
  if (as === 'sparkline' && b.series) {
    const scale = b.valueType === 'percent' ? { min: 0, max: 100 } : {};
    return <Sparkline label={b.label} points={stream?.history[b.series] ?? []} display={shown} unit={b.unit || undefined} {...scale} {...common} />;
  }
  const { min = 0, max = 100 } = b.range ?? {};
  const pct = Number.isFinite(v) ? ((v - min) / (max - min || 1)) * 100 : 0;
  if (as === 'meter') return <Meter label={b.label} value={pct} display={shown} unit={b.unit ?? ''} {...common} />;
  if (as === 'gauge') return <Gauge size="sm" value={pct} display={Number.isFinite(v) ? Math.round(v) : undefined} unit={b.unit === '\u00b0C' ? '\u00b0' : b.unit || ''} sublabel={b.label} {...common} />;
  return <StatTile compact label={b.label} value={shown} unit={b.unit || undefined} tone={b.id === 'fps' ? 'accent' : 'neutral'} {...common} />;
}

/**
 * A Settings key, through the generic setter — one hook, no per-key accessor.
 * A key the active profile overrides (`OVERRIDABLE`: accent, wallpaper and its
 * blur and opacity) shows the profile's value and LOCKS, with the reason: the
 * setter would write the baseline underneath, and nothing visible would change
 * (TH-453). The wallpaper's options are the app's, resolved here because the
 * registry cannot import a module that loads images.
 */
function SettingBound({ b, name, as }: { b: Binding; name: Parameters<ReturnType<typeof useSettings>['set']>[0]; as: Presentation }) {
  const { get, set, isOverridden } = useSettings();
  const value = get<unknown>(name);
  const options = b.options ?? (name === 'wallpaper' ? WALLPAPERS.map((w) => ({ value: w.id, label: w.name })) : undefined);
  return <Present b={b} as={as} title={b.label} value={value} set={(v) => set(name, v)} options={options} locked={isOverridden(name)} reason="your active profile sets this — change it in the profile, or switch profiles" />;
}

/**
 * A per-device profile key. Two components, because `usePrimary` may find no
 * device and the hooks that need one cannot be called conditionally.
 */
function ProfileBound({ b, src, as }: { b: Binding; src: Extract<Source, { kind: 'profile' }>; as: Presentation }) {
  const sku = usePrimary(src.needs);
  return sku ? <ProfileBoundFor b={b} src={src} as={as} sku={sku} /> : <Absent what={DEVICE_WHAT[src.needs] ?? b.label} data-bind={b.id} />;
}

function ProfileBoundFor({ b, src, as, sku }: { b: Binding; src: Extract<Source, { kind: 'profile' }>; as: Presentation; sku: ResolvedSku }) {
  const profile = useDeviceProfileBar(sku);
  const [value, setValue] = useProfileValue<unknown>(profile, src.key, src.fallback);
  const options = b.options ?? (b.optionsFrom ? resolveOptions(sku.features as Record<string, unknown>, b.optionsFrom) : undefined);
  // The row exists for the device TYPE; this particular SKU may lack the
  // feature (the Cloud III has `power: false`, so no auto power-off list). An
  // empty chip row would look like a control that simply has nothing selected;
  // saying so is the honest state, the way an absent device is.
  if (b.optionsFrom && options && !options.length) {
    return (
      <LiveControlFrame title={`${sku.name} ${b.label.toLowerCase()}`} data-control={b.id} data-bind={b.id} data-as={as} data-absent="sku">
        <span className="ds-live-control-value">Not on the {sku.name}.</span>
      </LiveControlFrame>
    );
  }
  return (
    <Present
      b={b}
      as={as}
      title={`${sku.name} ${b.label.toLowerCase()}`}
      value={value}
      set={setValue}
      options={options}
      locked={profile.locked}
      reason={`the ${(DEVICE_WHAT[src.needs] ?? 'device').toLowerCase()} is running an onboard slot — change it in its window`}
    />
  );
}

/** The desk's primary display, through the same hook the monitor window and the home card use. */
type MonitorField = Extract<Source, { kind: 'monitor' }>['field'];
type PictureField = Exclude<MonitorField, 'brightness' | 'autoBrightness'>;

function MonitorBound({ b, field, as }: { b: Binding; field: MonitorField; as: Presentation }) {
  const sku = usePrimary('monitor');
  if (!sku) return <Absent what="Display" data-bind={b.id} />;
  // One component per hook, so each hook is unconditional (TH-453).
  if (field === 'brightness') return <BrightnessBound b={b} as={as} sku={sku} />;
  if (field === 'autoBrightness') return <AutoBrightnessBound b={b} as={as} sku={sku} />;
  return <PictureBound b={b} as={as} sku={sku} field={field} />;
}

function BrightnessBound({ b, as, sku }: { b: Binding; as: Presentation; sku: ResolvedSku }) {
  const { level, setLevel, synced } = useBrightnessLevel(modesOf(sku.id), sku.id);
  return <Present b={b} as={as} title={`${sku.name} ${b.label.toLowerCase()}${synced ? ' · all displays' : ''}`} value={level} set={(v) => setLevel(v as number)} />;
}

function AutoBrightnessBound({ b, as, sku }: { b: Binding; as: Presentation; sku: ResolvedSku }) {
  const { autoBrightness, setAutoBrightness } = useAutoBrightness(sku.id);
  return <Present b={b} as={as} title={`${sku.name} ${b.label.toLowerCase()}`} value={autoBrightness} set={(v) => setAutoBrightness(String(v))} options={b.options} />;
}

/** The Display tab's own fallback when a SKU names no presets. */
const COLOR_PRESET_FALLBACK = ['Native', 'sRGB', 'DCI-P3'];

/** Contrast, sharpness, black stretch, color preset — the picture hook, filed under the current mode as the Display tab does. */
function PictureBound({ b, as, sku, field }: { b: Binding; as: Presentation; sku: ResolvedSku; field: PictureField }) {
  const { picture, setValue } = usePicture(modesOf(sku.id), sku.id);
  const fromSku = b.optionsFrom ? resolveOptions(sku.features as Record<string, unknown>, b.optionsFrom) : [];
  const options = b.options ?? (fromSku.length ? fromSku : COLOR_PRESET_FALLBACK.map((v) => ({ value: v, label: v })));
  // '' = nobody has picked a preset yet; the SKU's first stands in (the tab's convention).
  const raw = picture[field];
  const value = field === 'colorPreset' && !raw ? options[0]?.value : raw;
  const set = (v: unknown) => {
    if (field === 'blackStretch' || field === 'colorPreset') setValue(field, String(v));
    else setValue(field, Number(v));
  };
  return <Present b={b} as={as} title={`${sku.name} ${b.label.toLowerCase()}`} value={value} set={set} options={b.valueType === 'enum' ? options : undefined} />;
}

/** A Nova ledger total, formatted the way the Tokenomics popover formats it. Read-only, so always a tile. */
function NovaBound({ b, src, as }: { b: Binding; src: Extract<Source, { kind: 'nova' }>; as: Presentation }) {
  const { totals } = useNova();
  const v = totals[src.field];
  const anyUsage = totals.tokensIn + totals.tokensOut > 0;
  let value: string;
  let unit: string | undefined = b.unit || undefined;
  switch (src.fmt) {
    case 'usd': value = fmtUsd(v); break;
    case 'wh': { const s = fmtWh(v); value = s.replace(/ .*$/, ''); unit = s.replace(/^[\d.]+ ?/, '') || undefined; break; }
    case 'pct': value = anyUsage ? String(Math.round(v * 100)) : '\u2014'; unit = anyUsage ? '%' : undefined; break;
    case 'tokens': value = fmtTokens(v); break;
    case 'seconds': value = v >= 60 ? (v / 60).toFixed(1) : v.toFixed(1); unit = v >= 60 ? 'min' : 's'; break;
    default: value = Math.round(v).toLocaleString();
  }
  return <StatTile compact label={b.label} value={value} unit={unit} tone="neutral" data-metric={b.id} data-bind={b.id} data-as={as} />;
}

/**
 * Options read off the real device: `path` into its features, an array of
 * strings (labelled by `labels`), numbers (suffixed) or `{label, value}` rows.
 */
export function resolveOptions(features: Record<string, unknown>, of: OptionsFrom): Option[] {
  const arr = getPath(features, of.path);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x): Option | null => {
      if (typeof x === 'string') return { value: x, label: of.labels?.[x] ?? x };
      if (typeof x === 'number') return { value: String(x), label: `${x}${of.suffix ?? ''}` };
      if (x && typeof x === 'object' && typeof (x as Option).value === 'string') return { value: (x as Option).value, label: String((x as Option).label ?? (x as Option).value) };
      return null;
    })
    .filter((o): o is Option => !!o);
}

// ── Presentation ──────────────────────────────────────────────────────────────

interface PresentProps {
  b: Binding;
  as: Presentation;
  title: string;
  value: unknown;
  set?: (v: unknown) => void;
  options?: readonly Option[];
  locked?: boolean;
  reason?: string;
}

/** A bipolar value as its head line: "even", "mic 40%", "playback 20%". */
function bipolarLabel(b: Binding, v: number): string {
  const { min, max } = b.range ?? { min: 0, max: 100 };
  const mid = (min + max) / 2;
  const [left, right] = b.sides ?? ['left', 'right'];
  if (v === mid) return 'even';
  const pct = Math.round((Math.abs(v - mid) / (max - min)) * 200);
  return v < mid ? `${left} ${pct}%` : `${right} ${pct}%`;
}

/**
 * The one pure switch from a value and a form to a component. Writable forms
 * sit in the frame with the device and current value in its head, inside
 * `SoftwareOnly` so a device on an onboard slot locks them the way its window
 * does. A `tile` is the same compact stat tile a reading uses.
 */
function Present({ b, as, title, value, set, options, locked = false, reason = '' }: PresentProps) {
  const num = typeof value === 'number' ? value : Number(value);
  const { min = 0, max = 100, step } = b.range ?? {};
  const unit = b.unit ?? '';
  const common = { 'data-control': b.id, 'data-bind': b.id, 'data-as': as } as const;

  if (as === 'tile') {
    const shown = b.valueType === 'bool' ? (value ? 'On' : 'Off') : b.valueType === 'enum' ? (options?.find((o) => o.value === value)?.label ?? String(value ?? '—')) : fmt(num, b.source.kind === 'vitals' && b.source.digits ? b.source.digits : 0);
    return <StatTile compact label={b.label} value={shown} unit={b.valueType === 'bool' || b.valueType === 'enum' ? undefined : unit || undefined} tone="neutral" data-metric={b.id} data-bind={b.id} data-as={as} />;
  }

  // A writable percentage shown read-only, as the model may choose (TH-454).
  if (as === 'meter' || as === 'gauge') {
    const pct = Number.isFinite(num) ? ((num - min) / (max - min || 1)) * 100 : 0;
    return as === 'meter'
      ? <Meter label={title} value={pct} display={fmt(num)} unit={unit} {...common} />
      : <Gauge size="sm" value={pct} display={Number.isFinite(num) ? Math.round(num) : undefined} unit={unit === '\u00b0C' ? '\u00b0' : unit} sublabel={b.label} {...common} />;
  }

  if (as === 'toggle') {
    const on = !!value;
    return (
      <LiveControlFrame title={title} value={on ? 'On' : 'Off'} {...common}>
        <SoftwareOnly locked={locked} reason={reason}>
          <div className="ds-live-control-row">
            <span className="ds-text-label">{on ? 'On' : 'Off'}</span>
            <Toggle checked={on} onChange={(v) => set?.(v)} aria-label={title} />
          </div>
        </SoftwareOnly>
      </LiveControlFrame>
    );
  }

  if (as === 'choice') {
    const opts = options ?? [];
    const current = typeof value === 'string' ? value : String(value ?? '');
    const label = opts.find((o) => o.value === current)?.label ?? current;
    const n = opts.length;
    return (
      <LiveControlFrame title={title} value={label} {...common}>
        <SoftwareOnly locked={locked} reason={reason}>
          {n <= 4 ? (
            <ToggleButtonGroup aria-label={title} value={current} onChange={(v) => set?.(v)} options={opts.map((o) => ({ label: o.label, value: o.value }))} fullWidth />
          ) : n <= 10 ? (
            <div className="ds-live-control-chips" role="radiogroup" aria-label={title}>
              {opts.map((o) => (
                <Chip key={o.value} role="radio" aria-checked={current === o.value} selected={current === o.value} onClick={() => set?.(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          ) : (
            <Dropdown aria-label={title} value={current} onChange={(v) => set?.(v)} options={opts.map((o) => ({ label: o.label, value: o.value }))} />
          )}
        </SoftwareOnly>
      </LiveControlFrame>
    );
  }

  if (as === 'balance') {
    return (
      <LiveControlFrame title={title} value={bipolarLabel(b, num)} {...common}>
        <SoftwareOnly locked={locked} reason={reason}>
          <BalanceSlider min={min} max={max} step={step} value={num} onChange={(v) => set?.(v)} aria-label={title} />
        </SoftwareOnly>
      </LiveControlFrame>
    );
  }

  // slider and vu — a number in its range, the value in the head with its unit.
  return (
    <LiveControlFrame title={title} value={`${fmt(num)}${unit}`} {...common}>
      <SoftwareOnly locked={locked} reason={reason}>
        {as === 'vu' ? (
          <VuSlider min={min} max={max} step={step} value={num} onChange={(v) => set?.(v)} variant={b.vu ?? 'default'} aria-label={title} />
        ) : (
          <Slider min={min} max={max} step={step} value={num} onChange={(v) => set?.(v)} aria-label={title} />
        )}
      </SoftwareOnly>
    </LiveControlFrame>
  );
}

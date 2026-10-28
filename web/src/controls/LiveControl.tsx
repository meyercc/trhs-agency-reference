import { Chip, FanCurve, Slider, SoftwareOnly, Toggle, ToggleButtonGroup } from '../components';
import { useSettings } from '../state/Settings';
import type { ResolvedSku } from '../devices/skus';
import { MODES_LOCKING_GLOW, useBrightnessLevel, useResolvedMode } from '../devices/monitor/monitorMode';
import { useDeviceProfileBar, useProfileValue } from '../devices/ProfileBar';
import { EQ_PRESETS } from '../devices/eqData';
import { dpiConfigOf } from '../devices/DeviceCanvas';
import { modesOf } from '../widgets/DisplayWidgets';
import { POWER_MODE_OPTIONS } from '../widgets/PowerModeWidget';
import { fanSpeedAt } from '../state/fanCurve';
import type { OverlayControl } from '../state/overlays';
import { Absent, LiveControlFrame, usePrimary } from './frame';

export { Absent, LiveControlFrame, usePrimary } from './frame';

/**
 * The live, bound controls (TH-437) — carried by a Nova reply, and by an
 * overlay on screen (TH-438). Each one is the SAME component bound to the SAME
 * state as its home elsewhere in the app — brightness through
 * `useBrightnessLevel` like the monitor window and the home card, EQ and DPI
 * through the device's profile bar like the device windows, the fan curve and
 * power mode through Settings like the Performance page. Nothing here keeps a
 * value of its own; the bubble is one more view.
 *
 * Since TH-452 only the controls with a BESPOKE shape live here — a curve, a
 * chip rail over a slider, a switch over a slider, the mode group. Every other
 * legacy control id is an ordinary registry row and renders through the generic
 * `BoundItem`, which is where the `AUDIO` table that used to sit here went: its
 * seven rows are seven rows of `state/bindings.ts` now.
 */
export type LiveControlKind = 'fan-curve' | 'eq-preset' | 'dpi' | 'lights' | 'power-mode' | 'brightness';
const BESPOKE: ReadonlySet<string> = new Set<LiveControlKind>(['fan-curve', 'eq-preset', 'dpi', 'lights', 'power-mode', 'brightness']);

/**
 * Does this legacy control id have a bespoke renderer here? The others are
 * registry rows and render through `BoundItem` — routed by the CALLER
 * (`OverlayItems`, `ChatLog`), not from inside this file: importing `BoundItem`
 * here closed a cycle (catalog → Light Studio widget → this file → BoundItem →
 * CardBlocks → the Nova store → specs → layout → catalog) that surfaced as
 * `Cannot access 'MAX_ITEMS' before initialization` at module evaluation —
 * invisible to the type checker, fatal on the board.
 */
export function isBespokeControl(kind: OverlayControl): kind is LiveControlKind {
  return BESPOKE.has(kind);
}

export function LiveControl({ kind }: { kind: LiveControlKind }) {
  switch (kind) {
    case 'fan-curve':
      return <FanCurveControl />;
    case 'eq-preset':
      return <EqPresetControl />;
    case 'dpi':
      return <DpiControl />;
    case 'lights':
      return <LightsControl />;
    case 'power-mode':
      return <PowerModeControl />;
    case 'brightness':
      return <BrightnessControl />;
  }
}

function BrightnessControl() {
  const sku = usePrimary('monitor');
  return sku ? <BrightnessFor sku={sku} /> : <Absent what="Display" />;
}
function BrightnessFor({ sku }: { sku: ResolvedSku }) {
  const { level, setLevel, synced } = useBrightnessLevel(modesOf(sku.id), sku.id);
  return (
    <LiveControlFrame title={`${sku.name} brightness${synced ? ' · all displays' : ''}`} value={`${level}%`} data-control="brightness" data-bind="brightness">
      <Slider value={level} onChange={setLevel} aria-label={`Brightness for the ${sku.name}`} />
    </LiveControlFrame>
  );
}

function FanCurveControl() {
  const { fanCurve, setFanCurve } = useSettings();
  const live = 43;
  return (
    <LiveControlFrame title="Fan curve" value={`${fanSpeedAt(fanCurve, live)}% at ${live}°C`} data-control="fan-curve" data-bind="fan-curve">
      <FanCurve points={fanCurve} onChange={setFanCurve} liveTemp={live} aria-label="Fan curve" />
    </LiveControlFrame>
  );
}

function EqPresetControl() {
  const sku = usePrimary('headset');
  return sku ? <EqPresetFor sku={sku} /> : <Absent what="Headset" />;
}
function EqPresetFor({ sku }: { sku: ResolvedSku }) {
  const profile = useDeviceProfileBar(sku);
  const audio = (sku.features as Record<string, any>).audio ?? {};
  const presets: string[] = Array.isArray(audio.equalizer?.presets) ? audio.equalizer.presets : [];
  const { eqPresets: custom } = useSettings();
  const [eqPreset, setEqPreset] = useProfileValue(profile, 'audio.eqPreset', presets[0] ?? '');
  const current = EQ_PRESETS[eqPreset]?.label ?? custom.find((p) => p.id === eqPreset)?.label ?? eqPreset;
  return (
    <LiveControlFrame title={`${sku.name} equalizer`} value={current} data-control="eq-preset" data-bind="eq-preset">
      <SoftwareOnly locked={profile.locked} reason="the headset is running an onboard slot — change it in its window">
        <div className="ds-live-control-chips" role="radiogroup" aria-label="Equalizer preset">
          {presets.map((id) =>
            EQ_PRESETS[id] ? (
              <Chip key={id} role="radio" aria-checked={eqPreset === id} selected={eqPreset === id} onClick={() => setEqPreset(id)}>
                {EQ_PRESETS[id].label}
              </Chip>
            ) : null,
          )}
          {custom.map((p) => (
            <Chip key={p.id} role="radio" aria-checked={eqPreset === p.id} selected={eqPreset === p.id} onClick={() => setEqPreset(p.id)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </SoftwareOnly>
    </LiveControlFrame>
  );
}

function DpiControl() {
  const sku = usePrimary('mouse');
  return sku ? <DpiFor sku={sku} /> : <Absent what="Mouse" />;
}
function DpiFor({ sku }: { sku: ResolvedSku }) {
  const profile = useDeviceProfileBar(sku);
  const { min, max, step, presets } = dpiConfigOf(sku.features as Record<string, any>);
  const [dpi, setDpi] = useProfileValue(profile, 'sensor.dpi', presets[0] ?? min);
  return (
    <LiveControlFrame title={`${sku.name} DPI`} value={`${dpi.toLocaleString()} DPI`} data-control="dpi" data-bind="dpi">
      <SoftwareOnly locked={profile.locked} reason="the mouse is running an onboard slot — change it in its window">
        <div className="ds-live-control-chips" role="radiogroup" aria-label="DPI preset">
          {presets.map((p) => (
            <Chip key={p} role="radio" aria-checked={dpi === p} selected={dpi === p} onClick={() => setDpi(p)}>
              {p.toLocaleString()}
            </Chip>
          ))}
        </div>
        <Slider min={min} max={max} step={step} value={dpi} onChange={setDpi} aria-label="DPI" />
      </SoftwareOnly>
    </LiveControlFrame>
  );
}

function PowerModeControl() {
  const { powerMode, setPowerMode } = useSettings();
  const label = POWER_MODE_OPTIONS.find((o) => o.value === powerMode)?.label ?? powerMode;
  return (
    <LiveControlFrame title="Power mode" value={label} data-control="power-mode" data-bind="power-mode">
      <ToggleButtonGroup aria-label="Power mode" value={powerMode} onChange={setPowerMode} options={POWER_MODE_OPTIONS} fullWidth />
    </LiveControlFrame>
  );
}

// ── Lights (TH-450) ──────────────────────────────────────────────────────────

/**
 * The desk's under-glow: on/off and the strip's brightness, bound to
 * `Settings.underGlow` — the same value the monitor window's Lights tab edits
 * and the hero desk map draws. The level is filed under the display mode in
 * view, as the Lights tab files it, and a mode that pins the light (Create)
 * locks the slider here too: a card must not be a back door around the lock
 * the Lighting widget's own notes warned about (2026-08-26).
 */
function LightsControl() {
  const sku = usePrimary('monitor');
  const { underGlow } = useSettings();
  return (
    <LiveControlFrame title={`${sku?.name ?? 'Desk'} lights`} value={underGlow.enabled ? `${underGlow.brightness}%` : 'Off'} data-control="lights" data-bind="lights">
      <LightsBody skuId={sku?.id} />
    </LiveControlFrame>
  );
}

/**
 * The lights control without its frame — what the Light Studio catalog widget
 * puts under its own header, so the card and the widget are one binding.
 */
export function LightsBody({ skuId }: { skuId?: string }) {
  const { underGlow, setUnderGlow } = useSettings();
  const mode = useResolvedMode(skuId ? modesOf(skuId) : undefined);
  const locked = MODES_LOCKING_GLOW.includes(mode);
  return (
    <>
      <div className="ds-live-control-row">
        <span className="ds-text-label">Lights</span>
        <Toggle checked={underGlow.enabled} onChange={(on) => setUnderGlow({ ...underGlow, enabled: on })} aria-label="Lights" />
      </div>
      <SoftwareOnly locked={locked} reason={`${mode} holds the light at neutral white and low — switch mode in the monitor window`}>
        <Slider
          min={0}
          max={100}
          value={underGlow.brightness}
          disabled={!underGlow.enabled}
          onChange={(v) =>
            setUnderGlow({
              ...underGlow,
              brightness: v,
              // Filed under the mode only when one is chosen: before that the
              // key would be '' and the level would be handed to whichever mode
              // reads that key next (the Lights tab's own measured failure).
              ...(mode ? { byModeLevel: { ...(underGlow.byModeLevel ?? {}), [mode]: v } } : {}),
            })
          }
          aria-label="Light brightness"
        />
      </SoftwareOnly>
    </>
  );
}

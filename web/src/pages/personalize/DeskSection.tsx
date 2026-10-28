import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeviceCard, deviceCardModel, type CardScope, type DeviceCardControl, type DeviceCardModel, type DeviceCardPart, type DeviceStatusPart } from '../../widgets/DeviceCard';
import { Dropdown, Swatch, Toggle } from '../../components';
import { DESK_PRESETS, presetPatch } from '../../lightstudio/presets';
import { useBrightnessLevel, usePicture } from '../../devices/monitor/monitorMode';
import { QuickChoices, QuickLevel } from './tiles';
import { BUTTONS_LABEL, type ButtonLayout, type EqPreset } from './model';
import { MIC_PRESET_LABEL } from '../../devices/audioLabels';
import { useSettings } from '../../state/Settings';
import type { DeviceId } from '../../lightstudio/scene';
import { DESK_DEVICES, DESK_SKU, EQ_LABEL } from './model';
import { deskDeviceIds } from '../../devices/connectedDevices';
import { getResolvedSku } from '../../devices/skus';
import { macroKeyCount, partsOf } from '../../devices/pcDirectory';
import { SCREEN_CONTENT_LABEL, useCoolerCap } from '../../devices/pcParts';
import { CapMiniScreen } from '../../devices/CoolerCapCanvas';
import { useDeviceSim } from '../../state/DeviceSim';
import { usePersonalize } from './state';
import { DEFAULT_LAYOUT, DEVICE_WIDGET_SKU, META_BY_ID } from '../../widgets/catalog';

// ── Devices — the things on the desk, in words ──────────────────────────────
// The 3D desk up in Lighting and these cards are the same set of things: the
// desk is the picture you pick from, these are the same devices written out.
// Picking one on the desk marks its card here; the card opens its settings.
//
// From the interviews (Sept 2026), all of it Sara unless noted:
//   · "It would be easier for me to see the fan as a visual — where it is" and,
//     remembering an older app, "you can see how you set it up… move it around,
//     how I configured it in real life". So the desk is the picker.
//   · "Bluetooth is the bane of my existence… sometimes it drops… I'm mute, I
//     hate that — that is the thing I change most often." So a card says what
//     its device is doing right now, and says it loudly when it is muted.
// Battery is deliberately NOT the headline: nobody in the study mentioned it
// once, and battery/connection belong to Devices (the Personalize ≠ Perform
// boundary, TH-350).

/** The SKU that stands for each thing on the 3D desk. One card per device the
 *  desk shows — the roster can't drift from the picture. */
// Lives in model.ts now (state.tsx needs it too, and this file imports state).
export { DESK_SKU };

/** What kind of device a SKU on this desk is, for its status line. The 3D
 *  desk's own SKUs, plus the main display, which the desk picture does not model. */
const KIND_OF_SKU: Record<string, DeviceId> = {
  ...Object.fromEntries(DESK_DEVICES.map((id) => [DESK_SKU[id], id])),
  'treehouse-32': 'monitor',
};

export function DeskDevices() {
  // The same devices the Home board and the Devices panel list (Chris,
  // 2026-10-09: Personalize kept its own fixed six, so a device Admin took off
  // the desk, or one unplugged in the simulator, stayed here, and the main
  // display was missing). The computer leads when Admin has it on this desk
  // (it is never unplugged). Battery comes from the simulator, as on Home.
  const { deskDevices, thisPc, mvpScope } = useSettings();
  const { simState } = useDeviceSim();
  // A laptop's keyboard is a keyboard on this desk too: its lights and its
  // macro keys are set from its own card, which opens the PC's page.
  const laptop = getResolvedSku(thisPc)?.type === 'notebook' ? thisPc : null;
  const list = useMemo(
    () =>
      [
        ...(deskDevices.includes('tower') ? [DESK_SKU.tower] : []),
        ...deskDeviceIds(deskDevices).filter((sku) => simState(sku).connected),
      ]
        .filter((sku) => !!KIND_OF_SKU[sku] && !!deviceCardModel(sku)),
    [deskDevices, simState],
  );

  // Devices and Quick Controls are one section now (Kristy, 2026-10-12,
  // Option A): each card carries its device's most-used settings, and its ⋮
  // picks which (Cindy's card chooser). No status line on either surface
  // (Kristy, 2026-10-14): the controls on the card already show the state.
  return (
    <div className="pg-grid pg-devices">
      {laptop && <BuiltInKeyboardCard skuId={laptop} />}
      {list.map((sku) => (
        <DeskDeviceCard key={sku} skuId={sku} />
      ))}
    </div>
  );
}

/** Whether a SKU is one of this desk's devices, with a card of controls. */
export const isDeskDevice = (skuId: string) => !!KIND_OF_SKU[skuId];

/** Open a device's own window, optionally at one of its tabs. */
function useOpenDevice() {
  const [params, setParams] = useSearchParams();
  return (skuId: string, tab?: string) => {
    const next = new URLSearchParams(params);
    next.set('sku', skuId);
    if (tab) next.set('tab', tab);
    else next.delete('tab');
    setParams(next);
  };
}

/**
 * The laptop's built-in keyboard as a card of its own. It opens the PC page,
 * at the tab the card's shortcut names.
 */
function BuiltInKeyboardCard({ skuId }: { skuId: string }) {
  const open = useOpenDevice();
  const base = deviceCardModel(skuId);
  if (!base) return null;
  // The shortcuts are tabs the PC's page has: Lighting, and Macro where the
  // notebook has dedicated macro keys (keys-macros.7). 'keys' is not one.
  const pc = getResolvedSku(skuId);
  const macroKeys = pc ? macroKeyCount(pc) : 0;
  const model: DeviceCardModel = {
    ...base,
    name: 'Built-in keyboard',
    subtitle: base.name,
    shortcuts: [
      { tab: 'lighting', label: 'Lights', icon: 'lights' },
      ...(macroKeys ? [{ tab: 'macros', label: 'Macro', icon: 'keys' as const }] : []),
    ],
  };
  return (
    <DeviceCard
      model={model}
      onOpen={() => open(skuId, 'lighting')}
      onShortcut={(tab) => open(skuId, tab)}
    />
  );
}

/**
 * "Show on Home" (Kristy, 2026-10-12): Personalize is where devices live; this
 * puts a device's card on the Home board, or takes it off. It is the board's
 * own layout either way, so "Add a widget" on Home and this switch never
 * disagree. Undefined for a device the board has no card for (the tower).
 */
export function useOnHome(skuId: string) {
  const { boardLayout, setBoardLayout } = useSettings();
  const widgetId = Object.keys(DEVICE_WIDGET_SKU).find((k) => DEVICE_WIDGET_SKU[k] === skuId);
  if (!widgetId || !META_BY_ID[widgetId]) return undefined;
  const layout = boardLayout ?? DEFAULT_LAYOUT;
  return {
    on: layout.some((i) => i.id === widgetId),
    onChange: (on: boolean) => {
      const meta = META_BY_ID[widgetId];
      setBoardLayout(
        on
          ? layout.some((i) => i.id === widgetId)
            ? layout
            : [...layout, { id: widgetId, span: meta.span, rows: meta.rows }]
          : layout.filter((i) => i.id !== widgetId),
      );
    },
  };
}

/**
 * One device's card with its controls — the same card on Personalize and on
 * the Home board, so what a person picks with its ⋮ shows on both. `inCell`
 * when a board cell sets its size; `routedAway` from the board's KVM rule.
 */
export function DeskDeviceCard({
  skuId,
  scope = 'personalize',
  routedAway,
}: {
  skuId: string;
  /** Home draws the same controls in the board card's own shape — no content
      sizing, its own saved choices (Chris, 2026-10-13). */
  scope?: CardScope;
  routedAway?: string;
}) {
  const { batteryOf } = useDeviceSim();
  const { thisPc, mvpScope } = useSettings();
  const [capState] = useCoolerCap();
  const open = useOpenDevice();
  const homeSwitch = useOnHome(skuId);
  const base = deviceCardModel(skuId);
  const id = KIND_OF_SKU[skuId];
  if (!base || !id) return null;
  const model = { ...base, batteryPct: batteryOf(skuId) };
  const onHome = scope === 'home';
  // The desktop's cooler cap belongs to the PC: a line on the PC's card, a way
  // into its tab of the PC's page, rather than a card of its own (lcd-diy.25;
  // JY, 2026-10-22). `partsOf` leaves it out under June 2027.
  const hasCap =
    id === 'tower' && !onHome && getResolvedSku(thisPc)?.type === 'desktop' && partsOf(thisPc, mvpScope).some((p) => p.type === 'desktop-cooler-cap');
  const parts: DeviceCardPart[] | undefined = hasCap
    ? [
        {
          key: 'cooler-cap',
          label: 'Cooler cap',
          reading: capState.on ? SCREEN_CONTENT_LABEL[capState.content] : 'Off',
          visual: <CapMiniScreen state={capState} defaultArt={String(getResolvedSku(thisPc)?.features.defaultArt ?? 'omen')} />,
          onOpen: () => open(skuId, 'cooler-cap'),
        },
      ]
    : undefined;
  const card: CardProps = {
    model,
    // The tower is This PC: its card is a lighting card, so it opens the PC's
    // page at Chassis lighting, whatever shortcut was pressed (it used to open
    // the lights alone, which went with option A, JY 2026-10-22).
    onOpen: () => open(skuId, id === 'tower' ? 'lighting' : undefined),
    onShortcut: (tab: string) => open(skuId, id === 'tower' ? 'lighting' : tab),
    // «Show on Home» belongs where the card is not already on Home.
    homeSwitch: onHome ? undefined : homeSwitch,
    routedAway,
    scope,
    parts,
  };
  return id === 'monitor' && model.rich ? <MonitorCard {...card} /> : <PeripheralCard id={id} {...card} />;
}

type CardProps = {
  model: DeviceCardModel;
  status?: string | DeviceStatusPart[];
  statusTone?: 'attention';
  onOpen: () => void;
  onShortcut: (tab: string) => void;
  homeSwitch?: { on: boolean; onChange: (on: boolean) => void };
  parts?: DeviceCardPart[];
  routedAway?: string;
  scope?: CardScope;
  className?: string;
};

/** The presets a device's light offers on its card: a few looks and Off. */
const CARD_PRESETS = ['Wave', 'HyperX Red', 'Touch Grass', 'Blue Skye', 'Off']
  .map((name) => DESK_PRESETS.find((p) => p.name === name))
  .filter((p): p is (typeof DESK_PRESETS)[number] => !!p);

/** A device's light, picked from swatches; its name is the swatch's label. */
function LightSwatches({ id }: { id: DeviceId }) {
  const p = usePersonalize();
  const current = p.desk.lighting[id]?.preset;
  return (
    <div className="pg-card-swatches" role="radiogroup" aria-label="Lighting preset">
      {CARD_PRESETS.map((pr) => (
        <Swatch
          key={pr.id}
          role="radio"
          aria-checked={current === pr.id}
          selected={current === pr.id}
          color={pr.swatch.includes('gradient') ? undefined : pr.swatch}
          style={pr.swatch.includes('gradient') ? ({ background: pr.swatch } as React.CSSProperties) : undefined}
          label={pr.name}
          title={pr.name}
          onClick={() => p.setLighting([id], presetPatch(pr))}
        />
      ))}
    </div>
  );
}

/** Headset, mic, mouse, keyboard and the computer: the desk's own settings. */
function PeripheralCard({ id, ...card }: CardProps & { id: DeviceId }) {
  const p = usePersonalize();
  const lightLevel = (
    <QuickLevel
      label="Light brightness"
      value={p.desk.lighting[id]?.brightness ?? 100}
      onChange={(v) => p.setLighting([id], { brightness: v })}
    />
  );
  let controls: DeviceCardControl[] = [];
  let defaults: string[] = [];
  switch (id) {
    case 'headset':
      controls = [
        { key: 'volume', label: 'Volume', node: <QuickLevel label="Volume" value={p.desk.volume} onChange={(v) => p.update({ volume: v })} /> },
        {
          key: 'eq',
          label: 'EQ',
          node: (
            <QuickChoices<EqPreset>
              label="EQ preset"
              options={['fps', 'music', 'movie', 'voice', 'flat']}
              value={p.desk.eq}
              format={(v) => EQ_LABEL[v]}
              onPick={(v) => p.update({ eq: v }, 'eq')}
            />
          ),
        },
        {
          key: 'spatial',
          label: 'Spatial audio',
          node: <Toggle checked={p.desk.spatial} onChange={(v) => p.update({ spatial: v }, 'spatial')} aria-label="Spatial audio" />,
        },
        { key: 'sidetone', label: 'Sidetone', node: <QuickLevel label="Sidetone" value={p.desk.sidetone} onChange={(v) => p.update({ sidetone: v })} /> },
      ];
      defaults = ['volume'];
      break;
    case 'mic':
      controls = [
        { key: 'on', label: 'Microphone', node: <Toggle checked={p.desk.micOn} onChange={(v) => p.update({ micOn: v })} aria-label="Microphone on" /> },
        {
          key: 'preset',
          label: 'Preset',
          node: (
            <QuickChoices<typeof p.desk.micPreset>
              label="Mic preset"
              options={['gaming', 'streaming', 'podcast', 'conference']}
              value={p.desk.micPreset}
              format={(v) => MIC_PRESET_LABEL[v]}
              onPick={(v) => p.update({ micPreset: v }, 'mic')}
            />
          ),
        },
        {
          key: 'noise',
          label: 'Noise reduction',
          node: <Toggle checked={p.desk.micNoise} onChange={(v) => p.update({ micNoise: v })} aria-label="Noise reduction" />,
        },
        { key: 'light', label: 'Lighting', node: <LightSwatches id={id} /> },
      ];
      defaults = ['on'];
      break;
    case 'mouse':
      controls = [
        {
          key: 'dpi',
          label: 'DPI',
          node: (
            <QuickChoices<string> label="DPI preset" options={['800', '1600', '3200']} value={p.desk.dpi} format={(v) => v} onPick={(v) => p.update({ dpi: v })} />
          ),
        },
        {
          key: 'buttons',
          label: 'Buttons',
          node: (
            <QuickChoices<ButtonLayout>
              label="Button layout"
              options={['default', 'valorant', 'productivity']}
              value={p.desk.buttons}
              format={(v) => BUTTONS_LABEL[v]}
              onPick={(v) => p.update({ buttons: v })}
            />
          ),
        },
        { key: 'light', label: 'Lighting', node: <LightSwatches id={id} /> },
      ];
      defaults = ['dpi'];
      break;
    default:
      // The keyboard and the computer: their light.
      controls = [
        { key: 'light', label: 'Lighting', node: <LightSwatches id={id} /> },
        { key: 'level', label: 'Light brightness', node: lightLevel },
      ];
      defaults = ['light'];
  }
  return <DeviceCard {...card} controls={controls} defaultControls={defaults} />;
}

/** A display: Cindy's set — Color, Input, Brightness, Contrast, Sharpness —
 *  read and written through the monitor window's own hooks, as the rich face is. */
function MonitorCard(card: CardProps) {
  const rich = card.model.rich!;
  const { level, setLevel } = useBrightnessLevel(rich.modes, card.model.skuId);
  const { picture, setValue } = usePicture(rich.modes, card.model.skuId);
  const color = picture.colorPreset || rich.presets[0] || 'Native';
  const controls: DeviceCardControl[] = [
    {
      key: 'color',
      label: 'Color',
      node: (
        <Dropdown
          aria-label="Color preset"
          options={rich.presets.map((v) => ({ label: v, value: v }))}
          value={color}
          onChange={(v) => setValue('colorPreset', v)}
        />
      ),
    },
    { key: 'input', label: 'Input', node: <span className="pg-card-readout">{rich.conn}</span> },
    { key: 'brightness', label: 'Brightness', node: <QuickLevel label="Brightness" value={level} onChange={setLevel} /> },
    { key: 'contrast', label: 'Contrast', node: <QuickLevel label="Contrast" value={picture.contrast} onChange={(v) => setValue('contrast', v)} /> },
    { key: 'sharpness', label: 'Sharpness', node: <QuickLevel label="Sharpness" value={picture.sharpness} onChange={(v) => setValue('sharpness', v)} /> },
  ];
  return (
    <DeviceCard
      {...card}
      controls={controls}
      defaultControls={['brightness']}
    />
  );
}

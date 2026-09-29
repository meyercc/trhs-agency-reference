import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeviceCard, deviceCardModel, type DeviceCardModel } from '../../widgets/DeviceCard';
import { MIC_PRESET_LABEL } from '../../devices/audioLabels';
import { presetName } from '../../lightstudio/presets';
import type { DeviceId } from '../../lightstudio/scene';
import { DESK_DEVICES, EQ_LABEL } from './model';
import { usePersonalize } from './state';

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
export const DESK_SKU: Record<DeviceId, string> = {
  tower: 'forge-45l',
  monitor: 'pulse-27',
  keyboard: 'origins-65',
  mouse: 'saga-pro',
  headset: 'cloud-iii',
  mic: 'solocast-2-pro',
};

export function DeskDevices() {
  const p = usePersonalize();
  const [params, setParams] = useSearchParams();
  const list = useMemo(
    () =>
      DESK_DEVICES.map((id) => ({ id, model: deviceCardModel(DESK_SKU[id]) })).filter(
        (c): c is { id: DeviceId; model: DeviceCardModel } => !!c.model,
      ),
    [],
  );

  const open = (skuId: string, tab?: string) => {
    const next = new URLSearchParams(params);
    next.set('sku', skuId);
    if (tab) next.set('tab', tab);
    else next.delete('tab');
    setParams(next);
  };

  /** What this device is doing right now — the line people came to check. Its
   *  own light comes last on every card, so a change made on the desk shows up
   *  on each card it touched, not only where lighting is the headline. */
  const statusOf = (id: DeviceId): { text: string; attention?: boolean } => {
    const lit = p.desk.lighting[id];
    const light = lit ? `${presetName(lit.preset) ?? 'Custom light'} · ${lit.brightness}%` : 'No lighting';
    switch (id) {
      case 'mic':
        return p.desk.micOn
          ? { text: `${MIC_PRESET_LABEL[p.desk.micPreset]}${p.desk.micNoise ? ' · noise reduction' : ''} · ${light}` }
          : { text: 'Muted — people can’t hear you', attention: true };
      case 'headset':
        return { text: `${EQ_LABEL[p.desk.eq]} EQ · ${p.desk.spatial ? 'Hear360' : 'Spatial off'} · ${light}` };
      case 'mouse':
        return { text: `${p.desk.dpi} DPI · ${light}` };
      default:
        return { text: light };
    }
  };

  return (
    <div className="pg-grid pg-devices">
      {list.map(({ id, model }) => {
        const st = statusOf(id);
        return (
          <DeviceCard
            key={id}
            model={model}
            status={st.text}
            statusTone={st.attention ? 'attention' : undefined}
            onOpen={() => open(model.skuId)}
            onShortcut={(tab) => open(model.skuId, tab)}
          />
        );
      })}
    </div>
  );
}

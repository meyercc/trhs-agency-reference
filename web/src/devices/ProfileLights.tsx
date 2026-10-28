// The Lights tab for a device with one lighting zone (a mouse, a tower): the
// shared preset library and brightness rail (`LightingTab`), plus the power
// switch for the panel header. Same profile keys as the keyboard and the mic —
// `lighting.preset`, `lighting.brightness`, `lighting.power` — so Personalize's
// desk reads and writes every lit device the same way (2026-10-01).
//
// A one-zone device has no keys or ring lights to paint: picking a preset IS
// its color, so the tab's per-key callbacks have nothing to do here.
import { Toggle } from '../components';
import { useSettings } from '../state/Settings';
import { LightingTab } from './LightingTab';
import { useProfileValue, type ProfileBarState } from './ProfileBar';

/** The power switch, for the panel's header beside the "Lights" title. */
export function ProfileLightsPower({ profile }: { profile: ProfileBarState }) {
  const [on, setOn] = useProfileValue(profile, 'lighting.power', true);
  return <Toggle checked={on} onChange={setOn} aria-label="Lighting power" />;
}

export function ProfileLightsTab({ profile }: { profile: ProfileBarState }) {
  const { lightPresets } = useSettings();
  const [preset, setPreset] = useProfileValue<string>(profile, 'lighting.preset', lightPresets[0]?.id ?? '');
  const [brightness, setBrightness] = useProfileValue<number>(profile, 'lighting.brightness', 100);
  return (
    <LightingTab
      preset={preset}
      onPreset={setPreset}
      brightness={brightness}
      onBrightness={setBrightness}
      onApplyAll={() => {}}
      onPaintSelected={() => {}}
    />
  );
}

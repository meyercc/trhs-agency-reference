import { useState } from 'react';
import './device-canvas.css';
import './headset-canvas.css';
import { EQ_PRESETS, EqCurve } from './eqData';
import { presetCurve } from './eqParametric';
import { SimpleEqModal } from './SimpleEqModal';
import { AdvancedEqModal } from './AdvancedEqModal';
import { ChooseEqModal, type EqKind } from './ChooseEqModal';
import { useSettings } from '../state/Settings';
import {
  Icon,
  Ng3Panel,
  Ng3Tool,
  Ng3Grid,
  Ng3Col,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  ListItem,
  Dropdown,
  Toggle,
  Checkbox,
  Slider,
  VuSlider,
  BalanceSlider,
  Button,
  ToggleButtonGroup,
  SoftwareOnly,
  type IconName,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from './skus';
import { deviceTabs } from './deviceTabs';
import { DeviceSettingsCard } from './DeviceSettingsCard';
import { ProfileBar, ProfileActions, ProfileScopeBody, useDeviceProfileBar, useProfileValue, type ProfileBarState } from './ProfileBar';
import { SurroundStage } from './SurroundStage';
import { MIC_EFFECT_LABEL, MIC_PRESET_LABEL } from './audioLabels';

/**
 * Full-canvas headset modal — the NGENUITY "Audio" design (Audio file, node
 * 8931:20990) migrated onto the Ng3Panel canvas the mouse pioneered: status
 * chips top-left, the headset centered on the dark canvas, and a bottom
 * `Ng3Panel` with Audio · Spatial Audio · Settings tabs.
 *
 * Audio is the full Figma build (Volume / Microphone · Equalizer presets ·
 * Mic Presets + Effects); Spatial and Settings render the existing feature
 * data on the same panel language. Presentational (no persistence), matching
 * the other device canvases. Tabs and sections are feature-gated so sparse
 * SKUs (wired Cloud III, Cloud II line) degrade to only what they support.
 */

type Features = Record<string, any>;

function batteryIcon(level: number, charging: boolean): IconName {
  const step = Math.max(0, Math.min(100, Math.round(level / 10) * 10));
  return `${charging ? 'charging' : 'battery'}-${step}` as IconName;
}

// ── Equalizer presets ────────────────────────────────────────────────────────
// Preset id → display label + a tiny response-curve glyph (the Figma "EQ
// Thumbnail" variants), drawn as a polyline over a 40×14 box. Geometry only —
// color comes from the row state via currentColor.
// Mic effect ids → display labels (NGENUITY wording).
// ── Audio tab ────────────────────────────────────────────────────────────────
function AudioTab({ features, profile }: { features: Features; profile: ProfileBarState }) {
  const audio = features.audio || {};
  const mic = audio.mic && typeof audio.mic === 'object' ? audio.mic : null;
  const eqPresets: string[] = Array.isArray(audio.equalizer?.presets) ? audio.equalizer.presets : [];
  const micPresets: string[] = mic && Array.isArray(mic.presets) ? mic.presets : [];
  const micEffects: string[] = mic && Array.isArray(mic.effects) ? mic.effects : [];

  // Settings the device runs are scope-backed. Mute is NOT one of them — it is
  // live status, and a profile that silently muted you on activation would be a
  // bug rather than a feature.
  const [volume, setVolume] = useProfileValue(profile, 'audio.volume', 62);
  const [micVolume, setMicVolume] = useProfileValue(profile, 'audio.micVolume', 70);
  const [muted, setMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [monitoring, setMonitoring] = useProfileValue(profile, 'audio.micMonitoring', false);
  const [eqOn, setEqOn] = useProfileValue(profile, 'audio.equalizer', false);
  const [eqPreset, setEqPreset] = useProfileValue(profile, 'audio.eqPreset', eqPresets[0]);
  // User-made presets live in Settings; factory ones stay SKU data. The list
  // shows both, so a preset you drew sits beside the ones that shipped.
  const { eqPresets: customPresets } = useSettings();
  // "Add Equalizer Preset" asks Simple or Advanced first, then opens that editor.
  const [eqEditor, setEqEditor] = useState<'choose' | EqKind | null>(null);
  const [micPresetsOn, setMicPresetsOn] = useProfileValue(profile, 'audio.micPresetsOn', false);
  const [micPreset, setMicPreset] = useProfileValue(profile, 'audio.micPreset', micPresets[0] ?? '');
  const [micFxOn, setMicFxOn] = useProfileValue(profile, 'audio.micEffectsOn', false);
  // Per key, not one bag: the effect list is SKU-driven, so a hook per row would
  // break the rules of hooks — and one key each is what gives every effect its
  // own line in the profile's manifest.
  const fxOn = (id: string) => profile.value<boolean>(`audio.micEffect.${id}`, false);
  const setFxOn = (id: string, v: boolean) => profile.setValue(`audio.micEffect.${id}`, v);

  return (
    <Ng3Grid className="hc-audio">
      {/* Volume / Microphone */}
      <Ng3Col>
        {audio.volumeControl !== false && (
          <Ng3Section>
            <Ng3Label strong info>Volume</Ng3Label>
            <div className="dc-slider-row">
              <Slider min={0} max={100} value={volume} onChange={setVolume} aria-label="Volume" />
              <button
                type="button"
                className={'dc-mute' + (muted ? ' active' : '')}
                aria-label={muted ? 'Unmute' : 'Mute'}
                aria-pressed={muted}
                onClick={() => setMuted((m) => !m)}
              >
                <Icon name={muted ? 'audio-mute' : 'audio'} size={16} />
              </button>
            </div>
          </Ng3Section>
        )}
        {mic && mic.volumeControl !== false && (
          <Ng3Section>
            <Ng3Label strong info>Mic Volume</Ng3Label>
            <div className="dc-slider-row">
              <VuSlider value={micVolume} onChange={setMicVolume} variant={mic.vuMeter ? 'peak' : 'default'} aria-label="Mic volume" />
              <button
                type="button"
                className={'dc-mute' + (micMuted ? ' active' : '')}
                aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={micMuted}
                onClick={() => setMicMuted((m) => !m)}
              >
                <Icon name={micMuted ? 'mic-mute' : 'mic'} size={16} />
              </button>
            </div>
            {mic.monitoring && (
              <>
                <span className="dc-divider" />
                <Ng3Row>
                  <Ng3Label info>Mic Monitoring</Ng3Label>
                  <Toggle checked={monitoring} onChange={setMonitoring} aria-label="Mic monitoring" />
                </Ng3Row>
              </>
            )}
          </Ng3Section>
        )}
      </Ng3Col>

      {/* Audio Equalizer */}
      {eqPresets.length > 0 && (
        <SoftwareOnly reason="curve presets are applied by Treehouse, not the headset">
        <Ng3Section className="hc-eq">
          <Ng3Row>
            <Ng3Label strong info>Audio Equalizer</Ng3Label>
            <Toggle checked={eqOn} onChange={setEqOn} aria-label="Audio equalizer" />
          </Ng3Row>
          <div className="hc-eq-list">
            <ListItem
              label="Add Equalizer Preset"
              leading={<Icon name="add-small" size={16} />}
              onClick={() => setEqEditor('choose')}
            />
            {/* The presets never size the panel (Figma Audio 8931:20990: the
                Volume and Mic columns set its height, the list fills what is
                left and scrolls). .hc-eq-scroll has no height of its own —
                the radiogroup is absolutely positioned inside it — so adding a
                preset can only add a row to scroll to. "Add" stays put above. */}
            <div className="hc-eq-scroll">
            <div className="hc-eq-presets" role="radiogroup" aria-label="Equalizer preset">
            {eqPresets.map((id) => {
              const p = EQ_PRESETS[id];
              if (!p) return null;
              return (
                <ListItem
                  key={id}
                  role="radio"
                  aria-checked={eqPreset === id}
                  label={p.label}
                  leading={<EqCurve points={p.points} />}
                  selected={eqPreset === id}
                  onClick={() => setEqPreset(id)}
                />
              );
            })}
            {customPresets.map((p) => (
              <ListItem
                key={p.id}
                role="radio"
                aria-checked={eqPreset === p.id}
                label={p.label}
                leading={<EqCurve points={presetCurve(p)} />}
                selected={eqPreset === p.id}
                onClick={() => setEqPreset(p.id)}
              />
            ))}
            </div>
            </div>
          </div>
        </Ng3Section>
        </SoftwareOnly>
      )}
      {eqEditor === 'choose' && <ChooseEqModal onClose={() => setEqEditor(null)} onPick={setEqEditor} />}
      {eqEditor === 'simple' && <SimpleEqModal onClose={() => setEqEditor(null)} />}
      {eqEditor === 'advanced' && <AdvancedEqModal onClose={() => setEqEditor(null)} />}

      {/* Mic Presets / Mic Effects */}
      {(micPresets.length > 0 || micEffects.length > 0) && (
        <Ng3Col>
          {micPresets.length > 0 && (
            <Ng3Section>
              <Ng3Row>
                <Ng3Label strong info>Mic Presets</Ng3Label>
                <Toggle checked={micPresetsOn} onChange={setMicPresetsOn} aria-label="Mic presets" />
              </Ng3Row>
              <div>
                <Dropdown
                  aria-label="Mic preset"
                  value={micPreset}
                  onChange={setMicPreset}
                  options={micPresets.map((id) => ({ label: MIC_PRESET_LABEL[id] ?? id, value: id }))}
                />
              </div>
            </Ng3Section>
          )}
          {micEffects.length > 0 && (
            <Ng3Section>
              <Ng3Row>
                <Ng3Label strong info>Mic Effects</Ng3Label>
                <Toggle checked={micFxOn} onChange={setMicFxOn} aria-label="Mic effects" />
              </Ng3Row>
              <div className="hc-fx-list">
                {micEffects.map((id) => (
                  <Checkbox
                    key={id}
                    label={MIC_EFFECT_LABEL[id] ?? id}
                    checked={fxOn(id)}
                    onChange={(e) => setFxOn(id, e.target.checked)}
                  />
                ))}
              </div>
            </Ng3Section>
          )}
        </Ng3Col>
      )}
    </Ng3Grid>
  );
}

// ── Spatial Audio tab ────────────────────────────────────────────────────────
// Figma Audio 14725:221255 — the surround stage beside the model parameters.
// The master toggle lives in the panel HEADER (headerExtra, like the keyboard's
// Lights toggle). Toggled off, the tab stays fully operable — off stops the
// feature, not your editing — so the toggle itself is the off signal.
function SpatialTab({ features, profile }: { features: Features; profile: ProfileBarState }) {
  const s = features.spatial || {};
  const [experience, setExperience] = useProfileValue(profile, 'spatial.experience', 50);
  const [distance, setDistance] = useProfileValue(profile, 'spatial.distance', 50);
  const output: string = s.surroundFormat || '7.1';
  return (
    <SoftwareOnly reason="the surround mix is rendered on the PC">
    <Ng3Grid className="hc-audio hc-spatial">
      <Ng3Section className="hc-stage-section">
        <SurroundStage output={output} />
        {/* Auto input detection — what's coming in vs what the engine renders */}
        <div className="hc-io" aria-label={`Auto input detection: input 2.0, output ${output}`}>
          <span className="hc-io-cell">
            <span className="hc-io-key">Input</span>
            <span className="hc-io-val">2.0</span>
          </span>
          <span className="hc-io-rule" aria-hidden="true" />
          <span className="hc-io-cell">
            <span className="hc-io-key">Output</span>
            <span className="hc-io-val">{output}</span>
          </span>
        </div>
      </Ng3Section>

      <Ng3Section className="hc-params">
        {s.experienceSlider && (
          <Ng3Field>
            <Ng3Label strong info>Experience</Ng3Label>
            {/* Center-anchored: the mix pulls toward raw performance or full
                immersion from a balanced middle — that's BalanceSlider's shape. */}
            <BalanceSlider min={0} max={100} value={experience} onChange={setExperience} aria-label="Experience" />
            <div className="hc-scale" aria-hidden="true">
              <span>Performance</span>
              <span>Balanced</span>
              <span>Immersion</span>
            </div>
          </Ng3Field>
        )}
        {s.distanceSlider && (
          <Ng3Field>
            <Ng3Label strong info>Distance</Ng3Label>
            <Slider min={0} max={100} value={distance} onChange={setDistance} aria-label="Distance" />
            <div className="hc-scale" aria-hidden="true">
              <span>Near</span>
              <span>Balanced</span>
              <span>Far</span>
            </div>
          </Ng3Field>
        )}
        {s.advancedSettings && (
          <Button className="hc-advanced">
            <Icon name="eq" size={16} />
            Advanced Settings
          </Button>
        )}
      </Ng3Section>
    </Ng3Grid>
    </SoftwareOnly>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
const POWER_OFF_LABEL: Record<string, string> = {
  '5min': '5 minutes',
  '10min': '10 minutes',
  '20min': '20 minutes',
  '30min': '30 minutes',
  never: 'Never',
};
const NOTIFY_LABEL: Record<string, string> = { voice: 'Voice', tone: 'Tone', none: 'None' };

/**
 * Settings tab — Figma "Cloud III S Control Panel" (Device Settings
 * 10461:54650). A fixed-width device rail beside a flexible notifications
 * panel: identity, firmware and the two support actions on the left over Auto
 * Power-Off; the notification mode, what it does, and the OS hand-off on the
 * right.
 *
 * Every row is SKU data — firmware, the support pair, the power-off steps, the
 * notification modes and the audio credit all come from the resolved features,
 * so a sparse headset simply shows fewer rows rather than empty chrome.
 */
function SettingsTab({ sku, features, profile }: { sku: ResolvedSku; features: Features; profile: ProfileBarState }) {
  const autoOff: string[] = Array.isArray(features.power?.autoPowerOff) ? features.power.autoPowerOff : [];
  const notify: string[] = Array.isArray(features.notifications?.modes) ? features.notifications.modes : [];
  const support = (features.support && typeof features.support === 'object' ? features.support : {}) as Record<string, unknown>;
  const firmware = typeof features.firmware === 'string' ? features.firmware : null;
  const audioCredit = typeof features.spatial?.audioCredit === 'string' ? features.spatial.audioCredit : null;
  const [mode, setMode] = useProfileValue(profile, 'settings.notifications', notify[0] ?? 'voice');
  const [autoPowerOff, setAutoPowerOff] = useProfileValue(
    profile,
    'settings.autoPowerOff',
    autoOff.includes('20min') ? '20min' : (autoOff[0] ?? ''),
  );

  const hasDevice = firmware || support.deviceManager !== false || support.getSupport !== false;
  if (!hasDevice && autoOff.length === 0 && notify.length === 0) {
    return <div className="dc-placeholder">No device settings available.</div>;
  }

  return (
    <Ng3Grid className="hc-settings">
      <Ng3Col className="hc-set-rail">
        {hasDevice && (
          <DeviceSettingsCard
            name={sku.name}
            firmware={firmware}
            deviceManager={support.deviceManager !== false}
            getSupport={support.getSupport !== false}
            audioCredit={audioCredit}
          />
        )}
        {autoOff.length > 0 && (
          <Ng3Section>
            <Ng3Field>
              <Ng3Label strong info>Auto Power-Off</Ng3Label>
              <Dropdown
                aria-label="Auto power-off"
                value={autoPowerOff}
                onChange={setAutoPowerOff}
                options={autoOff.map((v) => ({ label: POWER_OFF_LABEL[v] ?? v, value: v }))}
              />
            </Ng3Field>
          </Ng3Section>
        )}
      </Ng3Col>

      {notify.length > 0 && (
        <Ng3Section className="hc-notify">
          <Ng3Label strong>Notifications</Ng3Label>
          <div className="hc-notify-body">
            <ToggleButtonGroup
              fullWidth
              aria-label="Notifications"
              value={mode}
              onChange={setMode}
              options={notify.map((v) => ({ label: NOTIFY_LABEL[v] ?? v, value: v }))}
            />
            <p className="hc-set-copy">
              Like the idea of audio notifications but need a bit more info than beeps can
              provide? Say less! Our voice prompts will notify you of any status changes to
              your headset.
            </p>
          </div>
          {/* The OS owns output routing, so this hands off rather than pretending
              to set it here. Sits on the panel floor, away from the controls. */}
          <Button className="hc-set-handoff">
            <Icon name="audio-headset" size={16} />
            Windows Sound Devices
          </Button>
        </Ng3Section>
      )}
    </Ng3Grid>
  );
}

export function HeadsetCanvas({
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
  const tabs = deviceTabs(sku);

  const [tabId, setTabId] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id,
  );
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];

  // Spatial audio master power — panel-header toggle (like the keyboard's
  // Lights), so the whole tab body reads as one switched surface.
  const [spatialOn, setSpatialOn] = useProfileValue(profile, 'spatial.power', true);

  const heroSrc = deviceImageUrl(heroImageFile(sku));
  const conn = connectionStatus(f);

  return (
    <div className="dc-canvas" role="dialog" aria-label={sku.name}>
      {/* Status chips */}
      <div className="dc-status">
        {conn.batteryLevel != null && (
          <div className="dc-chip">
            <Icon name={batteryIcon(conn.batteryLevel, conn.charging)} size={20} />
            <span className="dc-chip-val">{Math.round(conn.batteryLevel)}%</span>
          </div>
        )}
        <div className="dc-chip">
          <span className={'dc-chip-dot' + (profile.connected ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
          <span className="dc-chip-val">
            {!profile.connected ? 'Disconnected' : conn.wireless ? 'Wireless' : 'USB'}
          </span>
        </div>
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      {/* Hero */}
      <div className="dc-hero">{heroSrc && <img src={heroSrc} alt={sku.name} />}</div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap">
        <Ng3Panel
          leading={<ProfileBar state={profile} />}
          trailing={<ProfileActions state={profile} />}
          width={active.width}
          header={active.title}
          headerExtra={
            active.id === 'spatial' && f.spatial ? (
              <Toggle
                checked={spatialOn}
                onChange={setSpatialOn}
                aria-label="Spatial audio power"
                // While an onboard slot pins the panel, spatial audio is locked
                // off — the header toggle must not pretend otherwise.
                disabled={profile.locked}
              />
            ) : undefined
          }
          tools={tabs.map((t) => (
            <Ng3Tool
              key={t.id}
              icon={t.icon}
              title={t.title}
              active={t.id === active.id}
              onClick={() => setTabId(t.id)}
            />
          ))}
          actions={
            <button type="button" className="ds-ng3-action" aria-label="Duplicate">
              <Icon name="duplicate" />
            </button>
          }
          bare
        >
          <ProfileScopeBody state={profile}>
          {active.id === 'audio' ? (
            <AudioTab key={profile.revision} features={f} profile={profile} />
          ) : active.id === 'spatial' ? (
            <SpatialTab key={profile.revision} features={f} profile={profile} />
          ) : (
            <SettingsTab key={profile.revision} sku={sku} features={f} profile={profile} />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

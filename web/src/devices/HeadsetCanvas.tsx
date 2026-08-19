import { useState } from 'react';
import './device-canvas.css';
import './headset-canvas.css';
import {
  Icon,
  Ng3Panel,
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
  SoftwareOnly,
  type IconName,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileScopeBody, useDeviceProfileBar } from './ProfileBar';
import { SurroundStage } from './SurroundStage';
import { MIC_PRESET_LABEL } from './audioLabels';

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
const EQ_PRESETS: Record<string, { label: string; points: string }> = {
  balanced: { label: 'Balanced', points: '1,7 10,7 20,7 30,7 39,7' },
  gaming: { label: 'Gaming', points: '1,4 10,7 20,8 30,7 39,3' },
  voice: { label: 'Voice Chat', points: '1,10 10,8 20,3 30,8 39,10' },
  bassboost: { label: 'Bass Boost', points: '1,3 10,4 20,8 30,9 39,9' },
  basscut: { label: 'Bass Cut', points: '1,12 10,10 20,7 30,6 39,6' },
  trebleboost: { label: 'Treble Boost', points: '1,9 10,9 20,8 30,4 39,3' },
  treblecut: { label: 'Treble Cut', points: '1,6 10,6 20,7 30,10 39,12' },
};

function EqCurve({ points }: { points: string }) {
  return (
    <svg className="hc-eq-curve" viewBox="0 0 40 14" fill="none" aria-hidden="true">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Mic effect ids → display labels (NGENUITY wording).
const MIC_EFFECT_LABEL: Record<string, string> = {
  'noise-reduction': 'AI Noise Reduction',
  compressor: 'Compressor',
  limiter: 'Limiter',
};

// ── Audio tab ────────────────────────────────────────────────────────────────
function AudioTab({ features }: { features: Features }) {
  const audio = features.audio || {};
  const mic = audio.mic && typeof audio.mic === 'object' ? audio.mic : null;
  const eqPresets: string[] = Array.isArray(audio.equalizer?.presets) ? audio.equalizer.presets : [];
  const micPresets: string[] = mic && Array.isArray(mic.presets) ? mic.presets : [];
  const micEffects: string[] = mic && Array.isArray(mic.effects) ? mic.effects : [];

  const [volume, setVolume] = useState(62);
  const [muted, setMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [eqOn, setEqOn] = useState(false);
  const [eqPreset, setEqPreset] = useState(eqPresets[0]);
  const [micPresetsOn, setMicPresetsOn] = useState(false);
  const [micFxOn, setMicFxOn] = useState(false);
  const [fx, setFx] = useState<Record<string, boolean>>({});

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
              <VuSlider defaultValue={70} variant={mic.vuMeter ? 'peak' : 'default'} aria-label="Mic volume" />
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
          <div className="hc-eq-list" role="radiogroup" aria-label="Equalizer preset">
            <ListItem label="Add Equalizer Preset" leading={<Icon name="add-small" size={16} />} />
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
          </div>
        </Ng3Section>
        </SoftwareOnly>
      )}

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
                  defaultValue={micPresets[0]}
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
                    checked={!!fx[id]}
                    onChange={(e) => setFx((f) => ({ ...f, [id]: e.target.checked }))}
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
function SpatialTab({ features }: { features: Features }) {
  const s = features.spatial || {};
  const [experience, setExperience] = useState(50);
  const [distance, setDistance] = useState(50);
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
            {/* Centre-anchored: the mix pulls toward raw performance or full
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

function SettingsTab({ features }: { features: Features }) {
  const autoOff: string[] = Array.isArray(features.power?.autoPowerOff) ? features.power.autoPowerOff : [];
  const notify: string[] = Array.isArray(features.notifications?.modes) ? features.notifications.modes : [];
  return (
    <Ng3Grid className="hc-audio hc-settings">
      {autoOff.length > 0 && (
        <Ng3Section>
          <Ng3Field>
            <Ng3Label strong info>Auto Power-Off</Ng3Label>
            <Dropdown
              aria-label="Auto power-off"
              defaultValue={autoOff.includes('10min') ? '10min' : autoOff[0]}
              options={autoOff.map((v) => ({ label: POWER_OFF_LABEL[v] ?? v, value: v }))}
            />
          </Ng3Field>
        </Ng3Section>
      )}
      {notify.length > 0 && (
        <Ng3Section>
          <Ng3Field>
            <Ng3Label strong info>Notifications</Ng3Label>
            <Dropdown
              aria-label="Notification mode"
              defaultValue={notify[0]}
              options={notify.map((v) => ({ label: NOTIFY_LABEL[v] ?? v, value: v }))}
            />
          </Ng3Field>
        </Ng3Section>
      )}
      {autoOff.length === 0 && notify.length === 0 && (
        <div className="dc-placeholder">No device settings available.</div>
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
  const [spatialOn, setSpatialOn] = useState(true);

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

      <ProfileBar state={profile} />

      {/* Hero */}
      <div className="dc-hero">{heroSrc && <img src={heroSrc} alt={sku.name} />}</div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap">
        <Ng3Panel
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
            <button
              key={t.id}
              type="button"
              className={['ds-ng3-tool', t.id === active.id ? 'active' : ''].filter(Boolean).join(' ')}
              aria-label={t.title}
              aria-pressed={t.id === active.id}
              onClick={() => setTabId(t.id)}
            >
              <Icon name={t.icon} />
            </button>
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
            <AudioTab key={profile.revision} features={f} />
          ) : active.id === 'spatial' ? (
            <SpatialTab key={profile.revision} features={f} />
          ) : (
            <SettingsTab features={f} />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

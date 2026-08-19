import { useState } from 'react';
import './device-canvas.css';
import './mic-canvas.css';
import {
  Icon,
  Ng3Panel,
  Ng3Grid,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  Ng3Spec,
  ListItem,
  Dropdown,
  Toggle,
  Slider,
  VuSlider,
  Button,
  SoftwareOnly,
  type IconName,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileScopeBody, useDeviceProfileBar } from './ProfileBar';
import { MIC_PRESET_LABEL } from './audioLabels';

/**
 * Full-canvas microphone modal on the Ng3Panel canvas — the last device type
 * off the old DeviceModal. Tabs: Audio (pickup pattern + gain/monitoring) ·
 * Effects (preset + processing chain) · Lighting (gated) · Settings. The
 * active pickup pattern is lifted here so the status chip mirrors it (the
 * mic's equivalent of the mouse DPI chip). Feature-gated per SKU — the nine
 * mic SKUs range from the full QuadCast 2 S to the single-pattern SoloCast.
 */

type Features = Record<string, any>;

// Pickup-pattern ids map 1:1 to sprite icons of the same name.
const PATTERN_LABEL: Record<string, string> = {
  cardioid: 'Cardioid',
  omnidirectional: 'Omnidirectional',
  bidirectional: 'Bidirectional',
  stereo: 'Stereo',
};

const EFFECT_ROWS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'noiseReduction', label: 'Noise Reduction', defaultOn: true },
  { key: 'compressor', label: 'Compressor', defaultOn: false },
  { key: 'limiter', label: 'Limiter', defaultOn: false },
  { key: 'gate', label: 'Noise Gate', defaultOn: false },
];

const LIGHT_EFFECT_LABEL: Record<string, string> = {
  solid: 'Solid',
  wave: 'Wave',
  rainbow: 'Rainbow',
  breathing: 'Breathing',
};
const MOUNT_LABEL: Record<string, string> = {
  'shock-mount': 'Shock mount',
  'boom-arm': 'Boom arm',
};

function AudioTab({
  features,
  pattern,
  onPattern,
}: {
  features: Features;
  pattern: string;
  onPattern: (p: string) => void;
}) {
  const a = features.audio || {};
  const patterns: string[] = Array.isArray(a.pickupPatterns) ? a.pickupPatterns : [];
  const [muted, setMuted] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [tapToMute, setTapToMute] = useState(true);

  return (
    <Ng3Grid className="mic-grid">
      {patterns.length > 0 && (
        <Ng3Section>
          <Ng3Label strong info>Pickup Pattern</Ng3Label>
          <div role="radiogroup" aria-label="Pickup pattern" className="mic-patterns">
            {patterns.map((p) => (
              <ListItem
                key={p}
                role="radio"
                aria-checked={pattern === p}
                label={PATTERN_LABEL[p] ?? p}
                leading={<Icon name={p as IconName} size={18} />}
                selected={pattern === p}
                onClick={() => onPattern(p)}
              />
            ))}
          </div>
        </Ng3Section>
      )}
      <Ng3Section>
        {a.gain !== false && (
          <>
            <Ng3Label strong info>Gain</Ng3Label>
            <div className="dc-slider-row">
              <VuSlider defaultValue={55} variant="clipping" aria-label="Gain" />
              <button
                type="button"
                className={'dc-mute' + (muted ? ' active' : '')}
                aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={muted}
                onClick={() => setMuted((m) => !m)}
              >
                <Icon name={muted ? 'mic-mute' : 'mic'} size={16} />
              </button>
            </div>
            <span className="dc-divider" />
          </>
        )}
        {a.monitoring && (
          <Ng3Row>
            <Ng3Label info>Monitoring</Ng3Label>
            <Toggle checked={monitoring} onChange={setMonitoring} aria-label="Monitoring" />
          </Ng3Row>
        )}
        {a.tapToMute && (
          <Ng3Row>
            <Ng3Label info>Tap to Mute</Ng3Label>
            <Toggle checked={tapToMute} onChange={setTapToMute} aria-label="Tap to mute" />
          </Ng3Row>
        )}
      </Ng3Section>
    </Ng3Grid>
  );
}

function EffectsTab({ features }: { features: Features }) {
  const e = features.effects || {};
  const presets: string[] = Array.isArray(e.presets) ? e.presets : [];
  const [fx, setFx] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EFFECT_ROWS.map((r) => [r.key, r.defaultOn])),
  );
  return (
    <SoftwareOnly reason="the processing chain runs on the PC, not in the mic">
    <Ng3Grid className="mic-grid">
      {presets.length > 0 && (
        <Ng3Section>
          <Ng3Field>
            <Ng3Label strong info>Preset</Ng3Label>
            <Dropdown
              aria-label="Effects preset"
              defaultValue={presets[0]}
              options={presets.map((p) => ({ label: MIC_PRESET_LABEL[p] ?? p, value: p }))}
            />
          </Ng3Field>
        </Ng3Section>
      )}
      <Ng3Section>
        <Ng3Label strong info>Processing</Ng3Label>
        {EFFECT_ROWS.filter((r) => e[r.key]).map((r) => (
          <Ng3Row key={r.key}>
            <Ng3Label plain>{r.label}</Ng3Label>
            <Toggle
              checked={!!fx[r.key]}
              onChange={(v) => setFx((f) => ({ ...f, [r.key]: v }))}
              aria-label={r.label}
            />
          </Ng3Row>
        ))}
      </Ng3Section>
    </Ng3Grid>
    </SoftwareOnly>
  );
}

function LightingTab({ features }: { features: Features }) {
  const l = features.lighting || {};
  const effects: string[] = Array.isArray(l.effects) ? l.effects : ['solid'];
  const [brightness, setBrightness] = useState(80);
  const [multi, setMulti] = useState(!!l.multiColor);
  return (
    <Ng3Grid className="mic-grid">
      <Ng3Section>
        <Ng3Field>
          <Ng3Label strong info>Effect</Ng3Label>
          <Dropdown
            aria-label="Lighting effect"
            defaultValue={effects[0]}
            options={effects.map((x) => ({ label: LIGHT_EFFECT_LABEL[x] ?? x, value: x }))}
          />
        </Ng3Field>
        {l.multiColor != null && (
          <Ng3Row>
            <Ng3Label plain>Multi-color</Ng3Label>
            <Toggle checked={multi} onChange={setMulti} aria-label="Multi-color" />
          </Ng3Row>
        )}
      </Ng3Section>
      <Ng3Section>
        <Ng3Row>
          <Ng3Label strong info>Brightness</Ng3Label>
          <span className="dc-mono-val">{brightness}%</span>
        </Ng3Row>
        <Slider min={0} max={100} value={brightness} onChange={setBrightness} aria-label="Brightness" />
        {l.zones != null && (
          <>
            <span className="dc-divider" />
            <Ng3Spec items={[{ label: 'Lighting zones', value: String(l.zones) }]} />
          </>
        )}
      </Ng3Section>
    </Ng3Grid>
  );
}

function SettingsTab({ sku }: { sku: ResolvedSku }) {
  const mount: string[] = Array.isArray(sku.features.mount) ? sku.features.mount : [];
  return (
    <Ng3Grid className="mic-grid">
      <Ng3Section>
        <Ng3Label strong>{sku.name}</Ng3Label>
        <Ng3Spec items={[{ label: 'Firmware', value: 'v0.9.2' }]} />
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
      {mount.length > 0 && (
        <Ng3Section>
          <Ng3Label strong info>Mounting</Ng3Label>
          <Ng3Spec items={mount.map((m) => ({ label: MOUNT_LABEL[m] ?? m, value: 'Supported' }))} />
        </Ng3Section>
      )}
    </Ng3Grid>
  );
}

export function MicCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const f = sku.features;
  const patterns: string[] = Array.isArray(f.audio?.pickupPatterns) ? f.audio.pickupPatterns : [];

  const profile = useDeviceProfileBar(sku);
  const tabs = deviceTabs(sku);

  const [tabId, setTabId] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id,
  );
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];

  // Pattern state lives here so the status chip mirrors the Audio tab.
  const [pattern, setPattern] = useState(patterns[0] ?? '');

  const heroSrc = deviceImageUrl(heroImageFile(sku));
  const conn = connectionStatus(f);

  return (
    <div className="dc-canvas" role="dialog" aria-label={sku.name}>
      {/* Status chips */}
      <div className="dc-status">
        <div className="dc-chip">
          <span className={'dc-chip-dot' + (profile.connected ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
          <span className="dc-chip-val">
            {!profile.connected ? 'Disconnected' : conn.wireless ? 'Wireless' : 'Connected · USB'}
          </span>
        </div>
        {pattern && (
          <div className="dc-chip">
            <Icon name={pattern as IconName} size={16} />
            <span className="dc-chip-val">{PATTERN_LABEL[pattern] ?? pattern}</span>
          </div>
        )}
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
            <AudioTab key={profile.revision} features={f} pattern={pattern} onPattern={setPattern} />
          ) : active.id === 'effects' ? (
            <EffectsTab key={profile.revision} features={f} />
          ) : active.id === 'lighting' ? (
            <LightingTab key={profile.revision} features={f} />
          ) : (
            <SettingsTab sku={sku} />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

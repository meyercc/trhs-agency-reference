import { useEffect, useMemo, useRef, useState } from 'react';
import './device-canvas.css';
import './mic-canvas.css';
import {
  BalanceSlider,
  Button,
  Checkbox,
  Dropdown,
  Icon,
  ListItem,
  Ng3Col,
  Ng3Field,
  Ng3Grid,
  Ng3Label,
  Ng3Panel,
  Ng3Row,
  Ng3Section,
  Ng3Spec,
  Ng3Tool,
  Slider,
  SoftwareOnly,
  Toggle,
  VuSlider,
  type IconName,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileActions, ProfileScopeBody, useDeviceProfileBar, useProfileValue, type ProfileBarState } from './ProfileBar';
import { LightingTab } from './LightingTab';
import { DeviceSettingsCard } from './DeviceSettingsCard';
import { LIGHT_PRESETS } from './lightingData';
import { INPUT_EQ_LABEL, MIC_EFFECT_LABEL, MIC_PRESET_LABEL } from './audioLabels';

/**
 * Full-canvas microphone modal on the Ng3Panel canvas — the last device type
 * off the old DeviceModal. Tabs: Audio (pickup pattern + gain/monitoring) ·
 * Effects (preset + processing chain) · Lights (gated) · Settings. The
 * active pickup pattern is lifted here so the status chip mirrors it (the
 * mic's equivalent of the mouse DPI chip). Feature-gated per SKU — the nine
 * mic SKUs range from the full QuadCast 2 S to the single-pattern SoloCast.
 *
 * A mic that declares `lighting.lights` (the SoloCast 2 Pro's nine-light ring)
 * gets the ring canvas: the photo's translucent band shows color placed behind
 * it, the standard Lights tab (the keyboard's) paints it and the profile keeps
 * it, and on the Lights tab each light is a pick target on the photo (Figma
 * Lights 6831:40762). Its Audio tab is the FlipCast control panel (Figma Audio
 * 13953:597433), with the Microphone Test button over the hero (13852:26924).
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

/**
 * The ring's nine lights as shares of the rendered photo — the Figma "Light
 * Select" chips (Lights 6831:40762) over the same photo, so the pick targets
 * land on the lights. `y` is the chip's top; the lights follow the ring's arc,
 * so the outer ones sit a little higher.
 */
const RING_LIGHTS: { x: number; w: number; y: number }[] = [
  { x: 10.16, w: 6.74, y: 76.6 },
  { x: 17.46, w: 7.86, y: 77.1 },
  { x: 25.88, w: 8.98, y: 77.3 },
  { x: 35.43, w: 9.54, y: 77.6 },
  { x: 45.54, w: 9.54, y: 77.8 },
  { x: 55.64, w: 9.54, y: 77.6 },
  { x: 65.75, w: 8.98, y: 77.3 },
  { x: 75.29, w: 7.86, y: 77.1 },
  { x: 83.72, w: 6.74, y: 76.6 },
];
/** A light's height, as a share of the photo. */
const RING_PICK_H = 4.45;
/** A press that moves less than this is a click on a light, not a marquee. */
const DRAG_THRESHOLD = 4;
const RING_IDS = RING_LIGHTS.map((_, i) => String(i));
/** How long a Microphone Test listens before it stops itself. */
const MIC_TEST_MS = 5000;
// Stable fallback: `useProfileValue` keys its setter on the fallback object.
const NO_RING_COLORS: Record<string, string> = {};

/** Average of the lit colors ("rgb(r, g, b)" strings) as "r,g,b", for the bloom. */
function averageRgb(colors: string[]): string | null {
  const parsed = colors
    .map((c) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number))
    .filter((v) => v.length === 3);
  if (!parsed.length) return null;
  const sum = parsed.reduce((acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b], [0, 0, 0]);
  return sum.map((v) => Math.round(v / parsed.length)).join(',');
}

function AudioTab({
  features,
  pattern,
  onPattern,
  profile,
}: {
  features: Features;
  pattern: string;
  onPattern: (p: string) => void;
  profile: ProfileBarState;
}) {
  const a = features.audio || {};
  const patterns: string[] = Array.isArray(a.pickupPatterns) ? a.pickupPatterns : [];
  // Mute stays local on purpose: it is live status, not a setting. A profile
  // that silently muted your mic on activation would be a bug, not a feature.
  const [muted, setMuted] = useState(false);
  const [gain, setGain] = useProfileValue(profile, 'audio.gain', 55);
  const [monitoring, setMonitoring] = useProfileValue(profile, 'audio.monitoring', false);
  const [tapToMute, setTapToMute] = useProfileValue(profile, 'audio.tapToMute', true);
  // The FlipCast panel's extra rows and right column (Figma Audio 13953:597433):
  // a headphone out with its own volume and mute, the monitoring / playback
  // mix, and the PC-side input equalizer and effects — each declared by the SKU.
  const [phonesMuted, setPhonesMuted] = useState(false);
  const [phonesVol, setPhonesVol] = useProfileValue(profile, 'audio.headphoneVolume', 0);
  const [mix, setMix] = useProfileValue(profile, 'audio.monitorMix', 50);
  const inputEq: string[] = Array.isArray(a.inputEq) ? a.inputEq : [];
  const effects: string[] = Array.isArray(a.effects) ? a.effects : [];
  const [eqOn, setEqOn] = useProfileValue(profile, 'audio.inputEqOn', false);
  const [eqPreset, setEqPreset] = useProfileValue(profile, 'audio.inputEq', inputEq[0] ?? '');
  const [fxOn, setFxOn] = useProfileValue(profile, 'audio.effectsOn', false);
  const fx = (id: string) => profile.value<boolean>(`audio.fx.${id}`, false);
  const setFx = (id: string, v: boolean) => profile.setValue(`audio.fx.${id}`, v);
  const flip = inputEq.length > 0 || effects.length > 0;

  return (
    <Ng3Grid className={'mic-grid' + (flip ? ' mic-audio' : '')}>
      {patterns.length > 1 && (
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
            <Ng3Label strong info>{flip ? 'Mic Gain' : 'Gain'}</Ng3Label>
            <div className="dc-slider-row">
              <VuSlider value={gain} onChange={setGain} variant="clipping" aria-label="Gain" />
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
        {a.headphoneOut && (
          <>
            <Ng3Label strong info>Headphone Volume</Ng3Label>
            <div className="dc-slider-row">
              <Slider min={0} max={100} value={phonesVol} onChange={setPhonesVol} aria-label="Headphone volume" />
              <button
                type="button"
                className={'dc-mute' + (phonesMuted ? ' active' : '')}
                aria-label={phonesMuted ? 'Unmute headphones' : 'Mute headphones'}
                aria-pressed={phonesMuted}
                onClick={() => setPhonesMuted((m) => !m)}
              >
                <Icon name={phonesMuted ? 'audio-mute' : 'audio'} size={16} />
              </button>
            </div>
          </>
        )}
        {a.monitorMix && (
          <>
            <Ng3Label strong>Mic Monitoring / Playback Mix</Ng3Label>
            <div className="dc-slider-row mic-mix">
              <Icon name="mic" size={16} aria-hidden />
              <BalanceSlider min={0} max={100} value={mix} onChange={setMix} aria-label="Mic monitoring and playback mix" />
              <Icon name="audio-headset" size={16} aria-hidden />
            </div>
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
      {flip && (
        <SoftwareOnly reason="the input equalizer and effects run on the PC, not in the mic">
        <Ng3Col>
          {inputEq.length > 0 && (
            <Ng3Section>
              <Ng3Row>
                <Ng3Label strong info>Input Equalizer</Ng3Label>
                <Toggle checked={eqOn} onChange={setEqOn} aria-label="Input equalizer" />
              </Ng3Row>
              <div>
                <Dropdown
                  aria-label="Input equalizer preset"
                  value={eqPreset}
                  onChange={setEqPreset}
                  options={inputEq.map((id) => ({ label: INPUT_EQ_LABEL[id] ?? id, value: id }))}
                />
              </div>
            </Ng3Section>
          )}
          {effects.length > 0 && (
            <Ng3Section>
              <Ng3Row>
                <Ng3Label strong info>Effects</Ng3Label>
                <Toggle checked={fxOn} onChange={setFxOn} aria-label="Effects" />
              </Ng3Row>
              <div className="mic-fx-list">
                {effects.map((id) => (
                  <Checkbox
                    key={id}
                    label={MIC_EFFECT_LABEL[id] ?? id}
                    checked={fx(id)}
                    onChange={(e) => setFx(id, e.target.checked)}
                  />
                ))}
              </div>
            </Ng3Section>
          )}
        </Ng3Col>
        </SoftwareOnly>
      )}
    </Ng3Grid>
  );
}

function EffectsTab({ features, profile }: { features: Features; profile: ProfileBarState }) {
  const e = features.effects || {};
  const presets: string[] = Array.isArray(e.presets) ? e.presets : [];
  const [preset, setPreset] = useProfileValue(profile, 'effects.preset', presets[0] ?? '');
  // Read/written per key rather than as one bag: the rows are SKU-filtered, so a
  // hook per row would break the rules of hooks, and one key per effect is also
  // what makes each of them its own line in the profile's manifest.
  const fxOn = (key: string, fallback: boolean) => profile.value<boolean>(`effects.${key}`, fallback);
  const setFxOn = (key: string, v: boolean) => profile.setValue(`effects.${key}`, v);
  return (
    <SoftwareOnly reason="the processing chain runs on the PC, not in the mic">
    <Ng3Grid className="mic-grid">
      {presets.length > 0 && (
        <Ng3Section>
          <Ng3Field>
            <Ng3Label strong info>Preset</Ng3Label>
            <Dropdown
              aria-label="Effects preset"
              value={preset}
              onChange={setPreset}
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
              checked={fxOn(r.key, r.defaultOn)}
              onChange={(v) => setFxOn(r.key, v)}
              aria-label={r.label}
            />
          </Ng3Row>
        ))}
      </Ng3Section>
    </Ng3Grid>
    </SoftwareOnly>
  );
}

function MicLightingTab({ features, profile }: { features: Features; profile: ProfileBarState }) {
  const l = features.lighting || {};
  const effects: string[] = Array.isArray(l.effects) ? l.effects : ['solid'];
  const [effect, setEffect] = useProfileValue(profile, 'lighting.effect', effects[0]);
  const [brightness, setBrightness] = useProfileValue(profile, 'lighting.brightness', 80);
  const [multi, setMulti] = useProfileValue(profile, 'lighting.multiColor', !!l.multiColor);
  return (
    <Ng3Grid className="mic-grid">
      <Ng3Section>
        <Ng3Field>
          <Ng3Label strong info>Effect</Ng3Label>
          <Dropdown
            aria-label="Lighting effect"
            value={effect}
            onChange={setEffect}
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
  const f = sku.features;
  const mount: string[] = Array.isArray(f.mount) ? f.mount : [];
  const support = (f.support && typeof f.support === 'object' ? f.support : {}) as Record<string, unknown>;
  // The device card (Figma Device Settings 12065:12944): name, firmware, the
  // two support buttons, the partner credit, and the OS hand-off on the floor.
  return (
    <Ng3Grid className="mic-grid">
      <DeviceSettingsCard
        name={sku.name}
        firmware={typeof f.firmware === 'string' ? f.firmware : null}
        deviceManager={support.deviceManager !== false}
        getSupport={support.getSupport !== false}
        audioCredit={typeof f.audio?.audioCredit === 'string' ? f.audio.audioCredit : null}
        handoff={{ label: 'Windows Sound Devices', icon: 'mic' }}
      />
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

  // Pattern state lives here so the status chip mirrors the Audio tab, and is
  // scope-backed so it travels with the profile / onboard slot like the rest.
  const [pattern, setPattern] = useProfileValue(profile, 'audio.pickupPattern', patterns[0] ?? '');

  const conn = connectionStatus(f);

  // ── The ring (a mic with `lighting.lights`) ──
  // Colors, the picked preset and power belong to the profile, as plain
  // records (the TH-402 shape); which lights are selected is a gesture and
  // stays local. Read unconditionally — hooks — and used only when `ring`.
  const ring = typeof f.lighting === 'object' && f.lighting !== null && Number(f.lighting.lights) > 0;
  // The SKU's photo has the ring lit — right for every still of the product
  // (board card, Devices panel, Light Studio). The canvas paints the lights
  // itself, so it takes the unlit photo the SKU names for that.
  const unlit = ring && typeof f.lighting.unlitImage === 'string' ? (f.lighting.unlitImage as string) : null;
  const heroSrc = deviceImageUrl(unlit ?? heroImageFile(sku));
  const [lightsOn, setLightsOn] = useProfileValue(profile, 'lighting.power', true);
  const [ringRec, setRingRec] = useProfileValue<Record<string, string>>(profile, 'lighting.lightColors', NO_RING_COLORS);
  const [presetId, setPresetId] = useProfileValue<string>(profile, 'lighting.preset', LIGHT_PRESETS[0]?.id ?? '');
  const brightness = profile.value<number>('lighting.brightness', 100);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const bloom = useMemo(() => averageRgb(Object.values(ringRec)), [ringRec]);
  // Painting is per light: a preset or the editor's live color lands on the
  // selected lights, or on the whole ring when nothing is selected — so a
  // ring can carry several colors. The selection stays, to keep working on.
  const paint = (color: string) =>
    setRingRec((prev) => {
      const next = { ...prev };
      (sel.size ? [...sel].map(String) : RING_IDS).forEach((id) => {
        next[id] = color;
      });
      return next;
    });
  const applyPreset = (glow: string) => paint(`rgb(${glow})`);
  // A click toggles one light. A drag on the photo draws a marquee and takes
  // every light it crosses (Shift adds to the selection) — the keyboard hero's
  // gesture, always armed here since the photo has nothing else to drag.
  const picksRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const toggleLight = (i: number) => {
    if (draggedRef.current) return; // the drag's pointerup would click the light it ended on
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const onPicksPointerDown = (e: React.PointerEvent) => {
    const layer = picksRef.current;
    if (e.button !== 0 || !layer) return;
    draggedRef.current = false;
    const rect = layer.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!draggedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      setBox({ left: Math.min(x0, ev.clientX) - rect.left, top: Math.min(y0, ev.clientY) - rect.top, width: Math.abs(dx), height: Math.abs(dy) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setBox(null);
      if (!draggedRef.current) return;
      const r = { left: Math.min(x0, ev.clientX), right: Math.max(x0, ev.clientX), top: Math.min(y0, ev.clientY), bottom: Math.max(y0, ev.clientY) };
      // Any overlap counts — a box drawn along the ring takes the lights it crosses.
      const hits = [...layer.querySelectorAll<HTMLElement>('.mic-light-pick')]
        .filter((el) => {
          const k = el.getBoundingClientRect();
          return k.left < r.right && k.right > r.left && k.top < r.bottom && k.bottom > r.top;
        })
        .map((el) => Number(el.dataset.light) - 1);
      setSel((prev) => {
        const next = ev.shiftKey ? new Set(prev) : new Set<number>();
        hits.forEach((i) => next.add(i));
        return next;
      });
      // Let the click the drag ends on see the flag, then clear it for the next press.
      setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Microphone Test (Figma Audio 13852:26924): a pressed button over the hero
  // while the Audio tab is up; the test ends on its own.
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (!testing) return;
    const t = setTimeout(() => setTesting(false), MIC_TEST_MS);
    return () => clearTimeout(t);
  }, [testing]);

  return (
    <div className="dc-canvas mic-canvas" role="dialog" aria-label={sku.name}>
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

      {/* Hero — the ring mic lights its photo from behind; other mics show the photo */}
      <div className={'dc-hero' + (ring ? ' mic-hero' : '')}>
        {ring && active.id === 'audio' && (
          <div className="mic-hero-cta">
            <Button onImage aria-pressed={testing} onClick={() => setTesting((t) => !t)}>
              <Icon name="mic" size={16} />
              {testing ? 'Stop Test' : 'Microphone Test'}
            </Button>
          </div>
        )}
        {heroSrc && !ring && <img src={heroSrc} alt={sku.name} />}
        {heroSrc && ring && (
          <span
            className="dc-hero-fig mic-fig"
            style={{ ['--ring-level' as string]: lightsOn ? brightness / 100 : 0 } as React.CSSProperties}
            data-lights={lightsOn ? 'on' : 'off'}
          >
            {/* A soft bloom of the lit colors' average, behind the photo. */}
            {bloom && (
              <span
                className="mic-ring-bloom"
                style={{ ['--glow' as string]: `rgba(${bloom},0.55)` } as React.CSSProperties}
                aria-hidden="true"
              />
            )}
            <img src={heroSrc} alt={sku.name} />
            {/* The nine lights, on the photo where the ring is: lit ones carry
                their color and a glow, unlit ones read as dark glass. */}
            <span className="mic-ring" aria-hidden="true">
              {RING_LIGHTS.map((p, i) => {
                const c = ringRec[String(i)];
                return (
                  <span
                    key={i}
                    className={'mic-ring-light' + (c ? ' lit' : '')}
                    data-light={i + 1}
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: `${p.w}%`,
                      height: `${RING_PICK_H}%`,
                      ...(c ? { ['--rgb' as string]: c } : {}),
                    } as React.CSSProperties}
                  />
                );
              })}
            </span>
            {active.id === 'lighting' && (
              <div ref={picksRef} className="mic-ring-picks" role="group" aria-label="Ring lights" onPointerDown={onPicksPointerDown}>
                {RING_LIGHTS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="checkbox"
                    aria-checked={sel.has(i)}
                    aria-label={`Light ${i + 1}`}
                    data-light={i + 1}
                    className={'mic-light-pick' + (sel.has(i) ? ' selected' : '')}
                    style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${RING_PICK_H}%` }}
                    onClick={() => toggleLight(i)}
                  />
                ))}
                {box && (
                  <div
                    className="mic-marquee"
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                    aria-hidden="true"
                  />
                )}
              </div>
            )}
          </span>
        )}
      </div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap">
        <Ng3Panel
          leading={<ProfileBar state={profile} />}
          trailing={<ProfileActions state={profile} />}
          width={active.width}
          header={active.title}
          headerExtra={
            ring && active.id === 'lighting' ? (
              <Toggle checked={lightsOn} onChange={setLightsOn} aria-label="Ring lighting power" />
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
            <AudioTab key={profile.revision} features={f} pattern={pattern} onPattern={setPattern} profile={profile} />
          ) : active.id === 'effects' ? (
            <EffectsTab key={profile.revision} features={f} profile={profile} />
          ) : active.id === 'lighting' && ring ? (
            <LightingTab
              key={profile.revision}
              preset={presetId}
              onPreset={setPresetId}
              onApplyAll={applyPreset}
              onPaintSelected={paint}
              brightness={brightness}
              onBrightness={(v) => profile.setValue('lighting.brightness', v)}
            />
          ) : active.id === 'lighting' ? (
            <MicLightingTab key={profile.revision} features={f} profile={profile} />
          ) : (
            <SettingsTab sku={sku} />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

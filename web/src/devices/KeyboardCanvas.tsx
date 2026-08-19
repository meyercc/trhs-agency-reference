import { useState } from 'react';
import './device-canvas.css';
import './keyboard-canvas.css';
import {
  Icon,
  Ng3Panel,
  Ng3Grid,
  Ng3Col,
  Ng3Section,
  Ng3Label,
  Dropdown,
  Toggle,
  ToggleButtonGroup,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileScopeBody, useDeviceProfileBar } from './ProfileBar';
import { KeyboardHero } from './KeyboardHero';
import { LightingTab } from './LightingTab';
import { KeysTab } from './KeysTab';
import { ALL_CODES, KB_QS_GROUPS, type KbLayer, type KeyBinds } from './keyboardLayout';

/**
 * Full-canvas keyboard device modal (Figma "Keys-Buttons" 2146:73092). Mirrors
 * the mouse `DeviceCanvas` pattern — a full-bleed hero over a bottom `Ng3Panel`
 * with the chamfered 3-icon nav — for the HyperX Origins 65. The hero is the
 * interactive keyboard (Lighting/Keys tabs) or the device photo (Settings).
 *
 * Owns the shared keyboard state (layer / selection / lighting) so the panels
 * can drive and read the hero. Phase 1: shell + hero + Settings. Phase 2:
 * Lighting tab (this file wires the hero painting). Phase 3: Keys & Macros.
 */


const POLLING_RATES = ['125 Hz', '250 Hz', '500 Hz', '1000 Hz', '2000 Hz', '4000 Hz', '8000 Hz'];

// Handed to the hero in place of keyColors while the lighting master power is
// off — the painted state is kept, the board just renders unlit.
const UNLIT = new Map<string, string>();

function SettingsTab({
  sku,
  pollingRate,
  onPollingRate,
}: {
  sku: ResolvedSku;
  /** Polling rate travels with the device — the current profile scope's value. */
  pollingRate: string;
  onPollingRate: (v: string) => void;
}) {
  const [controlMode, setControlMode] = useState('software');
  return (
    <Ng3Grid className="pdm-settings">
      <Ng3Col className="pdm-settings-col">
        <Ng3Section>
          <Ng3Label strong>{sku.name}</Ng3Label>
          <p className="pdm-settings-fw">Firmware Version 2.1.4</p>
          <div className="pdm-settings-btns">
            <button type="button" className="ds-btn">
              <Icon name="screen-mirror" size={16} />
              Device Manager
            </button>
            <button type="button" className="ds-btn">
              <Icon name="question" size={16} />
              Get Support
            </button>
          </div>
        </Ng3Section>
        <Ng3Section>
          <Ng3Label strong>Polling Rate</Ng3Label>
          <Dropdown
            aria-label="Polling rate"
            value={pollingRate}
            onChange={onPollingRate}
            options={POLLING_RATES.map((r) => ({ label: r, value: r }))}
          />
        </Ng3Section>
      </Ng3Col>

      <Ng3Section className="pdm-settings-mode">
        <Ng3Label strong>Control Mode</Ng3Label>
        <ToggleButtonGroup
          aria-label="Control mode"
          value={controlMode}
          onChange={setControlMode}
          options={[
            { label: 'Software', value: 'software' },
            { label: 'Hardware', value: 'hardware' },
          ]}
        />
        <p className="pdm-settings-desc">
          Draw unlimited power from an ancient, all-knowing source (NGENUITY itself! 🤯) to run your most advanced
          customizations in real-time. Tremble before its awesome power!
        </p>
      </Ng3Section>
    </Ng3Grid>
  );
}

export function KeyboardCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const profile = useDeviceProfileBar(sku);
  const TABS = deviceTabs(sku);
  const [tabId, setTabId] = useState(
    initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : TABS[0].id,
  );
  const active = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const heroSrc = deviceImageUrl(heroImageFile(sku));

  // ── Shared keyboard state (drives the hero; read/written by the panels) ──
  // Lighting master power lives here so its toggle can sit in the panel header
  // next to the "Lights" title (Figma Lights 680:176027). Off renders the hero
  // unlit (the device's truth); the Lighting tab itself stays fully operable —
  // preset curation isn't gated on the lights being on.
  const [lightsOn, setLightsOn] = useState(true);
  const [layer, setLayer] = useState<KbLayer>('base');
  const [selected, setSelected] = useState<string | null>(null);
  const [litSel, setLitSel] = useState<Set<string>>(new Set());
  const [keyColors, setKeyColors] = useState<Map<string, string>>(new Map());
  const [activeQs, setActiveQs] = useState('all');
  const [heroGlow, setHeroGlow] = useState<string | null>(null);
  // The marquee tool: armed until dismissed, so several boxes can be drawn.
  const [marquee, setMarquee] = useState(false);
  const [binds, setBinds] = useState<Map<string, KeyBinds>>(new Map());
  const [armed, setArmed] = useState<string | null>(null);

  const mode: 'lights' | 'keys' = active.id === 'keys' ? 'keys' : 'lights';

  // Write a binding to the active layer's slot; consume the selection + armed pick.
  const assign = (code: string, label: string) => {
    setBinds((prev) => {
      const next = new Map(prev);
      const cur = { ...(next.get(code) ?? {}) };
      if (layer === 'fn') cur.fn = label;
      else cur.base = label;
      next.set(code, cur);
      return next;
    });
    setSelected(null);
    setArmed(null);
  };

  const onKey = (code: string) => {
    if (mode === 'lights') {
      setLitSel((prev) => {
        const next = new Set(prev);
        next.has(code) ? next.delete(code) : next.add(code);
        return next;
      });
      setActiveQs('');
    } else if (armed != null) {
      assign(code, armed); // a palette item was armed first
    } else {
      setSelected(code);
    }
  };

  // Arm a palette keycap; if a key is already selected, bind immediately.
  const armPalette = (label: string) => {
    if (selected != null) assign(selected, label);
    else setArmed(label);
  };

  const clearBinding = () => {
    if (!selected) return;
    setBinds((prev) => {
      const next = new Map(prev);
      const cur = { ...(next.get(selected) ?? {}) };
      if (layer === 'fn') delete cur.fn;
      else delete cur.base;
      if (cur.base == null && cur.fn == null) next.delete(selected);
      else next.set(selected, cur);
      return next;
    });
  };

  // Reset the active layer to factory — drop this layer's custom binds.
  const resetLayer = () => {
    setBinds((prev) => {
      const next = new Map<string, KeyBinds>();
      prev.forEach((b, code) => {
        const keep: KeyBinds = layer === 'fn' ? { base: b.base } : { fn: b.fn };
        if (keep.base != null || keep.fn != null) next.set(code, keep);
      });
      return next;
    });
    setSelected(null);
    setArmed(null);
  };

  const onQuickSelect = (id: string) => {
    if (id === 'reset') {
      setLitSel(new Set());
      setActiveQs('');
      return;
    }
    setActiveQs(id);
    setLitSel(new Set(id === 'all' ? ALL_CODES : KB_QS_GROUPS[id] ?? []));
  };

  // A dragged box replaces the selection, the way picking a preset does; Shift
  // adds to it, so several boxes can build one selection. Either way the result
  // is hand-made, so no preset stays lit claiming credit for it.
  const onMarqueeSelect = (codes: string[], additive: boolean) => {
    setLitSel((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      codes.forEach((c) => next.add(c));
      return next;
    });
    setActiveQs('');
  };

  // Apply a preset — paint every key + set the hero glow, clear the selection.
  const applyPresetAll = (glow: string) => {
    const color = `rgb(${glow})`;
    setKeyColors(new Map(ALL_CODES.map((c) => [c, color])));
    setHeroGlow(glow);
    setLitSel(new Set());
    setActiveQs('');
  };

  // Editor live preview — paint only the lit-selected keys.
  const paintSelected = (color: string) => {
    setKeyColors((prev) => {
      const next = new Map(prev);
      litSel.forEach((c) => next.set(c, color));
      return next;
    });
  };

  return (
    <div className="dc-canvas kbd-canvas" role="dialog" aria-label={sku.name}>
      {/* Connection status chip — live against the device simulator */}
      <div className="dc-status">
        <div className="dc-chip">
          <span className={'dc-chip-dot' + (profile.connected ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
          <span className="dc-chip-val">{profile.connected ? 'Connected · USB' : 'Disconnected'}</span>
        </div>
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      <ProfileBar state={profile} />

      {/* Hero — interactive keyboard (Lighting/Keys) or device photo (Settings) */}
      <div className="dc-hero kbd-hero">
        {active.id === 'settings' ? (
          heroSrc && <img className="kbd-hero-img" src={heroSrc} alt={sku.name} />
        ) : (
          <>
            {lightsOn && heroGlow && (
              <span
                className="kbd-hero-glow"
                style={{ ['--glow' as string]: `rgba(${heroGlow},0.55)` } as React.CSSProperties}
                aria-hidden="true"
              />
            )}
            <KeyboardHero
              mode={mode}
              layer={layer}
              onLayer={setLayer}
              selected={selected}
              litSel={litSel}
              keyColors={lightsOn ? keyColors : UNLIT}
              binds={binds}
              activeQs={activeQs}
              marquee={marquee}
              onMarquee={() => setMarquee((m) => !m)}
              onMarqueeSelect={onMarqueeSelect}
              onKey={onKey}
              onQuickSelect={onQuickSelect}
            />
          </>
        )}
      </div>

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap kbd-panel-wrap">
        <Ng3Panel
          header={active.title}
          headerExtra={
            active.id === 'lighting' ? (
              <Toggle checked={lightsOn} onChange={setLightsOn} aria-label="Keyboard lighting power" />
            ) : undefined
          }
          tools={TABS.map((t) => (
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
            <button type="button" className="ds-ng3-action" aria-label="Duplicate profile">
              <Icon name="duplicate" />
            </button>
          }
          bare
        >
          <ProfileScopeBody state={profile}>
          {active.id === 'settings' ? (
            <SettingsTab
              key={profile.revision}
              sku={sku}
              pollingRate={profile.value('settings.pollingRate', '1000 Hz')}
              onPollingRate={(v) => profile.setValue('settings.pollingRate', v)}
            />
          ) : active.id === 'lighting' ? (
            <LightingTab
              key={profile.revision}
              onApplyAll={applyPresetAll}
              onPaintSelected={paintSelected}
              brightness={profile.value('lighting.brightness', 100)}
              onBrightness={(v) => profile.setValue('lighting.brightness', v)}
            />
          ) : (
            <KeysTab
              selected={selected}
              armed={armed}
              layer={layer}
              binds={binds}
              onArm={armPalette}
              onClearBinding={clearBinding}
              onResetLayer={resetLayer}
            />
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

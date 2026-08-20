import { useState, type ReactNode } from 'react';
import { Dropdown, ReorderableSections, Slider, Toggle, ToggleButtonGroup, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { AppearanceWidget } from '../widgets';
import { CardDoor, Facts } from '../widgets/perform5/CardKit';
import { GrowArea } from '../widgets/personalize2/GrowArea';
import { LightingCard } from '../widgets/personalize2/LightingCard';
import './pages.css';
import './perform-v5.css';
import './personalize-v2.css';

// ── PersonalizeV2 (#/personalize-v2) — five-family proposal ──
// Audio · Display · Keys & Macros · Lighting · App. Card anatomy and typography
// follow the Perform V5 grammar (CardKit: header title + door · hero reading ·
// Facts rows). Design-ready surface: no explanatory copy on the page — the
// reasoning is delivered verbally. Chris's #/personalize is untouched.
//
// Family notes (for the presenter, not the page):
// · Audio — Output/Input are STATUS cards: the active source is the hero
//   reading; one control rides on each (profile dropdown / noise reduction).
// · Display — device-centric main element: every screen in one view; SELECTING
//   a screen grows that screen's quick controls out beneath it (same growth
//   grammar as Power Mode); every sub area ends in an advanced door — except
//   the laptop built-in (no OMEN display optimization there today). Everything
//   BETWEEN screens — layout, KVM routing, auto-switch — lives in the
//   ARRANGEMENT modal behind the card's top-right door, so selecting a screen
//   can never nudge the layout.
// · Lighting — ONE card, control-card logic in a content-card visual register:
//   the main element is a static pseudo-3D line-art strip (every RGB device in
//   wireframe, lit by its own live glow — the 3D studio is parked). SYNCHRONIZE
//   rides with the device strip; selection grows the light controls beneath,
//   the same growth grammar as Display.

/** Hero reading — the V5 status-word slot carrying a value (neutral, mono). */
function Hero({ children }: { children: ReactNode }) {
  return <div className="pz2-hero">{children}</div>;
}

interface Screen {
  id: string;
  name: string;
  meta: string;
  kind: 'monitor' | 'laptop';
  /** has built-in speakers → volume control appears */
  speakers: boolean;
  /** OMEN display optimization available → advanced door appears */
  advanced: boolean;
}

const SCREENS: Screen[] = [
  { id: 'omen27', name: 'OMEN 27', meta: '2560×1440 · 165 Hz', kind: 'monitor', speakers: true, advanced: true },
  { id: 'builtin', name: 'Built-in display', meta: '14″ · 120 Hz', kind: 'laptop', speakers: false, advanced: false },
  { id: 'hp24', name: 'HP 24mh', meta: '1920×1080 · 75 Hz', kind: 'monitor', speakers: false, advanced: true },
];

const PRESETS = [
  { label: 'Native', value: 'native' },
  { label: 'Game', value: 'game' },
  { label: 'sRGB', value: 'srgb' },
];

interface ScreenSub {
  preset: string;
  bright: number;
  auto: boolean;
  vol: number;
}

const SUB_DEFAULTS: Record<string, ScreenSub> = {
  omen27: { preset: 'game', bright: 70, auto: true, vol: 65 },
  builtin: { preset: 'native', bright: 55, auto: true, vol: 0 },
  hp24: { preset: 'native', bright: 60, auto: false, vol: 0 },
};

export function PersonalizeV2() {
  const [screenSel, setScreenSel] = useState('omen27');
  const [outProfile, setOutProfile] = useState('theater');
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [subs, setSubs] = useState<Record<string, ScreenSub>>(SUB_DEFAULTS);

  const screen = SCREENS.find((s) => s.id === screenSel)!;
  const sub = subs[screenSel];
  const patchSub = (patch: Partial<ScreenSub>) => setSubs((m) => ({ ...m, [screenSel]: { ...m[screenSel], ...patch } }));

  const sections: ReorderableSectionData[] = [
    // ── LIGHTING ───────────────────────────────────────────────────────────
    // First section: the family with the widest cross-device story (Chris: the
    // star of Personalize). Deep effect authoring sits behind the per-device
    // advanced door inside the card.
    {
      id: 'lighting',
      header: <SectionHeader label="Lighting" />,
      children: <LightingCard />,
    },
    // ── AUDIO ──────────────────────────────────────────────────────────────
    {
      id: 'audio',
      header: <SectionHeader label="Audio" />,
      children: (
        <div className="pz2-pair">
          <div className="ds-feature-card pz2-card">
            <div className="ds-feature-card-header">
              <div className="ds-feature-card-title">Output</div>
              <CardDoor verb="manage" />
            </div>
            <Hero>Cloud III</Hero>
            <div className="pz2-ctl-row">
              <span className="pz2-rel-label">Audio profile</span>
              <Dropdown
                aria-label="Audio profile"
                value={outProfile}
                onChange={setOutProfile}
                options={[
                  { label: 'Theater', value: 'theater' },
                  { label: 'Music', value: 'music' },
                  { label: 'Game', value: 'game' },
                  { label: 'Flat', value: 'flat' },
                ]}
              />
            </div>
            <Facts
              items={[
                { label: 'Device', value: 'HyperX Cloud III · wireless' },
                { label: 'Volume', value: '65%' },
              ]}
            />
          </div>
          <div className="ds-feature-card pz2-card">
            <div className="ds-feature-card-header">
              <div className="ds-feature-card-title">Input</div>
              <CardDoor verb="manage" />
            </div>
            <Hero>QuadCast 2 S</Hero>
            <div className="pz2-ctl-row">
              <span className="pz2-rel-label">Noise reduction</span>
              <Toggle checked={noiseReduction} onChange={setNoiseReduction} aria-label="Noise reduction" />
            </div>
            <Facts
              items={[
                { label: 'Device', value: 'HyperX QuadCast 2 S · USB' },
                { label: 'Gain', value: '72%' },
              ]}
            />
          </div>
        </div>
      ),
    },
    // ── DISPLAY ────────────────────────────────────────────────────────────
    {
      id: 'display',
      header: <SectionHeader label="Display" />,
      children: (
        <div className="ds-feature-card pz2-card pz2-displays">
          <div className="ds-feature-card-header">
            <div className="ds-feature-card-title">Displays</div>
            {/* Opens the Arrangement modal: layout, KVM routing, auto-switch —
                the relations BETWEEN screens. Selecting a screen on the desk can
                therefore never nudge the layout. */}
            <CardDoor verb="manage" />
          </div>

          <div className="pz2-desk" role="tablist" aria-label="Connected displays">
            {SCREENS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={screenSel === s.id}
                className={['pz2-screen', `pz2-screen--${s.kind}`, screenSel === s.id ? 'pz2-screen--sel' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setScreenSel(s.id)}
              >
                <span className="pz2-screen-frame">
                  <span className="pz2-screen-glow" aria-hidden="true" />
                </span>
                {s.kind === 'laptop' && <span className="pz2-screen-base" aria-hidden="true" />}
                <span className="pz2-screen-name">{s.name}</span>
                <span className="pz2-screen-meta">{s.meta}</span>
              </button>
            ))}
          </div>

          {/* Selected screen's quick controls grow out beneath the desk —
              per-display high-level control lives on the SELECTED STATE. */}
          <GrowArea>
            <div className="pv5-pm-sub pz2-sub" key={screenSel}>
              <div className="pz2-sub-head">{screen.name}</div>
              <div className="pz2-ctl-row">
                <span className="pz2-rel-label">Preset</span>
                <ToggleButtonGroup options={PRESETS} value={sub.preset} onChange={(v) => patchSub({ preset: v })} aria-label="Picture preset" />
              </div>
              <div className="pz2-ctl-row pz2-ctl-row--slider">
                <span className="pz2-rel-label">Brightness</span>
                <div className="pz2-ctl-slider">
                  <Slider value={sub.bright} onChange={(v) => patchSub({ bright: v })} aria-label="Brightness" />
                </div>
                <span className="pz2-ctl-auto">
                  Auto <Toggle checked={sub.auto} onChange={(v) => patchSub({ auto: v })} aria-label="Auto brightness" />
                </span>
              </div>
              {screen.speakers && (
                <div className="pz2-ctl-row pz2-ctl-row--slider">
                  <span className="pz2-rel-label">Volume</span>
                  <div className="pz2-ctl-slider">
                    <Slider value={sub.vol} onChange={(v) => patchSub({ vol: v })} aria-label="Volume" />
                  </div>
                </div>
              )}
              {screen.advanced && (
                <div className="pz2-ctl-row">
                  <span className="pz2-rel-label">Advanced control</span>
                  <CardDoor verb="configure" />
                </div>
              )}
            </div>
          </GrowArea>

        </div>
      ),
    },
    // ── KEYS & MACROS ──────────────────────────────────────────────────────
    {
      id: 'keys',
      header: <SectionHeader label="Keys & Macros" />,
      children: (
        <div className="pz2-pair">
          <div className="ds-feature-card pz2-card">
            <div className="ds-feature-card-header">
              <div className="ds-feature-card-title">Macros</div>
              <CardDoor verb="manage" />
            </div>
            <Facts
              items={[
                { label: 'Push-to-talk', value: 'F13' },
                { label: 'Discord mute', value: 'Mouse 4' },
                { label: 'Clip last 30s', value: 'Ctrl + Shift + C' },
                { label: 'Loot filter', value: 'F14' },
              ]}
            />
          </div>
        </div>
      ),
    },
    // ── APP ────────────────────────────────────────────────────────────────
    // Modules deliberately absent: installing/removing features can make a whole
    // page disappear, so the module browser stays global (Chris's top-right
    // entry) instead of being duplicated inside a page.
    //
    // ⚠️ OPEN — this family now contradicts a shipped ruling. Main (21a75ca)
    // moved theme/accent/wallpaper into the Settings modal on the grounds that
    // "app appearance belongs in app settings", left Personalize desk-only, and
    // deleted the WallpaperPicker widget outright. The picker is gone from here
    // because it no longer exists; whether "App" survives as one of the five
    // families is a decision, not a merge conflict, and it is the owner's.
    {
      id: 'app',
      header: <SectionHeader label="App" />,
      children: (
        <div className="pz2-app-grid">
          <AppearanceWidget />
        </div>
      ),
    },
  ];

  return (
    <div className="pz2-root">
      <h1 className="ds-text-title-1 page-title">Personalize</h1>
      <p className="ds-text-body page-sub">Make it yours.</p>
      <ReorderableSections sections={sections} storageKey="personalize-v2-sections-r2" />
    </div>
  );
}

import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './device-canvas.css';
import './keyboard-canvas.css';
import './laptop-canvas.css';
import {
  Icon,
  type IconName,
  ListItem,
  Ng3Col,
  Ng3Grid,
  Ng3Label,
  Ng3Panel,
  Ng3Section,
  Ng3Tool,
  Toggle,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile } from './skus';
import { pcDeviceTabs } from './deviceTabs';
import {
  ProfileBar,
  ProfileActions,
  ProfileScopeBody,
  useDeviceProfileBar,
  useProfileValue,
} from './ProfileBar';
import { KeyboardHero, type QuickSelectItem } from './KeyboardHero';
import { LaptopLightsTab, LaptopLightingSettings } from './LaptopLights';
import { LightingGear } from './LightingGear';
import { LaptopPreview, VALORANT_DECK } from './LaptopPreview';
import {
  capsOf,
  codesOfZones,
  defaultLighting,
  keyZone,
  normalizeLighting,
  paintKeyboard,
  quickSelectFor,
  zoneColor,
  zonesOf,
  type PartId,
  type PcLighting,
  quickSelectCodes,
} from './pcLighting';
import type { LaptopPose, LaptopStageState } from './stage/laptopScene';
import type { LaptopMachine, LaptopPaint } from './stage/laptopModel';
import { macroKeyCodes } from './stage/keyboardGeometry';
import { MacroPanel } from './MacroPanel';
import { hasFanCleaner, macroKeyCount } from './pcDirectory';
import { type KeyBinds } from './keyboardLayout';
import { Gauge } from '../widgets/Gauge';
import { FAN_CLEANER } from '../widgets/perform6/CleanerCard';
import { VITALS } from '../widgets/perform5/vitalsData';
import { closeDevicePanel } from '../app/devicePanelRequest';
import { POWER_MODE_LABEL, usePowerModeEvent } from '../state/powerMode';
import { useSettings } from '../state/Settings';
import { toUnit } from '../state/units';

/**
 * Full-canvas notebook device modal — the OMEN 16, built on the same shell as
 * `KeyboardCanvas` (`.dc-canvas` hero over a bottom `Ng3Panel`) because a
 * laptop IS a keyboard plus a computer, and the two tabs it shares with the
 * standalone board are the same two controls.
 *
 * What differs is the hardware, in one way that matters: the OMEN 16's
 * keyboard is FOUR-ZONE RGB, not per-key. So there the hero's lighting rail
 * carries zones (`notebookZones.ts`) instead of key groups, the marquee tool is
 * withheld, and clicking any cap selects its whole band. A per-key machine
 * (the OMEN Max 16; `capsOf`) keeps the standalone board's editing: a click
 * picks one key, the marquee a box of them, the rail its key groups, and the
 * drawn board stands in on the PC page too, since the 3D keys take no clicks
 * (Chris, 2026-10-21: lighting follows NGENUITY, per-key stays). Remapping is
 * per-key on both — a zone is a lighting fact, not a binding one — so the Keys
 * & Macros tab is the keyboard's, unchanged.
 *
 * The Performance tab is a glance, not a second control surface: the real work
 * lives on the Performance page, and the tab's job is to show the machine's
 * state and hand you over.
 *
 * This is This PC's page, with the tabs the directory's rows are
 * (pcDeviceTabs): Performance · Lighting · Macro. Lighting is the laptop's
 * lighting in the peripherals' layout (LaptopLightsTab); Macro is the four
 * macro keys (MacroPanel), and nothing else — the whole-keyboard remap of
 * Keys & Macros is not on this page. Settings is not a tab: the This PC
 * button in My Devices holds the machine's facts and its device card.
 *
 * The page's hero is the 3D machine alone (stage/): no drawn board over it
 * and no photo beside it (JY, 2026-10-21). On Lighting the scene shows two of
 * the machine, one open and one turned to show its lid, so every lit part is
 * in view; the camera moves in on the part being edited. The zones are picked
 * in the Lighting panel's zone column and drawn as a rim on the 3D keys.
 */

// Handed to the hero in place of zoneColors while the lighting master power is
// off — the painted state is kept, the board just renders unlit.
const UNLIT = new Map<string, string>();
const NO_BINDS: Record<string, KeyBinds> = {};
const NOOP = () => {};

const DEFAULT_LIGHTING = defaultLighting();

// The 3D notebook comes with three.js; the page shows its photo until it lands.
const LaptopStage = lazy(() => import('./stage/LaptopStage'));

/** A CPU/GPU gauge with its temperature badge — the vitals widget's cell, in a tab. */
function VitalCell({ load, label, tempC }: { load: number; label: string; tempC: number }) {
  const { tempUnit } = useSettings();
  return (
    <div className="lc-vital">
      <Gauge value={load} />
      <div className="vital-label">{label}</div>
      <div className={'gauge-temp-badge ' + (tempC >= 80 ? 'orange' : 'green')}>
        {toUnit(tempC, tempUnit)}°{tempUnit}
      </div>
    </div>
  );
}

/**
 * A door from the PC's window to a card of the Performance page. The window
 * is a room for looking, the page is where the work happens, so the door
 * leaves: it puts the My Devices panel away (the shell closes it on request),
 * and the address it navigates to carries no `?sku=`, so this window closes
 * with it. The page then lights the card (`?spot=`, the Spotlight).
 */
function PerformDoor({ spot, icon, label, reading, testId, inline, title }: { spot: string; icon: IconName; label: string; reading?: string; testId?: string; inline?: boolean; title?: string }) {
  const navigate = useNavigate();
  const go = () => {
    closeDevicePanel();
    navigate({ pathname: '/perform', search: `?spot=${spot}` });
  };
  return (
    <ListItem
      role="listitem"
      className={inline ? 'lc-door lc-door-inline' : 'lc-door'}
      aria-label={title}
      data-testid={testId}
      data-spot={spot}
      label={label}
      description={reading}
      leading={<Icon name={icon} size={16} aria-hidden />}
      trailing={<Icon name="chevron-right" size={12} />}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
    />
  );
}

/**
 * The PC page's Performance tab, both machines (the desktop passes the silicon
 * from its parts; a notebook reads its own record): System Vitals, and doors to
 * the Performance page's cards that this machine has — Power Mode and, where it
 * has one, the Fan Cleaner (`hasFanCleaner`), each with its reading. The tab
 * shows and links; it changes nothing (framework deck, Two sides: shown in two
 * places, edited in one). Under June 2027 the page has neither card, so only
 * the System Vitals door remains.
 */
export function PerformanceTab({ sku, specs }: { sku: ResolvedSku; specs?: { label: string; value: string }[] }) {
  const f = sku.features;
  const { mvpScope } = useSettings();
  const [modeEvent] = usePowerModeEvent();
  const june = mvpScope === 'june27';
  const fanCleaner = hasFanCleaner(sku, mvpScope);
  return (
    <Ng3Grid className="lc-perf">
      <Ng3Col className="lc-perf-col">
        <Ng3Section>
          {/* The door to the page's System Vitals card sits on the label's line:
              the gauges and the silicon list fill the column, and a row under
              them fell below the panel on a notebook whose processor wraps. */}
          <div className="lc-perf-head">
            <Ng3Label strong>System Vitals</Ng3Label>
            <div role="list" aria-label="System Vitals on the Performance page">
              <PerformDoor inline spot="vitals" icon="heartbeat" label="Details" title="System Vitals on the Performance page" testId="vitals-door" />
            </div>
          </div>
          <div className="lc-vitals">
            <VitalCell load={VITALS.cpu.load} label="CPU" tempC={VITALS.cpu.tempC} />
            <VitalCell load={VITALS.gpu.load} label="GPU" tempC={VITALS.gpu.tempC} />
            <div className="lc-vital">
              <Gauge value={VITALS.ram.load} />
              <div className="vital-label">RAM</div>
              <div className="gauge-temp-badge ram">{VITALS.ram.label}</div>
            </div>
          </div>
          {/* The silicon by name, so the gauges above are about THIS machine
              rather than a generic PC. Read from the SKU, never retyped. */}
          <dl className="lc-spec">
            {specs ? specs.map((s) => (
              <div key={s.label} className="lc-spec-row">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            )) : <>
            {typeof f.cpu === 'string' && (
              <div className="lc-spec-row">
                <dt>Processor</dt>
                <dd>{f.cpu}</dd>
              </div>
            )}
            {typeof f.gpu === 'string' && (
              <div className="lc-spec-row">
                <dt>Graphics</dt>
                <dd>{f.gpu}</dd>
              </div>
            )}
            {typeof f.memory === 'string' && (
              <div className="lc-spec-row">
                <dt>Memory</dt>
                <dd>{f.memory}</dd>
              </div>
            )}
            </>}
          </dl>
        </Ng3Section>
      </Ng3Col>

      {!june && (
        <Ng3Section className="lc-perf-side">
          <p className="lc-perf-desc lc-perf-lead">Shown here, changed on the Performance page.</p>
          <div className="lc-doors" role="list" aria-label="Performance page cards">
            <PerformDoor spot="power-mode" icon="performance" label="Power Mode" reading={POWER_MODE_LABEL[modeEvent.mode]} testId="power-mode-door" />
            {fanCleaner && (
              // The card's own words (CleanerCard), shown here and changed there.
              <PerformDoor spot="fan-cleaner" icon="breeze" label="Fan Cleaner" reading={`${FAN_CLEANER.label} · last cleaned ${FAN_CLEANER.lastCleaned}`} testId="fan-cleaner-line" />
            )}
          </div>
        </Ng3Section>
      )}
    </Ng3Grid>
  );
}

/**
 * The Macro tab: the dedicated macro keys and nothing else
 * (keys-macros.7). The first line says how many keys take a macro, so no one
 * reads this as remapping the keyboard; the editor is the one every door to
 * macros opens (keys-macros.22).
 */
function MacroTab({ keys }: { keys: number }) {
  return (
    <div className="lc-macro" data-testid="macro-tab">
      <p className="lc-macro-note" role="note">
        <Icon name="keys" size={16} aria-hidden />
        <span>
          This notebook has <b>{keys} macro keys, P1 to P{keys}</b>. Only these take a macro; the other keys are not remapped here.
        </span>
      </p>
      <MacroPanel />
    </div>
  );
}

export function LaptopCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const profile = useDeviceProfileBar(sku);
  // This is This PC's page, which follows the scope like the desktop's.
  const { mvpScope } = useSettings();
  const macroKeys = macroKeyCount(sku);
  // What the 3D model's keyboard has, from the SKU's record.
  const machine = useMemo<LaptopMachine>(() => ({ numpad: sku.features.keyboard?.numpad !== false, macroKeys }), [sku, macroKeys]);
  const TABS = pcDeviceTabs(sku, mvpScope, []);
  const [tabId, setTabId] = useState(
    initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : TABS[0].id,
  );
  const active = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const heroSrc = deviceImageUrl(heroImageFile(sku));

  const [lightsOn, setLightsOn] = useProfileValue(profile, 'lighting.power', true);
  // The lighting zones picked (keyboard bands, the bar's, the logo's) — the
  // Lighting panel's zone column, the drawn board's rail and its caps all set
  // this one set; the keys it covers are drawn selected.
  const [zoneSel, setZoneSel] = useState<Set<string>>(new Set());
  // The laptop's own lighting: one value holds the mode, the preset and each
  // lit part (pcLighting.ts). What the machine has comes from its data.
  const caps = useMemo(() => capsOf(sku.features), [sku]);
  const perKey = caps.keyboard === 'per-key';
  // The marquee tool, per-key boards only: armed until dismissed.
  const [marquee, setMarquee] = useState(false);
  const [lightingRaw, setLighting] = useProfileValue<PcLighting>(profile, 'lighting.pc', DEFAULT_LIGHTING);
  const lighting = useMemo(() => normalizeLighting(lightingRaw), [lightingRaw]);
  const litSel = useMemo(() => codesOfZones(caps.keyboard, zoneSel), [caps.keyboard, zoneSel]);
  const kbZones = useMemo(() => zonesOf('keyboard', caps), [caps]);
  const quickSelect = useMemo(() => quickSelectFor(caps.keyboard), [caps.keyboard]);
  const activeQs = perKey
    ? zoneSel.has('all')
      ? 'all'
      : quickSelect.find((q) => {
          if (q.id === 'all') return false;
          const codes = quickSelectCodes('per-key', q.id);
          return codes.length === zoneSel.size && codes.every((c) => zoneSel.has(c));
        })?.id ?? ''
    : kbZones.length && kbZones.every((z) => zoneSel.has(z)) && zoneSel.size === kbZones.length
      ? 'all'
      : zoneSel.size === 1 && kbZones.includes([...zoneSel][0])
        ? [...zoneSel][0]
        : '';
  const paint = useMemo(() => paintKeyboard(lighting, caps), [lighting, caps]);
  const keyColors = paint.colors;
  const heroGlow = paint.glow;
  // Remaps are made in the keyboard's own window; the legends the board wears
  // follow them, but this page does not edit them.
  const [bindsRec] = useProfileValue<Record<string, KeyBinds>>(profile, 'keys.binds', NO_BINDS);
  const binds = useMemo(() => new Map(Object.entries(bindsRec)), [bindsRec]);

  // The 3D hero's camera follows the tab, and on Lighting the part being
  // edited. On the PC page: Preset shows the pair (both machines, every lit
  // part), Keyboard looks down at the board, Logo at the back machine's lid,
  // the light bar low at the front; Macro looks down at the macro keys'
  // column.
  const [litPart, setLitPart] = useState<PartId | null>(null);
  const pose: LaptopPose =
    active.id === 'vitals'
      ? 'front'
      : active.id === 'settings'
        ? 'side'
        : active.id === 'macros'
          ? 'macro'
          : active.id === 'lighting' && litPart === 'logo'
            ? 'logo'
            : active.id === 'lighting' && litPart === 'bar'
              ? 'bar'
              : active.id === 'lighting' && litPart === null && !perKey
                ? 'pair'
                : 'keyboard';
  const [stage, setStage] = useState<LaptopStageState | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  // What the 3D keys wear, and which are picked: the lighting zone being
  // edited, or the macro keys on the Macro tab.
  const selectedKeys = useMemo<ReadonlySet<string> | undefined>(() => {
    if (active.id === 'macros') return new Set(macroKeyCodes(macroKeys));
    if (active.id === 'lighting') return litSel;
    return undefined;
  }, [active.id, litSel, macroKeys]);
  const stagePaint = useMemo<LaptopPaint>(() => {
    const zoneColors = (part: PartId) => {
      const zones = zonesOf(part, caps);
      return zones.map((z, i) => (lightsOn ? zoneColor(lighting, caps, part, z, i, zones.length) : null));
    };
    return { keys: lightsOn ? keyColors : UNLIT, bar: zoneColors('bar'), logo: zoneColors('logo'), selected: selectedKeys };
  }, [caps, lighting, lightsOn, keyColors, selectedKeys]);
  // The page draws no board: its keys are the 3D machine's. A per-key board
  // draws itself on the Lighting tab, though: its keys are picked one by one,
  // and the 3D keys take no clicks. It shows when the camera has landed on
  // the keyboard — or whenever there is no 3D hero to land.
  const boardTab = perKey && active.id === 'lighting';
  const boardHere = boardTab && (!stage || (pose === 'keyboard' && stage.pose === 'keyboard' && stage.arrived));

  // A click on a key picks what the keyboard's type can light: its whole band
  // on 4 zones, the whole board on one zone (lighting.24), that one key on a
  // per-key board — where picking a key also lets go of the whole board.
  const onKey = (code: string) => {
    const zone = keyZone(caps.keyboard, code);
    if (!zone) return;
    setZoneSel((prev) => {
      const next = new Set(perKey ? [...prev].filter((z) => z !== 'all') : prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  };

  const onQuickSelect = (id: string) => {
    if (id === 'reset') setZoneSel(new Set());
    else if (id === 'all') setZoneSel(perKey ? new Set(['all']) : new Set(kbZones));
    else setZoneSel(perKey ? new Set(quickSelectCodes('per-key', id)) : new Set([id]));
  };
  // A dragged box replaces the picked keys; Shift adds to them (the standalone board's rule).
  const onMarqueeSelect = (codes: string[], additive: boolean) => {
    setZoneSel((prev) => new Set([...(additive ? [...prev].filter((z) => z !== 'all') : []), ...codes]));
  };

  const photoTab = !boardTab;
  const photo = heroSrc && <img className="lc-hero-img" src={heroSrc} alt={sku.name} />;

  return (
    <div className="dc-canvas kbd-canvas lc-canvas pc-canvas" role="dialog" aria-label={sku.name}>
      <div className="dc-status">
        <div className="dc-chip">
          <span className={'dc-chip-dot' + (profile.connected ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
          <span className="dc-chip-val">
            {profile.connected ? 'Connected · This PC' : 'Disconnected'}
          </span>
        </div>
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      {/* Hero — the 3D notebook (stage/), its camera on a shot per tab; on the
          tabs about the keys the drawn board takes over once the camera has
          landed on the 3D one. The photo stands in until three.js arrives, or
          for good where the browser has no 3D. */}
      <div
        ref={heroRef}
        className="dc-hero kbd-hero lc-hero"
        data-stage={stage ? 'on' : undefined}
        data-board={boardHere ? 'here' : 'away'}
      >
        <Suspense fallback={null}>
          <LaptopStage caps={caps} machine={machine} paint={stagePaint} pose={pose} onState={setStage} />
        </Suspense>
        {photoTab ? (
          !stage && photo
        ) : (
          <>
            {lightsOn && heroGlow && (
              <span
                className="kbd-hero-glow"
                style={{ ['--glow' as string]: `rgba(${heroGlow},0.55)` } as React.CSSProperties}
                aria-hidden="true"
              />
            )}
            {/* Beside the drawn board: the machine's picture and its dots, or
                the dots alone once the 3D machine is behind the board. */}
            {heroSrc && (
              <LaptopPreview
                src={heroSrc}
                alt={sku.name}
                caps={caps}
                value={lighting}
                power={lightsOn}
                deck={sku.id === 'hx-omen-16-valorant' ? VALORANT_DECK : undefined}
                photo={!stage}
              />
            )}
            <KeyboardHero
              mode="lights"
              layer="base"
              onLayer={NOOP}
              selected={null}
              litSel={litSel}
              keyColors={lightsOn ? keyColors : UNLIT}
              binds={binds}
              activeQs={activeQs}
              marquee={perKey && marquee}
              onMarquee={() => setMarquee((m) => !m)}
              onMarqueeSelect={onMarqueeSelect}
              onKey={onKey}
              onQuickSelect={onQuickSelect}
              quickSelect={quickSelect}
              marqueeTool={perKey}
              knob={false}
            />
          </>
        )}
      </div>

      <div className="dc-panel-wrap kbd-panel-wrap">
        <Ng3Panel
          leading={<ProfileBar state={profile} />}
          trailing={<ProfileActions state={profile} />}
          width={active.width}
          header={active.title}
          headerExtra={
            active.id === 'lighting' ? (
              <Toggle checked={lightsOn} onChange={setLightsOn} aria-label="Lighting power" />
            ) : undefined
          }
          tools={TABS.map((t) => (
            <Ng3Tool
              key={t.id}
              icon={t.icon}
              title={t.title}
              active={t.id === active.id}
              onClick={() => {
                if (t.id !== active.id) setLitPart(null);
                setTabId(t.id);
              }}
            />
          ))}
          actions={
            <>
              {/* The Lighting tab's settings live behind this gear, not in the zone column. */}
              {active.id === 'lighting' && (
                <LightingGear>
                  <LaptopLightingSettings
                    caps={caps}
                    value={lighting}
                    onChange={setLighting}
                    power={lightsOn}
                    onPower={setLightsOn}
                    onReset={() => setZoneSel(new Set())}
                  />
                </LightingGear>
              )}
              <button type="button" className="ds-ng3-action" aria-label="Duplicate profile">
                <Icon name="duplicate" />
              </button>
            </>
          }
          bare
        >
          <ProfileScopeBody state={profile}>
            {active.id === 'vitals' ? (
              <PerformanceTab sku={sku} />
            ) : active.id === 'macros' ? (
              <MacroTab keys={macroKeys} />
            ) : active.id === 'lighting' ? (
              <LaptopLightsTab
                key={profile.revision}
                caps={caps}
                value={lighting}
                onChange={setLighting}
                selection={zoneSel}
                onSelection={setZoneSel}
                brightness={profile.value('lighting.brightness', 100)}
                onBrightness={(v) => profile.setValue('lighting.brightness', v)}
                onPartChange={setLitPart}
              />
            ) : null}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}

import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import './device-canvas.css';
import './laptop-canvas.css';
import { Icon, Ng3Panel, Ng3Tool } from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile } from './skus';
import { pcDeviceTabs } from './deviceTabs';
import { PerformanceTab } from './LaptopCanvas';
import { CapActions, CapApplyBar, CapChips, CapHero, CapScreenSwitch, CoolerCapTab, capScreenLook, useCapSession, type CapView } from './CoolerCapCanvas';
import { PsuEditor, PsuViewSwitch, type PsuView } from './PsuCanvas';
import { aboutFacts, partsOf } from './pcDirectory';
import { useSettings } from '../state/Settings';
import { usePersonalize } from '../pages/personalize/state';
import { ChassisLightsSettings, ChassisLightsSwitch, ChassisLightsTab } from '../lightstudio/ChassisLights';
import { LightingGear } from './LightingGear';
import type { ChassisZoneId } from '../lightstudio/towerZones';
import type { ViewInsets } from '../lightstudio/scene';
import { desktopShot } from './stage/desktopShots';
import './desktop-canvas.css';

// The 3D tower is the hero on every tab, and the camera moves to a shot per
// tab (stage/desktopShots.ts). three.js comes with it; the photo holds the
// hero until it lands.
const LightStudio = lazy(() => import('../lightstudio/LightStudio').then((m) => ({ default: m.LightStudio })));

/**
 * This PC's page for a desktop (JW 1:1, 2026-10-19): the tower as a device like the mouse or the mic, built on the
 * same shell as the notebook's page (`LaptopCanvas`) — the 3D tower over a
 * bottom `Ng3Panel`, every tab's panel one height (`.pc-canvas`).
 *
 * Tabs come from `pcDeviceTabs`: Performance · LCD cooler cap · Chassis
 * lighting (the user's arrangement, 2026-10-21). Performance is the glance
 * the notebook has — the readings, the Fan Cleaner line where it applies, and
 * a door to the Performance page — so the page holds no second set of
 * performance controls. LCD cooler cap is the cap's one home: Display, Power
 * On and Settings switched at the title row's right end, the cap's preview
 * over the hero beside the tower (CoolerCapCanvas). Chassis lighting is the PC's lights zone by zone in
 * the peripherals' layout (ChassisLightsTab), the same editor and the same
 * desk lighting as Light Studio's "Set zones"; the camera follows the part
 * being edited. Power supply is the supply's window in one panel (PsuEditor,
 * built to the OMEN-PSU Figma page). Settings is not a tab: the This PC
 * button in My Devices holds the machine's facts and its device card
 * (AboutPcModal).
 *
 * Doors from elsewhere name the tab (`tab=`): Personalize's Cooler cap line
 * opens `cooler-cap`, and so does the cap's own address (`?sku=<cap>`, on the
 * view its `tab=` named, as `cap=`): the tab is the cap's one place (JY,
 * 2026-10-22). System Vitals' Power supply tab opens `psu`, on the Fan view
 * when the door says `psu=fan` (JY, 2026-10-22).
 *
 * Every door to the tower's lights opens this page at Chassis lighting; the
 * lights alone, without the other tabs, went with the cancelled option A
 * (JY, 2026-10-22).
 *
 * Two layouts (the Simulator's PC layout row, `pcLayout`). Stacked, today's
 * and the default: the tower above the panel. Full-screen, a trial from the
 * 2026-10-22 design review (the lit tower competed with the part being
 * edited): the tower fills the window and the panel, and on the cooler cap tab
 * the cap's preview, float over it as cards (`pc-canvas--full`,
 * desktop-canvas.css). The camera then frames the tower in what the cards
 * leave uncovered (`useUncovered`), and a tab about one part dims the rest of
 * the tower's lights (`dimSubject`) until the pill over the 3D says not to.
 */
export function DesktopCanvas({
  sku,
  onClose,
  initialTab,
  initialZone,
  initialPsuView,
  initialCapView,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
  /** The part the lights open on (`zone=` in the address). */
  initialZone?: ChassisZoneId;
  /** The view the Power supply tab opens on (`psu=fan` in the address). */
  initialPsuView?: PsuView;
  /** The view the LCD cooler cap tab opens on (`cap=boot`, `cap=settings`). */
  initialCapView?: CapView;
}) {
  const { mvpScope, tempUnit, pcLayout, pcDimRest, setPcDimRest } = useSettings();
  const full = pcLayout === 'full';
  const parts = partsOf(sku.id, mvpScope);
  const tabs = pcDeviceTabs(
    sku,
    mvpScope,
    parts.map((p) => p.type),
  );
  const [tabId, setTabId] = useState(initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const heroSrc = deviceImageUrl(heroImageFile(sku));
  const facts = aboutFacts(sku, mvpScope);
  const silicon = facts.filter((f) => f.label === 'Processor' || f.label === 'Graphics' || f.label === 'Memory');
  const cap = parts.find((p) => p.type === 'desktop-cooler-cap');
  const psu = parts.find((p) => p.type === 'desktop-psu');
  const psuW = typeof psu?.features.wattage === 'number' ? psu.features.wattage : 1000;
  // The supply's Status or Fan, switched at the right end of the title row.
  const [psuView, setPsuView] = useState<PsuView>(initialPsuView ?? 'status');
  const p = usePersonalize();
  const lights = active.id === 'lighting';
  // On Chassis lighting the camera follows the part being edited (memory, graphics card).
  const [litPart, setLitPart] = useState<ChassisZoneId | null>(null);
  const shot = desktopShot(active.id, lights ? litPart : null);
  // The cap's editing, shared by its tab and its preview over the hero.
  const capS = useCapSession(cap, initialCapView);
  const capTab = active.id === 'cooler-cap' && !!cap;
  // The cap's screen on the 3D tower, for illustration (the model has none):
  // what the preview shows, on every tab. JY, 2026-10-22.
  const capScreen = cap
    ? capScreenLook(capS.shown, {
        phase: capS.phase,
        event: capS.event,
        artKey: capS.artKey,
        unit: tempUnit,
        boot: capS.phase === 'booting' || (capS.phase === 'awake' && capTab && capS.view === 'boot'),
      })
    : null;

  // Full-screen: on a tab about one part, the rest of the tower's lights dim
  // (the pill over the 3D turns it off). `subject` is the zones that stay lit.
  const subject = dimSubject(active.id, capTab, lights ? litPart : null);
  const dimExcept = full && pcDimRest ? subject : null;
  // Full-screen: where the cards end, for the camera.
  const heroRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const insets = useUncovered(full, capTab, heroRef, statusRef, panelRef);

  return (
    <div className={'dc-canvas lc-canvas pc-canvas' + (full ? ' pc-canvas--full' : '')} role="dialog" aria-label={sku.name}>
      <div className="dc-status" ref={statusRef}>
        <div className="dc-chip">
          <span className="dc-chip-dot dc-chip-dot-on" aria-hidden="true" />
          <span className="dc-chip-val">Connected · This PC</span>
        </div>
        {capTab && <CapChips s={capS} />}
      </div>

      {full && (
        // Under the status chips. It stays on every tab, so its state is always
        // in view; a tab with no one part (an overview) leaves the lights as they are.
        <button
          type="button"
          className="dc-chip pc-dim"
          aria-pressed={pcDimRest}
          title="Dim every light but the part this tab is about"
          onClick={() => setPcDimRest(!pcDimRest)}
        >
          <span className="dc-chip-dot pc-dim-dot" aria-hidden="true" />
          <span className="dc-chip-val">Dim the rest</span>
        </button>
      )}

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      {/* data-dim (full-screen only): on / off — dimming the rest, or not — and none on a tab with no one part. */}
      <div className="dc-hero dk-hero-3d" ref={heroRef} data-dim={full ? (subject ? (pcDimRest ? 'on' : 'off') : 'none') : undefined}>
        <Suspense fallback={heroSrc ? <img src={heroSrc} alt={sku.name} /> : null}>
          <LightStudio focus="tower" shot={shot} frameInsets={insets} dimExcept={dimExcept} states={p.desk.lighting} onStatesChange={p.replaceLighting} capScreen={capScreen} />
        </Suspense>
        {/* The cap as it is, or the edit not yet sent, beside the tower. */}
        {capTab && <CapHero s={capS} />}
      </div>

      <div className="dc-panel-wrap" ref={panelRef}>
        <Ng3Panel
          width={active.width}
          header={active.title}
          headerExtra={
            lights ? (
              <ChassisLightsSwitch tower={p.desk.lighting.tower} onChange={(patch) => p.setLighting(['tower'], patch)} />
            ) : capTab ? (
              <CapScreenSwitch s={capS} />
            ) : undefined
          }
          // The right end of the title row, where the panel keeps its actions.
          actions={
            active.id === 'psu' ? (
              <PsuViewSwitch view={psuView} onView={setPsuView} />
            ) : lights ? (
              // The same gear the notebook's Lighting tab has; the reset lives behind it.
              <LightingGear>
                <ChassisLightsSettings onChange={(patch) => p.setLighting(['tower'], patch)} />
              </LightingGear>
            ) : capTab ? (
              <CapActions s={capS} />
            ) : undefined
          }
          trailing={capTab && capS.applyPending ? <CapApplyBar s={capS} /> : undefined}
          tools={tabs.map((t) => (
            <Ng3Tool
              key={t.id}
              icon={t.icon}
              title={t.title}
              active={t.id === active.id}
              onClick={() => {
                if (t.id !== active.id) setLitPart(null);
                // Leaving the cap's tab cancels its open edits, as closing its window did.
                if (t.id !== active.id && active.id === 'cooler-cap') capS.reset();
                setTabId(t.id);
              }}
            />
          ))}
          bare
        >
          {active.id === 'vitals' ? (
            <PerformanceTab sku={sku} specs={silicon} />
          ) : active.id === 'lighting' ? (
            <ChassisLightsTab tower={p.desk.lighting.tower} onChange={(patch) => p.setLighting(['tower'], patch)} onPartChange={setLitPart} initialPart={initialZone} resetInColumn={false} />
          ) : active.id === 'psu' ? (
            <PsuEditor capacityW={psuW} view={psuView} onView={setPsuView} />
          ) : cap ? (
            <CoolerCapTab s={capS} />
          ) : null}
        </Ng3Panel>
      </div>
    </div>
  );
}

/**
 * The part a tab is about, as the zones of the tower that stay lit while the
 * rest of its lights dim (full-screen layout); null where the tab has no one
 * part and the tower shows off its lights. The cooler cap tab is about the
 * cap's screen, which is a light of its own and not one of the zones, so none
 * stays lit; Chassis lighting is about the part being edited, and about no
 * part while several or all are; the model has no power supply, so on that tab
 * every light dims; Performance is an overview.
 */
function dimSubject(tab: string, capTab: boolean, part: ChassisZoneId | null): ChassisZoneId[] | null {
  if (capTab) return [];
  if (tab === 'psu') return [];
  if (tab === 'lighting' && part) return [part];
  return null;
}

/** Room kept between the tower and a card over the 3D, in px. */
const CARD_GAP = 12;

/**
 * Full-screen layout: how much of the 3D the floating cards cover, for the
 * camera to frame the tower in what is left (LightStudio's `frameInsets`).
 * The top is the status chips' row (the nav is above it), the bottom the
 * panel, the right the cap's preview when its tab shows it. Measured, not
 * assumed from the CSS: the panel gives way on a short window, the preview
 * sizes to the room above it, the chips wrap on a narrow one. Null when the
 * layout is stacked, where the 3D is a box of its own and nothing covers it.
 */
function useUncovered(
  on: boolean,
  capTab: boolean,
  hero: RefObject<HTMLElement | null>,
  status: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
): ViewInsets | null {
  const [insets, setInsets] = useState<ViewInsets | null>(null);
  useEffect(() => {
    const box = hero.current;
    const chips = status.current;
    const wrap = panel.current;
    if (!on || !box || !chips || !wrap) {
      setInsets(null);
      return;
    }
    const card = capTab ? box.querySelector<HTMLElement>('.cap-hero') : null;
    const measure = () => {
      const b = box.getBoundingClientRect();
      const next: ViewInsets = {
        top: Math.round(chips.getBoundingClientRect().bottom - b.top + CARD_GAP),
        right: card ? Math.round(b.right - card.getBoundingClientRect().left + CARD_GAP) : 0,
        bottom: Math.round(b.bottom - wrap.getBoundingClientRect().top + CARD_GAP),
        left: 0,
      };
      setInsets((was) => (was && was.top === next.top && was.right === next.right && was.bottom === next.bottom ? was : next));
    };
    const ro = new ResizeObserver(measure);
    [box, chips, wrap, card].forEach((el) => el && ro.observe(el));
    measure();
    return () => ro.disconnect();
  }, [on, capTab, hero, status, panel]);
  return on ? insets : null;
}

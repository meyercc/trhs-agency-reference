import { useEffect, useRef, useState } from 'react';
import { Backdrop, ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { type Era, type Laptop } from '../widgets/perform4/MatrixRig';
import { UnleashModal } from '../widgets/perform7/UnleashModal';
import { PowerModeCard } from '../widgets/perform5/PowerModeCard';
import { ShowcaseRig, type Scope } from '../widgets/perform5/ShowcaseRig';
import { NetworkBoosterCard, type NbMode } from '../widgets/perform5/NetworkBoosterCard';
import { NetworkBoosterModal } from '../widgets/perform7/NetworkBoosterModal';
import { BoosterCard } from '../widgets/perform5/BoosterCard';
import { BoosterModal } from '../widgets/perform7/BoosterModal';
import { OmenAiCard } from '../widgets/perform5/OmenAiCard';
import { OmenAiModal } from '../widgets/perform7/OmenAiModal';
import { CleanerCard } from '../widgets/perform5/CleanerCard';
import { CleanProgressDialog } from '../widgets/perform5/CleanProgressDialog';
import { CleanerSchedulerModal } from '../widgets/perform7/CleanerSchedulerModal';
import { TopProcessesCard } from '../widgets/perform5/TopProcessesCard';
import { SystemVitalsModal } from '../widgets/perform7/SystemVitalsModal';
import { VitalsReadout } from '../widgets/perform5/VitalsReadout';
import { CardDoor } from '../widgets/perform5/CardKit';
import { TypologyTag } from '../widgets/perform5/TypologyTag';
import { arbitrateManualOverride, type ModeChangeEvent, type PowerMode } from '../widgets/perform3/machine';
import './pages.css';
import './perform-v3.css';
import './perform-v4.css';
import './perform-v5.css';
import './perform-v7.css';

// ── PerformV5 (#/perform-v5) — framework-showcase variant ──
// An ISOLATED, clearly-labelled PROPOSAL. Three posture domains only:
// Monitoring / Performance / Maintenance.
// Performance layout: Power Mode owns a FULL row (the P4 anchor); below it a
// half/half row — Network Booster (1/2) + OMEN AI (1/2). Optimization lives
// UNDER OMEN AI. Two OMEN AI eras:
//   · 1.0 (quiz): OMEN AI is a per-game optimizer (card = state + Per-game
//     settings door → OmenAiModal). Its only Power-Mode coupling is the
//     enable-time override: turning it on bumps Eco/Balanced → Performance and
//     signs the envelope ("Set by OMEN AI" governance chip). Grade-1 signature.
//   · 2.0: the sign hardens to a managed STATE (chip + inert controls); Network
//     Booster is HIDDEN (may move under the AI later — TBD).
// Power Mode = V5-local PowerModeCard (form0 copy of EnvelopeCard, sub controls
// grow from under the mode row); governance is a V5-level chip.

const AI_DEMO_EVENT: ModeChangeEvent = { mode: 'performance', source: 'omen_ai', game: 'Cyberpunk 2077' };

export interface PerformV7Props {
  /**
   * Show the Simulator rig. True on the `/perform-v7` exploration route, where
   * the axes (laptop · scope · enablement · session) have to be reachable to be
   * reviewed. False on the promoted `/perform` page, which is one fixed state:
   * scope 1.0, HyperX machine, OMEN AI enabled, no game running.
   *
   * A prop rather than a copy — the promoted page and the prototype are the
   * same page, and a fork would drift the moment either is touched.
   */
  showcase?: boolean;
}

export function PerformV7({ showcase = true }: PerformV7Props = {}) {
  const [laptop, setLaptop] = useState<Laptop>('hp');
  // Page scope, three values (8/6): 0.0 = MVP hardware enablement, the whole
  // optimizer family absent — no OMEN AI, no Booster, no Network Booster;
  // 1.0 / 2.0 = the existing eras, byte-for-byte the same page as before.
  const [scope, setScope] = useState<Scope>('v1');
  const era: Era = scope === 'v2' ? 'v2' : 'v1';
  // The optimizer family exists at 1.0/2.0; at 0.0 the page is Power Mode,
  // Vitals, Top Processes and Maintenance — the set-and-forget page.
  const optimizers = scope !== 'v0';
  // OMEN AI enablement. The REAL on/off will live in the Settings modal
  // (pending Chris); the Simulator's Enablement toggle is prototype scaffolding
  // so both states are reachable and reviewable.
  const [aiOn, setAiOn] = useState(true);
  const [current, setCurrent] = useState<ModeChangeEvent>(AI_DEMO_EVENT);
  const [tuningOpen, setTuningOpen] = useState(false);
  const [netboostOpen, setNetboostOpen] = useState(false);
  const [nbMode, setNbMode] = useState<NbMode>('auto');
  // Booster: armed = the trigger toggle (Manage modal).
  const [boosterOpen, setBoosterOpen] = useState(false);
  const [boosterArmed, setBoosterArmed] = useState(true);
  // The shared trigger for the optimizer family (NB / Booster / OMEN AI):
  // a game session. DEFAULT OFF — the resting state is Idle, not working
  // (Juntao 2026-07-23). The Simulator's Session toggle fires it.
  const [gameRunning, setGameRunning] = useState(false);
  const [omenAiOpen, setOmenAiOpen] = useState(false);
  const [cleanOpen, setCleanOpen] = useState<{ title: string; result: string } | null>(null);
  const [schedOpen, setSchedOpen] = useState<{ title: string } | null>(null);
  const [vitalsTab, setVitalsTab] = useState('cpu');
  const [vitalsOpen, setVitalsOpen] = useState(false);
  // transient spotlight on the OMEN AI card — lit when the governance chip
  // navigates there, fades on its own (an arrival cue, not a standing state)
  const [aiSpot, setAiSpot] = useState(false);
  const aiCardRef = useRef<HTMLDivElement>(null);
  const aiSpotTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(aiSpotTimer.current), []);

  // ── showcase state ──
  const [annotate, setAnnotate] = useState(false);
  const [spotlight, setSpotlight] = useState(false);

  useEffect(() => {
    if (!tuningOpen && !netboostOpen && !boosterOpen && !omenAiOpen && !cleanOpen && !schedOpen && !vitalsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTuningOpen(false);
        setNetboostOpen(false);
        setBoosterOpen(false);
        setOmenAiOpen(false);
        setCleanOpen(null);
        setSchedOpen(null);
        setVitalsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tuningOpen, netboostOpen, boosterOpen, omenAiOpen, cleanOpen, schedOpen, vitalsOpen]);

  const hasEnvelope = laptop === 'hp';
  // OMEN AI is software, not hardware (Juntao 2026-07-23): the agent card is
  // NOT gated by the laptop — a non-HyperX machine still sees it. Only the
  // power-mode envelope (hasEnvelope) is device-bound.

  // Governance has exactly TWO states: default = no management marks, and
  // MANAGED = purple "Managed by OMEN AI" frame + chip. Not era-gated (the
  // coupling is 1.0-native, migration parity). SOFT management: controls stay
  // LIVE — clicking a mode tile IS the dismiss (the user's write wins, source
  // flips to user, the frame drops). No Release button. The chip is a door: it
  // navigates to the OMEN AI card (spotlight arrival cue) — re-engaging lives
  // there (Settings / enablement), not on this card.
  const managed = optimizers && aiOn && current.source === 'omen_ai' && hasEnvelope;

  // Entering 0.0 strips the AI signature from the envelope: a page with no
  // OMEN AI cannot show a mode that OMEN AI set. The mode itself stays.
  const changeScope = (s: Scope) => {
    setScope(s);
    if (s === 'v0') setCurrent((c) => (c.source === 'omen_ai' ? { mode: c.mode, source: 'user' } : c));
  };

  const userSelectMode = (mode: PowerMode) => setCurrent(arbitrateManualOverride({ mode, source: 'user' }));
  // 1.0 override: ENABLING OMEN AI = the AI takes the envelope. Eco/Balanced
  // are bumped up to Performance; already-higher modes keep their mode — but
  // the write is signed omen_ai either way, so the managed frame always
  // returns on enable (fixes: manual takeover → re-enable → no frame).
  const toggleAi = (on: boolean) => {
    setAiOn(on);
    if (on) {
      setCurrent((c) => ({
        mode: c.mode === 'eco' || c.mode === 'balanced' ? 'performance' : c.mode,
        source: 'omen_ai',
        game: 'Cyberpunk 2077',
      }));
    }
  };

  // Chip → navigate to the OMEN AI card and light its spotlight briefly.
  const goToAi = () => {
    aiCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setAiSpot(true);
    window.clearTimeout(aiSpotTimer.current);
    aiSpotTimer.current = window.setTimeout(() => setAiSpot(false), 2600);
  };

  const anchorTag = (
    <TypologyTag
      type="Control & Status card (anchor)"
      interactivity="writes"
      shows="P4 anchor · owns its row, carries inline L3 when Unleashed → Detail modal"
      status="ratified"
    />
  );

  // OMEN AI: a compact agent card (1/4). It OWNS optimization (booster, game
  // optimization) — that detail lives under the agent, not as a separate card.
  const aiCard = (
    <div className={'pv5-tagged' + (aiSpot ? ' pv5-spotlight' : '')} ref={aiCardRef}>
      <TypologyTag
        type="OMEN AI (agent)"
        interactivity="status"
        shows="status card — Active / Inactive only; the on/off + per-game control live in the Settings modal"
        status="draft"
      />
      <OmenAiCard on={aiOn} gameRunning={gameRunning} onConfigure={() => setOmenAiOpen(true)} tracked={5} />
    </div>
  );

  // Network Booster shows at 1.0 only: gone at 0.0 with the rest of the
  // family, hidden at 2.0 (folds under the AI — TBD).
  const nbVisible = scope === 'v1';
  const nbCard = nbVisible ? (
    <div className="pv5-tagged">
      <TypologyTag
        type="Control & Status card"
        interactivity="status"
        shows="status card — Active / Inactive + live throughput (bound here, not in Vitals); Off/Auto/Custom in the Manage modal"
        status="draft"
      />
      <NetworkBoosterCard mode={nbMode} gameRunning={gameRunning} onManage={() => setNetboostOpen(true)} />
    </div>
  ) : null;

  // Booster: same trajectory as Network Booster — 1.0 independent card
  // (migration parity: it ships in OGH today), 2.0 folds under the OMEN AI
  // umbrella (DR-1.1b) so the card hides with the same era gate.
  const boosterCard = nbVisible ? (
    <div className="pv5-tagged">
      <TypologyTag
        type="Control & Status card"
        interactivity="status"
        shows="status card — Active / Inactive (trigger fired, R6); the arming toggle + pack live in the Manage modal"
        status="draft"
      />
      <BoosterCard armed={boosterArmed} triggered={gameRunning} onManage={() => setBoosterOpen(true)} />
    </div>
  ) : null;

  const middle = (
    <div className="pv4-zone">
      {/* Power Mode owns a full row — the P4 anchor */}
      {hasEnvelope && (
        <div className={['pv5-anchor', 'pv5-tagged', spotlight ? 'pv5-spotlight' : '', managed ? 'pv5-managed' : ''].filter(Boolean).join(' ')}>
          {anchorTag}
          <PowerModeCard current={current} onSelect={userSelectMode} onOpenTuning={() => setTuningOpen(true)} />
          {managed && (
            <button type="button" className="pv5-gov-chip" onClick={goToAi} title="Go to OMEN AI">
              Managed by OMEN AI
            </button>
          )}
        </div>
      )}
      {/* below at 1.0: OMEN AI + Booster + Network Booster (1/3 each) —
          the optimizer family, the agent leads the row (Juntao 2026-07-23);
          at 2.0 NB and Booster fold under the AI and the row collapses to
          OMEN AI alone; at 0.0 the row does not exist — Performance is the
          anchor and nothing else. */}
      {optimizers && (
        <div className="pv5-perf-row2">
          {aiCard}
          {boosterCard}
          {nbCard}
        </div>
      )}
    </div>
  );

  const sections: ReorderableSectionData[] = [
    {
      id: 'monitor',
      // Two-layer naming: the divider is the PAGE skeleton (domain "Monitoring");
      // the card's title lives INSIDE the card ("System Vitals").
      header: <SectionHeader label="Monitoring" />,
      children: (
        <div className="pv5-monitor">
          <div className="ds-feature-card pv5-tagged pv5-vitals-card">
            <TypologyTag
              type="Control & Status card · read-only"
              interactivity="read-only"
              shows="the glance — CPU/GPU/RAM; click a reading or More → System Vitals detail modal"
              status="draft"
            />
            <div className="ds-feature-card-header">
              <div className="ds-feature-card-title">System Vitals</div>
              <CardDoor
                verb="more"
                onClick={() => {
                  setVitalsTab('cpu');
                  setVitalsOpen(true);
                }}
              />
            </div>
            <VitalsReadout
              onOpenTab={(t) => {
                setVitalsTab(t);
                setVitalsOpen(true);
              }}
            />
          </div>
          <div className="pv5-tagged">
            <TypologyTag
              type="Control & Status card · read-only"
              interactivity="read-only"
              shows="Top Processes — top-3 offenders glance; action opens Task Manager"
              status="draft"
            />
            <TopProcessesCard />
          </div>
        </div>
      ),
    },
    // A section divider is page skeleton, and skeleton exists only while it
    // holds at least one card — an empty catalog does not advertise itself.
    // Performance empties out at scope 0.0 on a non-HyperX machine: the anchor
    // is device-bound (hasEnvelope) and the optimizer family is scope-bound.
    ...(hasEnvelope || optimizers
      ? [{ id: 'performance', header: <SectionHeader label="Performance" />, children: middle }]
      : []),
    // The cleaners leave at 0.0 with the optimizer family — same species:
    // OGH-parity software utilities, not hardware enablement. At 0.0 the page
    // keeps only what the machine itself demands: readings and the envelope.
    // (Owner's scope call, not ratified — unlike OMEN AI/Booster, nobody has
    // read the cleaners out of MVP explicitly.)
    ...(scope === 'v0' ? [] : [{
      id: 'maintenance',
      header: <SectionHeader label="Maintenance" />,
      children: (
        <div className="pv5-maint-grid">
          <div className="pv5-tagged">
            <TypologyTag
              type="Control & Status card"
              interactivity="writes"
              shows="status reading (Ready) + Clean action in footer; Schedule door → single-page scheduler modal"
              status="draft"
            />
            <CleanerCard
              kind="system"
              onClean={() => setCleanOpen({ title: 'System Cleaner', result: '5.2 GB freed · disk optimized' })}
              onSchedule={() => setSchedOpen({ title: 'System Cleaner' })}
            />
          </div>
          <div className="pv5-tagged">
            <TypologyTag
              type="Control & Status card"
              interactivity="writes"
              shows="status reading (Good) + Clean action in footer; Schedule door → single-page scheduler modal"
              status="draft"
            />
            <CleanerCard
              kind="fan"
              onClean={() => setCleanOpen({ title: 'Fan Cleaner', result: 'Reverse-fan cycle complete' })}
              onSchedule={() => setSchedOpen({ title: 'Fan Cleaner' })}
            />
          </div>
        </div>
      ),
    }]),
  ];

  return (
    <div className={'pv5-root pv7-root' + (annotate ? ' pv5-annotate' : '')}>
      <h1 className="ds-text-title-1 page-title">Performance</h1>
      <p className="ds-text-body page-sub">Performance, power &amp; thermal.</p>
      {showcase && (
        <ShowcaseRig
          laptop={laptop}
          era={era}
          onLaptop={setLaptop}
          onEra={() => {}}
          scope={scope}
          onScope={changeScope}
          aiOn={aiOn}
          onAiOn={toggleAi}
          session={gameRunning}
          onSession={setGameRunning}
          lastEvent={current}
          annotate={annotate}
          onAnnotate={setAnnotate}
          spotlight={spotlight}
          onSpotlight={setSpotlight}
        />
      )}
      {/* Three distinct keys, deliberately. The shipped page's section order is
          the user's, not a side effect of someone reordering the exploration
          route — and it must not be `perform-sections`, which the page this
          replaced still owns at /perform-v1 with a different set of sections. */}
      <ReorderableSections
        sections={sections}
        storageKey={showcase ? 'perform-v7-sections' : 'perform-main-sections'}
      />
      {/* All modals live under .pv7-modals so the V7 shell rules — a content-sized
          rail instead of a proportional one, and a shell sized to what it holds —
          apply here without forking modals that only needed a width change. */}
      <div className="pv7-modals">
      {tuningOpen && (
        <>
          <Backdrop onClick={() => setTuningOpen(false)} />
          <UnleashModal onClose={() => setTuningOpen(false)} />
        </>
      )}
      {netboostOpen && (
        <>
          <Backdrop onClick={() => setNetboostOpen(false)} />
          <NetworkBoosterModal mode={nbMode} onMode={setNbMode} onClose={() => setNetboostOpen(false)} />
        </>
      )}
      {boosterOpen && (
        <>
          <Backdrop onClick={() => setBoosterOpen(false)} />
          <BoosterModal armed={boosterArmed} onArmed={setBoosterArmed} onClose={() => setBoosterOpen(false)} />
        </>
      )}
      {omenAiOpen && (
        <>
          <Backdrop onClick={() => setOmenAiOpen(false)} />
          <OmenAiModal onClose={() => setOmenAiOpen(false)} />
        </>
      )}
      {cleanOpen && (
        <>
          <Backdrop onClick={() => setCleanOpen(null)} />
          <CleanProgressDialog title={cleanOpen.title} result={cleanOpen.result} onClose={() => setCleanOpen(null)} />
        </>
      )}
      {schedOpen && (
        <>
          <Backdrop onClick={() => setSchedOpen(null)} />
          <CleanerSchedulerModal title={schedOpen.title} onClose={() => setSchedOpen(null)} />
        </>
      )}
      {vitalsOpen && (
        <>
          <Backdrop onClick={() => setVitalsOpen(false)} />
          <SystemVitalsModal
            initialTab={vitalsTab}
            onClose={() => setVitalsOpen(false)}
            // At 0.0 the cleaners are off the page, so the Storage tab's
            // cross-feature door must go with them — a door may not point at
            // a feature that does not exist. Undefined hides it in the modal.
            onOpenFeature={scope === 'v0' ? undefined : (f) => {
              setVitalsOpen(false);
              if (f === 'system-clean') setSchedOpen({ title: 'System Cleaner' });
              if (f === 'fan-clean') setSchedOpen({ title: 'Fan Cleaner' });
            }}
          />
        </>
      )}
      </div>
    </div>
  );
}

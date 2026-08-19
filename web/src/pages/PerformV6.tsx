import { useEffect, useState } from 'react';
import { Backdrop, ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { type Era, type Laptop } from '../widgets/perform4/MatrixRig';
import { UnleashModal } from '../widgets/perform4/UnleashModal';
import { PowerModeCard } from '../widgets/perform5/PowerModeCard';
import { ShowcaseRig } from '../widgets/perform5/ShowcaseRig';
import { type NbMode } from '../widgets/perform5/NetworkBoosterCard';
import { NetworkBoosterModal } from '../widgets/perform5/NetworkBoosterModal';
import { OmenAiModal } from '../widgets/perform5/OmenAiModal';
import { CleanProgressDialog } from '../widgets/perform5/CleanProgressDialog';
import { CleanerSchedulerModal } from '../widgets/perform5/CleanerSchedulerModal';
import { TopProcessesCard } from '../widgets/perform5/TopProcessesCard';
import { SystemVitalsModal } from '../widgets/perform5/SystemVitalsModal';
import { VitalsReadout } from '../widgets/perform5/VitalsReadout';
import { TypologyTag } from '../widgets/perform5/TypologyTag';
import { CardDoor } from '../widgets/perform6/CardKit';
import { NetworkBoosterCard } from '../widgets/perform6/NetworkBoosterCard';
import { OmenAiCard } from '../widgets/perform6/OmenAiCard';
import { CleanerCard } from '../widgets/perform6/CleanerCard';
import { arbitrateManualOverride, type ModeChangeEvent, type PowerMode } from '../widgets/perform3/machine';
import './pages.css';
import './perform-v3.css';
import './perform-v4.css';
import './perform-v5.css';
import './perform-v6.css';

// ── PerformV6 (#/perform-v6) — reading-forms variant over the V5 baseline ──
// V5 stays frozen as the "one sanctioned reading form" baseline. V6 keeps the
// entire V5 grammar (anatomy, vocabularies, governance, growth) and re-adds
// CONTROLLED visual variety:
//   · each card declares one HERO READING form fit to its data
//     (NB → Metric pair · Fan Cleaner → Level bar · System Cleaner → Metric ·
//      OMEN AI → Facts receipts) — Facts stays the baseline everywhere
//   · identity icon tiles return to feature-card headers (the colour anchors)
// Only three cards + the kit are forked into widgets/perform6; everything else
// is reused from perform5 untouched.

const AI_DEMO_EVENT: ModeChangeEvent = { mode: 'performance', source: 'omen_ai', game: 'Cyberpunk 2077' };

export function PerformV6() {
  const [laptop, setLaptop] = useState<Laptop>('hp');
  const [era, setEra] = useState<Era>('v1');
  // Rig scaffolding only — V6's cards don't consume the trigger yet (V5 does).
  const [gameRunning, setGameRunning] = useState(false);
  const [aiOn, setAiOn] = useState(true);
  const [current, setCurrent] = useState<ModeChangeEvent>(AI_DEMO_EVENT);
  const [tuningOpen, setTuningOpen] = useState(false);
  const [netboostOpen, setNetboostOpen] = useState(false);
  const [nbMode, setNbMode] = useState<NbMode>('auto');
  const [omenAiOpen, setOmenAiOpen] = useState(false);
  const [cleanOpen, setCleanOpen] = useState<{ title: string; result: string } | null>(null);
  const [schedOpen, setSchedOpen] = useState<{ title: string } | null>(null);
  const [vitalsTab, setVitalsTab] = useState('cpu');
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [released, setReleased] = useState(false);

  const [annotate, setAnnotate] = useState(false);
  const [spotlight, setSpotlight] = useState(false);

  useEffect(() => {
    if (!tuningOpen && !netboostOpen && !omenAiOpen && !cleanOpen && !schedOpen && !vitalsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTuningOpen(false);
        setNetboostOpen(false);
        setOmenAiOpen(false);
        setCleanOpen(null);
        setSchedOpen(null);
        setVitalsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tuningOpen, netboostOpen, omenAiOpen, cleanOpen, schedOpen, vitalsOpen]);

  const hasEnvelope = laptop === 'hp';
  const aiExists = !(laptop === 'non-hp' && era === 'v1');

  const managed = aiOn && current.source === 'omen_ai' && hasEnvelope && !released;

  const changeEra = (e: Era) => {
    setEra(e);
    setReleased(false);
  };
  const userSelectMode = (mode: PowerMode) => setCurrent(arbitrateManualOverride({ mode, source: 'user' }));
  const toggleAi = (on: boolean) => {
    setAiOn(on);
    setReleased(false);
    if (on) {
      setCurrent((c) =>
        c.mode === 'eco' || c.mode === 'balanced'
          ? { mode: 'performance', source: 'omen_ai', game: 'Cyberpunk 2077' }
          : c,
      );
    }
  };

  const anchorTag = (
    <TypologyTag
      type="Control & Status card (anchor)"
      interactivity="writes"
      shows="P4 anchor · hero control; sub controls grow from under the mode row"
      status="ratified"
    />
  );

  const aiCard = aiExists ? (
    <div className="pv5-tagged">
      <TypologyTag
        type="OMEN AI (agent)"
        interactivity="status"
        shows="status card — hero reading stays Facts (its data is receipts); icon tile = identity anchor"
        status="draft"
      />
      <OmenAiCard on={aiOn} onConfigure={() => setOmenAiOpen(true)} tracked={5} />
    </div>
  ) : null;

  const nbVisible = era === 'v1';
  const nbCard = nbVisible ? (
    <div className="pv5-tagged">
      <TypologyTag
        type="Control & Status card"
        interactivity="status"
        shows="status card — hero reading = Metric pair (throughput's natural form); Off/Auto/Custom in the Manage modal"
        status="draft"
      />
      <NetworkBoosterCard mode={nbMode} onManage={() => setNetboostOpen(true)} />
    </div>
  ) : null;

  const middle = (
    <div className="pv4-zone">
      {hasEnvelope && (
        <div className={['pv5-anchor', 'pv5-tagged', spotlight ? 'pv5-spotlight' : '', managed ? 'pv5-managed' : ''].filter(Boolean).join(' ')}>
          {anchorTag}
          <PowerModeCard current={current} onSelect={userSelectMode} onOpenTuning={() => setTuningOpen(true)} />
          {managed && (
            <button type="button" className="pv5-gov-chip" onClick={() => setReleased(true)}>
              Managed by OMEN AI · Release
            </button>
          )}
        </div>
      )}
      {(nbCard || aiCard) && (
        <div className="pv5-perf-row2">
          {nbCard}
          {aiCard}
        </div>
      )}
    </div>
  );

  const sections: ReorderableSectionData[] = [
    {
      id: 'monitor',
      header: <SectionHeader label="Monitoring" />,
      children: (
        <div className="pv5-monitor">
          <div className="ds-feature-card pv5-tagged pv5-vitals-card">
            <TypologyTag
              type="Control & Status card · read-only"
              interactivity="read-only"
              shows="dashboard/cockpit card — exempt from the feature-card anatomy"
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
              shows="Top Processes — status reading + offender list; Open Task Manager door"
              status="draft"
            />
            <TopProcessesCard />
          </div>
        </div>
      ),
    },
    { id: 'performance', header: <SectionHeader label="Performance" />, children: middle },
    {
      id: 'maintenance',
      header: <SectionHeader label="Maintenance" />,
      children: (
        <div className="pv5-maint-grid">
          <div className="pv5-tagged">
            <TypologyTag
              type="Control & Status card"
              interactivity="writes"
              shows="hero reading = Metric (recoverable GB); Facts receipt; Clean action in footer"
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
              shows="hero reading = Level (health bar, neutral fill); Facts receipt; Clean action in footer"
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
    },
  ];

  return (
    <div className={'pv5-root pv6-root' + (annotate ? ' pv5-annotate' : '')}>
      <h1 className="ds-text-title-1 page-title">Perform</h1>
      <p className="ds-text-body page-sub">Performance, power &amp; thermal.</p>
      <ShowcaseRig
        laptop={laptop}
        era={era}
        onLaptop={setLaptop}
        onEra={changeEra}
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
      <ReorderableSections sections={sections} storageKey="perform-v6-sections" />
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
          <SystemVitalsModal initialTab={vitalsTab} onClose={() => setVitalsOpen(false)} />
        </>
      )}
    </div>
  );
}

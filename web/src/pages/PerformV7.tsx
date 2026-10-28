import { useEffect, useRef, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backdrop, ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { type Era, type Laptop } from '../widgets/perform4/MatrixRig';
import { UnleashModal } from '../widgets/perform7/UnleashModal';
import { PowerModeCard } from '../widgets/perform5/PowerModeCard';
import { NetworkBoosterCard, type NbMode } from '../widgets/perform5/NetworkBoosterCard';
import { NetworkBoosterModal } from '../widgets/perform7/NetworkBoosterModal';
import { BoosterCard } from '../widgets/perform5/BoosterCard';
import { BoosterModal, DEFAULT_PACK } from '../widgets/perform7/BoosterModal';
import { OmenAiCard } from '../widgets/perform5/OmenAiCard';
import { OmenAiModal, SESSION_GAME, omenAiGameFallback, omenAiGameKey, type OmenAiGameState } from '../widgets/perform7/OmenAiModal';
import { ChangesModal } from '../widgets/perform7/ChangesModal';
import { CleanerCard } from '../widgets/perform5/CleanerCard';
import { PowerSupplyCard } from '../widgets/perform5/PowerSupplyCard';
import { CleanProgressDialog } from '../widgets/perform5/CleanProgressDialog';
import { CleanerSchedulerModal } from '../widgets/perform7/CleanerSchedulerModal';
import { TopProcessesCard } from '../widgets/perform5/TopProcessesCard';
import { SystemVitalsModal, type PsuDoor } from '../widgets/perform7/SystemVitalsModal';
import { getResolvedSku } from '../devices/skus';
import { hasFanCleaner, partsOf } from '../devices/pcDirectory';
import { VitalsReadout } from '../widgets/perform5/VitalsReadout';
import { CardDoor } from '../widgets/perform5/CardKit';
import { TypologyTag } from '../widgets/perform5/TypologyTag';
import { arbitrateManualOverride, type PowerMode } from '../widgets/perform3/machine';
import { usePowerModeEvent } from '../state/powerMode';
import {
  ago,
  getSetting,
  lastWrite,
  noteChange,
  restoreSetting,
  settingIn,
  signatureFor,
  useChangeRecords,
  writeSetting,
  type ChangeRecord,
  type ChangeTarget,
} from '../state/changeLog';
import { useSettings } from '../state/Settings';
import './pages.css';
import './perform-v3.css';
import './perform-v4.css';
import './perform-v5.css';
import './perform-v7.css';

// ── PerformV5 (#/perform-v5) — framework-showcase variant ──
// An ISOLATED, clearly-labeled PROPOSAL. Three posture domains only:
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

/** Booster's pack as applied for a game: what the record keeps for it. */
interface BoosterPack {
  game: string;
  items: string[];
}

export interface PerformV7Props {
  /**
   * Show the Simulator rig. True on the `/perform-v7` exploration route, where
   * the axes (machine · OMEN AI · session) have to be reachable to be
   * reviewed; they are the Simulator's rows, on every page. False on the
   * promoted `/perform` page, which is one fixed state: a HyperX machine,
   * OMEN AI 1.0, no game running.
   *
   * A prop rather than a copy — the promoted page and the prototype are the
   * same page, and a fork would drift the moment either is touched.
   */
  showcase?: boolean;
}

export function PerformV7({ showcase = true }: PerformV7Props = {}) {
  // The product scope. The June 2027 MVP leaves out OMEN hardware control (fan
  // curves, power modes, graphics switching, overclocking: deck "Treehouse MVP
  // Modules June 2027", slide 7), so under `june27` the page has no Power Mode
  // card, no Fan Cleaner, and with the card goes its only door to Advanced
  // Tuning (perform.29: a page without the anchor; perform.19: no door points
  // at a feature that is not on the page). `full` is the page as it was.
  // Independent of OMEN AI's level: June applies on top of whatever that shows.
  // The machine, OMEN AI's level and the game session are the Simulator's
  // product-state rows, app-wide (2026-10-21): this page reads them, as the
  // Home cards do, and reacts to their changes below.
  const { mvpScope, nonHpPc, omenAi, gameSession, thisPc } = useSettings();
  const june = mvpScope === 'june27';
  const laptop: Laptop = nonHpPc ? 'non-hp' : 'hp';
  // OMEN AI off, or the 1.0 / 2.0 era. (The 0.5 hardware-first reading of
  // August went with the June plan.)
  const era: Era = omenAi === 'v2' ? 'v2' : 'v1';
  const optimizers = true;
  // OMEN AI enablement. The REAL on/off will live in the Settings modal
  // (pending Chris); the Simulator's OMEN AI row is prototype scaffolding so
  // both states are reachable and reviewable.
  const aiOn = omenAi !== 'off';
  // The mode and who set it live in state/powerMode.ts, not here: the Home
  // widget, Nova and the PC's entry in My Devices read the same event, so a
  // change made on this card shows everywhere at once (power-mode.26). It
  // opens on the same OMEN AI event this page always opened on.
  const [current, setCurrent] = usePowerModeEvent();
  const [tuningOpen, setTuningOpen] = useState(false);
  const [netboostOpen, setNetboostOpen] = useState(false);
  // Network Booster's mode, Booster's trigger and its applied pack, OMEN AI's
  // hold on each game, and the cleans live in the page's record of changes
  // (state/changeLog.ts), not here: every write to them is recorded with who
  // made it, signed on the card it changed, and listed behind the Changes door
  // when software made it (perform.4, perform.5). The record outlives the page.
  const records = useChangeRecords();
  const [changesOpen, setChangesOpen] = useState(false);
  const nbMode = settingIn<NbMode>(records, 'network-booster', 'mode', 'auto');
  const setNbMode = (m: NbMode) =>
    writeSetting<NbMode>('network-booster', 'mode', m, 'auto', {
      source: 'user',
      summary: `Set Network Booster to ${m === 'off' ? 'Off' : m === 'auto' ? 'Auto' : 'Custom'}`,
    });
  // Booster: armed = the trigger toggle (Manage modal).
  const [boosterOpen, setBoosterOpen] = useState(false);
  const boosterArmed = settingIn(records, 'booster', 'armed', true);
  const setBoosterArmed = (on: boolean) =>
    writeSetting('booster', 'armed', on, true, { source: 'user', summary: `${on ? 'Armed' : 'Disarmed'} Booster` });
  const boosterPack = settingIn<BoosterPack | null>(records, 'booster', 'pack', null);
  // The shared trigger for the optimizer family (NB / Booster / OMEN AI):
  // a game session. DEFAULT OFF — the resting state is Idle, not working
  // (Juntao 2026-07-23). The Simulator's Session row fires it.
  const gameRunning = gameSession;
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

  // Arrival from elsewhere in the app (the PC's entry in My Devices, for one)
  // names the card it pointed at in `?spot=`. That card gets the arrival cue
  // the governance chip gives the OMEN AI card, the grammar's Spotlight state:
  // scrolled into view, lit, then let go. The parameter is dropped once read,
  // so a reload does not light the card again.
  const [searchParams, setSearchParams] = useSearchParams();
  // The OMEN power supply's readings are System Vitals' too, but only on a
  // desktop that has one, and not under June 2027 (system-vitals.2, perform.11;
  // OGH showed them inside System Vitals). JY, 2026-10-22.
  const pc = getResolvedSku(thisPc);
  const psuPart = !june && !nonHpPc && pc?.type === 'desktop' ? partsOf(pc.id, mvpScope).find((p) => p.type === 'desktop-psu') : undefined;
  const psuW = typeof psuPart?.features.wattage === 'number' ? psuPart.features.wattage : 1000;
  // Fan Cleaner is a notebook's (JY, 2026-10-22): a desktop's power supply
  // cleans its own fan, from the PC page's Power supply tab.
  const fanCleaner = !!pc && hasFanCleaner(pc, mvpScope);
  // A door from System Vitals to the power supply: this window closes and the
  // PC's page opens at its Power supply tab (lcd-diy.25: one window per part).
  // `psu=fan` lands on the Fan view; the page reads it once and drops it.
  const openPsu = (door: PsuDoor) => {
    if (!pc) return;
    setVitalsOpen(false);
    const next = new URLSearchParams(searchParams);
    next.set('sku', pc.id);
    next.set('tab', door.tab);
    if (door.view === 'fan') next.set('psu', 'fan');
    else next.delete('psu');
    setSearchParams(next);
  };
  const [arrived, setArrived] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const vitalsRef = useRef<HTMLDivElement>(null);
  const fanCleanerRef = useRef<HTMLDivElement>(null);
  const psuCardRef = useRef<HTMLDivElement>(null);
  const arriveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(arriveTimer.current), []);
  const spot = searchParams.get('spot');
  useEffect(() => {
    if (!spot) return;
    const targets: Record<string, RefObject<HTMLDivElement>> = {
      'power-mode': anchorRef,
      vitals: vitalsRef,
      'fan-cleaner': fanCleanerRef,
      'power-supply': psuCardRef,
    };
    const next = new URLSearchParams(searchParams);
    next.delete('spot');
    setSearchParams(next, { replace: true });
    // A target that is not on the page (the Power Mode card and Fan Cleaner under
    // June 2027, the Power supply card on a notebook, or an unknown name) has no ref: the parameter is cleared above
    // and nothing lights.
    const target = targets[spot]?.current;
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    setArrived(spot);
    window.clearTimeout(arriveTimer.current);
    arriveTimer.current = window.setTimeout(() => setArrived(null), 2600);
    // Runs on the parameter alone: the rest only describes where to go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  useEffect(() => {
    if (!tuningOpen && !netboostOpen && !boosterOpen && !omenAiOpen && !cleanOpen && !schedOpen && !vitalsOpen && !changesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChangesOpen(false);
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
  }, [tuningOpen, netboostOpen, boosterOpen, omenAiOpen, cleanOpen, schedOpen, vitalsOpen, changesOpen]);

  // Network Booster shows at 1.0 only: hidden at 2.0 (folds under the AI —
  // TBD). Booster follows it.
  const nbVisible = era === 'v1';

  const hasEnvelope = laptop === 'hp';
  // The Power Mode anchor shows only on a machine with the envelope, and not at
  // all under June 2027. Advanced Tuning is opened from this card alone (it is
  // reached only from the top power mode), so it is out of reach with it.
  const showAnchor = hasEnvelope && !june;
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
  const managed = optimizers && aiOn && current.source === 'omen_ai' && showAnchor;

  const userSelectMode = (mode: PowerMode) => setCurrent(arbitrateManualOverride({ mode, source: 'user' }));
  // 1.0 override: ENABLING OMEN AI = the AI takes the envelope. Eco/Balanced
  // are bumped up to Performance; already-higher modes keep their mode — but
  // the write is signed omen_ai either way, so the managed frame always
  // returns on enable (fixes: manual takeover → re-enable → no frame). The
  // switch is the Simulator's, app-wide: this page acts when it turns on
  // while the page is open.
  const aiWas = useRef(aiOn);
  useEffect(() => {
    if (aiOn && !aiWas.current) {
      setCurrent((c) => ({
        mode: c.mode === 'eco' || c.mode === 'balanced' ? 'performance' : c.mode,
        source: 'omen_ai',
        game: 'Cyberpunk 2077',
      }));
    }
    aiWas.current = aiOn;
  }, [aiOn, setCurrent]);

  // ── The game session: what the automations write ──
  // A game launches: OMEN AI applies the profile it has waiting for the game
  // (signed omen_ai), and an armed Booster applies its pack (system). Each is
  // one record, revertible behind the Changes door. Nothing is announced
  // (perform.33). The game closes: Booster puts back everything it changed
  // (booster.15), unless the player already reverted it.
  // Only the cards on the page write: Booster folds under OMEN AI at 2.0.
  // The session is the Simulator's, app-wide: the writes happen when it
  // turns on while this page is open, or when the page opens with it on and
  // nothing applied yet; with no game on, a pack still standing from a
  // session the page never saw end is put back, as Booster does when the
  // game closes.
  const sessionWas = useRef<boolean | null>(null);
  useEffect(() => {
    const was = sessionWas.current;
    sessionWas.current = gameRunning;
    if (!gameRunning) {
      restoreSetting('booster', 'pack', 'system');
      return;
    }
    if (was === true) return;
    const gameKey = omenAiGameKey(SESSION_GAME.id);
    const held = getSetting<OmenAiGameState>('omen-ai', gameKey, omenAiGameFallback(SESSION_GAME.id));
    if (optimizers && aiOn && held.on && held.profile !== SESSION_GAME.profile) {
      writeSetting<OmenAiGameState>('omen-ai', gameKey, { on: true, profile: SESSION_GAME.profile }, omenAiGameFallback(SESSION_GAME.id), {
        source: 'omen_ai',
        summary: `Applied its ${SESSION_GAME.title} profile (${SESSION_GAME.profile})`,
        revertTo: { on: false, profile: null } satisfies OmenAiGameState,
      });
    }
    if (nbVisible && getSetting('booster', 'armed', true) && getSetting<BoosterPack | null>('booster', 'pack', null) === null) {
      writeSetting<BoosterPack | null>('booster', 'pack', { game: SESSION_GAME.title, items: DEFAULT_PACK }, null, {
        source: 'system',
        summary: `Applied ${DEFAULT_PACK.length} optimizations for ${SESSION_GAME.title}: ${DEFAULT_PACK.join(', ')}`,
      });
    }
    // Reads the latest session only; the rest describes what the session writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRunning]);

  // ── Receipts and signatures, read from the record ──
  const nbLast = lastWrite(records, 'network-booster', 'mode');
  const nbSetBy = nbLast ? signatureFor(nbLast) : null;
  const lastOf = (pick: (r: ChangeRecord) => boolean) => [...records].reverse().find(pick);
  const boostRecord = lastOf((r) => r.target === 'booster' && r.key === 'pack' && r.source !== 'user');
  const boostEndedAt = boostRecord?.restoredAt ?? (boostRecord?.revertedBy ? records.find((r) => r.id === boostRecord.revertedBy)?.at ?? boostRecord.at : null);
  // Same shape as OMEN AI's receipt; whether Booster restored it or the player
  // reverted it is in the record.
  const lastBoost =
    boostRecord && boostEndedAt != null ? `${(boostRecord.after as BoosterPack).game} · ${ago(boostEndedAt).toLowerCase()}` : null;
  const cleanRecord = lastOf((r) => r.target === 'system-cleaner' && r.key === 'clean');
  const lastCleaned = cleanRecord ? `${ago(cleanRecord.at)} · ${cleanRecord.source === 'user' ? 'You' : 'Scheduled'}` : undefined;
  const sessionGameHeld = settingIn<OmenAiGameState>(records, 'omen-ai', omenAiGameKey(SESSION_GAME.id), omenAiGameFallback(SESSION_GAME.id));
  const aiRecord = lastOf((r) => r.target === 'omen-ai' && r.source === 'omen_ai');
  const lastOptimized = aiRecord ? `${SESSION_GAME.title} · ${ago(aiRecord.at).toLowerCase()}` : undefined;

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
    <div data-feature="omen-ai" className={'pv5-tagged' + (aiSpot ? ' pv5-spotlight' : '')} ref={aiCardRef}>
      <TypologyTag
        type="OMEN AI (agent)"
        interactivity="status"
        shows="status card — Active / Inactive only; the on/off + per-game control live in the Settings modal"
        status="draft"
      />
      {/* Optimizing means OMEN AI is on for the game being played: after its
          change is reverted it is off for that game (omen-ai.18), so it idles. */}
      <OmenAiCard
        on={aiOn}
        gameRunning={gameRunning && sessionGameHeld.on}
        onConfigure={() => setOmenAiOpen(true)}
        tracked={5}
        lastOptimized={lastOptimized}
      />
    </div>
  );

  const nbCard = nbVisible ? (
    <div data-feature="network-booster" className="pv5-tagged">
      <TypologyTag
        type="Control & Status card"
        interactivity="status"
        shows="status card — Active / Inactive + live throughput (bound here, not in Vitals); Off/Auto/Custom in the Manage modal"
        status="draft"
      />
      <NetworkBoosterCard mode={nbMode} gameRunning={gameRunning} onManage={() => setNetboostOpen(true)} setBy={nbSetBy} />
    </div>
  ) : null;

  // Booster: same trajectory as Network Booster — 1.0 independent card
  // (migration parity: it ships in OGH today), 2.0 folds under the OMEN AI
  // umbrella (DR-1.1b) so the card hides with the same era gate.
  const boosterCard = nbVisible ? (
    <div data-feature="booster" className="pv5-tagged">
      <TypologyTag
        type="Control & Status card"
        interactivity="status"
        shows="status card — Active / Inactive (trigger fired, R6); the arming toggle + pack live in the Manage modal"
        status="draft"
      />
      <BoosterCard
        armed={boosterArmed}
        triggered={gameRunning}
        onManage={() => setBoosterOpen(true)}
        applied={boosterPack ? { game: boosterPack.game, items: boosterPack.items.length } : null}
        lastBoost={lastBoost}
      />
    </div>
  ) : null;

  const middle = (
    <div className="pv4-zone">
      {/* Power Mode owns a full row — the P4 anchor */}
      {showAnchor && (
        <div
          ref={anchorRef}
          data-feature="power-mode"
          className={['pv5-anchor', 'pv5-tagged', arrived === 'power-mode' ? 'pv5-spotlight' : '', managed ? 'pv5-managed' : ''].filter(Boolean).join(' ')}
        >
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
      {/* The OMEN power supply, on a desktop that has one (perform.11: a card
          shows only while the machine has its feature). Its own row, on the
          optimizer row's three columns, so it takes nothing from those cards.
          A card that shows and does not set: its fan is edited in the
          supply's window (lcd-diy.25). JY, 2026-10-22. */}
      {psuPart && (
        <div className="pv7-psu-row">
          <div
            ref={psuCardRef}
            data-feature="power-supply"
            className={'pv5-tagged' + (arrived === 'power-supply' ? ' pv5-spotlight' : '')}
          >
            <TypologyTag
              type="Control & Status card"
              interactivity="read-only"
              shows="the OMEN power supply — status word, Total power, Fan mode + speed; Settings and the Fan row are doors to its window (edited there, not here)"
              status="draft"
            />
            <PowerSupplyCard
              capacityW={psuW}
              onSettings={() => openPsu({ tab: 'psu', view: 'status' })}
              onFan={() => openPsu({ tab: 'psu', view: 'fan' })}
            />
          </div>
        </div>
      )}
    </div>
  );

  // The record lists changes to the cards on the page now (perform.19: no door
  // points at a feature the page does not have — June has no Power Mode card).
  const changeTargets: ChangeTarget[] = [
    ...(showAnchor ? (['power-mode'] as const) : []),
    ...(optimizers ? (['omen-ai'] as const) : []),
    ...(nbVisible ? (['booster', 'network-booster'] as const) : []),
    ...((['system-cleaner'] as const)),
  ];

  const sections: ReorderableSectionData[] = [
    {
      id: 'monitor',
      // Two-layer naming: the divider is the PAGE skeleton (domain "Monitoring");
      // the card's title lives INSIDE the card ("System Vitals").
      header: <SectionHeader label="Monitoring" />,
      children: (
        <div className="pv5-monitor">
          <div
            ref={vitalsRef}
            data-feature="system-vitals"
            className={'ds-feature-card pv5-tagged pv5-vitals-card' + (arrived === 'vitals' ? ' pv5-spotlight' : '')}
          >
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
          <div data-feature="top-processes" className="pv5-tagged">
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
    // Performance empties out at scope 0.0 whenever the anchor is not there
    // (a non-HyperX machine, or June 2027): the anchor is device- and
    // product-scope-bound (showAnchor), the optimizer family is scope-bound.
    ...(showAnchor || optimizers
      ? [{ id: 'performance', header: <SectionHeader label="Performance" />, children: middle }]
      : []),
    // The cleaners leave at 0.0 with the optimizer family — same species:
    // OGH-parity software utilities, not hardware enablement. At 0.0 the page
    // keeps only what the machine itself demands: readings and the envelope.
    // (Owner's scope call, not ratified — unlike OMEN AI/Booster, nobody has
    // read the cleaners out of MVP explicitly.)
    ...([{
      id: 'maintenance',
      header: <SectionHeader label="Maintenance" />,
      children: (
        <div className="pv5-maint-grid">
          <div data-feature="system-cleaner" className="pv5-tagged">
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
              lastCleaned={lastCleaned}
            />
          </div>
          {/* The fan cleaner is a notebook's, and OMEN hardware control: not on
              a desktop, not in June 2027. The System Cleaner then holds the
              row alone (.pv5-maint-grid > :only-child spans it). */}
          {fanCleaner && (
            <div ref={fanCleanerRef} data-feature="fan-cleaner" className={'pv5-tagged' + (arrived === 'fan-cleaner' ? ' pv5-spotlight' : '')}>
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
          )}
        </div>
      ),
    }]),
  ];

  return (
    <div className="pv5-root pv7-root">
      {/* The record's door sits on the title row: what software changed here
          spans Performance and Maintenance (perform.5, perform#open:1). */}
      <div className="pv7-title-row">
        <h1 className="ds-text-title-1 page-title">Performance</h1>
        <button type="button" className="pv5-card-door pv7-changes-door" onClick={() => setChangesOpen(true)}>
          Changes <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="ds-text-body page-sub">{june ? 'Monitoring, optimizers and maintenance.' : 'Performance, power & thermal.'}</p>
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
      {/* `!june`: belt and braces, the card that opens it is not on the page. */}
      {tuningOpen && !june && (
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
      {changesOpen && (
        <>
          <Backdrop onClick={() => setChangesOpen(false)} />
          <ChangesModal targets={changeTargets} onClose={() => setChangesOpen(false)} />
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
          <CleanProgressDialog
            title={cleanOpen.title}
            result={cleanOpen.result}
            onClose={() => setCleanOpen(null)}
            // A clean the player ran: the receipt says so. Recorded when it
            // finishes, never on Cancel; files it deleted do not come back.
            onDone={cleanOpen.title === 'System Cleaner' ? () =>
              noteChange({
                target: 'system-cleaner',
                key: 'clean',
                before: null,
                after: { freed: '5.2 GB' },
                source: 'user',
                summary: 'Cleaned · freed 5.2 GB',
                revertible: false,
              }) : undefined}
          />
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
            psu={psuPart ? { capacityW: psuW } : undefined}
            onOpenDevice={openPsu}
            // At 0.0 the cleaners are off the page, so the Storage tab's
            // cross-feature door must go with them — a door may not point at
            // a feature that does not exist. Undefined hides it in the modal.
            onOpenFeature={(f) => {
              setVitalsOpen(false);
              if (f === 'system-clean') setSchedOpen({ title: 'System Cleaner' });
              // No Fan Cleaner to schedule on a desktop or under June 2027 (perform.19).
              if (f === 'fan-clean' && fanCleaner) setSchedOpen({ title: 'Fan Cleaner' });
            }}
          />
        </>
      )}
      </div>
    </div>
  );
}

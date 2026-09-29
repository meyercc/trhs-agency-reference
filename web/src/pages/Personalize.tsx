import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type React from 'react';
import { Icon, IconButton, ReorderableSections, type ReorderableSectionData, Tile, TileGrid, TileLink } from '../components';
import { useModules } from '../state/Modules';
import type { DeviceId } from '../lightstudio/scene';
import { SectionHeader } from './SectionHeader';
import { ALL_TILES, DEMO_NOW, SCENARIOS, formatClock, isEvening, type ScenarioId } from './personalize/model';
import { useActiveContext, usePersonalize } from './personalize/state';
import { LightingTile, SuggestionRow, renderTile } from './personalize/tiles';
import { AllDisplaysWidget, DeskWidget, DisplaySummaryWidget, ProfilesManager, SmartActionsWidget, useHasMultipleDisplays, useMonitorCount } from '../widgets';
import { DESK_SKU, DeskDevices } from './personalize/DeskSection';
import './pages.css';
import './personalize/personalize.css';

// Personalize — Quick Control.
//
// The page is a tile grid, not a scrolling settings list: Quick Control is the
// form, context is the ranking (Personalize IA & UX, Sept 2026). Contextual
// tiles are ranked into the top group, your pinned tiles sit under it, and the
// catalog is one level down.
//
// There is no Auto/Manual switch: arranging is a whole-app behaviour — every
// section on every page is draggable — so a page-local "stop ranking" toggle
// both contradicts it and hides half the page behind a control nobody flips.
//
// Scope — the desk's look, sound and feel. Power, thermals and fans are
// Perform's; battery and connection are Devices'; app appearance is Settings'
// (TH-350). The Mode tile shows only the desk half of a mode and links out for
// the rest.
export function Personalize() {
  return <QuickControl />;
}

function QuickControl() {
  const p = usePersonalize();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { has, installedCount } = useModules();
  // Subscribes this page to the desk's screen count. Without it the gate below
  // was computed once and never again, so an Admin change to `Displays` moved
  // the DESK card and left this section on the old answer (2026-09-01).
  const multipleDisplays = useHasMultipleDisplays();

  /* The two desk-wide controls, in the order they were already stacked in.
     Hoisted because they are the rail's inside when the desk picture is here
     and the whole section when it is not. */
  const monitors = useMonitorCount();
  /* The right column, by MONITOR count (2026-09-21, second change that day):
     the brightness card is about screens the app can set, and a laptop's own
     screen is not one of them. `1 monitor` desks (the most common, laptop +
     Treehouse 32) used to get ALL DISPLAYS, whose slider then moved one screen
     of two. Now one monitor gets that monitor's own card, two get All monitors.
     Smart actions still follows DISPLAYS — arranging includes the laptop screen. */
  const deskControls = (
    <>
      {monitors > 1 ? <AllDisplaysWidget /> : <DisplaySummaryWidget />}
      {multipleDisplays && <SmartActionsWidget />}
    </>
  );
  // Quick Control shows the few you reach for; the rest are one click away.
  const [showAll, setShowAll] = useState(false);
  // Clicking a device on the desk opens that device. The desk sits two
  // sections above its cards, so a pick whose only answer was a highlight down
  // there was a click with nothing to show for it.
  const openDevice = (id: DeviceId) => {
    const sku = DESK_SKU[id];
    if (sku) openParam('sku', sku);
  };
  // The strip, ranking and suggestions follow the active mode.
  const scenario = useActiveContext();
  // One clock for every context (the prototype's 6:30 PM) — switching modes
  // changes what's detected, never what time it is.
  const now = DEMO_NOW;
  const evening = isEvening(now);
  const signals = scenario.signals.filter((s) => !s.evening || evening);
  const autoSwitched = !!p.autoSwitch && p.autoSwitch.to === p.mode;

  // Demo-only context switching, invisible in the UI so the page looks exactly
  // like the product. A shipping app reads real signals (running game, calendar,
  // clock); the prototype stands in for them two ways:
  //   · URL:      #/personalize?context=valorant | meeting | late | stream
  //   · Keyboard: Alt+Shift+1 / 2 / 3 / 4 while on this page
  const { setScenario } = p;
  const contextParam = params.get('context');
  useEffect(() => {
    if (!contextParam) return;
    if (SCENARIOS.some((s) => s.id === contextParam)) setScenario(contextParam as ScenarioId);
    const next = new URLSearchParams(params);
    next.delete('context');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextParam]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (i < 0 || !SCENARIOS[i]) return;
      e.preventDefault();
      setScenario(SCENARIOS[i].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setScenario]);

  // The running game drives the mouse layout while Context is on.
  const { update } = p;
  useEffect(() => {
    update({ buttons: scenario.id === 'valorant' ? 'valorant' : 'default' });
  }, [scenario.id, update]);

  // One list, not two: the controls you pinned, then the ones context ranked,
  // then whatever is left. "Your usual" and "Right now" were the same kind of
  // thing in two places, split by a rule the page never explained.
  const controls = [...p.pins, ...scenario.ranked, ...ALL_TILES].filter(
    (id, i, all) => id !== 'mode' && all.indexOf(id) === i,
  );
  const VISIBLE = 4;
  // Pin four things and the context strip's promise ("that's why these are up
  // front") would be a lie — every seat taken by your own pins. So the highest
  // ranked control keeps its seat: it rides along as a fifth.
  const first = controls.slice(0, VISIBLE);
  // The seat is for a control CONTEXT ranked, not merely the next one in the
  // list — if everything context picked is already on screen, nothing is owed.
  const topRanked = scenario.ranked.find((id) => id !== 'mode' && !p.pins.includes(id));
  const shown = showAll
    ? controls
    : topRanked && !first.includes(topRanked)
      ? [...first, topRanked]
      : first;
  // Night lighting only makes sense at night.
  const suggestions = scenario.suggestions.filter((id) => !p.dismissed.includes(id) && (id !== 'night-lighting' || evening));

  const openParam = (key: string, value: string, extra?: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    Object.entries(extra ?? {}).forEach(([k, v]) => next.set(k, v));
    setParams(next);
  };

  // Everything below the context strip is a reorderable section, exactly as on
  // Perform: the grip in the gutter drags a whole section, and the order is
  // yours (kept in localStorage). This is the app-wide way to arrange a page —
  // which is why this one has no Auto/Manual switch of its own.
  const sections: ReorderableSectionData[] = [
    {
      // Profiles come before the desk they set: a profile is the thing that
      // owns the lighting, the app look and the device settings below. The
      // switcher in the nav does the switching; this is where you see them all
      // and open the one you want to edit.
      id: 'profiles',
      header: <SectionHeader label="Profiles" />,
      children: <ProfilesManager />,
    },
    {
      // The desk — the picture of the room, and the picker for it: clicking a
      // device here marks its card down in Devices.
      id: 'lighting',
      header: <SectionHeader label="Lighting" />,
      children: (
        <TileGrid className="qc-ranked">
          <LightingTile onPick={openDevice} />
        </TileGrid>
      ),
    },
    {
      // One grid: pinned first, then what context ranked, four at a time. A
      // tile says why it's here (its reason icon) and can be pinned on the spot
      // — no Edit mode, because arranging shouldn't be a place you go.
      id: 'controls',
      header: (
        <SectionHeader
          label="Quick controls"
          action={
            controls.length > VISIBLE ? (
              // Icon only: the chevron points at what happens, and the count
              // lives in its name instead of a second label on the rule.
              <IconButton
                variant="ghost"
                aria-expanded={showAll}
                label={showAll ? 'Show fewer controls' : `Show ${controls.length - VISIBLE} more controls`}
                title={showAll ? 'Show fewer controls' : `Show ${controls.length - VISIBLE} more controls`}
                onClick={() => setShowAll((v) => !v)}
              >
                <Icon name={showAll ? 'chevron-up' : 'chevron-down'} size={16} />
              </IconButton>
            ) : undefined
          }
        />
      ),
      children: (
        <TileGrid className="qc-ranked">
          {shown.map((id) => renderTile(id, { placement: p.pins.includes(id) ? 'pinned' : 'ranked' }))}
        </TileGrid>
      ),
    },
    {
      // The things on the desk, in words: what each is doing, and the way into
      // its own settings.
      id: 'devices',
      header: <SectionHeader label="Devices" />,
      children: <DeskDevices />,
    },
    // Display (Cindy's monitor section, main): the desk's screens beside the
    // desk's light — the top-down desk picture and the controls that act on the
    // whole desk. Kept beside Kristy's sections on the September 29 port.
    // Display sits next to Lighting because it is the same kind of thing one
    // medium over — the desk's screens beside the desk's light.
    //
    // History of the one-screen answer, so it is not re-litigated: 2026-08-20
    // the section vanished on one screen; 2026-08-24 it came back card by card
    // (Desk + Smart actions stayed); 2026-09-21 Cindy's review found that state
    // was three cards of "with a second …" and replaced it with one summary row.
    // The layout by desk state is described at the section's children below.
    ...[
          {
            id: 'display',
            header: <SectionHeader label="Display" />,
            children: (
              /* The desk picture beside the two controls that act on the whole
                 desk, rather than three cards stacked down the page.

                 Measured on the running app 2026-09-08, at a 1050px card: the
                 picture drew 462px of content, so 56% of its row was air — and
                 that air is exactly a control rail wide. The two controls were
                 paying for that width too: `All displays` had its `Brightness`
                 label 1019px from its own `80%`.

                 The heights agree by themselves. Stacked, the section ran
                 402 + 220 + 182 plus gutters = 852px. Paired, the rail's two
                 cards come to 426 against the picture's 402 — 24px apart, so
                 neither column is left hanging, and the section is half as tall.

                 `pg-rail-fill` (2026-09-13, Cindy): the figure takes the rail's height and
                 the desk is drawn to fill it — the Ng3 panel's two-column rule.
                 The shape is `.pg-rail` (pages.css) = Light Studio's own
                 `1fr 300px`, one section below on this same page.

                 Two conditions, both about whether there is a PAIR to make:
                 the figure has to exist (the `desk` module can be removed), and
                 the rail has to be worth a column. On a one-screen desk
                 `All displays` has nothing to hold at one brightness and drops
                 out, leaving `Smart actions` alone — measured 2026-09-08, a
                 138px card beside a 389px picture, so 251px of the rail was
                 empty. A rail that short is worse than no rail, so that desk
                 goes back to full-width cards. */
              /* ONE skeleton on every desk (2026-09-21, second pass): the DESK
                 picture on the left, the controls on the right — only what sits
                 on the right changes. The first pass that morning gave a
                 one-screen desk a summary row instead of the picture, and Cindy
                 read the missing desk as a bug (and plugging in a second monitor
                 turned the whole section into a different layout). Now:
                 · one monitor  — that monitor's brightness (`DisplaySummaryWidget`)
                 · two monitors — All monitors (`AllDisplaysWidget`)
                 · plus, with two or more DISPLAYS (the laptop screen counts),
                   Smart actions when it has something to say — see `deskControls`
                 Gear Switch rides inside the picture card, two computers only.
                 Without the `desk` module there is no picture, so the controls
                 stand alone — the only desk-independent branch. */
              has('desk') ? (
                <div className="pg-rail pg-rail-fill">
                  <DeskWidget />
                  <div className="pg-stack">{deskControls}</div>
                </div>
              ) : (
                <div className="pg-stack">{deskControls}</div>
              )
            ),
          },
        ],
    {
      // What is left once the devices have their own section: the two things
      // on this page that aren't one.
      id: 'everything',
      header: <SectionHeader label="Everything else" />,
      children: (
        <>
          <TileGrid compact className="qc-else">
            <Tile
              row
              size="m"
              icon="puzzle"
              title="Modules"
              value={`${installedCount} installed`}
              actions={<Icon name="chevron-right" size="sm" />}
              onActivate={() => openParam('modal', 'modules')}
            />
            <Tile
              row
              size="m"
              icon="performance"
              title="Performance"
              value="Power · temps · fans"
              actions={<Icon name="chevron-right" size="sm" />}
              onActivate={() => navigate('/perform')}
            />
          </TileGrid>
        </>
      ),
    },
  ];

  return (
    <div>
      <h1 className="ds-text-title-1 page-title qc-title">Personalize</h1>

      {/* Context strip — what Treehouse detected and the signals behind it, plus
          the Undo for a switch it just made. One line; the explanation lives in
          the ⓘ tooltip. It is the one thing on the page you cannot move. */}
      <TileGrid compact>
        <Tile
          row
          size="full"
          className={'qc-strip' + (scenario.art ? ' has-art' : '')}
          style={scenario.art ? ({ '--qc-art': `url("${scenario.art}")` } as React.CSSProperties) : undefined}
          state="context"
          media={
            scenario.art ? (
              <img src={scenario.art} alt="" />
            ) : (
              <span className="qc-strip-icon">
                <Icon name={scenario.icon} size="lg" />
              </span>
            )
          }
          title={scenario.label}
          value={`${scenario.when} · ${formatClock(now)}`}
          reasonIcon="info"
          reason={
            signals.length
              ? `Based on ${signals.map((s) => s.label).join('; ')}. That’s why these settings are up front, and why your profile can switch by itself — you can always undo that.`
              : 'Nothing to go on right now, so everything stays in its usual order. Your profile can switch by itself when Treehouse spots a game, a call or a stream.'
          }
          children={
            autoSwitched ? (
              <span className="qc-strip-effect" role="status">
                <Icon name="check" size="sm" />
                Switched to {p.modeName(p.mode)}
                <TileLink icon="undo" onClick={p.undoAutoSwitch}>
                  Undo
                </TileLink>
              </span>
            ) : undefined
          }
        />
      </TileGrid>

      {/* One suggestion at a time, right under the context that raised it; the
          next one appears once it's answered. */}
      {suggestions.length > 0 && (
        <div className="qc-suggestions" aria-label="Suggestion">
          <SuggestionRow key={suggestions[0]} id={suggestions[0]} />
        </div>
      )}

      <ReorderableSections sections={sections} storageKey="personalize-sections" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SMART ACTIONS — Personalize → Display. The desk-wide layer that watches and
// ASKS. Zone 2: it proposes, a person decides (project-context.md, corrected by
// Cindy 2026-08-18 — the old `Zone 1` tag on this feature was stale).
//
// Why the desk and not a device window: the things worth noticing here are
// relationships between several pieces of hardware — where the screens sit,
// whether they agree — and a device window is about one of them. Personalize is
// the page about the desk (2026-08-07).
//
// This layer is NOT the monitor window's `Auto-switch by activity`. That row is
// one automation; this is the umbrella over the layer, and they were separated
// on 2026-08-07. In the store they are two keys for that reason — see
// `smartActionsWatch` in Settings.tsx. ⚠️ Since 2026-09-21 this card has no
// switch at all (it appears only with a suggestion); read the notes below that
// mention "the switch" or "the policy line" as history.
//
// ── What this card may say, and what it may not ─────────────────────────────
// A suggestion is data, not decoration: it may only appear when the state it
// describes is actually readable. Measured 2026-08-20, of the three suggestions
// the plan had promised, one is readable today:
//   · displays with no saved arrangement — readable (`hasStoredLayout`) ✓
//   · brightness levels disagreeing — NOT readable. With sync off, a monitor's
//     level lives in component state (`MonitorTabs`, `useState`), so there is no
//     desk-wide value to compare. Only "sync is off" is readable, and that is
//     the DEFAULT, so shipping it would greet every new user with a complaint.
//   · another device's light polluting Create — NOT readable. Light Studio's
//     per-device colours live in its Three.js scene and are never persisted
//     (zero `localStorage`/`useSettings` hits in web/src/lightstudio/).
// The rest of the family waits on app/foreground detection, which this app does
// not have (`monitorMode.tsx`: "nothing in this app detects a launch yet") —
// eight of them are parked in phase2-backlog.md. So the list below is built to
// grow: add a rule, and it appears in the same place in the same shape.
//
// The "never" lines are a PROMISE, not a gate — there is no way to detect a
// fullscreen game or a live call yet, so the honest thing is to state the policy
// where the person deciding can read it, rather than draw a switch over machinery
// that does not exist.
//
// ⚠️ WHOEVER ADDS THE NEXT SUGGESTION READ THIS: the promise above is currently
// kept by there being nothing to interrupt WITH. The first suggestion that can
// appear while the person is doing something else has to go through the
// judgement layer — "is this a moment I may speak" — which is specified but not
// built: `design-assets/phase2-backlog.md`, the Smart Actions bundle ("말 걸어도
// 되는 때" / OLED care never breaks playback). Adding a real-time suggestion
// without it turns this paragraph into a lie the card is telling on our behalf.
// ══════════════════════════════════════════════════════════════════════════
import { useNavigate } from 'react-router-dom';
import { Button, WidgetShell } from '../components';
import { useSettings } from '../state/Settings';
import { visibleDisplays, hasStoredLayout } from '../devices/arrangement';
import './widgets.css';

/** One thing the layer noticed, phrased as a question with a way to act. */
type Suggestion = {
  id: string;
  /** What it noticed. One line — this card is full width, so a sentence fits. */
  says: string;
  /** The one answer the row offers — the button that goes and does it. */
  act?: { label: string; run: () => void };
};

/**
 * The card exists only while it has something to say (2026-09-21, Cindy: "스마트
 * 액션은 왜 지금 아무 것도 없는데 카드는 왜 만들어 놓는 거야? 내가 쓸데없는 글자
 * 넣지 말라 그랬잖아").
 *
 * Until today it was a standing switch — `Show me what needs attention on my
 * desk` — plus a policy line, and on a one-screen desk the switch was replaced by
 * `With a second display`, repeating the DESK card's `With a second PC` one card
 * up. A switch in front of an empty room asks the reader to decide about nothing.
 * Now the layer speaks only when a rule fires, in the same Zone 2 shape it always
 * promised: it POINTS THINGS OUT and the person answers. Nothing here changes the
 * setup on its own, which is why it no longer needs a standing opt-in on this
 * page — the 2026-07-21 "asks first" call is about automations that move
 * someone's setup, and a question moves nothing.
 *
 * `smartActionsWatch` stays in Settings but this card no longer reads it. Where
 * a master "stop suggesting" switch lives is open on the 09-13 copy sheet
 * («동의 스위치 자리» — its recommendation is the monitor window's `Auto-switch by
 * activity` row); logged in phase2-backlog.
 *
 * The row is the 2026-09-13 copy sheet's, word for word (sheets/smart-actions-
 * copy-2026-09-13.html, «화면 배치 제안»): `Your N displays aren't arranged yet.`
 * + `Arrange`. The first pass of 2026-09-21 had pointed at the Desk card's own
 * button in the sentence and added a `Not now` that no record asked for; a
 * question whose only button is "later" is not a question. The sheet is newer
 * than the 2026-08-21 「no button on a suggestion」 invariant, which is retired
 * in regression-invariants.md.
 *
 * Rules today: one — the arrangement, which needs a desk with more than one
 * screen and no saved layout. The family waiting on app detection
 * (phase2-backlog 「Smart Actions」) adds its rules here, each with its own gate.
 */
export function SmartActionsWidget() {
  const { displayArrange } = useSettings();
  const navigate = useNavigate();

  const suggestions: Suggestion[] = [];
  const screens = visibleDisplays().length;
  if (screens > 1 && !hasStoredLayout(displayArrange)) {
    suggestions.push({
      id: 'arrangement',
      says: `Your ${screens} displays aren't arranged yet.`,
      // The same deep link as the Desk card's corner — the one editor, opened
      // with the way back to this page.
      act: { label: 'Arrange', run: () => navigate('/?sku=treehouse-32&arrange=1&from=personalize') },
    });
  }
  if (suggestions.length === 0) return null;

  return (
    <WidgetShell title="Smart actions">
      <div style={{ marginTop: 'var(--gutter-sm)', display: 'grid', gap: 'var(--gutter-sm)' }}>
        {suggestions.map((s) => (
          /* The sentence and its answers in one row, in the card — the same shape
             the All displays receipt uses. The sentence takes the primary text
             colour: it is the only thing on the card. */
          <div key={s.id} className="wg-foot" style={{ margin: 0, gap: 'var(--gutter-xs)' }}>
            <span className="ds-text-label" style={{ color: 'var(--text-primary)' }}>{s.says}</span>
            {/* The sentence wraps; the answer does not. Without this the row's
                flex squeezed the button against the card edge (2026-09-21
                capture: button right 1238 vs card content edge 1239). */}
            {s.act && (
              <span style={{ flexShrink: 0 }}>
                <Button size="sm" variant="accent" onClick={s.act.run}>
                  {s.act.label}
                </Button>
              </span>
            )}
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

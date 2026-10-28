import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Icon, Meter } from '../components';
import { AUTOCAST_GAME, CROPS, INSTALL_MS, MOMENTS, SESSION_SECONDS, aspectWord, flaggedAt, fmtClipLen, fmtClock, fmtDur, keepOf, type ClipPlan } from '../data/autocast';
import { titleOf } from '../agents/recipeKit';
import { sessionSecondsOf, useAutocast, type AutocastClip } from '../state/Autocast';
import { useNova } from '../state/Nova';
import { SPEED } from './scripts';
import { AUTOCAST_VERSION } from './autocast';
import { clipFrameStyle } from './autocastMedia';
import './recap.css';
import './autocast.css';

/**
 * Autocast's cards (TH-509, docs/autocast-demo-plan.md), rendered in a Nova
 * reply from `agent-card` records. The shell is the recipes' recap
 * (`.nova-recap`, recap.css) so the four agents' cards read as one family.
 *
 * Only the plan card takes props. The rest READ THE STORE (state/Autocast):
 * the clock, the ticks, the cut progress and each tile's ✓ are live, the way
 * the refund card reads live playtime — so each stage's message is a short
 * script and the composer stays free while the session runs.
 */

/** The demo speed's multiplier — the clock and the bars run at the story's pace. */
function useSpeedK(): number {
  const { settings } = useNova();
  return SPEED[settings.demoSpeed];
}

/** Re-renders every `ms` while `on`. */
function useTick(on: boolean, ms = 100) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [on, ms]);
}

/** The plan Nova read from the sentence — what Autocast will do. */
export function PlanCard({ plan }: { plan: ClipPlan }) {
  const rows: [string, string][] = [
    ['Clips', `${plan.count} ${plan.count === 1 ? 'highlight' : 'highlights'}`],
    ['Length', `${plan.seconds} seconds each`],
    ['Format', aspectWord(plan.aspect)],
    ['When', plan.when === 'now' ? 'This session' : 'Your next game session'],
    ['Picks', 'Kills, clutches and big moments'],
  ];
  return (
    <article className="nova-recap nova-autocast" aria-label="Clip plan" data-autocast="plan">
      <header className="nova-autocast-head">
        <Badge variant="status" tone="info">Autocast</Badge>
        <h3 className="ds-text-label strong nova-recap-title">Clip plan</h3>
      </header>
      <dl className="nova-autocast-kv">
        {rows.map(([k, v]) => (
          <div key={k} className="nova-autocast-kv-row">
            <dt className="ds-text-caption nova-recap-dim">{k}</dt>
            <dd className="ds-text-body">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/** "Adding Autocast…" — the bar, then what it can and cannot do. */
export function AddedCard() {
  const { session } = useAutocast();
  const k = useSpeedK();
  const total = INSTALL_MS * k;
  const started = session.armedAt ?? 0;
  const elapsed = Date.now() - started;
  const installing = session.phase !== 'idle' && total > 0 && elapsed < total;
  useTick(installing, 80);
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 100;
  if (session.phase === 'idle') return null;
  return (
    <article className="nova-recap nova-autocast" aria-label="Autocast added" data-autocast="added" data-installing={installing || undefined}>
      {installing ? (
        <Meter label="Adding Autocast" value={pct} display={`${Math.round(pct)}%`} unit="" />
      ) : (
        <>
          <header className="nova-autocast-head">
            <Badge variant="status" tone="positive">Added</Badge>
            <h3 className="ds-text-label strong nova-recap-title">Autocast {AUTOCAST_VERSION} · OMEN</h3>
          </header>
          <div className="nova-autocast-cans">
            <section className="nova-recap-section">
              <h4 className="ds-text-overline nova-recap-h">It can</h4>
              <ul className="nova-autocast-list">
                {['Record gameplay on this PC while a game is running', 'Mark highlight moments and cut them to your plan', 'Reframe and caption each clip'].map((t) => (
                  <li key={t} className="ds-text-body">
                    <Icon name="check" size={14} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </section>
            <section className="nova-recap-section">
              <h4 className="ds-text-overline nova-recap-h">It cannot</h4>
              <ul className="nova-autocast-list no">
                {['Post or upload anything without your approval', 'Send recordings off this machine'].map((t) => (
                  <li key={t} className="ds-text-body">
                    <Icon name="close" size={14} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </article>
  );
}

/** The session, live: REC, the clock, the timeline filling and the moments marked on it. */
export function LiveCard() {
  const { session } = useAutocast();
  const k = useSpeedK();
  const recording = session.phase === 'recording';
  useTick(recording, 100);
  if (session.phase === 'idle' || session.phase === 'armed' || !session.plan) return null;
  const sec = sessionSecondsOf(session, k);
  const flagged = flaggedAt(sec);
  const keep = recording ? [] : keepOf(flagged, session.plan.count);
  const last = flagged.length ? MOMENTS[flagged[flagged.length - 1]] : null;
  const frac = Math.min(1, sec / SESSION_SECONDS);
  return (
    <article className="nova-recap nova-autocast" aria-label={recording ? 'Recording' : 'Session over'} data-autocast="live" data-recording={recording || undefined}>
      <div className="nova-autocast-live">
        <Badge variant="status" tone={recording ? 'danger' : 'neutral'} className={recording ? 'nova-autocast-rec' : undefined}>
          {recording ? 'REC' : 'ENDED'}
        </Badge>
        <span className="nova-autocast-clock" aria-live="off">
          {recording ? fmtClock(sec) : fmtDur(sec)}
        </span>
      </div>
      <div className="nova-autocast-timeline" role="img" aria-label={`${flagged.length} moments marked across the session`}>
        <span className="nova-autocast-fill" style={{ width: `${frac * 100}%` }} />
        {flagged.map((i) => (
          <span key={i} className={'nova-autocast-tick' + (keep.includes(i) ? ' keep' : '')} style={{ left: `${(MOMENTS[i].at / SESSION_SECONDS) * 100}%` }} title={MOMENTS[i].label} />
        ))}
      </div>
      <p className="ds-text-body nova-recap-p nova-autocast-last">
        {recording ? (
          last ? (
            <>
              Marked <b>{last.label}</b> at {fmtClock(last.at)}
            </>
          ) : (
            'Watching for highlights…'
          )
        ) : (
          <>Session over. Best {keep.length} marked in red.</>
        )}
      </p>
      <p className="ds-text-caption nova-recap-p nova-recap-dim">
        {flagged.length} {flagged.length === 1 ? 'moment' : 'moments'} marked · keeping the best {session.plan.count}
      </p>
    </article>
  );
}

const CUT_WORD: Record<AutocastClip['cut'], string> = { queued: 'queued', reframing: 'reframing', captioning: 'captioning', done: 'done' };

/** The cut, clip by clip. */
export function CuttingCard() {
  const { session } = useAutocast();
  if (!session.plan || !session.clips.length) return null;
  const done = session.clips.filter((c) => c.cut === 'done').length;
  const pct = (done / session.clips.length) * 100;
  const word = (c: AutocastClip) => (c.cut === 'reframing' && session.plan!.aspect === '16:9' ? 'trimming' : CUT_WORD[c.cut]);
  return (
    <article className="nova-recap nova-autocast" aria-label="Cutting clips" data-autocast="cutting" data-done={done}>
      <ol className="nova-autocast-cut">
        {session.clips.map((c, i) => (
          <li key={c.moment} className={'ds-text-body nova-autocast-cut-row' + (c.cut === 'queued' ? ' wait' : c.cut === 'done' ? ' done' : '')} data-cut={c.cut}>
            <span>
              {i + 1}. {MOMENTS[c.moment].label}
            </span>
            <span className="ds-text-caption nova-autocast-cut-st">{c.cut === 'done' ? `✓ ${session.plan!.seconds} s` : word(c)}</span>
          </li>
        ))}
      </ol>
      <Meter label="Cutting" value={pct} display={`${done} / ${session.clips.length}`} unit="" />
    </article>
  );
}

/** The clips, as tiles you can press to watch, with your decision on each. */
export function ClipsCard() {
  const { session } = useAutocast();
  const [params, setParams] = useSearchParams();
  if (!session.plan || session.phase === 'idle' || session.phase === 'armed' || session.phase === 'recording' || session.phase === 'cutting') return null;
  const { plan } = session;
  const gameId = session.gameId ?? AUTOCAST_GAME;
  const open = (i: number) => {
    const p = new URLSearchParams(params);
    p.set('modal', 'autocast-clip');
    p.set('i', String(i));
    setParams(p);
  };
  const total = session.clips.length * plan.seconds;
  return (
    <article className="nova-recap nova-autocast" aria-label={`${session.clips.length} clips`} data-autocast="clips">
      <div className="nova-autocast-grid" data-aspect={plan.aspect}>
        {session.clips.map((c, i) => {
          const m = MOMENTS[c.moment];
          const state = c.status === 'approved' ? 'Approved' : c.status === 'discarded' ? 'Discarded' : null;
          return (
            <button
              key={c.moment}
              type="button"
              className={'nova-autocast-clip' + (c.status !== 'new' ? ` ${c.status}` : '')}
              style={{ ...clipFrameStyle(gameId, { art: c.art, crop: CROPS[c.crop] }), animationDelay: `calc(${i} * var(--dur-instant))` }}
              aria-label={`Clip ${i + 1}: ${m.label}, ${plan.seconds} seconds${state ? `, ${state.toLowerCase()}` : ''}`}
              data-clip={i}
              data-status={c.status}
              onClick={() => open(i)}
            >
              <span className="nova-autocast-shade" aria-hidden />
              <span className="ds-text-micro nova-autocast-num" aria-hidden>
                {i + 1}
              </span>
              {state ? (
                <span className={'ds-text-micro nova-autocast-state ' + c.status} aria-hidden>
                  {c.status === 'approved' && <Icon name="check" size={12} aria-hidden />}
                  {state}
                </span>
              ) : (
                <span className="ds-text-micro nova-autocast-dur" aria-hidden>
                  {fmtClipLen(plan.seconds)}
                </span>
              )}
              <span className="nova-autocast-play" aria-hidden>
                <Icon name="media-play" size={14} aria-hidden />
              </span>
              <span className="ds-text-micro nova-autocast-lbl" aria-hidden>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="ds-text-caption nova-recap-p nova-recap-dim nova-autocast-sum">
        {titleOf(gameId)} · {session.clips.length} × {plan.seconds} s · {aspectWord(plan.aspect)} · {fmtClock(total)} total
      </p>
    </article>
  );
}

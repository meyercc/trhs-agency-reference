import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ModalShell } from '../components';
import { AUTOCAST_GAME, CROPS, MOMENTS, fmtClipLen, fmtClock } from '../data/autocast';
import { titleOf } from '../agents/recipeKit';
import { useAutocast } from '../state/Autocast';
import { clipArt } from './autocastMedia';
import './autocast.css';

/**
 * One clip, played (TH-509): a feature modal (`?modal=autocast-clip&i=<n>`,
 * modals/FeatureModalHost.tsx) so it is deep-linkable and Escape, the
 * backdrop and the close are the host's. The "video" is the clip's art
 * panned slowly between its crop's two framings for the clip's length, with
 * the caption burned in — simulated, and the watermark says whose.
 *
 * Prev / Discard / Approve / Next in the footer. Approve and Discard mark the
 * clip and move on; past the last one the player closes, and the watcher
 * (app/AutocastWatch.tsx) sees every clip decided and finishes the review.
 */
export function AutocastPlayer({ index, onClose }: { index: number; onClose: () => void }) {
  const { session, approve, discard } = useAutocast();
  const [params, setParams] = useSearchParams();
  const frame = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const tc = useRef<HTMLSpanElement>(null);
  const [, setN] = useState(0);
  const clips = session.clips;
  const i = Math.max(0, Math.min(clips.length - 1, index));
  const c = clips[i];
  const plan = session.plan;
  const gameId = session.gameId ?? AUTOCAST_GAME;

  const goTo = (j: number) => {
    const p = new URLSearchParams(params);
    p.set('i', String(j));
    setParams(p, { replace: true });
  };
  const next = () => (i + 1 < clips.length ? goTo(i + 1) : onClose());

  // The "playback": the pan, and the clock along the bottom, in real time —
  // a clip is as long as it is, whatever the demo speed.
  useEffect(() => {
    const el = frame.current;
    if (!el || !c || !plan) return;
    const crop = CROPS[c.crop];
    const len = plan.seconds * 1000;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = still
      ? null
      : el.animate(
          [
            { backgroundPosition: crop.from, backgroundSize: `auto ${crop.size}%` },
            { backgroundPosition: crop.to, backgroundSize: `auto ${crop.size * 1.18}%` },
          ],
          { duration: len, iterations: Infinity, easing: 'ease-in-out', direction: 'alternate' },
        );
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - start) % len;
      if (bar.current) bar.current.style.width = `${(t / len) * 100}%`;
      if (tc.current) tc.current.textContent = `${fmtClipLen(Math.floor(t / 1000))} / ${fmtClipLen(plan.seconds)}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      anim?.cancel();
    };
  }, [c, plan]);
  // The footer's words follow the decision.
  useEffect(() => setN((n) => n + 1), [c?.status]);

  if (!c || !plan) {
    return (
      <ModalShell title="Clip" width="narrow" onClose={onClose}>
        <p className="ds-text-body">No clips to review.</p>
      </ModalShell>
    );
  }
  const m = MOMENTS[c.moment];
  const src = clipArt(gameId, c.art);
  const crop = CROPS[c.crop];
  return (
    <ModalShell
      title={`Clip ${i + 1} of ${clips.length}`}
      width="narrow"
      onClose={onClose}
      className="nova-autocast-modal"
      footer={
        <div className="nova-autocast-ctl">
          <Button onClick={() => goTo(i - 1)} disabled={i === 0}>
            ‹ Prev
          </Button>
          <Button
            onClick={() => {
              discard(i);
              next();
            }}
            aria-pressed={c.status === 'discarded'}
          >
            {c.status === 'discarded' ? 'Discarded' : 'Discard'}
          </Button>
          <Button
            variant="accent"
            autoFocus
            onClick={() => {
              approve(i);
              next();
            }}
            aria-pressed={c.status === 'approved'}
          >
            {c.status === 'approved' ? 'Approved ✓' : 'Approve'}
          </Button>
          <Button onClick={next}>{i === clips.length - 1 ? 'Done' : 'Next ›'}</Button>
        </div>
      }
    >
      <div className="nova-autocast-player" data-clip={i}>
        <div
          ref={frame}
          className="nova-autocast-frame"
          data-aspect={plan.aspect}
          role="img"
          aria-label={`${m.label}: ${m.caption}`}
          style={src ? { backgroundImage: `url(${src})`, backgroundSize: `auto ${crop.size}%`, backgroundPosition: crop.from } : undefined}
        >
          <div className="ds-text-caption nova-autocast-hud">
            <span ref={tc}>
              {fmtClipLen(0)} / {fmtClipLen(plan.seconds)}
            </span>
            <span>
              {i + 1} / {clips.length}
            </span>
          </div>
          <div className="nova-autocast-caption">{m.caption}</div>
          <div className="ds-text-micro nova-autocast-wm">AUTOCAST · SIMULATED</div>
          <div className="nova-autocast-prog">
            <i ref={bar} />
          </div>
        </div>
        <div className="nova-autocast-meta">
          <p className="ds-text-body nova-recap-p">{m.label}</p>
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {titleOf(gameId)} · at {fmtClock(m.at)} in session · hype {m.hype}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

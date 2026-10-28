import { useEffect, useRef } from 'react';
import { AUTOCAST_GAME, CAPTION_STEP_MS, CUT_STEP_MS, SESSION_REAL_MS, SESSION_SECONDS, WAIT_FOR_GAME_MS, WAIT_FOR_GAME_NOW_MS, flaggedAt } from '../data/autocast';
import { titleOf } from '../agents/recipeKit';
import { AUTOCAST_AGENT, endScript, finishScript, launchScript, readyScript } from '../nova/autocast';
import { toUserClips } from '../nova/autocastMedia';
import { SPEED } from '../nova/scripts';
import { useAgents } from '../state/Agents';
import { sessionSecondsOf, useAutocast } from '../state/Autocast';
import { useGallery } from '../state/Gallery';
import { useLaunchGame } from '../state/launchGame';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { usePlaytime } from '../state/Playtime';
import { useSettings } from '../state/Settings';
import { useToasts } from '../state/Toasts';

/**
 * Autocast's watch (TH-509): the clock behind the story. The session store
 * says where things are; this moves them on, on timers scaled by the demo
 * speed, and speaks each stage into the conversation the request was made in
 * (`nova.speakIn`) — so the person can type, leave the panel, or close it,
 * and the clips still arrive.
 *
 *   armed      → after WAIT_FOR_GAME_MS the game launches on its own
 *   recording  → at the session's end, it ends on its own
 *   cutting    → the clips are cut one by one, then delivered (+ a toast)
 *   ready      → once every clip is decided in the player, the review finishes
 *
 * A stage the PERSON moves (a chip, a typed line) goes through the shell's
 * `autocast` action and its reply is the same script — the phase changes
 * under this effect, which clears its timer, so nothing is said twice.
 *
 * Watches only while Nova is installed and the skill is added from Forge:
 * removed there mid-session, it stands down and clears the session. Mounted
 * by AppShell from the UI recipe's `watchers`.
 */
export function AutocastWatch() {
  const autocast = useAutocast();
  const nova = useNova();
  const gallery = useGallery();
  const playtime = usePlaytime();
  const launchGame = useLaunchGame();
  const { has: installed } = useModules();
  const { has: added } = useAgents();
  const { setNovaPinned } = useSettings();
  const { notify, dismiss } = useToasts();

  const { session } = autocast;
  const { phase } = session;
  const live = installed('nova') && added(AUTOCAST_AGENT);
  const k = SPEED[nova.settings.demoSpeed];
  const gameId = session.gameId ?? AUTOCAST_GAME;

  // The latest of everything, for timers that fire later.
  const ref = useRef({ autocast, nova, gallery, playtime, launchGame, k, notify, dismiss, setNovaPinned });
  ref.current = { autocast, nova, gallery, playtime, launchGame, k, notify, dismiss, setNovaPinned };

  // Removed from Forge (or Nova uninstalled) mid-story: stand down.
  useEffect(() => {
    if (!live && phase !== 'idle') autocast.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase]);

  /** The next stage's words, where the request was made; false when that conversation is gone. */
  const say = (script: Parameters<typeof nova.speakIn>[1]) => {
    const r = ref.current;
    const convId = r.autocast.session.convId;
    const ok = !!convId && r.nova.speakIn(convId, script);
    if (!ok) r.autocast.reset();
    return ok;
  };

  // armed → the game launches on its own.
  useEffect(() => {
    if (!live || phase !== 'armed' || !session.plan) return;
    const wait = (session.plan.when === 'now' ? WAIT_FOR_GAME_NOW_MS : WAIT_FOR_GAME_MS) * k;
    const t = window.setTimeout(() => {
      const r = ref.current;
      if (r.autocast.session.phase !== 'armed') return;
      r.autocast.launch();
      r.launchGame(gameId);
      say(launchScript(gameId, false));
    }, wait);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase]);

  // recording → the session ends on its own at its length.
  useEffect(() => {
    if (!live || phase !== 'recording' || session.startedAt == null || !session.plan) return;
    const remaining = Math.max(0, SESSION_REAL_MS * k - (Date.now() - session.startedAt));
    const t = window.setTimeout(() => {
      const r = ref.current;
      const s = r.autocast.session;
      if (s.phase !== 'recording' || !s.plan) return;
      r.autocast.end(SESSION_SECONDS);
      r.playtime.stop();
      say(endScript(gameId, s.plan, SESSION_SECONDS, flaggedAt(SESSION_SECONDS).length, false));
    }, remaining);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase]);

  // cutting → clip by clip, then delivered.
  useEffect(() => {
    if (!live || phase !== 'cutting') return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((res) => window.setTimeout(res, ms * ref.current.k));
    (async () => {
      const n = ref.current.autocast.session.clips.length;
      for (let i = 0; i < n; i++) {
        if (cancelled) return;
        ref.current.autocast.cut(i, 'reframing');
        await wait(CUT_STEP_MS);
        if (cancelled) return;
        ref.current.autocast.cut(i, 'captioning');
        await wait(CAPTION_STEP_MS);
        if (cancelled) return;
        ref.current.autocast.cut(i, 'done');
      }
      await wait(400);
      if (cancelled) return;
      const r = ref.current;
      const s = r.autocast.session;
      if (s.phase !== 'cutting' || !s.plan) return;
      r.autocast.deliver();
      const count = s.clips.length;
      if (!say(readyScript(count))) return;
      // A player mid-game is not looking at Nova: a toast says the clips landed.
      const toastId = 'autocast-ready';
      r.notify({
        id: toastId,
        tone: 'positive',
        icon: 'video-capture',
        title: `Your ${count} ${count === 1 ? 'clip is' : 'clips are'} ready`,
        message: `${titleOf(gameId)} · ${count} × ${s.plan.seconds} s. Nothing has been posted.`,
        actions: [
          {
            label: 'Open',
            variant: 'accent',
            onPress: () => {
              const c = ref.current.autocast.session.convId;
              if (c) ref.current.nova.select(c);
              ref.current.setNovaPinned(true);
              ref.current.dismiss(toastId);
            },
          },
          { label: 'Later', variant: 'ghost', onPress: () => ref.current.dismiss(toastId) },
        ],
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase]);

  // ready → every clip decided in the player: the review is over.
  const decided = phase === 'ready' && session.clips.length > 0 && session.clips.every((c) => c.status !== 'new');
  useEffect(() => {
    if (!live || !decided) return;
    const r = ref.current;
    const s = r.autocast.session;
    const approved = s.clips.filter((c) => c.status === 'approved').length;
    r.autocast.finish();
    r.gallery.add(toUserClips({ ...s, finishedAt: Date.now() }));
    say(finishScript(gameId, approved, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, decided]);

  return null;
}

/** Where the clock is now — for the shell's "end session" (the typed one). */
export const sessionNow = (s: Parameters<typeof sessionSecondsOf>[0], k: number) => sessionSecondsOf(s, k);

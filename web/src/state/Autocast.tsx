import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CROPS, MOMENTS, SESSION_REAL_MS, SESSION_SECONDS, flaggedAt, keepOf, type ClipPlan } from '../data/autocast';

// ── Autocast's session (TH-509) ──────────────────────────────────────────
// Where the clipping skill is in its story: the plan it was given, the
// session it is recording, the clips it cut and what you decided about each.
// The chat's cards READ this (the live card's clock, the cut progress, the
// tiles' ✓) and the watcher (app/AutocastWatch.tsx) MOVES it on timers, so
// each stage's message stays a one-second script and the composer stays
// yours. Persisted (`trhs-autocast`) so a reload mid-session resumes rather
// than restarts: the clock is derived from `startedAt`, never counted.
//
// A leaf: react and the fixture only, so anything may read it (gotcha 51).
const KEY = 'trhs-autocast';

export type AutocastPhase = 'idle' | 'armed' | 'recording' | 'cutting' | 'ready' | 'done';
export type ClipStatus = 'new' | 'approved' | 'discarded';
export type CutStatus = 'queued' | 'reframing' | 'captioning' | 'done';

export interface AutocastClip {
  /** The `MOMENTS` index it was cut from. */
  moment: number;
  /** Which art it is cut from, alternating so the tiles are not one picture. */
  art: 'hero' | 'cover';
  /** `CROPS` index. */
  crop: number;
  cut: CutStatus;
  status: ClipStatus;
}

export interface AutocastSession {
  phase: AutocastPhase;
  plan: ClipPlan | null;
  /** The Nova conversation the request was made in — where the stages land. */
  convId: string | null;
  /** The catalog id of the game recorded. */
  gameId: string | null;
  armedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  /** Session seconds reached when it ended (the whole session, or where "end session" stopped it). */
  endedAtSec: number | null;
  clips: AutocastClip[];
  /** When the approved ones were saved to Gallery. */
  finishedAt: number | null;
}

export const IDLE: AutocastSession = { phase: 'idle', plan: null, convId: null, gameId: null, armedAt: null, startedAt: null, endedAt: null, endedAtSec: null, clips: [], finishedAt: null };

const PHASES: AutocastPhase[] = ['idle', 'armed', 'recording', 'cutting', 'ready', 'done'];
const isSession = (s: unknown): s is AutocastSession => !!s && typeof s === 'object' && PHASES.includes((s as AutocastSession).phase) && Array.isArray((s as AutocastSession).clips);

function loadState(): AutocastSession {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw == null ? null : (JSON.parse(raw) as unknown);
    return isSession(saved) ? { ...IDLE, ...saved } : IDLE;
  } catch {
    return IDLE;
  }
}

export interface AutocastValue {
  session: AutocastSession;
  /** The plan is on; the agent is waiting for the game. */
  arm: (plan: ClipPlan, convId: string | null, gameId: string) => void;
  /** The game launched; the clock starts now. */
  launch: () => void;
  /** The session is over at `sessionSeconds`; the best `plan.count` are queued for cutting. */
  end: (sessionSeconds: number) => void;
  /** The cutter's progress on one clip. */
  cut: (i: number, status: CutStatus) => void;
  /** Every clip is cut: they are ready to review. */
  deliver: () => void;
  approve: (i: number) => void;
  discard: (i: number) => void;
  approveAll: () => void;
  discardAll: () => void;
  /** The review is over; the approved ones are saved. */
  finish: () => void;
  /** Back to idle (stop Autocast, the demo reset). */
  reset: () => void;
}

const AutocastContext = createContext<AutocastValue | null>(null);

const persist = (v: AutocastSession) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage full / unavailable */
  }
};

export function AutocastProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<AutocastSession>(loadState);
  const write = (fn: (s: AutocastSession) => AutocastSession) =>
    setState((s) => {
      const next = fn(s);
      persist(next);
      return next;
    });
  const setClip = (i: number, patch: Partial<AutocastClip>) => write((s) => ({ ...s, clips: s.clips.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const value = useMemo<AutocastValue>(
    () => ({
      session,
      arm: (plan, convId, gameId) => write(() => ({ ...IDLE, phase: 'armed', plan, convId, gameId, armedAt: Date.now() })),
      launch: () => write((s) => (s.phase === 'armed' ? { ...s, phase: 'recording', startedAt: Date.now() } : s)),
      end: (sessionSeconds) =>
        write((s) => {
          if (s.phase !== 'recording' || !s.plan) return s;
          const sec = Math.min(SESSION_SECONDS, sessionSeconds);
          const keep = keepOf(flaggedAt(sec), s.plan.count);
          return {
            ...s,
            phase: 'cutting',
            endedAt: Date.now(),
            endedAtSec: sec,
            clips: keep.map((moment) => ({ moment, art: moment % 2 ? 'cover' : 'hero', crop: moment % CROPS.length, cut: 'queued', status: 'new' })),
          };
        }),
      cut: (i, status) => setClip(i, { cut: status }),
      deliver: () => write((s) => (s.phase === 'cutting' ? { ...s, phase: 'ready', clips: s.clips.map((c) => ({ ...c, cut: 'done' })) } : s)),
      approve: (i) => setClip(i, { status: 'approved' }),
      discard: (i) => setClip(i, { status: 'discarded' }),
      approveAll: () => write((s) => ({ ...s, clips: s.clips.map((c) => (c.status === 'discarded' ? c : { ...c, status: 'approved' })) })),
      discardAll: () => write((s) => ({ ...s, clips: s.clips.map((c) => ({ ...c, status: 'discarded' })) })),
      finish: () => write((s) => (s.phase === 'ready' ? { ...s, phase: 'done', finishedAt: Date.now() } : s)),
      reset: () => write(() => IDLE),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session],
  );

  return <AutocastContext.Provider value={value}>{children}</AutocastContext.Provider>;
}

export function useAutocast(): AutocastValue {
  const ctx = useContext(AutocastContext);
  if (!ctx) throw new Error('useAutocast must be used within <AutocastProvider>');
  return ctx;
}

/** Null outside the provider (Storybook) — a caller hides what it cannot read. */
export function useAutocastOptional(): AutocastValue | null {
  return useContext(AutocastContext);
}

/** The moments flagged so far, by the session clock. */
export const flaggedOf = (sessionSeconds: number) => flaggedAt(sessionSeconds).map((i) => MOMENTS[i]);

/**
 * Where the session clock is, in game seconds: derived from `startedAt` and
 * the demo speed's multiplier (`SPEED[demoSpeed]`, nova/scripts.ts), never
 * counted — a reload resumes where it was. Instant (k = 0) is the whole
 * session at once. After the session, where it ended.
 */
export function sessionSecondsOf(s: AutocastSession, speedK: number, now = Date.now()): number {
  if (s.phase === 'recording' && s.startedAt != null) {
    const real = SESSION_REAL_MS * speedK;
    if (real <= 0) return SESSION_SECONDS;
    return Math.min(SESSION_SECONDS, ((now - s.startedAt) / real) * SESSION_SECONDS);
  }
  if (s.phase === 'cutting' || s.phase === 'ready' || s.phase === 'done') return s.endedAtSec ?? SESSION_SECONDS;
  return 0;
}

/** What a recipe's scripts may read of the session (`RecipeCtx.autocast`): the figures its typed replies state. */
export interface AutocastSnapshot {
  phase: AutocastPhase;
  plan: ClipPlan | null;
  gameId: string | null;
  sessionSeconds: number;
  /** Moments marked so far. */
  marked: number;
  /** Clips not discarded. */
  kept: number;
}
export function snapshotOf(s: AutocastSession, speedK: number): AutocastSnapshot {
  const sessionSeconds = sessionSecondsOf(s, speedK);
  return {
    phase: s.phase,
    plan: s.plan,
    gameId: s.gameId,
    sessionSeconds,
    marked: flaggedAt(sessionSeconds).length,
    kept: s.clips.filter((c) => c.status !== 'discarded').length,
  };
}

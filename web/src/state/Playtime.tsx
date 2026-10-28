import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PURCHASE_BY_ID } from '../data/refunds';

// ── Playtime (TH-484) ────────────────────────────────────────────────────
// Which game is being played and how long it has been played — what the
// "Did I Just Waste My Money" agent watches. A leaf context with no app
// imports beyond the fixture, so the widget catalog can read it (gotcha 51).
//
// The clock is a DEMO clock and says so: while a game is playing, one minute
// of playtime passes every `DEMO_SECONDS_PER_MIN` real seconds, so the
// 15-minutes-left warning arrives on a stage instead of after a quarter hour.
// It lives in memory: a reload is a fresh start from the fixture's minutes,
// which is what a rehearsal wants.
export const DEMO_SECONDS_PER_MIN = 5;

interface PlaytimeValue {
  /** The game being played, or null. */
  playing: string | null;
  /** Start playing (the Play button, Resume). One game at a time. */
  launch: (gameId: string) => void;
  stop: () => void;
  /** Minutes played: the fixture's, plus this session's. */
  playedMin: (gameId: string) => number;
  /** Whether a game's warning has already been given this session. */
  warned: (gameId: string) => boolean;
  markWarned: (gameId: string) => void;
  /** Back to the fixture's minutes, nothing playing, every warning re-armed. */
  reset: () => void;
}

const PlaytimeContext = createContext<PlaytimeValue | null>(null);

export function PlaytimeProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [session, setSession] = useState<Record<string, number>>({});
  const [warnedIds, setWarned] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setSession((s) => ({ ...s, [playing]: (s[playing] ?? 0) + 1 })), DEMO_SECONDS_PER_MIN * 1000);
    return () => window.clearInterval(t);
  }, [playing]);

  const playedMin = useCallback((id: string) => (PURCHASE_BY_ID[id]?.playedMin ?? 0) + (session[id] ?? 0), [session]);

  const value = useMemo<PlaytimeValue>(
    () => ({
      playing,
      launch: (id) => setPlaying(id),
      stop: () => setPlaying(null),
      playedMin,
      warned: (id) => !!warnedIds[id],
      markWarned: (id) => setWarned((w) => ({ ...w, [id]: true })),
      reset: () => {
        setPlaying(null);
        setSession({});
        setWarned({});
      },
    }),
    [playing, playedMin, warnedIds],
  );

  return <PlaytimeContext.Provider value={value}>{children}</PlaytimeContext.Provider>;
}

/** For surfaces that also render outside the app (stories): null without the provider. */
export function usePlaytimeOptional(): PlaytimeValue | null {
  return useContext(PlaytimeContext);
}

export function usePlaytime(): PlaytimeValue {
  const ctx = useContext(PlaytimeContext);
  if (!ctx) throw new Error('usePlaytime must be used within <PlaytimeProvider>');
  return ctx;
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Game } from '../data/games';

// ── Per-game optimize state (TH-504) ─────────────────────────────────────
// Booster and OMEN AI, on or off for each game. It lived in PlayLibrary's
// `useState` — the tile menu's two checkboxes — and reset on reload; the game
// detail panel's OMEN AI switch and that menu must agree, so it is one store,
// persisted under `trhs-game-optimize`. A leaf: react and a catalog type only.
const KEY = 'trhs-game-optimize';

export interface OptimizeState {
  booster: boolean;
  omenAi: boolean;
}

/** What a game that was never set gets: Booster on; OMEN AI as the catalog marks it. */
export const optimizeDefault = (g: Game): OptimizeState => ({ booster: true, omenAi: g.omenAi ?? true });

type Stored = Record<string, OptimizeState>;

function loadState(): Stored {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as unknown;
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Stored) : {};
  } catch {
    return {};
  }
}

export interface GameOptimizeValue {
  of: (game: Game) => OptimizeState;
  set: (gameId: string, key: keyof OptimizeState, value: boolean, fallback: OptimizeState) => void;
}

const GameOptimizeContext = createContext<GameOptimizeValue | null>(null);

export function GameOptimizeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(loadState);
  const value = useMemo<GameOptimizeValue>(
    () => ({
      of: (game) => state[game.id] ?? optimizeDefault(game),
      // `fallback` is the game's current state (its default when unset), so the
      // first write keeps the other flag as it showed rather than resetting it.
      set: (gameId, key, v, fallback) =>
        setState((s) => {
          const next = { ...s, [gameId]: { ...(s[gameId] ?? fallback), [key]: v } };
          try {
            localStorage.setItem(KEY, JSON.stringify(next));
          } catch {
            /* storage full / unavailable */
          }
          return next;
        }),
    }),
    [state],
  );
  return <GameOptimizeContext.Provider value={value}>{children}</GameOptimizeContext.Provider>;
}

export function useGameOptimize(): GameOptimizeValue {
  const ctx = useContext(GameOptimizeContext);
  if (!ctx) throw new Error('useGameOptimize must be used within <GameOptimizeProvider>');
  return ctx;
}

/** Null outside the provider (Storybook). */
export function useGameOptimizeOptional(): GameOptimizeValue | null {
  return useContext(GameOptimizeContext);
}

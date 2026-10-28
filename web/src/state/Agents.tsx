import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_AGENT_IDS } from '../agents/registry';

// ── Agents / Forge state ──────────────────────────────────────────────────
// What you have added from Forge, persisted to localStorage. Deliberately the
// INVERSE default of modules: a module ships installed and is removed, a
// listing ships absent and is added — except the built agent stories, which a
// first run has already added (`DEFAULT_AGENT_IDS`; Chris, 2026-10-26: a
// viewer should see the feature there, then see it can be removed). Only a
// first run: once anything has been saved, an empty list means you removed
// them, and they stay removed. The key is still `trhs-agents` — Forge
// replaced the Agent Catalog, and the agents you added there are still added.
//
// Being added is the switch: Nova answers as a recipe only while it is added
// (agents/recipeScripts.ts), its entry points elsewhere read `has`, and its
// watcher stands down.
//
// Beside it, under `trhs-forge`, sits what you have done TO listings: saves,
// likes, votes, ratings, notify-me and reports, plus the install receipt Forge
// issues on add (ratings and votes are only accepted with one).
const KEY = 'trhs-agents';
const FORGE_KEY = 'trhs-forge';

export interface ForgeRating {
  stars: number;
  text: string;
  at: number;
  ver: string;
  receipt: string;
}
export interface ForgeReceipt {
  id: string;
  ver: string;
  at: number;
}
export interface ForgeEngagement {
  saved: Record<string, true>;
  liked: Record<string, true>;
  vote: Record<string, 1 | -1>;
  rating: Record<string, ForgeRating>;
  notify: Record<string, true>;
  reported: Record<string, true>;
  receipt: Record<string, ForgeReceipt>;
}
const EMPTY: ForgeEngagement = { saved: {}, liked: {}, vote: {}, rating: {}, notify: {}, reported: {}, receipt: {} };

/**
 * A first run — no list ever saved — starts with the default stories, and
 * SAVES that list at once: `add` is a no-op for an id already present, so an
 * unsaved default would leave the key absent forever (verify-who-made-this
 * read `null` after a reset, 2026-10-26).
 */
function loadState(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw == null ? null : (JSON.parse(raw) as unknown);
    if (Array.isArray(saved)) return saved.filter((id): id is string => typeof id === 'string');
    const first = [...DEFAULT_AGENT_IDS];
    localStorage.setItem(KEY, JSON.stringify(first));
    return first;
  } catch {
    /* storage unavailable / malformed */
    return [...DEFAULT_AGENT_IDS];
  }
}
function loadForge(): ForgeEngagement {
  try {
    const saved = JSON.parse(localStorage.getItem(FORGE_KEY) || 'null') as Partial<ForgeEngagement> | null;
    return saved && typeof saved === 'object' ? { ...EMPTY, ...saved } : EMPTY;
  } catch {
    return EMPTY;
  }
}
const receiptId = () => {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FRG-${part()}-${part()}`;
};

interface AgentsValue {
  added: string[];
  /** Added? Unknown ids are NOT added — the opposite of the module default. */
  has: (id: string) => boolean;
  /** Adds and issues the install receipt; `ver` is the version it was added at. */
  add: (id: string, ver?: string) => void;
  /** Removes. The vote goes with it; the rating stays, because you did use it. */
  remove: (id: string) => void;
  addedCount: number;
  forge: ForgeEngagement;
  toggleSaved: (id: string) => void;
  toggleLiked: (id: string) => void;
  toggleNotify: (id: string) => void;
  /** Pressing the vote you already cast clears it. Ignored unless added. */
  vote: (id: string, v: 1 | -1) => void;
  rate: (id: string, stars: number, text: string, ver: string) => void;
  unrate: (id: string) => void;
  report: (id: string) => void;
}

const AgentsContext = createContext<AgentsValue | null>(null);

const persist = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full / unavailable */
  }
};
const toggle = (m: Record<string, true>, id: string) => {
  const next = { ...m };
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
};

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [added, setState] = useState<string[]>(loadState);
  const [forge, setForge] = useState<ForgeEngagement>(loadForge);

  const write = (next: string[]) => {
    setState(next);
    persist(KEY, next);
  };
  const writeForge = (fn: (f: ForgeEngagement) => ForgeEngagement) =>
    setForge((f) => {
      const next = fn(f);
      persist(FORGE_KEY, next);
      return next;
    });

  const value = useMemo<AgentsValue>(
    () => ({
      added,
      has: (id) => added.includes(id),
      add: (id, ver = '') => {
        if (added.includes(id)) return;
        write([...added, id]);
        writeForge((f) => ({ ...f, receipt: { ...f.receipt, [id]: { id: receiptId(), ver, at: Date.now() } } }));
      },
      remove: (id) => {
        if (!added.includes(id)) return;
        write(added.filter((x) => x !== id));
        writeForge((f) => {
          const vote = { ...f.vote };
          delete vote[id];
          return { ...f, vote };
        });
      },
      addedCount: added.length,
      forge,
      toggleSaved: (id) => writeForge((f) => ({ ...f, saved: toggle(f.saved, id) })),
      toggleLiked: (id) => writeForge((f) => ({ ...f, liked: toggle(f.liked, id) })),
      toggleNotify: (id) => writeForge((f) => ({ ...f, notify: toggle(f.notify, id) })),
      vote: (id, v) => {
        if (!added.includes(id)) return;
        writeForge((f) => {
          const vote = { ...f.vote };
          if (vote[id] === v) delete vote[id];
          else vote[id] = v;
          return { ...f, vote };
        });
      },
      rate: (id, stars, text, ver) =>
        writeForge((f) => {
          const receipt = f.receipt[id] ?? { id: receiptId(), ver, at: Date.now() };
          return { ...f, receipt: { ...f.receipt, [id]: receipt }, rating: { ...f.rating, [id]: { stars, text: text.trim().slice(0, 500), at: Date.now(), ver, receipt: receipt.id } } };
        }),
      unrate: (id) =>
        writeForge((f) => {
          const rating = { ...f.rating };
          delete rating[id];
          return { ...f, rating };
        }),
      report: (id) => writeForge((f) => ({ ...f, reported: { ...f.reported, [id]: true } })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [added, forge],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgents() {
  const ctx = useContext(AgentsContext);
  if (!ctx) throw new Error('useAgents must be used within <AgentsProvider>');
  return ctx;
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { FAVORITE_IDS } from '../data/games';

// ── Collections (TH-504) ─────────────────────────────────────────────────
// Named lists of games the person keeps — Favorites among them, at last
// persisted (it lived in PlayLibrary's `useState` and reset on reload). A
// game's detail panel lists the collections holding it; the library's
// Favorites view and the tile menu's Add/Remove Favorites read and write the
// same list. Key `trhs-collections`.
//
// A leaf: react and the catalog only, so the widget catalog may read it
// (gotcha 51). Seeded on a first run — no list ever saved — and saved at once,
// the way `state/Agents.tsx` seeds the default agent stories: a saved empty
// list means you emptied it, and it stays that way.
const KEY = 'trhs-collections';

export const FAVORITES_ID = 'favorites';

export interface Collection {
  id: string;
  name: string;
  gameIds: string[];
  /** Ships with the app (Favorites) — cannot be deleted, only emptied. */
  builtIn?: boolean;
}

/** The first run's collections — illustrative lists over the catalog. */
const SEED: Collection[] = [
  { id: FAVORITES_ID, name: 'Favorites', gameIds: [...FAVORITE_IDS], builtIn: true },
  { id: 'souls', name: 'Souls', gameIds: ['eldenring', 'blackmythwukong'] },
  { id: 'coop', name: 'Co-op nights', gameIds: ['baldursgate3', 'monsterhunterwilds', 'rocketleague'] },
  { id: 'finished', name: 'Finished', gameIds: ['cyberpunk', 'kingdomcome2'] },
];

const isCollection = (c: unknown): c is Collection =>
  !!c && typeof c === 'object' && typeof (c as Collection).id === 'string' && typeof (c as Collection).name === 'string' && Array.isArray((c as Collection).gameIds);

function loadState(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw == null ? null : (JSON.parse(raw) as unknown);
    if (Array.isArray(saved)) return saved.filter(isCollection);
    const first = SEED.map((c) => ({ ...c, gameIds: [...c.gameIds] }));
    localStorage.setItem(KEY, JSON.stringify(first));
    return first;
  } catch {
    /* storage unavailable / malformed */
    return SEED.map((c) => ({ ...c, gameIds: [...c.gameIds] }));
  }
}

interface CollectionsValue {
  collections: Collection[];
  /** The collections holding a game, in list order. */
  of: (gameId: string) => Collection[];
  has: (collectionId: string, gameId: string) => boolean;
  /** Adds the game to the collection, or takes it out. */
  toggle: (collectionId: string, gameId: string) => void;
  /** A new collection; returns its id. */
  add: (name: string, gameIds?: string[]) => string;
}

const CollectionsContext = createContext<CollectionsValue | null>(null);

const persist = (v: Collection[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage full / unavailable */
  }
};

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setState] = useState<Collection[]>(loadState);
  const write = (next: Collection[]) => {
    setState(next);
    persist(next);
  };

  const value = useMemo<CollectionsValue>(
    () => ({
      collections,
      of: (gameId) => collections.filter((c) => c.gameIds.includes(gameId)),
      has: (collectionId, gameId) => !!collections.find((c) => c.id === collectionId)?.gameIds.includes(gameId),
      toggle: (collectionId, gameId) =>
        write(
          collections.map((c) =>
            c.id !== collectionId ? c : { ...c, gameIds: c.gameIds.includes(gameId) ? c.gameIds.filter((g) => g !== gameId) : [...c.gameIds, gameId] },
          ),
        ),
      add: (name, gameIds = []) => {
        const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection';
        let id = base;
        for (let n = 2; collections.some((c) => c.id === id); n++) id = `${base}-${n}`;
        write([...collections, { id, name: name.trim(), gameIds: [...gameIds] }]);
        return id;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collections],
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

export function useCollections(): CollectionsValue {
  const ctx = useContext(CollectionsContext);
  if (!ctx) throw new Error('useCollections must be used within <CollectionsProvider>');
  return ctx;
}

/** Null outside the provider (Storybook) — a caller hides what it cannot read. */
export function useCollectionsOptional(): CollectionsValue | null {
  return useContext(CollectionsContext);
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Crop } from '../data/autocast';

// ── Your own captures (TH-509) ────────────────────────────────────────────
// What the app has saved to the Gallery for you — so far, the clips Autocast
// cut and you approved. The Play page's Gallery and the game panel's thumbs
// show these ahead of the community fixture (pages/GallerySection.tsx), so
// "saved to Gallery" is a thing you can go and see. Key `trhs-gallery`.
//
// A clip's picture is NOT stored as a URL: the built asset names are hashed
// and change per build. It is stored as what it was cut from — a game's art
// and a crop — and resolved when drawn (nova/autocastArt.ts).
//
// A leaf: react only.
const KEY = 'trhs-gallery';

export interface UserClip {
  id: string;
  gameId: string;
  title: string;
  /** The moment's label ("Boss finisher"). */
  label: string;
  caption: string;
  seconds: number;
  aspect: '9:16' | '16:9' | '1:1';
  media: { art: 'hero' | 'cover'; crop: Crop };
  at: number;
}

const isClip = (c: unknown): c is UserClip => !!c && typeof c === 'object' && typeof (c as UserClip).id === 'string' && typeof (c as UserClip).gameId === 'string';

function loadState(): UserClip[] {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw == null ? null : (JSON.parse(raw) as unknown);
    return Array.isArray(saved) ? saved.filter(isClip) : [];
  } catch {
    return [];
  }
}

interface GalleryValue {
  clips: UserClip[];
  /** Newest first, for one game. */
  of: (gameId: string) => UserClip[];
  add: (clips: UserClip[]) => void;
  /** Takes out what one Autocast run saved (the demo reset). */
  removeWhere: (test: (c: UserClip) => boolean) => void;
}

const GalleryContext = createContext<GalleryValue | null>(null);

const persist = (v: UserClip[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage full / unavailable */
  }
};

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [clips, setState] = useState<UserClip[]>(loadState);
  const write = (next: UserClip[]) => {
    setState(next);
    persist(next);
  };
  const value = useMemo<GalleryValue>(
    () => ({
      clips,
      of: (gameId) => clips.filter((c) => c.gameId === gameId).sort((a, b) => b.at - a.at),
      add: (more) => write([...clips.filter((c) => !more.some((m) => m.id === c.id)), ...more]),
      removeWhere: (test) => write(clips.filter((c) => !test(c))),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips],
  );
  return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>;
}

export function useGallery(): GalleryValue {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error('useGallery must be used within <GalleryProvider>');
  return ctx;
}

/** Null outside the provider (Storybook). */
export function useGalleryOptional(): GalleryValue | null {
  return useContext(GalleryContext);
}

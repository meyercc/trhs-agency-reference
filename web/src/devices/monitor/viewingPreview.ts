/**
 * The layout a Viewing Mode tile is being pointed at, before it is pressed
 * (2026-09-23, Cindy: hovering `Picture in picture` should show it on the
 * screen). Transient on purpose — nothing is saved, so it lives outside Settings
 * and outside the mode state: the tile sets it on hover/focus, clears it on
 * leave/blur, and the hero draws it over the saved layout while it is set.
 */
import { useSyncExternalStore } from 'react';

let current: string | null = null;
const subs = new Set<() => void>();

export function setViewingPreview(id: string | null) {
  if (current === id) return;
  current = id;
  subs.forEach((f) => f());
}

export function useViewingPreview(): string | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => null,
  );
}

/**
 * "Open this game's detail panel" (TH-504), for anything that shows a game:
 * the library's tiles and their menu, Jump Back In, Last Played. The panel
 * is URL-driven — `?game=<id>` on the current route, as a device modal is
 * `?sku=` — so AppShell opens it from the param and a link can land on it.
 *
 * A LEAF on purpose (react-router only): the widget catalog imports it, so it
 * must not reach `state/Nova.tsx` or anything that does (gotcha 51).
 *
 * The opener is remembered so the panel can hand focus back when it closes —
 * the one thing a URL cannot carry.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

let lastOpener: HTMLElement | null = null;

/** The element that opened the panel, once; null after a reload. */
export function takeGamePanelOpener(): HTMLElement | null {
  const el = lastOpener;
  lastOpener = null;
  return el;
}

export function useOpenGame(): (gameId: string) => void {
  const [params, setParams] = useSearchParams();
  return useCallback(
    (gameId: string) => {
      lastOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const p = new URLSearchParams(params);
      p.set('game', gameId);
      // One rail at a time: the panel takes the Devices flyout's slot.
      p.delete('devices');
      setParams(p);
    },
    [params, setParams],
  );
}

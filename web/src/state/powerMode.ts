import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSettings } from './Settings';
import { noteChange, registerWriter, seedOnce, type WriteSource } from './changeLog';
import type { ModeChangeEvent, ModeSource, PowerMode } from '../widgets/perform3/machine';

// ── The power mode: one value, every place that shows it ─────────────────────
// Three copies used to drift. The Performance page kept the mode in its own
// state, the Home widget and Nova read and wrote Settings' `powerMode`, and the
// laptop window kept a profile value. Changing the mode on the page left the
// other two saying something else (power-mode.26: every place that shows the
// mode shows the same mode at once).
//
// This module holds the one event: the mode AND who set it, because the PC's
// entry in My Devices shows both (perform.4: a change software made is signed
// where it shows). `PowerModeBridge` keeps Settings' `powerMode` in step, since
// the Home widget and Nova still write there.

/** What a fresh profile opens on: OMEN AI has lifted the mode for a game. The
 *  same event the Performance page has always opened on, moved here so every
 *  surface starts from it. */
export const DEMO_MODE_EVENT: ModeChangeEvent = { mode: 'performance', source: 'omen_ai', game: 'Cyberpunk 2077' };

/** Persisted so the mode survives a reload, as it survives a restart on the
 *  machine (power-mode.45). Settings' `powerMode` keeps its own key for the
 *  surfaces that read it. */
const STORAGE_KEY = 'powerModeEvent';

const MODES: readonly PowerMode[] = ['eco', 'balanced', 'performance', 'unleashed'];
const isMode = (v: unknown): v is PowerMode => MODES.includes(v as PowerMode);

/** A saved event wins; then a mode someone set through Settings (Home widget,
 *  Nova), which they set themselves; then the demo. */
function boot(): ModeChangeEvent {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ModeChangeEvent> | null;
    if (saved && isMode(saved.mode)) {
      return { mode: saved.mode, source: saved.source ?? 'user', ...(saved.game ? { game: saved.game } : {}) };
    }
    const set = localStorage.getItem('powerMode');
    if (isMode(set)) return { mode: set, source: 'user' };
  } catch {
    /* storage unavailable — the demo stands */
  }
  // The demo is saved as it opens. Unsaved, the Bridge's copy of it into
  // Settings read back on the next load as a mode the player set, so a reload
  // dropped OMEN AI's signature while the record of changes still said OMEN AI.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_MODE_EVENT));
  } catch {
    /* storage unavailable */
  }
  return DEMO_MODE_EVENT;
}

let current: ModeChangeEvent = boot();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => current;

// Every write is also kept in the Performance page's record of changes
// (state/changeLog.ts), so a mode OMEN AI set is listed behind the record's
// door with the page's other automatic writes and can be reverted there. Smart
// Sense is automation that is not AI: `system` in the record (§3.1).
const WRITE_SOURCE: Record<ModeSource, WriteSource> = { user: 'user', omen_ai: 'omen_ai', smart_sense: 'system' };
const summaryOf = (e: ModeChangeEvent) =>
  `Set power mode to ${POWER_MODE_LABEL[e.mode]}${e.source !== 'user' && e.game ? ` for ${e.game}` : ''}`;

export function setPowerModeEvent(next: ModeChangeEvent | ((prev: ModeChangeEvent) => ModeChangeEvent)) {
  const prev = current;
  const resolved = typeof next === 'function' ? next(current) : next;
  if (resolved === current) return;
  current = resolved;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
  } catch {
    /* storage unavailable */
  }
  // A write that names the same mode, the same writer and the same game changed nothing.
  if (prev.mode !== resolved.mode || prev.source !== resolved.source || prev.game !== resolved.game) {
    noteChange({
      target: 'power-mode',
      key: 'mode',
      before: prev.mode,
      after: resolved.mode,
      source: WRITE_SOURCE[resolved.source],
      summary: summaryOf(resolved),
    });
  }
  listeners.forEach((listener) => listener());
}

// Revert puts the mode back as the player's choice.
registerWriter('power-mode', (_key, value) => {
  if (isMode(value)) setPowerModeEvent({ mode: value, source: 'user' });
});


/** The mode and who set it, with the same setter shape as `useState`. */
export function usePowerModeEvent(): [ModeChangeEvent, typeof setPowerModeEvent] {
  return [useSyncExternalStore(subscribe, snapshot, snapshot), setPowerModeEvent];
}

/**
 * Keeps Settings' `powerMode` and the event the same value, both ways. Mounted
 * once in the app shell; renders nothing.
 *
 * The first run only brings Settings up to the event, which `boot()` already
 * derived from storage. After that, whichever side moved since the last run
 * wins, and the other follows; the follow-up run then finds them equal, so
 * there is no loop.
 */
export function PowerModeBridge(): null {
  const { powerMode, setPowerMode } = useSettings();
  const [event] = usePowerModeEvent();
  const last = useRef<{ settings: string; event: PowerMode } | null>(null);

  useEffect(() => {
    const prev = last.current;
    last.current = { settings: powerMode, event: event.mode };
    if (!prev) {
      if (powerMode !== event.mode) setPowerMode(event.mode);
      return;
    }
    if (powerMode !== prev.settings && isMode(powerMode) && powerMode !== event.mode) {
      // Someone set the mode through Settings (Home widget, Nova): it was a
      // person, so the event is theirs now.
      setPowerModeEvent({ mode: powerMode, source: 'user' });
    } else if (event.mode !== prev.event && event.mode !== powerMode) {
      setPowerMode(event.mode);
    }
  }, [powerMode, event.mode, setPowerMode]);

  return null;
}

/** The label a person reads for a mode. The machine names its own top mode
 *  (power-mode.1); this prototype's machines all call it Unleashed. */
export const POWER_MODE_LABEL: Record<PowerMode, string> = {
  eco: 'Eco',
  balanced: 'Balanced',
  performance: 'Performance',
  unleashed: 'Unleashed',
};

// A fresh profile opens on OMEN AI's demo event; its record says so, with the
// mode it raised from (the 1.0 override lifts Eco/Balanced to Performance).
// Last in the file: the summary reads POWER_MODE_LABEL.
if (current.source !== 'user') {
  seedOnce({
    id: 'seed-power-mode',
    at: Date.now() - 2 * 60 * 60 * 1000,
    source: WRITE_SOURCE[current.source],
    target: 'power-mode',
    key: 'mode',
    before: current.mode === 'performance' ? 'balanced' : current.mode,
    after: current.mode,
    summary: summaryOf(current),
    revertible: true,
  });
}

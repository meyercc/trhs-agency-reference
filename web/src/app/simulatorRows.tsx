import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

// ── The Simulator's page rows ────────────────────────────────────────────────
// One Simulator rig is on every page (SimulatorRig.tsx). A page that has
// switches of its own (the Performance exploration's laptop, scope,
// enablement, session, spotlight) registers them here while it is mounted,
// and the rig draws them under its own rows; it draws its own rig nowhere.

interface Entry {
  id: string;
  rows: ReactNode;
}

let entries: Entry[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => entries;

/** Register this page's rows with the Simulator while the page is mounted.
 *  `rows` is read anew on every render, so its handlers stay current. */
export function useRigRows(id: string, rows: ReactNode): void {
  useEffect(() => {
    if (rows == null) return;
    const entry: Entry = { id, rows };
    entries = [...entries.filter((e) => e.id !== id), entry];
    notify();
    return () => {
      entries = entries.filter((e) => e !== entry);
      notify();
    };
  });
}

/** The rows pages have registered, in the order they came. */
export function useRegisteredRigRows(): Entry[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

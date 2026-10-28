import { useSyncExternalStore } from 'react';

// ── The record of changes on the Performance page ────────────────────────────
// Every write to a setting the Performance page's features own goes through
// here: the value and its record change together, so the record cannot say
// something the card does not. One list, kept across reloads.
//
// Who wrote is one of three sources (OMEN AI 2.0 requirements §3.1): the
// player, OMEN AI, or plain automation that is not AI (`system`: Booster's
// launch-time pack, a scheduled clean). The player's own writes are recorded
// too. They are not listed behind the record's door (perform.5 lists the
// automatic ones) and are not signed on a card, but they are what makes a
// signature drop the moment the player touches a control: the last writer of
// a setting is the one signed on it (§3.1; network-booster.7).
//
// Revert writes a change's `before` back as the player's change (§3.5,
// DR-3.5b). Only the latest change to a setting can be reverted, so there is
// never a state where half of something was put back; one record holds one
// whole change (Booster's pack is one record, all its items together).
//
// Most settings live here: their value IS the latest record. The power mode
// keeps its own store (state/powerMode.ts) because so much reads it; it reports
// its writes here, and registers how a revert writes it back.

export type WriteSource = 'user' | 'omen_ai' | 'system';

/** The card whose setting changed: the shared write point the signature sits on. */
export type ChangeTarget = 'omen-ai' | 'booster' | 'network-booster' | 'system-cleaner' | 'power-mode';

export interface ChangeRecord {
  id: string;
  at: number;
  source: WriteSource;
  target: ChangeTarget;
  /** Which setting on that card: `mode`, `pack`, `game:cyberpunk`, `clean`. */
  key: string;
  before: unknown;
  after: unknown;
  /** What changed, in one line a person reads. */
  summary: string;
  /** False only where nothing can be put back: files a clean deleted. */
  revertible: boolean;
  /**
   * What Revert writes when it is not simply `before`. OMEN AI's revert puts
   * the game back as it was before OMEN AI AND turns OMEN AI off for it
   * (omen-ai.18; GSW-20405), which is not the state just before this change.
   */
  revertTo?: unknown;
  /** The player's change that put this one back. */
  revertedBy?: string;
  /** The feature put its own change back (Booster, when the game closed: booster.15). */
  restoredAt?: number;
}

const STORAGE_KEY = 'performChanges';
/** Old records fall off the end; the record is for finding what happened lately. */
const MAX_RECORDS = 200;
const DAY = 24 * 60 * 60 * 1000;

/** What a fresh profile opens with: the System Cleaner ran on its schedule three days ago. */
function seed(now: number): ChangeRecord[] {
  return [
    {
      id: 'seed-clean',
      at: now - 3 * DAY,
      source: 'system',
      target: 'system-cleaner',
      key: 'clean',
      before: null,
      after: { freed: '4.8 GB' },
      summary: 'Scheduled clean · freed 4.8 GB',
      revertible: false,
    },
  ];
}

let fresh = false;
function boot(): ChangeRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ChangeRecord[] | null;
    if (Array.isArray(saved)) return saved;
  } catch {
    /* storage unavailable — start from the seed */
  }
  fresh = true;
  return seed(Date.now());
}

let records: ChangeRecord[] = boot();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => records;

function commit(next: ChangeRecord[]) {
  records = next.length > MAX_RECORDS ? next.slice(next.length - MAX_RECORDS) : next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((listener) => listener());
}

let counter = 0;
const newId = () => `c${Date.now().toString(36)}${(counter++).toString(36)}`;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function latestFor(list: ChangeRecord[], target: ChangeTarget, key: string): ChangeRecord | undefined {
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (r.target === target && r.key === key) return r;
  }
  return undefined;
}

function valueOf<T>(list: ChangeRecord[], target: ChangeTarget, key: string, fallback: T): T {
  const last = latestFor(list, target, key);
  if (!last) return fallback;
  return (last.restoredAt != null ? last.before : last.after) as T;
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function useChangeRecords(): ChangeRecord[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** A setting's value in a list of records (the one `useChangeRecords` returned). */
export function settingIn<T>(list: ChangeRecord[], target: ChangeTarget, key: string, fallback: T): T {
  return valueOf(list, target, key, fallback);
}

/** A setting's current value, outside React (in a handler). */
export function getSetting<T>(target: ChangeTarget, key: string, fallback: T): T {
  return valueOf(records, target, key, fallback);
}

/** A setting this store owns. Change it through `writeSetting`. */
export function useSetting<T>(target: ChangeTarget, key: string, fallback: T): T {
  return valueOf(useChangeRecords(), target, key, fallback);
}

/** The last write to a setting, whoever made it. */
export function lastWrite(list: ChangeRecord[], target: ChangeTarget, key: string): ChangeRecord | undefined {
  return latestFor(list, target, key);
}

/** The name signed for a write that was not the player's. */
export function signatureFor(r: Pick<ChangeRecord, 'source' | 'target'>): string | null {
  if (r.source === 'user') return null;
  if (r.source === 'omen_ai') return 'OMEN AI';
  const SYSTEM_NAME: Record<ChangeTarget, string> = {
    'omen-ai': 'OMEN AI',
    booster: 'Booster',
    'network-booster': 'Network Booster',
    'system-cleaner': 'System Cleaner',
    'power-mode': 'System',
  };
  return SYSTEM_NAME[r.target];
}

/** Where a record stands, for the record's door. */
export type RevertState = 'open' | 'reverted' | 'restored' | 'changed-since' | 'final';

export function revertState(r: ChangeRecord, list: ChangeRecord[] = records): RevertState {
  if (!r.revertible) return 'final';
  if (r.revertedBy) return 'reverted';
  if (r.restoredAt != null) return 'restored';
  return latestFor(list, r.target, r.key)?.id === r.id ? 'open' : 'changed-since';
}

/** How long ago, in the words a receipt row uses. */
export function ago(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface WriteMeta {
  source: WriteSource;
  summary: string;
  revertible?: boolean;
  revertTo?: unknown;
}

/**
 * Change a setting this store owns, and record it. A write that changes
 * nothing records nothing.
 */
export function writeSetting<T>(target: ChangeTarget, key: string, value: T, fallback: T, meta: WriteMeta): ChangeRecord | null {
  const before = valueOf(records, target, key, fallback);
  if (same(before, value)) return null;
  return noteChange({ target, key, before, after: value, ...meta });
}

/**
 * Record a change whose value lives elsewhere (the power mode), or an event
 * with no setting to put back (a clean).
 */
export function noteChange(c: { target: ChangeTarget; key: string; before: unknown; after: unknown } & WriteMeta): ChangeRecord {
  const record: ChangeRecord = {
    id: newId(),
    at: Date.now(),
    source: c.source,
    target: c.target,
    key: c.key,
    before: c.before,
    after: c.after,
    summary: c.summary,
    revertible: c.revertible ?? true,
    ...(c.revertTo !== undefined ? { revertTo: c.revertTo } : {}),
  };
  commit([...records, record]);
  return record;
}

/**
 * The feature puts its own change back (Booster when the game closes). Only a
 * change that still stands, and only one this source made: a change the player
 * already reverted, or made themselves, is left as it is.
 */
export function restoreSetting(target: ChangeTarget, key: string, source: WriteSource): ChangeRecord | null {
  const last = latestFor(records, target, key);
  if (!last || last.source !== source || revertState(last) !== 'open') return null;
  commit(records.map((r) => (r.id === last.id ? { ...r, restoredAt: Date.now() } : r)));
  return last;
}

/** Settings whose value lives in their own store register how a revert writes them. */
const writers: Partial<Record<ChangeTarget, (key: string, value: unknown) => void>> = {};
export function registerWriter(target: ChangeTarget, write: (key: string, value: unknown) => void) {
  writers[target] = write;
}

/** Put a change back, as the player's change. False when it cannot be. */
export function revertChange(id: string): boolean {
  const r = records.find((x) => x.id === id);
  if (!r || revertState(r) !== 'open') return false;
  const value = r.revertTo !== undefined ? r.revertTo : r.before;
  const write = writers[r.target];
  let by: string;
  if (write) {
    // The owning store writes, and reports that write here as the player's.
    write(r.key, value);
    const last = latestFor(records, r.target, r.key);
    by = last && last.id !== r.id ? last.id : `revert-${r.id}`;
  } else {
    by = noteChange({
      target: r.target,
      key: r.key,
      before: r.after,
      after: value,
      source: 'user',
      summary: `Reverted: ${r.summary}`,
    }).id;
  }
  commit(records.map((x) => (x.id === r.id ? { ...x, revertedBy: by } : x)));
  return true;
}

/**
 * Add a record that a fresh profile should open with, once: the power mode's
 * demo state (OMEN AI raised it for a game) needs its record, and only the
 * power mode store knows that state. Nothing happens on a profile that already
 * has a record.
 */
export function seedOnce(c: Omit<ChangeRecord, 'id'> & { id: string }) {
  if (!fresh || records.some((r) => r.id === c.id)) return;
  commit([...records, c].sort((a, b) => a.at - b.at));
}

// ══════════════════════════════════════════════════════════════════════════
// The desktop's fans and the names the player gives them — one list, kept
// here, read by everything that names a fan: the DIY fan kit's window, the
// cooler cap's readings and the chassis / daisy-chain lighting (OpenGSW
// lcd-diy.12, lcd-diy.13).
//
// Two kinds of fan share the list:
//   board — the tower's own fans on the ARGB Gen2 lighting board, ports 1–6
//           (port 6 is the CPU cooler). Their order is the chassis-lighting
//           session's placeholder, not taken from a source.
//   kit   — the DIY fan kit's fans, chained one to the next on the kit's own
//           controller: up to 10 on one port, 16 across two (lcd-diy.4).
//           They run in groups the player sets (lcd-diy.10, lcd-diy.11).
//
// A fan's id never changes and is never reused, so plugging a kit fan in or
// pulling one out renames no other fan (lcd-diy.37). A fan with no name of
// the player's shows its default name, which is the app's own string; a name
// the player gave is kept as typed, in every language (lcd-diy.12, .30).
//
// Where the player names a fan is open (lcd-diy#open:3). Until it is
// answered, the kit's window names them; `renameFan` is the one way in, so a
// later home only moves the door.
// ══════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react';
import { DEFAULT_FAN_CURVE, fanSpeedAt, type FanCurvePoint } from '../state/fanCurve';

export type FanController = 'board' | 'kit';

export interface Fan {
  /** Stable: never changes, never reused (lcd-diy.37). */
  id: string;
  controller: FanController;
  /** Board: the lighting board port, 1–6. Kit: the kit's port, 1 or 2. */
  port: number;
  /** Kit only: where it sits in its port's chain, from 1. */
  position?: number;
  /** What the player called it; null shows the default name. */
  name: string | null;
  /** Kit only: the group it runs with; null is Ungrouped. */
  groupId?: string | null;
}

/** How a group of kit fans runs — the same four modes as the app's other
 *  fans (lcd-diy.29). */
export type FanMode = 'auto' | 'max' | 'manual' | 'curve';

export interface FanGroup {
  id: string;
  /** What the player called it; null shows "Group n". */
  name: string | null;
  mode: FanMode;
  manualPct: number;
  curve: FanCurvePoint[];
}

export const KIT_PORTS = 2;
export const KIT_MAX_PER_PORT = 10;
export const KIT_MAX_TOTAL = 16;
export const FAN_NAME_MAX = 24;

interface FanKitState {
  fans: Fan[];
  groups: FanGroup[];
  /** The next number a new kit fan or group takes. Only ever grows. */
  nextFan: number;
  nextGroup: number;
}

/** The board fans' default names (the chassis-lighting placeholder order). */
const BOARD_DEFAULT_NAME: Record<string, string> = {
  'board-1': 'Front fan, upper',
  'board-2': 'Front fan, lower',
  'board-3': 'Top fan, front',
  'board-4': 'Top fan, rear',
  'board-5': 'Rear fan',
  'board-6': 'CPU cooler fan',
};

const newGroup = (n: number): FanGroup => ({
  id: `group-${n}`,
  name: null,
  mode: 'auto',
  manualPct: 50,
  curve: [...DEFAULT_FAN_CURVE],
});

const kitFan = (n: number, port: number, position: number, groupId: string | null): Fan => ({
  id: `kit-${n}`,
  controller: 'kit',
  port,
  position,
  name: null,
  groupId,
});

const INITIAL: FanKitState = {
  fans: [
    ...Object.keys(BOARD_DEFAULT_NAME).map((id, i) => ({ id, controller: 'board' as const, port: i + 1, name: null })),
    // A kit as it might come out of the box and be wired: four on port 1,
    // two on port 2, three of them already grouped.
    kitFan(1, 1, 1, 'group-1'),
    kitFan(2, 1, 2, 'group-1'),
    kitFan(3, 1, 3, 'group-1'),
    kitFan(4, 1, 4, null),
    kitFan(5, 2, 1, null),
    kitFan(6, 2, 2, null),
  ],
  groups: [newGroup(1)],
  nextFan: 7,
  nextGroup: 2,
};

// ── The store ──────────────────────────────────────────────────────────────
const KEY = 'fanKit';
let state: FanKitState = INITIAL;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw) as Partial<FanKitState>;
    if (Array.isArray(saved.fans) && Array.isArray(saved.groups)) state = { ...INITIAL, ...saved } as FanKitState;
  }
} catch {
  /* storage unavailable — defaults stand */
}
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const get = () => state;
function commit(next: FanKitState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** Every fan and group, shared by every reader. */
export function useFanKit(): FanKitState {
  return useSyncExternalStore(subscribe, get, get);
}
/** The list without subscribing, for code outside React. */
export const getFanKit = get;

// ── Names ──────────────────────────────────────────────────────────────────
/** The name to show for a fan: the player's, else the default (lcd-diy.13). */
export function fanName(fan: Fan): string {
  if (fan.name) return fan.name;
  if (fan.controller === 'board') return BOARD_DEFAULT_NAME[fan.id] ?? `Fan ${fan.port}`;
  // The number is the fan's own, from its id — not its place in the list —
  // so it survives other fans coming and going (lcd-diy.37).
  return `Fan ${fan.id.replace('kit-', '')}`;
}

export function groupName(group: FanGroup): string {
  return group.name ?? `Group ${group.id.replace('group-', '')}`;
}

const cleanName = (name: string) => {
  const t = name.trim().slice(0, FAN_NAME_MAX);
  return t.length ? t : null;
};

/** Name a fan. An empty name goes back to the default. */
export function renameFan(id: string, name: string) {
  commit({ ...state, fans: state.fans.map((f) => (f.id === id ? { ...f, name: cleanName(name) } : f)) });
}

export function renameGroup(id: string, name: string) {
  commit({ ...state, groups: state.groups.map((g) => (g.id === id ? { ...g, name: cleanName(name) } : g)) });
}

// ── Groups ─────────────────────────────────────────────────────────────────
export function setGroup(id: string, patch: Partial<Omit<FanGroup, 'id'>>) {
  commit({ ...state, groups: state.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
}

/** A new, empty group. Returns its id. */
export function addGroup(): string {
  const g = newGroup(state.nextGroup);
  commit({ ...state, groups: [...state.groups, g], nextGroup: state.nextGroup + 1 });
  return g.id;
}

/** Remove a group; its fans go back to Ungrouped. */
export function removeGroup(id: string) {
  commit({
    ...state,
    groups: state.groups.filter((g) => g.id !== id),
    fans: state.fans.map((f) => (f.groupId === id ? { ...f, groupId: null } : f)),
  });
}

/** Put a kit fan in a group, or null for Ungrouped. */
export function moveFan(fanId: string, groupId: string | null) {
  commit({ ...state, fans: state.fans.map((f) => (f.id === fanId ? { ...f, groupId } : f)) });
}

// ── Fans coming and going (simulated) ──────────────────────────────────────
export const kitFans = (s: FanKitState = state) => s.fans.filter((f) => f.controller === 'kit');

/** Why another fan can't go on this port, or null if it can (lcd-diy.4). */
export function kitPortFull(port: number, s: FanKitState = state): string | null {
  const kit = kitFans(s);
  if (kit.length >= KIT_MAX_TOTAL) return `The kit drives ${KIT_MAX_TOTAL} fans at most.`;
  if (kit.filter((f) => f.port === port).length >= KIT_MAX_PER_PORT) return `A port drives ${KIT_MAX_PER_PORT} fans at most.`;
  return null;
}

/** A fan plugged onto the end of a port's chain. It joins Ungrouped and
 *  takes a new number; no other fan's name moves. */
export function plugKitFan(port: number) {
  if (kitPortFull(port)) return;
  const position = kitFans().filter((f) => f.port === port).length + 1;
  commit({ ...state, fans: [...state.fans, kitFan(state.nextFan, port, position, null)], nextFan: state.nextFan + 1 });
}

/** A fan pulled off its chain. The fans after it move up a place; their ids
 *  and names stay theirs. */
export function unplugKitFan(id: string) {
  const gone = state.fans.find((f) => f.id === id);
  if (!gone || gone.controller !== 'kit') return;
  commit({
    ...state,
    fans: state.fans
      .filter((f) => f.id !== id)
      .map((f) =>
        f.controller === 'kit' && f.port === gone.port && (f.position ?? 0) > (gone.position ?? 0)
          ? { ...f, position: (f.position ?? 1) - 1 }
          : f,
      ),
  });
}

/** Back to the kit as it came. For the lab. */
export function resetFanKit() {
  commit(INITIAL);
}

// ── Speed and RPM (simulated) ──────────────────────────────────────────────
/** The CPU temperature a curve reads in the prototype — System Vitals' value. */
export const KIT_CURVE_TEMP = 58;
const AUTO_PCT = 40;
const MAX_RPM = 2000;
const MIN_RPM = 350;

/** The speed a group asks for, 0–100 %. */
export function groupPct(g: FanGroup | undefined): number {
  if (!g || g.mode === 'auto') return AUTO_PCT;
  if (g.mode === 'max') return 100;
  if (g.mode === 'manual') return g.manualPct;
  return fanSpeedAt(g.curve, KIT_CURVE_TEMP);
}

let wobble = 0;
let ticker: number | undefined;
const rpmListeners = new Set<() => void>();
function subscribeRpm(l: () => void) {
  rpmListeners.add(l);
  if (ticker === undefined) {
    ticker = window.setInterval(() => {
      wobble = Math.round((Math.random() - 0.5) * 60);
      rpmListeners.forEach((x) => x());
    }, 2000);
  }
  return () => {
    rpmListeners.delete(l);
    if (rpmListeners.size === 0 && ticker !== undefined) {
      window.clearInterval(ticker);
      ticker = undefined;
    }
  };
}
const wobbleSnapshot = () => wobble;

/** A group's live RPM, moving every 2 s while watched — the period System
 *  Vitals uses. Ungrouped fans run Auto. */
export function useGroupRpm(group: FanGroup | undefined): number {
  const w = useSyncExternalStore(subscribeRpm, wobbleSnapshot, wobbleSnapshot);
  const pct = groupPct(group);
  return Math.max(0, Math.round((MIN_RPM + (pct / 100) * (MAX_RPM - MIN_RPM) + w) / 10) * 10);
}

/** One fan's RPM as the cap's readings show it, read without subscribing:
 *  the reading redraws on the cap's own cycle. Board fans follow the tower's
 *  own fan control, which this list does not drive. */
export function fanRpm(fan: Fan, s: FanKitState = state): number {
  if (fan.controller === 'board') return 1100 + fan.port * 40 + wobble;
  const pct = groupPct(s.groups.find((g) => g.id === fan.groupId));
  return Math.max(0, Math.round((MIN_RPM + (pct / 100) * (MAX_RPM - MIN_RPM) + wobble) / 10) * 10);
}

// ── Identify ───────────────────────────────────────────────────────────────
// Flashes the named fans' lights so the player can find them in the case
// (lcd-diy.11). Not kept: it lasts seconds.
let identifying: ReadonlySet<string> = new Set();
const idListeners = new Set<() => void>();
const subscribeId = (l: () => void) => {
  idListeners.add(l);
  return () => {
    idListeners.delete(l);
  };
};
const idSnapshot = () => identifying;
let idTimer: number | undefined;

export function identifyFans(fanIds: string[], ms = 3000) {
  identifying = new Set(fanIds);
  idListeners.forEach((l) => l());
  window.clearTimeout(idTimer);
  idTimer = window.setTimeout(() => {
    identifying = new Set();
    idListeners.forEach((l) => l());
  }, ms);
}

/** The fans flashing right now. */
export function useIdentifying(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeId, idSnapshot, idSnapshot);
}

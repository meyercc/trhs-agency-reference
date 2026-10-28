import { useSyncExternalStore } from 'react';

// ── Macros: the player's recorded key sequences ───────────────────────────────
// One library for every keyboard the app drives (OpenGSW keys-macros): a macro
// is written once and assigned to keys. A key's assignment is the keyboard's
// own binding (`Macro · <name>`); this store keeps what the macro is. Kept
// across reloads. Only the player writes here (keys-macros.37).

export interface MacroStep {
  dir: 'down' | 'up';
  /** The key as the player reads it: "Q", "Shift", "Space". */
  key: string;
  /** Milliseconds since the previous step, as recorded. */
  gap: number;
}

/** How the gaps between steps play (keys-macros.5). */
export type MacroTiming = 'recorded' | 'fixed' | 'none';
/** How the macro plays when its key is pressed (keys-macros.4). */
export type MacroPlay = 'once' | 'held' | 'toggle' | 'repeat';

/** The four kinds a macro is made as (the OGH create dialog's tabs). */
export type MacroKind = 'keystroke' | 'multikey' | 'launcher' | 'text';

export const MACRO_KIND_LABEL: Record<MacroKind, string> = {
  keystroke: 'Keystroke',
  multikey: 'Multi-key',
  launcher: 'Launcher',
  text: 'Text',
};

/** A macro's name is at most this long. */
export const MACRO_NAME_MAX = 18;

/** Programs the launcher can open (the prototype has no real list). */
export const LAUNCH_APPS = ['Notepad', 'Calculator', 'Chrome', 'Discord', 'OBS Studio', 'Steam'];

export interface Macro {
  id: string;
  name: string;
  /** What the macro is. Macros saved before kinds existed are multi-key. */
  kind: MacroKind;
  /** Keystroke: the combination sent, as read, such as "Ctrl + Shift + A". */
  combo: string;
  /** Text: what is typed. */
  text: string;
  /** Text: the key that starts it in a game's chat. */
  modifier: string;
  /** Launcher: the program opened. */
  app: string;
  steps: MacroStep[];
  timing: MacroTiming;
  /** The fixed gap, when `timing` is fixed. Starts at 300 ms (keys-macros.5). */
  fixedMs: number;
  play: MacroPlay;
  /** Times to play, when `play` is repeat. */
  repeat: number;
}

const KEY = 'macros';

const press = (keys: string[], gap = 80): MacroStep[] =>
  keys.flatMap((k, i) => [
    { dir: 'down' as const, key: k, gap: i === 0 ? 0 : gap },
    { dir: 'up' as const, key: k, gap: 40 },
  ]);

// Two to start from, so the library is not empty on a first look.
const BLANK = { kind: 'multikey' as MacroKind, combo: '', text: '', modifier: '', app: '' };
const SEED: Macro[] = [
  { ...BLANK, id: 'm-buy', name: 'Quick buy', steps: press(['B', '4', '4', 'Esc']), timing: 'recorded', fixedMs: 300, play: 'once', repeat: 3 },
  { ...BLANK, id: 'm-ping', name: 'Ping and call', steps: press(['Z', 'Enter']), timing: 'fixed', fixedMs: 300, play: 'once', repeat: 3 },
];

function read(): Macro[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as Partial<Macro>[]).map((m) => ({ ...BLANK, steps: [], ...m }) as Macro);
  } catch {
    /* storage unavailable or unreadable — start from the seed */
  }
  return SEED;
}

let current: Macro[] = read();
const listeners = new Set<() => void>();

function write(next: Macro[]) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — kept for this session */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => current;

export function useMacros() {
  const macros = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    macros,
    save: (m: Macro) => write(current.some((x) => x.id === m.id) ? current.map((x) => (x.id === m.id ? m : x)) : [...current, m]),
    /** A copy of a macro under a new name and id; returns it. */
    duplicate: (m: Macro) => {
      const copy = { ...m, id: `m-${Date.now()}`, name: `${m.name} copy`.slice(0, MACRO_NAME_MAX), steps: [...m.steps] };
      write([...current, copy]);
      return copy;
    },
    remove: (id: string) => {
      write(current.filter((x) => x.id !== id));
      unassignMacro(id);
    },
  };
}

/** The next free name for a kind: KEYSTROKE 1, TEXT 2 … (as OGH numbers them). */
export function nextName(kind: MacroKind, taken: string[]): string {
  const base = MACRO_KIND_LABEL[kind].toUpperCase();
  let n = 1;
  while (taken.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export const newMacro = (kind: MacroKind = 'multikey', taken: string[] = []): Macro => ({
  ...BLANK,
  kind,
  id: `m-${Date.now()}`,
  name: nextName(kind, taken),
  steps: [],
  timing: 'recorded',
  fixedMs: 300,
  play: 'once',
  repeat: 3,
});

/** The keyboard binding a macro is assigned as. */
export const macroBinding = (m: Pick<Macro, 'name'>) => `Macro · ${m.name}`;

export const PLAY_LABEL: Record<MacroPlay, string> = {
  once: 'Once',
  held: 'While held',
  toggle: 'On and off',
  repeat: 'Repeat',
};

/** One line under a macro's name: what it is and how it plays. */
export function macroSummary(m: Macro): string {
  if (m.kind === 'keystroke') return m.combo || 'Keystroke';
  if (m.kind === 'launcher') return m.app ? `Opens ${m.app}` : 'Launcher';
  if (m.kind === 'text') return `${m.text.length} character${m.text.length === 1 ? '' : 's'}`;
  const presses = m.steps.filter((s) => s.dir === 'down').length;
  const play = m.play === 'repeat' ? `${m.repeat}×` : PLAY_LABEL[m.play];
  return `${presses} key${presses === 1 ? '' : 's'} · ${play}`;
}

// ── Macro keys: the four keys a macro can sit on (keys-macros.7) ──────────────
// The Redbull laptop has dedicated macro keys; the player puts a macro from the
// library on each. Only these keys take a macro here — remapping the rest of
// the keyboard is not part of this editor. One macro sits on one key.
// Changes wait for Apply (keys-macros.13); Discard drops them. The draft stays
// while the player writes a macro, so nothing is lost on the way.

export const MACRO_KEYS = ['P1', 'P2', 'P3', 'P4'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];
export type MacroKeyMap = Record<MacroKey, string | null>;

const KEYS_KEY = 'macroKeys';
const NO_KEYS: MacroKeyMap = { P1: null, P2: null, P3: null, P4: null };
// Two assigned to start from, so the key picture is not empty on a first look.
const DEFAULT_KEYS: MacroKeyMap = { P1: null, P2: 'm-buy', P3: 'm-ping', P4: null };

function readKeys(): MacroKeyMap {
  try {
    const raw = localStorage.getItem(KEYS_KEY);
    if (raw) return { ...NO_KEYS, ...(JSON.parse(raw) as Partial<MacroKeyMap>) };
  } catch {
    /* storage unavailable or unreadable — start from the defaults */
  }
  return DEFAULT_KEYS;
}

let appliedKeys: MacroKeyMap = readKeys();
let draftKeys: MacroKeyMap = appliedKeys;
const keyListeners = new Set<() => void>();
const sameKeys = (a: MacroKeyMap, b: MacroKeyMap) => MACRO_KEYS.every((k) => a[k] === b[k]);

function setDraft(next: MacroKeyMap) {
  draftKeys = next;
  keyListeners.forEach((l) => l());
}

function apply() {
  appliedKeys = draftKeys;
  try {
    localStorage.setItem(KEYS_KEY, JSON.stringify(appliedKeys));
  } catch {
    /* storage unavailable — kept for this session */
  }
  keyListeners.forEach((l) => l());
}

function unassignMacro(id: string) {
  const without = (m: MacroKeyMap) => Object.fromEntries(MACRO_KEYS.map((k) => [k, m[k] === id ? null : m[k]])) as MacroKeyMap;
  if (Object.values(appliedKeys).includes(id)) {
    appliedKeys = without(appliedKeys);
    try {
      localStorage.setItem(KEYS_KEY, JSON.stringify(appliedKeys));
    } catch {
      /* kept for this session */
    }
  }
  draftKeys = without(draftKeys);
  keyListeners.forEach((l) => l());
}

const subscribeKeys = (l: () => void) => {
  keyListeners.add(l);
  return () => keyListeners.delete(l);
};
// One snapshot object per change, so useSyncExternalStore sees a stable value.
let snap = { draft: draftKeys, applied: appliedKeys };
const keysSnapshot = () => {
  if (snap.draft !== draftKeys || snap.applied !== appliedKeys) snap = { draft: draftKeys, applied: appliedKeys };
  return snap;
};

export function useMacroKeys() {
  const { draft, applied } = useSyncExternalStore(subscribeKeys, keysSnapshot, keysSnapshot);
  return {
    /** The keys as the player has set them, applied or not. */
    keys: draft,
    applied,
    dirty: !sameKeys(draft, applied),
    /** Put a macro on a key (null clears it). A macro sits on one key, so it leaves its old one. */
    assign: (key: MacroKey, id: string | null) =>
      setDraft(Object.fromEntries(MACRO_KEYS.map((k) => [k, k === key ? id : id && draft[k] === id ? null : draft[k]])) as MacroKeyMap),
    apply,
    discard: () => setDraft(appliedKeys),
    /** Reset to default: every key unassigned (still waits for Apply). */
    restore: () => setDraft(NO_KEYS),
  };
}

export const keyOf = (keys: MacroKeyMap, id: string): MacroKey | null => MACRO_KEYS.find((k) => keys[k] === id) ?? null;

// ── Trying a macro (keys-macros.12, .35) ──────────────────────────────────────
// Plays a macro into a test area only — never into the page or another app.
// One macro plays at a time: starting one stops the one playing.

export interface MacroRun {
  /** Stop now (on and off, or another macro starting). */
  stop: () => void;
  /** Let the run in progress finish, then stop (a held key let go). */
  release: () => void;
  done: Promise<void>;
}

let playing: MacroRun | null = null;

/** What typing a step's key into the test area does to its text. */
export function applyKey(text: string, key: string, shift: boolean): string {
  if (key === 'Space') return text + ' ';
  if (key === 'Enter') return text + '\n';
  if (key === 'Backspace' || key === 'Bksp') return text.slice(0, -1);
  if (key.length === 1) return text + (shift ? key.toUpperCase() : key.toLowerCase());
  return text;
}

/** What a text macro presses: each character, Shift around a capital. */
export function textSteps(text: string): MacroStep[] {
  return [...text].flatMap((c): MacroStep[] => {
    const key = c === ' ' ? 'Space' : c === '\n' ? 'Enter' : c;
    const cap = c !== c.toLowerCase() && c === c.toUpperCase();
    return [
      ...(cap ? [{ dir: 'down' as const, key: 'Shift', gap: 0 }] : []),
      { dir: 'down', key, gap: 0 },
      { dir: 'up', key, gap: 0 },
      ...(cap ? [{ dir: 'up' as const, key: 'Shift', gap: 0 }] : []),
    ];
  });
}

export function playMacro(source: Macro, onText: (update: (t: string) => string) => void, onEnd: () => void): MacroRun {
  playing?.stop();
  const m = source.kind === 'text' ? { ...source, steps: textSteps(source.text), timing: 'none' as MacroTiming, play: 'once' as MacroPlay } : source;
  let stopped = false;
  let released = m.play !== 'held';
  const gapFor = (g: number) => (m.timing === 'none' ? 0 : Math.min(m.timing === 'fixed' ? m.fixedMs : g, 400));
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(ms, 4)));
  const once = async () => {
    let shift = false;
    for (const s of m.steps) {
      if (stopped) return;
      await wait(gapFor(s.gap));
      if (stopped) return;
      if (s.key === 'Shift') shift = s.dir === 'down';
      else if (s.dir === 'down') onText((t) => applyKey(t, s.key, shift));
    }
  };
  const self: { run?: MacroRun } = {};
  const run: MacroRun = {
    stop: () => {
      stopped = true;
    },
    release: () => {
      released = true;
    },
    done: (async () => {
      if (m.play === 'once') await once();
      else if (m.play === 'repeat') for (let i = 0; i < m.repeat && !stopped; i++) await once();
      else if (m.play === 'held') do await once(); while (!released && !stopped);
      else while (!stopped) await once();
      if (playing === self.run) playing = null;
      onEnd();
    })(),
  };
  self.run = run;
  playing = run;
  return run;
}

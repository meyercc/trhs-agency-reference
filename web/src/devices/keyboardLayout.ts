// ══════════════════════════════════════════════════════════════════════════════
// KEYBOARD LAYOUT — data + helpers for the interactive keyboard hero.
//
// Ported from the vanilla `personalize-peripherals.js` layout constants
// (KB_FROW / KB_ROWS / KB_NAV / KB_ARROWS / KB_NUMPAD / KB_MEDIA) and the
// per-layer legend logic (_periRenderKey). Rendering lives in KeyboardHero.
// ══════════════════════════════════════════════════════════════════════════════

/** One physical keycap. `code` is the stable id used for lighting quick-select
 *  + binding; `fn` is the factory FN-layer label; `w` is width in key units. */
export interface KeySpec {
  base: string;
  code: string;
  fn?: string;
  w?: number;
  /** numpad grid placement (CSS grid-column / grid-row), when applicable. */
  gc?: string;
  gr?: string;
  /** media key: an inline SVG path drawn on the cap instead of a letter. */
  mediaPath?: string;
}
/** A flexible gap between keys, `sp` wide (in key units). */
export interface Spacer {
  sp: number;
}
export type Cell = KeySpec | Spacer;
export const isSpacer = (c: Cell): c is Spacer => 'sp' in c;

// Derive a key's code from its label when not given explicitly (matches the
// vanilla `_kbCode`: lower-cased label — covers letters/numbers/F-keys).
const code = (base: string, c?: string): string => c ?? base.toLowerCase();
const k = (base: string, opts: Partial<Omit<KeySpec, 'base'>> = {}): KeySpec => ({
  base,
  code: code(base, opts.code),
  ...opts,
});

// ── Function row ──────────────────────────────────────────────────────────────
export const KB_FROW: Cell[] = [
  k('Esc', { code: 'esc', fn: 'Game Mode' }), { sp: 1 },
  k('F1', { fn: 'Mute' }), k('F2', { fn: 'Vol −' }), k('F3', { fn: 'Vol +' }), k('F4'), { sp: 0.5 },
  k('F5', { fn: 'Discord' }), k('F6'), k('F7'), k('F8', { fn: 'OBS Rec' }), { sp: 0.5 },
  k('F9'), k('F10'), k('F11'), k('F12', { fn: 'Profile' }),
];

// ── Main block (5 rows) ───────────────────────────────────────────────────────
export const KB_ROWS: Cell[][] = [
  [k('`', { code: 'backtick' }), k('1'), k('2'), k('3'), k('4'), k('5'), k('6'), k('7'), k('8'), k('9'), k('0'), k('-', { code: 'minus' }), k('=', { code: 'equal' }), k('Backspace', { code: 'backspace', w: 2 })],
  [k('Tab', { w: 1.5 }), k('Q'), k('W'), k('E'), k('R'), k('T'), k('Y'), k('U'), k('I'), k('O'), k('P'), k('[', { code: 'lbracket' }), k(']', { code: 'rbracket' }), k('\\', { code: 'backslash', w: 1.5 })],
  [k('Caps', { w: 1.75 }), k('A'), k('S'), k('D'), k('F'), k('G'), k('H'), k('J'), k('K'), k('L'), k(';', { code: 'semicolon' }), k("'", { code: 'quote' }), k('Enter', { w: 2.25 })],
  [k('Shift', { code: 'lshift', w: 2.25 }), k('Z'), k('X'), k('C'), k('V'), k('B'), k('N'), k('M'), k(',', { code: 'comma' }), k('.', { code: 'period' }), k('/', { code: 'slash' }), k('Shift', { code: 'rshift', w: 2.75 })],
  [k('Ctrl', { code: 'lctrl', w: 1.25 }), k('Win', { w: 1.25 }), k('Alt', { code: 'lalt', w: 1.25 }), k('Space', { w: 6.25 }), k('Alt', { code: 'ralt', w: 1.25 }), k('Fn', { code: 'fn', w: 1.25 }), k('Menu', { w: 1.25 }), k('Ctrl', { code: 'rctrl', w: 1.25 })],
];

// ── Nav cluster (3×3 top block, then inverted-T arrows) ───────────────────────
export const KB_NAV: KeySpec[] = ['PrtSc', 'ScrLk', 'Pause', 'Ins', 'Home', 'Pg Up', 'Del', 'End', 'Pg Dn'].map((b) => k(b));
export const KB_ARROW_UP: KeySpec = k('↑', { code: 'arrowup' });
export const KB_ARROWS: KeySpec[] = [
  k('←', { code: 'arrowleft' }),
  k('↓', { code: 'arrowdown' }),
  k('→', { code: 'arrowright' }),
];

// ── Numpad (CSS-grid placed: 2-tall + / Ent, 2-wide 0) ────────────────────────
export const KB_NUMPAD: KeySpec[] = [
  k('Num', { gc: '1', gr: '1' }), k('/', { code: 'numdiv', gc: '2', gr: '1' }), k('*', { code: 'nummul', gc: '3', gr: '1' }), k('−', { code: 'numsub', gc: '4', gr: '1' }),
  k('7', { code: 'num7', gc: '1', gr: '2' }), k('8', { code: 'num8', gc: '2', gr: '2' }), k('9', { code: 'num9', gc: '3', gr: '2' }), k('+', { code: 'numadd', gc: '4', gr: '2 / span 2' }),
  k('4', { code: 'num4', gc: '1', gr: '3' }), k('5', { code: 'num5', gc: '2', gr: '3' }), k('6', { code: 'num6', gc: '3', gr: '3' }),
  k('1', { code: 'num1', gc: '1', gr: '4' }), k('2', { code: 'num2', gc: '2', gr: '4' }), k('3', { code: 'num3', gc: '3', gr: '4' }), k('Ent', { code: 'nument', gc: '4', gr: '4 / span 2' }),
  k('0', { code: 'num0', gc: '1 / span 2', gr: '5' }), k('.', { code: 'numdot', gc: '3', gr: '5' }),
];

// ── Media keys (icon caps) sitting above the numpad ──────────────────────────
export const KB_MEDIA: KeySpec[] = [
  k('Previous track', { code: 'mprev', mediaPath: 'M5 4v8H3.6V4H5Zm7.4 0v8l-6-4 6-4Z' }),
  k('Play / Pause', { code: 'mplay', mediaPath: 'M5.2 3.6 12 8l-6.8 4.4V3.6Z' }),
  k('Next track', { code: 'mnext', mediaPath: 'M11 4v8h1.4V4H11ZM3.6 4l6 4-6 4V4Z' }),
];

// ── Lighting quick-select groups (code lists) ────────────────────────────────
export const KB_QS_GROUPS: Record<string, string[]> = {
  wasd: ['w', 'a', 's', 'd'],
  qwer: ['q', 'w', 'e', 'r'],
  numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  arrows: ['arrowup', 'arrowleft', 'arrowdown', 'arrowright'],
  functions: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'],
};

/** Every assignable key code on the board (for the "All" lighting quick-select). */
export const ALL_CODES: string[] = [
  ...KB_FROW,
  ...KB_ROWS.flat(),
  ...KB_NAV,
  KB_ARROW_UP,
  ...KB_ARROWS,
  ...KB_NUMPAD,
  ...KB_MEDIA,
]
  .filter((c): c is KeySpec => !isSpacer(c))
  .map((key) => key.code);

/** code → its KeySpec, for the Keys tab target readout (base + fn labels). */
export const KEY_BY_CODE: Map<string, KeySpec> = new Map(
  [...KB_FROW, ...KB_ROWS.flat(), ...KB_NAV, KB_ARROW_UP, ...KB_ARROWS, ...KB_NUMPAD, ...KB_MEDIA]
    .filter((c): c is KeySpec => !isSpacer(c))
    .map((key) => [key.code, key]),
);

/** A key's custom remaps, per layer. */
export interface KeyBinds {
  base?: string;
  fn?: string;
}

export type KbLayer = 'base' | 'fn';
export type KbKind = 'base' | 'fn' | 'dim' | 'custom';

/**
 * The legend text + visual `kind` a key shows on the active layer — the React
 * port of the vanilla `_periRenderKey`. Bindings (bindBase/bindFn) are the
 * user's remaps; for Phase 1 they're always undefined (no binding flow yet).
 */
export function keyLegend(
  key: KeySpec,
  layer: KbLayer,
  isMedia: boolean,
  binds?: { base?: string; fn?: string },
): { text: string; kind: KbKind } {
  if (layer === 'fn') {
    if (binds?.fn != null) return { text: binds.fn, kind: 'custom' };
    if (key.fn != null) return { text: key.fn, kind: 'fn' };
    return { text: key.base, kind: isMedia ? 'base' : 'dim' };
  }
  if (binds?.base != null) return { text: binds.base, kind: 'custom' };
  return { text: key.base, kind: 'base' };
}

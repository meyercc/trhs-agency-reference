import type { RenderKey } from './keyboardRenders';

// Ported from the NGENUITY prototype (src/devices/keyboard/origins65.ts),
// where it was built from Figma; this copy is now the source.

/**
 * The Alloy Origins 65's keys as they sit over its top-down render — Figma
 * Keys-Buttons "Origins 2 65 Key Overlay" (9UJHfxbYuTKiUbquv6u8CD →
 * 6159:120464). `x y w h` are the overlay's own px in its 978.34 × 344.38 box,
 * which is exactly the photo's box, so a key lands on its cap at any size.
 *
 * Codes follow `keyboardLayout.ts` so bindings, the lighting groups and the
 * Keys tab's readout all mean the same key. `fn` is the factory FN-layer
 * function (the FN Layer frame, 6158:60673); `fnIcon` is how that frame draws
 * it. The arrows carry a chevron instead of a label (`icon`).
 */
export type Key65 = RenderKey;

export const BOARD_W = 978.336;
export const BOARD_H = 344.381;

const U = 56;
const k = (base: string, code: string, x: number, y: number, w = U, extra: Partial<Key65> = {}): Key65 => ({ base, code, x, y, w, h: U, ...extra });
const row = (y: number, x0: number, keys: [string, string?][]): Key65[] =>
  keys.map(([base, code], i) => k(base, code ?? base.toLowerCase(), x0 + i * (U + 2), y));

export const KEYS_65: Key65[] = [
  // Number row
  k('`', 'backtick', 27, 28.5),
  ...row(28.5, 85, [['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ['-', 'minus'], ['=', 'equal']]),
  k('Backspace', 'backspace', 781, 28.5, 112),
  k('Del', 'del', 895, 28.5, U, { fn: 'Game Mode', fnIcon: 'game-mode' }),
  // Top row
  k('Tab', 'tab', 27, 86.5, 80),
  ...row(86.5, 109, [['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P']]),
  k('[', 'lbracket', 689, 86.5, U, { fn: 'Brightness −', fnIcon: 'brightness-low' }),
  k(']', 'rbracket', 747, 86.5, U, { fn: 'Brightness +', fnIcon: 'brightness-high' }),
  k('\\', 'backslash', 805, 86.5, 88),
  k('Home', 'home', 895, 86.5, U, { fn: 'End' }),
  // Home row
  k('Caps', 'caps', 27, 144.5, 99),
  ...row(144.5, 128, [['A'], ['S'], ['D'], ['F'], ['G'], ['H'], ['J'], ['K']]),
  k('L', 'l', 592, 144.5, U, { fn: 'Previous', fnIcon: 'media-previous' }),
  k(';', 'semicolon', 650, 144.5, U, { fn: 'Play / Pause', fnIcon: 'play-pause' }),
  k("'", 'quote', 708, 144.5, U, { fn: 'Next', fnIcon: 'media-next' }),
  k('Enter', 'enter', 766, 144.5, 127),
  k('Pg Up', 'pg up', 895, 144.5, U, { fn: 'Ins' }),
  // Bottom letter row
  k('L-Shift', 'lshift', 27, 202.5, 123),
  ...row(202.5, 152, [['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M']]),
  k(',', 'comma', 558, 202.5, U, { fn: 'Vol −', fnIcon: 'volume-down' }),
  k('.', 'period', 616, 202.5, U, { fn: 'Vol +', fnIcon: 'volume-up' }),
  k('/', 'slash', 674, 202.5, U, { fn: 'Mute', fnIcon: 'audio-mute' }),
  k('R-Shift', 'rshift', 732, 202.5, 103, { fn: 'Lighting', fnIcon: 'lights' }),
  k('↑', 'arrowup', 837, 202.5, U, { icon: 'chevron-up' }),
  k('Pg Dn', 'pg dn', 895, 202.5, U, { fn: 'Prnt' }),
  // Modifier row
  k('L-Ctrl', 'lctrl', 27, 260.6, 70),
  k('Win', 'win', 99, 260.6, 70),
  k('L-Alt', 'lalt', 171, 260.6, 70),
  k('Space', 'space', 243, 260.6, 359),
  k('R-Alt', 'ralt', 604, 260.6, 70),
  k('Fn', 'fn', 676, 260.6, 70),
  k('←', 'arrowleft', 778, 260.5, U, { icon: 'chevron-left' }),
  k('↓', 'arrowdown', 837, 260.5, U, { icon: 'chevron-down' }),
  k('→', 'arrowright', 895, 260.5, U, { icon: 'chevron-right' }),
];

/** code → its key, for the Keys tab's readout (base + factory FN labels). */
export const KEY65_BY_CODE: Map<string, Key65> = new Map(KEYS_65.map((key) => [key.code, key]));

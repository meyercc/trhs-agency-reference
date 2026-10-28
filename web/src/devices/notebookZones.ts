// ══════════════════════════════════════════════════════════════════════════════
// NOTEBOOK LIGHTING ZONES — the four bands an OMEN 16 keyboard actually lights.
//
// The laptop's keyboard is FOUR-ZONE RGB, not per-key (HP spec sheet for
// 16-ap1931nr: "Full-size, 4-zone RGB backlit"). The hero is the same
// `KeyboardHero` the standalone keyboard uses, so painting a single cap is
// physically possible in the UI and wrong on the hardware. These groups are
// what keeps the modal honest: picking a zone selects every cap wired to it,
// and the Lights tab paints only through them.
//
// Three vertical bands across the main block, plus the numpad — the usual OMEN
// split. Every code in `ALL_CODES` belongs to exactly one zone; `verify-laptop`
// asserts that partition, so a layout change cannot quietly orphan a key.
// ══════════════════════════════════════════════════════════════════════════════

export interface LightZone {
  id: string;
  /** Shown on the zone chip and used as the accessible name. */
  label: string;
  codes: string[];
}

export const NOTEBOOK_ZONES: LightZone[] = [
  {
    id: 'left',
    label: 'Left',
    codes: [
      'esc', 'f1', 'f2', 'f3', 'f4',
      'backtick', '1', '2', '3', '4',
      'tab', 'q', 'w', 'e', 'r',
      'caps', 'a', 's', 'd', 'f',
      'lshift', 'z', 'x', 'c', 'v',
      'lctrl', 'win', 'lalt',
    ],
  },
  {
    id: 'center',
    label: 'Center',
    codes: [
      'f5', 'f6', 'f7', 'f8',
      '5', '6', '7', '8',
      't', 'y', 'u', 'i',
      'g', 'h', 'j', 'k',
      'b', 'n', 'm',
      'space',
    ],
  },
  {
    id: 'right',
    label: 'Right',
    codes: [
      'f9', 'f10', 'f11', 'f12',
      '9', '0', 'minus', 'equal', 'backspace',
      'o', 'p', 'lbracket', 'rbracket', 'backslash',
      'l', 'semicolon', 'quote', 'enter',
      'comma', 'period', 'slash', 'rshift',
      'ralt', 'fn', 'menu', 'rctrl',
      'prtsc', 'scrlk', 'pause', 'ins', 'home', 'pg up', 'del', 'end', 'pg dn',
      'arrowup', 'arrowleft', 'arrowdown', 'arrowright',
      'mprev', 'mplay', 'mnext',
    ],
  },
  {
    id: 'numpad',
    label: 'Numpad',
    codes: [
      'num', 'numdiv', 'nummul', 'numsub',
      'num7', 'num8', 'num9', 'numadd',
      'num4', 'num5', 'num6',
      'num1', 'num2', 'num3', 'nument',
      'num0', 'numdot',
    ],
  },
];

/** Every code the four zones cover — the "All zones" selection. */
export const ZONE_ALL_CODES: string[] = NOTEBOOK_ZONES.flatMap((z) => z.codes);

/** code → the zone it belongs to, for painting a cap through its whole band. */
export const ZONE_BY_CODE: Map<string, LightZone> = new Map(
  NOTEBOOK_ZONES.flatMap((z) => z.codes.map((c) => [c, z] as [string, LightZone])),
);

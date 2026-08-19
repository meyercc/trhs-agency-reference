// ══════════════════════════════════════════════════════════════════════════════
// KEYS DATA — the assignment palette + rail for the Keys & Macros tab.
// Ported from the vanilla KEYCAP_SETS + the assignment rail / category markup.
// ══════════════════════════════════════════════════════════════════════════════

import type { IconName } from '../components';

/** Palette keycaps per browser category (the draggable/click-to-arm chips). */
export const KEYCAP_SETS: Record<string, string[]> = {
  alphanumeric: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    '-', '=', '[', ']', '\\', ';', "'", '`', ',', '.', '/',
  ],
  special: [
    'Esc', 'Tab', 'Caps', 'L Shift', 'R Shift', 'L Ctrl', 'R Ctrl',
    'L Alt', 'R Alt', 'Win', 'Menu', 'Fn', 'Enter', 'Bksp', 'Space',
    'PrtSc', 'ScrLk', 'Pause', 'Ins', 'Del', 'Home', 'End', 'Pg Up',
    'Pg Dn', '↑', '↓', '←', '→',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  ],
  media: ['Play', 'Pause', 'Stop', 'Prev', 'Next', 'Vol +', 'Vol −', 'Mute', 'Mic Mute', 'Bright +', 'Bright −'],
  ngenuity: ['Profile', 'DPI Stage', 'Game Mode', 'Lighting', 'Macro Rec', 'Layer'],
  mouse: ['Mous L', 'Mous R', 'Mous M', 'Mous 4', 'Mous 5', 'Mous L 2x', 'Mous ▼', 'Mous ▲', 'DPI'],
};

export interface KeyCategory {
  id: string;
  label: string;
  icon: IconName;
}
export const KEY_CATEGORIES: KeyCategory[] = [
  { id: 'alphanumeric', label: 'Alphanumeric Keys', icon: 'keys' },
  { id: 'special', label: 'Special Keys', icon: 'keys' },
  { id: 'media', label: 'Media Controls', icon: 'media-play' },
  { id: 'ngenuity', label: 'NGENUITY Controls', icon: 'star' },
  { id: 'mouse', label: 'Mouse Buttons', icon: 'buttons' },
];

export interface AssignType {
  id: string;
  label: string;
  icon: IconName;
}
export const ASSIGN_TYPES: AssignType[] = [
  { id: 'keys', label: 'Keys / Buttons', icon: 'buttons' },
  { id: 'macro', label: 'Macro', icon: 'macro' },
  { id: 'text', label: 'Text', icon: 'message' },
  { id: 'launcher', label: 'Launcher', icon: 'open-app' },
];

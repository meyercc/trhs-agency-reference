// Lighting vocabulary — the desk's devices and the effects they can run. Kept
// free of three.js so pages (Personalize, Modes, Lighting) can name devices and
// effects without pulling the 3D scene into their bundle; scene.ts renders them.

import type { CameraView } from './scene';

export const DEVICE_IDS = ['tower', 'monitor', 'keyboard', 'mouse', 'headset', 'mic'] as const;
export type DeviceId = (typeof DEVICE_IDS)[number];
export const LABELS: Record<DeviceId, string> = {
  tower: 'OMEN MAX 45L',
  monitor: 'OMEN Monitor',
  keyboard: 'Origins 65',
  mouse: 'Pulsefire',
  headset: 'Cloud III',
  mic: 'SoloCast 2 Pro',
};

// Effects — the HyperX NGENUITY list, in NGENUITY's order, bracketed by Solid
// and Off. Ids 'breathe' and 'rainbow' predate the NGENUITY names (Breathing,
// Color Cycle) and stay as-is so saved modes keep loading.
export type Effect =
  | 'solid'
  | 'wave'
  | 'starlight'
  | 'rainbow'
  | 'breathe'
  | 'raindrop'
  | 'audio-eq'
  | 'rave'
  | 'ripple'
  | 'ghosting'
  | 'confetti'
  | 'sun'
  | 'hyperx'
  | 'swipe'
  | 'off';

export const EFFECTS: { id: Effect; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'wave', label: 'Wave' },
  { id: 'starlight', label: 'Starlight' },
  { id: 'rainbow', label: 'Color Cycle' },
  { id: 'breathe', label: 'Breathing' },
  { id: 'raindrop', label: 'Raindrop' },
  { id: 'audio-eq', label: 'Audio Equalizer' },
  { id: 'rave', label: 'Rave' },
  { id: 'ripple', label: 'Ripple' },
  { id: 'ghosting', label: 'Ghosting' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'sun', label: 'Sun' },
  { id: 'hyperx', label: 'HyperX' },
  { id: 'swipe', label: 'Swipe' },
  { id: 'off', label: 'Off' },
];

/** What a NGENUITY lighting preset's effect glyph runs here. Presets without a
 *  matching animation (Campfire, Captain America) take the nearest one. */
export const PRESET_EFFECT: Record<string, Effect> = {
  wave: 'wave',
  rainbow: 'rainbow',
  fade: 'breathe',
  solid: 'solid',
  confetti: 'confetti',
  flame: 'sun',
  'color-palette': 'solid',
};

/** Effects that bring their own colors — the picked color doesn't describe them. */
export const MULTICOLOR_EFFECTS: Effect[] = ['wave', 'rainbow', 'raindrop', 'audio-eq', 'rave', 'ripple', 'confetti', 'sun', 'hyperx', 'swipe'];

/** Camera views of the desk, in the order they're offered. */
export const CAMERA_VIEWS: { id: CameraView; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'three-quarter', label: '3/4' },
  { id: 'top', label: 'Top' },
  { id: 'side', label: 'Side' },
];

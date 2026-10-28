// Where the camera looks at the tower from on This PC's desktop page: one shot
// per tab (the keys are the tab ids in deviceTabs.ts, pcDeviceTabs), and on
// Chassis lighting one per part being edited. The model is illustrative (the
// 35L, JY 2026-10-20), so a part the model lacks — the graphics card, the
// power supply — is framed where it would sit.
//
// Axes are the scene's: the glass side is −x, the front is +z. A `box` is a
// share of the tower's box, 0–1 on each axis (x glass → solid side, y floor →
// top, z back → front).

import type { FocusShot } from '../../lightstudio/scene';
import type { ChassisZoneId } from '../../lightstudio/towerZones';

const WHOLE_FROM_GLASS: FocusShot = { dir: [-1, 0.16, 0.55], margin: 1.1 };

export const DESKTOP_TAB_SHOTS: Record<string, FocusShot> = {
  // Performance: the machine as a product, its front, with a glimpse through the glass.
  vitals: { dir: [-0.42, 0.16, 1], margin: 1.1 },
  // Chassis lighting, every light at once: through the glass, front fans in view.
  lighting: WHOLE_FROM_GLASS,
  // LCD cooler cap: its screen, on the CPU cooler's face toward the glass
  // (lightstudio/capScreen.ts, CAP_SCREEN_NODE — named here as a string so
  // this file does not pull three.js in), with the cooler and memory round it.
  'cooler-cap': { node: 'cooler-cap-screen', dir: [-1, 0.22, 0.3], margin: 3.2 },
  // Power supply: its bay at the bottom.
  psu: { box: [[0, 0, 0], [1, 0.3, 1]], dir: [-1, 0.12, 0.7], margin: 1.1 },
};

export const DESKTOP_PART_SHOTS: Record<ChassisZoneId, FocusShot> = {
  fans: WHOLE_FROM_GLASS,
  memory: { node: 'Ram', dir: [-1, 0.12, 0.4], margin: 2.1 },
  gpu: { box: [[0, 0.3, 0.05], [1, 0.56, 0.8]], dir: [-1, 0.32, 0.3], margin: 1.2 },
};

/** The shot for a tab, and on Chassis lighting for the part being edited. */
export function desktopShot(tab: string, part: ChassisZoneId | null): FocusShot {
  if (tab === 'lighting' && part) return DESKTOP_PART_SHOTS[part];
  return DESKTOP_TAB_SHOTS[tab] ?? DESKTOP_TAB_SHOTS.vitals;
}

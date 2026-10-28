import { deviceImageUrl } from './skus';

/**
 * One callout slot on a mouse stage: its overlay box's top-left, where its
 * leader leaves the box (`start` — the inner edge, mid-height), the
 * horizontal `run` before the corner, and the `dot` on the button. All in
 * stage px.
 */
export interface CalloutGeo {
  box: [number, number];
  start: [number, number];
  run: number;
  dot: [number, number];
}

/** A mouse with a top-down render laid out as the Figma Buttons stage. */
export interface MouseRender {
  /** Bundled URL of the top-down render. */
  photo: string;
  /** The stage — the region holding the render and its callouts — in its own px. */
  w: number;
  h: number;
  /** The render's box inside the stage. */
  photoBox: { x: number; y: number; w: number; h: number };
  /** Slot (`features.buttons.callouts[].slot`) → its geometry. */
  callouts: Record<string, CalloutGeo>;
}

const RENDERS: Record<string, () => MouseRender | undefined> = {
  // Figma Keys-Buttons "Buttons Assignments / Pulsefire Saga Pro"
  // (9UJHfxbYuTKiUbquv6u8CD → 4631:41576): the 601 × 405.3 region, the
  // render's crop from the frame's own "Photo". Callouts read off the
  // frame's five "Overlay" groups; DPI (`rb`) is not in the frame and
  // follows the pattern, aimed at the button behind the wheel. Ported from
  // the NGENUITY prototype.
  'saga-pro': () => {
    const photo = deviceImageUrl('saga-pro-top.png');
    return photo
      ? {
          photo,
          w: 601,
          h: 405.3,
          photoBox: { x: 187.4, y: 0, w: 223.9, h: 405.3 },
          callouts: {
            lt: { box: [0, 32], start: [121, 52.5], run: 50.19, dot: [220, 97.5] }, // Mouse Left
            lm: { box: [0, 141], start: [121, 161], run: 36.19, dot: [191, 131] }, // Mouse 4
            lb: { box: [0, 250], start: [121, 270], run: 36.19, dot: [196, 234.5] }, // Mouse 5
            rt: { box: [481, 32], start: [480, 52.5], run: 49.69, dot: [381.5, 97.5] }, // Mouse Right
            rm: { box: [481, 141], start: [480, 161], run: 77.69, dot: [300, 62.5] }, // Mouse Middle
            rb: { box: [481, 250], start: [480, 270], run: 46.69, dot: [300, 140] }, // DPI
          },
        }
      : undefined;
  },
};

/**
 * The photo stage for a mouse SKU, when it has one — the default hero on
 * every mouse tab, with overlay callouts on Buttons. Any other mouse keeps
 * its product photo and the anchored callouts. Adding a mouse means a
 * top-down render in `Assets/devices/` plus its stage and slot geometry.
 */
export function mouseRenderFor(skuId: string): MouseRender | undefined {
  return RENDERS[skuId]?.();
}

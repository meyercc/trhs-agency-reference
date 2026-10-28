import type { IconName } from '../components';
import type { KeySpec } from './keyboardLayout';
import { deviceImageUrl } from './skus';
import { BOARD_H, BOARD_W, KEYS_65 } from './origins65';

/**
 * One key as it sits over a keyboard's top-down render: `x y w h` in the
 * render's own px, so it lands on its cap at any size. Codes follow
 * `keyboardLayout.ts`, so bindings, lighting groups and the Keys tab's
 * readout all mean the same key.
 */
export interface RenderKey extends KeySpec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Drawn as a glyph instead of a label (the arrows). */
  icon?: IconName;
  /** How the FN layer draws this key's factory function. */
  fnIcon?: IconName;
}

/** A keyboard that has a top-down render and per-key geometry for it. */
export interface KeyboardRender {
  /** Bundled URL of the top-down render. */
  photo: string;
  /** The render's own box — the units `keys` are placed in. */
  w: number;
  h: number;
  keys: RenderKey[];
  /** The Lights rail's key groups — only the ones this board has. */
  quickSelect: { id: string; label: string }[];
  /**
   * The product render (`<sku>.webp`, the Settings hero) over the keyboard it
   * shows: its width ÷ the keyboard's width inside it. Settings holds the
   * keyboard at the board's box, so the render overflows it by this much.
   */
  heroBleed: number;
}

const RENDERS: Record<string, () => KeyboardRender | undefined> = {
  'origins-65': () => {
    const photo = deviceImageUrl('origins-65-top.webp');
    return photo
      ? {
          photo,
          w: BOARD_W,
          h: BOARD_H,
          keys: KEYS_65,
          // origins-65.webp is 928 × 388 with the keyboard filling 724 × 255, centred.
          heroBleed: 928 / 724,
          // A 65% has no F-row to offer.
          quickSelect: [
            { id: 'all', label: 'All' },
            { id: 'wasd', label: 'WASD' },
            { id: 'qwer', label: 'QWER' },
            { id: 'numbers', label: 'Numbers' },
            { id: 'arrows', label: 'Arrows' },
          ],
        }
      : undefined;
  },
};

/**
 * The photo board for a keyboard SKU, when it has one — the default hero on
 * the Lights and Keys tabs. Any other keyboard falls back to the drawn board
 * (`KeyboardHero`). Adding a keyboard means a top-down render in
 * `Assets/devices/` plus its key geometry, registered here.
 */
export function keyboardRenderFor(skuId: string): KeyboardRender | undefined {
  return RENDERS[skuId]?.();
}

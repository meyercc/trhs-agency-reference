import { useEffect, useRef } from 'react';
import type { LightPreset } from './lightingData';
import { glowRgb, layerPalette, presetMoves, sampleStack, type Rgb } from './backlight';
import { layersOf } from './lightingData';
import type { RenderKey } from './keyboardRenders';

export interface KeyboardBacklightProps {
  keys: RenderKey[];
  /** The render's own box, in the units `keys` are placed in. */
  boardW: number;
  boardH: number;
  /** The active preset — its effect and palette. */
  preset: LightPreset;
  /** Per-key paint, when the editor (or a solid preset) has set one. Wins over the preset for a static effect. */
  keyColors: Map<string, string>;
  /** 0–100. */
  brightness: number;
  on: boolean;
}

/**
 * The backlight under the keyboard render — Figma Lights "Keyboard"
 * (jTyuGY720Py3piUNj0JMcg → 3859:251973): a color layer behind the photo,
 * seen through the gaps between caps and the legends. One cell per key, each
 * a touch bigger than its cap and blurred so neighbours bleed into each other
 * like real backlight does. Animated effects redraw every frame; static ones
 * draw once (and so do animated ones under reduced motion). Nothing is
 * drawn while the lights are off.
 */
export function KeyboardBacklight({ keys, boardW, boardH, preset, keyColors, brightness, on }: KeyboardBacklightProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const layers = layersOf(preset);
    const palettes = layers.map(layerPalette);
    const animated = presetMoves(preset);
    // Applying a preset fills every key with its glow; only a color other than
    // that is a hand paint, which wins over a still stack.
    const fill = glowRgb(preset.glow);
    const handPainted = (c: Rgb | null): c is Rgb => !!c && (c[0] !== fill[0] || c[1] !== fill[1] || c[2] !== fill[2]);
    // Reduced motion: an animated effect draws its first frame and holds it.
    const moving = animated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The render's geometry comes from CSS, so the blur and bleed are tokens too.
    const css = getComputedStyle(canvas);
    const blurPx = parseFloat(css.getPropertyValue('--kb-backlight-blur')) || 0;
    const bleedPx = parseFloat(css.getPropertyValue('--kb-backlight-bleed')) || 0;
    let frame = 0;
    const start = performance.now();

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!on || brightness <= 0) return;
      const t = (performance.now() - start) / 1000;
      const sx = w / boardW;
      const sy = h / boardH;
      const alpha = brightness / 100;
      ctx.filter = blurPx ? `blur(${blurPx}px)` : 'none';
      for (const key of keys) {
        let rgb: Rgb;
        let level = 1;
        const painted = cssRgb(keyColors.get(key.code) ?? '');
        if (!animated && handPainted(painted)) {
          rgb = painted;
        } else {
          const s = sampleStack(layers, palettes, key.code, (key.x + key.w / 2) / boardW, (key.y + key.h / 2) / boardH, t);
          rgb = s.rgb;
          level = s.level;
        }
        ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${(alpha * level).toFixed(3)})`;
        ctx.fillRect(key.x * sx - bleedPx, key.y * sy - bleedPx, key.w * sx + 2 * bleedPx, key.h * sy + 2 * bleedPx);
      }
      if (moving) frame = requestAnimationFrame(draw);
    };

    draw();
    // Redraw once when the board is resized; an animated effect picks the new size up on its next frame anyway.
    const ro = new ResizeObserver(() => !moving && draw());
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [keys, boardW, boardH, preset, keyColors, brightness, on]);

  return <canvas ref={ref} className="kbp-backlight" aria-hidden="true" />;
}

/** "rgb(r, g, b)" → its channels; anything else → null. */
function cssRgb(color: string): Rgb | null {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

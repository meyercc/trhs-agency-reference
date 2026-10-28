import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon, Keycap, ToggleButtonGroup } from '../components';
import type { LightPreset } from './lightingData';
import { keyLegend, type KbLayer, type KeyBinds } from './keyboardLayout';
import type { KeyboardRender, RenderKey } from './keyboardRenders';
import { KeyboardBacklight } from './KeyboardBacklight';

/** The drag type the Keys tab's palette chips carry; plain text is the fallback. */
export const KEYCAP_DRAG_TYPE = 'application/x-trhs-keycap';

/** Movement (px, Manhattan) that turns a press into a drag rather than a click. */
const DRAG_THRESHOLD = 4;

interface KeysModeProps {
  mode: 'keys';
  render: KeyboardRender;
  layer: KbLayer;
  onLayer: (layer: KbLayer) => void;
  selected: string | null;
  /** code → custom per-layer remaps. */
  binds: Map<string, KeyBinds>;
  /** A click on a key — select it, or complete an armed assignment. */
  onKey: (code: string) => void;
  /** A palette chip dropped on a key — assign it on the active layer. */
  onDrop: (code: string, label: string) => void;
}

interface LightsModeProps {
  mode: 'lights';
  render: KeyboardRender;
  /** The picked preset; null draws the board unlit (nothing painted yet). */
  preset: LightPreset | null;
  /** Per-key paint as "rgb(r, g, b)" — empty while the lights are off. */
  keyColors: Map<string, string>;
  brightness: number;
  /** The keys picked for painting. */
  litSel: Set<string>;
  activeQs: string;
  marquee: boolean;
  onMarquee: () => void;
  /** Keys enclosed by a drag. `additive` (Shift) adds to the selection. */
  onMarqueeSelect: (codes: string[], additive: boolean) => void;
  onKey: (code: string) => void;
  onQuickSelect: (id: string) => void;
}

export type KeyboardPhotoProps = KeysModeProps | LightsModeProps;

/**
 * The keyboard hero on the Lights and Keys tabs, for a SKU with a top-down
 * render (`keyboardRenders.ts`): the render with a `Keycap` over every cap,
 * placed in the render's own px and scaled with it. Ported from the NGENUITY
 * prototype; any other keyboard keeps the drawn board (`KeyboardHero`).
 *
 * Keys (Figma Keys-Buttons 6158:60661 / 6158:60673): the Key Overlay on each
 * cap, the layer toggle above. Assign by clicking a key then a palette chip
 * (either order), or by dragging a chip onto a key.
 *
 * Lights (Figma Lights 3859:251966): the backlight drawn live under the
 * render (`KeyboardBacklight`), hit-area Keycaps over the caps for picking —
 * click, the quick-select rail, or a marquee drag. A hit area carries
 * `data-paint` while the board shows paint on it, so the CDP suites can read
 * what the canvas drew.
 */
export function KeyboardPhoto(props: KeyboardPhotoProps) {
  const { render } = props;
  const boardRef = useRef<HTMLDivElement>(null);
  // Keys mode: the key a chip is being dragged over.
  const [over, setOver] = useState<string | null>(null);
  // Lights mode: the marquee box being dragged, in board px; null between drags.
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // A drag ends over a key and would otherwise fire that key's click, toggling
  // it straight back out of the selection it just joined.
  const draggedRef = useRef(false);
  const armed = props.mode === 'lights' && props.marquee;
  const onMarquee = props.mode === 'lights' ? props.onMarquee : undefined;

  // Escape disarms the tool rather than closing the modal — claim it on the way down.
  useEffect(() => {
    if (!armed || !onMarquee) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onMarquee();
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [armed, onMarquee]);

  // Listeners go on the window: a drag that leaves the board still has to finish.
  const onBoardPointerDown = (e: ReactPointerEvent) => {
    const board = boardRef.current;
    if (props.mode !== 'lights' || !armed || e.button !== 0 || !board) return;
    const { onMarqueeSelect } = props;
    draggedRef.current = false;
    const rect = board.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!draggedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      setBox({ left: Math.min(x0, ev.clientX) - rect.left, top: Math.min(y0, ev.clientY) - rect.top, width: Math.abs(dx), height: Math.abs(dy) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setBox(null);
      if (!draggedRef.current) return;
      const r = { left: Math.min(x0, ev.clientX), right: Math.max(x0, ev.clientX), top: Math.min(y0, ev.clientY), bottom: Math.max(y0, ev.clientY) };
      // Any overlap counts — a box drawn across a row takes the keys it crosses.
      const hits = [...board.querySelectorAll<HTMLElement>('.ds-keycap[data-code]')]
        .filter((el) => {
          const k = el.getBoundingClientRect();
          return k.left < r.right && k.right > r.left && k.top < r.bottom && k.bottom > r.top;
        })
        .map((el) => el.dataset.code)
        .filter((c): c is string => !!c);
      onMarqueeSelect(hits, ev.shiftKey);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const labelOf = (e: DragEvent) => e.dataTransfer.getData(KEYCAP_DRAG_TYPE) || e.dataTransfer.getData('text/plain');
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(KEYCAP_DRAG_TYPE) || e.dataTransfer.types.includes('text/plain');

  const place = (key: RenderKey): CSSProperties => ({
    left: `${(key.x / render.w) * 100}%`,
    top: `${(key.y / render.h) * 100}%`,
    width: `${(key.w / render.w) * 100}%`,
    height: `${(key.h / render.h) * 100}%`,
  });

  const renderKeysKey = (key: RenderKey, p: KeysModeProps) => {
    const bind = p.binds.get(key.code);
    const { text, kind } = keyLegend(key, p.layer, false, bind);
    const bound = p.layer === 'fn' ? bind?.fn : bind?.base;
    // Glyph caps: the arrows always; an FN function drawn as a glyph while it is the legend.
    const icon = kind === 'fn' && key.fnIcon ? key.fnIcon : kind === 'base' || kind === 'dim' ? key.icon : undefined;
    return (
      <Keycap
        key={key.code}
        style={place(key)}
        label={text}
        icon={icon}
        dim={kind === 'dim'}
        selected={p.selected === key.code}
        assigned={bound != null}
        dropTarget={over === key.code}
        data-code={key.code}
        data-kind={kind}
        aria-label={bound != null ? `${key.base}, assigned ${bound}` : key.base}
        onClick={() => p.onKey(key.code)}
        onDragOver={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (over !== key.code) setOver(key.code);
        }}
        onDragLeave={() => setOver((o) => (o === key.code ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          const label = labelOf(e);
          if (label) p.onDrop(key.code, label);
        }}
      />
    );
  };

  const lit = props.mode === 'lights' && props.preset != null && props.brightness > 0;

  const renderLightsKey = (key: RenderKey, p: LightsModeProps) => (
    <Keycap
      key={key.code}
      variant="hit"
      style={place(key)}
      picked={p.litSel.has(key.code)}
      data-code={key.code}
      data-paint={lit ? (p.keyColors.get(key.code) ?? undefined) : undefined}
      aria-label={key.base}
      onClick={() => {
        if (draggedRef.current) return;
        p.onKey(key.code);
      }}
    />
  );

  return (
    <div className="kbd-stage kbp-stage" data-kb-mode={props.mode}>
      {props.mode === 'keys' ? (
        <ToggleButtonGroup
          className="kbd-layer-toggle"
          aria-label="Keyboard layer"
          value={props.layer}
          onChange={(v) => props.onLayer(v as KbLayer)}
          options={[
            { label: 'Base Layer', value: 'base' },
            { label: 'FN Layer', value: 'fn' },
          ]}
        />
      ) : (
        <div className="kbd-quickselect" role="toolbar" aria-label="Lighting quick-select">
          {/* The marquee tool leads: it is how you build a selection the groups don't cover. */}
          <button
            type="button"
            className={'kbd-qs-btn kbd-qs-icon' + (props.marquee ? ' active' : '')}
            aria-pressed={props.marquee}
            aria-label="Custom select — drag a box across the board"
            onClick={props.onMarquee}
          >
            <Icon name="select" size="sm" />
          </button>
          <button type="button" className="kbd-qs-btn" onClick={() => props.onQuickSelect('reset')}>
            Reset
          </button>
          <span className="kbd-qs-divider" />
          {render.quickSelect.map((q) => (
            <button key={q.id} type="button" className={'kbd-qs-btn' + (props.activeQs === q.id ? ' active' : '')} onClick={() => props.onQuickSelect(q.id)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={boardRef}
        className="kbp-board"
        style={{ ['--kbp-w' as string]: render.w, ['--kbp-h' as string]: render.h }}
        data-kb-layer={props.mode === 'keys' ? props.layer : undefined}
        data-marquee={armed ? '' : undefined}
        role="group"
        aria-label="Keyboard keys"
        onPointerDown={onBoardPointerDown}
      >
        {props.mode === 'lights' && props.preset && (
          <KeyboardBacklight
            keys={render.keys}
            boardW={render.w}
            boardH={render.h}
            preset={props.preset}
            keyColors={props.keyColors}
            brightness={props.brightness}
            on={lit}
          />
        )}
        <img className="kbp-photo" src={render.photo} alt="" draggable={false} />
        {render.keys.map((key) => (props.mode === 'keys' ? renderKeysKey(key, props) : renderLightsKey(key, props)))}
        {box && <div className="kbd-marquee" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} aria-hidden="true" />}
      </div>
    </div>
  );
}

/**
 * The Settings tab's hero for a SKU with a photo board: the product render
 * held at the board's size, so the keyboard doesn't change size or move as
 * the tabs switch. The figure is the board's box (`.kbp-board`) under a
 * spacer the height of the layer toggle / rail; the render overflows the box
 * by its transparent margin (`heroBleed`), which lands its keyboard on it.
 */
export function KeyboardRenderHero({ render, src, alt }: { render: KeyboardRender; src: string; alt: string }) {
  return (
    <div className="kbd-stage kbp-stage">
      <span className="kbp-spacer" aria-hidden="true" />
      <div
        className="kbp-board"
        style={{ ['--kbp-w' as string]: render.w, ['--kbp-h' as string]: render.h, ['--kbp-bleed' as string]: render.heroBleed }}
      >
        <img className="kbp-hero" src={src} alt={alt} draggable={false} />
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Icon, ToggleButtonGroup } from '../components';
import {
  KB_FROW,
  KB_ROWS,
  KB_NAV,
  KB_ARROW_UP,
  KB_ARROWS,
  KB_NUMPAD,
  KB_MEDIA,
  keyLegend,
  isSpacer,
  type Cell,
  type KeySpec,
  type KbLayer,
  type KeyBinds,
} from './keyboardLayout';

/**
 * Interactive keyboard hero — the vector HyperX Origins 65 board that fills the
 * top of the keyboard device modal (ported from the vanilla `.kbd` hero).
 * Controlled: all state (layer / selection / lighting) lives in KeyboardCanvas
 * so the Lighting and Keys panels can drive and read it.
 *   • Keys mode  → Base/FN toggle; clicking a key selects it (assignment target).
 *   • Lights mode → quick-select rail + click-to-toggle a key's lighting select;
 *                  applied preset/editor colours paint keys via `--key-rgb`.
 */

/** Movement (px, Manhattan) that turns a press into a drag rather than a click. */
const DRAG_THRESHOLD = 4;

const QUICK_SELECT: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wasd', label: 'WASD' },
  { id: 'qwer', label: 'QWER' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'functions', label: 'Functions' },
];

export interface KeyboardHeroProps {
  mode: 'lights' | 'keys';
  layer: KbLayer;
  onLayer: (layer: KbLayer) => void;
  selected: string | null;
  litSel: Set<string>;
  /** code → applied backlight colour (CSS colour string). */
  keyColors: Map<string, string>;
  /** code → custom per-layer remaps. */
  binds: Map<string, KeyBinds>;
  activeQs: string;
  /** Is the marquee tool armed? Drag on the board selects the keys inside a box. */
  marquee: boolean;
  onMarquee: () => void;
  /** Keys enclosed by a drag. `additive` (Shift) adds to the selection. */
  onMarqueeSelect: (codes: string[], additive: boolean) => void;
  onKey: (code: string) => void;
  onQuickSelect: (id: string) => void;
}

interface KeyCapProps {
  spec: KeySpec;
  layer: KbLayer;
  selected: boolean;
  litSel: boolean;
  color?: string;
  bind?: KeyBinds;
  onClick: () => void;
}
function KeyCap({ spec, layer, selected, litSel, color, bind, onClick }: KeyCapProps) {
  const isMedia = spec.mediaPath != null;
  const { text, kind } = keyLegend(spec, layer, isMedia, bind);
  const cls = [
    'kbd-key',
    isMedia && 'kbd-media-key',
    selected && 'selected',
    litSel && 'lit-sel',
    color && 'lit',
  ]
    .filter(Boolean)
    .join(' ');
  const style = {
    ...(spec.w ? { ['--kw' as string]: spec.w } : null),
    ...(spec.gc ? { gridColumn: spec.gc } : null),
    ...(spec.gr ? { gridRow: spec.gr } : null),
    ...(color ? { ['--key-rgb' as string]: color } : null),
  } as React.CSSProperties;
  return (
    <button
      type="button"
      className={cls}
      data-code={spec.code}
      data-kind={kind}
      data-has-fn={spec.fn != null ? '' : undefined}
      data-bind-base={bind?.base != null ? '' : undefined}
      data-bind-fn={bind?.fn != null ? '' : undefined}
      style={style}
      aria-label={spec.base}
      onClick={onClick}
    >
      <span className="kbd-key-cap">{text}</span>
      {isMedia && (
        <svg className="kbd-media-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d={spec.mediaPath} fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

export function KeyboardHero({
  mode,
  layer,
  onLayer,
  selected,
  litSel,
  keyColors,
  binds,
  activeQs,
  marquee,
  onMarquee,
  onMarqueeSelect,
  onKey,
  onQuickSelect,
}: KeyboardHeroProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  // The box being dragged, in board-local px. null when no drag is in progress.
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // A drag ends over a key and would otherwise fire that key's click, toggling
  // it straight back out of the selection it just joined.
  const draggedRef = useRef(false);
  const armed = mode === 'lights' && marquee;

  // Escape disarms the tool rather than closing the device modal — the host
  // listens on the document, so this has to claim the key on the way down.
  useEffect(() => {
    if (!armed) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onMarquee();
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [armed, onMarquee]);

  // Listeners go on the window, not the board: a drag that leaves the board
  // still has to finish, and pointer capture here would swallow the click that
  // a press-without-drag is supposed to deliver to the key underneath.
  const onBoardPointerDown = (e: React.PointerEvent) => {
    const board = boardRef.current;
    if (!armed || e.button !== 0 || !board) return;
    draggedRef.current = false;
    const rect = board.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!draggedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      setBox({
        left: Math.min(x0, ev.clientX) - rect.left,
        top: Math.min(y0, ev.clientY) - rect.top,
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setBox(null);
      if (!draggedRef.current) return;
      const r = {
        left: Math.min(x0, ev.clientX),
        right: Math.max(x0, ev.clientX),
        top: Math.min(y0, ev.clientY),
        bottom: Math.max(y0, ev.clientY),
      };
      // Any overlap counts, not full containment — a box drawn across a row is
      // meant to take the keys it crosses, not only the ones it swallows whole.
      const hits = [...board.querySelectorAll<HTMLElement>('.kbd-key')]
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

  const renderKey = (spec: KeySpec) => (
    <KeyCap
      key={spec.code}
      spec={spec}
      layer={layer}
      selected={selected === spec.code}
      litSel={litSel.has(spec.code)}
      color={keyColors.get(spec.code)}
      bind={binds.get(spec.code)}
      onClick={() => {
        if (draggedRef.current) return;
        onKey(spec.code);
      }}
    />
  );

  const Row = ({ cells, extraClass }: { cells: Cell[]; extraClass?: string }) => (
    <div className={'kbd-row' + (extraClass ? ' ' + extraClass : '')}>
      {cells.map((c, i) =>
        isSpacer(c) ? (
          <div key={i} className="kbd-sp" style={{ ['--kw' as string]: c.sp } as React.CSSProperties} />
        ) : (
          renderKey(c)
        ),
      )}
    </div>
  );

  return (
    <div className="kbd-stage" data-kb-mode={mode}>
      {mode === 'keys' ? (
        <ToggleButtonGroup
          className="kbd-layer-toggle"
          aria-label="Keyboard layer"
          value={layer}
          onChange={(v) => onLayer(v as KbLayer)}
          options={[
            { label: 'Base Layer', value: 'base' },
            { label: 'FN Layer', value: 'fn' },
          ]}
        />
      ) : (
        <div className="kbd-quickselect" role="toolbar" aria-label="Lighting quick-select">
          {/* The marquee tool leads the rail, ahead of Reset and the presets:
              it is how you build a selection the presets don't cover. Armed
              state is a filled chip as well as a brighter glyph — pressed is
              never carried by colour alone. */}
          <button
            type="button"
            className={'kbd-qs-btn kbd-qs-icon' + (marquee ? ' active' : '')}
            aria-pressed={marquee}
            aria-label="Custom select — drag a box across the board"
            onClick={onMarquee}
          >
            <Icon name="select" size={16} />
          </button>
          <button type="button" className="kbd-qs-btn" onClick={() => onQuickSelect('reset')}>
            Reset
          </button>
          <span className="kbd-qs-divider" />
          {QUICK_SELECT.map((q) => (
            <button
              key={q.id}
              type="button"
              className={'kbd-qs-btn' + (activeQs === q.id ? ' active' : '')}
              onClick={() => onQuickSelect(q.id)}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="kbd"
        data-kb-layer={layer}
        data-marquee={armed ? '' : undefined}
        ref={boardRef}
        onPointerDown={onBoardPointerDown}
      >
        {box && (
          <div
            className="kbd-marquee"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            aria-hidden="true"
          />
        )}
        {/* Main block — F-row + 5 rows */}
        <div className="kbd-main">
          <Row cells={KB_FROW} />
          {KB_ROWS.map((row, i) => (
            <Row key={i} cells={row} />
          ))}
        </div>

        {/* Nav cluster — 3×3, gap, inverted-T arrows */}
        <div className="kbd-nav">
          {[0, 3, 6].map((start) => (
            <Row key={start} cells={KB_NAV.slice(start, start + 3)} />
          ))}
          <div className="kbd-row kbd-row-gap" />
          <Row cells={[KB_ARROW_UP]} extraClass="kbd-row-up" />
          <Row cells={KB_ARROWS} />
        </div>

        {/* Right — media keys + knob above the numpad */}
        <div className="kbd-right">
          <div className="kbd-media">
            {KB_MEDIA.map(renderKey)}
            <div className="kbd-knob" aria-hidden="true" />
          </div>
          <div className="kbd-numpad">{KB_NUMPAD.map(renderKey)}</div>
        </div>
      </div>
    </div>
  );
}

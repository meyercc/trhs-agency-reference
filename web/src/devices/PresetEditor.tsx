import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  AngleDial,
  Button,
  ColorSlider,
  ContextMenu,
  GradientStops,
  Icon,
  IconButton,
  Input,
  ListItem,
  Ng3Label,
  Ng3Section,
  Slider,
  Stepper,
  Swatch,
  gradientOf,
  type IconName,
} from '../components';
import {
  EFFECTS,
  GRADIENT_PRESETS,
  HEX_RE,
  MAX_STOPS,
  SWATCHES,
  effectLabel,
  hexToHsl,
  hslToHex,
  type EffectFx,
  type EffectLayer,
} from './lightingData';
import { layerPalette, sample } from './backlight';

/**
 * The preset editor — the controls of Figma Lights "Presets Overlay Panel"
 * (gradient effect jTyuGY720Py3piUNj0JMcg → 3859:251953; single color
 * 32:34411), laid out as the macro editor is (MacroPanel): it takes the preset
 * list's place, its head is "‹ Presets" back plus how the edit stands, the
 * preset's name is a field rather than a second title under the panel's
 * LIGHTS, and Cancel / Save sit at the foot. A preset is a
 * stack of effect layers: the Effects rail lists them (Add Effect picks a
 * type to stack on top), and the parameters follow the selected layer —
 * Solid edits one color; every other effect edits a gradient (stops on a bar,
 * each opened in a picker popover; the gradient presets underneath) plus its
 * direction and speed. Opacity is every layer's.
 */

export interface EditorState {
  title: string;
  /** The preset being edited; unset when the editor is making a new one. */
  editingId?: string;
  layers: EffectLayer[];
  /** The layer whose parameters are showing. */
  active: number;
}

const newLayer = (fx: EffectFx, from?: EffectLayer): EffectLayer => ({
  fx,
  colors: fx === 'solid' ? [from?.colors[0] ?? SWATCHES[0]] : from && from.colors.length > 1 ? from.colors : GRADIENT_PRESETS[0],
  angle: from?.angle ?? 360,
  speed: from?.speed ?? 50,
  opacity: 100,
});

export const newEditor = (title: string): EditorState => ({ title, layers: [newLayer('wave')], active: 0 });

const sameColors = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());

/** Close a floating panel on an outside press or Escape (claimed, so the modal behind stays). */
function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, refs, close]);
}

export function PresetEditor({
  editor,
  setEditor,
  state,
  onColor,
  onCancel,
  onSave,
}: {
  editor: EditorState;
  /** How the edit stands, shown at the head's right: New, Not saved, Saved. */
  state: string;
  setEditor: React.Dispatch<React.SetStateAction<EditorState | null>>;
  /** A color was edited — the tab paints the lit-selected keys with it. */
  onColor: (hex: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const layer = editor.layers[editor.active];
  const solid = layer.fx === 'solid';
  // Colors and gradients added with "+" this session, ahead of the defaults.
  const [mySwatches, setMySwatches] = useState<string[]>([]);
  const [myGradients, setMyGradients] = useState<string[][]>([]);

  const patchLayer = (patch: Partial<EffectLayer>) =>
    setEditor((ed) => (ed ? { ...ed, layers: ed.layers.map((l, i) => (i === ed.active ? { ...l, ...patch } : l)) } : ed));
  const setColorAt = (index: number, hex: string) => {
    patchLayer({ colors: layer.colors.map((c, i) => (i === index ? hex : c)) });
    onColor(hex);
  };

  // ── Effects rail ──
  const addRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [addAt, setAddAt] = useState<{ x: number; y: number } | null>(null);
  useDismiss(!!addAt, [addRef, addMenuRef], () => setAddAt(null));
  useEffect(() => {
    if (addAt) addMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [addAt]);
  const openAdd = () => {
    const r = addRef.current?.getBoundingClientRect();
    if (r) setAddAt((a) => (a ? null : { x: r.left, y: r.bottom }));
  };
  const addLayer = (fx: EffectFx) => {
    setEditor((ed) => (ed ? { ...ed, layers: [...ed.layers, newLayer(fx, ed.layers[ed.active])], active: ed.layers.length } : ed));
    setAddAt(null);
  };
  const removeLayer = (i: number) =>
    setEditor((ed) => {
      if (!ed || ed.layers.length < 2) return ed;
      const layers = ed.layers.filter((_, k) => k !== i);
      return { ...ed, layers, active: Math.min(ed.active > i ? ed.active - 1 : ed.active, layers.length - 1) };
    });
  const pressable = (run: () => void) => ({
    onClick: run,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        run();
      }
    },
  });

  return (
    <div className="pdm-editor" role="group" aria-label={`Edit ${editor.title || 'preset'}`}>
      {/* Where you are, as the macro editor says it: the way back to the list
          (leaving drops the edit, as Cancel does) and how this edit stands. */}
      <div className="pdm-editor-head">
        <button type="button" className="pdm-editor-back" onClick={onCancel}>
          <Icon name="chevron-left" size={14} /> Presets
        </button>
        <span className="pdm-editor-state">{state}</span>
      </div>
      <div className="pdm-editor-body">
        <Ng3Section className="pdm-editor-effects">
          <Ng3Label strong>Name</Ng3Label>
          <Input
            aria-label="Preset name"
            value={editor.title}
            onChange={(e) => {
              const title = e.target.value;
              setEditor((ed) => (ed ? { ...ed, title } : ed));
            }}
          />
          <Ng3Label strong>Effects</Ng3Label>
          <div className="pdm-fx-list">
            <div ref={addRef}>
              <ListItem
                label="Add Effect"
                leading={<Icon name="add" size="sm" />}
                role="button"
                aria-haspopup="menu"
                aria-expanded={!!addAt}
                {...pressable(openAdd)}
              />
            </div>
            {/* Top of the stack first, as a layers list reads. */}
            <div className="pdm-fx-layers" role="listbox" aria-label="Effect layers">
            {editor.layers
              .map((l, i) => ({ l, i }))
              .reverse()
              .map(({ l, i }) => (
                <ListItem
                  key={i}
                  label={effectLabel(l.fx)}
                  leading={<Icon name={l.fx as IconName} size="sm" />}
                  selected={i === editor.active}
                  className="pdm-fx-layer"
                  trailing={
                    editor.layers.length > 1 ? (
                      <IconButton
                        variant="ghost"
                        className="sm"
                        label={`Remove ${effectLabel(l.fx)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLayer(i);
                        }}
                      >
                        <Icon name="close" size="sm" />
                      </IconButton>
                    ) : undefined
                  }
                  {...pressable(() => setEditor((ed) => (ed ? { ...ed, active: i } : ed)))}
                />
              ))}
            </div>
          </div>
          {addAt &&
            createPortal(
              <ContextMenu ref={addMenuRef} className="pdm-fx-menu" aria-label="Add effect" style={{ left: addAt.x, top: addAt.y }}>
                {EFFECTS.map((e) => (
                  <ListItem
                    key={e.fx}
                    role="menuitem"
                    leading={<Icon name={e.fx as IconName} size="sm" aria-hidden />}
                    label={e.label}
                    {...pressable(() => addLayer(e.fx))}
                  />
                ))}
              </ContextMenu>,
              document.body,
            )}
        </Ng3Section>

        <Ng3Section className="pdm-editor-params">
          <div className="pdm-editor-cols">
            <div className="pdm-color">
              <Ng3Label strong>Color</Ng3Label>
              {solid ? (
                <SolidColor
                  hex={layer.colors[0]}
                  opacity={layer.opacity}
                  swatches={[...mySwatches, ...SWATCHES]}
                  onHex={(hex) => setColorAt(0, hex)}
                  onOpacity={(opacity) => patchLayer({ opacity })}
                  onKeep={(hex) => setMySwatches((s) => (s.includes(hex) || SWATCHES.includes(hex) ? s : [hex, ...s]))}
                />
              ) : (
                <GradientColor
                  colors={layer.colors}
                  presets={[...myGradients, ...GRADIENT_PRESETS]}
                  swatches={[...mySwatches, ...SWATCHES]}
                  onColors={(colors) => patchLayer({ colors })}
                  onStop={setColorAt}
                  onKeepSwatch={(hex) => setMySwatches((s) => (s.includes(hex) || SWATCHES.includes(hex) ? s : [hex, ...s]))}
                  onKeep={() => setMyGradients((g) => (g.some((x) => sameColors(x, layer.colors)) ? g : [layer.colors, ...g]))}
                />
              )}
            </div>

            <div className="pdm-editor-vrule" />

            <div className="pdm-fx-params">
              {!solid && (
                <>
                  <div className="pdm-fx-group">
                    <Ng3Label strong>Direction Angle</Ng3Label>
                    <div className="pdm-angle">
                      <AngleDial value={layer.angle % 360} onChange={(angle) => patchLayer({ angle })} aria-label="Direction angle" />
                      <Stepper
                        size="sm"
                        value={layer.angle}
                        min={0}
                        max={360}
                        step={15}
                        precision={0}
                        onChange={(angle) => patchLayer({ angle })}
                        aria-label="Direction angle in degrees"
                      />
                    </div>
                  </div>
                  <div className="pdm-fx-group">
                    <div className="pdm-fx-slider-head">
                      <Ng3Label strong>Speed</Ng3Label>
                      <span className="pdm-fx-val">{layer.speed}</span>
                    </div>
                    <Slider min={0} max={100} value={layer.speed} onChange={(speed) => patchLayer({ speed })} aria-label="Speed" />
                  </div>
                </>
              )}
              <div className="pdm-fx-group">
                <div className="pdm-fx-slider-head">
                  <Ng3Label strong>Opacity</Ng3Label>
                  <span className="pdm-fx-val">{layer.opacity}</span>
                </div>
                <Slider min={0} max={100} value={layer.opacity} onChange={(opacity) => patchLayer({ opacity })} aria-label="Layer opacity" />
              </div>
            </div>
          </div>
        </Ng3Section>
      </div>
      <div className="pdm-editor-foot">
        <Button variant="default" onClick={onCancel}>
          <Icon name="close" size="sm" />
          Cancel
        </Button>
        <Button variant="accent" onClick={onSave} disabled={!editor.title.trim()}>
          <Icon name="check" size="sm" />
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Color controls ────────────────────────────────────────────────────────────

/**
 * Hue + lightness tracks, the hex field (copy) and, where the browser has one,
 * the screen eyedropper. Saturation is held — the tracks are Figma's.
 */
function ColorTracks({ hex, onHex, children }: { hex: string; onHex: (hex: string) => void; children?: React.ReactNode }) {
  const hsl = hexToHsl(hex);
  const cur = `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
  const [text, setText] = useState(hex.slice(1).toUpperCase());
  useEffect(() => setText(hex.slice(1).toUpperCase()), [hex]);
  const set = (patch: Partial<typeof hsl>) => {
    const next = { ...hsl, ...patch };
    onHex(hslToHex(next.h, next.s, next.l));
  };
  return (
    <div className="pdm-color-main">
      <div className="pdm-color-sliders">
        <ColorSlider variant="hue" min={0} max={360} value={hsl.h} color={cur} aria-label="Hue" onChange={(h) => set({ h })} />
        <ColorSlider variant="lightness" min={0} max={100} value={hsl.l} color={cur} aria-label="Lightness" onChange={(l) => set({ l })} />
        {children}
      </div>
      <div className="pdm-hex-row">
        <Input
          variant="hex"
          wrapClassName="pdm-hex"
          value={text}
          maxLength={6}
          spellCheck={false}
          aria-label="Hex color"
          trailingIcon="duplicate"
          trailingLabel="Copy hex"
          onTrailingClick={() => navigator.clipboard?.writeText('#' + text)}
          onChange={(e) => {
            setText(e.target.value);
            if (HEX_RE.test(e.target.value.trim())) {
              const p = hexToHsl(e.target.value.trim());
              onHex(hslToHex(p.h, p.s, p.l));
            }
          }}
        />
        {/* Where the browser has no EyeDropper the control is not offered,
            rather than sitting there dead. */}
        {'EyeDropper' in window && (
          <IconButton
            label="Pick a color from the screen"
            onClick={async () => {
              try {
                const picked = await new (window as unknown as {
                  EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
                }).EyeDropper().open();
                onHex(picked.sRGBHex);
              } catch {
                /* the user dismissed the picker */
              }
            }}
          >
            <Icon name="eyedropper" size="sm" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** The swatch grid — Figma's ten-up palette with "+" keeping the current color. */
function SwatchGrid({ hex, swatches, onHex, onKeep }: { hex: string; swatches: string[]; onHex: (hex: string) => void; onKeep: (hex: string) => void }) {
  return (
    <div className="pdm-swatches">
      {swatches.map((sw) => (
        <Swatch key={sw} color={sw} label={sw.toUpperCase()} selected={sw.toLowerCase() === hex.toLowerCase()} onClick={() => onHex(sw)} />
      ))}
      <IconButton className="pdm-sw-add" label="Keep this color in the swatches" onClick={() => onKeep(hex.toLowerCase())}>
        <Icon name="add" size="sm" />
      </IconButton>
    </div>
  );
}

/** Figma "single color effect": the color as a wide swatch, the tracks, the palette. */
function SolidColor({
  hex,
  opacity,
  swatches,
  onHex,
  onOpacity,
  onKeep,
}: {
  hex: string;
  opacity: number;
  swatches: string[];
  onHex: (hex: string) => void;
  onOpacity: (v: number) => void;
  onKeep: (hex: string) => void;
}) {
  const hsl = hexToHsl(hex);
  return (
    <>
      <div className="pdm-color-pills">
        <Swatch wide color={hex} selected label={`Color ${hex.toUpperCase()}`} tabIndex={-1} />
      </div>
      <div className="pdm-color-body">
        <ColorTracks hex={hex} onHex={onHex}>
          {/* Figma's third track is the layer's opacity — the same value as
              the Opacity slider, shown against the color it fades. */}
          <ColorSlider
            variant="opacity"
            min={0}
            max={100}
            value={opacity}
            color={`hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`}
            aria-label="Color opacity"
            onChange={onOpacity}
          />
        </ColorTracks>
        <div className="pdm-color-vrule" />
        <SwatchGrid hex={hex} swatches={swatches} onHex={onHex} onKeep={onKeep} />
      </div>
    </>
  );
}

/**
 * Figma "gradient effect": the stops on the bar (a handle opens that stop in a
 * picker popover; the bar inserts a stop), the gradient presets underneath,
 * "+" keeping the current gradient among them.
 */
function GradientColor({
  colors,
  presets,
  swatches,
  onColors,
  onStop,
  onKeepSwatch,
  onKeep,
}: {
  colors: string[];
  presets: string[][];
  swatches: string[];
  onColors: (colors: string[]) => void;
  onStop: (index: number, hex: string) => void;
  onKeepSwatch: (hex: string) => void;
  onKeep: () => void;
}) {
  const [open, setOpen] = useState<{ index: number; x: number; y: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useDismiss(!!open, [barRef, popRef], () => setOpen(null));
  useEffect(() => {
    if (open) popRef.current?.querySelector<HTMLElement>('[role="slider"], input')?.focus();
  }, [open?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const insert = (fraction: number) => {
    if (colors.length >= MAX_STOPS) return;
    // The new stop takes the color the gradient already has there.
    const [r, g, b] = sample(layerPalette({ fx: 'wave', colors, angle: 0, speed: 0, opacity: 100 }), fraction * ((colors.length - 1) / colors.length));
    const hex = '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
    const at = Math.min(colors.length - 1, Math.max(1, Math.round(fraction * (colors.length - 1)) || 1));
    onColors([...colors.slice(0, at), hex, ...colors.slice(at)]);
  };
  const remove = (index: number) => {
    if (colors.length <= 2) return;
    onColors(colors.filter((_, i) => i !== index));
    setOpen(null);
  };

  return (
    <>
      <div className="pdm-gradient">
        <GradientStops
          ref={barRef}
          colors={colors}
          active={open?.index ?? null}
          label="Gradient"
          onInsert={colors.length < MAX_STOPS ? insert : undefined}
          onSelect={(index, handle) => {
            const r = handle.getBoundingClientRect();
            setOpen((o) => (o?.index === index ? null : { index, x: r.left + r.width / 2, y: r.bottom }));
          }}
        />
      </div>
      <div className="pdm-gradient-presets">
        {presets.map((p) => (
          <Swatch key={p.join()} wide gradient={gradientOf(p)} selected={sameColors(p, colors)} label={`Gradient of ${p.length} colors`} onClick={() => onColors(p)} />
        ))}
        <IconButton variant="ghost" label="Keep this gradient in the presets" onClick={onKeep}>
          <Icon name="add" size="sm" />
        </IconButton>
      </div>
      {open &&
        createPortal(
          <ContextMenu
            ref={popRef}
            role="dialog"
            className="pdm-stop-pop"
            aria-label={`Gradient stop ${open.index + 1}`}
            style={{ left: open.x, top: open.y }}
          >
            <div className="pdm-stop-body">
              <ColorTracks hex={colors[open.index]} onHex={(hex) => onStop(open.index, hex)} />
              <SwatchGrid hex={colors[open.index]} swatches={swatches} onHex={(hex) => onStop(open.index, hex)} onKeep={onKeepSwatch} />
            </div>
            <div className="pdm-stop-foot">
              <Button variant="default" size="sm" disabled={colors.length <= 2} onClick={() => remove(open.index)}>
                <Icon name="trash" size="sm" />
                Remove stop
              </Button>
            </div>
          </ContextMenu>,
          document.body,
        )}
    </>
  );
}

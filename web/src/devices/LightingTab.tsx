import { useEffect, useRef, useState } from 'react';
import './lighting-tab.css';
import {
  Button,
  ColorSlider,
  Icon,
  IconButton,
  ListItem,
  Ng3Grid,
  Ng3Section,
  Ng3Label,
  Slider,
  SoftwareOnly,
  Swatch,
} from '../components';
import {
  SWATCHES,
  HEX_RE,
  hexToHsl,
  hslToHex,
  hslToRgbStr,
  type LightPreset,
  type Hsl,
} from './lightingData';
import { useSettings } from '../state/Settings';

/**
 * Lighting tab — preset picker + brightness rail + the preset editor overlay.
 * Ported from the vanilla `.pdm-lights` / `.pdm-editor` (the personalize-
 * peripherals periPreset / periColor / periFx / periAngle handlers).
 * Picking a preset paints the hero keys; the editor's color picker paints the
 * lit-selected keys live. The preset library itself (factory + user-made,
 * duplicated, deleted) is `Settings.lightPresets`, so it survives a reload and
 * a profile switch; the picked preset travels with the profile.
 */

// ── Editor state ──────────────────────────────────────────────────────────────
interface EditorState {
  title: string;
  /** The preset being edited; unset when the editor is making a new one. */
  editingId?: string;
  active: 0 | 1;
  colors: [Hsl, Hsl];
  angle: number;
  speed: number;
  opacity: number;
}
const seedColor = (hex: string): Hsl => ({ ...hexToHsl(hex), a: 100 });
const newEditor = (title: string): EditorState => ({
  title,
  active: 0,
  colors: [seedColor('#e02020'), seedColor('#f7b500')],
  angle: 360,
  speed: 50,
  opacity: 100,
});

export interface LightingTabProps {
  /** Apply a preset's glow ("r,g,b") to every key + hero glow. */
  onApplyAll: (glow: string) => void;
  /** Paint the lit-selected keys with a color (editor live preview). */
  onPaintSelected: (color: string) => void;
  /**
   * Brightness is an onboard-capable setting, so the canvas can hand down the
   * current profile scope's value (a slot's saved brightness, or the live
   * software one). Omitted = the tab keeps its own local state.
   */
  brightness?: number;
  onBrightness?: (v: number) => void;
  /**
   * The picked preset is a profile setting too — handed down the same way as
   * brightness so the highlight survives a reload and travels with a profile.
   * Omitted = the tab keeps its own local state.
   */
  preset?: string;
  onPreset?: (id: string) => void;
}

export function LightingTab({
  onApplyAll, onPaintSelected, brightness: brightnessProp, onBrightness, preset: presetProp, onPreset,
}: LightingTabProps) {
  const { lightPresets: presets, setLightPresets: setPresets } = useSettings();
  const [localActive, setLocalActive] = useState<string>(presets[0]?.id ?? '');
  const activeId = presetProp ?? localActive;
  const setActiveId = onPreset ?? setLocalActive;
  // Brightness travels with the device, so when a slot is in view it is that
  // slot's stored value rather than local state.
  const [localBrightness, setLocalBrightness] = useState(100);
  const brightness = brightnessProp ?? localBrightness;
  const setBrightness = onBrightness ?? setLocalBrightness;
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  // Close the ⋮ menu on any outside pointer-down.
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.pdm-preset-cmenu, .pdm-preset-menu')) setMenuFor(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuFor]);

  const pickPreset = (p: LightPreset) => {
    setActiveId(p.id);
    onApplyAll(p.glow);
  };

  // ── ⋮ menu actions ──
  const editPreset = (p: LightPreset) => {
    setMenuFor(null);
    setEditor({ ...newEditor(p.name), editingId: p.id });
  };
  const duplicatePreset = (p: LightPreset) => {
    setMenuFor(null);
    const i = presets.findIndex((x) => x.id === p.id);
    const clone = { ...p, id: `${p.id}-copy-${Date.now()}`, name: `${p.name} copy` };
    setPresets([...presets.slice(0, i + 1), clone, ...presets.slice(i + 1)]);
  };
  const deletePreset = (p: LightPreset) => {
    setMenuFor(null);
    const next = presets.filter((x) => x.id !== p.id);
    setPresets(next);
    if (activeId === p.id && next[0]) setActiveId(next[0].id);
  };

  // ── Editor color ops ──
  const patchActive = (patch: Partial<Hsl>) => {
    setEditor((ed) => {
      if (!ed) return ed;
      const colors = [...ed.colors] as [Hsl, Hsl];
      colors[ed.active] = { ...colors[ed.active], ...patch };
      queuePaint(colors[ed.active]);
      return { ...ed, colors };
    });
  };
  // Paint after state settles so the hero sees the new color.
  const queuePaint = (c: Hsl) => onPaintSelected(hslToRgbStr(c));

  const saveEditor = () => {
    if (!editor) return;
    const [c1, c2] = editor.colors;
    const hex1 = hslToHex(c1.h, c1.s, c1.l);
    const hex2 = hslToHex(c2.h, c2.s, c2.l);
    const rgb = hslToRgbStr(c1).replace(/rgb\(|\)|\s/g, '');
    const preset: LightPreset = {
      id: editor.editingId ?? `preset-new-${Date.now()}`,
      name: editor.title,
      swatch: `linear-gradient(135deg, ${hex1}, ${hex2})`,
      glow: rgb,
      fx: 'fade',
    };
    // Editing replaces the preset in place (same id, so a profile that picked
    // it still points at it); a new one goes to the front.
    setPresets(editor.editingId ? presets.map((x) => (x.id === editor.editingId ? preset : x)) : [preset, ...presets]);
    setEditor(null);
  };

  return (
    <div className="pdm-lights">
      {/* Body — brightness rail + presets (title/toggle live in the panel header).
          Lights OFF never dims this: the library stays yours to curate (create/
          edit/pick presets take effect when lighting comes back on). The off
          signal is the header toggle + the hero rendering the board unlit. */}
      <Ng3Grid className="pdm-lights-body">
        <Ng3Section className="pdm-bright">
          <span className="pdm-bright-val">{brightness}</span>
          <span className="pdm-bright-icon">
            <Icon name="lights" size={16} />
          </span>
          <div className="pdm-bright-slider">
            <Slider min={0} max={100} value={brightness} onChange={setBrightness} aria-label="Brightness" />
          </div>
        </Ng3Section>

        <SoftwareOnly reason="an onboard slot stores one static color set, not a preset library">
        <Ng3Section className="pdm-presets">
          <Ng3Label strong>Presets</Ng3Label>
          <div className="pdm-presets-grid">
            {presets.map((p) => (
              <div key={p.id} className={'pdm-preset' + (p.id === activeId ? ' active' : '') + (menuFor === p.id ? ' menu-open' : '')}>
                <button type="button" className="pdm-preset-pick" onClick={() => pickPreset(p)}>
                  <span className="pdm-preset-swatch" style={{ background: p.swatch }} />
                  <Icon name={p.fx} size={14} className="pdm-preset-fx" />
                  <span>{p.name}</span>
                </button>
                <button
                  type="button"
                  className="pdm-preset-menu"
                  aria-label="Preset options"
                  onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                >
                  <Icon name="more" size={16} />
                </button>
                {menuFor === p.id && (
                  <div className="pdm-preset-cmenu">
                    <button type="button" className="pdm-cmenu-item" onClick={() => editPreset(p)}>
                      <Icon name="edit" size={16} />
                      Edit
                    </button>
                    <button type="button" className="pdm-cmenu-item" onClick={() => duplicatePreset(p)}>
                      <Icon name="duplicate" size={16} />
                      Duplicate
                    </button>
                    <button type="button" className="pdm-cmenu-item" onClick={() => setMenuFor(null)}>
                      <Icon name="upload" size={16} />
                      Export
                    </button>
                    <button type="button" className="pdm-cmenu-item danger" onClick={() => deletePreset(p)}>
                      <Icon name="trash" size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="pdm-preset-fab" aria-label="Create new preset" onClick={() => setEditor(newEditor('New Preset'))}>
            <Icon name="add" size={16} />
          </button>
        </Ng3Section>
        </SoftwareOnly>
      </Ng3Grid>

      {editor && (
        <PresetEditor
          editor={editor}
          setEditor={setEditor}
          patchActive={patchActive}
          onCancel={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
    </div>
  );
}

// ── Preset editor overlay ─────────────────────────────────────────────────────
function PresetEditor({
  editor,
  setEditor,
  patchActive,
  onCancel,
  onSave,
}: {
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState | null>>;
  patchActive: (patch: Partial<Hsl>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const c = editor.colors[editor.active];
  const cur = `hsl(${c.h} ${c.s}% ${c.l}%)`;
  const [hexText, setHexText] = useState(hslToHex(c.h, c.s, c.l).slice(1).toUpperCase());

  // Keep the hex field in sync when the color changes elsewhere (pills/sliders).
  useEffect(() => {
    setHexText(hslToHex(c.h, c.s, c.l).slice(1).toUpperCase());
  }, [c.h, c.s, c.l]);

  const onHex = (v: string) => {
    setHexText(v);
    if (HEX_RE.test(v.trim())) patchActive({ ...hexToHsl(v.trim()) });
  };

  const randomize = () => {
    setEditor((ed) =>
      ed
        ? {
            ...ed,
            colors: ed.colors.map(() => ({
              h: Math.floor(Math.random() * 360),
              s: 70 + Math.floor(Math.random() * 30),
              l: 45 + Math.floor(Math.random() * 20),
              a: 100,
            })) as [Hsl, Hsl],
          }
        : ed,
    );
  };

  const setAngle = (a: number) => setEditor((ed) => (ed ? { ...ed, angle: ((a % 360) + 360) % 360 } : ed));

  return (
    <div className="pdm-editor">
      <Ng3Section className="pdm-editor-card">
        <div className="pdm-editor-head">
          <Ng3Label strong>{editor.title}</Ng3Label>
        </div>

        <div className="pdm-editor-body">
          {/* Effects rail. Figma builds both halves from the Section component
              and the rows from List Item, so they are the real primitives here
              rather than the .pdm-editor-* copies that had drifted off them. */}
          <Ng3Section className="pdm-editor-effects">
            <Ng3Label strong>Effects</Ng3Label>
            <div className="pdm-fx-list">
              <ListItem
                label="Add Effect"
                leading={<Icon name="add" size={16} />}
                onClick={() => {}}
              />
              <ListItem
                label="Swipe"
                leading={<Icon name="swipe" size={16} />}
                selected
              />
            </div>
          </Ng3Section>

          {/* Parameters */}
          <Ng3Section className="pdm-editor-params">
            {/* Color and Direction Angle are peer columns, each heading its own
                — not a Direction Angle nested under Color. Hoisting "Color" out
                to the section made it look like the parent of both and cost the
                right-hand column a label's worth of height it needs for the
                dial, speed and opacity. */}
            <div className="pdm-editor-cols">
              {/* Color picker */}
              <div className="pdm-color">
                <Ng3Label strong>Color</Ng3Label>
                <div className="pdm-color-pills">
                  {editor.colors.map((cc, i) => (
                    <Swatch
                      key={i}
                      wide
                      color={`hsl(${cc.h} ${cc.s}% ${cc.l}% / ${cc.a}%)`}
                      selected={i === editor.active}
                      label={`Edit color ${i + 1}`}
                      onClick={() => setEditor((ed) => (ed ? { ...ed, active: i as 0 | 1 } : ed))}
                    />
                  ))}
                  <button type="button" className="pdm-color-rand" onClick={randomize}>
                    <Icon name="shuffle" size={16} />
                    Randomize
                  </button>
                </div>
                <div className="pdm-color-body">
                  <div className="pdm-color-main">
                    {/* The three tracks are the ColorSlider variants, not
                        hand-built range inputs — which is also what restores the
                        checkerboard under the opacity track (the local copy drew
                        a plain gradient, so a transparent color looked solid). */}
                    <div className="pdm-color-sliders">
                      <ColorSlider variant="hue" min={0} max={360} value={c.h} color={cur} aria-label="Hue" onChange={(v) => patchActive({ h: v })} />
                      <ColorSlider variant="lightness" min={0} max={100} value={c.l} color={cur} aria-label="Lightness" onChange={(v) => patchActive({ l: v })} />
                      <ColorSlider variant="opacity" min={0} max={100} value={c.a} color={cur} aria-label="Opacity" onChange={(v) => patchActive({ a: v })} />
                    </div>
                    <div className="pdm-hex-row">
                      <div className="pdm-hex">
                      <span className="pdm-hex-sign">#</span>
                      <input type="text" className="pdm-hex-input" value={hexText} maxLength={6} spellCheck={false} aria-label="Hex color" onChange={(e) => onHex(e.target.value)} />
                        <button type="button" className="pdm-hex-copy" aria-label="Copy hex" onClick={() => navigator.clipboard?.writeText('#' + hexText)}>
                          <Icon name="duplicate" size={14} />
                        </button>
                      </div>
                    {/* Figma pairs the hex field with an eyedropper. Where the
                        browser supports EyeDropper it samples the screen; where
                        it does not the control is not offered at all, rather
                        than sitting there dead. */}
                    {'EyeDropper' in window && (
                      <IconButton
                        label="Pick a color from the screen"
                        className="pdm-hex-pick"
                        onClick={async () => {
                          try {
                            const picked = await new (window as unknown as {
                              EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
                            }).EyeDropper().open();
                            patchActive({ ...hexToHsl(picked.sRGBHex) });
                          } catch {
                            /* the user dismissed the picker */
                          }
                        }}
                      >
                        <Icon name="eyedropper" size={16} />
                      </IconButton>
                    )}
                    </div>
                  </div>
                  <div className="pdm-color-vrule" />
                  <div className="pdm-swatches">
                    {SWATCHES.map((sw) => (
                      <Swatch
                        key={sw}
                        color={sw}
                        label={sw}
                        selected={sw.toLowerCase() === '#' + hexText.toLowerCase()}
                        onClick={() => patchActive({ ...hexToHsl(sw) })}
                      />
                    ))}
                    <button type="button" className="pdm-sw-add" aria-label="Add current color to swatches">
                      <Icon name="add" size={12} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pdm-editor-vrule" />

              {/* Direction / speed / opacity */}
              <div className="pdm-fx-params">
                <div className="pdm-fx-group">
                  <Ng3Label strong>Direction Angle</Ng3Label>
                  <AngleDial angle={editor.angle} onAngle={setAngle} />
                </div>
                <div className="pdm-fx-group">
                  <div className="pdm-fx-slider-head">
                    <Ng3Label strong>Speed</Ng3Label>
                    <span className="pdm-fx-val">{editor.speed}</span>
                  </div>
                  <Slider min={0} max={100} value={editor.speed} onChange={(v) => setEditor((ed) => (ed ? { ...ed, speed: v } : ed))} aria-label="Speed" />
                </div>
                <div className="pdm-fx-group">
                  <div className="pdm-fx-slider-head">
                    <Ng3Label strong>Opacity</Ng3Label>
                    <span className="pdm-fx-val">{editor.opacity}</span>
                  </div>
                  <Slider min={0} max={100} value={editor.opacity} onChange={(v) => setEditor((ed) => (ed ? { ...ed, opacity: v } : ed))} aria-label="Effect opacity" />
                </div>
              </div>
            </div>
          </Ng3Section>
        </div>

        <div className="pdm-editor-cta">
          <Button variant="default" onClick={onCancel}>
            <Icon name="close" size={16} />
            Cancel
          </Button>
          <Button variant="accent" onClick={onSave}>
            <Icon name="check" size={16} />
            Save
          </Button>
        </div>
      </Ng3Section>
    </div>
  );
}

// ── Direction-angle dial (pointer drag + steppers + numeric input) ────────────
function AngleDial({ angle, onAngle }: { angle: number; onAngle: (a: number) => void }) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(String(angle));
  useEffect(() => setText(String(angle)), [angle]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const r = dialRef.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const move = (ev: PointerEvent) => {
      const deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
      onAngle(Math.round(deg));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(e.nativeEvent);
  };

  return (
    <div className="pdm-angle">
      <div ref={dialRef} className="pdm-angle-dial" onPointerDown={onPointerDown}>
        <span className="pdm-angle-needle" style={{ ['--angle' as string]: `${angle}deg` } as React.CSSProperties} />
      </div>
      <input
        type="text"
        className="pdm-angle-input"
        value={text}
        maxLength={3}
        spellCheck={false}
        aria-label="Direction angle"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseInt(text, 10);
          onAngle(isNaN(v) ? 0 : v);
        }}
      />
      <div className="pdm-angle-steppers">
        <button type="button" aria-label="Increase angle" onClick={() => onAngle(angle + 15)}>
          <Icon name="chevron-up" size={12} />
        </button>
        <button type="button" aria-label="Decrease angle" onClick={() => onAngle(angle - 15)}>
          <Icon name="chevron-down" size={12} />
        </button>
      </div>
    </div>
  );
}

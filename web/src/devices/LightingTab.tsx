import { Fragment, useEffect, useState, type ReactNode } from 'react';
import './lighting-tab.css';
import {
  Icon,
  Ng3Grid,
  Ng3Section,
  Ng3Label,
  Slider,
  SoftwareOnly,
} from '../components';
import { layersOf, presetFromLayers, type LightPreset } from './lightingData';
import { PresetEditor, newEditor, type EditorState } from './PresetEditor';
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

export interface LightingTabProps {
  /** Light the whole device with a preset (`preset` for its full look, e.g. a rainbow). */
  onApplyAll: (glow: string, preset?: LightPreset) => void;
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
  /** Lights the device has besides the keys (a laptop's cover logo), drawn
   *  after the presets. */
  extra?: ReactNode;
}

/**
 * A profile keeps ONE preset per device — the picked one (`lighting.preset`).
 * It briefly kept an ordered list (`lighting.presets`, 2026-10-06 → 10-21,
 * numbered badges and Add to / Remove from the profile) read off NGENUITY's
 * Profile Details; Chris: that was an interpretation of an error in the Figma
 * files, not a feature. A stored list is left unread.
 */
export function LightingTab({
  onApplyAll, onPaintSelected, brightness: brightnessProp, onBrightness, preset: presetProp, onPreset,
  extra,
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

  // Picking a preset shows it now and, through `onPreset`, is the profile's
  // one preset for this device.
  const pickPreset = (p: LightPreset) => {
    setActiveId(p.id);
    onApplyAll(p.glow, p);
  };

  // ── ⋮ menu actions ──
  const editPreset = (p: LightPreset) => {
    setMenuFor(null);
    // A copy of its stack — Cancel must leave the preset as it was.
    setEditor({ title: p.name, editingId: p.id, layers: layersOf(p).map((l) => ({ ...l, colors: [...l.colors] })), active: 0 });
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

  // An edited color paints the lit-selected keys, as it always has.
  const paintColor = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    onPaintSelected(`rgb(${r}, ${g}, ${b})`);
  };

  // How the edit stands, for the editor's head: a new preset, or one whose
  // name or layers differ from what is saved.
  const editing = editor?.editingId ? presets.find((x) => x.id === editor.editingId) : undefined;
  const editState = !editor
    ? ''
    : !editing
    ? 'New'
    : editor.title !== editing.name || JSON.stringify(editor.layers) !== JSON.stringify(layersOf(editing))
    ? 'Not saved'
    : 'Saved';

  const saveEditor = () => {
    if (!editor) return;
    const preset = presetFromLayers(editor.editingId ?? `preset-new-${Date.now()}`, editor.title.trim(), editor.layers);
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
      {editor ? (
        // The editor takes the list's place, as a macro's editor takes the
        // macro list's: one title (the panel's LIGHTS), "‹ Presets" back.
        <PresetEditor
          editor={editor}
          setEditor={setEditor}
          state={editState}
          onColor={paintColor}
          onCancel={() => setEditor(null)}
          onSave={saveEditor}
        />
      ) : (
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
            <div className="pdm-presets-head">
              <Ng3Label strong>Presets</Ng3Label>
            </div>
            <div className="pdm-presets-grid">
              {presets.map((p) => (
                <Fragment key={p.id}>
                {/* One list: OMEN's effects sit after NGENUITY's with no label of their own (design review, 2026-10-22). */}
                <div className={'pdm-preset' + (p.id === activeId ? ' active' : '') + (menuFor === p.id ? ' menu-open' : '')}>
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
                </Fragment>
              ))}
            </div>
            <button type="button" className="pdm-preset-fab" aria-label="Create new preset" onClick={() => setEditor(newEditor('New Preset'))}>
              <Icon name="add" size={16} />
            </button>
          </Ng3Section>
          </SoftwareOnly>
          {extra}
        </Ng3Grid>
      )}
    </div>
  );
}

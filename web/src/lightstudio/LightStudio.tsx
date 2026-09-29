import { useEffect, useRef, useState } from 'react';
import { Toggle, ToggleButtonGroup, Slider, Icon } from '../components';
import {
  LightStudioScene,
  DEVICE_IDS,
  DEFAULT_CAMERA_VIEW,
  LABELS,
  type UIState,
  type CameraView,
  type DeviceId,
  type DeviceStates,
} from './scene';
import { LightPresets, wornPresetId } from './LightPresets';
import { CAMERA_VIEWS } from './lighting';
import './light-controls.css';
import './light-studio.css';


export interface LightStudioProps {
  /** Shared lighting. When passed, the studio mirrors it and reports its own
   *  edits through `onStatesChange` — so a Quick Control tile and the studio
   *  are two views of the same desk. Omit for the self-contained studio. */
  states?: DeviceStates;
  onStatesChange?: (states: DeviceStates) => void;
  /** Devices selected when the studio opens (e.g. the one the host was showing). */
  initialSelected?: DeviceId[];
  /** What the user picked on the desk. The scene picks in every mode — compact
   *  only hides the studio's own rail — so a glance surface can be the picker
   *  and answer the pick itself (Personalize › Your desk). */
  onSelect?: (ids: DeviceId[]) => void;
  /** View only — the desk and its camera views, no device rail, no controls,
   *  no picking. For glance surfaces (the Personalize Lighting tile). */
  compact?: boolean;
  /** Controls as a card to the right of the desk instead of a row under it. */
  side?: boolean;
  /** The host draws the camera views itself (compact only): no bar above the
   *  desk, and the view follows `cameraView`. */
  cameraView?: CameraView;
}

/**
 * Light Studio — a 3D digital-desk of the user's devices with inline RGB
 * controls. The <canvas> is driven by an imperative LightStudioScene; the
 * controls read/write device lighting via that scene. Gated behind the
 * `lightstudio` module (rendered only on Personalize when installed).
 */
export function LightStudio({ states, onStatesChange, initialSelected, compact = false, side = false, cameraView, onSelect }: LightStudioProps = {}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LightStudioScene | null>(null);
  const [ui, setUi] = useState<UIState>({
    selected: [],
    sync: false,
    target: null,
    cameraView: DEFAULT_CAMERA_VIEW,
    states: states ?? ({} as DeviceStates),
  });
  // Latest host callbacks + the last lighting JSON both sides agreed on, kept in
  // refs so the scene is built once and mirroring never echoes a value back.
  const cb = useRef({ onStatesChange, onSelect });
  cb.current = { onStatesChange, onSelect };
  const agreed = useRef(states ? JSON.stringify(states) : '');
  // The browser can refuse a 3D canvas (too many live WebGL contexts, no GPU).
  // The desk then says so instead of taking the page down with it.
  const [failed, setFailed] = useState(false);
  // Bumped to build a fresh scene after the browser drops this desk's context.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!viewportRef.current) return;
    setFailed(false);
    let scene: LightStudioScene;
    try {
      scene = new LightStudioScene(
        viewportRef.current,
        (next) => {
          setUi(next);
          const json = JSON.stringify(next.states);
          if (json !== agreed.current) {
            agreed.current = json;
            cb.current.onStatesChange?.(next.states);
          }
        },
        states,
        // Two rebuilds at most; a desk that keeps losing its context says so.
        () => setGeneration((g) => (g < 2 ? g + 1 : g)),
      );
    } catch (e) {
      console.warn('[lightstudio] no 3D context', e);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    initialSelected?.forEach((id, i) => scene.select(id, i > 0));
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // The scene is built once per generation; later `states` arrive through the
    // effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  useEffect(() => {
    if (!states || !sceneRef.current) return;
    const json = JSON.stringify(states);
    if (json === agreed.current) return;
    agreed.current = json;
    sceneRef.current.setStates(states);
  }, [states]);

  // Hand the pick to the host. Keyed on the ids, so it fires when what is
  // picked changes and not on every lighting tick the scene reports.
  const picked = ui.selected.join(',');
  useEffect(() => {
    cb.current.onSelect?.(picked ? (picked.split(',') as DeviceId[]) : []);
  }, [picked]);

  // A host-driven view (the Mode tile's own view buttons).
  useEffect(() => {
    if (cameraView) sceneRef.current?.setCameraView(cameraView);
  }, [cameraView]);

  const s = sceneRef.current;
  const t = ui.target;
  const hasTarget = !!t;

  // Presets act on the selection (or Sync), else on the whole desk.
  const presetTargets: DeviceId[] = ui.sync || !ui.selected.length ? [...DEVICE_IDS] : ui.selected;
  const presetTargetLabel =
    presetTargets.length === 1 ? LABELS[presetTargets[0]] : `${presetTargets.length} devices`;
  const activePresetId = wornPresetId(presetTargets.map((id) => ui.states[id]));

  // What the controls act on, in a word.
  let title = 'No device selected';
  if (ui.sync) title = 'All devices';
  else if (ui.selected.length === 1) title = LABELS[ui.selected[0]];
  else if (ui.selected.length > 1) title = `${ui.selected.length} devices selected`;

  return (
    <div className={['ls', compact ? 'compact' : '', side ? 'side' : ''].filter(Boolean).join(' ')}>
      {/* ── Stage: camera views, the desk (fills the height), device rail ── */}
      <div className="ls-stage">
        {!cameraView && (
        <div className="ls-bar">
          {!compact && (
            <div className="ls-actions">
              <button type="button" className="ls-action" disabled={ui.sync} onClick={() => s?.selectAll()}>
                Select all
              </button>
              <button type="button" className="ls-action" disabled={ui.sync} onClick={() => s?.clearSelection()}>
                Clear
              </button>
              <button type="button" className="ls-action" onClick={() => s?.resetLayout()}>
                Reset layout
              </button>
              <label className="ls-sync">
                Sync all
                <Toggle checked={ui.sync} onChange={(v) => s?.setSync(v)} aria-label="Sync all devices" />
              </label>
            </div>
          )}
          {/* Camera views above the desk, never over it. */}
          <ToggleButtonGroup
            aria-label="Camera view"
            options={CAMERA_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
            value={ui.cameraView}
            onChange={(v) => s?.setCameraView(v as CameraView)}
          />
        </div>
        )}
        {/* The scene appends its own canvas here. */}
        <div className="ls-viewport" ref={viewportRef}>
          <div className="ls-loading">{failed ? 'Desk preview unavailable — reload the page' : 'Loading devices…'}</div>
        </div>
        {/* Device rail — quick select without hunting on the desk */}
        {!compact && (
          <div className="ls-rail" role="group" aria-label="Devices">
              {DEVICE_IDS.map((id: DeviceId) => (
                <button
                  key={id}
                  type="button"
                  className={'ls-rail-btn' + (ui.selected.includes(id) ? ' active' : '')}
                  aria-pressed={ui.selected.includes(id)}
                  // Synced means every device follows, so picking one is not a
                  // choice the studio can honour — it says so instead of taking
                  // the click and ignoring it.
                  disabled={ui.sync}
                  title={ui.sync ? 'Synced — every device follows. Switch Sync all off to set one.' : undefined}
                  onClick={(e) => s?.select(id, e.shiftKey)}
                >
                  {LABELS[id]}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* ── Controls: everything that changes the lighting, in one column beside
          the desk — presets, then fine-tuning; each names what it acts on. It scrolls on its own, so
          the desk never leaves the screen. ── */}
      {!compact && (
        <div className="ls-controls">
          {/* Presets — NGENUITY's list, in its order. A preset lands on the
              selected devices, or on the whole desk when nothing is selected. */}
          <section className="ls-section" aria-label="Presets">
            <div className="ls-section-head">
              <span className="ls-group-label">Presets</span>
              <span className="ls-section-note">
                {presetTargets.length === DEVICE_IDS.length ? 'Every device' : presetTargetLabel}
              </span>
            </div>
            <LightPresets activeId={activePresetId} onPick={(patch) => s?.applyTo(presetTargets, patch)} />
          </section>

          <fieldset className="ls-section" disabled={!hasTarget && !ui.sync}>
            <div className="ls-section-head">
              <span className="ls-group-label">Fine-tune</span>
              <span className="ls-section-note">{hasTarget || ui.sync ? title : 'Select a device first'}</span>
            </div>
            <div className="ls-fields">
            <div className="ls-field">
              <span className="ls-label">Brightness</span>
              <Slider value={t?.brightness ?? 80} onChange={(v) => s?.applyToTargets({ brightness: v })} aria-label="Brightness" />
            </div>
            <div className="ls-field">
              <span className="ls-label">Speed</span>
              <Slider
                min={1}
                max={10}
                value={t?.speed ?? 5}
                onChange={(v) => s?.applyToTargets({ speed: v })}
                aria-label="Effect speed"
              />
            </div>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Toggle, ToggleButtonGroup, Slider, Icon, Button } from '../components';
import {
  LightStudioScene,
  DEVICE_IDS,
  DEFAULT_CAMERA_VIEW,
  LABELS,
  type UIState,
  type CameraView,
  type DeviceId,
  type DeviceStates,
  type FocusShot,
  type AnchorId,
  type ViewInsets,
} from './scene';
import type { CapScreenLook } from './capScreen';
import type { ChassisZoneId } from './towerZones';
import { LightPresets, wornPresetId } from './LightPresets';
import { CAMERA_VIEWS, LIT_DEVICE_IDS, isLit } from './lighting';
import { ChassisLightsTab } from './ChassisLights';
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
  /** Something covers the desk (a modal, a device panel): it stops drawing
   *  until uncovered. It also stops by itself off screen or in a hidden tab. */
  covered?: boolean;
  /** Show this one device alone, framed, with no studio chrome — the host draws
   *  its own controls (the PC page's Lights tab, option B). It can change: the
   *  camera flies to the new device, and null flies back to the whole desk
   *  (Personalize's Lighting overview). */
  focus?: DeviceId | null;
  /** With `focus`: where the camera looks at it from. A new shot moves the
   *  camera there (This PC's page, per tab and part). */
  shot?: FocusShot;
  /** With `focus`: how much of the desk's box the host covers with cards of its
   *  own, in CSS px in from each edge. The focused device is framed in what is
   *  left and centred on it (This PC's full-screen layout). Omit it and the
   *  device is framed in the whole box, as every other desk is. */
  frameInsets?: ViewInsets | null;
  /** With `focus: 'tower'`: dim every one of its lights to a fifth except these
   *  zones' (`[]` dims them all), fading over about 300 ms. A display
   *  multiplier only; the lighting is not touched. Omit it or pass null and
   *  nothing dims, as on every other desk (This PC's full-screen layout). */
  dimExcept?: ChassisZoneId[] | null;
  /** Labels pinned to the desk: one per anchor, drawn by `renderAnchor` and
   *  moved with its device or tower part as the camera moves. */
  anchors?: AnchorId[];
  renderAnchor?: (id: AnchorId) => ReactNode;
  /** A compact desk that takes clicks and turns under the pointer, with every
   *  device kept where it is (the Lighting overview). Other compact desks pass
   *  clicks through to their tile. */
  interactive?: boolean;
  /** The cooler cap's screen on the tower, drawing this look; null or omitted
   *  shows none. For illustration — the model has no cap (capScreen.ts). */
  capScreen?: CapScreenLook | null;
}

/**
 * Light Studio — a 3D digital-desk of the user's devices with inline RGB
 * controls. The <canvas> is driven by an imperative LightStudioScene; the
 * controls read/write device lighting via that scene. Gated behind the
 * `lightstudio` module (rendered only on Personalize when installed).
 */
export function LightStudio({ states, onStatesChange, initialSelected, compact = false, side = false, cameraView, onSelect, covered = false, focus, shot, frameInsets, dimExcept, anchors, renderAnchor, interactive = false, capScreen }: LightStudioProps = {}) {
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
  const shotRef = useRef(shot);
  shotRef.current = shot;
  const capRef = useRef(capScreen);
  capRef.current = capScreen;
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
    // A compact desk is a picker that opens devices, lit or not.
    scene.pickUnlit = compact;
    scene.movable = !interactive;
    if (focus) scene.focusDevice(focus, false, shotRef.current ?? null);
    scene.setCapScreen(capRef.current ?? null);
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
    // On an interactive glance a click goes somewhere; it does not select, so
    // no ring is left on the device afterwards.
    if (interactive && picked) sceneRef.current?.clearSelection();
  }, [picked, interactive]);

  // The cap's screen follows its look; keyed on what it draws, not on identity.
  const capKey = capScreen ? JSON.stringify(capScreen) : '';
  useEffect(() => {
    sceneRef.current?.setCapScreen(capRef.current ?? null);
  }, [capKey, generation]);

  // Keyed on `generation` too, so a rebuilt scene starts covered if it should.
  useEffect(() => {
    sceneRef.current?.setCovered(covered);
  }, [covered, generation]);

  // The part of the box the host covers. Keyed on the numbers, and on
  // `generation`, so a rebuilt scene is told again. It goes before the shot
  // effect below, so a shot flown in the same render is framed inside them.
  const insetsKey = frameInsets ? `${frameInsets.top},${frameInsets.right},${frameInsets.bottom},${frameInsets.left}` : '';
  useEffect(() => {
    sceneRef.current?.setInsets(frameInsets ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetsKey, generation]);

  // The zones kept at full strength while the rest dim; keyed on the list, so
  // a new array with the same zones does not restart anything.
  const dimKey = dimExcept ? `keep:${dimExcept.join(',')}` : '';
  useEffect(() => {
    sceneRef.current?.setDimExcept(dimExcept ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimKey, generation]);

  // A host-driven focus or shot, once the scene is built (it took the first
  // one itself). A new device or a new shot flies there, a frame later so the
  // hero has taken the new tab's size first; a focus that goes away (the
  // Lighting overview's "All devices") flies back to the desk.
  const shotKey = shot ? JSON.stringify(shot) : '';
  const firstShot = useRef(true);
  const lastFocus = useRef<DeviceId | null>(focus ?? null);
  useEffect(() => {
    if (firstShot.current) {
      firstShot.current = false;
      return;
    }
    const was = lastFocus.current;
    lastFocus.current = focus ?? null;
    if (!focus) {
      if (was) sceneRef.current?.focusDevice(null);
      return;
    }
    const id = requestAnimationFrame(() => sceneRef.current?.focusDevice(focus, true, shotRef.current ?? null));
    return () => cancelAnimationFrame(id);
  }, [shotKey, focus]);

  // A host-driven view (the Mode tile's own view buttons).
  useEffect(() => {
    if (cameraView) sceneRef.current?.setCameraView(cameraView);
  }, [cameraView]);

  // Labels on the desk: the scene says where each anchor is every frame, and
  // each label moves by a transform, so following the camera re-renders nothing.
  const anchorEls = useRef(new Map<AnchorId, HTMLDivElement>());
  const anchorKey = anchors?.join(',') ?? '';
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const ids = anchorKey ? (anchorKey.split(',') as AnchorId[]) : [];
    if (!ids.length) return;
    scene.setAnchors(ids, (list) =>
      list.forEach((a) => {
        const el = anchorEls.current.get(a.id);
        if (!el) return;
        el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        el.dataset.shown = a.shown ? 'true' : 'false';
      }),
    );
    return () => scene.setAnchors([], null);
  }, [anchorKey, generation]);

  // Option A's one more click: with the tower picked, "Set zones" frames it
  // alone and swaps the controls for its zones. Leaving puts the desk back.
  const [zoning, setZoning] = useState(false);
  const canZone = !compact && !focus && !ui.sync && ui.selected.length === 1 && ui.selected[0] === 'tower';
  useEffect(() => {
    if (zoning && !canZone) {
      setZoning(false);
      sceneRef.current?.focusDevice(null);
    }
  }, [zoning, canZone]);
  const enterZones = () => {
    setZoning(true);
    sceneRef.current?.focusDevice('tower');
  };
  const leaveZones = () => {
    setZoning(false);
    sceneRef.current?.focusDevice(null);
  };

  const s = sceneRef.current;
  const t = ui.target;
  const hasTarget = !!t;

  // Presets act on the selection (or Sync), else on the whole desk.
  const presetTargets: DeviceId[] = ui.sync || !ui.selected.length ? [...LIT_DEVICE_IDS] : ui.selected.filter(isLit);
  const presetTargetLabel =
    presetTargets.length === 1 ? LABELS[presetTargets[0]] : `${presetTargets.length} devices`;
  const activePresetId = wornPresetId(presetTargets.map((id) => ui.states[id]));

  // What the controls act on, in a word.
  let title = 'No device selected';
  if (ui.sync) title = 'All devices';
  else if (ui.selected.length === 1) title = LABELS[ui.selected[0]];
  else if (ui.selected.length > 1) title = `${ui.selected.length} devices selected`;

  return (
    <div className={['ls', compact || focus ? 'compact' : '', interactive ? 'interactive' : '', side ? 'side' : '', focus ? 'focus' : '', zoning ? 'zoning' : ''].filter(Boolean).join(' ')}>
      {/* ── Stage: camera views, the desk (fills the height), device rail ── */}
      <div className="ls-stage">
        {!cameraView && !focus && !zoning && (
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
          {!!anchors?.length && !failed && (
            <div className="ls-anchors">
              {anchors.map((id) => (
                <div
                  key={id}
                  className="ls-anchor"
                  data-anchor={id}
                  data-shown="false"
                  ref={(el) => {
                    if (el) anchorEls.current.set(id, el);
                    else anchorEls.current.delete(id);
                  }}
                >
                  {renderAnchor?.(id)}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Device rail — quick select without hunting on the desk */}
        {!compact && !focus && !zoning && (
          <div className="ls-rail" role="group" aria-label="Devices">
              {LIT_DEVICE_IDS.map((id: DeviceId) => (
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
      {zoning && (
        <div className="ls-controls">
          <section className="ls-section" aria-label="Tower zones">
            <div className="ls-section-head">
              <button type="button" className="ls-action" onClick={leaveZones}>
                <Icon name="chevron-left" size={14} /> All devices
              </button>
              <span className="ls-section-note">{LABELS.tower} · zones</span>
            </div>
          </section>
          <ChassisLightsTab tower={ui.states.tower} onChange={(patch) => s?.applyTo(['tower'], patch)} />
        </div>
      )}
      {!compact && !focus && !zoning && (
        <div className="ls-controls">
          {/* Presets — NGENUITY's list, in its order. A preset lands on the
              selected devices, or on the whole desk when nothing is selected. */}
          <section className="ls-section" aria-label="Presets">
            <div className="ls-section-head">
              <span className="ls-group-label">Presets</span>
              <span className="ls-section-note">
                {presetTargets.length === LIT_DEVICE_IDS.length ? 'Every device' : presetTargetLabel}
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

          {/* The PC's lights zone by zone sit one click in: the desk-wide
              controls above light the tower whole. */}
          {canZone && (
            <section className="ls-section" aria-label="Tower zones">
              <div className="ls-section-head">
                <span className="ls-group-label">Zones</span>
                <span className="ls-section-note">
                  {ui.states.tower?.chassis ? 'Set in the PC\'s Lights' : 'Fans, memory and graphics card, one by one'}
                </span>
              </div>
              <Button size="sm" onClick={enterZones}>
                Set zones
              </Button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Toggle, Slider, Icon } from '../components';
import {
  LightStudioScene,
  DEVICE_IDS,
  DEFAULT_CAMERA_VIEW,
  LABELS,
  type UIState,
  type Effect,
  type CameraView,
  type DeviceId,
} from './scene';
import './light-studio.css';

const SWATCHES: { label: string; rgb: string }[] = [
  { label: 'Purple', rgb: '168,85,247' },
  { label: 'Cyan', rgb: '0,200,215' },
  { label: 'Red', rgb: '224,56,62' },
  { label: 'Green', rgb: '34,197,94' },
  { label: 'Blue', rgb: '59,130,246' },
  { label: 'Orange', rgb: '246,161,60' },
  { label: 'Pink', rgb: '244,114,182' },
  { label: 'White', rgb: '255,255,255' },
];
const EFFECTS: { id: Effect; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'wave', label: 'Wave' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'off', label: 'Off' },
];
const VIEWS: { id: CameraView; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'three-quarter', label: '3/4' },
  { id: 'top', label: 'Top' },
  { id: 'side', label: 'Side' },
];

const rgbToHex = (rgb: string) => {
  const [r, g, b] = rgb.split(',').map(Number);
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
};
const hexToRgb = (hex: string) => {
  const m = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)).join(',');
};

/**
 * Light Studio — a 3D digital-desk of the user's devices with inline RGB
 * controls. The <canvas> is driven by an imperative LightStudioScene; the
 * controls read/write device lighting via that scene. Gated behind the
 * `lightstudio` module (rendered only on Personalize when installed).
 */
export function LightStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LightStudioScene | null>(null);
  const [ui, setUi] = useState<UIState>({ selected: [], sync: false, target: null, cameraView: DEFAULT_CAMERA_VIEW });

  useEffect(() => {
    if (!canvasRef.current || !viewportRef.current) return;
    const scene = new LightStudioScene(canvasRef.current, viewportRef.current, setUi);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const s = sceneRef.current;
  const t = ui.target;
  const hasTarget = !!t;

  // Target panel copy (ports the vanilla renderUIState states).
  let title = 'No device selected';
  let desc = 'Click a device on the desk, or turn on Sync All to edit them together.';
  if (ui.sync) {
    title = 'All devices · Sync';
    desc = 'Lighting changes broadcast to every device.';
  } else if (ui.selected.length === 1) {
    title = LABELS[ui.selected[0]];
    desc = 'Editing this device only.';
  } else if (ui.selected.length > 1) {
    title = `${ui.selected.length} devices selected`;
    desc = 'Changes apply to all selected devices.';
  }

  return (
    <div className="ls">
      <div className="ls-stage">
        <div className="ls-viewport" ref={viewportRef}>
          <canvas className="ls-canvas" ref={canvasRef} />
          <div className="ls-loading">Loading devices…</div>
          {/* Camera-view HUD */}
          <div className="ls-hud">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={'ls-hud-btn' + (ui.cameraView === v.id ? ' active' : '')}
                onClick={() => s?.setCameraView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {/* Device rail — quick select without hunting on the desk */}
        <div className="ls-rail" role="tablist" aria-label="Devices">
          {DEVICE_IDS.map((id: DeviceId) => (
            <button
              key={id}
              type="button"
              className={'ls-rail-btn' + (ui.selected.includes(id) ? ' active' : '')}
              aria-pressed={ui.selected.includes(id)}
              onClick={(e) => s?.select(id, e.shiftKey)}
            >
              {LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="ls-controls">
        <div className="ls-target">
          <div className="ls-target-title">{title}</div>
          <div className="ls-target-desc">{desc}</div>
        </div>

        <div className="ls-row">
          <span className="ls-label">Sync all devices</span>
          <Toggle checked={ui.sync} onChange={(v) => s?.setSync(v)} aria-label="Sync all devices" />
        </div>

        <fieldset className="ls-group" disabled={!hasTarget && !ui.sync}>
          <div className="ls-group-label">Color</div>
          <div className="ls-swatches">
            {SWATCHES.map((sw) => (
              <button
                key={sw.rgb}
                type="button"
                className={'ls-swatch' + (t?.color === sw.rgb ? ' active' : '')}
                style={{ background: `rgb(${sw.rgb})` }}
                title={sw.label}
                aria-label={sw.label}
                onClick={() => s?.applyToTargets({ color: sw.rgb })}
              />
            ))}
            <label className="ls-swatch ls-swatch-custom" title="Custom color">
              <Icon name="eyedropper" size={13} aria-hidden />
              <input
                type="color"
                value={t ? rgbToHex(t.color) : '#a855f7'}
                onChange={(e) => s?.applyToTargets({ color: hexToRgb(e.target.value) })}
              />
            </label>
          </div>

          <div className="ls-group-label">Effect</div>
          <div className="ls-effects">
            {EFFECTS.map((ef) => (
              <button
                key={ef.id}
                type="button"
                className={'ls-effect' + (t?.effect === ef.id ? ' active' : '')}
                onClick={() => s?.applyToTargets({ effect: ef.id })}
              >
                {ef.label}
              </button>
            ))}
          </div>

          <div className="ls-slider-row">
            <span className="ls-label">Brightness</span>
            <Slider
              value={t?.brightness ?? 80}
              onChange={(v) => s?.applyToTargets({ brightness: v })}
              aria-label="Brightness"
            />
          </div>
          <div className="ls-slider-row">
            <span className="ls-label">Speed</span>
            <Slider
              min={1}
              max={10}
              value={t?.speed ?? 5}
              onChange={(v) => s?.applyToTargets({ speed: v })}
              aria-label="Effect speed"
            />
          </div>
        </fieldset>

        <div className="ls-actions">
          <button type="button" className="ls-action" onClick={() => s?.selectAll()}>
            Select all
          </button>
          <button type="button" className="ls-action" onClick={() => s?.clearSelection()}>
            Clear
          </button>
          <button type="button" className="ls-action" onClick={() => s?.resetLayout()}>
            Reset layout
          </button>
        </div>
      </div>
    </div>
  );
}

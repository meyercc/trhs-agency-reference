// ── Personalize › Lighting: the 3D overview ─────────────────────────────────
// JY, 2026-10-21: ported by hand from jy/light-overview (974fd07). Light
// Studio's editor retired (Treehouse research/light-studio-exploratory-
// 2026-10-19.zh.md): the section keeps a look at what every light is wearing
// and a way to the hardware wearing it. The 3D desk has each lit device's look
// pinned above it. A device click flies the camera to it; on the PC each part
// (fans, memory, graphics card) then shows its own look, and a part opens the
// PC's lighting window landed on that part. The windows are tonight's editors;
// this tile sets nothing itself (lighting.19: a device's lights have one home,
// its own window).
// Left out of 974fd07 on purpose: the list version, the Admin switch for the
// view, and the old zone editor.
import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Icon, Tile, TileLink, Toggle, ToggleButtonGroup } from '../../components';
import { CAMERA_VIEWS, LABELS, LIT_DEVICE_IDS, isLit } from '../../lightstudio/lighting';
import { useChassisMachine } from '../../lightstudio/ChassisLights';
import { CHASSIS_ZONES, zonesOf, type ChassisZoneId } from '../../lightstudio/towerZones';
import type { AnchorId, CameraView, DeviceId } from '../../lightstudio/scene';
import { useModules } from '../../state/Modules';
import { DESK_DEVICE_LABEL, lightingSpread, lightingSummary } from './model';
import { usePersonalize } from './state';
import { useLightsPower } from './LightingModal';
import { deviceLook, partLook, useLookReader, type LookLine } from './looks';
import { useLiveCapScreen } from '../../devices/CoolerCapCanvas';
import './lights-section.css';

const LightStudio = lazy(() => import('../../lightstudio/LightStudio').then((m) => ({ default: m.LightStudio })));

const zoneLabel = (z: ChassisZoneId) => CHASSIS_ZONES.find((c) => c.id === z)?.label ?? z;

function Swatch({ look, size = 'md' }: { look: LookLine; size?: 'sm' | 'md' }) {
  return <span className={`lx-swatch lx-swatch-${size}` + (look.off ? ' off' : '')} style={look.off ? undefined : { background: look.swatch }} aria-hidden="true" />;
}

/** Where a light is set: the device's own window, on its lights. The PC's
 *  can land on one part. */
export type OpenLights = (id: DeviceId, zone?: ChassisZoneId) => void;

export function LightOverviewTile({ onOpen }: { onOpen: OpenLights }) {
  const p = usePersonalize();
  const { has } = useModules();
  const [params, setParams] = useSearchParams();
  const { on, setOn } = useLightsPower();
  const zones = zonesOf(useChassisMachine());
  const [view, setView] = useState<CameraView>('front');
  const [focus, setFocus] = useState<DeviceId | null>(null);
  const lit = p.desk.lighting;
  const read = useLookReader(lit);
  // This PC's cooler cap on the tower, as it is now (for illustration).
  const capScreen = useLiveCapScreen();

  // "Devices with lights": the list window, and the only way to a notebook's
  // built-in keyboard, which is not on the desk.
  const openList = () => {
    const next = new URLSearchParams(params);
    next.set('modal', 'lighting');
    setParams(next);
  };

  // The desk shows a label per lit device; on the PC, its parts instead (the
  // other devices hide while one is shown).
  const anchors: AnchorId[] =
    focus === 'tower' ? zones.map((z) => `tower:${z}` as AnchorId) : focus ? [focus] : [...LIT_DEVICE_IDS];

  const renderAnchor = (id: AnchorId) => {
    if (id.startsWith('tower:')) {
      const zone = id.slice('tower:'.length) as ChassisZoneId;
      const look = partLook(lit.tower, zone);
      return (
        <button type="button" className="lx-chip" onClick={() => onOpen('tower', zone)} aria-label={`${zoneLabel(zone)}: ${look.name}. Set its lights`}>
          <Swatch look={look} />
          <span className="lx-chip-text">
            <span className="lx-chip-title">{zoneLabel(zone)}</span>
            <span className="lx-chip-look">{look.name}</span>
          </span>
          <Icon name="chevron-right" size={14} />
        </button>
      );
    }
    const dev = id as DeviceId;
    const look = deviceLook(dev, lit, zones);
    const shown = focus === dev;
    return (
      <button
        type="button"
        className={'lx-chip' + (shown ? ' here' : '')}
        // On the desk a label takes you to the device; on the device it opens its lights.
        onClick={() => (shown ? onOpen(dev) : setFocus(dev))}
        aria-label={shown ? `${LABELS[dev]}: ${look.name}. Set its lights` : `${LABELS[dev]}: ${look.name}. Show it`}
      >
        <Swatch look={look} />
        <span className="lx-chip-text">
          <span className="lx-chip-title">{DESK_DEVICE_LABEL[dev]}</span>
          <span className="lx-chip-look">{look.name}</span>
        </span>
        {shown && <Icon name="chevron-right" size={14} />}
      </button>
    );
  };

  const parts = focus === 'tower' ? zones : [];

  return (
    <Tile
      size="full"
      state="context"
      title="Lighting"
      className="qc-desk lx-tile"
      id="qc-lighting"
      controls={
        <span className="qc-desk-light-head">
          <Toggle checked={on} onChange={setOn} aria-label="Desk lighting" />
        </span>
      }
    >
      <div className="qc-desk-mode">
        <div className="qc-mode-name">{lightingSummary(lit, read)}</div>
        <span className="qc-mode-summary">
          {lightingSpread(lit, read)} · Saved in the {p.modeName(p.mode)} profile
        </span>
      </div>

      {/* The tile is not one big button: a click on the desk is for the device
          under it, and the footer link is what opens the list. */}
      <div className="lx-desk">
        {has('lightstudio') ? (
          <Suspense fallback={<div className="qc-desk-fallback">Loading desk…</div>}>
            <LightStudio
              compact
              interactive
              covered={params.has('modal') || params.has('sku')}
              cameraView={view}
              focus={focus}
              states={lit}
              capScreen={capScreen}
              onStatesChange={p.replaceLighting}
              onSelect={(ids) => ids.length === 1 && isLit(ids[0]) && setFocus(ids[0])}
              anchors={anchors}
              renderAnchor={renderAnchor}
            />
          </Suspense>
        ) : (
          <div className="qc-desk-fallback">{lightingSummary(lit, read)}</div>
        )}

        {/* On one device: where you are, what each of its lights wears, and
            the way to its window. */}
        {focus && (
          <div className="lx-here" role="group" aria-label={`${LABELS[focus]} lights`}>
            <button type="button" className="lx-back" onClick={() => setFocus(null)}>
              <Icon name="chevron-left" size={14} /> All devices
            </button>
            <div className="lx-here-name">{LABELS[focus]}</div>
            <ul className="lx-parts">
              {parts.length ? (
                parts.map((z) => {
                  const look = partLook(lit.tower, z);
                  return (
                    <li key={z}>
                      <button type="button" className="lx-part" data-part={z} onClick={() => onOpen('tower', z)}>
                        <Swatch look={look} size="sm" />
                        <span className="lx-part-name">{zoneLabel(z)}</span>
                        <span className="lx-part-look">{look.name}</span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="lx-part static">
                  <Swatch look={deviceLook(focus, lit, zones)} size="sm" />
                  <span className="lx-part-name">All lights</span>
                  <span className="lx-part-look">{deviceLook(focus, lit, zones).name}</span>
                </li>
              )}
            </ul>
            <Button size="sm" onClick={() => onOpen(focus)}>
              Set lights
            </Button>
          </div>
        )}
      </div>

      {/* Footer: the camera views on the left while the whole desk is shown, the
          hint while one device is; the way in to the list on the right, as on
          every other tile. */}
      <div className="qc-desk-bottom">
        {focus ? (
          <span className="lx-hint">
            {focus === 'tower' ? 'Drag to turn the desktop. Pick a part to set its lights.' : `Drag to turn the ${DESK_DEVICE_LABEL[focus].toLowerCase()}.`}
          </span>
        ) : (
          <ToggleButtonGroup
            aria-label="Camera view"
            options={CAMERA_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
            value={view}
            onChange={(v) => setView(v as CameraView)}
          />
        )}
        <span className="ds-quick-tile-actions">
          <TileLink chevron aria-haspopup="dialog" onClick={openList}>
            Devices with lights
          </TileLink>
        </span>
      </div>
    </Tile>
  );
}

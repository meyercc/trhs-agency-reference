import { useState, type CSSProperties } from 'react';
import { Slider, Toggle, ToggleButtonGroup } from '../../components';
import { CardDoor } from '../perform5/CardKit';
import { GrowArea } from './GrowArea';
import towerImg from '../../../../Assets/devices/OMEN35L.webp';
import monitorImg from '../../../../Assets/devices/oled-27-qhd.webp';
import micImg from '../../../../Assets/devices/quadcast-2-s.webp';
import headsetImg from '../../../../Assets/devices/cloud-iii-black.webp';
import keyboardImg from '../../../../Assets/devices/origins-65.webp';
import mouseImg from '../../../../Assets/devices/haste-3.webp';

// ── Lighting (PersonalizeV2) — ONE card on the control-card grammar ──
// The 3D studio is parked. The main element is a static DESK SCENE built from
// the real product shots, laid out in rough spatial position (back row: tower ·
// monitor · mic; front row: headset · keyboard · mouse). Each device carries its
// own live light: a colored bloom hugging its silhouette (a brightness(0) +
// drop-shadow copy of the same transparent PNG) plus a pool on the desk. The
// effect drives the animation; the brightness slider drives the bloom.
// SYNCHRONIZE rides WITH the scene — the two arbitrate the same thing — and the
// selected device grows its controls out beneath, same growth grammar as
// Display. Heavy ops (zones, per-key, scenes) live behind the manage door.

type Effect = 'solid' | 'breathe' | 'wave' | 'rainbow' | 'off';

interface Lamp {
  /** "r,g,b" */
  color: string;
  effect: Effect;
  bright: number;
  speed: number;
}

interface Device {
  id: string;
  name: string;
  img: string;
  /** desk slot: back row / front row */
  row: 'back' | 'front';
  /** figure width in px (relative device scale on the desk) */
  w: number;
}

const DEVICES: Device[] = [
  { id: 'tower', name: 'OMEN 35L', img: towerImg, row: 'back', w: 62 },
  { id: 'monitor', name: 'OMEN 27', img: monitorImg, row: 'back', w: 168 },
  { id: 'mic', name: 'QuadCast', img: micImg, row: 'back', w: 44 },
  { id: 'headset', name: 'Cloud III', img: headsetImg, row: 'front', w: 74 },
  { id: 'keyboard', name: 'Origins 65', img: keyboardImg, row: 'front', w: 186 },
  { id: 'mouse', name: 'Haste 3', img: mouseImg, row: 'front', w: 40 },
];

const DEFAULTS: Record<string, Lamp> = {
  tower: { color: '168,85,247', effect: 'breathe', bright: 80, speed: 4 },
  monitor: { color: '168,85,247', effect: 'solid', bright: 70, speed: 5 },
  mic: { color: '255,255,255', effect: 'off', bright: 60, speed: 5 },
  headset: { color: '224,56,62', effect: 'solid', bright: 75, speed: 5 },
  keyboard: { color: '0,200,215', effect: 'wave', bright: 90, speed: 6 },
  mouse: { color: '0,200,215', effect: 'solid', bright: 85, speed: 5 },
};

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

const EFFECTS = [
  { label: 'Solid', value: 'solid' },
  { label: 'Breathe', value: 'breathe' },
  { label: 'Wave', value: 'wave' },
  { label: 'Rainbow', value: 'rainbow' },
  { label: 'Off', value: 'off' },
];

export function LightingCard() {
  const [lamps, setLamps] = useState<Record<string, Lamp>>(DEFAULTS);
  const [sync, setSync] = useState(false);
  const [sel, setSel] = useState('keyboard');

  const cur = lamps[sel];
  const apply = (patch: Partial<Lamp>) =>
    setLamps((m) => {
      if (!sync) return { ...m, [sel]: { ...m[sel], ...patch } };
      const next: Record<string, Lamp> = {};
      for (const id of Object.keys(m)) next[id] = { ...m[id], ...patch };
      return next;
    });

  /* Turning sync on unifies every device onto the selected one's settings. */
  const setSyncMode = (v: boolean) => {
    setSync(v);
    if (v)
      setLamps((m) => {
        const src = m[sel];
        const next: Record<string, Lamp> = {};
        for (const id of Object.keys(m)) next[id] = { ...src };
        return next;
      });
  };

  const animated = cur.effect === 'breathe' || cur.effect === 'wave' || cur.effect === 'rainbow';

  const figure = (d: Device) => {
    const lamp = lamps[d.id];
    return (
      <button
        key={d.id}
        type="button"
        role="tab"
        aria-selected={!sync && sel === d.id}
        disabled={sync}
        className={['pz2-dev', `pz2-dev--${lamp.effect}`, !sync && sel === d.id ? 'pz2-dev--sel' : '']
          .filter(Boolean)
          .join(' ')}
        style={
          {
            '--lamp': `rgb(${lamp.color})`,
            '--bri': lamp.bright / 100,
            '--spd': `${(11 - lamp.speed) * 0.55}s`,
            '--w': `${d.w}px`,
          } as CSSProperties
        }
        onClick={() => setSel(d.id)}
      >
        <span className="pz2-dev-fig">
          <span className="pz2-dev-pool" aria-hidden="true" />
          <img className="pz2-dev-halo" src={d.img} alt="" aria-hidden="true" />
          <img className="pz2-dev-img" src={d.img} alt={d.name} />
        </span>
        <span className="pz2-dev-name">{d.name}</span>
      </button>
    );
  };

  return (
    <div className={'ds-feature-card pz2-card pz2-lighting' + (sync ? ' pz2-lighting--sync' : '')}>
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">Lighting</div>
        <CardDoor verb="manage" />
      </div>

      {/* Desk scene — devices in rough spatial position, each lit by its own light */}
      <div className="pz2-scene" role="tablist" aria-label="RGB devices">
        <div className="pz2-scene-row pz2-scene-row--back">{DEVICES.filter((d) => d.row === 'back').map(figure)}</div>
        <div className="pz2-scene-row pz2-scene-row--front">{DEVICES.filter((d) => d.row === 'front').map(figure)}</div>
      </div>

      {/* Synchronize rides with the scene — one arbitration unit. */}
      <div className="pz2-rel-row pz2-lamp-sync">
        <span className="pz2-rel-label">Synchronize</span>
        <Toggle checked={sync} onChange={setSyncMode} aria-label="Synchronize all devices" />
      </div>

      <GrowArea>
        <div className="pv5-pm-sub pz2-sub" key={sync ? 'all' : sel}>
          <div className="pz2-sub-head">{sync ? 'All devices' : DEVICES.find((d) => d.id === sel)!.name}</div>
          <div className="pz2-ctl-row">
            <span className="pz2-rel-label">Color</span>
            <div className="pz2-swatches" role="radiogroup" aria-label="Color">
              {SWATCHES.map((sw) => (
                <button
                  key={sw.rgb}
                  type="button"
                  role="radio"
                  aria-checked={cur.color === sw.rgb}
                  aria-label={sw.label}
                  title={sw.label}
                  className={'pz2-swatch' + (cur.color === sw.rgb ? ' pz2-swatch--sel' : '')}
                  style={{ background: `rgb(${sw.rgb})` }}
                  onClick={() => apply({ color: sw.rgb })}
                />
              ))}
            </div>
          </div>
          <div className="pz2-ctl-row">
            <span className="pz2-rel-label">Effect</span>
            <ToggleButtonGroup options={EFFECTS} value={cur.effect} onChange={(v) => apply({ effect: v as Effect })} aria-label="Effect" />
          </div>
          <div className="pz2-ctl-row pz2-ctl-row--slider">
            <span className="pz2-rel-label">Brightness</span>
            <div className="pz2-ctl-slider">
              <Slider value={cur.bright} onChange={(v) => apply({ bright: v })} aria-label="Brightness" />
            </div>
          </div>
          {animated && (
            <div className="pz2-ctl-row pz2-ctl-row--slider">
              <span className="pz2-rel-label">Speed</span>
              <div className="pz2-ctl-slider">
                <Slider min={1} max={10} value={cur.speed} onChange={(v) => apply({ speed: v })} aria-label="Effect speed" />
              </div>
            </div>
          )}
          {/* Layered-effect authoring and per-zone/per-key work live one door down. */}
          {!sync && (
            <div className="pz2-ctl-row">
              <span className="pz2-rel-label">Advanced control</span>
              <CardDoor verb="configure" />
            </div>
          )}
        </div>
      </GrowArea>
    </div>
  );
}

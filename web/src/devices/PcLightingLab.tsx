import { useMemo, useState } from 'react';
import './keyboard-canvas.css';
import './pc-lighting.css';
import { Ng3Panel, Toggle, ToggleButtonGroup } from '../components';
import { KeyboardHero } from './KeyboardHero';
import { LaptopLightsTab, LaptopLightingSettings } from './LaptopLights';
import { LightingGear } from './LightingGear';
import { LaptopPreview, VALORANT_DECK } from './LaptopPreview';
import { deviceImageUrl } from './skus';
import {
  codesOfZones,
  defaultLighting,
  keyZone,
  paintKeyboard,
  partsOf,
  quickSelectFor,
  zonesOf,
  type BarKind,
  type KeyboardKind,
  type LightCaps,
  type LogoKind,
  type PcLighting,
  quickSelectCodes,
} from './pcLighting';

/**
 * The laptop lighting editor on its own, for #/modal-lab: pick what the machine
 * has (the keyboard's type, a light bar, a logo) and the editor offers exactly
 * that (lighting.6, lighting-family.6). The same editor the notebook's device
 * window mounts under Lighting; no SKU or profile needed here.
 */

const MACHINES: { id: string; label: string; caps: LightCaps }[] = [
  { id: 'valorant', label: 'OMEN 16 VALORANT · 4 zones + logo', caps: { keyboard: 'four', bar: 'none', logo: 'single' } },
  // OMEN Max's keyboard lights per key in reality; its design (the Rockstar
  // lighting Figma; JY 2026-10-21) opens presets, custom and off by zone, not
  // per key, so the registry and the lab show it as four zones. The per-key
  // kind exists in the editor (NGENUITY's per-key editing; Chris 2026-10-21)
  // and is shown here on a kit of its own, which no shipping machine declares.
  { id: 'max', label: 'OMEN Max · 4 zones + U bar + 4-region logo', caps: { keyboard: 'four', bar: 'u', logo: 'four' } },
  { id: 'perkey', label: 'Per-key keyboard + U bar + 4-region logo (no shipping machine)', caps: { keyboard: 'per-key', bar: 'u', logo: 'four' } },
  { id: 'bar', label: '4-zone keyboard + 4-zone bar', caps: { keyboard: 'four', bar: 'four', logo: 'none' } },
  { id: 'one', label: 'One-zone keyboard', caps: { keyboard: 'one', bar: 'none', logo: 'none' } },
  { id: 'none', label: 'No lighting', caps: { keyboard: 'none', bar: 'none', logo: 'none' } },
];

const KB: { label: string; value: KeyboardKind }[] = [
  { label: 'None', value: 'none' },
  { label: 'One zone', value: 'one' },
  { label: '4 zones', value: 'four' },
  { label: 'Per key', value: 'per-key' },
];
const BAR: { label: string; value: BarKind }[] = [
  { label: 'None', value: 'none' },
  { label: '4 zones', value: 'four' },
  { label: 'U-shaped', value: 'u' },
];
const LOGO: { label: string; value: LogoKind }[] = [
  { label: 'None', value: 'none' },
  { label: 'One', value: 'single' },
  { label: '4 regions', value: 'four' },
];

const NO_BINDS = new Map();

export function PcLightingLab() {
  const [caps, setCaps] = useState<LightCaps>(MACHINES[0].caps);
  const [value, setValue] = useState<PcLighting>(defaultLighting);
  const [power, setPower] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [zoneSel, setZoneSel] = useState<Set<string>>(new Set());
  const litSel = useMemo(() => codesOfZones(caps.keyboard, zoneSel), [caps.keyboard, zoneSel]);
  const kbZones = useMemo(() => zonesOf('keyboard', caps), [caps]);
  const perKey = caps.keyboard === 'per-key';
  const [marquee, setMarquee] = useState(false);
  const paint = useMemo(() => paintKeyboard(value, caps), [value, caps]);
  const quickSelect = useMemo(() => quickSelectFor(caps.keyboard), [caps.keyboard]);
  // The rail's highlight: the same rule as LaptopCanvas (per key: All is the
  // board, a group when the picked keys are exactly that group).
  const activeQs = perKey
    ? zoneSel.has('all')
      ? 'all'
      : quickSelect.find((q) => {
          if (q.id === 'all') return false;
          const codes = quickSelectCodes('per-key', q.id);
          return codes.length === zoneSel.size && codes.every((c) => zoneSel.has(c));
        })?.id ?? ''
    : kbZones.length && zoneSel.size === kbZones.length && kbZones.every((z) => zoneSel.has(z))
      ? 'all'
      : zoneSel.size === 1 && kbZones.includes([...zoneSel][0])
        ? [...zoneSel][0]
        : '';
  const machine = MACHINES.find((m) => m.caps.keyboard === caps.keyboard && m.caps.bar === caps.bar && m.caps.logo === caps.logo)?.id ?? '';

  const setKit = (next: LightCaps) => {
    setCaps(next);
    setZoneSel(new Set());
  };

  return (
    <div className="pcl-lab" data-testid="pcl-lab">
      <div className="pcl-lab-pick">
        <label className="pcl-lab-field">
          <span>Machine</span>
          <select aria-label="Machine" value={machine} onChange={(e) => { const m = MACHINES.find((x) => x.id === e.target.value); if (m) setKit(m.caps); }}>
            {machine === '' && <option value="">Custom</option>}
            {MACHINES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <div className="pcl-lab-field">
          <span>Keyboard</span>
          <ToggleButtonGroup aria-label="Keyboard type" value={caps.keyboard} onChange={(v) => setKit({ ...caps, keyboard: v as KeyboardKind })} options={KB} />
        </div>
        <div className="pcl-lab-field">
          <span>Light bar</span>
          <ToggleButtonGroup aria-label="Light bar type" value={caps.bar} onChange={(v) => setKit({ ...caps, bar: v as BarKind })} options={BAR} />
        </div>
        <div className="pcl-lab-field">
          <span>Logo</span>
          <ToggleButtonGroup aria-label="Logo type" value={caps.logo} onChange={(v) => setKit({ ...caps, logo: v as LogoKind })} options={LOGO} />
        </div>
      </div>

      <div className="kbd-canvas pcl-lab-stage">
        {caps.keyboard !== 'none' && (
          <div className="kbd-hero pcl-lab-hero">
            <LaptopPreview
              src={deviceImageUrl(machine === 'max' ? 'omen-max-16.webp' : 'hx-omen-16-valorant.webp')}
              alt="Laptop"
              caps={caps}
              value={value}
              power={power}
              deck={machine === 'max' ? undefined : VALORANT_DECK}
            />
            <KeyboardHero
              mode="lights"
              layer="base"
              onLayer={() => {}}
              selected={null}
              litSel={litSel}
              keyColors={power ? paint.colors : new Map()}
              binds={NO_BINDS}
              activeQs={activeQs}
              marquee={perKey && marquee}
              onMarquee={() => setMarquee((m) => !m)}
              onMarqueeSelect={(codes, additive) => setZoneSel((prev) => new Set([...(additive ? [...prev].filter((z) => z !== 'all') : []), ...codes]))}
              onKey={(code) => {
                const zone = keyZone(caps.keyboard, code);
                if (!zone) return;
                setZoneSel((prev) => {
                  // Picking one key of a per-key board lets go of the whole board.
                  const next = new Set(perKey ? [...prev].filter((z) => z !== 'all') : prev);
                  if (next.has(zone)) next.delete(zone);
                  else next.add(zone);
                  return next;
                });
              }}
              onQuickSelect={(id) => {
                if (id === 'reset') setZoneSel(new Set());
                else if (id === 'all') setZoneSel(perKey ? new Set(['all']) : new Set(kbZones));
                else setZoneSel(perKey ? new Set(quickSelectCodes('per-key', id)) : new Set([id]));
              }}
              quickSelect={quickSelect}
              marqueeTool={perKey}
              knob={false}
            />
          </div>
        )}
        <div className="pcl-lab-panel">
          <Ng3Panel
            header="Lighting"
            headerExtra={<Toggle checked={power} onChange={setPower} aria-label="Lighting power" />}
            // The gear the notebook's page has, so the settings are reachable here too.
            actions={
              partsOf(caps).length ? (
                <LightingGear>
                  <LaptopLightingSettings caps={caps} value={value} onChange={setValue} power={power} onPower={setPower} onReset={() => setZoneSel(new Set())} />
                </LightingGear>
              ) : undefined
            }
            bare
          >
            <LaptopLightsTab
              caps={caps}
              value={value}
              onChange={setValue}
              selection={zoneSel}
              onSelection={setZoneSel}
              brightness={brightness}
              onBrightness={setBrightness}
            />
          </Ng3Panel>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Ng3Label, Toggle, ToggleButtonGroup } from '../components';
import { ZoneLightsTab, type ZoneDef } from './ZoneLightsTab';
import type { ZoneLook } from './lightLooks';
import { BAR_ZONES, LOGO_ZONES, applyHotkey, defaultLighting, ecoReading, hasEco, isKeyCode, keyboardLooks, partsOf, zonesOf, type Hotkey, type LightCaps, type PartId, type PcLighting } from './pcLighting';
import { NOTEBOOK_ZONES } from './notebookZones';

/**
 * A laptop's lighting — keyboard zones, light bar, lid logo — in the
 * peripherals' layout (ZoneLightsTab; JY 2026-10-21): the rail, the zones with
 * All, the preset library. What a machine lights comes from its data
 * (lighting.6, lighting-family.6): the keyboard by its type (one zone, four,
 * or per key), a light bar and a logo only where the machine has them. On a
 * per-key board the zone column holds one Keyboard row for the whole board;
 * single keys are picked on the drawn keyboard (a click, or a box) and the
 * selection carries their codes, so a preset or a colour lands on them alone
 * (NGENUITY's per-key editing; Chris, 2026-10-21).
 * The hotkeys, ECO lighting where the machine has it (lighting.13), the
 * lights at sleep, the charging light and the reset are not in the zone
 * column: they are LaptopLightingSettings, behind the gear in the panel's
 * header (LightingGear; JY, 2026-10-22).
 *
 * Controlled: `value` is the whole state, `onChange` the only way out; the
 * selection is the host's, since the hero draws it on the 3D keys.
 */
export function LaptopLightsTab({
  caps,
  value,
  onChange,
  selection,
  onSelection,
  brightness,
  onBrightness,
  onPartChange,
}: {
  caps: LightCaps;
  value: PcLighting;
  onChange: (next: PcLighting) => void;
  selection: ReadonlySet<string>;
  onSelection: (next: Set<string>) => void;
  brightness: number;
  onBrightness: (v: number) => void;
  /** The one part being edited, or null for several or all — so the host can
   *  show that part (the 3D hero's camera). */
  onPartChange?: (part: PartId | null) => void;
}) {
  const parts = partsOf(caps);
  const zones: ZoneDef[] = [
    ...(caps.keyboard === 'four'
      ? NOTEBOOK_ZONES.map((z) => ({ id: z.id, label: z.label }))
      : caps.keyboard === 'one'
        ? [{ id: 'all', label: 'Keyboard' }]
        : caps.keyboard === 'per-key'
          ? [{ id: 'all', label: 'Keyboard · per key' }]
          : []),
    ...(caps.logo === 'four' ? [{ id: 'logo', label: 'Logo', children: LOGO_ZONES.map((id, i) => ({ id, label: `Logo region ${i + 1}` })) }] : caps.logo === 'single' ? [{ id: 'logo', label: 'Logo' }] : []),
    ...(caps.bar === 'four' ? [{ id: 'bar', label: 'Light bar', children: BAR_ZONES.map((id, i) => ({ id, label: `Light bar zone ${i + 1}` })) }] : caps.bar === 'u' ? [{ id: 'bar', label: 'Light bar' }] : []),
  ];

  // The part in view: every picked zone in one part, else none.
  const partOf = (id: string): PartId => (id.startsWith('logo') ? 'logo' : id.startsWith('bar') ? 'bar' : 'keyboard');
  const shown: PartId | null = useMemo(() => {
    const ids = [...selection];
    if (!ids.length) return null;
    const ps = new Set(ids.map(partOf));
    return ps.size === 1 && ids.length < zones.length ? [...ps][0] : null;
  }, [selection, zones.length]);
  useEffect(() => {
    onPartChange?.(shown);
  }, [shown, onPartChange]);

  const perKey = caps.keyboard === 'per-key';
  const pickedKeys = useMemo(() => (perKey ? [...selection].filter(isKeyCode).length : 0), [perKey, selection]);
  // What each row shows: a picked key's own look, or the board's where it has none.
  const looks = useMemo(
    () => (perKey ? { ...value.zones, ...Object.fromEntries([...selection].filter(isKeyCode).map((c) => [c, value.zones[c] ?? value.zones.all ?? null])) } : value.zones),
    [perKey, selection, value.zones],
  );

  const patch = (next: Partial<PcLighting>) => onChange({ ...value, ...next });
  const apply = (ids: string[], look: ZoneLook) => {
    let next = { ...value.zones };
    ids.forEach((id) => {
      // The whole per-key board: every key's own look is lifted with it.
      if (id === 'all' && perKey) {
        next = keyboardLooks(next, caps, look);
        return;
      }
      next[id] = look;
      // A whole part takes its zones with it, and a zone its part's children.
      if (id === 'bar') BAR_ZONES.forEach((z) => (next[z] = look));
      if (id === 'logo') LOGO_ZONES.forEach((z) => (next[z] = look));
    });
    patch({ zones: next });
  };

  if (!parts.length) {
    return (
      <div className="pcl pcl-none">
        <Ng3Label strong>Lighting</Ng3Label>
        <p className="pcz-note">This machine has no lights the app can set.</p>
      </div>
    );
  }

  return (
    <ZoneLightsTab
      className="pcl"
      zones={zones}
      looks={looks}
      selection={selection}
      onSelection={onSelection}
      onApply={apply}
      brightness={brightness}
      onBrightness={onBrightness}
      other={
        perKey ? (
          <p className="pcz-note" data-testid="perkey-note">
            {pickedKeys
              ? `${pickedKeys} ${pickedKeys === 1 ? 'key' : 'keys'} picked on the keyboard. A preset or a colour goes to ${pickedKeys === 1 ? 'it' : 'them'}; the Keyboard row takes the whole board back.`
              : 'Click a key, or drag a box across the keyboard, to light keys one by one.'}
          </p>
        ) : undefined
      }
    />
  );
}

/**
 * The notebook's other lighting settings, for the gear's popover
 * (LightingGear): the hotkeys, ECO lighting where the machine has it, the
 * lights at sleep, the charging light and Reset to default. Controlled by the
 * same `value` as the tab; `power` is the keyboard's lights master (Fn+F9),
 * and `onReset` lets the host drop its zone selection with the reset.
 */
export function LaptopLightingSettings({
  caps,
  value,
  onChange,
  power,
  onPower,
  onReset,
}: {
  caps: LightCaps;
  value: PcLighting;
  onChange: (next: PcLighting) => void;
  /** The keyboard's lights are on (Fn+F9). */
  power: boolean;
  onPower: (on: boolean) => void;
  onReset?: () => void;
}) {
  const [notice, setNotice] = useState('');
  const patch = (next: Partial<PcLighting>) => onChange({ ...value, ...next });
  const hotkey = (k: Hotkey) => {
    const r = applyHotkey(value, caps, k, power);
    onChange(r.state);
    if (r.power !== null) onPower(r.power);
    setNotice(r.notice);
  };
  const eco = hasEco(caps);
  return (
    <div className="pcl-settings" aria-label="Other lighting settings">
      {caps.keyboard !== 'none' && (
        <div className="pcl-hotkeys" role="group" aria-label="Keyboard hotkeys">
          <Ng3Label plain>Hotkeys</Ng3Label>
          <Button size="sm" onClick={() => hotkey('fn-space')}>
            Fn+Space
          </Button>
          <Button size="sm" onClick={() => hotkey('fn-f9')}>
            Fn+F9
          </Button>
        </div>
      )}
      {notice && (
        <p className="pcz-note" role="status" data-testid="hotkey-notice">
          {notice}
        </p>
      )}
      {eco && (
        <>
          <label className="pcl-row">
            <span>ECO lighting</span>
            <Toggle checked={value.eco} onChange={(e) => patch({ eco: e })} aria-label="ECO lighting" />
          </label>
          {value.eco && (
            <p className="pcz-note pcl-eco" role="status">
              ECO lighting is on. {ecoReading(value.ac)}
            </p>
          )}
          <label className="pcl-row">
            <span>Power source (preview)</span>
            <ToggleButtonGroup
              aria-label="Power source"
              value={value.ac ? 'ac' : 'battery'}
              onChange={(v) => patch({ ac: v === 'ac' })}
              options={[
                { label: 'AC', value: 'ac' },
                { label: 'Battery', value: 'battery' },
              ]}
            />
          </label>
        </>
      )}
      <label className="pcl-row">
        <span>Lights off at sleep</span>
        <Toggle checked={value.sleepOff} onChange={(e) => patch({ sleepOff: e })} aria-label="Lights off at sleep" />
      </label>
      <label className="pcl-row">
        <span>Charging light</span>
        <ToggleButtonGroup
          aria-label="Charging light"
          value={value.chargeColor}
          onChange={(c) => patch({ chargeColor: c as PcLighting['chargeColor'] })}
          options={[
            { label: 'Amber', value: 'amber' },
            { label: 'White', value: 'white' },
          ]}
        />
      </label>
      <button
        type="button"
        className="ds-btn"
        onClick={() => {
          onChange(defaultLighting());
          onReset?.();
        }}
      >
        <Icon name="refresh" size={16} />
        Reset to default
      </button>
    </div>
  );
}

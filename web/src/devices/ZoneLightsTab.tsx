import { useMemo, type ReactNode } from 'react';
import './zone-lights.css';
import { ListItem, Ng3Label, Ng3Section } from '../components';
import { LightingTab } from './LightingTab';
import { useSettings } from '../state/Settings';
import { lookOf, lookSwatch, solidLook, type ZoneLook, type ZoneLooks } from './lightLooks';

/**
 * A PC's lighting, laid out as the peripherals' Lights tab is (HyperX
 * NGENUITY; JY 2026-10-21): the brightness rail on the left, the machine's
 * zones in the middle, with All, and on the right the same preset library and
 * preset editor the keyboard and mouse use (LightingTab). Picking a preset
 * applies it to the selected zones; the editor's colour paints them live.
 *
 * The right column IS the peripherals' tab, with the zone column added into
 * its grid (`extra`) and placed between the rail and the presets by CSS. The
 * profile furniture (a preset's number in the profile) is not passed, so it
 * does not show. The chassis and the notebook each build their zone list and
 * keep their own state (lightstudio/ChassisLights.tsx, devices/LaptopLights.tsx).
 */

export interface ZoneDef {
  id: string;
  label: string;
  /** Zones inside this one (each fan under Fans). Picking the parent takes
   *  them all as one; picking a child takes it alone. */
  children?: ZoneDef[];
}

export interface ZoneLightsTabProps {
  zones: ZoneDef[];
  /** What each zone wears, for the swatch beside it. */
  looks: ZoneLooks;
  /** The zones a preset or a colour goes to. */
  selection: ReadonlySet<string>;
  onSelection: (next: Set<string>) => void;
  /** Put a look on these zones. */
  onApply: (zoneIds: string[], look: ZoneLook) => void;
  brightness: number;
  onBrightness: (v: number) => void;
  /** A line or two under the zones: a note on how to pick, or Light Studio's
   *  reset. Settings are not put here; a lighting panel keeps them behind the
   *  gear in its header (LightingGear; JY, 2026-10-22). */
  other?: ReactNode;
  className?: string;
}

// The All row's own id, apart from any zone's (a one-zone keyboard's zone is `all`).
const ALL = '*';

export function ZoneLightsTab({ zones, looks, selection, onSelection, onApply, brightness, onBrightness, other, className }: ZoneLightsTabProps) {
  const { lightPresets } = useSettings();
  const topIds = useMemo(() => zones.map((z) => z.id), [zones]);
  const allSelected = topIds.length > 0 && topIds.every((id) => selection.has(id));
  const targets = [...selection];

  // The preset the grid highlights: the one every selected zone wears.
  const activePreset = useMemo(() => {
    const ids = targets.map((id) => looks[id]?.presetId ?? '');
    return ids.length && ids.every((id) => id && id === ids[0]) ? ids[0] : '';
  }, [targets, looks]);

  const pick = (id: string, parent?: ZoneDef) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // A parent and its children are one choice or the other.
    const def = zones.find((z) => z.id === id);
    def?.children?.forEach((c) => next.delete(c.id));
    if (parent) next.delete(parent.id);
    onSelection(next);
  };
  const pickAll = () => onSelection(allSelected ? new Set() : new Set(topIds));

  const apply = (presetId: string) => {
    const p = lightPresets.find((x) => x.id === presetId);
    if (p && targets.length) onApply(targets, lookOf(p));
  };
  const paint = (rgb: string) => {
    const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m || !targets.length) return;
    const hex = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    onApply(targets, solidLook(hex));
  };

  const row = (z: ZoneDef, parent?: ZoneDef) => (
    <ListItem
      key={z.id}
      className={'pcz-zone' + (parent ? ' pcz-child' : '')}
      label={z.label}
      description={looks[z.id] === undefined && parent ? `With ${parent.label}` : looks[z.id]?.name ?? 'Off'}
      leading={<span className="pcz-swatch" style={{ background: lookSwatch(looks[z.id] === undefined && parent ? looks[parent.id] ?? null : looks[z.id] ?? null) }} aria-hidden="true" />}
      selected={selection.has(z.id)}
      aria-selected={selection.has(z.id)}
      data-zone={z.id}
      onClick={() => pick(z.id, parent)}
    />
  );

  return (
    <div className={['pcz', className].filter(Boolean).join(' ')}>
      <LightingTab
        onApplyAll={() => {}}
        onPaintSelected={paint}
        brightness={brightness}
        onBrightness={onBrightness}
        preset={activePreset}
        onPreset={apply}
        extra={
          <Ng3Section className="pcz-zones">
            <Ng3Label strong>Zones</Ng3Label>
            <div className="pcz-list" role="listbox" aria-label="Zones" aria-multiselectable="true">
              <ListItem className="pcz-zone pcz-all" label="All" description={`${topIds.length} zones`} selected={allSelected} aria-selected={allSelected} data-zone={ALL} onClick={pickAll} />
              {zones.map((z) => (
                <div key={z.id} className="pcz-group">
                  {row(z)}
                  {z.children?.map((c) => row(c, z))}
                </div>
              ))}
            </div>
            {other}
          </Ng3Section>
        }
      />
    </div>
  );
}

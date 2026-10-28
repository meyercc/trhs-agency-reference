import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Icon, Toggle } from '../components';
import { fanName, useFanKit } from '../devices/fanKit';
import { ZoneLightsTab, type ZoneDef } from '../devices/ZoneLightsTab';
import type { ZoneLook } from '../devices/lightLooks';
import { chassisOf, onMachine, panelDrives, readMachine, startingLighting, zonesOf, type ChassisLighting, type ChassisZoneId, type TowerLike } from './towerZones';

/** The machine as the lab set it up, kept current. */
export function useChassisMachine() {
  return useSyncExternalStore(onMachine, machineSnapshot);
}
let lastRaw: string | null = null;
let lastMachine = readMachine();
function machineSnapshot() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem('chassisMachine');
  } catch {
    /* no storage: the default machine */
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastMachine = readMachine();
  }
  return lastMachine;
}

/**
 * The LIGHTS switch, for the panel's header as the mic's ring and the laptop's
 * keyboard have one. It is the one way to put every light out; every look is
 * kept for when it comes back on.
 */
export function ChassisLightsSwitch({ tower, onChange }: { tower: TowerLike; onChange: (patch: Partial<TowerLike>) => void }) {
  const value = chassisOf(tower);
  return <Toggle checked={value.on} onChange={(on) => onChange({ chassis: { ...value, on } })} aria-label="PC lighting power" />;
}

/**
 * Reset to default, the one setting the desktop's lighting keeps outside its
 * zones. On the PC page it sits behind the gear in the panel's header
 * (LightingGear, as the notebook's settings do; JY 2026-10-22); Light Studio's
 * "Set zones" flow, which has no such header, keeps it under the zones.
 */
export function ChassisLightsSettings({ onChange }: { onChange: (patch: Partial<TowerLike>) => void }) {
  return (
    <button type="button" className="ds-btn" onClick={() => onChange({ chassis: startingLighting() })}>
      <Icon name="refresh" size={16} />
      Reset to default
    </button>
  );
}

const PART_LABEL: Record<ChassisZoneId, string> = { fans: 'Fans', memory: 'Memory', gpu: 'Graphics card' };
const PARTS: ChassisZoneId[] = ['fans', 'memory', 'gpu'];

/**
 * The desktop's lighting — one editor, whichever door it is reached from
 * (keys-macros.22 and lcd-diy.25 hold the same rule for their parts): the PC
 * page's Chassis lighting tab, This PC's row, Light Studio's "Set zones" and
 * Modal Lab. The peripherals' layout (ZoneLightsTab): the rail, the zones —
 * All · Fans, with each fan under it · Memory · Graphics card — and the
 * preset library. A part the machine lacks is not offered (lighting-family.6).
 */
export function ChassisLightsTab({
  tower,
  onChange,
  onPartChange,
  initialPart,
  resetInColumn = true,
}: {
  tower: TowerLike;
  onChange: (patch: Partial<TowerLike>) => void;
  /** The one part being edited, or null for several or all — so the host can
   *  show that part (the PC page's 3D tower). */
  onPartChange?: (part: ChassisZoneId | null) => void;
  /** Open on this part alone (the Lighting overview's part labels), when the
   *  machine has it; else every part, as before. JY, 2026-10-21. */
  initialPart?: ChassisZoneId;
  /** Reset to default under the zones. The PC page turns it off: its reset is
   *  behind the panel header's gear (ChassisLightsSettings). */
  resetInColumn?: boolean;
}) {
  const machine = useChassisMachine();
  const parts = zonesOf(machine);
  const value = chassisOf(tower);
  const drives = panelDrives(tower);
  const kit = useFanKit();

  // The fans the lights reach: the board's that this machine has, in port
  // order, then the DIY kit's, chained — the fan kit's list, with the names
  // players gave them (lcd-diy.13).
  const fans = useMemo(
    () => [
      ...kit.fans.filter((f) => f.controller === 'board' && machine.fans.includes(f.id)).sort((a, b) => a.port - b.port),
      ...kit.fans.filter((f) => f.controller === 'kit').sort((a, b) => a.port - b.port || (a.position ?? 0) - (b.position ?? 0)),
    ],
    [kit.fans, machine.fans],
  );
  const zones: ZoneDef[] = parts.map((id) =>
    id === 'fans' ? { id, label: PART_LABEL[id], children: fans.map((f) => ({ id: f.id, label: fanName(f) })) } : { id, label: PART_LABEL[id] },
  );

  const [selection, setSelection] = useState<Set<string>>(() => new Set(initialPart && parts.includes(initialPart) ? [initialPart] : parts));
  const fanIds = useMemo(() => new Set(fans.map((f) => f.id)), [fans]);
  // The part in view: one zone picked (or one of its fans), else none.
  const shown: ChassisZoneId | null = useMemo(() => {
    const ids = [...selection];
    const partOf = (id: string): ChassisZoneId | null => (PARTS.includes(id as ChassisZoneId) ? (id as ChassisZoneId) : fanIds.has(id) ? 'fans' : null);
    const ps = new Set(ids.map(partOf).filter(Boolean));
    return ps.size === 1 && ids.length === 1 ? [...ps][0]! : null;
  }, [selection, fanIds]);
  useEffect(() => {
    onPartChange?.(shown);
  }, [shown, onPartChange]);

  // Every change writes the whole state, so the first one here takes every
  // part from Light Studio's desk look at once (lighting-family.3).
  const write = (next: ChassisLighting) => onChange({ chassis: next });
  const apply = (ids: string[], look: ZoneLook) => {
    const next = { ...value.zones };
    ids.forEach((id) => {
      next[id] = look;
      // The fans as one: every fan's own look goes with it.
      if (id === 'fans') fans.forEach((f) => delete next[f.id]);
    });
    write({ ...value, zones: next });
  };

  return (
    <div className="cl" data-on={value.on ? 'on' : 'off'}>
      {!drives && (
        <p className="pcz-note" role="status">
          Light Studio's desk look is on these lights. A change here takes them all back.
        </p>
      )}
      <ZoneLightsTab
        zones={zones}
        looks={value.zones}
        selection={selection}
        onSelection={setSelection}
        onApply={apply}
        brightness={value.brightness}
        onBrightness={(brightness) => write({ ...value, brightness })}
        other={
          resetInColumn ? (
            <div className="pcz-other">
              <ChassisLightsSettings onChange={onChange} />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// This PC, as a directory of its features.
//
// A mouse or a headset has a device window, and its face in My Devices is the
// list of that window's tabs. The PC is the same kind of device: its rows are
// the tabs of its own page (DesktopCanvas, LaptopCanvas), apart from the
// Performance cards below, grouped by where each feature lives, so the groups
// read the same as the top navigation (the user's arrangement, 2026-10-21):
//
//                Performance                                  Personalize
//   desktop      Power Mode · System Vitals · Power supply    LCD cooler cap ·
//                                                             Chassis lighting
//   notebook     Power Mode · System Vitals · Fan Cleaner     Lighting · Macro
//
// and, apart from the groups, one This PC button: the machine's own facts,
// its firmware, Device Manager and Get Support (AboutPcModal) — what only
// this PC has comes first (JW 1:1, 2026-10-19).
//
// The Personalize rows and Power supply open the PC's page at their tab. Power
// Mode, System Vitals and Fan Cleaner go to the Performance page, landing on
// their card (the Spotlight): their controls live there (JY, 2026-10-21).
// There used to be a second model with no PC page, whose rows went to each
// feature's own window; the designer cancelled it and kept this one (JY,
// 2026-10-22).
//
// Rules this file keeps (proposal: Treehouse/pc-device-proposal.zh.md):
//   · An entry shows, it never sets. The value is read from the feature's home
//     and changed only there (framework deck, Two sides: "shown in two places,
//     edited in one"; perform.3).
//   · A change software made is signed where it shows (perform.4) — on the
//     Performance page's card; the directory shows the value alone.
//   · No entry for something this machine does not have (perform.19,
//     lighting-family.6): every row below is gated on the SKU's own data.
//
// Left out on purpose: a notebook's battery is not a setting. System Vitals
// and Fan Cleaner are rows too (JY, 2026-10-21), and the PC page's Performance
// tab links to the same cards. Fan Cleaner shows only on a notebook
// (`hasFanCleaner`). The OMEN power supply is a Performance row (JY,
// 2026-10-21: its window is being redone to its Figma; the row and the tab
// point at what exists meanwhile).
//
// The directory follows the product scope (`MvpScope`). The June 2027 MVP
// leaves out OMEN hardware control and lighting (deck "Treehouse MVP Modules
// June 2027", slide 7), so under `june27` it trims to one System Vitals row
// and the This PC button.
// ══════════════════════════════════════════════════════════════════════════
import type { IconName } from '../components';
import type { MvpScope } from '../state/Settings';
import { allSkus, getResolvedSku, type ResolvedSku } from './skus';
import { capsOf } from './pcLighting';

/** Only a desktop or a notebook can be This PC. */
export function isPcType(type: string | undefined): boolean {
  return type === 'desktop' || type === 'notebook';
}

/** Part types the June 2027 scope leaves out. The cooler cap is hardware
 *  control (CPU cooler LCD), and an assumed part at that (see its registry
 *  note), so under `june27` it is not a part of the PC at all. */
const PART_TYPES_OUT_OF_JUNE = new Set(['desktop-cooler-cap']);

/** Whether a SKU of this type is shown under the scope. Only part types the
 *  scope leaves out answer no; everything else is shown in both. */
export function skuTypeInScope(type: string, scope: MvpScope): boolean {
  return !(scope === 'june27' && PART_TYPES_OUT_OF_JUNE.has(type));
}

/** The parts a desktop is built from (`partOf` in the registry), resolved,
 *  minus the ones the scope leaves out. */
export function partsOf(pcId: string, scope: MvpScope): ResolvedSku[] {
  return allSkus
    .filter((s) => s.partOf === pcId && skuTypeInScope(s.type, scope))
    .map((s) => getResolvedSku(s.id))
    .filter((s): s is ResolvedSku => !!s);
}

/** Whether this machine has a Fan Cleaner: a notebook only (JY, 2026-10-22).
 *  A desktop's one fan that cleans is its OMEN power supply's (fan-cleaner.32),
 *  and that clean stays with the supply, on the PC page's Power supply tab, so
 *  a desktop has no Fan Cleaner of its own. Never under June 2027, where the
 *  card is not on the Performance page. */
export function hasFanCleaner(pc: ResolvedSku, scope: MvpScope): boolean {
  return scope !== 'june27' && pc.type === 'notebook';
}

export type PcDestination =
  /** A page, landing on the card that holds the feature (the Spotlight state). */
  | { kind: 'page'; path: string; spot?: string }
  /** A device window, at a tab. */
  | { kind: 'device'; sku: string; tab?: string }
  /** A feature modal by its `?modal=` id, with any extra parameters it reads. */
  | { kind: 'modal'; modal: string; params?: Record<string, string> };

export interface PcRow {
  id: string;
  label: string;
  icon: IconName;
  /** What is true right now, read from the feature itself. */
  reading?: string;
  /** Where the entry goes. A row without one only reports. */
  to?: PcDestination;
}

export interface PcGroup {
  id: 'performance' | 'personalize';
  label: string;
  rows: PcRow[];
}

/** Live values the directory shows, read by the caller from their homes. */
export interface PcLive {
  /** The power mode, as a person reads it. */
  mode: string;
  /** What the cooler cap shows, or "Off", for a desktop with one. */
  capShows?: string;
  /** The OMEN power supply's status in a word, for a desktop with one. */
  psuStatus?: string;
  /** The CPU temperature, in the player's unit (the System Vitals numbers). */
  vitals?: string;
  /** The Fan Cleaner's standing, in the card's own word. */
  fanCleaner?: string;
  /** The desktop's lighting in one line, as its label on Personalize's 3D
   *  desk says it ("Wave", "Custom by part", "Off"; looks.ts towerLook). */
  chassisLook?: string;
}

/** The notebook's dedicated macro keys, from its record (keys-macros.7). */
export function macroKeyCount(pc: ResolvedSku): number {
  const n = (pc.features.keyboard as { macroKeys?: unknown } | undefined)?.macroKeys;
  return typeof n === 'number' && n > 0 ? n : 0;
}

export function pcDirectory(pc: ResolvedSku, live: PcLive, scope: MvpScope): PcGroup[] {
  const f = pc.features;
  const june = scope === 'june27';
  const notebook = pc.type === 'notebook';
  // The notebook's lighting exists only for a zone-lit keyboard — the same
  // gate DeviceModalHost and pcDeviceTabs use.
  const caps = capsOf(f);
  const litKeyboard = notebook && caps.keyboard !== 'none';
  const keyboardReading = caps.keyboard === 'per-key' ? 'Per key' : caps.keyboard === 'one' ? 'One zone' : '4 zones';
  const macroKeys = notebook ? macroKeyCount(pc) : 0;
  /** A tab of the PC's page. */
  const tab = (id: string): PcDestination => ({ kind: 'device', sku: pc.id, tab: id });

  // The parts with a window of their own (lcd-diy.25): on the PC's page each
  // is a tab. Gated on the part being in this PC's registry record.
  const parts = notebook || june ? [] : partsOf(pc.id, scope);
  const cap = parts.find((p) => p.type === 'desktop-cooler-cap');
  const psu = parts.find((p) => p.type === 'desktop-psu');

  // Power Mode, System Vitals and Fan Cleaner are cards of the Performance
  // page, so these rows go there and light the card.
  const card = (spot: string): PcDestination => ({ kind: 'page', path: '/perform', spot });

  const performance: PcRow[] = june
    ? [
        // June 2027 has no Power Mode or Fan Cleaner; the one row left is the
        // System Vitals glance.
        { id: 'vitals', label: 'System Vitals', icon: 'heartbeat', reading: live.vitals, to: card('vitals') },
      ]
    : [
        {
          id: 'power-mode',
          label: 'Power Mode',
          icon: 'performance',
          // The mode alone: who set it (OMEN AI) is said on the Performance
          // page's card, not in the directory (JY, 2026-10-21).
          reading: live.mode,
          to: card('power-mode'),
        },
        // No Advanced Tuning entry, on purpose: it is reached only from the top
        // mode, behind the Power Mode card's door (owner's call, 2026-10-05;
        // advanced-power.19). The Power Mode row above is the way there.
        { id: 'vitals', label: 'System Vitals', icon: 'heartbeat', reading: live.vitals, to: card('vitals') },
        ...(hasFanCleaner(pc, scope) ? [{ id: 'fan-cleaner', label: 'Fan Cleaner', icon: 'breeze' as IconName, reading: live.fanCleaner, to: card('fan-cleaner') }] : []),
        ...(psu ? [{ id: 'psu', label: 'Power supply', icon: 'bolt' as IconName, reading: live.psuStatus, to: tab('psu') }] : []),
      ];

  // Lighting is not in June 2027, on either machine.
  const personalize: PcRow[] = june
    ? []
    : notebook
    ? [
        ...(litKeyboard
          ? [{ id: 'lighting', label: 'Lighting', icon: 'lights' as IconName, reading: keyboardReading, to: tab('lighting') }]
          : []),
        // Only the dedicated macro keys take a macro here (keys-macros.7);
        // remapping the rest of the keyboard is not part of this PC's page.
        ...(macroKeys ? [{ id: 'macros', label: 'Macro', icon: 'keys' as IconName, reading: `${macroKeys} keys`, to: tab('macros') }] : []),
      ]
    : [
        ...(cap ? [{ id: 'cooler-cap', label: 'LCD cooler cap', icon: 'brightness' as IconName, reading: live.capShows, to: tab('cooler-cap') }] : []),
        // The PC page's Chassis lighting tab (lighting.19: one device's
        // lighting has one home). It reads what the lights wear now, as the 3D label does, not the
        // parts they are on (JY, 2026-10-21).
        { id: 'lighting', label: 'Chassis lighting', icon: 'lights' as IconName, reading: live.chassisLook, to: tab('lighting') },
      ];

  return [
    { id: 'performance', label: 'Performance', rows: performance },
    { id: 'personalize', label: 'Personalize', rows: personalize },
  ].filter((g): g is PcGroup => g.rows.length > 0);
}

/** The machine's own facts, for About this PC — only what the data holds. A
 *  desktop's components are its parts, so their facts are read from there; a
 *  notebook carries them on its own record. One list either way, so a part is
 *  never stated twice. */
export function aboutFacts(pc: ResolvedSku, scope: MvpScope): { label: string; value: string }[] {
  const f = pc.features;
  const parts = partsOf(pc.id, scope);
  const part = (type: string) => parts.find((p) => p.type === type)?.features;
  const gpu = part('desktop-gpu');
  const ram = part('desktop-ram');
  const cooling = part('desktop-cpu-cooling');
  const psu = part('desktop-psu');
  const hub = part('desktop-lighting');
  const out: { label: string; value: string }[] = [{ label: 'Model', value: pc.name }];
  const add = (label: string, value: unknown) => {
    if (typeof value === 'string' && value) out.push({ label, value });
  };
  add('Processor', f.cpu);
  add('Graphics', f.gpu ?? (gpu ? `${gpu.model}${gpu.vramGB ? ` (${gpu.vramGB} GB)` : ''}` : undefined));
  add('Memory', f.memory ?? (ram ? `${ram.capacityGB} GB DDR5-${ram.speedMTs}` : undefined));
  add('Storage', f.storage);
  if (cooling) add('Cooling', `${cooling.radiatorMm} mm ${cooling.kind}${cooling.fanCount ? `, ${cooling.fanCount} fans` : ''}`);
  if (psu) add('Power supply', `${psu.wattage} W${psu.efficiency ? `, ${psu.efficiency}` : ''}`);
  if (hub) add('Lighting', `${hub.argbZones} ARGB zones, ${hub.fanChannels} fan channels`);
  if (f.display && typeof f.display === 'object') {
    add(
      'Display',
      [f.display.size, f.display.resolution, f.display.refreshRate ? `${f.display.refreshRate} Hz` : '']
        .filter(Boolean)
        .join(' · '),
    );
  }
  if (f.battery && typeof f.battery.capacityWh === 'number') add('Battery', `${f.battery.capacityWh} Wh`);
  add('Wireless', f.wireless);
  add('Firmware', f.firmware);
  return out;
}

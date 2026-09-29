// ══════════════════════════════════════════════════════════════════════════
// The Treehouse 32's rear ports — what is physically there and what is plugged
// into it. ONE list, read by every view that talks about a port.
//
// Why this file exists (2026-08-06, after a design review): the same facts used
// to live in three places — the card port map's array, the fullscreen X-ray's
// array, and a hardcoded pair of rows under "Rename Inputs". They had already
// drifted: the map called DP and HDMI 1 empty while the X-ray lit them up and
// the rename rows named the very devices on them. Fixing the three copies by
// hand would have been correct for a day; the next person to edit one of them
// splits them again.
//
// What stays OUT of here: pixel coordinates. Each view sits on a different
// image (the card's flat plate, the mirrored fullscreen render) so the geometry
// genuinely differs — those tables live next to the view that uses them and
// join back here by `id`.
// ══════════════════════════════════════════════════════════════════════════

import { deskHosts, deskPcs } from '../arrangement';

export type PortKind = 'hdmi' | 'dp' | 'usbc' | 'usba' | 'audio';

export interface Port {
  /**
   * This port carries one of the two computers on the desk, by its index in the
   * SKU's `gearSwitch.hosts`. The literal in `connected` is only the fallback
   * for when the SKU has no hosts list — `connectedName` prefers the live name,
   * so renaming a computer in one place renames it in the port map too.
   */
  host?: 0 | 1;
  /** Stable key. Joins the per-view coordinate tables and the rename state. */
  id: string;
  /** As printed on the rear panel — this is what the user matches against. */
  label: string;
  /** The connector standard, for the tooltip's first row. */
  standard: string;
  kind: PortKind;
  /** Plain-language "what do I plug in here". */
  useFor: string;
  speed?: string;
  /**
   * True for the ports fed by the USB hub, which Limited port power switches
   * off. Deliberately NOT set on the KVM port: SPEC xray #11 keeps display,
   * charging, KVM and audio alive in Limited — only the spare hub ports go.
   */
  hub?: boolean;
  /** Device on the other end. Absent = nothing plugged in. */
  connected?: string;
  /** Video inputs the user is allowed to rename in Connectivity. */
  renameable?: boolean;
}

/**
 * Left → right as the ports sit on the rear panel, which is the order the card's
 * port map draws them. The fullscreen X-ray shows the same panel mirrored
 * (SPEC: xray #3), so that view walks this list backwards — see XRAY_GEOM.
 */
export const PORTS: Port[] = [
  { id: 'audio', label: 'Audio out', standard: '3.5mm analogue', kind: 'audio',
    useFor: 'Headphones & speakers' },
  { id: 'usbc3', label: 'USB-C 3', standard: 'USB-C 3.2 Gen2', kind: 'usbc',
    useFor: 'USB devices', speed: '10Gbps', hub: true },
  { id: 'usba2', label: 'USB-A 2', standard: 'USB-A 3.2 Gen2', kind: 'usba',
    useFor: 'USB devices', speed: '10Gbps', hub: true },
  { id: 'usba1', label: 'USB-A 1', standard: 'USB-A 3.2 Gen2', kind: 'usba',
    useFor: 'USB devices', speed: '10Gbps', hub: true },
  // `Keyboard & mouse for Gear Switch` -> `Keyboard & mouse` (2026-08-20): the
  // hover card's own title is `USB-A · Gear Switch`, so the value was repeating
  // the title two lines below it — and at 32 characters it was the one row in
  // the card that wrapped, which is what made the card hard to read.
  { id: 'usbaKvm', label: 'USB-A · Gear Switch', standard: 'USB-A 3.2 Gen2', kind: 'usba',
    useFor: 'Keyboard & mouse', speed: '10Gbps',
    connected: 'Keyboard & mouse dongle' },
  { id: 'c2', label: 'C2', standard: 'USB-C Thunderbolt 4', kind: 'usbc',
    useFor: 'Laptop + 90W charging', speed: '40Gbps', connected: 'MacBook', host: 0, renameable: true },
  { id: 'c1', label: 'C1', standard: 'USB-C DP Alt Mode', kind: 'usbc',
    useFor: 'Laptop + 90W charging', speed: '40Gbps', renameable: true },
  { id: 'dp1', label: 'DP 1', standard: 'DisplayPort 1.4', kind: 'dp',
    useFor: 'PCs', speed: '32.4Gbps', connected: 'the second computer', host: 1, renameable: true },
  { id: 'hdmi2', label: 'HDMI 2', standard: 'HDMI 2.1', kind: 'hdmi',
    useFor: 'Consoles & PCs', speed: '48Gbps', renameable: true },
  { id: 'hdmi1', label: 'HDMI 1', standard: 'HDMI 2.1', kind: 'hdmi',
    useFor: 'Consoles & PCs', speed: '48Gbps', connected: 'Console', renameable: true },
];

/**
 * A monitor with no rear-panel drawing still has ports — the SKU lists them in
 * `connectivity.inputs` (OMEN OLED 27: `HDMI 2.1 ×2` · `DisplayPort 1.4` ·
 * `USB-C (DP+PD 65W)`). Unrolled here into the same `Port` rows the Treehouse 32
 * reads from PORTS, so both monitors' Inputs fold is one grammar: port name on
 * the left, what is plugged in as a name you can change (2026-09-23, Cindy —
 * the two Connectivity tabs had drifted into two designs). The Treehouse 32 only
 * lists what is plugged, because its plate shows the rest; with no plate, every
 * video input is a row.
 *
 * ASSUMPTION, not a recorded fact: the laptop (host 0) is put on the first USB-C
 * port. Nothing says which cable the MacBook uses on this monitor; USB-C with
 * power delivery is the one-cable laptop port, the same reason C2 carries it on
 * the Treehouse 32.
 */
export function specPorts(inputs: string[]): Port[] {
  const out: Port[] = [];
  let laptopPlaced = false;
  for (const raw of inputs) {
    const m = raw.match(/^(HDMI|DisplayPort|USB-C)\b(.*?)(?:\s*[×x]\s*(\d+))?\s*$/i);
    if (!m) continue;
    const kind: PortKind = /^hdmi/i.test(m[1]) ? 'hdmi' : /^usb/i.test(m[1]) ? 'usbc' : 'dp';
    const count = Number(m[3] || 1);
    const short = kind === 'hdmi' ? 'HDMI' : kind === 'dp' ? 'DP' : 'USB-C';
    const standard = raw.replace(/\s*[×x]\s*\d+\s*$/, '').trim();
    for (let i = 1; i <= count; i++) {
      const numbered = kind !== 'usbc' || count > 1;
      const port: Port = {
        id: `${short.toLowerCase().replace('-', '')}${numbered ? i : ''}`,
        label: numbered ? `${short} ${i}` : short,
        standard,
        kind,
        useFor: kind === 'usbc' ? 'Laptop + charging' : kind === 'dp' ? 'PCs' : 'Consoles & PCs',
        renameable: true,
      };
      if (kind === 'usbc' && !laptopPlaced) {
        port.connected = 'MacBook';
        port.host = 0;
        laptopPlaced = true;
      }
      out.push(port);
    }
  }
  return out;
}

/** Names the user typed in "Rename Inputs", keyed by port id. */
export type PortNames = Record<string, string>;

/**
 * Whether something is plugged into this port ON THIS DESK — the one answer for
 * the lit state, the Inputs rows and the name below (2026-09-21 flow audit).
 *
 * A host port is only occupied when that computer is on the desk (Admin row,
 * 2026-09-08). That rule lived inside `connectedName` alone, so the hover card
 * stopped naming a computer that had left while the port map kept lighting its
 * port: on a `1 monitor` desk (no tower) DP 1 still glowed as occupied, and the
 * Inputs fold still listed a DP 1 row with nothing to name. Both pictures and
 * the rows ask this now instead of reading the `connected` literal.
 */
export function isPlugged(p: Port): boolean {
  if (!p.connected) return false;
  return p.host == null || deskPcs().includes(p.host);
}

/** What a port is currently called — the user's name for it if they set one. */
export function connectedName(p: Port, names?: PortNames): string | undefined {
  // Host first: a name someone typed for a computer that has since left the
  // desk must not make its empty port read as connected.
  if (!isPlugged(p)) return undefined;
  if (names?.[p.id]) return names[p.id];
  if (p.host != null) return deskHosts()[p.host];
  return p.connected;
}

/** The port a computer on this desk is plugged into (`host`: 0 = MacBook,
    1 = tower — the routing numbers `deskPcs()` uses). */
export function hostPort(host: number): Port | undefined {
  return PORTS.find((p) => p.host === host);
}

/** Limited port power cuts the hub ports; everything else keeps running. */
export function isOff(p: Port, limited: boolean): boolean {
  return limited && !!p.hub;
}

export interface PortTipRow {
  label: string;
  value: string;
}

/**
 * The hover card's contents. Both views render the same rows from the same
 * function, so a port cannot describe itself differently depending on where you
 * happen to be looking at it.
 */
export function portTip(p: Port, opts: { limited?: boolean; names?: PortNames } = {}) {
  const off = isOff(p, !!opts.limited);
  const name = connectedName(p, opts.names);
  const rows: PortTipRow[] = [{ label: 'Standard', value: p.standard }];
  rows.push({ label: 'Use for', value: p.useFor });
  if (p.speed) rows.push({ label: 'Speed', value: p.speed });
  if (name) rows.push({ label: 'Connected', value: name });
  rows.push({
    label: 'Status',
    value: off ? 'Off · USB hub disabled' : name ? 'Active' : 'Empty',
  });
  return {
    title: p.label,
    warn: !off && p.hub ? 'Switched off in Limited port power' : undefined,
    rows,
  };
}

import { useState } from 'react';
import { Menu, ModalShell, Toggle } from '../../components';

// ── Booster Manage modal (PerformV5) ──
// Control-and-Status modal, NO image. It NAVIGATES between four optimization
// groups → left rail per R8 (same justification as System Vitals). Content is
// grounded in the shipping OGH Booster surface (screenshots, 2026-07-23):
//   Essentials 3/11 · Background processes 0/43 · Windows services 0/13 ·
//   Advanced services 0/10 — defaults: 3 essentials selected.
// The left rail carries the modal-global control: the TRIGGER toggle, OGH's
// own copy "Boost all my games" — arming, not activation (the pack applies at
// game launch, reverts on exit). 2.0: this folds under the OMEN AI umbrella
// (DR-1.1b). OGH's gauge / MANUAL BOOST / notify options are left out of the
// demo — candidates, not decisions.

interface Item {
  id: string;
  name: string;
  desc: string;
  /** processes: memory footprint · services: Running/Stopped */
  meta?: string;
  on?: boolean;
}

interface Group {
  id: string;
  label: string;
  total: number;
  desc: string;
  items: Item[];
}

// Real OGH copy and items (trimmed lists where the source scrolls).
const GROUPS: Group[] = [
  {
    id: 'essentials',
    label: 'Essentials',
    total: 11,
    desc: 'Essential items for CPU and memory optimization for overall performance boost.',
    items: [
      { id: 'clipboard', name: 'Clear Clipboard', desc: 'Clear Clipboard history to release memory' },
      { id: 'dvr', name: 'Disable background recording', desc: 'Temporarily disables automatic background video recording when playing a game (DVR)' },
      { id: 'updates', name: 'Disable Automatic Updates', desc: 'Temporarily disable Windows automatic updates', on: true },
      { id: 'coreparking', name: 'Disable CPU Core Parking', desc: 'Keeps all CPU cores active during game play' },
      { id: 'energyeff', name: 'Disable CPU Energy Efficiency', desc: 'CPU always operates at high performance when gaming' },
      { id: 'fileshare', name: 'Disable File and Printer Sharing', desc: 'Temporarily disable File and Printer Sharing' },
      { id: 'gamebar', name: 'Disable Game Bar', desc: 'Temporarily disables the Microsoft Game Bar' },
      { id: 'gamemode', name: 'Disable Game Mode', desc: 'Turns off Game Mode from Windows Settings' },
      { id: 'winkey', name: 'Disable Windows Key', desc: 'Temporarily disables the Windows key' },
      { id: 'memboost', name: 'Memory Boost', desc: 'Clear unused working and standby memory', on: true },
      { id: 'highprio', name: 'Set game process to High Priority', desc: 'OS prioritizes CPU and RAM resources to the game', on: true },
    ],
  },
  {
    id: 'processes',
    label: 'Processes',
    total: 43,
    desc: 'Selected background processes will be automatically closed during Boost. Terminating some processes may disrupt the normal operation of your PC — select only the ones you are familiar with.',
    items: [
      { id: 'node1', name: 'Node.js JavaScript Runtime', desc: '', meta: '154 MB' },
      { id: 'lghub', name: 'LGHUB Agent', desc: '', meta: '127 MB' },
      { id: 'copilot', name: 'Microsoft 365 Copilot App', desc: '', meta: '88 MB' },
      { id: 'onedrive', name: 'Microsoft OneDrive Sync Service', desc: '', meta: '87 MB' },
      { id: 'cc', name: 'Creative Cloud Core Service', desc: '', meta: '83 MB' },
      { id: 'phonelink', name: 'Microsoft Phone Link', desc: '', meta: '77 MB' },
      { id: 'nvcontainer', name: 'nvcontainer.exe', desc: '', meta: '75 MB' },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    total: 13,
    desc: 'Basic Windows Services that can be safely turned off to free up system resources while gaming.',
    items: [
      { id: 'shellhw', name: 'ShellHWDetection', desc: 'Provides notifications for AutoPlay hardware events', meta: 'Running' },
      { id: 'spooler', name: 'Spooler', desc: 'Spools print jobs — turning it off hides your printers', meta: 'Running' },
      { id: 'storsvc', name: 'StorSvc', desc: 'Enabling services for storage settings and external storage', meta: 'Running' },
      { id: 'sysmain', name: 'SysMain', desc: 'Maintains and improves system performance over time', meta: 'Running' },
      { id: 'trkwks', name: 'TrkWks', desc: 'Maintains links between NTFS files across a network', meta: 'Stopped' },
      { id: 'usosvc', name: 'UsoSvc', desc: 'Manages Windows Updates — devices cannot update if stopped', meta: 'Running' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    total: 10,
    desc: 'Advanced Windows Services. Terminating these may disrupt normal operation of your PC — select only the ones you are familiar with.',
    items: [
      { id: 'appready', name: 'AppReadiness', desc: 'Gets apps ready for use the first time a user signs in', meta: 'Stopped' },
      { id: 'btag', name: 'BTAGService', desc: 'Audio gateway role of the Bluetooth Handsfree Profile', meta: 'Running' },
      { id: 'bthavctp', name: 'BthAvctpSvc', desc: 'Audio Video Control Transport Protocol service', meta: 'Running' },
      { id: 'devassoc', name: 'DeviceAssociationService', desc: 'Pairing between the system and wired or wireless devices', meta: 'Running' },
      { id: 'devinstall', name: 'DeviceInstall', desc: 'Stopping this service will result in system instability', meta: 'Stopped' },
      { id: 'dsmsvc', name: 'DsmSvc', desc: 'Detection and installation of device-related software', meta: 'Stopped' },
    ],
  },
];

export interface BoosterModalProps {
  armed: boolean;
  onArmed: (on: boolean) => void;
  onClose?: () => void;
}

export function BoosterModal({ armed, onArmed, onClose }: BoosterModalProps) {
  const [tab, setTab] = useState('essentials');
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of GROUPS) for (const it of g.items) init[it.id] = !!it.on;
    return init;
  });
  const active = GROUPS.find((g) => g.id === tab) ?? GROUPS[0];
  const countOf = (g: Group) => g.items.filter((it) => checked[it.id]).length;

  const left = (
    <div className="pv5-bm-left">
      <div className="pv5-bm-id-sub">The optimization pack — applies at game launch, reverts on exit.</div>
      {/* the trigger toggle (OGH copy) — arming, not activation */}
      <div className="pv5-bm-arm">
        <span className="pv5-bm-arm-l">Boost all my games</span>
        <Toggle checked={armed} onChange={onArmed} aria-label="Boost all my games" />
      </div>
      <Menu
        orientation="vertical"
        aria-label="Optimization groups"
        items={GROUPS.map((g) => ({
          id: g.id,
          label: `${g.label} · ${countOf(g)}/${g.total}`,
          active: g.id === tab,
          onClick: () => setTab(g.id),
        }))}
      />
    </div>
  );

  return (
    <ModalShell title="Booster" onClose={onClose} className="pv5-bm" left={left}>
      <div className="pv5-bm-desc">{active.desc}</div>
      <div className="pv5-bm-list">
        {active.items.map((it) => (
          <label className="pv5-bm-item" key={it.id}>
            <input
              type="checkbox"
              checked={!!checked[it.id]}
              onChange={(e) => setChecked((c) => ({ ...c, [it.id]: e.target.checked }))}
            />
            <span className="pv5-bm-item-name">{it.name}</span>
            {it.desc && <span className="pv5-bm-item-desc">{it.desc}</span>}
            {it.meta && <span className="pv5-bm-item-meta">{it.meta}</span>}
          </label>
        ))}
      </div>
      {active.items.length < active.total && (
        <div className="pv5-nbm-note">
          …{active.total - active.items.length} more in the full list (demo shows the visible rows).
        </div>
      )}
    </ModalShell>
  );
}

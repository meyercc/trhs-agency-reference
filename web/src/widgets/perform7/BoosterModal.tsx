import { useState } from 'react';
import { Menu, ModalShell, Toggle } from '../../components';
import { InfoDisclosure } from './InfoDisclosure';

// ── Booster Manage modal (PerformV7) ──
// V7 fork, applying the shell rules the other modals now follow:
//   · RAIL = NAVIGATION. The pack description and the arming toggle left it.
//   · HEADER RIGHT = the control that governs the whole modal. "Boost all my
//     games" arms the entire pack, so it belongs there. This is the first modal
//     where a control and an explanation both wanted the top-right, which is
//     what settled the rule: control keeps the prime slot, help goes bottom-left.
//   · FOOTER LEFT = About, carrying the pack description.
//   · COUNTS MOVE TO THE PAGE THEY DESCRIBE. "Essentials · 3/11" in a nav item
//     made the rail carry state as well as destination; each group now states
//     its own count at the top of its own page, next to the bulk control that
//     changes it.
//
// On a modal-wide "apply all": scoped to the visible GROUP instead. A single
// control that ticks all 77 items would write across Windows update policy,
// the Game Bar, print spooling and Bluetooth in one click, and the groups
// themselves warn that some of these disrupt normal operation. Bulk selection
// belongs where the user can see what it selects. A modal-wide version is a
// product decision, not a layout one.
//
// Original V5 note follows.
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

  const allOn = active.items.every((it) => checked[it.id]);
  const setGroup = (on: boolean) =>
    setChecked((c) => {
      const next = { ...c };
      for (const it of active.items) next[it.id] = on;
      return next;
    });

  // Rail: destinations only. The counts were state living in a nav label.
  const left = (
    <div className="pv5-bm-left pv7-bm-left">
      <Menu
        orientation="vertical"
        aria-label="Optimization groups"
        items={GROUPS.map((g) => ({
          id: g.id,
          label: g.label,
          active: g.id === tab,
          onClick: () => setTab(g.id),
        }))}
      />
    </div>
  );

  // The one control that governs the whole modal: it arms the entire pack.
  const headerControl = (
    <label className="pv7-bm-arm">
      <span className="pv7-bm-arm-l">Boost all my games</span>
      <Toggle checked={armed} onChange={onArmed} aria-label="Boost all my games" />
    </label>
  );

  const about = (
    <InfoDisclosure label="About" title="Booster">
      <p className="pv7-disc-body">
        An optimization pack rather than a task you run: it applies when a game launches and reverts
        when the game exits. Arming it here decides what the pack contains; nothing changes until a
        game starts.
      </p>
    </InfoDisclosure>
  );

  return (
    <ModalShell
      title="Booster"
      onClose={onClose}
      className="pv5-bm pv7-bm"
      left={left}
      headerControl={headerControl}
      footer={<div className="pv7-footer">{about}</div>}
    >
      {/* The count states this page, next to the control that changes it. */}
      <div className="pv7-bm-grouphead">
        <span className="pv7-bm-count">
          <b>{countOf(active)}</b> of {active.total} selected
        </span>
        <button type="button" className="pv5-card-door" onClick={() => setGroup(!allOn)}>
          {allOn ? 'Clear all' : 'Select all'}
        </button>
      </div>
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

// Booster modal data — ported from vanilla `tpl-boost` (prototype.html).
// In-memory only (matches the vanilla prototype).

export interface BoostRow {
  label: string;
  sublabel?: string;
  /** orange warning styling on the sublabel (advanced services). */
  warn?: boolean;
  defaultOn?: boolean;
  /** non-interactive row that shows an "Always On" badge instead of a toggle. */
  alwaysOn?: boolean;
  /** italic/subtle label (the vanilla "* example *" placeholder row). */
  muted?: boolean;
}

export interface BoostGroup {
  id: string;
  title: string;
  /** parenthetical note after the title, e.g. "(Basic)". */
  note?: string;
  desc: string;
  /** drives the group icon + its accent color. */
  accent: 'cyan' | 'gray' | 'orange' | 'purple';
  /** static "N of M selected" chip (decorative, matches vanilla). */
  badge?: string;
  /** a "Select All" link in the header (decorative). */
  selectLink?: boolean;
  /** a group-level on/off toggle in the header (Background Processes). */
  headerToggle?: boolean;
  expanded?: boolean;
  rows: BoostRow[];
}

/** Left-panel scan/defrag summary stats. */
export const BOOST_STATS: { label: string; value: string; green?: boolean }[] = [
  { label: 'Space to be cleared', value: '2.00 GB', green: true },
  { label: 'Transfers to speed up', value: '2.00 GB' },
  { label: 'Data to defrag', value: '100.21 GB' },
  { label: 'Last cleaned', value: '2/17/23 2:00 AM' },
];

export const BOOST_GROUPS: BoostGroup[] = [
  {
    id: 'opt-perf',
    title: 'Performance Optimizations',
    desc: 'Optimize tasks for CPU and memory optimization for overall performance boost',
    accent: 'cyan',
    badge: '8 of 9 selected',
    selectLink: true,
    expanded: true,
    rows: [
      { label: 'Clear Clipboard', defaultOn: true },
      { label: 'Disable Automatic Background Recording', defaultOn: true },
      { label: 'Disable Automatic Updates', defaultOn: true },
      { label: 'Disable CPU Core Parking', defaultOn: true },
      { label: 'Disable CPU Energy Efficiency', defaultOn: true },
      { label: '* example *', muted: true, alwaysOn: true },
      { label: 'Disable Windows Key', defaultOn: false },
      { label: 'Memory Boost', sublabel: 'Reclaim unused RAM before session starts', defaultOn: true },
      { label: 'Set Game Process to High Priority', defaultOn: true },
    ],
  },
  {
    id: 'opt-win-basic',
    title: 'Windows Services',
    note: '(Basic)',
    desc: 'These services can be safely turned off to free up system resources',
    accent: 'gray',
    badge: '5 of 8 selected',
    rows: [
      { label: 'Windows Search Indexing', sublabel: 'Temporarily disables background indexing', defaultOn: true },
      { label: 'Print Spooler', defaultOn: true },
      { label: 'Windows Telemetry', defaultOn: false },
      { label: 'Superfetch / SysMain', defaultOn: true },
      { label: 'Windows Update Service', defaultOn: true },
      { label: 'Connected User Experiences', defaultOn: false },
      { label: 'Diagnostic Policy Service', defaultOn: false },
      { label: 'Remote Registry', defaultOn: true },
    ],
  },
  {
    id: 'opt-win-adv',
    title: 'Windows Services',
    note: '(Advanced)',
    desc: "Use these only if you know what you're doing. Select only for find tuning.",
    accent: 'orange',
    badge: '2 of 6 selected',
    rows: [
      { label: 'Windows Defender Real-time Protection', sublabel: 'May reduce security while enabled', warn: true, defaultOn: false },
      { label: 'Firewall Service', sublabel: 'May reduce security while enabled', warn: true, defaultOn: false },
      { label: 'Windows Error Reporting', defaultOn: true },
      { label: 'Hyper-V Services', defaultOn: false },
      { label: 'Windows Insider Service', defaultOn: true },
      { label: 'Xbox Services Bundle', defaultOn: false },
    ],
  },
  {
    id: 'opt-bg',
    title: 'Background Processes',
    desc: 'Background apps and processes will be automatically closed during Boost',
    accent: 'purple',
    headerToggle: true,
    rows: [
      { label: 'Discord', defaultOn: true },
      { label: 'Spotify', defaultOn: false },
      { label: 'Steam Client Bootstrapper', defaultOn: true },
      { label: 'Epic Games Launcher', defaultOn: true },
      { label: 'Browser (Background Tabs)', defaultOn: false },
    ],
  },
];

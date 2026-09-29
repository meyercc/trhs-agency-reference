// ══════════════════════════════════════════════════════════════════════════
// The desks we review on, by name (2026-09-21, Cindy).
//
// Why a list at all: two people reviewing "the OLED 27 window" were looking at
// two different desks — the capture came from a fresh browser (every device on),
// Cindy's browser remembered whatever Admin had last been set to, and nobody
// could say which. A listed desk is one both sides can open: "look at it on
// `Laptop · 2 monitors`" means the same screen on every machine.
//
// Grouped by COMPUTERS, rows by MONITOR count (2026-09-22, Cindy via the flow
// window: "드롭다운 너무 헷갈려 … 구분을 지어야"). One number per row. The group
// is called `Laptop`, not `1 computer`, because every desk here has the MacBook,
// so a "1 monitor" desk still shows two screens (the laptop's own) and
// Personalize says `Arrange 2 displays` — the word `Laptop` in the header is what
// keeps that from reading as a mismatch. Counts, never product names (09-21).
//
// Why these four and no more: each changes ONE thing from the one before it —
// a second monitor, or a second computer — so what differs between two of them
// is caused by that one thing. The last is the team-demo desk. A desk outside
// the list (the tower alone, say) is not a scenario: opening Admin sets the desk
// to the first one (a test tool, nothing to lose — Cindy 09-22, replacing the
// `Custom` option nobody could read). Add one here and the Admin menu offers it.
//
// This file is the ONLY copy. The Admin row renders it, and the desk agreement
// check reads the chosen one back off the row (`data-desk`) instead of keeping
// its own list — two lists drift (consultant master: one judge per value).
// ══════════════════════════════════════════════════════════════════════════
import type { DeskDevice } from './arrangement';

export interface DeskScenario {
  id: string;
  /** Menu group header — the computers on the desk. */
  group: string;
  /** Menu row — the monitor count. Closed, the picker reads `group · row`. */
  row: string;
  /** The optional hardware on the desk; the Treehouse 32 is always there. */
  desk: DeskDevice[];
  /** One word beside the row and under the picture: what this desk is for in a review. */
  look: string;
  /** Where that word opens. Absent = there is no one screen to go to. */
  to?: string;
}

export const DESK_SCENARIOS: DeskScenario[] = [
  { id: 'one-monitor', group: 'Laptop', row: '1 monitor', desk: ['macbook'], look: 'Most common' },
  {
    id: 'two-monitors',
    group: 'Laptop',
    row: '2 monitors',
    desk: ['pulse-27', 'macbook'],
    look: 'Arrange',
    // The Arrange editor's own deep link — the DESK card's corner button uses it.
    to: '/?sku=treehouse-32&arrange=1',
  },
  {
    id: 'two-computers',
    group: 'Laptop + desktop',
    row: '1 monitor',
    desk: ['macbook', 'tower'],
    look: 'Gear Switch',
    to: '/?sku=treehouse-32&tab=connectivity',
  },
  { id: 'full-desk', group: 'Laptop + desktop', row: '2 monitors', desk: ['pulse-27', 'macbook', 'tower'], look: 'Team demo' },
];

/** The scenarios in menu order, grouped under their headers. */
export const DESK_SCENARIO_GROUPS: { group: string; rows: DeskScenario[] }[] = DESK_SCENARIOS.reduce(
  (acc, s) => {
    const g = acc.find((x) => x.group === s.group);
    if (g) g.rows.push(s);
    else acc.push({ group: s.group, rows: [s] });
    return acc;
  },
  [] as { group: string; rows: DeskScenario[] }[],
);

/** The scenario this hardware list is, or undefined when it is none of them. */
export function scenarioOf(desk: DeskDevice[]): DeskScenario | undefined {
  return DESK_SCENARIOS.find((s) => s.desk.length === desk.length && s.desk.every((d) => desk.includes(d)));
}

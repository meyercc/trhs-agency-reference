/**
 * "Catch Me Up" — the press demo's fixture (TH-478, docs/catch-me-up-demo-plan.md).
 *
 * What the app knows about the games you have drifted from: where you stopped,
 * what you were building, and the updates you have not played on. Pure, no
 * React, so the verify suite and Nova's scripts read the same rows.
 *
 * Two rules the copy keeps, and the suite enforces:
 *   · Spoiler-safe. Nothing past `marker`. `SPOILER_DENYLIST` lists what the
 *     recap must never say for each game; verify-catch-up fails on a hit.
 *   · Updates are named by version, never dated — "updates you haven't played
 *     on", not a changelog.
 *
 * Time is fixed. `CATCH_UP_NOW` is the demo's "now" (the same pattern as
 * Personalize's DEMO_NOW), so "94 days away" holds on any machine on any day.
 * Nothing here reads `Date.now()`, and the UI shows days, never a date.
 *
 * Every story line needs a fact-check by someone who has played the game, and
 * the art and copy need publisher sign-off, before press.
 */

export const CATCH_UP_NOW = new Date(2026, 9, 19, 19, 30);

const DAY = 86_400_000;

/** An update released since your last session. */
export interface CatchUpChange {
  id: string;
  /** The version and what it did, as a sentence: "Update 2.0 rebuilt every perk tree". */
  title: string;
  /** One sentence on what it means for you. */
  impact: string;
  /** It changes how the build you were running plays. */
  affectsBuild?: boolean;
}

export interface CatchUpEntry {
  /** A `GAMES` id (data/games.ts). */
  gameId: string;
  /** What the person calls it — matched in typed requests. */
  aliases: string[];
  lastPlayed: string;
  hours: number;
  /** The spoiler boundary, as the badge shows it: "Spoiler-safe · up to {marker}". */
  marker: string;
  /** At most three short paragraphs, none past the marker. */
  storySoFar: string[];
  build: { name: string; summary: string };
  location: string;
  /** The one thing you were about to do. */
  nextObjective: string;
  changes: CatchUpChange[];
  /** The detail given only when asked. */
  deeper: { build: string };
  /** The widget row's one line. */
  oneLiner: string;
}

export const CATCH_UP: CatchUpEntry[] = [
  {
    gameId: 'cyberpunk',
    aliases: ['cyberpunk', '2077', 'night city'],
    lastPlayed: new Date(CATCH_UP_NOW.getTime() - 94 * DAY).toISOString(),
    hours: 41,
    marker: 'the start of Act 2',
    storySoFar: [
      'You are V, a mercenary trying to make a name in Night City. You and Jackie Welles took the job that was supposed to make it: steal the Relic, an Arasaka biochip, from Konpeki Plaza.',
      'The heist went wrong. The Relic ended up in your head, and it carries the engram of Johnny Silverhand, a rockerboy who has been dead for fifty years.',
      'Johnny talks to you now, and the chip is rewriting you. Finding a way to get it out is the whole job.',
    ],
    build: { name: 'Netrunner', summary: 'Intelligence first. Quickhacks do the fighting, so you stay out of sight and let the network work.' },
    location: 'Your apartment, Megabuilding H10, Watson',
    nextObjective: 'See Viktor about what the Relic is doing to you.',
    changes: [
      { id: 'cp-2.0', title: 'Update 2.0 rebuilt every perk tree', impact: 'Your perk points were refunded, so your build needs re-spending before it plays the way you left it.', affectsBuild: true },
      { id: 'cp-2.1', title: 'Update 2.1 opened the metro', impact: 'NCART trains connect the districts, and you can ride them.' },
    ],
    deeper: {
      build: 'Update 2.0 refunded your perk points, so start by re-spending them. For a quickhack build, the new Intelligence tree centres on Overclock, which lets a hack spend health when you run out of RAM. Armor now comes from cyberware rather than clothes, so check your capacity before you buy anything new.',
    },
    oneLiner: 'Netrunner, Act 1 done. The Relic is in your head and Viktor is waiting.',
  },
  {
    gameId: 'eldenring',
    aliases: ['elden ring', 'elden'],
    lastPlayed: new Date(CATCH_UP_NOW.getTime() - 141 * DAY).toISOString(),
    hours: 23,
    marker: 'Stormveil Castle',
    storySoFar: [
      'You are Tarnished, called back to the Lands Between to seek the Elden Ring.',
      'You crossed Limgrave and made it to the gate of Stormveil Castle.',
    ],
    build: { name: 'Strength', summary: 'Heavy weapons and a shield. You hit slowly and you hit hard.' },
    location: 'Stormhill, at the Castleward Tunnel site of grace',
    nextObjective: 'Climb Stormveil Castle and face its lord.',
    changes: [
      { id: 'er-1.12', title: 'Patch 1.12 rebalanced weapons', impact: 'Several colossal weapons recover faster between swings.', affectsBuild: true },
    ],
    deeper: { build: 'Your colossal weapon swings recover a little faster, so trading hits is safer than it was.' },
    oneLiner: 'Strength build at the gate of Stormveil Castle. Its lord is next.',
  },
  {
    gameId: 'reddead2',
    aliases: ['red dead', 'rdr2', 'rdr 2'],
    lastPlayed: new Date(CATCH_UP_NOW.getTime() - 212 * DAY).toISOString(),
    hours: 18,
    marker: 'Chapter 2',
    storySoFar: [
      'You are Arthur Morgan, an outlaw in the Van der Linde gang. A job in Blackwater went wrong and the gang is running.',
      'They came down out of the snow and set up camp at Horseshoe Overlook.',
    ],
    build: { name: 'High honor', summary: 'You have mostly been helping people on the road, and the camp likes you for it.' },
    location: 'Camp at Horseshoe Overlook',
    nextObjective: 'Ride into Valentine and find work for the camp.',
    changes: [],
    deeper: { build: 'Nothing about how Arthur plays has changed since you were last here.' },
    oneLiner: 'Chapter 2, camped at Horseshoe Overlook. Valentine has work.',
  },
];

/**
 * What each recap must never say: past-the-marker names and events, by game.
 * Matched case-insensitively against everything the recap renders.
 */
export const SPOILER_DENYLIST: Record<string, string[]> = {
  cyberpunk: ['Mikoshi', 'Hanako', 'Songbird', 'Phantom Liberty', 'Dogtown', 'Solomon Reed', 'Adam Smasher', 'Alt Cunningham', 'Saburo', 'Yorinobu', 'Arasaka Tower', 'Jackie dies', 'Act 3'],
  eldenring: ['Godrick the Grafted', 'Radahn', 'Malenia', 'Morgott', 'Radagon', 'Marika', 'Miquella', 'Messmer', 'Erdtree burn'],
  reddead2: ['tuberculosis', 'Guarma', 'Micah', 'Beaver Hollow', 'Saint Denis', 'Epilogue'],
};

export const CATCH_UP_BY_ID: Record<string, CatchUpEntry> = Object.fromEntries(CATCH_UP.map((e) => [e.gameId, e]));

/** Whole days between the last session and the demo's "now". */
export function daysAway(e: CatchUpEntry, now: Date = CATCH_UP_NOW): number {
  return Math.floor((now.getTime() - new Date(e.lastPlayed).getTime()) / DAY);
}

/** The entry a sentence names ("catch me up on Cyberpunk"), or null. */
export function catchUpFor(text: string): CatchUpEntry | null {
  const t = text.toLowerCase();
  return CATCH_UP.find((e) => e.aliases.some((a) => t.includes(a))) ?? null;
}

/** Everything a recap renders, as one string — what the spoiler check reads. */
export function recapText(e: CatchUpEntry): string {
  return [e.marker, ...e.storySoFar, e.build.name, e.build.summary, e.location, e.nextObjective, ...e.changes.flatMap((c) => [c.title, c.impact]), e.deeper.build, e.oneLiner].join('\n');
}

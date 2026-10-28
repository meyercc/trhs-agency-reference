/**
 * "Who Made This" — the agent's fixture (docs/who-made-this-demo-plan.md): who
 * is in a game and who made it, and what else each of them has worked on.
 * Pure, no React, so the verify suite and Nova's scripts read the same rows.
 *
 * Written from memory of public credits. EVERY row needs a check against the
 * game's own credits by a person before press: the agent states these as
 * fact. Cross-links between the three games are few (one voice actor), which
 * is what the real credits give — do not invent more.
 *
 * No "now" here, unlike the other fixtures: credits do not age.
 */

/** How the card groups people. Cast first; the crew departments in this order. */
export type Department = 'cast' | 'direction' | 'writing' | 'art' | 'music';

export const DEPARTMENT_LABEL: Record<Department, string> = {
  cast: 'Voice cast',
  direction: 'Direction',
  writing: 'Writing',
  art: 'Art',
  music: 'Music',
};

/** One line of a person's filmography. */
export interface Credit {
  /** The catalog id (data/games.ts) when the game is in the library; absent for games we do not carry. */
  gameId?: string;
  title: string;
  year: number;
  dept: Department;
  /** The character for cast; the job for crew. */
  role: string;
}

export interface Person {
  id: string;
  name: string;
  /** Other spellings matched in a typed line, lower-case ("keanu"). The full name always matches. */
  aliases?: string[];
  /** Work outside games, as a film buff would know them: "The Matrix, John Wick". */
  knownFor?: string;
  credits: Credit[];
}

export interface GameCredits {
  /** A `GAMES` id (data/games.ts). */
  gameId: string;
  /** What the person calls it — matched in typed requests. */
  aliases: string[];
  year: number;
  /** Billing: who the cast card lists, in order. */
  cast: string[];
  /** The crew card's order. */
  crew: string[];
}

const G = {
  cyberpunk: 'Cyberpunk 2077',
  baldursgate3: "Baldur's Gate 3",
  eldenring: 'Elden Ring',
} as const;

export const PEOPLE: Person[] = [
  // ── Cyberpunk 2077 ──────────────────────────────────────────────────────
  {
    id: 'keanu-reeves',
    name: 'Keanu Reeves',
    aliases: ['keanu'],
    knownFor: 'The Matrix, John Wick',
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'cast', role: 'Johnny Silverhand' }],
  },
  {
    id: 'idris-elba',
    name: 'Idris Elba',
    knownFor: 'Luther, The Wire',
    credits: [{ gameId: 'cyberpunk', title: 'Cyberpunk 2077: Phantom Liberty', year: 2023, dept: 'cast', role: 'Solomon Reed' }],
  },
  {
    id: 'cherami-leigh',
    name: 'Cherami Leigh',
    credits: [
      { gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'cast', role: 'V' },
      { title: 'Persona 5', year: 2017, dept: 'cast', role: 'Makoto Niijima' },
      { title: 'Persona 5 Royal', year: 2020, dept: 'cast', role: 'Makoto Niijima' },
    ],
  },
  {
    id: 'gavin-drea',
    name: 'Gavin Drea',
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'cast', role: 'V' }],
  },
  {
    id: 'jason-hightower',
    name: 'Jason Hightower',
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'cast', role: 'Jackie Welles' }],
  },
  {
    id: 'emily-woo-zeller',
    name: 'Emily Woo Zeller',
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'cast', role: 'Panam Palmer' }],
  },
  {
    id: 'erica-lindbeck',
    name: 'Erica Lindbeck',
    credits: [
      { gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'cast', role: 'Judy Alvarez' },
      { title: 'Persona 5', year: 2017, dept: 'cast', role: 'Futaba Sakura' },
      { title: 'Mortal Kombat 11', year: 2019, dept: 'cast', role: 'Cassie Cage' },
      { title: 'Final Fantasy VII Remake', year: 2020, dept: 'cast', role: 'Jessie Rasberry' },
    ],
  },
  {
    id: 'adam-badowski',
    name: 'Adam Badowski',
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'direction', role: 'Game director' }],
  },
  {
    id: 'gabe-amatangelo',
    name: 'Gabe Amatangelo',
    credits: [{ gameId: 'cyberpunk', title: 'Cyberpunk 2077: Phantom Liberty', year: 2023, dept: 'direction', role: 'Game director' }],
  },
  {
    id: 'pawel-mielniczuk',
    name: 'Paweł Mielniczuk',
    aliases: ['pawel mielniczuk'],
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'art', role: 'Art director' }],
  },
  {
    id: 'marcin-przybylowicz',
    name: 'Marcin Przybyłowicz',
    aliases: ['marcin przybylowicz', 'przybylowicz'],
    credits: [
      { gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'music', role: 'Composer' },
      { title: 'The Witcher 3: Wild Hunt', year: 2015, dept: 'music', role: 'Composer' },
    ],
  },
  {
    id: 'pt-adamczyk',
    name: 'P.T. Adamczyk',
    aliases: ['adamczyk'],
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'music', role: 'Composer' }],
  },
  {
    id: 'paul-leonard-morgan',
    name: 'Paul Leonard-Morgan',
    knownFor: 'Dredd, Limitless',
    credits: [
      { gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'music', role: 'Composer' },
      { title: 'Battlefield Hardline', year: 2015, dept: 'music', role: 'Composer' },
    ],
  },
  {
    id: 'mike-pondsmith',
    name: 'Mike Pondsmith',
    knownFor: 'Cyberpunk 2020, the tabletop game',
    credits: [{ gameId: 'cyberpunk', title: G.cyberpunk, year: 2020, dept: 'writing', role: 'Creator of the Cyberpunk world' }],
  },

  // ── Baldur's Gate 3 ─────────────────────────────────────────────────────
  {
    id: 'neil-newbon',
    name: 'Neil Newbon',
    credits: [
      { gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: 'Astarion' },
      { title: 'Resident Evil Village', year: 2021, dept: 'cast', role: 'Karl Heisenberg' },
      { title: 'Resident Evil 3', year: 2020, dept: 'cast', role: 'Nicholai Ginovaef' },
      { title: 'Detroit: Become Human', year: 2018, dept: 'cast', role: 'Elijah Kamski' },
    ],
  },
  {
    // The one voice in two games the library carries — the demo's library link.
    id: 'jennifer-english',
    name: 'Jennifer English',
    credits: [
      { gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: 'Shadowheart' },
      { gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'cast', role: 'Millicent' },
    ],
  },
  {
    id: 'devora-wilde',
    name: 'Devora Wilde',
    credits: [{ gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: "Lae'zel" }],
  },
  {
    id: 'samantha-beart',
    name: 'Samantha Béart',
    aliases: ['samantha beart'],
    credits: [{ gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: 'Karlach' }],
  },
  {
    id: 'tim-downie',
    name: 'Tim Downie',
    knownFor: 'Outlander',
    credits: [{ gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: 'Gale' }],
  },
  {
    id: 'theo-solomon',
    name: 'Theo Solomon',
    credits: [{ gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: 'Wyll' }],
  },
  {
    id: 'amelia-tyler',
    name: 'Amelia Tyler',
    credits: [{ gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'cast', role: 'The Narrator' }],
  },
  {
    id: 'swen-vincke',
    name: 'Swen Vincke',
    credits: [
      { gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'direction', role: 'Game director' },
      { title: 'Divinity: Original Sin II', year: 2017, dept: 'direction', role: 'Game director' },
      { title: 'Divinity: Original Sin', year: 2014, dept: 'direction', role: 'Game director' },
    ],
  },
  {
    id: 'adam-smith',
    name: 'Adam Smith',
    credits: [{ gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'writing', role: 'Lead writer' }],
  },
  {
    id: 'borislav-slavov',
    name: 'Borislav Slavov',
    credits: [
      { gameId: 'baldursgate3', title: G.baldursgate3, year: 2023, dept: 'music', role: 'Composer' },
      { title: 'Divinity: Original Sin II', year: 2017, dept: 'music', role: 'Composer' },
      { title: 'Crysis 2', year: 2011, dept: 'music', role: 'Composer' },
    ],
  },

  // ── Elden Ring ──────────────────────────────────────────────────────────
  {
    id: 'pippa-bennett-warner',
    name: 'Pippa Bennett-Warner',
    credits: [{ gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'cast', role: 'Melina' }],
  },
  {
    id: 'aimee-ffion-edwards',
    name: 'Aimee-Ffion Edwards',
    credits: [{ gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'cast', role: 'Ranni the Witch' }],
  },
  {
    id: 'hidetaka-miyazaki',
    name: 'Hidetaka Miyazaki',
    aliases: ['miyazaki'],
    credits: [
      { gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'direction', role: 'Game director' },
      { title: 'Sekiro: Shadows Die Twice', year: 2019, dept: 'direction', role: 'Game director' },
      { title: 'Bloodborne', year: 2015, dept: 'direction', role: 'Game director' },
      { title: 'Dark Souls', year: 2011, dept: 'direction', role: 'Game director' },
    ],
  },
  {
    id: 'yui-tanimura',
    name: 'Yui Tanimura',
    credits: [
      { gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'direction', role: 'Co-director' },
      { title: 'Dark Souls II', year: 2014, dept: 'direction', role: 'Game director' },
    ],
  },
  {
    id: 'george-rr-martin',
    name: 'George R. R. Martin',
    aliases: ['george r.r. martin', 'george rr martin', 'grrm'],
    knownFor: 'A Song of Ice and Fire, Game of Thrones',
    credits: [{ gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'writing', role: 'Worldbuilding' }],
  },
  {
    id: 'yuka-kitamura',
    name: 'Yuka Kitamura',
    credits: [
      { gameId: 'eldenring', title: G.eldenring, year: 2022, dept: 'music', role: 'Composer' },
      { title: 'Sekiro: Shadows Die Twice', year: 2019, dept: 'music', role: 'Composer' },
      { title: 'Dark Souls III', year: 2016, dept: 'music', role: 'Composer' },
      { title: 'Bloodborne', year: 2015, dept: 'music', role: 'Composer' },
    ],
  },
];

export const PERSON_BY_ID: Record<string, Person> = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

export const GAME_CREDITS: GameCredits[] = [
  {
    gameId: 'cyberpunk',
    aliases: ['cyberpunk', '2077', 'phantom liberty', 'night city'],
    year: 2020,
    cast: ['keanu-reeves', 'idris-elba', 'cherami-leigh', 'gavin-drea', 'jason-hightower', 'emily-woo-zeller', 'erica-lindbeck'],
    crew: ['adam-badowski', 'gabe-amatangelo', 'mike-pondsmith', 'pawel-mielniczuk', 'marcin-przybylowicz', 'pt-adamczyk', 'paul-leonard-morgan'],
  },
  {
    gameId: 'baldursgate3',
    aliases: ["baldur's gate", 'baldurs gate', 'baldur’s gate', 'bg3', 'bg 3'],
    year: 2023,
    cast: ['neil-newbon', 'jennifer-english', 'devora-wilde', 'samantha-beart', 'tim-downie', 'theo-solomon', 'amelia-tyler'],
    crew: ['swen-vincke', 'adam-smith', 'borislav-slavov'],
  },
  {
    gameId: 'eldenring',
    aliases: ['elden ring', 'elden'],
    year: 2022,
    cast: ['pippa-bennett-warner', 'aimee-ffion-edwards', 'jennifer-english'],
    crew: ['hidetaka-miyazaki', 'yui-tanimura', 'george-rr-martin', 'yuka-kitamura'],
  },
];

export const CREDITS_BY_ID: Record<string, GameCredits> = Object.fromEntries(GAME_CREDITS.map((c) => [c.gameId, c]));

/** The demo's game — what a follow-up means before any game was named. */
export const HERO_CREDITS = CREDITS_BY_ID['cyberpunk'];

/** A person's credit in one game (the first, if several — a composer credited twice). */
export function creditIn(p: Person, gameId: string): Credit | undefined {
  return p.credits.find((c) => c.gameId === gameId);
}

/** The cast card's rows: each billed person with their character. */
export function castOf(gameId: string): { person: Person; role: string }[] {
  const c = CREDITS_BY_ID[gameId];
  if (!c) return [];
  return c.cast.flatMap((id) => {
    const p = PERSON_BY_ID[id];
    const cr = p && creditIn(p, gameId);
    return p && cr ? [{ person: p, role: cr.role }] : [];
  });
}

/** The crew card's rows, grouped by department in `DEPARTMENT_LABEL` order. */
export function crewOf(gameId: string): { dept: Department; rows: { person: Person; role: string }[] }[] {
  const c = CREDITS_BY_ID[gameId];
  if (!c) return [];
  const rows = c.crew.flatMap((id) => {
    const p = PERSON_BY_ID[id];
    const cr = p && creditIn(p, gameId);
    return p && cr ? [{ person: p, role: cr.role, dept: cr.dept }] : [];
  });
  return (Object.keys(DEPARTMENT_LABEL) as Department[])
    .filter((d) => d !== 'cast')
    .map((dept) => ({ dept, rows: rows.filter((r) => r.dept === dept) }))
    .filter((g) => g.rows.length);
}

/**
 * A person's OTHER credits in games the library carries — the "Also in Elden
 * Ring" on a cast row. The library is the catalog (data/games.ts), so a credit
 * with a `gameId` is one you own.
 */
export function alsoOwned(p: Person, gameId: string): Credit[] {
  return p.credits.filter((c) => c.gameId && c.gameId !== gameId);
}

/** A person's credits, this game first, then newest first. */
export function filmography(p: Person, gameId?: string): Credit[] {
  return [...p.credits].sort((a, b) => (a.gameId === gameId ? -1 : b.gameId === gameId ? 1 : b.year - a.year));
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'");

/** The game a typed line names, by its aliases, or null. */
export function creditsFor(text: string): GameCredits | null {
  const t = norm(text);
  return GAME_CREDITS.find((c) => c.aliases.some((a) => t.includes(norm(a)))) ?? null;
}

/** The person a typed line names — full name or an alias — or null. Longest match wins. */
export function personFor(text: string): Person | null {
  const t = norm(text);
  let best: { p: Person; len: number } | null = null;
  for (const p of PEOPLE) {
    for (const a of [p.name, ...(p.aliases ?? [])]) {
      const n = norm(a);
      if (t.includes(n) && (!best || n.length > best.len)) best = { p, len: n.length };
    }
  }
  return best?.p ?? null;
}

/**
 * The character a typed line names ("who voices Johnny Silverhand?") and who
 * plays them. A character shared by two people (V) returns the first billed.
 */
export function characterFor(text: string): { person: Person; credit: Credit } | null {
  const t = norm(text);
  let best: { person: Person; credit: Credit; len: number } | null = null;
  for (const g of GAME_CREDITS) {
    for (const id of g.cast) {
      const p = PERSON_BY_ID[id];
      const cr = p && creditIn(p, g.gameId);
      if (!cr) continue;
      const n = norm(cr.role);
      // Two-letter characters (V) would match inside any word.
      if (n.length < 3) continue;
      if (new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t) && (!best || n.length > best.len)) best = { person: p, credit: cr, len: n.length };
    }
  }
  return best ? { person: best.person, credit: best.credit } : null;
}

/** "KR" — the initials the avatar shows for a person with no photo. */
export function initialsOf(name: string): string {
  const parts = name.replace(/\./g, ' ').split(/[\s-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

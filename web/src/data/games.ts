// Game catalog for the Play library + Shop. Art resolves from Assets/games
// via a glob (same pattern as the widget gameArt helper).
const ART = import.meta.glob('../../../Assets/games/*.{webp,jpeg,jpg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function art(file: string): string {
  const key = Object.keys(ART).find((k) => k.endsWith('/' + file));
  return key ? ART[key] : '';
}

export interface Game {
  id: string;
  title: string;
  studio: string;
  genre: string;
  /** First release, ISO date — the game detail panel's Info (TH-504). Public dates; check before press. */
  released: string;
  art: string;
  installed?: boolean;
  /** Store price; omit for not-for-sale. `0` = Free. */
  price?: number;
  /** Original price when discounted. */
  was?: number;
  /** Play modes — a game can be both (the Mode filter facet). */
  modes?: string[];
  /** Publisher (the Publisher filter facet; distinct from `studio`/developer). */
  publisher?: string;
  /** Marked a favorite (the built-in "Favorites" library view). */
  favorite?: boolean;
  /** Tuned by OMEN AI (the built-in "OMEN AI" library view). */
  omenAi?: boolean;
}

// Built-in library views key off these id sets (kept beside the catalog).
export const FAVORITE_IDS = new Set(['cyberpunk', 'eldenring', 'baldursgate3', 'monsterhunterwilds', 'rocketleague']);
const OMEN_AI_IDS = new Set(['counterstrike2', 'valorant', 'apexlegends', 'marvelrivals', 'diabloiv']);

export const GAMES: Game[] = [
  { id: 'cyberpunk', title: 'Cyberpunk 2077', studio: 'CD Projekt Red', genre: 'RPG', released: '2020-12-10', art: art('cyberpunk.webp'), installed: true, price: 29.99, was: 59.99, modes: ['Singleplayer'], publisher: 'CD Projekt' },
  { id: 'eldenring', title: 'Elden Ring', studio: 'FromSoftware', genre: 'Action RPG', released: '2022-02-25', art: art('eldenring.webp'), installed: true, price: 10.49, was: 59.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Bandai Namco' },
  { id: 'counterstrike2', title: 'Counter-Strike 2', studio: 'Valve', genre: 'FPS', released: '2023-09-27', art: art('counterstrike2.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'Valve' },
  { id: 'valorant', title: 'Valorant', studio: 'Riot Games', genre: 'FPS', released: '2020-06-02', art: art('valorant.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'Riot Games' },
  { id: 'baldursgate3', title: "Baldur's Gate 3", studio: 'Larian Studios', genre: 'RPG', released: '2023-08-03', art: art('baldursgate3.webp'), installed: true, price: 59.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Larian Studios' },
  { id: 'blackmythwukong', title: 'Black Myth: Wukong', studio: 'Game Science', genre: 'Action', released: '2024-08-20', art: art('blackmythwukong.webp'), installed: true, price: 39.99, was: 59.99, modes: ['Singleplayer'], publisher: 'Game Science' },
  { id: 'monsterhunterwilds', title: 'Monster Hunter Wilds', studio: 'Capcom', genre: 'Action', released: '2025-02-28', art: art('monsterhunterwilds.webp'), installed: true, price: 69.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Capcom' },
  { id: 'diabloiv', title: 'Diablo IV', studio: 'Blizzard', genre: 'ARPG', released: '2023-06-06', art: art('diabloiv.webp'), price: 27.99, was: 69.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Blizzard' },
  { id: 'apexlegends', title: 'Apex Legends', studio: 'Respawn', genre: 'Battle Royale', released: '2019-02-04', art: art('apexlegends.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'EA' },
  { id: 'marvelrivals', title: 'Marvel Rivals', studio: 'NetEase', genre: 'Hero Shooter', released: '2024-12-06', art: art('marvelrivals.webp'), price: 0, modes: ['Multiplayer'], publisher: 'NetEase' },
  { id: 'devilmaycry5', title: 'Devil May Cry 5', studio: 'Capcom', genre: 'Action', released: '2019-03-08', art: art('devilmaycry5.webp'), price: 14.99, was: 29.99, modes: ['Singleplayer'], publisher: 'Capcom' },
  { id: 'civ7', title: 'Civilization VII', studio: 'Firaxis', genre: 'Strategy', released: '2025-02-11', art: art('civ7.webp'), price: 69.99, modes: ['Singleplayer', 'Multiplayer'], publisher: '2K' },
  { id: 'deathstranding2', title: 'Death Stranding 2', studio: 'Kojima Productions', genre: 'Action', released: '2025-06-26', art: art('deathstranding2.webp'), price: 69.99, modes: ['Singleplayer'], publisher: 'Sony' },
  { id: 'kingdomcome2', title: 'Kingdom Come II', studio: 'Warhorse', genre: 'RPG', released: '2025-02-04', art: art('kingdomcome2.webp'), installed: true, price: 49.99, modes: ['Singleplayer'], publisher: 'Deep Silver' },
  { id: 'starwarskotr2', title: 'Star Wars: KOTOR II', studio: 'Obsidian', genre: 'RPG', released: '2004-12-06', art: art('starwarskotr2.webp'), price: 4.99, was: 19.99, modes: ['Singleplayer'], publisher: 'Aspyr' },
  { id: 'rocketleague', title: 'Rocket League', studio: 'Psyonix', genre: 'Sports', released: '2015-07-07', art: art('rocketleague.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'Epic Games' },
  // The art file is spelled `redead2` on disk. No `was`: not discounted, so it stays out of deals.
  { id: 'reddead2', title: 'Red Dead Redemption 2', studio: 'Rockstar Games', genre: 'Action', released: '2018-10-26', art: art('redead2.webp'), installed: true, price: 59.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Rockstar Games' },
];

// Tag the built-in-view membership from the id sets above.
GAMES.forEach((g) => {
  g.favorite = FAVORITE_IDS.has(g.id);
  g.omenAi = OMEN_AI_IDS.has(g.id);
});

export const INSTALLED = GAMES.filter((g) => g.installed);

/**
 * Recently played, most recent first — the Play page's "Jump Back In" reads
 * this, and anything else that claims recency should too.
 *
 * This catalog carries no last-played timestamps, so recency cannot be derived;
 * the library's "Recently Played" sort falls back to catalog order. Declaring
 * the order here keeps it in ONE place instead of a second hand-written list
 * inside a component, and keeps it from simply mirroring the top of the library
 * grid, which would show the same four covers twice on one screen.
 */
const RECENT_IDS = ['baldursgate3', 'monsterhunterwilds', 'apexlegends', 'rocketleague', 'blackmythwukong', 'kingdomcome2'];
export const RECENT: Game[] = RECENT_IDS.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is Game => !!g);
export const FEATURED = GAMES.find((g) => g.id === 'cyberpunk')!;

/**
 * The recent games' last session and playtime — the Featured Play layout's
 * lead tile says them (TH-506). Days, never dates, as the other fixtures do.
 * A game the refund agent tracks (data/refunds.ts) takes its LIVE playtime
 * from state/Playtime instead, so the tile and the refund card never disagree;
 * `playedMin` here is for the rest.
 */
export const RECENT_ACTIVITY: Record<string, { daysAgo: number; playedMin?: number }> = {
  baldursgate3: { daysAgo: 0 },
  monsterhunterwilds: { daysAgo: 1 },
  apexlegends: { daysAgo: 3, playedMin: 212 * 60 },
  rocketleague: { daysAgo: 6, playedMin: 340 * 60 },
  blackmythwukong: { daysAgo: 12, playedMin: 38 * 60 },
  kingdomcome2: { daysAgo: 19, playedMin: 61 * 60 },
};

/** "Today" / "Yesterday" / "6 days ago" — how a last session is said. */
export const daysAgoLabel = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`);

/** A discounted game's saving, as the Shop badge writes it: "−65%". */
export function discountLabel(g: Game): string {
  if (!g.was || g.price == null) return '';
  return `\u2212${Math.round((1 - g.price / g.was) * 100)}%`;
}

/**
 * The store's deals, deepest saving first — what the Deals widget and a card's
 * deals block both show, so "today's deals" is one list however it is asked for
 * (TH-450). Derived from the catalog's `was`/`price` rather than kept as a
 * second hand-written list, which is how the widget came to show "−65%" on a
 * game the Shop page priced at −82%.
 */
export function dealsOf(count: number): Game[] {
  const saving = (g: Game) => 1 - g.price! / g.was!;
  return GAMES.filter((g) => g.was != null && g.price != null && g.price < g.was)
    .sort((a, b) => saving(b) - saving(a))
    .slice(0, count);
}

export function priceLabel(price?: number): string {
  if (price == null) return '';
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

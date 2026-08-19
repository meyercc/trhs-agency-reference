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
const FAVORITE_IDS = new Set(['cyberpunk', 'eldenring', 'baldursgate3', 'monsterhunterwilds', 'rocketleague']);
const OMEN_AI_IDS = new Set(['counterstrike2', 'valorant', 'apexlegends', 'marvelrivals', 'diabloiv']);

export const GAMES: Game[] = [
  { id: 'cyberpunk', title: 'Cyberpunk 2077', studio: 'CD Projekt Red', genre: 'RPG', art: art('cyberpunk.webp'), installed: true, price: 29.99, was: 59.99, modes: ['Singleplayer'], publisher: 'CD Projekt' },
  { id: 'eldenring', title: 'Elden Ring', studio: 'FromSoftware', genre: 'Action RPG', art: art('eldenring.webp'), installed: true, price: 10.49, was: 59.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Bandai Namco' },
  { id: 'counterstrike2', title: 'Counter-Strike 2', studio: 'Valve', genre: 'FPS', art: art('counterstrike2.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'Valve' },
  { id: 'valorant', title: 'Valorant', studio: 'Riot Games', genre: 'FPS', art: art('valorant.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'Riot Games' },
  { id: 'baldursgate3', title: "Baldur's Gate 3", studio: 'Larian Studios', genre: 'RPG', art: art('baldursgate3.webp'), installed: true, price: 59.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Larian Studios' },
  { id: 'blackmythwukong', title: 'Black Myth: Wukong', studio: 'Game Science', genre: 'Action', art: art('blackmythwukong.webp'), installed: true, price: 39.99, was: 59.99, modes: ['Singleplayer'], publisher: 'Game Science' },
  { id: 'monsterhunterwilds', title: 'Monster Hunter Wilds', studio: 'Capcom', genre: 'Action', art: art('monsterhunterwilds.webp'), installed: true, price: 69.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Capcom' },
  { id: 'diabloiv', title: 'Diablo IV', studio: 'Blizzard', genre: 'ARPG', art: art('diabloiv.webp'), price: 27.99, was: 69.99, modes: ['Singleplayer', 'Multiplayer'], publisher: 'Blizzard' },
  { id: 'apexlegends', title: 'Apex Legends', studio: 'Respawn', genre: 'Battle Royale', art: art('apexlegends.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'EA' },
  { id: 'marvelrivals', title: 'Marvel Rivals', studio: 'NetEase', genre: 'Hero Shooter', art: art('marvelrivals.webp'), price: 0, modes: ['Multiplayer'], publisher: 'NetEase' },
  { id: 'devilmaycry5', title: 'Devil May Cry 5', studio: 'Capcom', genre: 'Action', art: art('devilmaycry5.webp'), price: 14.99, was: 29.99, modes: ['Singleplayer'], publisher: 'Capcom' },
  { id: 'civ7', title: 'Civilization VII', studio: 'Firaxis', genre: 'Strategy', art: art('civ7.webp'), price: 69.99, modes: ['Singleplayer', 'Multiplayer'], publisher: '2K' },
  { id: 'deathstranding2', title: 'Death Stranding 2', studio: 'Kojima Productions', genre: 'Action', art: art('deathstranding2.webp'), price: 69.99, modes: ['Singleplayer'], publisher: 'Sony' },
  { id: 'kingdomcome2', title: 'Kingdom Come II', studio: 'Warhorse', genre: 'RPG', art: art('kingdomcome2.webp'), installed: true, price: 49.99, modes: ['Singleplayer'], publisher: 'Deep Silver' },
  { id: 'starwarskotr2', title: 'Star Wars: KOTOR II', studio: 'Obsidian', genre: 'RPG', art: art('starwarskotr2.webp'), price: 4.99, was: 19.99, modes: ['Singleplayer'], publisher: 'Aspyr' },
  { id: 'rocketleague', title: 'Rocket League', studio: 'Psyonix', genre: 'Sports', art: art('rocketleague.webp'), installed: true, price: 0, modes: ['Multiplayer'], publisher: 'Epic Games' },
];

// Tag the built-in-view membership from the id sets above.
GAMES.forEach((g) => {
  g.favorite = FAVORITE_IDS.has(g.id);
  g.omenAi = OMEN_AI_IDS.has(g.id);
});

export const INSTALLED = GAMES.filter((g) => g.installed);
export const FEATURED = GAMES.find((g) => g.id === 'cyberpunk')!;

export function priceLabel(price?: number): string {
  if (price == null) return '';
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

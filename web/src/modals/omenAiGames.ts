// OMEN AI per-game data — ported from vanilla `js/omen-ai.js` (AI_STATE + _AI_GAMES).
// In-memory only (matches the vanilla prototype): seeded here, mutated in component state.

export type AiStatus = 'latest' | 'updated' | 'reverted' | 'never';
/**
 * `auto` is the guided (learner-persona) goal — OMEN AI picks the
 * performance/quality balance per game, mirroring PowerThermal's Auto mode.
 * It is only offered to the learner persona; everyone else picks explicitly.
 */
export type AiMode = 'auto' | 'performance' | 'quality';

export interface AiGame {
  id: string;
  title: string;
  platform: string;
  genre: string;
  /** filename under Assets/games (resolved via gameArt). */
  art: string;
  enabled: boolean;
  mode: AiMode;
  status: AiStatus;
  /** version + freshness string, e.g. `v3.2 · 1 day ago` or `No profile yet`. */
  version: string;
  /** selected Target-FPS chip (only shown in quality mode); null = none. */
  fps: number | null;
}

/** Target-FPS chip options (quality mode). */
export const FPS_OPTIONS = [30, 60, 90, 120, 144, 165, 240, 280, 360] as const;

/** Initial per-game roster — matches vanilla AI_STATE + the modal markup. */
export const INITIAL_GAMES: AiGame[] = [
  { id: 'apex', title: 'Apex Legends', platform: 'Steam', genre: 'FPS', art: 'apexlegends.webp', enabled: true, mode: 'performance', status: 'latest', version: 'v3.2 · 1 day ago', fps: null },
  { id: 'cs2', title: 'Counter-Strike 2', platform: 'Steam', genre: 'FPS', art: 'counterstrike2.webp', enabled: true, mode: 'performance', status: 'latest', version: 'v5.1 · 12h ago', fps: 240 },
  { id: 'dota2', title: 'Dota 2', platform: 'Steam', genre: 'MOBA', art: 'dota2.webp', enabled: true, mode: 'quality', status: 'latest', version: 'v2.8 · 2 days ago', fps: null },
  { id: 'fortnite', title: 'Fortnite', platform: 'Epic', genre: 'Battle Royale', art: 'fortnite.webp', enabled: true, mode: 'performance', status: 'latest', version: 'v4.0 · 5 days ago', fps: 144 },
  { id: 'lol', title: 'League of Legends', platform: 'Riot', genre: 'MOBA', art: 'leagueoflegends.webp', enabled: false, mode: 'performance', status: 'updated', version: 'v1.9 · Paused Feb 28', fps: null },
  { id: 'marvel', title: 'Marvel Rivals', platform: 'Steam', genre: 'FPS', art: 'marvelrivals.webp', enabled: true, mode: 'performance', status: 'latest', version: 'v2.4 · 6h ago', fps: null },
  { id: 'minecraft', title: 'Minecraft', platform: 'Microsoft', genre: 'Sandbox', art: 'minecraft.webp', enabled: false, mode: 'performance', status: 'never', version: 'No profile yet', fps: null },
  { id: 'ow2', title: 'Overwatch 2', platform: 'Battle.net', genre: 'FPS', art: 'overwatch2.webp', enabled: false, mode: 'performance', status: 'reverted', version: 'Reverted · Jan 20', fps: null },
  { id: 'roblox', title: 'Roblox', platform: 'Roblox', genre: 'Sandbox', art: 'roblox.webp', enabled: false, mode: 'performance', status: 'never', version: 'No profile yet', fps: null },
  { id: 'valorant', title: 'Valorant', platform: 'Riot', genre: 'FPS', art: 'valorant.webp', enabled: true, mode: 'performance', status: 'latest', version: 'v3.7 · 8h ago', fps: 240 },
];

export interface SupportedGame {
  title: string;
  art: string;
  platform: string;
  link: string;
  installed: boolean;
}

/** Full "Supported Games" grid — every OMEN AI title, sorted A–Z. */
export const SUPPORTED_GAMES: SupportedGame[] = [
  { title: 'Apex Legends', art: 'apexlegends.webp', platform: 'Steam', link: 'https://store.steampowered.com/app/1172470/', installed: true },
  { title: 'Counter-Strike 2', art: 'counterstrike2.webp', platform: 'Steam', link: 'https://store.steampowered.com/app/730/', installed: true },
  { title: 'Dota 2', art: 'dota2.webp', platform: 'Steam', link: 'https://store.steampowered.com/app/570/', installed: true },
  { title: 'Fortnite', art: 'fortnite.webp', platform: 'Epic', link: 'https://store.epicgames.com/fortnite', installed: true },
  { title: 'League of Legends', art: 'leagueoflegends.webp', platform: 'Riot', link: 'https://www.leagueoflegends.com/', installed: false },
  { title: 'Marvel Rivals', art: 'marvelrivals.webp', platform: 'Steam', link: 'https://store.steampowered.com/app/2767030/', installed: true },
  { title: 'Minecraft', art: 'minecraft.webp', platform: 'Microsoft', link: 'https://www.minecraft.net/', installed: false },
  { title: 'Overwatch 2', art: 'overwatch2.webp', platform: 'Battle.net', link: 'https://overwatch.blizzard.com/', installed: true },
  { title: 'Roblox', art: 'roblox.webp', platform: 'Roblox', link: 'https://www.roblox.com/', installed: false },
  { title: 'Valorant', art: 'valorant.webp', platform: 'Riot', link: 'https://playvalorant.com/', installed: true },
];

/** Short month label for paused/reverted stamps (e.g. `Feb`). */
export function shortMonthDay(d: Date): string {
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

/** Badge text + status tone for a game's current state (mirrors vanilla `_applyBadge`). */
export function badgeFor(g: AiGame): { text: string; tone: 'positive' | 'neutral' | 'warn' } {
  switch (g.status) {
    case 'latest':
      return { text: 'Latest', tone: 'positive' };
    case 'reverted':
      return { text: 'Reverted', tone: 'warn' };
    case 'never':
      return { text: 'Never Applied', tone: 'neutral' };
    case 'updated': {
      const parts = g.version.split('Paused ');
      return { text: parts.length > 1 ? parts[1].trim() : 'Paused', tone: 'neutral' };
    }
  }
}

// ── Persona seeding ─────────────────────────────────────────────────────────
// The persona sets the *starting posture*, not what's possible: a learner
// arrives with OMEN AI already doing its job on every game, a tinkerer arrives
// with explicit goals to tune. Re-picking the persona (Settings → Experience
// Style) reseeds this list — the modal's state is in-memory anyway.

/** Games a learner sees: everything on, goal handed to OMEN AI. */
function guided(g: AiGame): AiGame {
  if (g.status === 'reverted') return { ...g, mode: 'auto' }; // don't undo a deliberate revert
  return {
    ...g,
    enabled: true,
    mode: 'auto',
    status: 'latest',
    version: g.status === 'never' ? 'v1.0 · Just applied' : g.version.replace(/·.*$/, '· Managed by OMEN AI'),
  };
}

/** The per-persona starting roster for the OMEN AI modal. */
export function initialGamesFor(persona: string): AiGame[] {
  const base = INITIAL_GAMES.map((g) => ({ ...g }));
  return persona === 'learner' ? base.map(guided) : base;
}

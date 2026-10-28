/**
 * Per-game actions (TH-504): what a module, an agent or a recipe lets you do
 * with ONE game — the rows in the game detail panel's Actions section. A
 * recipe contributes through `gameActions` in its UI recipe
 * (agents/recipes.tsx); a module through `modules/gameActions.tsx`. The panel
 * never names an agent or a module itself: a row exists while its owner's gate
 * holds (added from Forge, installed from the Module Browser) and the action
 * applies to the game, and it goes with the owner — the same rule as every
 * other entry point (Chris, 2026-10-26).
 *
 * Not a React file and no app imports beyond the types: `useGameActions`
 * reads the manifest at render time (`recipes()` — gotcha 51), never at load.
 */
import { useSearchParams } from 'react-router-dom';
import type { IconName } from '../components';
import type { Game } from '../data/games';
import { useAgents } from '../state/Agents';
import { useGameOptimize, type GameOptimizeValue } from '../state/gameOptimize';
import { useModules } from '../state/Modules';
import { useNovaAsk } from '../state/novaAsk';
import { useProfilesOptional } from '../state/Profiles';
import type { Profile } from '../state/profileModel';
import { useSettings } from '../state/Settings';
import { MODULE_GAME_ACTIONS } from '../modules/gameActions';
import { recipes } from './recipes';

export interface GameAction {
  /** Unique within the panel: `<owner>:<what>`. */
  id: string;
  label: string;
  /** One line under the label — what pressing it does, or the state in words. */
  description?: string;
  icon: IconName;
  /** A `toggle` row is a switch (`checked`); a `button` row runs `onPress`. */
  kind: 'button' | 'toggle';
  checked?: boolean;
  onPress: () => void;
}

/** What an action may read and do — handed to each contributor. */
export interface GameActionCtx {
  game: Game;
  /** Ask Nova a line (null outside a NovaProvider — Storybook). */
  ask: ((text: string) => void) | null;
  /** Pin Nova beside the page first, so the reply is seen. */
  pinNova: () => void;
  /** Open a feature modal by id (`?modal=<id>`), with any extra params. */
  openModal: (id: string, extra?: Record<string, string>) => void;
  optimize: GameOptimizeValue;
  /** The profile whose Game Link names this game, if one does (TH-505). */
  linkedProfile: Profile | undefined;
}

/**
 * Every action for a game, agents' rows first (in manifest order), then the
 * modules'. Gates applied here, once: a recipe's rows need the agent added
 * and Nova reachable; a module's rows need the module installed.
 */
export function useGameActions(game: Game | undefined): GameAction[] {
  const { has: added } = useAgents();
  const { has: installed } = useModules();
  const ask = useNovaAsk();
  const { setNovaPinned } = useSettings();
  const optimize = useGameOptimize();
  const [params, setParams] = useSearchParams();
  const profiles = useProfilesOptional();
  if (!game) return [];
  const ctx: GameActionCtx = {
    game,
    ask,
    pinNova: () => setNovaPinned(true),
    openModal: (id, extra) => {
      const p = new URLSearchParams(params);
      p.set('modal', id);
      for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
      setParams(p);
    },
    optimize,
    linkedProfile: profiles?.profiles.find((pr) => pr.gameLink.enabled && pr.gameLink.gameIds.includes(game.id)),
  };
  const fromAgents = recipes().flatMap((r) => (r.gameActions && added(r.id) && ask ? r.gameActions(ctx) : []));
  const fromModules = MODULE_GAME_ACTIONS.flatMap((m) => (!m.module || installed(m.module) ? m.actions(ctx) : []));
  return [...fromAgents, ...fromModules];
}

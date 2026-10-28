/**
 * The modules' per-game actions (TH-504; the contract is agents/gameActions.ts).
 * Each entry is gated on its module being installed; the rows read and write
 * the per-game optimize store, so the tile menu's checkboxes and the panel's
 * switch are one state.
 */
import type { GameAction, GameActionCtx } from '../agents/gameActions';

export interface ModuleGameActions {
  /** A `modules/registry.ts` id — the row shows while it is installed. Absent: the app's own (always). */
  module?: string;
  actions: (ctx: GameActionCtx) => GameAction[];
}

export const MODULE_GAME_ACTIONS: ModuleGameActions[] = [
  {
    // The profile the Game Link rule applies when this game launches (TH-505)
    // — the app's own, so no module gates it. Opens the Profiles editor on
    // that profile, or on the active one to link it.
    actions: ({ linkedProfile, openModal }) => [
      {
        id: 'profile:linked',
        label: 'Profile',
        description: linkedProfile ? `${linkedProfile.name} applies when you play` : 'None linked — link one to this game',
        icon: 'profile',
        kind: 'button',
        onPress: () => openModal('profiles', linkedProfile ? { profile: linkedProfile.id } : {}),
      },
    ],
  },
  {
    module: 'omenai',
    actions: ({ game, optimize }) => {
      const state = optimize.of(game);
      return [
        {
          id: 'omenai:tune',
          label: 'OMEN AI',
          description: state.omenAi ? 'Tuning this game' : 'Not tuning this game',
          icon: 'ai',
          kind: 'toggle',
          checked: state.omenAi,
          onPress: () => optimize.set(game.id, 'omenAi', !state.omenAi, state),
        },
      ];
    },
  },
  {
    module: 'booster',
    actions: ({ openModal }) => [
      {
        id: 'booster:open',
        label: 'Booster',
        description: 'Free up the PC before you play',
        icon: 'performance',
        kind: 'button',
        onPress: () => openModal('booster'),
      },
    ],
  },
];

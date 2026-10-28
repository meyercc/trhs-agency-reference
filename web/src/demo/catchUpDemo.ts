/**
 * The Catch Me Up press demo's reset (TH-478, docs/catch-me-up-demo-plan.md §F).
 *
 * Puts the app where the stage run starts: Home on Work, Last Played in view
 * reading "94 days ago", Nova installed and unpinned with an empty log and the
 * model off, and a "Night City" profile linked to Cyberpunk that lights the
 * Origins 65 Banana yellow. Run from `#/?demo=catch-up` (AppShell) and from
 * Nova's settings popover.
 *
 * Provider APIs only, and safe to run twice: Night City is replaced by id, not
 * appended, and every card a previous rehearsal's finale built is removed.
 *
 * Night City exists ONLY through this reset — the shipped profiles do not
 * change. It writes the keyboard's panel lighting and leaves `deskLighting`
 * unset: when the profile activates, Personalize's sync adopts the panel's
 * lighting for the desk (state.tsx, "mends a profile saved before…"), so the
 * room and the keyboard are one lighting without this file knowing the desk.
 */
import { useCallback } from 'react';
import { CATCH_UP_AGENT, CATCH_UP_TITLE } from '../nova/catchUp';
import { CATCH_UP_BLOCKS } from '../nova/catchUpBindings';
import { isRehearsal } from '../agents/recipeKit';
import { useAgents } from '../state/Agents';
import { PAINT } from '../pages/personalize/state';
import { DESK_SKU } from '../pages/personalize/model';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { useProfiles } from '../state/Profiles';
import { newProfile, type Profile } from '../state/profileModel';
import { useSettings } from '../state/Settings';
import { DEFAULT_LAYOUT, META_BY_ID } from '../widgets/catalog';

export const NIGHT_CITY_ID = 'night-city';
const DEMO_PRESET = 'Banana';
// The one widget the story starts from. The rest of the board is the person's
// own and survives the reset (Chris, 2026-10-20: «retain the dashboard layout
// and widgets … I'll be resetting these frequently»).
const ENTRY_WIDGET = 'lastplayed';

/** A card a rehearsal built: the finale's list or a placed recap — any of the recipe's blocks (2026-10-20). */
const isCatchUpCard = (c: Parameters<typeof isRehearsal>[0]) => isRehearsal(c, CATCH_UP_TITLE, CATCH_UP_BLOCKS);

export function useCatchUpDemoReset(): () => void {
  const nova = useNova();
  const profiles = useProfiles();
  const { install } = useModules();
  const agents = useAgents();
  const { lightPresets, cards, removeCard, boardLayout, setBoardLayout, overlays, removeOverlay, setNovaPinned, setCardMenuHintSeen } = useSettings();

  return useCallback(() => {
    // Nova: installed, empty, scripted only; the agent added from Forge, which
    // is its switch (Chris, 2026-10-26) — a rehearsal may have removed it.
    install('nova');
    nova.resetDemo();
    nova.setSetting('llmEnabled', false);
    setNovaPinned(false);
    agents.add(CATCH_UP_AGENT);
    // The ⋮ coach mark sits on the first card — Last Played, here — and on stage it reads as a bug.
    setCardMenuHintSeen(true);

    // Night City, lit Banana on the Origins 65, linked to Cyberpunk.
    const preset = lightPresets.find((p) => p.name === DEMO_PRESET);
    const paint = PAINT.keyboard!;
    const keyboard = DESK_SKU.keyboard;
    const nightCity: Profile = {
      ...newProfile(NIGHT_CITY_ID, 'Night City', 'wp:red'),
      gameLink: { enabled: true, gameIds: ['cyberpunk'] },
      devices: {
        [keyboard]: {
          'lighting.power': true,
          'lighting.brightness': 100,
          ...(preset ? { 'lighting.preset': preset.id } : {}),
          // What the panel SHOWS is the painted record, not the preset — without
          // it the photo board stays dark (HANDOFF, TH-478 "found while mapping").
          ...(preset ? { [paint.key]: Object.fromEntries(paint.ids.map((id) => [id, `rgb(${preset.glow})`])) } : {}),
        },
      },
    };
    // One commit: Night City replaced in place (or appended), Work active by
    // hand, no game reigning — so Resume's `revertTo` is Work.
    const s = profiles.store;
    const has = s.profiles.some((p) => p.id === NIGHT_CITY_ID);
    profiles.apply({
      ...s,
      profiles: has ? s.profiles.map((p) => (p.id === NIGHT_CITY_ID ? nightCity : p)) : [...s.profiles, nightCity],
      activeId: s.profiles.some((p) => p.id === 'work') ? 'work' : s.activeId,
      source: 'manual',
      revertTo: null,
    });

    // The board is the person's own and STAYS: only what a rehearsal built is
    // taken away (its card, off the board and out of the store), and Last
    // Played — where the story starts — is put at the top only if it is missing.
    // It used to be replaced wholesale with a two-widget demo board, because the
    // finale's card appended four rows down, off the stage; "Add to dashboard"
    // now scrolls to the card it added instead (AppShell, 2026-10-20).
    const stale = cards.filter(isCatchUpCard).map((c) => c.id);
    if (stale.length) removeCard(stale);
    const board = (boardLayout ?? DEFAULT_LAYOUT).filter((i) => !stale.includes(i.id));
    const entry = META_BY_ID[ENTRY_WIDGET];
    const withEntry = board.some((i) => i.id === ENTRY_WIDGET) ? board : [{ id: ENTRY_WIDGET, span: entry.span, rows: entry.rows }, ...board];
    if (stale.length || withEntry !== board) setBoardLayout(withEntry);
    // …and any recap a rehearsal placed over the game.
    overlays.filter(isCatchUpCard).forEach((o) => removeOverlay(o.id));
  }, [install, nova, profiles, agents, lightPresets, cards, removeCard, boardLayout, setBoardLayout, overlays, removeOverlay, setNovaPinned, setCardMenuHintSeen]);
}

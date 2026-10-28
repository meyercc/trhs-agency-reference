/**
 * The "Who Made This" demo's reset (docs/who-made-this-demo-plan.md).
 *
 * Puts the app where the stage run starts: Nova installed and unpinned with
 * an empty log and the model off, the agent added (so Forge shows it as
 * yours), and no rehearsal cards or overlays — the person's own board left
 * exactly as it was. Nothing else to wind back: credits do not age and the
 * agent keeps no clock. Run from `#/?demo=who-made-this` (AppShell) and from
 * Nova's settings popover.
 *
 * Provider APIs only, and safe to run twice.
 */
import { useCallback } from 'react';
import { CREDITS_TITLE, WHO_MADE_THIS_AGENT } from '../nova/whoMadeThis';
import { WHO_MADE_THIS_BLOCKS } from '../nova/whoMadeThisBindings';
import { isRehearsal } from '../agents/recipeKit';
import { useAgents } from '../state/Agents';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { useSettings } from '../state/Settings';
import { DEFAULT_LAYOUT } from '../widgets/catalog';

/** What a rehearsal built: anything holding the recipe's block. */
const isCreditsCard = (c: Parameters<typeof isRehearsal>[0]) => isRehearsal(c, CREDITS_TITLE, WHO_MADE_THIS_BLOCKS);

export function useWhoMadeThisDemoReset(): () => void {
  const nova = useNova();
  const { install } = useModules();
  const agents = useAgents();
  const { cards, removeCard, boardLayout, setBoardLayout, overlays, removeOverlay, setNovaPinned, setCardMenuHintSeen } = useSettings();

  return useCallback(() => {
    install('nova');
    nova.resetDemo();
    nova.setSetting('llmEnabled', false);
    setNovaPinned(false);
    setCardMenuHintSeen(true);
    agents.add(WHO_MADE_THIS_AGENT);
    const stale = cards.filter(isCreditsCard).map((c) => c.id);
    if (stale.length) {
      removeCard(stale);
      setBoardLayout((boardLayout ?? DEFAULT_LAYOUT).filter((i) => !stale.includes(i.id)));
    }
    overlays.filter(isCreditsCard).forEach((o) => removeOverlay(o.id));
  }, [install, nova, agents, cards, removeCard, boardLayout, setBoardLayout, overlays, removeOverlay, setNovaPinned, setCardMenuHintSeen]);
}

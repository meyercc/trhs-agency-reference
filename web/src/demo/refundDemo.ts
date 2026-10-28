/**
 * The "Did I Just Waste My Money" demo's reset (TH-484,
 * docs/refund-window-demo-plan.md §G).
 *
 * Puts the app where the stage run starts: Nova installed and unpinned with an
 * empty log and the model off, the agent added (so Forge shows it as yours),
 * the playtime clock back at the fixture's minutes with nothing playing and
 * the warning re-armed, no toasts, and no rehearsal cards or overlays — the
 * person's own board left exactly as it was.
 * Run from `#/?demo=refund` (AppShell) and from Nova's settings popover.
 *
 * Provider APIs only, and safe to run twice.
 */
import { useCallback } from 'react';
import { REFUND_AGENT, REFUND_TITLE } from '../nova/refunds';
import { REFUND_BLOCKS } from '../nova/refundBindings';
import { isRehearsal } from '../agents/recipeKit';
import { useAgents } from '../state/Agents';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { usePlaytime } from '../state/Playtime';
import { useSettings } from '../state/Settings';
import { useToasts } from '../state/Toasts';
import { DEFAULT_LAYOUT } from '../widgets/catalog';


/** What a rehearsal built: the finale's list or anything holding one of the recipe's blocks (TH-487). */
const isRefundCard = (c: Parameters<typeof isRehearsal>[0]) => isRehearsal(c, REFUND_TITLE, REFUND_BLOCKS);

export function useRefundDemoReset(): () => void {
  const nova = useNova();
  const playtime = usePlaytime();
  const toasts = useToasts();
  const { install } = useModules();
  const agents = useAgents();
  const { cards, removeCard, boardLayout, setBoardLayout, overlays, removeOverlay, setNovaPinned, setCardMenuHintSeen } = useSettings();

  return useCallback(() => {
    install('nova');
    nova.resetDemo();
    nova.setSetting('llmEnabled', false);
    setNovaPinned(false);
    setCardMenuHintSeen(true);
    agents.add(REFUND_AGENT);
    playtime.reset();
    toasts.clear();
    // The board is the person's own and STAYS (Chris, 2026-10-20): only what a
    // rehearsal built goes — its cards off the board and out of the store, and
    // any refund-window overlay it placed over the game.
    const stale = cards.filter(isRefundCard).map((c) => c.id);
    if (stale.length) {
      removeCard(stale);
      setBoardLayout((boardLayout ?? DEFAULT_LAYOUT).filter((i) => !stale.includes(i.id)));
    }
    overlays.filter(isRefundCard).forEach((o) => removeOverlay(o.id));
  }, [install, nova, playtime, toasts, agents, cards, removeCard, boardLayout, setBoardLayout, overlays, removeOverlay, setNovaPinned, setCardMenuHintSeen]);
}

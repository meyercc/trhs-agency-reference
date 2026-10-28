import { useEffect } from 'react';
import { PURCHASE_BY_ID, WARN_AT_MIN, windowFor } from '../data/refunds';
import { REFUND_AGENT, warningScript, warningToast } from '../nova/refunds';
import { useAgents } from '../state/Agents';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { usePlaytime } from '../state/Playtime';
import { useSettings } from '../state/Settings';
import { useToasts } from '../state/Toasts';

/**
 * Did I Just Waste My Money's watch (TH-484): while a purchase is being
 * played, the moment its refund window has `WARN_AT_MIN` minutes of playtime
 * left, the agent speaks first — once per game per session — and a toast says
 * so, because a player mid-game is not looking at Nova.
 *
 * The toast's Open pins Nova on the agent's message; Keep playing only puts
 * the toast away (the message stays, with its answers). Renders nothing.
 *
 * It watches only when Nova is installed — the agent lives there — AND the
 * agent is added from Forge: removed there, it stands down (Chris, 2026-10-26;
 * it is added on a first run). Mounted by AppShell from its UI recipe's
 * `watchers`.
 */
export function RefundWatch() {
  const playtime = usePlaytime();
  const nova = useNova();
  const { has: installed } = useModules();
  const { has: added } = useAgents();
  const { setNovaPinned } = useSettings();
  const { notify, dismiss } = useToasts();

  const id = playtime.playing;
  const played = id ? playtime.playedMin(id) : 0;

  useEffect(() => {
    if (!id || !installed('nova') || !added(REFUND_AGENT)) return;
    const p = PURCHASE_BY_ID[id];
    if (!p || playtime.warned(id)) return;
    const w = windowFor(p, played);
    if (!w.open || w.minutesLeft == null || w.minutesLeft > WARN_AT_MIN) return;
    playtime.markWarned(id);
    const convId = nova.speak(warningScript(id, played), warningToast(id, played).title);
    const toastId = `refund-warning-${id}`;
    const copy = warningToast(id, played);
    notify({
      id: toastId,
      tone: 'warn',
      icon: 'hourglass',
      title: copy.title,
      message: copy.message,
      actions: [
        {
          label: 'Open',
          variant: 'accent',
          onPress: () => {
            nova.select(convId);
            setNovaPinned(true);
            dismiss(toastId);
          },
        },
        { label: 'Keep playing', variant: 'ghost', onPress: () => dismiss(toastId) },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, played]);

  return null;
}

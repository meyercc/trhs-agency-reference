/**
 * Autocast's UI recipe (docs/autocast-demo-plan.md) — layer 3 of its recipe
 * (agents/recipes.tsx): the five cards its replies draw, the watcher that
 * runs the session and speaks each stage, the demo reset, the game panel's
 * row and the panel's status word. Its scripts are `nova/autocast.ts`; its
 * session store `state/Autocast.tsx`. No board blocks: a clip is a thing you
 * review, not a reading to keep in view.
 */
import { useEffect, useState } from 'react';
import type { AgentRecipe } from '../agents/recipes';
import { fmtClock } from '../data/autocast';
import { GAMES } from '../data/games';
import { useAutocastDemoReset } from '../demo/autocastDemo';
import { AutocastWatch } from '../app/AutocastWatch';
import { sessionSecondsOf, useAutocastOptional } from '../state/Autocast';
import { useNova } from '../state/Nova';
import { AUTOCAST_AGENT, askClips } from './autocast';
import { AddedCard, ClipsCard, CuttingCard, LiveCard, PlanCard } from './AutocastCards';
import { SPEED } from './scripts';

/** The Nova panel's word on where the session is — live while recording. */
function useAutocastStatus(): { text: string; tone: 'info' | 'danger' | 'warn' | 'positive' } | null {
  const a = useAutocastOptional();
  const { settings } = useNova();
  const phase = a?.session.phase ?? 'idle';
  const [, setN] = useState(0);
  useEffect(() => {
    if (phase !== 'recording') return;
    const t = window.setInterval(() => setN((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [phase]);
  if (!a) return null;
  const s = a.session;
  switch (s.phase) {
    case 'armed':
      return { text: 'Autocast · armed', tone: 'info' };
    case 'recording':
      return { text: `Autocast · ${fmtClock(sessionSecondsOf(s, SPEED[settings.demoSpeed]))}`, tone: 'danger' };
    case 'cutting':
      return { text: 'Autocast · cutting', tone: 'warn' };
    case 'ready': {
      const kept = s.clips.filter((c) => c.status !== 'discarded').length;
      const approved = s.clips.filter((c) => c.status === 'approved').length;
      return { text: approved ? `Autocast · ${approved}/${kept} approved` : `Autocast · ${kept} clips ready`, tone: 'positive' };
    }
    default:
      return null;
  }
}

export const autocastRecipe: AgentRecipe = {
  id: AUTOCAST_AGENT,
  cards: { plan: PlanCard, added: AddedCard, live: LiveCard, cutting: CuttingCard, clips: ClipsCard },
  blocks: {},
  demo: {
    id: 'autocast',
    label: 'Reset Autocast demo',
    note: 'Autocast removed from Forge, Nova unpinned with the model off, nothing playing, no saved clips.',
    landing: '/',
    useReset: useAutocastDemoReset,
  },
  watchers: [AutocastWatch],
  useStatus: useAutocastStatus,
  // The game panel's row (TH-504): the plan's defaults for this game, armed
  // on the reply — for any game in the catalog, since Autocast records any.
  gameActions: ({ game, ask, pinNova }) => {
    if (!ask || !GAMES.some((g) => g.id === game.id)) return [];
    return [
      {
        id: 'autocast:clip',
        label: 'Clip my next session',
        description: 'Autocast records it and cuts the highlights',
        icon: 'video-capture',
        kind: 'button',
        onPress: () => {
          pinNova();
          ask(askClips(game.id));
        },
      },
    ];
  },
};

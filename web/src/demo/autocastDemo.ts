/**
 * The Autocast demo's reset (docs/autocast-demo-plan.md).
 *
 * Puts the app where the stage run starts: Nova installed and unpinned with
 * an empty log and the model off, Autocast REMOVED from Forge (the story
 * begins with Nova unable to clip and offering the skill), no session, nothing
 * playing, and the clips a rehearsal saved taken back out of the Gallery. Run
 * from `#/?demo=autocast` (AppShell) and from Nova's settings popover.
 *
 * Provider APIs only, and safe to run twice.
 */
import { useCallback } from 'react';
import { AUTOCAST_AGENT } from '../nova/autocast';
import { useAgents } from '../state/Agents';
import { useAutocast } from '../state/Autocast';
import { useGallery } from '../state/Gallery';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { usePlaytime } from '../state/Playtime';
import { useSettings } from '../state/Settings';

export const isAutocastClip = (c: { id: string }) => c.id.startsWith('autocast-');

export function useAutocastDemoReset(): () => void {
  const nova = useNova();
  const { install } = useModules();
  const agents = useAgents();
  const autocast = useAutocast();
  const gallery = useGallery();
  const playtime = usePlaytime();
  const { setNovaPinned, setCardMenuHintSeen } = useSettings();

  return useCallback(() => {
    install('nova');
    nova.resetDemo();
    nova.setSetting('llmEnabled', false);
    setNovaPinned(false);
    setCardMenuHintSeen(true);
    agents.remove(AUTOCAST_AGENT);
    autocast.reset();
    playtime.reset();
    gallery.removeWhere(isAutocastClip);
  }, [install, nova, agents, autocast, gallery, playtime, setNovaPinned, setCardMenuHintSeen]);
}

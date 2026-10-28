import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backdrop } from '../components';
import { OmenAiModal } from './OmenAiModal';
import { BoosterModal } from './BoosterModal';
import { VitalsModal, type VitalsTab } from './VitalsModal';
import { SettingsModal } from './SettingsModal';
import { ProfilesModal } from './ProfilesModal';
import { AdminModal } from './AdminModal';
import { AboutPcModal } from './AboutPcModal';
import { LightingModal } from '../pages/personalize/LightingModal';
import { ModuleBrowserModal, type Section } from '../modules/ModuleBrowserModal';
import { ForgeModal, type ForgeSection } from '../forge/ForgeModal';
import { AutocastPlayer } from '../nova/AutocastPlayer';
import { useModules } from '../state/Modules';
import { MODAL_MODULE } from '../modules/registry';

/**
 * Renders "feature" modals (non-device) driven by `?modal=<id>`, so they overlay
 * whatever route you're on and are deep-linkable — the React equivalent of the
 * vanilla `deepLink(page, key)` / `openModal(key)` flow. Mounted once in AppShell.
 */
export function FeatureModalHost() {
  const [params, setParams] = useSearchParams();
  const { has } = useModules();
  const modal = params.get('modal');

  const close = () => {
    const p = new URLSearchParams(params);
    p.delete('modal');
    p.delete('tab');
    p.delete('cat');
    p.delete('module');
    p.delete('agent');
    p.delete('listing');
    p.delete('device');
    p.delete('i');
    setParams(p, { replace: true });
  };

  // A modal gated behind a removed module can't be opened (e.g. a stale deep
  // link, or the module was uninstalled while open) — close it.
  const gate = modal ? MODAL_MODULE[modal] : undefined;
  const blocked = !!gate && !has(gate);

  useEffect(() => {
    if (!modal) return;
    if (blocked) {
      close();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, blocked]);

  if (!modal || blocked) return null;

  const content =
    modal === 'omenai' ? (
      <OmenAiModal onClose={close} />
    ) : modal === 'booster' ? (
      <BoosterModal onClose={close} />
    ) : modal === 'vitals' ? (
      <VitalsModal onClose={close} initialTab={(params.get('tab') as VitalsTab) || 'overview'} />
    ) : modal === 'settings' ? (
      <SettingsModal onClose={close} initialSection={params.get('tab') || undefined} />
    ) : modal === 'profile' ? (
      // Alias: Profile is the Account group of Settings now.
      <SettingsModal onClose={close} initialSection={params.get('tab') === 'accounts' ? 'accounts' : 'profile'} />
    ) : modal === 'profiles' ? (
      // Chris's Profiles editor — the profile itself (identity, overrides, Game Link, Schedule).
      <ProfilesModal onClose={close} initialProfileId={params.get('profile') || undefined} />
    ) : modal === 'lighting' ? (
      <LightingModal onClose={close} device={params.get('device') || undefined} />
    ) : modal === 'admin' ? (
      <AdminModal onClose={close} />
    ) : modal === 'about-pc' ? (
      <AboutPcModal onClose={close} />
    ) : modal === 'modules' ? (
      <ModuleBrowserModal
        onClose={close}
        initialSection={(params.get('cat') as Section) || 'whatsnew'}
        initialModuleId={params.get('module') || undefined}
      />
    ) : modal === 'autocast-clip' ? (
      // One of Autocast's clips, played (TH-509): `?i=` is which.
      <AutocastPlayer onClose={close} index={Number(params.get('i') ?? 0) || 0} />
    ) : modal === 'agents' ? (
      // Forge, in the slot (and on the URL) the Agent Catalog held. `?agent=`
      // still deep-links a listing — every agent is one — and `?listing=`
      // reaches the rest.
      <ForgeModal
        onClose={close}
        initialSection={(params.get('cat') as ForgeSection) || 'discover'}
        initialListingId={params.get('listing') || params.get('agent') || undefined}
      />
    ) : null;
  if (!content) return null;

  return (
    <>
      <Backdrop onClick={close} />
      {content}
    </>
  );
}

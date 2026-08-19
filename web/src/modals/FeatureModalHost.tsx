import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Backdrop } from '../components';
import { OmenAiModal } from './OmenAiModal';
import { BoosterModal } from './BoosterModal';
import { VitalsModal, type VitalsTab } from './VitalsModal';
import { SettingsModal } from './SettingsModal';
import { AdminModal } from './AdminModal';
import { ModuleBrowserModal, type Section } from '../modules/ModuleBrowserModal';
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
      <SettingsModal onClose={close} />
    ) : modal === 'admin' ? (
      <AdminModal onClose={close} />
    ) : modal === 'modules' ? (
      <ModuleBrowserModal
        onClose={close}
        initialSection={(params.get('cat') as Section) || 'whatsnew'}
        initialModuleId={params.get('module') || undefined}
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

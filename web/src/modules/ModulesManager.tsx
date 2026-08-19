import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components';
import { useModules } from '../state/Modules';
import { MODULES, type ModuleDef } from './registry';
import { ModuleCard } from './ModuleCard';
import { RemoveConfirm } from './RemoveConfirm';
import './module-browser.css';

/**
 * In-page module management (Personalize → Modules), the vanilla `pers-modules`
 * parity view: the full module list with install/remove + a shortcut into the
 * full Module Browser. Shares ModuleCard + RemoveConfirm with the modal.
 */
export function ModulesManager() {
  const { installedCount, remove } = useModules();
  const [, setParams] = useSearchParams();
  const [pendingRemove, setPendingRemove] = useState<ModuleDef | null>(null);

  const openBrowser = (moduleId?: string) => {
    // Preserve any existing params (e.g. devices flyout) — just add the modal.
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'modules');
      if (moduleId) p.set('module', moduleId);
      else p.delete('module');
      return p;
    });
  };

  return (
    <div className="mm">
      <div className="mm-head">
        <span className="mm-count">
          {installedCount} of {MODULES.length} modules installed
        </span>
        <Button size="sm" onClick={() => openBrowser()}>
          Browse all modules
        </Button>
      </div>
      <div className="mb-card-grid">
        {MODULES.map((m) => (
          <ModuleCard
            key={m.id}
            mod={m}
            showCategory
            onRemoveRequest={setPendingRemove}
            onOpen={(mod) => openBrowser(mod.id)}
          />
        ))}
      </div>

      {pendingRemove && (
        <RemoveConfirm
          mod={pendingRemove}
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            remove(pendingRemove.id);
            setPendingRemove(null);
          }}
        />
      )}
    </div>
  );
}

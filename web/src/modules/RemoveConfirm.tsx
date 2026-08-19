import { useEffect } from 'react';
import { Button } from '../components';
import type { ModuleDef } from './registry';
import './module-browser.css';

/**
 * Remove-a-module confirmation. A fixed full-viewport alert (z-index above
 * modals) so it works both inside the Module Browser modal and on the Personalize
 * management section. Lists exactly what removing the module hides.
 */
export function RemoveConfirm({
  mod,
  onCancel,
  onConfirm,
}: {
  mod: ModuleDef;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="mb-confirm-backdrop" onClick={onCancel}>
      <div className="mb-confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-confirm-title">Remove {mod.name}?</h3>
        <p className="mb-confirm-desc">
          Removing this module hides all {mod.name.toLowerCase()}-related features from the app. You can reinstall it
          any time from the Module Browser.
        </p>
        <ul className="mb-confirm-effects">
          {mod.removeEffects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <div className="mb-confirm-actions">
          <Button size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <button type="button" className="mb-confirm-remove" onClick={onConfirm}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

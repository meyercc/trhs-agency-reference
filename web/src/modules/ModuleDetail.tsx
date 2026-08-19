import { Icon, Button, Badge } from '../components';
import { useModules } from '../state/Modules';
import { CATEGORIES, type ModuleDef } from './registry';
import { modulePreview } from './previews';
import './module-browser.css';

/**
 * Full detail page for one module inside the Module Browser: hero + description,
 * an "Includes" list (surfaces it adds), and a "Removing hides" list. Install is
 * immediate; Remove delegates to the host's confirmation flow.
 */
export function ModuleDetail({
  mod,
  onBack,
  onRemoveRequest,
}: {
  mod: ModuleDef;
  onBack: () => void;
  onRemoveRequest: (m: ModuleDef) => void;
}) {
  const { has, install } = useModules();
  const installed = has(mod.id);
  const catLabel = CATEGORIES.find((c) => c.id === mod.category)?.label;
  const preview = modulePreview(mod.id);

  return (
    <div className="mb-detail">
      <button type="button" className="mb-back" onClick={onBack}>
        <span aria-hidden>‹</span> Back
      </button>

      {preview && (
        <figure className="mb-detail-preview">
          <img src={preview} alt={`${mod.name} preview`} loading="lazy" />
        </figure>
      )}

      <div className="mb-detail-head">
        <div className="mb-detail-icon">
          <Icon name={mod.icon} size={30} aria-hidden />
        </div>
        <div className="mb-detail-titles">
          <div className="mb-detail-cat">
            {catLabel}
            {mod.comingSoon && ' · Coming soon'}
          </div>
          <h3 className="mb-detail-name">{mod.name}</h3>
        </div>
        <div className="mb-detail-action">
          {installed ? (
            <>
              <Badge variant="status" tone="positive">
                Installed
              </Badge>
              <button type="button" className="mb-remove-link" onClick={() => onRemoveRequest(mod)}>
                Remove
              </button>
            </>
          ) : (
            <Button size="sm" variant="accent" onClick={() => install(mod.id)}>
              <Icon name="add" size={12} aria-hidden /> Install
            </Button>
          )}
        </div>
      </div>

      <p className="mb-detail-desc">{mod.description}</p>

      <div className="mb-detail-cols">
        <div className="mb-detail-col">
          <h4 className="mb-group-title">Includes</h4>
          <ul className="mb-detail-list">
            {mod.features.map((f) => (
              <li key={f}>
                <Icon name="check" size={12} aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="mb-detail-col">
          <h4 className="mb-group-title">Removing hides</h4>
          <ul className="mb-detail-list mb-detail-list-muted">
            {mod.removeEffects.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

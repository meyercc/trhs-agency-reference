import { Icon, Button } from '../components';
import { useModules } from '../state/Modules';
import { CATEGORIES, type ModuleDef } from './registry';
import { modulePreview } from './previews';
import './module-browser.css';

/**
 * Presentational module card — icon, name, tagline, install state, and an
 * Install button / Remove link. Shared by the Module Browser modal and the
 * Personalize "Modules" management section. Remove is delegated so each host can
 * own its own confirmation flow.
 */
export function ModuleCard({
  mod,
  showCategory,
  onRemoveRequest,
  onOpen,
}: {
  mod: ModuleDef;
  showCategory?: boolean;
  onRemoveRequest: (m: ModuleDef) => void;
  /** Click the card body → open the module's detail page. */
  onOpen?: (m: ModuleDef) => void;
}) {
  const { has, install } = useModules();
  const installed = has(mod.id);
  const catLabel = CATEGORIES.find((c) => c.id === mod.category)?.label;
  const clickable = !!onOpen;
  const preview = modulePreview(mod.id);
  return (
    <div
      className={
        'mb-card' +
        (preview ? ' has-media' : '') +
        (installed ? ' is-installed' : '') +
        (clickable ? ' is-clickable' : '')
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${mod.name} details` : undefined}
      onClick={clickable ? () => onOpen!(mod) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen!(mod);
              }
            }
          : undefined
      }
    >
      {preview && (
        <div className="mb-card-media">
          <img src={preview} alt="" loading="lazy" />
        </div>
      )}
      <div className="mb-card-main">
        <div className="mb-card-icon">
          <Icon name={mod.icon} size={20} aria-hidden />
        </div>
        <div className="mb-card-body">
          <div className="mb-card-head">
            <span className="mb-card-name">{mod.name}</span>
            {installed && (
              <span className="mb-card-check" title="Installed">
                <Icon name="check" size={11} aria-hidden />
              </span>
            )}
            {showCategory && catLabel && <span className="mb-card-cat">{catLabel}</span>}
            {mod.comingSoon && <span className="mb-card-soon">Soon</span>}
          </div>
          <p className="mb-card-tagline">{mod.tagline}</p>
        </div>
        <div className="mb-card-action">
          {installed ? (
            <button
              type="button"
              className="mb-remove-link"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveRequest(mod);
              }}
            >
              Remove
            </button>
          ) : (
            <Button
              size="sm"
              variant="accent"
              onClick={(e) => {
                e.stopPropagation();
                install(mod.id);
              }}
            >
              <Icon name="add" size={12} aria-hidden /> Install
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { ModalShell, Icon, Input, Button, Badge } from '../components';
import { useModules } from '../state/Modules';
import { MODULES, MODULE_BY_ID, CATEGORIES, MODULES_BY_CATEGORY, type ModuleDef, type ModuleCategory } from './registry';
import { ModuleCard } from './ModuleCard';
import { ModuleDetail } from './ModuleDetail';
import { RemoveConfirm } from './RemoveConfirm';
import { modulePreview } from './previews';
import './module-browser.css';

export type Section = 'whatsnew' | ModuleCategory;

// ── What's New landing ──────────────────────────────────────────────────────
function WhatsNew({
  onRemoveRequest,
  onOpen,
}: {
  onRemoveRequest: (m: ModuleDef) => void;
  onOpen: (m: ModuleDef) => void;
}) {
  const { has, install } = useModules();
  const recommended = MODULES.filter((m) => m.recommended);
  const fresh = MODULES.filter((m) => m.isNew);
  const hero = recommended[0];
  const heroInstalled = hero && has(hero.id);
  const heroPreview = hero && modulePreview(hero.id);
  return (
    <div className="mb-section">
      {hero && (
        <div className={'mb-hero' + (heroPreview ? ' has-art' : '')}>
          {heroPreview && (
            <div className="mb-hero-art" style={{ backgroundImage: `url(${heroPreview})` }} aria-hidden />
          )}
          <div className="mb-hero-icon">
            <Icon name={hero.icon} size={30} aria-hidden />
          </div>
          <div className="mb-hero-body">
            <span className="mb-hero-eyebrow">Recommended</span>
            <h3 className="mb-hero-title">{hero.name}</h3>
            <p className="mb-hero-desc">{hero.description}</p>
            <div className="mb-hero-action">
              {heroInstalled ? (
                <>
                  <Badge variant="status" tone="positive">
                    Installed
                  </Badge>
                  <button type="button" className="mb-remove-link" onClick={() => onRemoveRequest(hero)}>
                    Remove
                  </button>
                </>
              ) : (
                <Button size="sm" variant="accent" onClick={() => install(hero.id)}>
                  <Icon name="add" size={12} aria-hidden /> Install
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {recommended.length > 1 && (
        <>
          <h4 className="mb-group-title">Recommended for you</h4>
          <div className="mb-card-grid">
            {recommended.slice(1).map((m) => (
              <ModuleCard key={m.id} mod={m} showCategory onRemoveRequest={onRemoveRequest} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}

      {fresh.length > 0 && (
        <>
          <h4 className="mb-group-title">New</h4>
          <div className="mb-card-grid">
            {fresh.map((m) => (
              <ModuleCard key={m.id} mod={m} showCategory onRemoveRequest={onRemoveRequest} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Module Browser / store (`?modal=modules`, optionally `&cat=<category>`). Left
 * nav (What's New + categories), right content with a catalog search that
 * intermingles results across all categories. Installing/removing a module flips
 * its state in ModulesProvider, which every gated surface reads via has(id).
 */
export function ModuleBrowserModal({
  onClose,
  initialSection = 'whatsnew',
  initialModuleId,
}: {
  onClose: () => void;
  initialSection?: Section;
  initialModuleId?: string;
}) {
  const { installedCount, remove } = useModules();
  const [section, setSection] = useState<Section>(initialSection);
  const [query, setQuery] = useState('');
  const [pendingRemove, setPendingRemove] = useState<ModuleDef | null>(null);
  // The module whose detail page is open (null = list view).
  const [selected, setSelected] = useState<ModuleDef | null>(
    initialModuleId ? MODULE_BY_ID[initialModuleId] ?? null : null,
  );
  // Honor a changed `?module=` deep-link even while the modal is already open
  // (it stays mounted across param changes, so the initializer alone isn't enough).
  useEffect(() => {
    if (initialModuleId) setSelected(MODULE_BY_ID[initialModuleId] ?? null);
  }, [initialModuleId]);

  const goSection = (s: Section) => {
    setSection(s);
    setQuery('');
    setSelected(null);
  };
  const onSearch = (v: string) => {
    setQuery(v);
    if (v.trim()) setSelected(null);
  };

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    return MODULES.filter((m) => `${m.name} ${m.tagline} ${m.description} ${m.category}`.toLowerCase().includes(q));
  }, [q, searching]);

  const nav = (
    <nav className="ds-modal-nav" aria-label="Module categories">
      <button
        type="button"
        className={'ds-modal-nav-item' + (!searching && !selected && section === 'whatsnew' ? ' active' : '')}
        onClick={() => goSection('whatsnew')}
      >
        <Icon name="sparks" size={15} aria-hidden />
        <span>What&apos;s New</span>
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          className={'ds-modal-nav-item' + (!searching && !selected && section === c.id ? ' active' : '')}
          onClick={() => goSection(c.id)}
        >
          <Icon name={c.icon} size={15} aria-hidden />
          <span>{c.label}</span>
        </button>
      ))}
      <div className="ds-modal-nav-foot">{installedCount} installed</div>
    </nav>
  );

  const catLabel = CATEGORIES.find((c) => c.id === section)?.label;

  return (
    <ModalShell title="Module Browser" className="modulebrowser" onClose={onClose} left={nav}>
      <div className="mb-search">
        <Input
          variant="search"
          placeholder="Search all modules…"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search modules"
        />
      </div>

      <div className="mb-content">
        {selected && !searching ? (
          <ModuleDetail mod={selected} onBack={() => setSelected(null)} onRemoveRequest={setPendingRemove} />
        ) : searching ? (
          <div className="mb-section">
            <h4 className="mb-group-title">
              {results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{query.trim()}&rdquo;
            </h4>
            {results.length ? (
              <div className="mb-card-grid">
                {results.map((m) => (
                  <ModuleCard key={m.id} mod={m} showCategory onRemoveRequest={setPendingRemove} onOpen={setSelected} />
                ))}
              </div>
            ) : (
              <p className="mb-empty">No modules match your search.</p>
            )}
          </div>
        ) : section === 'whatsnew' ? (
          <WhatsNew onRemoveRequest={setPendingRemove} onOpen={setSelected} />
        ) : (
          <div className="mb-section">
            <h4 className="mb-group-title">{catLabel}</h4>
            <div className="mb-card-grid">
              {MODULES_BY_CATEGORY(section as ModuleCategory).map((m) => (
                <ModuleCard key={m.id} mod={m} onRemoveRequest={setPendingRemove} onOpen={setSelected} />
              ))}
            </div>
          </div>
        )}
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
    </ModalShell>
  );
}

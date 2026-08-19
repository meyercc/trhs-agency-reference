import { useMemo, useState } from 'react';
import { Icon, Input, Ng3Label } from '../components';
import { KEYCAP_SETS, KEY_CATEGORIES, ASSIGN_TYPES } from './keysData';
import { KEY_BY_CODE, type KbLayer, type KeyBinds } from './keyboardLayout';

/**
 * Keys & Macros tab — the NGENUITY "KEYS" panel. Left: an assignment-type rail
 * (Keys/Buttons · Macro · Text · Launcher) + Game Mode + Reset Layer. Right: the
 * selected-key readout, a search box, and collapsible keycap categories.
 *
 * Binding flow (ported from vanilla, armed either order): pick a key on the hero
 * OR arm a palette keycap here — whichever second completes the bind, writing to
 * the active layer's slot. Fully interactive, in-memory.
 */

export interface KeysTabProps {
  selected: string | null;
  armed: string | null;
  layer: KbLayer;
  binds: Map<string, KeyBinds>;
  onArm: (label: string) => void;
  onClearBinding: () => void;
  onResetLayer: () => void;
}

export function KeysTab({ selected, armed, layer, binds, onArm, onClearBinding, onResetLayer }: KeysTabProps) {
  const [assignType, setAssignType] = useState('keys');
  const [gameMode, setGameMode] = useState(false);
  const [query, setQuery] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();

  // Search: matching caps per category; a query auto-expands categories with hits.
  const filtered = useMemo(
    () =>
      KEY_CATEGORIES.map((cat) => ({
        cat,
        caps: (KEYCAP_SETS[cat.id] ?? []).filter((k) => !q || k.toLowerCase().includes(q)),
      })),
    [q],
  );
  const totalHits = filtered.reduce((n, f) => n + f.caps.length, 0);
  const isOpen = (id: string) => (q ? true : openCats.has(id));

  const toggleCat = (id: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const target = buildTarget(selected, armed, layer, binds);

  return (
    <div className="pdm-keys">
      {/* Left — assignment rail */}
      <aside className="pdm-keys-rail">
        <div className="pdm-keys-rail-head">
          <Ng3Label strong>Assignments</Ng3Label>
          <Icon name="info" size={16} />
        </div>
        <div className="pdm-assign-list">
          {ASSIGN_TYPES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={'pdm-assign-item' + (assignType === a.id ? ' active' : '')}
              onClick={() => setAssignType(a.id)}
            >
              <Icon name={a.icon} size={16} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
        <div className="pdm-keys-rail-foot">
          <button
            type="button"
            className={'pdm-assign-item' + (gameMode ? ' active' : '')}
            aria-pressed={gameMode}
            onClick={() => setGameMode((g) => !g)}
          >
            <Icon name="star" size={16} />
            <span>Game Mode</span>
          </button>
          <div className="pdm-keys-divider" role="separator" />
          <button type="button" className="ds-btn" onClick={onResetLayer}>
            <Icon name="refresh" size={16} />
            Reset Layer
          </button>
        </div>
      </aside>

      {/* Right — key browser */}
      <section className="pdm-keys-browse">
        <div className={'pdm-keys-target'} data-state={target.state}>
          <span className="pdm-keys-target-key" aria-hidden={target.state === 'empty'}>
            {target.key ?? '—'}
          </span>
          <span className="pdm-keys-target-info">{target.info}</span>
          {target.showClear && (
            <button type="button" className="ds-btn pdm-keys-target-clear" onClick={onClearBinding}>
              Clear
            </button>
          )}
        </div>

        <Input
          variant="search"
          placeholder="Search keys or buttons"
          aria-label="Search keys or buttons"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="pdm-cat-list">
          {filtered.map(({ cat, caps }) => {
            if (q && caps.length === 0) return null;
            const open = isOpen(cat.id);
            return (
              <div className="pdm-cat-group" key={cat.id}>
                <button type="button" className={'pdm-cat' + (open ? ' expanded' : '')} aria-expanded={open} onClick={() => toggleCat(cat.id)}>
                  <Icon name={cat.icon} size={16} />
                  <span>{cat.label}</span>
                  <Icon name="chevron-right" size={12} className="pdm-cat-chevron" />
                </button>
                {open && (
                  <div className="pdm-cat-keys">
                    {caps.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={'pdm-keycap' + (armed === k ? ' active' : '')}
                        onClick={() => onArm(k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {q && totalHits === 0 && <div className="pdm-keys-empty">No keys match your search.</div>}
        </div>
      </section>
    </div>
  );
}

// The selected-key readout (state + label + info + whether Clear shows).
// Ported from vanilla `_periUpdateTarget`.
function buildTarget(selected: string | null, armed: string | null, layer: KbLayer, binds: Map<string, KeyBinds>) {
  if (!selected) {
    return {
      state: 'empty' as const,
      key: null as string | null,
      info: armed != null ? `“${armed}” armed — click a key on the keyboard.` : 'Select a key on the keyboard to assign it.',
      showClear: false,
    };
  }
  const spec = KEY_BY_CODE.get(selected);
  const tag = layer === 'fn' ? 'FN layer' : 'Base layer';
  const bound = layer === 'fn' ? binds.get(selected)?.fn : binds.get(selected)?.base;
  const factory = layer === 'fn' ? spec?.fn : null;
  if (bound != null) {
    return { state: 'mapped' as const, key: spec?.base ?? '—', info: `${tag} · remapped to ${bound}`, showClear: true };
  }
  if (factory != null) {
    return { state: 'selected' as const, key: spec?.base ?? '—', info: `${tag} · ${factory} (default) — pick one to override.`, showClear: false };
  }
  return { state: 'selected' as const, key: spec?.base ?? '—', info: `${tag} · no custom binding — pick one from the list.`, showClear: false };
}

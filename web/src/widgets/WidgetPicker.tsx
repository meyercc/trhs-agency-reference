import { useEffect } from 'react';
import { Button, Backdrop, Icon } from '../components';
import { CATALOG } from './catalog';
import { useModules } from '../state/Modules';
import { WIDGET_MODULE } from '../modules/registry';

const CATS = ['Performance', 'Personalize', 'Gaming', 'Devices'];

/**
 * Add-a-widget picker: lists the catalog grouped by category; widgets already
 * on the board are marked Added. Overlays the board with a backdrop + Esc close.
 */
export function WidgetPicker({ current, onAdd, onClose }: { current: Set<string>; onAdd: (id: string) => void; onClose: () => void }) {
  const { has } = useModules();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <Backdrop onClick={onClose} />
      <div className="wb-pick" role="dialog" aria-label="Add a widget">
        <div className="wb-pick-head">
          <span className="wb-pick-title">Add a widget</span>
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="wb-pick-body">
          {CATS.map((cat) => {
            // Hide widgets whose module is removed — they can't be added while
            // the module is uninstalled (install it from the Module Browser).
            const items = CATALOG.filter((m) => {
              const mod = WIDGET_MODULE[m.id];
              return m.cat === cat && (!mod || has(mod));
            });
            if (!items.length) return null;
            return (
              <div className="wb-pick-group" key={cat}>
                <div className="wg-sub wb-pick-cat">{cat}</div>
                {items.map((m) => {
                  const added = current.has(m.id);
                  return (
                    <div className="wb-pick-row" key={m.id}>
                      <span className="wb-pick-name">{m.name}</span>
                      {added ? (
                        <span className="wg-sub wb-pick-added">Added</span>
                      ) : (
                        <Button size="sm" variant="accent" onClick={() => onAdd(m.id)}>
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

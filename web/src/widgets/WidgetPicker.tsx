import { useEffect } from 'react';
import { Button, Backdrop, Icon } from '../components';
import { CATALOG, type WidgetMeta } from './catalog';
import { cardMeta, CARD_CAT } from './cardMeta';
import { useModules } from '../state/Modules';
import { useSettings } from '../state/Settings';
import { SCOPE_HIDDEN_WIDGETS } from './layout';
import { WIDGET_MODULE } from '../modules/registry';

const CATS = ['Performance', 'Personalize', 'Gaming', 'Devices'];

/**
 * Add-a-widget picker: lists the catalog grouped by category; widgets already
 * on the board are marked Added. Overlays the board with a backdrop + Esc close.
 *
 * The cards Nova composed get a group of their own at the end (TH-443) — this
 * is the one surface that makes a custom card survive its ✕, which is what
 * every other widget's ✕ already means. It is also the only place a card can be
 * FORGOTTEN, and only while it is off the board, so the ✕ and this are never
 * two ways to do the same thing.
 */
export function WidgetPicker({ current, onAdd, onClose }: { current: Set<string>; onAdd: (id: string) => void; onClose: () => void }) {
  const { has } = useModules();
  const { cards, removeCard, mvpScope } = useSettings();
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
          {[...CATS, CARD_CAT].map((cat) => {
            if (cat === CARD_CAT) {
              if (!cards.length) return null;
              return (
                <div className="wb-pick-group" key={cat}>
                  <div className="wg-sub wb-pick-cat">{cat}</div>
                  {cards.map(cardMeta).map((m: WidgetMeta) => (
                    <div className="wb-pick-row" key={m.id}>
                      <span className="wb-pick-name">{m.name}</span>
                      {current.has(m.id) ? (
                        <span className="wg-sub wb-pick-added">Added</span>
                      ) : (
                        <span className="wb-pick-actions">
                          <Button size="sm" variant="accent" onClick={() => onAdd(m.id)}>
                            Add
                          </Button>
                          <button className="modal-close wb-pick-forget" type="button" aria-label={`Forget ${m.name}`} title="Forget this card" onClick={() => removeCard(m.id)}>
                            <Icon name="close" />
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            }
            // Hide widgets whose module is removed — they can't be added while
            // the module is uninstalled (install it from the Module Browser).
            const items = CATALOG.filter((m) => {
              const mod = WIDGET_MODULE[m.id];
              return m.cat === cat && (!mod || has(mod)) && !SCOPE_HIDDEN_WIDGETS[mvpScope].has(m.id);
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

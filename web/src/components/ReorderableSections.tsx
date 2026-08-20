import { type ReactNode, useEffect, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import './reorderable-sections.css';

// ── Reorderable page sections ───────────────────────────────────────────────
// A vertical list of page sections the user can drag to reorder (grip handle in
// the gutter). Order optionally persists to localStorage. Used on Perform /
// Personalize / Play. (1-D list → Framer `Reorder`; the live shift IS the drop
// preview.) The React port of the vanilla `initPageSectionDrag` over
// `.perf-category` sections.

export interface ReorderableSectionData {
  id: string;
  /** Header row (e.g. <SectionHeader …/>). */
  header?: ReactNode;
  children: ReactNode;
}

export interface ReorderableSectionsProps {
  sections: ReorderableSectionData[];
  /** Persist the order under this localStorage key. */
  storageKey?: string;
}

// Keep saved ids that still exist; a new (or returning) id is INSERTED at the
// position it holds in the canonical `ids` order, not appended. Appending made
// a section that leaves and comes back (e.g. one that empties out under a
// simulator state and later refills) land at the bottom instead of its place.
function reconcile(saved: string[] | null, ids: string[]): string[] {
  const next = (saved ?? []).filter((id) => ids.includes(id));
  ids.forEach((id, canonical) => {
    if (next.includes(id)) return;
    // Insert before the first already-placed id that canonically follows it.
    const after = ids.slice(canonical + 1).find((later) => next.includes(later));
    const at = after ? next.indexOf(after) : next.length;
    next.splice(at, 0, id);
  });
  return next;
}
function loadOrder(key: string | undefined, ids: string[]): string[] {
  if (!key) return ids;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return reconcile(Array.isArray(saved) ? saved : null, ids);
  } catch {
    return ids;
  }
}

const Grip = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="4" r="1.3" />
    <circle cx="11" cy="4" r="1.3" />
    <circle cx="5" cy="8" r="1.3" />
    <circle cx="11" cy="8" r="1.3" />
    <circle cx="5" cy="12" r="1.3" />
    <circle cx="11" cy="12" r="1.3" />
  </svg>
);

function Section({ id, header, children, draggable }: ReorderableSectionData & { draggable: boolean }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="section"
      value={id}
      className="rs-section"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, zIndex: 5 }}
      transition={{ type: 'spring', stiffness: 480, damping: 42 }}
    >
      {/* No grip with a single section — nothing to reorder against. */}
      {draggable && (
        <button type="button" className="rs-grip" aria-label="Drag to reorder section" onPointerDown={(e) => controls.start(e)}>
          <Grip />
        </button>
      )}
      {header}
      {children}
    </Reorder.Item>
  );
}

export function ReorderableSections({ sections, storageKey }: ReorderableSectionsProps) {
  const ids = sections.map((s) => s.id);
  const key = ids.join('|');
  const [order, setOrder] = useState<string[]>(() => loadOrder(storageKey, ids));

  // Reconcile when the section set changes (added/removed sections).
  useEffect(() => {
    setOrder((prev) => {
      const next = reconcile(prev, ids);
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const onReorder = (next: string[]) => {
    setOrder(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  };

  const byId = new Map(sections.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as ReorderableSectionData[];

  return (
    <Reorder.Group as="div" axis="y" values={order} onReorder={onReorder} className="rs-group">
      {ordered.map((s) => (
        <Section key={s.id} id={s.id} header={s.header} draggable={ordered.length > 1}>
          {s.children}
        </Section>
      ))}
    </Reorder.Group>
  );
}

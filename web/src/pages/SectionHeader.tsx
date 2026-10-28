import { useSectionGrip } from '../components';

/** Section header row: label + divider + optional count/action. `id` makes it a `?section=` target. */
export function SectionHeader({ id, label, count, action }: { id?: string; label: string; count?: string | number; action?: React.ReactNode }) {
  const row = (
    <div className="pg-section" data-section={id}>
      <span className="ds-text-overline pg-section-label">{label}</span>
      <span className="pg-section-rule" />
      {count != null && <span className="pg-section-count">{count}</span>}
      {action}
    </div>
  );
  // Inside a reorderable section whose content draws its own header (the Play
  // library), this header carries the section's grip, level with its label.
  const grip = useSectionGrip();
  if (!grip) return row;
  return (
    <div className="rs-head">
      {row}
      {grip}
    </div>
  );
}

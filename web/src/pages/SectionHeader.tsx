/** Section header row: label + divider + optional count/action. */
export function SectionHeader({ label, count, action }: { label: string; count?: string | number; action?: React.ReactNode }) {
  return (
    <div className="pg-section">
      <span className="ds-text-overline pg-section-label">{label}</span>
      <span className="pg-section-rule" />
      {count != null && <span className="pg-section-count">{count}</span>}
      {action}
    </div>
  );
}

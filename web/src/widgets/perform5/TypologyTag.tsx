// ── Typology annotation tag + status legend (PerformV5 showcase only) ──
// The teaching overlay: names what each card/section demonstrates and colour-
// codes it RATIFIED (built directly) / DRAFT (G9–G14 proposal) / OPEN (a toggle
// someone else owns). Tags are hidden until the page's "Annotate" toggle is on
// (CSS: `.pv5-root.pv5-annotate .pv5-tag`).

export type TypoStatus = 'ratified' | 'draft' | 'open';

const STATUS_TEXT: Record<TypoStatus, string> = {
  ratified: 'RATIFIED',
  draft: 'DRAFT',
  open: 'OPEN',
};

export interface TypologyTagProps {
  type: string;
  interactivity?: 'read-only' | 'writes' | 'status';
  shows: string;
  status: TypoStatus;
  owner?: string;
}

export function TypologyTag({ type, interactivity, shows, status, owner }: TypologyTagProps) {
  return (
    <span className={`pv5-tag pv5-tag--${status}`}>
      <span className="pv5-tag-status">
        {STATUS_TEXT[status]}
        {owner ? ` · ${owner}` : ''}
      </span>
      <span className="pv5-tag-type">
        {type}
        {interactivity ? ` · ${interactivity}` : ''}
      </span>
      <span className="pv5-tag-shows">{shows}</span>
    </span>
  );
}

export function TypologyLegend() {
  return (
    <div className="pv5-legend" aria-label="Status legend">
      <span className="pv5-legend-item">
        <i className="pv5-dot pv5-dot--ratified" />
        Ratified — built directly
      </span>
      <span className="pv5-legend-item">
        <i className="pv5-dot pv5-dot--draft" />
        Draft proposal (G9–G14) — demonstrated, not signed off
      </span>
      <span className="pv5-legend-item">
        <i className="pv5-dot pv5-dot--open" />
        Open — shown as a toggle, owner decides
      </span>
    </div>
  );
}

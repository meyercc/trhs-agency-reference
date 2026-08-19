import { Button } from '../../components';
import { CardDoor, Facts, FeatStatus } from './CardKit';

// ── Cleaner card (PerformV5, Maintenance L2) ──
// V5-local (does not modify Chris's shared Maintenance widget). Same standardized
// anatomy as the other Performance feature cards: header = title + door
// ("Schedule", a config door, top-right); body leads with the big bold status
// "reading" (Ready / Good, from CardKit's vocabulary); "Clean" is the actionable
// step → footer. Cleaning shows a progress Dialogue (see CleanProgressDialog);
// Schedule opens the scheduler modal.
//   · System Cleaner = storage/junk (space).
//   · Fan Cleaner    = reverse-fan dust removal (thermal).

export interface CleanerCardProps {
  kind: 'system' | 'fan';
  onClean: () => void;
  onSchedule?: () => void;
}

export function CleanerCard({ kind, onClean, onSchedule }: CleanerCardProps) {
  const title = kind === 'system' ? 'System Cleaner' : 'Fan Cleaner';

  const header = (
    <div className="ds-feature-card-header">
      <div className="ds-feature-card-title">{title}</div>
      <CardDoor verb="schedule" onClick={onSchedule} />
    </div>
  );

  const statusEl = <FeatStatus word={kind === 'system' ? 'ready' : 'good'} />;

  const footer = (
    <div className="ds-feature-card-footer">
      <Button variant="accent" size="sm" onClick={onClean}>
        Clean
      </Button>
    </div>
  );

  if (kind === 'system') {
    return (
      <div className="ds-feature-card pv5-cleaner-card">
        {header}
        {statusEl}
        {/* No explanatory copy (V5 rule) — tooltip candidate: "Junk, temp files and disk optimization." */}
        <Facts
          items={[
            { label: 'Recoverable', value: '7.04 GB' },
            { label: 'Last cleaned', value: '3 days ago' },
          ]}
        />
        {footer}
      </div>
    );
  }

  return (
    <div className="ds-feature-card pv5-cleaner-card">
      {header}
      {statusEl}
      {/* No explanatory copy (V5 rule) — tooltip candidate: "Reverse-fan dust
          removal for steadier cooling." Health bar dropped: all sub status
          renders as Facts list rows (unified 2026-07-23). */}
      <Facts
        items={[
          { label: 'Fan health · est.', value: '82%' },
          { label: 'Last cleaned', value: '45 days ago' },
        ]}
      />
      {footer}
    </div>
  );
}

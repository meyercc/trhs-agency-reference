import { Button } from '../../components';
import { CardDoor, Facts, FeatStatus, Level, Metric } from './CardKit';

// ── Cleaner cards (PerformV6) ──
// V6 fork of perform5/CleanerCard: same anatomy (status word → readings →
// Clean action; Schedule door), but each cleaner's hero reading takes its
// natural form — System Cleaner = Metric (recoverable GB), Fan Cleaner = Level
// (health bar, neutral fill) — with Facts kept as the receipt baseline.
// (Identity icon tiles were tried and removed — 2026-07-23.)

/** The fan cleaner's standing as the card reads it — simulated, the prototype
 *  has no fan sensor (fan-cleaner#open:1). The PC page's Performance tab
 *  repeats these, so the two can never disagree. */
export const FAN_CLEANER = { word: 'good' as const, label: 'Good', lastCleaned: '45 days ago' };

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
        <FeatStatus word="ready" />
        <Metric value="7.04" unit="GB" label="Recoverable" />
        <Facts items={[{ label: 'Last cleaned', value: '3 days ago' }]} />
        {footer}
      </div>
    );
  }

  return (
    <div className="ds-feature-card pv5-cleaner-card">
      {header}
      <FeatStatus word={FAN_CLEANER.word} />
      <Level pct={82} label="fan health · est." />
      <Facts items={[{ label: 'Last cleaned', value: FAN_CLEANER.lastCleaned }]} />
      {footer}
    </div>
  );
}

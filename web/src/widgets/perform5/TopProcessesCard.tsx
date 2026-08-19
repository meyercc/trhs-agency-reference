import { CardDoor, FeatStatus } from './CardKit';

// ── Top Processes card (PerformV5, Monitoring) ──
// The second Monitoring card, split out of System Vitals. Per the research: a
// SMALL glance = the top-3 offenders, each shown by its single dominant resource
// + a magnitude bar (CPU/GPU/RAM only — per-process network needs ETW and is
// dropped). Has a required calm "nothing hogging" state. The full table is not
// in-app — the "Open Task Manager" door (header-right, external) covers it.
// Styled as a technical LIST (ranked rows, hairline dividers, mono values, a
// resource chip). Leads with the standardized status reading: "3 heavy" /
// "Quiet" — same slot as the other feature cards (CardKit vocabulary).

interface Offender {
  app: string;
  resource: 'GPU' | 'CPU' | 'RAM';
  value: string; // magnitude, e.g. "61%" / "2.1 GB"
  frac: number; // bar magnitude 0..1
}

const OFFENDERS: Offender[] = [
  { app: 'OBS Studio', resource: 'GPU', value: '61%', frac: 0.61 },
  { app: 'Google Chrome', resource: 'CPU', value: '47%', frac: 0.47 },
  { app: 'Discord', resource: 'RAM', value: '2.1 GB', frac: 0.34 },
];

export interface TopProcessesCardProps {
  /** when nothing exceeds the threshold, show the calm state */
  quiet?: boolean;
}

export function TopProcessesCard({ quiet = false }: TopProcessesCardProps) {
  return (
    <div className="ds-feature-card pv5-top-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">Top Processes</div>
        <CardDoor verb="open" target="Task Manager" />
      </div>

      {quiet ? <FeatStatus word="quiet" /> : <FeatStatus word="heavy" count={OFFENDERS.length} />}

      {/* No explanatory copy (V5 rule) — the "Quiet" status word carries the calm
          state; tooltip candidate: "Nothing is hogging your PC — background apps
          are quiet." */}
      {quiet ? null : (
        <ol className="pv5-top-list">
          {OFFENDERS.map((o, i) => (
            <li className="pv5-top-row" key={o.app}>
              <span className="pv5-top-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="pv5-top-app" title={o.app}>{o.app}</span>
              <span className="pv5-top-res">{o.resource}</span>
              <span className="pv5-top-val">{o.value}</span>
              <span className="pv5-top-bar"><i style={{ width: o.frac * 100 + '%' }} /></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import { CardDoor, FeatStatus, Metric, Metrics } from './CardKit';
import type { NbMode } from '../perform5/NetworkBoosterCard';

// ── Network Booster card (PerformV6) ──
// V6 fork of perform5/NetworkBoosterCard: same anatomy (status card — no
// controls; Manage door; throughput bound here), but the reading takes its
// natural HERO form again — a Metric pair (big mono numbers) instead of Facts
// rows. (Identity icon tiles were tried and removed — 2026-07-23.)

export type { NbMode };

export interface NetworkBoosterCardProps {
  mode: NbMode;
  onManage: () => void;
}

export function NetworkBoosterCard({ mode, onManage }: NetworkBoosterCardProps) {
  const active = mode !== 'off';

  return (
    <div className="ds-feature-card pv5-nb-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">Network Booster</div>
        <CardDoor verb="manage" onClick={onManage} />
      </div>

      <FeatStatus word={active ? 'idle' : 'inactive'} /* V6 note: baseline follows V5's resting-state principle; no session trigger wired here yet */ />

      <Metrics>
        <Metric arrow="↓" value={active ? '229.3' : '—'} unit="Mbps" />
        <Metric arrow="↑" value={active ? '13.0' : '—'} unit="Mbps" />
      </Metrics>
    </div>
  );
}

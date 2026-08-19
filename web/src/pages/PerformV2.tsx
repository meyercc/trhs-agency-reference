import { ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { MonitoringBar, Optimizer, Maintenance, DeviceWidget } from '../widgets';
import { PerformanceCard } from '../widgets/PerformanceCard';
import './pages.css';
import './perform-v2.css';

// PerformV2 — parallel redesign preview at #/perform-v2; the original Perform
// page is untouched. Structured per the OGH performance-control audit
// (docs/omen-audit-digest.md): Monitor (passive telemetry, stays adjacent to
// Performance) / Performance (mode-first card; Unleashed reveals the five
// tuning domains inline as collapsible sections, L4 behind an extra
// disclosure) / Maintenance (lower frequency, higher consequence: optimizer +
// boosters + cleaners) / My Devices.

const DEVICES = ['haste-3-pro', 'pulse-27', 'origins-65', 'cloud-iii'];

export function PerformV2() {
  const sections: ReorderableSectionData[] = [
    {
      id: 'monitor',
      header: <SectionHeader label="Monitor" />,
      children: <MonitoringBar />,
    },
    {
      id: 'performance',
      header: <SectionHeader label="Performance" />,
      children: <PerformanceCard />,
    },
    {
      id: 'maintenance',
      header: <SectionHeader label="Maintenance" />,
      children: (
        <div className="pv2-rows">
          <Optimizer />
          <Maintenance />
        </div>
      ),
    },
    {
      id: 'devices',
      header: <SectionHeader label="My Devices" count={`${DEVICES.length} connected`} />,
      children: (
        <div className="pg-grid pg-grid-wide">
          {DEVICES.map((id) => (
            <DeviceWidget key={id} skuId={id} />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="ds-text-title-1 page-title">Perform</h1>
      <p className="ds-text-body page-sub">Monitor and tune your system — audit reorg preview.</p>
      <ReorderableSections sections={sections} storageKey="perform-v2-sections" />
    </div>
  );
}

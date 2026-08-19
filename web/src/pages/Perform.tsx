import { useSearchParams } from 'react-router-dom';
import { ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { MonitoringBar, PowerThermal, Optimizer, Maintenance, DeviceOverview } from '../widgets';
import { useModules } from '../state/Modules';
import { useSettings } from '../state/Settings';
import './pages.css';

/**
 * The page's subtitle sets the expectation for what this screen is *for*, which
 * differs by persona: a learner is here to see what's already being handled, a
 * tinkerer to change it, a minimalist to glance and leave. Pre-onboarding falls
 * back to the neutral line.
 */
const SUBTITLE: Record<string, string> = {
  learner: "See how your system is running — OMEN AI is handling the tuning.",
  tinkerer: 'Full manual control over power, thermals, and per-game optimization.',
  minimalist: 'A quick look at how your system is running.',
};
const SUBTITLE_DEFAULT = 'Monitor and tune your system.';

export function Perform() {
  const [, setParams] = useSearchParams();
  const { has } = useModules();
  const { persona } = useSettings();
  const sections: ReorderableSectionData[] = [
    // Monitoring bar belongs to the System Vitals module — hidden when removed.
    ...(has('vitals')
      ? [
          {
            id: 'monitoring',
            header: <SectionHeader label="Monitoring" />,
            children: <MonitoringBar onOpenTab={(tab) => setParams({ modal: 'vitals', tab })} />,
          },
        ]
      : []),
    {
      id: 'power-thermal',
      header: <SectionHeader label="Power & Thermal" />,
      children: <PowerThermal />,
    },
    {
      id: 'optimizer',
      header: <SectionHeader label="Optimizer" />,
      children: (
        <Optimizer
          onConfigureAi={() => setParams({ modal: 'omenai' })}
          onConfigureBooster={() => setParams({ modal: 'booster' })}
        />
      ),
    },
    {
      id: 'maintenance',
      header: <SectionHeader label="Maintenance" />,
      children: <Maintenance />,
    },
    // Monitor section (Cindy): adaptive Device Overview (Map/Tile). Mounted on
    // Perform per our IA; the persistent home for the live device view is an
    // open IA-meeting question (Junchao) — move it when that lands.
    {
      id: 'devices',
      header: <SectionHeader label="Device Overview" />,
      children: <DeviceOverview />,
    },
  ];

  return (
    <div>
      <h1 className="ds-text-title-1 page-title">Performance</h1>
      <p className="ds-text-body page-sub">{SUBTITLE[persona] ?? SUBTITLE_DEFAULT}</p>
      <ReorderableSections sections={sections} storageKey="perform-sections" />
    </div>
  );
}

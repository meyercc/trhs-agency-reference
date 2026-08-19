import { ReorderableSections, type ReorderableSectionData } from '../components';
import { SectionHeader } from './SectionHeader';
import { lazy, Suspense } from 'react';
import { LightingWidget } from '../widgets';
import { ModulesManager } from '../modules/ModulesManager';
import { useModules } from '../state/Modules';
import './pages.css';

// Lazy so three.js only loads when the (gated) Light Studio section renders.
const LightStudio = lazy(() => import('../lightstudio/LightStudio').then((m) => ({ default: m.LightStudio })));

export function Personalize() {
  const { has } = useModules();
  // App appearance (theme/accent/wallpaper) lives in Settings now — this page
  // is about personalizing the DESK (lighting, modules), not the app.
  const sections: ReorderableSectionData[] = [
    {
      id: 'lighting',
      header: <SectionHeader label="Lighting" />,
      children: (
        <div className="pg-grid pg-grid-wide">
          <LightingWidget />
        </div>
      ),
    },
    ...(has('lightstudio')
      ? [
          {
            id: 'lightstudio',
            header: <SectionHeader label="Light Studio" />,
            children: (
              <Suspense
                fallback={
                  <div style={{ padding: 'var(--gutter)', color: 'var(--text-muted)', fontSize: 'var(--text-caption)' }}>
                    Loading Light Studio…
                  </div>
                }
              >
                <LightStudio />
              </Suspense>
            ),
          },
        ]
      : []),
    {
      id: 'modules',
      header: <SectionHeader label="Modules" />,
      children: <ModulesManager />,
    },
  ];

  return (
    <div>
      <h1 className="ds-text-title-1 page-title">Personalize</h1>
      <p className="ds-text-body page-sub">Make it yours.</p>
      <ReorderableSections sections={sections} storageKey="personalize-sections" />
    </div>
  );
}

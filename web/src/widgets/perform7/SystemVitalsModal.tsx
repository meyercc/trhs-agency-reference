import { useEffect, useState } from 'react';
import { Menu, ModalShell } from '../../components';
import { TrendGraph, TREND_RANGES, type TrendRange } from './TrendGraph';

// ── System Vitals detail modal (PerformV7) ──
// Four changes over V5, each fixing something the old version could not say:
//
// 1. RAIL = NAVIGATION. The identity line and the "Nominal · updated 2s ago"
//    status left it: the first restated the modal's own title, the second
//    claimed liveness over numbers that never moved. What survives of them is a
//    footer strip — modal-scope metadata belongs to the frame, not to a tab.
// 2. THE READINGS ARE THE CHART'S SELECTOR. V5 put four instantaneous stats
//    above one unlabelled series, and nothing said which of the four the line
//    plotted — the graph had no y-meaning at all. Now each reading is
//    selectable and the trend plots the selected one in its own unit.
// 3. THE TREND CARRIES REFERENCES (see TrendGraph): a real domain, the peak in
//    the window, the current value, and thresholds where the metric has them.
//    Without those a line is decoration; with them a spike is legible.
// 4. SAMPLING IS REAL. The series advances on a timer, so the footer's
//    "updated Ns ago" is true and a spike is something you can watch arrive.
//
// TIME RANGE is the chart's own control, at the chart's foot — it governs this
// trend and nothing else, so it does not belong in the modal header. 60s is the
// live window; the longer ranges derive a coarser series from it, because real
// day/week/month data needs a history store that does not exist yet. Flagged
// rather than hidden: what ships depends on that store, and the range that
// actually answers "was that stutter the game or my rig" is per-session, which
// is neither live nor calendar.
//
// ⚠️ VOCABULARY GAP, flagged not papered over: the Storage tab needs a door to
// the cleaner, and the door verbs (manage / settings / schedule / more /
// configure / open) have no value for "go to another feature inside the app" —
// `open` means leaving the app and renders ↗. Rendered here named by its
// DESTINATION instead, which suggests the rule: within a feature a door is named
// by verb, across features by where it lands. Owner's call.

interface Metric {
  id: string;
  label: string;
  unit: string;
  max: number;
  series: number[];
  thresholds?: { warn?: number; danger?: number };
  /** Static spec (total RAM) — shown, but nothing to trend. */
  flat?: string;
}
interface Tab {
  id: string;
  label: string;
  metrics: Metric[];
  door?: { label: string; feature: 'system-clean' | 'fan-clean' };
}

const seed = (base: number, spread: number, n = 30) =>
  Array.from({ length: n }, (_, i) => Math.round((base + Math.sin(i / 3) * spread + (i % 7) * (spread / 6)) * 10) / 10);

const TABS: Tab[] = [
  {
    id: 'cpu',
    label: 'CPU',
    metrics: [
      { id: 'load', label: 'Load', unit: '%', max: 100, series: seed(42, 14) },
      { id: 'temp', label: 'Temp', unit: '°C', max: 100, series: seed(57, 8), thresholds: { warn: 78, danger: 89 } },
      { id: 'clock', label: 'Clock', unit: 'GHz', max: 6, series: seed(4.6, 0.4) },
      { id: 'power', label: 'Power', unit: 'W', max: 120, series: seed(45, 16) },
    ],
  },
  {
    id: 'gpu',
    label: 'GPU',
    metrics: [
      { id: 'load', label: 'Load', unit: '%', max: 100, series: seed(38, 20) },
      { id: 'temp', label: 'Temp', unit: '°C', max: 100, series: seed(60, 7), thresholds: { warn: 78, danger: 89 } },
      { id: 'core', label: 'Core', unit: 'MHz', max: 2600, series: seed(1850, 180) },
      { id: 'power', label: 'Power', unit: 'W', max: 200, series: seed(92, 30) },
    ],
  },
  {
    id: 'ram',
    label: 'RAM',
    metrics: [
      { id: 'used', label: 'Used', unit: 'GB', max: 32, series: seed(18, 3) },
      { id: 'util', label: 'Utilisation', unit: '%', max: 100, series: seed(54, 9) },
      { id: 'total', label: 'Total', unit: 'GB', max: 32, series: [32], flat: '32 GB' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    metrics: [
      { id: 'down', label: 'Down', unit: 'Mbps', max: 500, series: seed(229, 90) },
      { id: 'up', label: 'Up', unit: 'Mbps', max: 100, series: seed(13, 9) },
      { id: 'latency', label: 'Latency', unit: 'ms', max: 100, series: seed(12, 6), thresholds: { warn: 40, danger: 70 } },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    metrics: [
      { id: 'used', label: 'C: used', unit: '%', max: 100, series: seed(61, 2), thresholds: { warn: 85, danger: 95 } },
      { id: 'read', label: 'Read', unit: 'MB/s', max: 3000, series: seed(320, 260) },
      { id: 'write', label: 'Write', unit: 'MB/s', max: 3000, series: seed(180, 200) },
    ],
    // A second entry point, not a second implementation — it lands on the
    // cleaner's canonical modal, which is what dual-entry allows.
    door: { label: 'System Cleaner', feature: 'system-clean' },
  },
];

const TICK_MS = 2000;

// Longer ranges are not more samples of the same thing — they are a coarser
// view. Real day/week/month data needs a history store we do not have yet; this
// derives a plausible coarser series from the live one so the SHAPE of the
// control can be judged, and it is marked as derived rather than measured.
function coarsen(series: number[], range: TrendRange): number[] {
  if (range === '60s') return series;
  const buckets = range === '24h' ? 24 : range === '7d' ? 28 : 30;
  const out: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const a = series[i % series.length];
    const b = series[(i * 7 + 3) % series.length];
    out.push(Math.round(((a + b) / 2) * 10) / 10);
  }
  return out;
}

export interface SystemVitalsModalProps {
  initialTab?: string;
  onClose?: () => void;
  /** Cross-feature doors resolve to that feature's own modal, opened by the page. */
  onOpenFeature?: (feature: 'system-clean' | 'fan-clean') => void;
}

export function SystemVitalsModal({ initialTab = 'cpu', onClose, onOpenFeature }: SystemVitalsModalProps) {
  const [tab, setTab] = useState(initialTab);
  const [metricId, setMetricId] = useState('load');
  const [range, setRange] = useState<TrendRange>('60s');
  const [, setTick] = useState(0);
  const [age, setAge] = useState(0);

  // Advance every series one sample. Static numbers under a live-looking
  // timestamp is exactly what this replaces.
  useEffect(() => {
    const sample = window.setInterval(() => {
      TABS.forEach((t) =>
        t.metrics.forEach((m) => {
          if (m.flat) return;
          const last = m.series[m.series.length - 1];
          const drift = (Math.random() - 0.5) * (m.max / 12);
          const spike = Math.random() < 0.06 ? m.max / 4 : 0;
          const next = Math.max(0, Math.min(m.max, last + drift + spike));
          m.series = [...m.series.slice(1), Math.round(next * 10) / 10];
        }),
      );
      setTick((n) => n + 1);
      setAge(0);
    }, TICK_MS);
    const clock = window.setInterval(() => setAge((a) => a + 1), 1000);
    return () => {
      window.clearInterval(sample);
      window.clearInterval(clock);
    };
  }, []);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const metric = active.metrics.find((m) => m.id === metricId) ?? active.metrics[0];

  const pickTab = (id: string) => {
    setTab(id);
    const t = TABS.find((x) => x.id === id);
    if (t && !t.metrics.some((m) => m.id === metricId)) setMetricId(t.metrics[0].id);
  };

  const value = (m: Metric) => (m.flat ? m.flat : `${m.series[m.series.length - 1]}${m.unit}`);

  const left = (
    <div className="pv5-svm-left pv7-svm-left">
      <Menu
        orientation="vertical"
        aria-label="Readings"
        items={TABS.map((t) => ({ id: t.id, label: t.label, active: t.id === tab, onClick: () => pickTab(t.id) }))}
      />
    </div>
  );

  // Frame furniture: modal-scope metadata, so it belongs to the frame rather
  // than to a tab or to the scroll area.
  const foot = (
    <div className="pv7-svm-foot">
      <span className="pv7-svm-foot-dot" aria-hidden="true" />
      <span>Live hardware telemetry · read-only</span>
      <span className="pv7-svm-foot-age">{age === 0 ? 'updated just now' : `updated ${age}s ago`}</span>
    </div>
  );

  return (
    <ModalShell title="System Vitals" onClose={onClose} className="pv5-svm pv7-svm" left={left} footer={foot}>
      <div className="pv5-svm-head">{active.label}</div>

      <div className="pv7-svm-metrics" role="tablist" aria-label={`${active.label} readings`}>
        {active.metrics.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === metric.id}
            className={'pv7-svm-metric' + (m.id === metric.id ? ' active' : '') + (m.flat ? ' flat' : '')}
            onClick={() => !m.flat && setMetricId(m.id)}
            disabled={!!m.flat}
          >
            <span className="pv7-svm-metric-l">{m.label}</span>
            <span className="pv7-svm-metric-v">{value(m)}</span>
          </button>
        ))}
      </div>

      <TrendGraph
        data={coarsen(metric.series, range)}
        max={metric.max}
        unit={metric.unit}
        thresholds={metric.thresholds}
        window={TREND_RANGES.find((r) => r.value === range)?.window}
        range={range}
        onRange={setRange}
      />

      {active.door && onOpenFeature && (
        <div className="pv7-svm-door">
          <button type="button" className="pv5-card-door" onClick={() => onOpenFeature(active.door!.feature)}>
            {active.door.label} <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

    </ModalShell>
  );
}

import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Point } from './vitalsData';

export interface ChartSeries {
  label: string;
  /** hex colour, e.g. "#00c8d7" */
  color: string;
  data: Point[];
}

interface VitalsChartProps {
  series: ChartSeries[];
  /** "line" = full axes + grid + tooltip; "spark" = bare minimal sparkline. */
  variant?: 'line' | 'spark';
  /** force the y-axis floor (charts that read as % pin to 0). */
  yMin?: number;
}

// hex "#rrggbb" → "rgba(r,g,b,a)"
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const AXIS = 'rgba(255,255,255,0.4)';
const GRID = 'rgba(255,255,255,0.06)';

/**
 * uPlot line/area chart, sized to its container via ResizeObserver and updated
 * in place as the vitals stream ticks (create-once, setData thereafter). Used
 * for the per-tab time-series and the overview sparklines.
 */
export function VitalsChart({ series, variant = 'line', yMin }: VitalsChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot>();
  const spark = variant === 'spark';

  // Build the [x, ...ys] matrix uPlot expects, using the shortest series length
  // (all vitals series tick together, but guard against a transient mismatch).
  const toData = (): uPlot.AlignedData => {
    const len = series.reduce((m, s) => Math.min(m, s.data.length), Infinity) || 0;
    const base = series[0]?.data ?? [];
    const xs = new Array(len);
    for (let i = 0; i < len; i++) xs[i] = base[i].t / 1000; // uPlot time = seconds
    const ys = series.map((s) => {
      const col = new Array(len);
      for (let i = 0; i < len; i++) col[i] = s.data[i].v;
      return col;
    });
    return [xs, ...ys];
  };

  // Create the plot once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const w = host.clientWidth || 300;
    const h = host.clientHeight || (spark ? 40 : 140);

    const seriesOpts: uPlot.Series[] = [
      {}, // x
      ...series.map((s) => ({
        label: s.label,
        stroke: s.color,
        width: spark ? 1.4 : 1.8,
        fill: (u: uPlot) => {
          const ctx = u.ctx;
          const g = ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
          g.addColorStop(0, rgba(s.color, spark ? 0.28 : 0.33));
          g.addColorStop(1, rgba(s.color, 0));
          return g;
        },
        points: { show: false },
      })),
    ];

    const opts: uPlot.Options = {
      width: w,
      height: h,
      padding: spark ? [2, 2, 2, 2] : [10, 12, 4, 4],
      cursor: spark
        ? { show: false, x: false, y: false }
        : { points: { size: 5 }, y: false },
      legend: { show: false },
      scales: { x: { time: true }, y: yMin != null ? { range: (_u, _min, max) => [yMin, max] } : {} },
      axes: spark
        ? [{ show: false }, { show: false }]
        : [
            {
              stroke: AXIS,
              size: 24,
              font: '9px var(--font-mono, monospace)',
              grid: { show: false },
              ticks: { show: false },
              values: (_u, splits) =>
                splits.map((s) => {
                  const d = new Date(s * 1000);
                  return `${d.getMinutes()}:${String(d.getSeconds()).padStart(2, '0')}`;
                }),
            },
            {
              stroke: AXIS,
              size: 34,
              font: '9px var(--font-mono, monospace)',
              grid: { stroke: GRID, width: 1 },
              ticks: { show: false },
            },
          ],
      series: seriesOpts,
    };

    const plot = new uPlot(opts, toData(), host);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      const bw = host.clientWidth;
      const bh = host.clientHeight;
      if (bw > 0 && bh > 0) plot.setSize({ width: bw, height: bh });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = undefined;
    };
    // Recreate only if the variant/structure changes, not on every data tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spark, series.length, yMin]);

  // Push new data on each tick.
  useEffect(() => {
    plotRef.current?.setData(toData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  return <div ref={hostRef} className="vm-uplot" />;
}

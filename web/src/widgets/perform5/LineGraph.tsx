// ── LineGraph (PerformV5) ──
// The app has NO reusable data-driven line/history chart (every existing one is
// a hand-authored static path). This is a minimal data → SVG-path history graph
// following the CpuWidget convention (viewBox + preserveAspectRatio="none",
// stroke var(--cyan), area fill var(--cyan-dim), non-scaling stroke).

export interface LineGraphProps {
  data: number[];
  height?: number;
  color?: string;
}

export function LineGraph({ data, height = 72, color = 'var(--cyan)' }: LineGraphProps) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const n = data.length;
  const pts = data.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * 100 : 0;
    const y = 100 - ((v - min) / range) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = 'M' + pts.join(' L');
  const area = `${line} L100,100 L0,100 Z`;
  return (
    <svg className="pv5-linegraph" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <path d={area} fill="color-mix(in srgb, var(--cyan), transparent 88%)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

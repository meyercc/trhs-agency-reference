// TODO(bench): wire to the real benchmark service. Stubbed for the prototype —
// resolves with a plausible score after a fixed delay so the UI flow is real.
export function runBenchmark(kind: 'cpu' | 'gpu'): Promise<number> {
  const base = kind === 'cpu' ? 7500 : 12000;
  const spread = kind === 'cpu' ? 2000 : 3000;
  const ms = kind === 'cpu' ? 2800 : 3200;
  return new Promise((resolve) => {
    setTimeout(() => resolve(Math.floor(base + Math.random() * spread)), ms);
  });
}

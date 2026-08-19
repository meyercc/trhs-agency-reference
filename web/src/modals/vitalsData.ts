// ══════════════════════════════════════════════════════════════════════════════
// VITALS DATA — simulated system-monitor stream.
//
// The vanilla prototype fed the Full Details modal from a live `sensor-service`
// over `sensor-client` (real CPU/GPU/RAM/net/disk telemetry). The React app has
// no such bridge, so we synthesize a believable stream: a seeded ~2-minute
// history plus a ~1s ticker that random-walks each metric. Consumed by
// `useVitalsStream()`; shapes mirror the vanilla `latest` snapshot + `history`.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface Point {
  t: number; // epoch ms
  v: number;
}

export interface VitalsSnapshot {
  cpu: {
    model: string;
    cores: number;
    threads: number;
    speed: number; // GHz
    temp: number; // °C
    usage: number; // %
    perCore: number[]; // % per logical core
  };
  gpu: {
    model: string;
    vram: number; // MB total
    clockCore: number; // MHz
    clockMemory: number; // MHz
    temp: number; // °C
    usage: number; // %
    memUsed: number; // MB
    memTotal: number; // MB
  };
  ram: {
    total: number; // bytes
    used: number; // bytes
    available: number; // bytes
    percent: number; // %
    swapUsed: number; // bytes
    swapTotal: number; // bytes
  };
  net: {
    iface: string;
    type: string;
    link: number; // Mbps negotiated link speed
    ip4: string;
    up: number; // Mbps current
    down: number; // Mbps current
    txTotal: number; // bytes since boot
    rxTotal: number; // bytes since boot
  };
  storage: DriveSnapshot[];
}

export interface DriveSnapshot {
  name: string;
  type: string; // e.g. "SSD · NVMe"
  size: number; // bytes
  used: number; // bytes
  available: number; // bytes
  percent: number; // %
  temp: number; // °C
}

export interface VitalsHistory {
  cpu: Point[]; // usage %
  gpu: Point[]; // usage %
  ram: Point[]; // percent %
  netUp: Point[]; // Mbps
  netDown: Point[]; // Mbps
}

export interface VitalsStream {
  snapshot: VitalsSnapshot;
  history: VitalsHistory;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GB = 1e9;
const HISTORY_SECONDS = 120; // 2-minute window
const TICK_MS = 1000;

const CPU_CORES = 8;
const CPU_THREADS = 16;
const RAM_TOTAL = 32 * GB;
const GPU_VRAM = 12288; // MB

// Fixed drive geometry (matches the Perform monitoring bar's two drives).
const DRIVE_SPECS = [
  { name: 'C: · NVMe SSD', type: 'SSD · NVMe', size: 1000 * GB, basePct: 61 },
  { name: 'D: · NVMe SSD', type: 'SSD · NVMe', size: 2000 * GB, basePct: 62 },
];

// ── Random-walk helpers ──────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Nudge `prev` by up to ±`step`, biased gently back toward `center`. */
function walk(prev: number, center: number, step: number, lo: number, hi: number): number {
  const drift = (center - prev) * 0.05;
  return clamp(prev + drift + (Math.random() - 0.5) * 2 * step, lo, hi);
}

// ── State the ticker mutates between frames ──────────────────────────────────

interface WalkState {
  cpu: number;
  gpu: number;
  ram: number;
  up: number;
  down: number;
  perCore: number[];
}

function initWalk(): WalkState {
  return {
    cpu: 42,
    gpu: 34,
    ram: 58,
    up: 13,
    down: 190,
    perCore: Array.from({ length: CPU_THREADS }, () => 30 + Math.random() * 30),
  };
}

function stepWalk(s: WalkState): WalkState {
  const cpu = walk(s.cpu, 45, 6, 3, 98);
  return {
    cpu,
    gpu: walk(s.gpu, 38, 7, 2, 99),
    ram: walk(s.ram, 58, 2, 30, 92),
    up: walk(s.up, 14, 4, 0.2, 60),
    down: walk(s.down, 190, 30, 2, 940),
    // Per-core loosely tracks the aggregate CPU with per-core jitter.
    perCore: s.perCore.map((c) => walk(c, cpu, 14, 0, 100)),
  };
}

// ── Snapshot assembly ────────────────────────────────────────────────────────

function tempFromLoad(load: number, base: number, span: number): number {
  return Math.round(base + (load / 100) * span);
}

function buildSnapshot(w: WalkState, txTotal: number, rxTotal: number): VitalsSnapshot {
  const ramUsed = (w.ram / 100) * RAM_TOTAL;
  const gpuMemUsed = Math.round((w.gpu / 100) * 0.7 * GPU_VRAM + 0.15 * GPU_VRAM);
  return {
    cpu: {
      model: 'AMD Ryzen 9 7940HS',
      cores: CPU_CORES,
      threads: CPU_THREADS,
      speed: +(3.8 + (w.cpu / 100) * 1.4).toFixed(1),
      temp: tempFromLoad(w.cpu, 44, 42),
      usage: Math.round(w.cpu),
      perCore: w.perCore.map((c) => Math.round(c)),
    },
    gpu: {
      model: 'NVIDIA GeForce RTX 4080 Laptop GPU',
      vram: GPU_VRAM,
      clockCore: Math.round(1400 + (w.gpu / 100) * 900),
      clockMemory: Math.round(7000 + (w.gpu / 100) * 2000),
      temp: tempFromLoad(w.gpu, 40, 45),
      usage: Math.round(w.gpu),
      memUsed: gpuMemUsed,
      memTotal: GPU_VRAM,
    },
    ram: {
      total: RAM_TOTAL,
      used: ramUsed,
      available: RAM_TOTAL - ramUsed,
      percent: Math.round(w.ram),
      swapUsed: 1.2 * GB,
      swapTotal: 8 * GB,
    },
    net: {
      iface: 'Wi-Fi 6E',
      type: '802.11ax',
      link: 2400,
      ip4: '192.168.1.42',
      up: +w.up.toFixed(1),
      down: +w.down.toFixed(1),
      txTotal,
      rxTotal,
    },
    storage: DRIVE_SPECS.map((d) => {
      const pct = d.basePct;
      const used = (pct / 100) * d.size;
      return {
        name: d.name,
        type: d.type,
        size: d.size,
        used,
        available: d.size - used,
        percent: pct,
        temp: 38,
      };
    }),
  };
}

// ── Seed a 2-minute history ending "now" ─────────────────────────────────────

function seed(now: number): { history: VitalsHistory; walk: WalkState; txTotal: number; rxTotal: number } {
  let w = initWalk();
  const history: VitalsHistory = { cpu: [], gpu: [], ram: [], netUp: [], netDown: [] };
  let txTotal = 4.2e12; // ~4.2 TB sent since boot
  let rxTotal = 61e12; // ~61 TB received since boot

  for (let i = HISTORY_SECONDS - 1; i >= 0; i--) {
    w = stepWalk(w);
    const t = now - i * TICK_MS;
    history.cpu.push({ t, v: Math.round(w.cpu) });
    history.gpu.push({ t, v: Math.round(w.gpu) });
    history.ram.push({ t, v: Math.round(w.ram) });
    history.netUp.push({ t, v: +w.up.toFixed(1) });
    history.netDown.push({ t, v: +w.down.toFixed(1) });
    txTotal += (w.up * 1e6) / 8;
    rxTotal += (w.down * 1e6) / 8;
  }
  return { history, walk: w, txTotal, rxTotal };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Simulated live vitals stream. Seeds a 2-minute history on mount, then ticks
 * every second — random-walking each metric, appending to history (trimmed to
 * the window), and republishing a fresh snapshot. One instance per open modal.
 */
export function useVitalsStream(active: boolean): VitalsStream {
  const walkRef = useRef<WalkState>();
  const totalsRef = useRef({ tx: 0, rx: 0 });
  const [stream, setStream] = useState<VitalsStream>(() => {
    const now = Date.now();
    const s = seed(now);
    walkRef.current = s.walk;
    totalsRef.current = { tx: s.txTotal, rx: s.rxTotal };
    return { snapshot: buildSnapshot(s.walk, s.txTotal, s.rxTotal), history: s.history };
  });

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const w = stepWalk(walkRef.current!);
      walkRef.current = w;
      totalsRef.current = {
        tx: totalsRef.current.tx + (w.up * 1e6) / 8,
        rx: totalsRef.current.rx + (w.down * 1e6) / 8,
      };
      setStream((prev) => {
        const push = (arr: Point[], v: number): Point[] => {
          const next = arr.concat({ t: now, v });
          return next.length > HISTORY_SECONDS ? next.slice(next.length - HISTORY_SECONDS) : next;
        };
        return {
          snapshot: buildSnapshot(w, totalsRef.current.tx, totalsRef.current.rx),
          history: {
            cpu: push(prev.history.cpu, Math.round(w.cpu)),
            gpu: push(prev.history.gpu, Math.round(w.gpu)),
            ram: push(prev.history.ram, Math.round(w.ram)),
            netUp: push(prev.history.netUp, +w.up.toFixed(1)),
            netDown: push(prev.history.netDown, +w.down.toFixed(1)),
          },
        };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);

  return stream;
}

// ── Formatting helpers (shared with the modal) ───────────────────────────────

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '--';
  if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  return Math.round(b / 1e3) + ' KB';
}

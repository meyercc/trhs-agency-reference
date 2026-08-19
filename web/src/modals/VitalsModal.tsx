import { useState } from 'react';
import { ModalShell, Badge } from '../components';
import { useSettings } from '../state/Settings';
import { formatTemp } from '../state/units';
import { useVitalsStream, fmtBytes, type VitalsSnapshot, type VitalsHistory } from './vitalsData';
import { VitalsChart } from './VitalsChart';
import { Gauge } from '../widgets/Gauge';
import './vitals-modal.css';

// Series colours (mirror the vanilla ECharts palette).
const C_CPU = '#00c8d7';
const C_GPU = '#a855f7';
const C_RAM = '#22c55e';
const C_UP = '#22c55e';
const C_DOWN = '#00c8d7';

export type VitalsTab = 'overview' | 'cpu' | 'gpu' | 'ram' | 'network' | 'storage';

const TABS: { id: VitalsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cpu', label: 'CPU' },
  { id: 'gpu', label: 'GPU' },
  { id: 'ram', label: 'Memory' },
  { id: 'network', label: 'Network' },
  { id: 'storage', label: 'Storage' },
];

// Up/down throughput chevron at an arbitrary size.
function NetGlyph({ down, size = 12 }: { down?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke={down ? 'var(--cyan)' : 'var(--green)'}
      strokeWidth="1.6"
      strokeLinecap="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {down ? (
        <>
          <line x1="7" y1="2" x2="7" y2="12" />
          <polyline points="3.5,8.5 7,12 10.5,8.5" />
        </>
      ) : (
        <>
          <line x1="7" y1="12" x2="7" y2="2" />
          <polyline points="3.5,5.5 7,2 10.5,5.5" />
        </>
      )}
    </svg>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="ds-spark-cell">
      <span className="ds-spark-val">{value}</span>
      <span className="ds-spark-lbl">{label}</span>
    </div>
  );
}

// Temp → status tone.
function tempTone(c: number): 'positive' | 'info' | 'warn' | 'danger' {
  if (c >= 85) return 'danger';
  if (c >= 75) return 'warn';
  if (c >= 65) return 'info';
  return 'positive';
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function OverviewPanel({ snap, hist, onTab, unit }: PanelProps & { onTab: (t: VitalsTab) => void }) {
  return (
    <div className="vm-overview-grid">
      <div className="vm-card" onClick={() => onTab('cpu')}>
        <div className="vm-card-header">
          <span className="vm-card-title">CPU</span>
          <Badge variant="status" tone={tempTone(snap.cpu.temp)}>
            {formatTemp(snap.cpu.temp, unit)}
          </Badge>
        </div>
        <div className="vm-card-gauge-row">
          <Gauge value={snap.cpu.usage} className="vm-gauge" />
          <div className="vm-card-spark">
            <VitalsChart variant="spark" series={[{ label: 'CPU', color: C_CPU, data: hist.cpu }]} yMin={0} />
          </div>
        </div>
        <div className="vm-card-model">{snap.cpu.model}</div>
      </div>

      <div className="vm-card" onClick={() => onTab('gpu')}>
        <div className="vm-card-header">
          <span className="vm-card-title">GPU</span>
          <Badge variant="status" tone={tempTone(snap.gpu.temp)}>
            {formatTemp(snap.gpu.temp, unit)}
          </Badge>
        </div>
        <div className="vm-card-gauge-row">
          <Gauge value={snap.gpu.usage} className="vm-gauge" />
          <div className="vm-card-spark">
            <VitalsChart variant="spark" series={[{ label: 'GPU', color: C_GPU, data: hist.gpu }]} yMin={0} />
          </div>
        </div>
        <div className="vm-card-model">{snap.gpu.model}</div>
      </div>

      <div className="vm-card" onClick={() => onTab('ram')}>
        <div className="vm-card-header">
          <span className="vm-card-title">Memory</span>
          <Badge variant="status" tone="positive">
            {fmtBytes(snap.ram.used)}
          </Badge>
        </div>
        <div className="vm-card-gauge-row">
          <Gauge value={snap.ram.percent} className="vm-gauge" />
          <div className="vm-card-spark">
            <VitalsChart variant="spark" series={[{ label: 'RAM', color: C_RAM, data: hist.ram }]} yMin={0} />
          </div>
        </div>
        <div className="vm-card-model">{fmtBytes(snap.ram.total)} total</div>
      </div>

      <div className="vm-card" onClick={() => onTab('network')}>
        <div className="vm-card-header">
          <span className="vm-card-title">Network</span>
          <Badge variant="status">{snap.net.iface}</Badge>
        </div>
        <div className="vm-card-net">
          <div className="vm-card-net-row">
            <NetGlyph />
            <span className="vm-card-net-val">{snap.net.up.toFixed(1)}</span>
            <span className="vm-card-net-unit">Mbps</span>
          </div>
          <div className="vm-card-net-row">
            <NetGlyph down />
            <span className="vm-card-net-val">{snap.net.down.toFixed(1)}</span>
            <span className="vm-card-net-unit">Mbps</span>
          </div>
        </div>
        <div className="vm-card-spark">
          <VitalsChart variant="spark" series={[{ label: 'Down', color: C_DOWN, data: hist.netDown }]} yMin={0} />
        </div>
      </div>
    </div>
  );
}

function CpuPanel({ snap, hist, unit }: PanelProps) {
  return (
    <>
      <div className="vm-detail-header">
        <Gauge value={snap.cpu.usage} className="vm-gauge-lg" />
        <div className="vm-detail-info">
          <div className="vm-detail-name">{snap.cpu.model}</div>
          <div className="vm-detail-stats">
            <Stat value={snap.cpu.cores} label="Cores" />
            <Stat value={snap.cpu.threads} label="Threads" />
            <Stat value={snap.cpu.speed.toFixed(1)} label="GHz" />
            <Stat value={formatTemp(snap.cpu.temp, unit)} label="Temp" />
          </div>
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">CPU Usage — Last 2 Minutes</div>
        <div className="vm-chart">
          <VitalsChart series={[{ label: 'CPU Usage', color: C_CPU, data: hist.cpu }]} yMin={0} />
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">Per-Core Load</div>
        <div className="vm-core-grid">
          {snap.cpu.perCore.map((pct, i) => (
            <div className="vm-core-cell" key={i}>
              <div className="ds-prog-track">
                <div className="ds-prog-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="vm-core-pct">{pct}</div>
              <div className="vm-core-label">Core {i}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GpuPanel({ snap, hist, unit }: PanelProps) {
  const vramPct = ((snap.gpu.memUsed / snap.gpu.memTotal) * 100).toFixed(1);
  return (
    <>
      <div className="vm-detail-header">
        <Gauge value={snap.gpu.usage} className="vm-gauge-lg" />
        <div className="vm-detail-info">
          <div className="vm-detail-name">{snap.gpu.model}</div>
          <div className="vm-detail-stats">
            <Stat value={`${snap.gpu.vram} MB`} label="VRAM" />
            <Stat value={snap.gpu.clockCore} label="Core MHz" />
            <Stat value={snap.gpu.clockMemory} label="Mem MHz" />
            <Stat value={formatTemp(snap.gpu.temp, unit)} label="Temp" />
          </div>
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">GPU Usage — Last 2 Minutes</div>
        <div className="vm-chart">
          <VitalsChart series={[{ label: 'GPU Usage', color: C_GPU, data: hist.gpu }]} yMin={0} />
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">VRAM Usage</div>
        <div className="vm-vram-bar-wrap">
          <div className="ds-prog-track">
            <div className="ds-prog-fill" style={{ width: `${vramPct}%` }} />
          </div>
          <div className="vm-vram-labels">
            <span>{snap.gpu.memUsed} MB used</span>
            <span>{snap.gpu.memTotal} MB total</span>
          </div>
        </div>
      </div>
    </>
  );
}

function RamPanel({ snap, hist }: PanelProps) {
  const swap = snap.ram.swapTotal > 0 ? `${fmtBytes(snap.ram.swapUsed)} / ${fmtBytes(snap.ram.swapTotal)}` : 'None';
  return (
    <>
      <div className="vm-detail-header">
        <Gauge value={snap.ram.percent} className="vm-gauge-lg" />
        <div className="vm-detail-info">
          <div className="vm-detail-name">System Memory</div>
          <div className="vm-detail-stats">
            <Stat value={fmtBytes(snap.ram.used)} label="Used" />
            <Stat value={fmtBytes(snap.ram.available)} label="Available" />
            <Stat value={fmtBytes(snap.ram.total)} label="Total" />
            <Stat value={swap} label="Swap" />
          </div>
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">Memory Usage — Last 2 Minutes</div>
        <div className="vm-chart">
          <VitalsChart series={[{ label: 'Memory', color: C_RAM, data: hist.ram }]} yMin={0} />
        </div>
      </div>
    </>
  );
}

function NetworkPanel({ snap, hist }: PanelProps) {
  return (
    <>
      <div className="vm-detail-header vm-net-header">
        <div className="vm-net-stat-group">
          <div className="vm-net-big-row">
            <NetGlyph size={18} />
            <span className="vm-net-big-val">{snap.net.up.toFixed(1)}</span>
            <span className="vm-net-big-unit">Mbps Upload</span>
          </div>
          <div className="vm-net-big-row">
            <NetGlyph down size={18} />
            <span className="vm-net-big-val">{snap.net.down.toFixed(1)}</span>
            <span className="vm-net-big-unit">Mbps Download</span>
          </div>
        </div>
        <div className="vm-detail-stats">
          <Stat value={snap.net.iface} label="Interface" />
          <Stat value={snap.net.type} label="Type" />
          <Stat value={snap.net.link} label="Link Mbps" />
          <Stat value={snap.net.ip4} label="IPv4" />
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">Network Throughput — Last 2 Minutes</div>
        <div className="vm-chart">
          <VitalsChart
            series={[
              { label: 'Upload', color: C_UP, data: hist.netUp },
              { label: 'Download', color: C_DOWN, data: hist.netDown },
            ]}
            yMin={0}
          />
        </div>
        <div className="vm-chart-legend">
          <span className="vm-legend-item">
            <span className="vm-legend-dot" style={{ background: 'var(--green)' }} />
            Upload
          </span>
          <span className="vm-legend-item">
            <span className="vm-legend-dot" style={{ background: 'var(--cyan)' }} />
            Download
          </span>
        </div>
      </div>
      <div className="vm-chart-section">
        <div className="vm-chart-label">Transfer Totals</div>
        <div className="vm-detail-stats">
          <Stat value={fmtBytes(snap.net.txTotal)} label="Total Sent" />
          <Stat value={fmtBytes(snap.net.rxTotal)} label="Total Received" />
        </div>
      </div>
    </>
  );
}

const DRIVE_COLORS = ['var(--cyan)', 'var(--purple)', 'var(--green)', 'var(--orange)'];

function StoragePanel({ snap, unit }: PanelProps) {
  return (
    <div className="vm-storage-drives">
      {snap.storage.map((d, i) => (
        <div className="vm-drive-card" key={d.name}>
          <div className="vm-drive-header">
            <span className="vm-drive-name">{d.name}</span>
            <Badge variant="status">{d.type}</Badge>
          </div>
          <div className="ds-prog-track">
            <div className="ds-prog-fill" style={{ width: `${d.percent}%`, background: DRIVE_COLORS[i % DRIVE_COLORS.length] }} />
          </div>
          <div className="vm-drive-stats">
            <Stat value={`${d.percent}%`} label="Used" />
            <Stat value={fmtBytes(d.used)} label="Used" />
            <Stat value={fmtBytes(d.available)} label="Available" />
            <Stat value={fmtBytes(d.size)} label="Total" />
            <Stat value={formatTemp(d.temp, unit)} label="Temp" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PanelProps {
  snap: VitalsSnapshot;
  hist: VitalsHistory;
  unit: 'C' | 'F';
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export function VitalsModal({ onClose, initialTab = 'overview' }: { onClose?: () => void; initialTab?: VitalsTab }) {
  const [tab, setTab] = useState<VitalsTab>(initialTab);
  const { snapshot: snap, history: hist } = useVitalsStream(true);
  const { tempUnit } = useSettings();
  const p: PanelProps = { snap, hist, unit: tempUnit };

  return (
    <ModalShell title="System Vitals" onClose={onClose} className="vm-shell">
      <div className="vitals-modal">
        <div className="vm-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'vm-tab' + (tab === t.id ? ' active' : '')}
              type="button"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="vm-tab-spacer" />
          <div className="vm-conn-status" title="Sensor service status">
            <span className="vm-conn-dot" />
            <span className="vm-conn-label">Connected</span>
          </div>
        </div>

        <div className="vm-panel">
          {tab === 'overview' && <OverviewPanel {...p} onTab={setTab} />}
          {tab === 'cpu' && <CpuPanel {...p} />}
          {tab === 'gpu' && <GpuPanel {...p} />}
          {tab === 'ram' && <RamPanel {...p} />}
          {tab === 'network' && <NetworkPanel {...p} />}
          {tab === 'storage' && <StoragePanel {...p} />}
        </div>
      </div>
    </ModalShell>
  );
}

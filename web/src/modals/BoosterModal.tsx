import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ModalShell, Toggle, Button } from '../components';
import { BOOST_GROUPS, BOOST_STATS, type BoostGroup } from './boosterData';
import './feature-modal.css';
import './booster.css';

/** Group-icon accent styling + glyph, keyed by BoostGroup.accent. */
const ACCENT: Record<BoostGroup['accent'], { style: CSSProperties; icon: React.ReactNode }> = {
  cyan: {
    style: { background: 'rgba(0,200,215,0.08)', border: '1px solid rgba(0,200,215,0.18)', color: 'var(--cyan)' },
    icon: (
      <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <polyline points="1,10 3.5,6 6,8 9,3.5 12,1" />
        <line x1="1" y1="12" x2="12" y2="12" />
      </svg>
    ),
  },
  gray: {
    style: { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' },
    icon: (
      <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" />
        <rect x="7" y="1.5" width="4.5" height="4.5" rx="1" />
        <rect x="1.5" y="7" width="4.5" height="4.5" rx="1" />
        <rect x="7" y="7" width="4.5" height="4.5" rx="1" />
      </svg>
    ),
  },
  orange: {
    style: { background: 'rgba(255,107,43,0.07)', border: '1px solid rgba(255,107,43,0.2)', color: 'var(--orange)' },
    icon: (
      <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M6.5 1.5L12 11.5H1L6.5 1.5Z" />
        <line x1="6.5" y1="5.5" x2="6.5" y2="8" />
        <circle cx="6.5" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  purple: {
    style: { background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' },
    icon: (
      <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="1" y="4" width="11" height="7" rx="1.5" />
        <path d="M4 4V3C4 2 5 1.5 6.5 1.5C8 1.5 9 2 9 3V4" />
        <line x1="4" y1="7.5" x2="9" y2="7.5" />
      </svg>
    ),
  },
};

const ADV_BADGE_STYLE: CSSProperties = {
  borderColor: 'rgba(255,107,43,0.25)',
  color: 'var(--orange)',
  background: 'rgba(255,107,43,0.06)',
};

/**
 * Booster modal — ported from vanilla `tpl-boost` + `js/system-cleaner.js`.
 * Left: feature intro + Scan/Boost actions + scan stats; right: collapsible
 * optimization groups with local toggles. State is in-memory (matches vanilla).
 */
export function BoosterModal({ onClose }: { onClose?: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BOOST_GROUPS.map((g) => [g.id, !!g.expanded])),
  );
  const toggleGroup = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <ModalShell title="Booster" className="booster-modal feature-modal" onClose={onClose} left={<BoosterIntro />}>
      {BOOST_GROUPS.map((g) => {
        const accent = ACCENT[g.accent];
        const isOpen = expanded[g.id];
        return (
          <div key={g.id} className={`ds-settings-group${isOpen ? ' expanded' : ''}`}>
            <div
              className="ds-settings-group-header"
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => toggleGroup(g.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleGroup(g.id);
                }
              }}
            >
              <div className="ds-settings-group-icon" style={accent.style}>
                {accent.icon}
              </div>
              <div className="ds-settings-group-titles">
                <div className="ds-settings-group-title">
                  {g.title}
                  {g.note && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> {g.note}</span>}
                </div>
                <div className="ds-settings-group-desc">{g.desc}</div>
              </div>
              <div className="ds-settings-group-meta">
                {g.badge && (
                  <span className="ds-badge status" style={g.accent === 'orange' ? ADV_BADGE_STYLE : undefined}>
                    {g.badge}
                  </span>
                )}
                {g.selectLink && <span className="opt-edit-link">Select All</span>}
                {g.headerToggle && (
                  // stop the toggle click from collapsing the group
                  <span onClick={(e) => e.stopPropagation()}>
                    <RowToggle on aria-label={`${g.title} — enable all`} />
                  </span>
                )}
              </div>
              <svg
                className="ds-settings-group-chevron"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <polyline points="5,3 9,7 5,11" />
              </svg>
            </div>

            <div className="ds-settings-group-items">
              {g.rows.map((row, i) => (
                <div className="ds-settings-row" key={i}>
                  <div className="ds-settings-row-labels">
                    <div className={`ds-settings-row-label${row.muted ? ' bst-muted' : ''}`}>{row.label}</div>
                    {row.sublabel && (
                      <div className={`ds-settings-row-sublabel${row.warn ? ' bst-warn' : ''}`}>{row.sublabel}</div>
                    )}
                  </div>
                  {row.alwaysOn ? (
                    <span className="always-on-badge">Always On</span>
                  ) : (
                    <RowToggle on={!!row.defaultOn} aria-label={row.label} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </ModalShell>
  );
}

/** Toggle with its own local on/off state (matches the vanilla per-row toggles). */
function RowToggle({ on, ...rest }: { on: boolean } & Record<string, unknown>) {
  const [checked, setChecked] = useState(on);
  return <Toggle checked={checked} onChange={setChecked} {...rest} />;
}

/** Left hero/intro panel: hex-bolt icon, description, Scan/Boost actions, stats, benefits/heads-up. */
function BoosterIntro() {
  return (
    <>
      <div className="booster-hero-icon">
        <svg className="booster-icon-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="rgba(34,197,94,0.06)" stroke="rgba(34,197,94,0.25)" strokeWidth="1.5" />
          <polygon points="50,18 78,34 78,66 50,82 22,66 22,34" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
          <circle cx="50" cy="50" r="20" fill="rgba(34,197,94,0.15)" />
          <path d="M55 28L40 52H52L45 72L65 46H53L60 28Z" fill="rgba(34,197,94,0.9)" stroke="rgba(34,197,94,0.4)" strokeWidth="0.5" strokeLinejoin="round" />
          <circle cx="50" cy="8" r="2.5" fill="rgba(34,197,94,0.5)" />
          <circle cx="50" cy="92" r="2.5" fill="rgba(34,197,94,0.5)" />
          <circle cx="88" cy="28" r="2" fill="rgba(34,197,94,0.35)" />
          <circle cx="12" cy="72" r="2" fill="rgba(34,197,94,0.35)" />
        </svg>
      </div>

      <div className="modal-feature-title">Booster</div>
      <div className="modal-feature-desc">
        Optimize your system for peak gaming performance by clearing background tasks, freeing memory, and tuning CPU
        priorities.
      </div>

      <div className="modal-actions">
        <ScanButton />
        <BoostButton />
      </div>

      <div className="ds-stat-grid bst-stat-grid">
        {BOOST_STATS.map((s) => (
          <div className="ds-stat-cell bst-stat-cell" key={s.label}>
            <div className="ds-spark-lbl">{s.label}</div>
            <div className="ds-spark-val" style={s.green ? { color: 'var(--green)' } : undefined}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="uv-info-grid">
        <div className="uv-info-card benefits">
          <div className="uv-info-card-title">✅ Benefits</div>
          <div className="uv-info-item">Reclaim 1–3 GB of RAM for games</div>
          <div className="uv-info-item">Eliminate background CPU drain</div>
          <div className="uv-info-item">Lower input latency during sessions</div>
          <div className="uv-info-item">Faster load times with cleared cache</div>
        </div>
        <div className="uv-info-card risks">
          <div className="uv-info-card-title">🚩 Heads Up</div>
          <div className="uv-info-item">Closed apps won’t be restored</div>
          <div className="uv-info-item">Some services restart automatically</div>
          <div className="uv-info-item">Antivirus toggles reduce protection</div>
          <div className="uv-info-item">Advanced services may affect stability</div>
        </div>
      </div>
    </>
  );
}

/** Scan button: shows "Scanning…" for 1.8s (mirrors vanilla boostScan). */
function ScanButton() {
  const [scanning, setScanning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      size="sm"
      disabled={scanning}
      onClick={() => {
        setScanning(true);
        timer.current = setTimeout(() => setScanning(false), 1800);
      }}
    >
      {scanning ? 'Scanning…' : 'Scan'}
    </Button>
  );
}

/** Boost Now button: "Boosting…" 1.6s → "Boosted ✓" (green) 2.2s → reset (mirrors vanilla boostRun). */
function BoostButton() {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const label = phase === 'running' ? 'Boosting…' : phase === 'done' ? 'Boosted ✓' : 'Boost Now';
  return (
    <Button
      variant="accent"
      size="sm"
      disabled={phase !== 'idle'}
      style={phase === 'done' ? { background: 'rgba(34,197,94,0.3)' } : undefined}
      onClick={() => {
        setPhase('running');
        timers.current.push(
          setTimeout(() => setPhase('done'), 1600),
          setTimeout(() => setPhase('idle'), 1600 + 2200),
        );
      }}
    >
      {label}
    </Button>
  );
}

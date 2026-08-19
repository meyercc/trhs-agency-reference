import { Badge, Button } from '../components';
import { useModules } from '../state/Modules';
import './feature-cards.css';
import './maintenance.css';

// ── Maintenance section ──
// The Perform-page "Maintenance" row, ported from the vanilla `.perf-grid-2`:
// System Cleaner (reclaimable-space stats) + Fan Cleaner (fan-health bar + guide).
// Cards split the container evenly via .feature-card-grid (see feature-cards.css).

// Shared "vacuum / clean" glyph (System Cleaner + Fan Cleaner use the same icon).
const CleanIcon = () => (
  <svg viewBox="0 0 18 22" width="18" height="22" fill="none" aria-hidden="true">
    <path
      d="M1 13L1 19.4C1 19.9601 1 20.2401 1.10899 20.454C1.20487 20.6422 1.35785 20.7951 1.54601 20.891C1.75992 21 2.03995 21 2.6 21L15.4 21C15.9601 21 16.2401 21 16.454 20.891C16.6422 20.7951 16.7951 20.6422 16.891 20.454C17 20.2401 17 19.9601 17 19.4L17 13M1 13L17 13M1 13L1 12.8C1 11.1198 1 10.2798 1.32698 9.63803C1.6146 9.07354 2.07354 8.6146 2.63803 8.32698C3.27976 8 4.11984 8 5.8 8L12.2 8C13.8802 8 14.7202 8 15.362 8.32698C15.9265 8.6146 16.3854 9.07354 16.673 9.63803C17 10.2798 17 11.1198 17 12.8L17 13M6.5 8L6.5 3.5C6.5 2.11929 7.61929 0.999999 9 0.999999C10.3807 0.999999 11.5 2.11929 11.5 3.5L11.5 8"
      stroke="var(--accent-color)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface MaintenanceProps {
  /** open the System Cleaner modal (no-op until ported) */
  onOpenCleaner?: () => void;
  /** open the Fan Cleaner guide (no-op until ported) */
  onOpenFanGuide?: () => void;
}

export function Maintenance({ onOpenCleaner, onOpenFanGuide }: MaintenanceProps) {
  const { has } = useModules();
  return (
    <div className="feature-card-grid">
      {/* System Cleaner */}
      {has('cleaner') && (
      <div className="ds-feature-card" onClick={onOpenCleaner} role="button" tabIndex={0}>
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <CleanIcon />
          </div>
          <Badge variant="status">Ready</Badge>
        </div>
        <div className="ds-feature-card-title">System Cleaner</div>
        <div className="cleaner-stat-row">
          <span className="cleaner-stat-key">Found</span>
          <span className="cleaner-stat-val highlight">7.04 GB</span>
        </div>
        <div className="cleaner-stat-row">
          <span className="cleaner-stat-key">Temp files</span>
          <span className="cleaner-stat-val">2.1 GB</span>
        </div>
        <div className="cleaner-stat-row">
          <span className="cleaner-stat-key">Last cleaned</span>
          <span className="cleaner-stat-val">3 days ago</span>
        </div>
        <div className="ds-feature-card-footer">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCleaner?.();
            }}
          >
            View &amp; Clean
          </Button>
        </div>
      </div>
      )}

      {/* Fan Cleaner */}
      {has('fancleaner') && (
      <div className="ds-feature-card" onClick={onOpenFanGuide} role="button" tabIndex={0}>
        <div className="ds-feature-card-header">
          <div className="ds-feature-card-icon">
            <CleanIcon />
          </div>
          <Badge variant="status">Good</Badge>
        </div>
        <div className="ds-feature-card-title">Fan Cleaner</div>
        <div className="ds-feature-card-sub" style={{ marginBottom: 8 }}>
          Fan health and dust removal guide
        </div>
        <div className="fan-health-bar">
          <div className="fan-health-fill" style={{ width: '82%' }} />
        </div>
        <div className="fan-health-row">
          <span className="fan-health-pct">82%</span>
          <span className="fan-health-label">Fan health</span>
        </div>
        <div className="cleaner-stat-row" style={{ marginTop: 6 }}>
          <span className="cleaner-stat-key">Last cleaned</span>
          <span className="cleaner-stat-val">45 days ago</span>
        </div>
        <div className="ds-feature-card-footer">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFanGuide?.();
            }}
          >
            View Guide
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

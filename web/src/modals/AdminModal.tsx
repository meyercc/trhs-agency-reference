import { ModalShell, Icon, Button } from '../components';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../state/Settings';
import { useDeviceSim, SIM_DEVICE_IDS } from '../state/DeviceSim';
import './admin-modal.css';

/**
 * Admin & testing tools (`?modal=admin`), opened from the Admin submenu in the
 * profile dropdown. Each tool drops in as an `.admin-tool` row.
 */
export function AdminModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { persona, onboarded, setPersona, setOnboarded } = useSettings();
  const { hudOpen, setHudOpen, simState } = useDeviceSim();
  const awayCount = SIM_DEVICE_IDS.filter((id) => !simState(id).connected).length;

  const launch = () => {
    onClose();
    navigate('/onboarding');
  };
  const reset = () => {
    setPersona('');
    setOnboarded(false);
    // Drop the onboarding-seeded dashboard so a re-run starts from scratch.
    try {
      localStorage.removeItem('board-layout');
    } catch { /* ignore */ }
  };

  return (
    <ModalShell title="Admin Settings" className="admin-modal" onClose={onClose}>
      <div className="admin-group">
        <div className="admin-group-label">Testing tools</div>
        <div className="admin-tool">
          <span className="admin-tool-ic"><Icon name="devices" size={18} /></span>
          <div className="admin-tool-meta">
            <div className="admin-tool-name">First-boot onboarding</div>
            <div className="admin-tool-desc">
              Run the full first-run flow — welcome, consent, HP ID, the intent fork, persona,
              module selection, and the dashboard build.
            </div>
            <div className="admin-tool-status">
              {onboarded ? (
                <>Onboarded · persona <b>{persona || '—'}</b></>
              ) : (
                'Not onboarded yet'
              )}
            </div>
          </div>
          <div className="admin-tool-actions">
            <Button size="sm" variant="accent" onClick={launch}>Launch</Button>
            {onboarded && (
              <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
            )}
          </div>
        </div>

        <div className="admin-tool">
          <span className="admin-tool-ic"><Icon name="devices" size={18} /></span>
          <div className="admin-tool-meta">
            <div className="admin-tool-name">Device simulator</div>
            <div className="admin-tool-desc">
              Play the hardware's side of the onboard-profile model: press a device's physical
              profile button, unplug it, switch slots while it's away, and plug it back in to
              watch the app reconcile what the device reports against what the profile wants.
            </div>
            <div className="admin-tool-status">
              {hudOpen ? 'Simulator shown' : 'Simulator hidden'}
              {awayCount > 0 && <> · {awayCount} device{awayCount > 1 ? 's' : ''} away</>}
            </div>
          </div>
          <div className="admin-tool-actions">
            {hudOpen ? (
              <Button size="sm" variant="ghost" onClick={() => setHudOpen(false)}>Hide</Button>
            ) : (
              // Close the modal on show — the whole point is watching the app
              // (usually an open device canvas) react while you press buttons.
              <Button size="sm" variant="accent" onClick={() => { setHudOpen(true); onClose(); }}>
                Show
              </Button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

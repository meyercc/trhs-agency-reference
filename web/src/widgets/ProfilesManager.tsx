import { useSearchParams } from 'react-router-dom';
import { Button, Icon } from '../components';
import { useProfiles, type Profile } from '../state/Profiles';
import { ProfileAvatar } from './ProfileAvatar';
import './profiles-manager.css';

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

/**
 * What makes this profile turn on, in one line.
 *
 * A profile with no triggers is not broken — it's a manual one — so it says so
 * rather than showing an empty slot.
 */
function triggerSummary(p: Profile): string {
  const bits: string[] = [];
  if (p.schedule.enabled && p.schedule.days.length) {
    const days = [...p.schedule.days].sort().map((d) => DAY_INITIALS[d]).join('');
    bits.push(`${days} · ${clock(p.schedule.start)}–${clock(p.schedule.end)}`);
  }
  if (p.gameLink.enabled && p.gameLink.gameIds.length) {
    bits.push(`${p.gameLink.gameIds.length} game${p.gameLink.gameIds.length === 1 ? '' : 's'}`);
  }
  return bits.length ? bits.join('  ·  ') : 'Manual only';
}

/** How many app settings this profile takes over. */
function overrideSummary(p: Profile): string {
  const n = Object.keys(p.overrides).length;
  return n === 0 ? 'Uses app appearance' : `Overrides ${n} app setting${n === 1 ? '' : 's'}`;
}

/**
 * In-page profile management (Personalize → Profiles), following the
 * ModulesManager pattern: the full list with an activate action and a shortcut
 * into the Profiles modal, which owns the actual editing.
 */
export function ProfilesManager() {
  const { profiles, activeId, selectProfile } = useProfiles();
  const [, setParams] = useSearchParams();

  const openModal = () =>
    setParams((prev) => {
      // Preserve whatever else is in the URL (e.g. the devices flyout).
      const p = new URLSearchParams(prev);
      p.set('modal', 'profiles');
      return p;
    });

  return (
    <div className="pmg">
      <div className="pmg-head">
        <span className="pmg-count">
          {profiles.length} profile{profiles.length === 1 ? '' : 's'}
        </span>
        <Button size="sm" onClick={openModal}>
          Manage profiles
        </Button>
      </div>
      <div className="pmg-grid">
        {profiles.map((p) => {
          const active = p.id === activeId;
          return (
            // A plain container with local chrome, like ModuleCard — the `Card`
            // component is the product card (art/price/badge), not this job.
            <div key={p.id} className={'pmg-card' + (active ? ' is-active' : '')}>
              <div className="pmg-card-head">
                <ProfileAvatar profile={p} />
                <span className="pmg-name">{p.name}</span>
                {/* Text, not just the accent border — state is never color alone. */}
                {active && (
                  <span className="pmg-badge">
                    <Icon name="check" size={12} aria-hidden /> Active
                  </span>
                )}
              </div>
              <div className="pmg-meta">{triggerSummary(p)}</div>
              <div className="pmg-meta pmg-meta-dim">{overrideSummary(p)}</div>
              <div className="pmg-actions">
                {!active && (
                  <Button size="sm" variant="ghost" onClick={() => selectProfile(p.id)}>
                    Activate
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={openModal}>
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

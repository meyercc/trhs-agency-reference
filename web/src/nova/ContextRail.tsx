import { forwardRef, type KeyboardEvent } from 'react';
import { Badge, Chip, WidgetShell } from '../components';
import { ProfileAvatar } from '../widgets/ProfileAvatar';
import { deviceCardModel } from '../widgets/DeviceCard';
import { deskDeviceIds } from '../devices/connectedDevices';
import { useProfiles } from '../state/Profiles';
import { useSettings } from '../state/Settings';
import { useDeviceSim } from '../state/DeviceSim';
import { useNova } from '../state/Nova';
import { JUNE_HIDDEN_PILLS, PILLS, TOPICS } from './scripts';
import { ModelAgentSelects } from './ModelAgentSelects';

/** How the active profile came to be — the same wording the switcher uses. */
const SOURCE_NOTE: Record<string, string> = {
  manual: 'Chosen by you',
  schedule: 'Switched on schedule',
  game: 'Switched by a game',
};

/**
 * What Nova takes into account: the active profile, the devices on the desk
 * and whether each is plugged in, and the topics it can walk you into. All
 * live — a scripted "Switch to Gaming" shows up here the moment it happens.
 */
export interface RailDrawerProps {
  /** Open as a drawer (only meaningful at widths where the rail is one — nova.css). */
  open?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  id?: string;
}

export const ContextRail = forwardRef<HTMLElement, RailDrawerProps>(function ContextRail({ open, onKeyDown, id }, ref) {
  const { activeProfile, source } = useProfiles();
  const { deskDevices, mvpScope } = useSettings();
  // June 2027 offers no prompt for a feature it leaves out (JUNE_OUT_OF_SCOPE).
  const pills = mvpScope === 'june27' ? PILLS.filter((p) => !JUNE_HIDDEN_PILLS.has(p.id)) : PILLS;
  const { simState } = useDeviceSim();
  const { send, busy } = useNova();

  const devices = deskDeviceIds(deskDevices)
    .map((id) => ({ id, model: deviceCardModel(id), connected: simState(id).connected }))
    .filter((d) => d.model);
  const online = devices.filter((d) => d.connected).length;

  return (
    <aside className={'nova-rail nova-rail-context' + (open ? ' open' : '')} aria-label="Treehouse context" id={id} ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <h2 className="nova-rail-title">Treehouse context</h2>
      {/* Who answers and on what — first, because it changes every reply
          (moved here from under the composer, 2026-10-20). */}
      <WidgetShell title="Talking to">
        <ModelAgentSelects className="nova-ctx-selects" />
      </WidgetShell>
      <WidgetShell title="Current profile">
        <div className="nova-ctx-profile">
          <ProfileAvatar profile={activeProfile} size={28} />
          <div>
            <div className="nova-ctx-value nova-profile-name">{activeProfile.name}</div>
            <div className="nova-ctx-note">{SOURCE_NOTE[source] ?? 'Active'}</div>
          </div>
        </div>
      </WidgetShell>
      <WidgetShell title="Connected">
        <div className="nova-ctx-value">
          {online} of {devices.length} devices
        </div>
        <ul className="nova-ctx-devices" role="list">
          {devices.map((d) => (
            <li key={d.id}>
              <span>{d.model!.name}</span>
              <Badge variant="status" tone={d.connected ? 'positive' : 'neutral'}>
                {d.connected ? 'Connected' : 'Away'}
              </Badge>
            </li>
          ))}
        </ul>
      </WidgetShell>
      <WidgetShell title="Can help with">
        <div className="nova-topics">
          {/* The areas, then the quick prompts — always here, while the log only
              offers the prompts on an empty conversation (2026-10-20). */}
          {[...TOPICS, ...pills].map((t) => (
            <Chip key={t.id} onClick={() => send(t.label!, { scriptId: t.id })} disabled={busy}>
              {t.label}
            </Chip>
          ))}
        </div>
      </WidgetShell>
    </aside>
  );
});

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContextMenu, ContextMenuLabel, Icon, ListItem, Separator } from '../components';
import { useProfiles } from '../state/Profiles';
import { ProfileAvatar } from '../widgets/ProfileAvatar';

/** Why the active profile is active, said plainly. Manual needs no explanation. */
const SOURCE_NOTE: Record<string, string> = {
  schedule: 'Switched on schedule',
  game: 'Switched by a game',
};

/**
 * The software-profile switcher in the top-right of the nav, immediately left
 * of the account avatar.
 *
 * Distinct from `AccountMenu`, which is the signed-in ACCOUNT. This is the
 * app's current mode — Gaming, Work, Music — and it is a switch, not a menu of
 * actions: picking a row changes what the whole app is doing.
 *
 * The dot carries the profile's identity color, but selection is never color
 * alone — the active row also takes a check, and the trigger shows the name.
 */
export function ProfileSwitcher() {
  const { profiles, activeProfile, source, selectProfile } = useProfiles();
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const wrap = useRef<HTMLDivElement>(null);

  const openManage = () => {
    setOpen(false);
    const p = new URLSearchParams(params);
    p.set('modal', 'profiles');
    setParams(p);
  };

  // Same dismissal contract as AccountMenu: outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const note = SOURCE_NOTE[source];

  return (
    <div className="profile-switcher-wrap" ref={wrap}>
      <button
        type="button"
        className={'profile-switcher-btn' + (open ? ' active' : '')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Profile: ${activeProfile.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <ProfileAvatar profile={activeProfile} />
        <span className="ps-name">{activeProfile.name}</span>
        <Icon name="chevron-down" size={13} aria-hidden />
      </button>

      {open && (
        <ContextMenu className="profile-switcher-menu" aria-label="Profiles">
          <ContextMenuLabel>Profile</ContextMenuLabel>
          {profiles.map((p) => {
            const active = p.id === activeProfile.id;
            return (
              <ListItem
                key={p.id}
                label={p.name}
                role="menuitemradio"
                aria-checked={active}
                leading={<ProfileAvatar profile={p} />}
                // A check, not just the photo — selection must survive being
                // read without it.
                trailing={active ? <Icon name="check" size={14} /> : undefined}
                onClick={() => {
                  selectProfile(p.id);
                  setOpen(false);
                }}
              />
            );
          })}
          {/* Says how the app got here when it wasn't the user's own doing. A
              profile that changed itself is otherwise indistinguishable from
              one you picked, which is how automation starts feeling haunted. */}
          {note && <div className="ps-note">{note}</div>}
          <Separator />
          <ListItem label="Manage Profiles" leading={<Icon name="settings" size={14} />} onClick={openManage} />
        </ContextMenu>
      )}
    </div>
  );
}

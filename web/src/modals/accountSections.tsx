// ── Settings › Account ───────────────────────────────────────────────────────
// Who you are in Treehouse: Profile (avatar, name) and Linked accounts. These
// are the Account group of the one Settings modal; the App group (Appearance,
// Navigation, Setup) sits under them. Modes are not here — they belong to the
// desk and live in Personalize. Performance and device status belong to
// Perform and Devices.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Icon, IconButton, Input, type IconName } from '../components';
import { useSettings, type LinkedAccount } from '../state/Settings';
import { useProfiles } from '../state/Profiles';
import { downscale, putImage, useStoredImage } from '../state/imageStore';
import { AVATAR_PRESETS, CUSTOM_WALLPAPER_ID, wallpaperImage } from '../app/wallpapers';
import { useAvatarSrc } from '../app/UserAvatar';
import { SettingsRow } from './settingsParts';
import './account-sections.css';

const PLATFORMS: { id: string; name: string; icon: IconName }[] = [
  { id: 'steam', name: 'Steam', icon: 'platform-steam' },
  { id: 'discord', name: 'Discord', icon: 'platform-discord' },
  { id: 'riot', name: 'Riot Games', icon: 'platform-riot' },
  { id: 'xbox', name: 'Xbox', icon: 'platform-xbox' },
];

// ── Profile: avatar + name ───────────────────────────────────────────────────
export function ProfileSection({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const { profiles } = useProfiles();
  const navigate = useNavigate();
  const src = useAvatarSrc();
  const upload = useStoredImage('avatar');
  const wpUpload = useStoredImage('wallpaper');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const wallpaperThumb = s.wallpaper === CUSTOM_WALLPAPER_ID ? wpUpload : wallpaperImage(s.wallpaper, s.isLight);

  const onUpload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await putImage('avatar', await downscale(file, 512, true));
      s.setAvatar({ kind: 'upload' });
    } finally {
      setBusy(false);
    }
  };

  const choice = s.avatar;
  const option = (key: string, selected: boolean, label: string, img: string | undefined, onPick: () => void) => (
    <button key={key} type="button" className="pf-avatar-opt" aria-pressed={selected} aria-label={label} onClick={onPick}>
      <Avatar variant="custom" src={img} alt="" size={48} />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <div className="pf-hero">
        <Avatar variant="custom" src={src} alt="" size={96} />
        <div className="pf-hero-text">
          <NameEditor name={s.displayName} onSave={s.setDisplayName} />
          <div className="ds-settings-row-sublabel">This is how you appear across Treehouse. It doesn’t have to be your real name.</div>
        </div>
      </div>

      <div className="stx-block pf-block">
        <div className="stx-preview-label">Avatar</div>
        <div className="pf-avatars" role="group" aria-label="Avatar">
          {AVATAR_PRESETS.map((p) =>
            option(p.id, choice.kind === 'preset' && choice.id === p.id, p.name, p.img, () => s.setAvatar({ kind: 'preset', id: p.id })),
          )}
          {option('wallpaper', choice.kind === 'wallpaper', 'Wallpaper', wallpaperThumb, () => s.setAvatar({ kind: 'wallpaper' }))}
          {upload && option('upload', choice.kind === 'upload', 'Your photo', upload, () => s.setAvatar({ kind: 'upload' }))}
          <button type="button" className="pf-avatar-opt pf-avatar-upload" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span className="pf-avatar-upload-ring">
              <Icon name="image-upload" size="md" />
            </span>
            <span>{busy ? 'Adding…' : upload ? 'Replace' : 'Upload'}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              onUpload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="ds-settings-row-sublabel">Photos are cropped to a circle and stay in this browser.</div>
      </div>

      {/* Profiles aren't account settings; they have their own editor. Mode was
          retired into Profile, and the Modes modal this row used to open is gone. */}
      <SettingsRow
        label="Your profiles"
        sublabel={`${profiles.length} profile${profiles.length === 1 ? '' : 's'} · what each one changes, and when it turns on`}
        control={
          <Button
            size="sm"
            onClick={() => {
              onClose();
              navigate('/personalize?modal=profiles');
            }}
          >
            Manage profiles
          </Button>
        }
      />
    </>
  );
}

/** The name, edited in place: pencil (or the name itself) opens the field;
 *  Enter or Save keeps it, Esc or Cancel puts it back, an empty name is refused. */
function NameEditor({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const open = () => {
    setDraft(name);
    setEditing(true);
  };
  const save = () => {
    if (!trimmed) return;
    onSave(trimmed);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="pf-name-row">
        <button type="button" className="pf-name-display ds-text-title-3" onClick={open} aria-label={`Display name: ${name}. Edit`}>
          {name}
        </button>
        <IconButton label="Edit display name" variant="ghost" onClick={open}>
          <Icon name="edit" size="sm" />
        </IconButton>
      </div>
    );
  }
  return (
    <form
      className="pf-name-row"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input
        autoFocus
        aria-label="Display name"
        value={draft}
        maxLength={32}
        wrapClassName="pf-name"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation(); // don't close the whole modal
            cancel();
          }
        }}
        error={trimmed ? undefined : 'Your name can’t be empty'}
      />
      <Button type="submit" size="sm" variant="accent" disabled={!trimmed}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={cancel}>
        Cancel
      </Button>
    </form>
  );
}

// ── Accounts ─────────────────────────────────────────────────────────────────
export function AccountsSection() {
  const s = useSettings();
  const setLinked = (id: string, account?: LinkedAccount) => {
    const next = { ...s.linkedAccounts };
    if (account) next[id] = account;
    else delete next[id];
    s.setLinkedAccounts(next);
  };
  return (
    <>
      {PLATFORMS.map((pl) => {
        const linked = s.linkedAccounts[pl.id];
        return (
          <div key={pl.id} className="ds-settings-row">
            <span className="pf-platform" aria-hidden>
              <Icon name={pl.icon} size="lg" />
            </span>
            <div className="ds-settings-row-labels">
              <div className="ds-settings-row-label">{pl.name}</div>
              <div className="ds-settings-row-sublabel">{linked ? `Linked as ${linked.handle}` : 'Not linked'}</div>
            </div>
            {linked ? (
              <Button size="sm" variant="ghost" onClick={() => setLinked(pl.id)}>
                Unlink
              </Button>
            ) : (
              <Button size="sm" onClick={() => setLinked(pl.id, { handle: s.displayName })}>
                Link
              </Button>
            )}
          </div>
        );
      })}
      <div className="pf-footnote ds-settings-row-sublabel">
        Treehouse only shows which accounts are linked, to find your games and friends. Prototype: nothing leaves this
        browser.
      </div>
    </>
  );
}

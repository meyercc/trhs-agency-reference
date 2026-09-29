import { useRef, useState } from 'react';
import {
  Button, Checkbox, Chip, GameTile, Icon, Input, ListItem, ModalShell, Ng3Label, Ng3Section, Separator, Slider, Swatch, Toggle,
} from '../components';
import { useProfiles, type Profile } from '../state/Profiles';
import { useSettings } from '../state/Settings';
import { WALLPAPERS } from '../app/wallpapers';
import { ProfileAvatar } from '../widgets/ProfileAvatar';
import { WALLPAPER_IMAGE_PREFIX, fileToProfilePhoto, profileImageSrc, profileWallpaperId } from '../app/profileImage';
// INITIAL_GAMES, not SUPPORTED_GAMES: a link is keyed by a stable game id and
// only this list carries one.
import { INITIAL_GAMES, type AiGame } from './omenAiGames';
import { gameArt } from '../widgets/gameArt';
import { getResolvedSku } from '../devices/skus';
import { deviceTabs } from '../devices/deviceTabs';
import { TYPE_ICON } from '../devices/specSchema';
import type { LightPreset } from '../devices/lightingData';
import '../widgets/widgets.css'; // wp-thumb / wg-swatch — same controls as Settings
import './settings-modal.css'; // the shared .stx-modal sectioned-settings chrome
import './profiles-modal.css';

/** Accent ids offered as an accent override. */
const ACCENTS = ['cyan', 'indigo', 'purple', 'orange', 'green', 'red', 'yellow'];

/** 0 = Sunday, matching Date.getDay() and the Schedule model. */
const DAYS = [
  { i: 1, label: 'Mon' }, { i: 2, label: 'Tue' }, { i: 3, label: 'Wed' }, { i: 4, label: 'Thu' },
  { i: 5, label: 'Fri' }, { i: 6, label: 'Sat' }, { i: 0, label: 'Sun' },
];

const pad = (n: number) => String(n).padStart(2, '0');
/** Minutes from midnight → the `HH:MM` an <input type="time"> wants. */
const toTimeValue = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
const fromTimeValue = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
};

/** `lighting.brightness` → `Brightness`. The key's last segment is its name. */
const humanize = (key: string) => {
  const last = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
};

/**
 * Captured values are whatever a tab chose to store, so render defensively:
 * a bare `String(v)` on an object prints "[object Object]" in the manifest.
 */
const renderValue = (v: unknown, unit = 'key'): string => {
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  if (v == null) return '—';
  if (typeof v === 'number') return v.toLocaleString();
  if (Array.isArray(v)) return v.join(', ');
  // A per-key record (painted colors, assignments) is summarized by its size —
  // the device itself is where you look at which ones.
  if (typeof v === 'object') {
    const n = Object.keys(v as object).length;
    return `${n} ${unit}${n === 1 ? '' : 's'}`;
  }
  return String(v);
};

/** Labels where the key's last segment reads badly on its own. */
const LABELS: Record<string, string> = {
  'keys.binds': 'Assignments',
  'buttons.binds': 'Assignments',
  'lighting.keyColors': 'Key colors',
};
/** Values that are ids of something with a name, and records counted in the device's own unit. */
const renderNamed = (key: string, v: unknown, lightPresets: LightPreset[]): string => {
  if (key === 'lighting.preset') return lightPresets.find((p) => p.id === v)?.name ?? renderValue(v);
  return renderValue(v, key.startsWith('buttons.') ? 'button' : 'key');
};

/** A captured value that IS a color gets shown as one, not just named. */
const isColor = (v: unknown): v is string =>
  typeof v === 'string' && (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^(rgb|hsl)a?\(/.test(v) || v.startsWith('var(--'));

/** One label/sublabel + control row. Mirrors SettingsModal's row. */
function Row({ label, sublabel, control }: { label: string; sublabel: string; control: React.ReactNode }) {
  return (
    <div className="ds-settings-row">
      <div className="ds-settings-row-labels">
        <div className="ds-settings-row-label">{label}</div>
        <div className="ds-settings-row-sublabel">{sublabel}</div>
      </div>
      {control}
    </div>
  );
}

function GroupTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ds-settings-group-header stx-static">
      <div className="ds-settings-group-titles">
        <div className="stx-group-title">{children}</div>
      </div>
      {action}
    </div>
  );
}

/**
 * "Use app setting" — the way out of an override.
 *
 * Without it an override is a one-way door: once a profile claims a key there
 * is no gesture that hands it back, and the Settings baseline becomes
 * permanently unreachable for that key while the profile is active.
 */
function ClearOverride({ on, onClear }: { on: boolean; onClear: () => void }) {
  if (!on) return null;
  return (
    <button type="button" className="pfm-clear" onClick={onClear}>
      Use app setting
    </button>
  );
}

/**
 * The read-only manifest of what this profile has captured, per device.
 *
 * Derived, never authored: one card per device that has captured anything, one
 * group per device tab. Captured keys are namespaced by their tab
 * (`lighting.brightness`), so the prefix IS the grouping — a device that grows
 * a tab gets a group here for free, and one that loses a tab stops showing it.
 *
 * Nothing is editable here on purpose. These values are set where they live —
 * in the device panel, with the profile active — so this view stays a record
 * of what was captured rather than a second place to change it.
 */
function ProfileDetails({ profile }: { profile: Profile }) {
  const devices = Object.entries(profile.devices).filter(([, bag]) => Object.keys(bag ?? {}).length > 0);
  // The lighting preset library is a Settings list now, so a user-made preset
  // shows its name here the same as a factory one.
  const { lightPresets } = useSettings();

  if (devices.length === 0) {
    return (
      <p className="pfm-empty">
        Nothing captured yet. Open a device from the Devices panel while <strong>{profile.name}</strong> is
        active — what you change there is saved to this profile.
      </p>
    );
  }

  return (
    <div className="pfm-manifest">
      {devices.map(([skuId, bag]) => {
        const sku = getResolvedSku(skuId);
        const tabs = sku ? deviceTabs(sku) : [];
        // Group by the key's tab prefix, preserving the panel's own tab order.
        const groups = new Map<string, [string, unknown][]>();
        Object.entries(bag).forEach(([key, value]) => {
          const tabId = key.includes('.') ? key.slice(0, key.indexOf('.')) : 'other';
          groups.set(tabId, [...(groups.get(tabId) ?? []), [key, value]]);
        });
        const ordered = [...groups.entries()].sort(
          (a, b) => tabs.findIndex((t) => t.id === a[0]) - tabs.findIndex((t) => t.id === b[0]),
        );
        // The device card is the Ng3 section surface — the same card a device
        // panel is built from, so a device's settings look the same here as
        // where they were set. One sunken sub-card per tab inside it.
        return (
          <Ng3Section as="section" key={skuId} className="pfm-device" aria-label={sku?.name ?? skuId}>
            <h4 className="pfm-device-head">
              <Icon name={(sku && TYPE_ICON[sku.type]) ?? 'devices'} size={20} aria-hidden />
              <Ng3Label strong>{sku?.name ?? skuId}</Ng3Label>
            </h4>
            <div className="pfm-device-groups">
              {ordered.map(([tabId, rows]) => {
                const tab = tabs.find((t) => t.id === tabId);
                return (
                  <div key={tabId} className="pfm-group">
                    <div className="pfm-group-head">
                      <span className="pfm-group-title">
                        {tab && <Icon name={tab.icon} size={14} aria-hidden />}
                        <Ng3Label strong>{tab?.title ?? humanize(tabId)}</Ng3Label>
                      </span>
                    </div>
                    <Separator />
                    <dl className="pfm-rows">
                      {rows.map(([key, value]) => (
                        <div key={key} className="pfm-row">
                          {isColor(value) && <span className="ps-dot" style={{ background: value }} aria-hidden />}
                          <dt>{LABELS[key] ?? humanize(key)}</dt>
                          <dd>{renderNamed(key, value, lightPresets)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </Ng3Section>
        );
      })}
    </div>
  );
}

/**
 * Profiles editor (`?modal=profiles`) on the sectioned modal pattern — the
 * profile list in ModalShell's left slot, the selected profile's settings on
 * the right.
 *
 * The list selection is LOCAL, not the active profile: you edit a profile
 * without switching to it, and activate deliberately from the footer. Editing
 * and switching are different acts, and conflating them means you can't touch
 * the Work profile at 9pm without the desk changing color.
 */
export function ProfilesModal({ onClose }: { onClose: () => void }) {
  const {
    profiles, activeId, createProfile, updateProfile, deleteProfile, selectProfile, setOverride,
    exportProfiles, importProfiles,
  } = useProfiles();
  const { getBaseline, isLight } = useSettings();

  const [editingId, setEditingId] = useState(activeId);
  const [showDetails, setShowDetails] = useState(false);
  const [pickingGames, setPickingGames] = useState(false);
  const profile = profiles.find((p) => p.id === editingId) ?? profiles[0];
  const isActive = profile.id === activeId;

  // Overrides resolve against the baseline for display: an unset key shows what
  // the app would use, so the control never sits empty or lies about the value.
  const ov = profile.overrides;
  const shown = <T,>(name: 'accent' | 'wallpaper' | 'wpBlur' | 'wpOpacity'): T =>
    (name in ov ? ov[name] : getBaseline(name)) as T;

  const addProfile = () => setEditingId(createProfile('New Profile'));

  // The photo uploader: the same hidden-input pattern as Import Profiles below.
  // An upload is reduced to a small square before it is stored, so the profile
  // record (localStorage) stays light and the picture is exactly what the 24px
  // avatar shows.
  const photoInput = useRef<HTMLInputElement>(null);
  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      updateProfile(profile.id, { image: await fileToProfilePhoto(file) });
    } catch {
      note("That file isn't a picture this browser can read");
    }
  };

  // ── Export / import ─────────────────────────────────────────────────────
  // A word of feedback under the buttons, because a file download and a file
  // picker are both things that happen off-screen. It retires on its own.
  const [fileNote, setFileNote] = useState<string | null>(null);
  const noteTimer = useRef<number>();
  const note = (text: string) => {
    setFileNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setFileNote(null), 4000);
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const exportAll = () => {
    const blob = new Blob([exportProfiles()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyperx-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    note(`${profiles.length} profile${profiles.length === 1 ? '' : 's'} exported`);
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const ids = importProfiles(await file.text());
    if (!ids) return note("That isn't a profiles file");
    // Land on the first imported profile so what just arrived is on screen —
    // editing it, not activating it, same as picking it from the list.
    if (ids[0]) setEditingId(ids[0]);
    note(`${ids.length} profile${ids.length === 1 ? '' : 's'} imported`);
  };

  const patchSchedule = (p: Partial<Profile['schedule']>) =>
    updateProfile(profile.id, { schedule: { ...profile.schedule, ...p } });
  const patchGameLink = (p: Partial<Profile['gameLink']>) =>
    updateProfile(profile.id, { gameLink: { ...profile.gameLink, ...p } });

  const toggleDay = (i: number) => {
    const days = profile.schedule.days.includes(i)
      ? profile.schedule.days.filter((d) => d !== i)
      : [...profile.schedule.days, i].sort();
    patchSchedule({ days });
  };
  const toggleGame = (id: string) => {
    const gameIds = profile.gameLink.gameIds.includes(id)
      ? profile.gameLink.gameIds.filter((g) => g !== id)
      : [...profile.gameLink.gameIds, id];
    patchGameLink({ gameIds });
  };

  const linked = INITIAL_GAMES.filter((g: AiGame) => profile.gameLink.gameIds.includes(g.id));

  const nav = (
    <div className="pfm-nav">
      <Button variant="ghost" className="pfm-new" onClick={addProfile}>
        <Icon name="add" size={14} aria-hidden /> New Profile
      </Button>
      <nav className="ds-modal-nav" aria-label="Profiles">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className={'ds-modal-nav-item' + (p.id === editingId ? ' active' : '')}
            aria-current={p.id === editingId}
            onClick={() => setEditingId(p.id)}
          >
            <ProfileAvatar profile={p} />
            <span className="pfm-nav-name">{p.name}</span>
            {p.id === activeId && <span className="pfm-nav-badge">Active</span>}
          </button>
        ))}
      </nav>
      {/* Pinned to the rail's foot: whole-collection actions, apart from the list they act on. */}
      <div className="pfm-nav-actions">
        <div className="pfm-nav-status" role="status" aria-live="polite">
          {fileNote}
        </div>
        <Separator />
        <Button variant="accent" block onClick={exportAll}>
          <Icon name="export" size={14} aria-hidden /> Export All Profiles
        </Button>
        <Button variant="default" block onClick={() => fileInput.current?.click()}>
          <Icon name="import" size={14} aria-hidden /> Import Profiles
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Choose a profiles file"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );

  const footer = (
    <div className="pfm-footer">
      <Button
        variant="ghost"
        className="pfm-delete"
        disabled={profiles.length <= 1}
        onClick={() => {
          const next = profiles.find((p) => p.id !== profile.id);
          deleteProfile(profile.id);
          if (next) setEditingId(next.id);
        }}
      >
        <Icon name="trash" size={14} aria-hidden /> Delete
      </Button>
      {isActive ? (
        <span className="pfm-active-note">
          <Icon name="check" size={14} aria-hidden /> Active now
        </span>
      ) : (
        <Button variant="accent" onClick={() => selectProfile(profile.id)}>
          Activate
        </Button>
      )}
    </div>
  );

  return (
    <ModalShell title="Profiles" className="stx-modal profiles-modal" onClose={onClose} left={nav} footer={footer}>
      <p className="pfm-lede">Settings a profile takes over are applied whenever it becomes active.</p>

      {/* ── Identity ───────────────────────────────────────────────────── */}
      <div className="ds-settings-group expanded">
        <GroupTitle>Profile</GroupTitle>
        <div className="ds-settings-group-items">
          <Row
            label="Name"
            sublabel="What this profile is called everywhere in the app"
            control={
              <Input
                value={profile.name}
                aria-label="Profile name"
                onChange={(e) => updateProfile(profile.id, { name: e.target.value })}
              />
            }
          />
          <Row
            label="Photo"
            sublabel="Identifies this profile beside its name — a wallpaper, or a picture of your own"
            control={
              <div className="pfm-photo">
                <ProfileAvatar profile={profile} size={40} />
                <div className="wg-swatch-row" role="group" aria-label="Profile photo">
                  {WALLPAPERS.map((wp) => (
                    <Swatch
                      key={wp.id}
                      image={profileImageSrc(WALLPAPER_IMAGE_PREFIX + wp.id, isLight)}
                      label={wp.name}
                      size={22}
                      selected={profileWallpaperId(profile.image) === wp.id}
                      onClick={() => updateProfile(profile.id, { image: WALLPAPER_IMAGE_PREFIX + wp.id })}
                    />
                  ))}
                </div>
                <Button size="sm" onClick={() => photoInput.current?.click()}>
                  <Icon name="image-upload" size={14} aria-hidden /> Upload photo
                </Button>
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label="Choose a profile photo"
                  onChange={(e) => {
                    void uploadPhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            }
          />
        </div>
      </div>

      {/* ── Appearance overrides ───────────────────────────────────────── */}
      <div className="ds-settings-group expanded">
        <GroupTitle>Appearance</GroupTitle>
        <div className="ds-settings-group-items">
          <Row
            label="Accent Color"
            sublabel={
              'accent' in ov ? 'This profile sets the app accent' : 'Following the app setting'
            }
            control={
              <div className="pfm-override">
                <div className="wg-swatch-row" role="group" aria-label="Accent override">
                  {ACCENTS.map((id) => (
                    <Swatch
                      key={id}
                      color={`var(--accent-${id})`}
                      label={id}
                      size={22}
                      selected={shown<string>('accent') === id}
                      onClick={() => setOverride(profile.id, 'accent', id)}
                    />
                  ))}
                </div>
                <ClearOverride on={'accent' in ov} onClear={() => setOverride(profile.id, 'accent', undefined)} />
              </div>
            }
          />
          <div className="stx-wallpaper">
            <div className="stx-preview-label">
              Wallpaper
              <ClearOverride
                on={'wallpaper' in ov}
                onClear={() => setOverride(profile.id, 'wallpaper', undefined)}
              />
            </div>
            <div className="wp-thumbs">
              {WALLPAPERS.map((wp) => {
                const img = (isLight ? wp.light : wp.dark).img;
                const active = shown<string>('wallpaper') === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    className={active ? 'wp-thumb is-active' : 'wp-thumb'}
                    aria-label={wp.name}
                    aria-pressed={active}
                    onClick={() => setOverride(profile.id, 'wallpaper', wp.id)}
                    style={{ backgroundImage: `url("${img}")` }}
                  >
                    <span className="wp-thumb-name">{wp.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="wp-effect-row">
              <span className="wp-effect-label">Blur</span>
              <Slider
                min={0}
                max={60}
                step={2}
                value={shown<number>('wpBlur')}
                onChange={(v) => setOverride(profile.id, 'wpBlur', v)}
                aria-label="Wallpaper blur"
              />
              <span className="wp-effect-val">{shown<number>('wpBlur')}px</span>
            </div>
            <div className="wp-effect-row">
              <span className="wp-effect-label">Opacity</span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={shown<number>('wpOpacity')}
                onChange={(v) => setOverride(profile.id, 'wpOpacity', v)}
                aria-label="Wallpaper opacity"
              />
              <span className="wp-effect-val">{shown<number>('wpOpacity')}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Game Link ──────────────────────────────────────────────────── */}
      <div className="ds-settings-group expanded">
        <GroupTitle
          action={
            <Toggle
              checked={profile.gameLink.enabled}
              onChange={(on) => patchGameLink({ enabled: on })}
              aria-label="Game Link"
            />
          }
        >
          Game Link
        </GroupTitle>
        <div className="ds-settings-group-items">
          <p className="pfm-hint">
            Launching one of these games switches to {profile.name}. A game beats an open schedule — and
            quitting hands you back, unless you picked something else in the meantime.
          </p>
          {linked.length > 0 && (
            <div className="pfm-tiles">
              {linked.map((g: AiGame) => (
                <GameTile key={g.id} cover={gameArt(g.art)} name={g.title} size="sm" />
              ))}
            </div>
          )}
          <button
            type="button"
            className="pfm-disclosure"
            aria-expanded={pickingGames}
            aria-controls="pfm-gamelist"
            onClick={() => setPickingGames((o) => !o)}
          >
            <Icon name={pickingGames ? 'chevron-up' : 'chevron-down'} size={14} aria-hidden />
            {linked.length ? `${linked.length} linked` : 'Choose games'}
          </button>
          {pickingGames && (
            <div id="pfm-gamelist" className="pfm-gamelist" role="group" aria-label="Linked games">
              {INITIAL_GAMES.map((g: AiGame) => (
                <ListItem
                  key={g.id}
                  label={g.title}
                  leading={
                    <Checkbox
                      checked={profile.gameLink.gameIds.includes(g.id)}
                      onChange={() => toggleGame(g.id)}
                      aria-label={g.title}
                    />
                  }
                  trailing={<span className="pfm-game-platform">{g.platform}</span>}
                  onClick={() => toggleGame(g.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule ───────────────────────────────────────────────────── */}
      <div className="ds-settings-group expanded">
        <GroupTitle
          action={
            <Toggle
              checked={profile.schedule.enabled}
              onChange={(on) => patchSchedule({ enabled: on })}
              aria-label="Schedule"
            />
          }
        >
          Schedule
        </GroupTitle>
        <div className="ds-settings-group-items">
          <Row
            label="Start"
            sublabel="When this profile takes over"
            control={
              <Input
                type="time"
                aria-label="Start time"
                value={toTimeValue(profile.schedule.start)}
                onChange={(e) => patchSchedule({ start: fromTimeValue(e.target.value) })}
              />
            }
          />
          <Row
            label="End"
            sublabel="A window may cross midnight — it belongs to the day it started on"
            control={
              <Input
                type="time"
                aria-label="End time"
                value={toTimeValue(profile.schedule.end)}
                onChange={(e) => patchSchedule({ end: fromTimeValue(e.target.value) })}
              />
            }
          />
          <div className="pfm-days" role="group" aria-label="Days">
            {DAYS.map((d) => (
              <Chip
                key={d.i}
                selected={profile.schedule.days.includes(d.i)}
                onClick={() => toggleDay(d.i)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Profile Details (derived, read-only) ───────────────────────── */}
      <button
        type="button"
        className="pfm-disclosure"
        aria-expanded={showDetails}
        aria-controls="pfm-details"
        onClick={() => setShowDetails((o) => !o)}
      >
        <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={14} aria-hidden />
        {showDetails ? 'Hide Profile Details' : 'Show Profile Details'}
      </button>
      {showDetails && (
        <div id="pfm-details">
          <ProfileDetails profile={profile} />
        </div>
      )}
    </ModalShell>
  );
}

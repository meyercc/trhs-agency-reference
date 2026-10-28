import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  ContextMenu,
  ContextMenuLabel,
  Icon,
  IconButton,
  Input,
  ListItem,
  ModalShell,
  Ng3Field,
  Ng3Label,
  Ng3Section,
  Separator,
  Slider,
  Swatch,
  Toggle,
  Tooltip,
} from '../components';
import { useProfiles, type Profile } from '../state/Profiles';
import { useSettings } from '../state/Settings';
import { ACCENTS } from '../state/bindings';
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

/** 0 = Sunday, matching Date.getDay() and the Schedule model. */
const DAYS = [
  { i: 1, label: 'Mon' },
  { i: 2, label: 'Tue' },
  { i: 3, label: 'Wed' },
  { i: 4, label: 'Thu' },
  { i: 5, label: 'Fri' },
  { i: 6, label: 'Sat' },
  { i: 0, label: 'Sun' },
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
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
    .replace(/\b(Eq|Dpi)\b/g, w => w.toUpperCase());
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
  // A stored id ('bassboost', 'hardware') reads as a name.
  return String(v).replace(/^[a-z]/, c => c.toUpperCase());
};

/** Labels where the key's last segment reads badly on its own. */
const LABELS: Record<string, string> = {
  'keys.binds': 'Assignments',
  'buttons.binds': 'Assignments',
  'lighting.keyColors': 'Key colors',
};
/** Values that are ids of something with a name, and records counted in the device's own unit. */
const renderNamed = (key: string, v: unknown, lightPresets: LightPreset[]): string => {
  if (key === 'lighting.preset') return lightPresets.find(p => p.id === v)?.name ?? renderValue(v);
  return renderValue(v, key.startsWith('buttons.') ? 'button' : 'key');
};

/** A captured value that IS a color gets shown as one, not just named. */
const isColor = (v: unknown): v is string =>
  typeof v === 'string' &&
  (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^(rgb|hsl)a?\(/.test(v) || v.startsWith('var(--'));

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
/**
 * Copy one group (a device tab's captured settings) into another profile —
 * NGENUITY's copy button on each Profile Details card. The values merge into
 * the target's bag for the same device, so anything else that profile has
 * captured for it stays. A short "Copied to …" confirms it in place.
 */
function CopyGroup({
  from,
  deviceId,
  groupName,
  values,
}: {
  from: Profile;
  deviceId: string;
  groupName: string;
  values: Record<string, unknown>;
}) {
  const { profiles, mergeDeviceSettings } = useProfiles();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const others = profiles.filter(p => p.id !== from.id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes the menu only, never the modal under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      ref.current?.querySelector<HTMLElement>('.ds-btn-icon')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    // Focus the first target, so the keyboard lands in the menu.
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (others.length === 0) return null;
  const copyTo = (target: Profile) => {
    mergeDeviceSettings(target.id, deviceId, values);
    setOpen(false);
    setCopied(target.name);
  };

  return (
    <div className="pfm-copy" ref={ref}>
      {copied && (
        <span role="status">
          <Badge variant="status" tone="positive">
            Copied to {copied}
          </Badge>
        </span>
      )}
      <IconButton
        variant="ghost"
        label={`Copy ${groupName} to another profile`}
        title={`Copy ${groupName} to another profile`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="duplicate" size={16} />
      </IconButton>
      {open && (
        <ContextMenu className="pfm-copy-menu" aria-label={`Copy ${groupName} to`}>
          <ContextMenuLabel>Copy {groupName} to</ContextMenuLabel>
          {others.map(p => (
            <ListItem
              key={p.id}
              role="menuitem"
              label={p.name}
              leading={<ProfileAvatar profile={p} size={20} />}
              onClick={() => copyTo(p)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  copyTo(p);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
                  const i = items.indexOf(e.currentTarget);
                  items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
                }
              }}
            />
          ))}
        </ContextMenu>
      )}
    </div>
  );
}

/** Key and button assignments, captured per key: `{ code: { base?, fn? } }` for a
 *  keyboard, `{ button: { label } | 'disabled' }` for a mouse. */
const BIND_KEYS = new Set(['keys.binds', 'buttons.binds']);
/** Never a row: the ordered preset list a profile kept from 2026-10-06 to 10-21
 *  (read off NGENUITY's Profile Details, an error in the Figma files — Chris).
 *  A profile keeps one preset, `lighting.preset`, which renders as a swatch row. */
const PRESET_KEYS = new Set(['lighting.presets']);
/** Rows with a swatch sort first: the lighting preset, then plain colors. */
const colorRank = (key: string, v: unknown) => (key === 'lighting.preset' ? 0 : isColor(v) ? 1 : 2);
/** Letters in a label's longest word: past six, a 64px cap steps its type down. */
const longestWord = (text: string) => Math.max(...text.split(/[\s/]/).map(w => w.length));
type BindTile = { id: string; text: string; from: string; fn?: boolean; off?: boolean };
const bindTiles = (key: string, v: unknown): BindTile[] => {
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v as Record<string, unknown>).flatMap(([id, b]): BindTile[] => {
    const from = humanize(id);
    if (b === 'disabled') return [{ id, text: from, from, off: true }];
    if (!b || typeof b !== 'object') return [];
    if (key === 'buttons.binds') {
      const label = (b as { label?: string }).label;
      return label ? [{ id, text: label, from }] : [];
    }
    const { base, fn } = b as { base?: string; fn?: string };
    return [
      ...(base != null ? [{ id, text: base, from }] : []),
      ...(fn != null ? [{ id: id + ':fn', text: fn, from, fn: true }] : []),
    ];
  });
};

/**
 * What each remapped key or button does now, as a grid of keycaps
 * (NGENUITY's Profile Details "Keys" card). A disabled one is red. The key it
 * replaced names the cap for assistive tech and on hover.
 */
function BindGrid({ tiles }: { tiles: BindTile[] }) {
  return (
    <ul className="pfm-binds" aria-label="Assignments">
      {tiles.map(t => {
        const name = t.off ? `${t.from} disabled` : `${t.from}${t.fn ? ' (Fn)' : ''} → ${t.text}`;
        return (
          <li
            key={t.id}
            className={'pfm-bind' + (t.off ? ' off' : '') + (longestWord(t.text) > 6 ? ' long' : '')}
            title={name}
            aria-label={name}
          >
            <span className="pfm-bind-text">
              {/* "Play/Pause" may break after its slash, never inside a word. */}
              {t.text.split('/').flatMap((part, i) => (i ? ['/', <wbr key={i} />, part] : [part]))}
            </span>
            {t.fn && (
              <span className="pfm-bind-fn" aria-hidden>
                Fn
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ProfileDetails({ profile }: { profile: Profile }) {
  const devices = Object.entries(profile.devices).filter(([, bag]) => Object.keys(bag ?? {}).length > 0);
  // The lighting preset library is a Settings list now, so a user-made preset
  // shows its name here the same as a factory one.
  const { lightPresets } = useSettings();

  if (devices.length === 0) {
    return (
      <p className="pfm-empty">
        Nothing captured yet. Open a device from the Devices panel while <strong>{profile.name}</strong> is active —
        what you change there is saved to this profile.
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
          (a, b) => tabs.findIndex(t => t.id === a[0]) - tabs.findIndex(t => t.id === b[0]),
        );
        // The device card is the Ng3 section surface — the same card a device
        // panel is built from, so a device's settings look the same here as
        // where they were set. One sunken sub-card per tab inside it.
        return (
          // A device with one group takes half the row, so two of them sit side
          // by side; a device with several takes the whole row and lays its
          // groups side by side (NGENUITY's Profile Details, Kristy 2026-10-01).
          <Ng3Section
            as="section"
            key={skuId}
            className="pfm-device"
            // How many group-widths it asks for in the row (see .pfm-device).
            style={{ '--groups': ordered.length } as React.CSSProperties}
            aria-label={sku?.name ?? skuId}
          >
            <h4 className="pfm-device-head">
              <Icon name={(sku && TYPE_ICON[sku.type]) ?? 'devices'} size={20} aria-hidden />
              <Ng3Label strong>{sku?.name ?? skuId}</Ng3Label>
            </h4>
            <div className="pfm-device-groups">
              {ordered.map(([tabId, rows]) => {
                const tab = tabs.find(t => t.id === tabId);
                return (
                  <div key={tabId} className="pfm-group">
                    <div className="pfm-group-head">
                      <Ng3Label strong>{tab?.title ?? humanize(tabId)}</Ng3Label>
                      <CopyGroup
                        from={profile}
                        deviceId={skuId}
                        groupName={tab?.title ?? humanize(tabId)}
                        values={Object.fromEntries(rows)}
                      />
                    </div>
                    <Separator />
                    {rows
                      .filter(([key]) => BIND_KEYS.has(key))
                      .map(([key, value]) => {
                        const tiles = bindTiles(key, value);
                        return tiles.length ? <BindGrid key={key} tiles={tiles} /> : null;
                      })}
                    <dl className="pfm-rows">
                      {rows
                        .filter(([key]) => !BIND_KEYS.has(key) && !PRESET_KEYS.has(key))
                        // The color leads (Kristy 2026-10-06): the preset, then any
                        // captured color, then the rest in captured order.
                        .sort(([ak, av], [bk, bv]) => colorRank(ak, av) - colorRank(bk, bv))
                        .map(([key, value]) => (
                          <div key={key} className="pfm-row">
                            {(() => {
                              const swatch =
                                key === 'lighting.preset'
                                  ? lightPresets.find(p => p.id === value)?.swatch
                                  : isColor(value)
                                  ? value
                                  : undefined;
                              return swatch ? (
                                <span className="pfm-dot" style={{ background: swatch }} aria-hidden />
                              ) : null;
                            })()}
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
export function ProfilesModal({ onClose, initialProfileId }: { onClose: () => void; initialProfileId?: string }) {
  const {
    profiles,
    activeId,
    createProfile,
    updateProfile,
    deleteProfile,
    selectProfile,
    setOverride,
    exportProfiles,
    importProfiles,
  } = useProfiles();
  const { getBaseline, isLight } = useSettings();

  // Opened from the page's New profile slot, it lands on the one just made.
  const [editingId, setEditingId] = useState(initialProfileId ?? activeId);
  const [showDetails, setShowDetails] = useState(false);
  // Opening Profile Details scrolls its heading to the top of the modal, so
  // what just opened is in view (Kristy 2026-10-06). In an effect, after the
  // details render, so there is room to scroll.
  const detailsHeadingRef = useRef<HTMLButtonElement>(null);
  const scrollToDetails = useRef(false);
  useEffect(() => {
    if (!showDetails || !scrollToDetails.current) return;
    scrollToDetails.current = false;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    detailsHeadingRef.current?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  }, [showDetails]);
  const [pickingGames, setPickingGames] = useState(false);
  const gamePickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickingGames) return;
    const onDown = (e: PointerEvent) => {
      if (!gamePickRef.current?.contains(e.target as Node)) setPickingGames(false);
    };
    // Escape closes the picker only, never the modal under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setPickingGames(false);
      gamePickRef.current?.querySelector<HTMLElement>('.pfm-disclosure')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [pickingGames]);
  const profile = profiles.find(p => p.id === editingId) ?? profiles[0];
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
      ? profile.schedule.days.filter(d => d !== i)
      : [...profile.schedule.days, i].sort();
    patchSchedule({ days });
  };
  const toggleGame = (id: string) => {
    const gameIds = profile.gameLink.gameIds.includes(id)
      ? profile.gameLink.gameIds.filter(g => g !== id)
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
        {profiles.map(p => (
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
          onChange={e => {
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
          const next = profiles.find(p => p.id !== profile.id);
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

      {/* NGENUITY's layout (Beta Profiles, Kristy 2026-10-01: "太鬆散了"): who the
          profile is and how it looks on the left, what turns it on stacked on
          the right, the details underneath. One card per concern, no sublabels:
          each control's label says what it is, and the band on Personalize
          explains the switching. */}
      <div className="pfm-grid">
        {/* ── Identity + appearance ────────────────────────────────────── */}
        <div className="ds-settings-group expanded pfm-card">
          <div className="pfm-name">
            <ProfileAvatar profile={profile} size={32} />
            <Input
              value={profile.name}
              aria-label="Profile name"
              onChange={e => updateProfile(profile.id, { name: e.target.value })}
            />
          </div>

          <div className="pfm-field">
            <div className="pfm-field-head">
              <Ng3Label>Photo</Ng3Label>
              <Button size="sm" variant="ghost" onClick={() => photoInput.current?.click()}>
                <Icon name="image-upload" size={14} aria-hidden /> Upload
              </Button>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                hidden
                aria-label="Choose a profile photo"
                onChange={e => {
                  void uploadPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="wg-swatch-row pfm-swatches" role="group" aria-label="Profile photo">
              {WALLPAPERS.map(wp => (
                <Swatch
                  key={wp.id}
                  image={profileImageSrc(WALLPAPER_IMAGE_PREFIX + wp.id, isLight)}
                  label={wp.name}
                  size={24}
                  selected={profileWallpaperId(profile.image) === wp.id}
                  onClick={() => updateProfile(profile.id, { image: WALLPAPER_IMAGE_PREFIX + wp.id })}
                />
              ))}
            </div>
          </div>

          <div className="pfm-field">
            <div className="pfm-field-head">
              <Ng3Label>Accent</Ng3Label>
              <ClearOverride on={'accent' in ov} onClear={() => setOverride(profile.id, 'accent', undefined)} />
            </div>
            <div className="wg-swatch-row pfm-swatches" role="group" aria-label="Accent override">
              {ACCENTS.map(id => (
                <Swatch
                  key={id}
                  color={`var(--accent-${id})`}
                  label={id}
                  size={24}
                  selected={shown<string>('accent') === id}
                  onClick={() => setOverride(profile.id, 'accent', id)}
                />
              ))}
            </div>
          </div>

          <div className="pfm-field">
            <div className="pfm-field-head">
              <Ng3Label>Wallpaper</Ng3Label>
              <ClearOverride on={'wallpaper' in ov} onClear={() => setOverride(profile.id, 'wallpaper', undefined)} />
            </div>
            {/* NGENUITY's square grid rather than Settings' wide thumbnails:
                the picture is the choice, and its name is the tooltip. */}
            <div className="pfm-wallpapers" role="group" aria-label="Wallpaper">
              {WALLPAPERS.map(wp => (
                <Swatch
                  key={wp.id}
                  image={(isLight ? wp.light : wp.dark).img}
                  label={wp.name}
                  size={40}
                  selected={shown<string>('wallpaper') === wp.id}
                  onClick={() => setOverride(profile.id, 'wallpaper', wp.id)}
                />
              ))}
            </div>
            <div className="wp-effect-row">
              <span className="wp-effect-label">Blur</span>
              <Slider
                min={0}
                max={60}
                step={2}
                value={shown<number>('wpBlur')}
                onChange={v => setOverride(profile.id, 'wpBlur', v)}
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
                onChange={v => setOverride(profile.id, 'wpOpacity', v)}
                aria-label="Wallpaper opacity"
              />
              <span className="wp-effect-val">{shown<number>('wpOpacity')}%</span>
            </div>
          </div>
        </div>

        {/* ── What turns it on ─────────────────────────────────────────── */}
        <div className="pfm-col">
          <div className={'ds-settings-group expanded pfm-card' + (profile.gameLink.enabled ? '' : ' is-off')}>
            <GroupTitle
              action={
                <Toggle
                  checked={profile.gameLink.enabled}
                  onChange={on => {
                    patchGameLink({ enabled: on });
                    // Turning it on with nothing linked goes straight to the
                    // games: an empty "on" is a click that seems to do nothing.
                    if (on && linked.length === 0) setPickingGames(true);
                  }}
                  aria-label="Game Link"
                />
              }
            >
              Game Link
            </GroupTitle>
            {linked.length > 0 ? (
              // Square covers in one row, as NGENUITY shows linked games. Not
              // GameTiles: those are play buttons, and nothing plays from here.
              <ul className="pfm-games" aria-label="Linked games">
                {linked.map((g: AiGame) => (
                  <li key={g.id}>
                    <Tooltip content={g.title}>
                      <img className="pfm-game" src={gameArt(g.art)} alt={g.title} tabIndex={0} />
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pfm-games-empty">No games linked</p>
            )}
            {/* The picker floats over the cards instead of growing the Game
                Link card (Kristy 2026-10-06: opening it stretched every card
                in the row). Outside press or Escape closes it. */}
            <div className="pfm-gamepick" ref={gamePickRef}>
              <button
                type="button"
                className="pfm-disclosure"
                aria-expanded={pickingGames}
                aria-controls="pfm-gamelist"
                onClick={() => setPickingGames(o => !o)}
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
                      // The box and the row are both ways to toggle the game, and a
                      // click on the box used to be BOTH: the label's click and the
                      // input's follow-up click each bubbled to the row, so one click
                      // toggled the game three times (three renders, three saves, a
                      // flicker that read as lag). The box keeps its own click.
                      leading={
                        <span onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={profile.gameLink.gameIds.includes(g.id)}
                            onChange={() => toggleGame(g.id)}
                            aria-label={g.title}
                          />
                        </span>
                      }
                      trailing={<span className="pfm-game-platform">{g.platform}</span>}
                      onClick={() => toggleGame(g.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={'ds-settings-group expanded pfm-card' + (profile.schedule.enabled ? '' : ' is-off')}>
            <GroupTitle
              action={
                <Toggle
                  checked={profile.schedule.enabled}
                  onChange={on => patchSchedule({ enabled: on })}
                  aria-label="Schedule"
                />
              }
            >
              Schedule
            </GroupTitle>
            {/* Start → End on one line, as NGENUITY draws it. A window may
                cross midnight; it belongs to the day it started on. */}
            <div className="pfm-window">
              <Ng3Field className="pfm-time">
                <Ng3Label>Start</Ng3Label>
                <Input
                  type="time"
                  aria-label="Start time"
                  value={toTimeValue(profile.schedule.start)}
                  onChange={e => patchSchedule({ start: fromTimeValue(e.target.value) })}
                />
              </Ng3Field>
              <span className="pfm-window-arrow" aria-hidden>
                <Icon name="chevron-right" size={14} />
              </span>
              <Ng3Field className="pfm-time">
                <Ng3Label>End</Ng3Label>
                <Input
                  type="time"
                  aria-label="End time"
                  value={toTimeValue(profile.schedule.end)}
                  onChange={e => patchSchedule({ end: fromTimeValue(e.target.value) })}
                />
              </Ng3Field>
            </div>
            <div className="pfm-days" role="group" aria-label="Days">
              {DAYS.map(d => (
                <Chip key={d.i} selected={profile.schedule.days.includes(d.i)} onClick={() => toggleDay(d.i)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Details (derived, read-only) ───────────────────────────
          A section heading you can open, not a bar under a divider (Kristy
          2026-10-06): the title on the left like every card title, Show/Hide
          and the chevron on the right where the eye looks for the action. */}
      <button
        type="button"
        className="pfm-details-toggle"
        aria-expanded={showDetails}
        aria-controls="pfm-details"
        ref={detailsHeadingRef}
        onClick={() => {
          scrollToDetails.current = !showDetails;
          setShowDetails(o => !o);
        }}
      >
        <span className="pfm-details-heading">
          <span className="stx-group-title">Profile Details</span>
          <span className="pfm-details-sub">Device presets saved and synced with this profile.</span>
        </span>
        <span className="pfm-details-action">
          {showDetails ? 'Hide' : 'Show'}
          <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={14} aria-hidden />
        </span>
      </button>
      {showDetails && (
        <div id="pfm-details">
          <ProfileDetails profile={profile} />
        </div>
      )}
    </ModalShell>
  );
}

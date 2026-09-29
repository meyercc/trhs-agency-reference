// ══════════════════════════════════════════════════════════════════════════
// The Mode Bar — the monitor's saved unit, in the device panel's tab strip.
//
// The NAME is ours; the COMPONENT is Chris's. The monitor section does not use
// the word "profile" (it collides with the system Active Profile; see
// design-assets/profile-proposal-2026-07.md), so his name cannot travel here.
//
// Ported 2026-09-24 (Chris) from a copy of his retired two-half ProfileBar to
// the same thing his profile selector became in v0.2.25: one grouped Dropdown
// in the panel's `leading` slot, opening upward, with the bar's one voice —
// the new-preset editor, the layout question, a receipt — in the `trailing`
// slot. The two layers stay: the desk's software profile is the first group,
// this monitor's own modes and presets the next two. Picking is switching;
// picking the software profile unpins the monitor. The desk half no longer
// lists every profile — that is the Active Profile card's job, the same as on
// every other device's selector.
//
// Why it is not a card in a tab: a mode spans the modal (picture on Display, EQ
// on Audio, under-glow on Lights), so its readout has to too. Change the
// brightness on Display and the receipt appears in the same place it does on
// Lights, because the strip is in neither tab. See `monitorMode.tsx` for the
// state and the decisions behind it.
// ══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import '../profile-bar.css';
import { Badge, Button, Dropdown, Icon, Input, Tooltip, type DropdownGroup } from '../../components';
import { useProfiles } from '../../state/Profiles';
import { useMonitorMode } from './monitorMode';

const SOFTWARE = 'software';

/**
 * The selector — goes in `Ng3Panel`'s `leading` slot. Three groups: the desk's
 * software profile, the built-in modes, the user's presets (when there are
 * any), and an "Add new preset" action under a rule. A row that remembers a
 * split layout says so with the `dpi-split` glyph — nearly everything sits on
 * Full Screen, so marking the exception is the signal.
 */
export function MonitorModeBar({ onAddPreset }: { onAddPreset: () => void }) {
  const m = useMonitorMode();
  const { activeProfile } = useProfiles();
  if (!m || m.modes.length === 0) return null;

  const pinned = m.mode !== '';
  const custom = m.modes.filter((x) => !m.builtIn.includes(x));
  const row = (name: string) => {
    const layout = m.layoutFor(name);
    const split = layout && layout !== 'Full Screen';
    return {
      value: name,
      label: name,
      icon: 'profile' as const,
      trailing: split ? <Icon name="dpi-split" size="sm" aria-label={`remembers ${layout}`} /> : undefined,
    };
  };
  const groups: DropdownGroup[] = [
    { label: 'Software', options: [{ value: SOFTWARE, label: activeProfile.name, icon: 'profile' }] },
    { label: 'Modes', options: m.builtIn.map(row) },
    ...(custom.length ? [{ label: 'Presets', options: custom.map(row) }] : []),
  ];

  return (
    <div className="pb">
      <Dropdown
        className="pb-select"
        aria-label="Mode — the desk's software profile, or one of this monitor's modes and presets"
        groups={groups}
        value={pinned ? m.mode : SOFTWARE}
        onChange={(v) => m.select(v === SOFTWARE ? '' : v)}
        openUp
        // Full → this still answers, but it answers with where to go (the
        // limit notice names Utilities). Hiding the row would make the ceiling
        // invisible; disabling it would make it silent (2026-08-07).
        footer={{
          label: 'Add new preset',
          icon: 'add-small',
          onSelect: () => (m.canAddPreset ? onAddPreset() : m.noticeLimit()),
        }}
      />
    </div>
  );
}

/**
 * The strip's one voice — goes in `Ng3Panel`'s `trailing` slot. Faces, one at
 * a time, in the order of who is waiting: the new-preset editor, then the
 * layout question, then a receipt. Anything that waits for an answer outranks
 * anything that only reports. The Auto-switch tag stands in front of all of
 * them: the standing state of the automation, readable whichever mode is
 * current, without going to Settings (Cindy's HyperX review, 2026-09-23).
 */
export function MonitorModeActions({ adding, onDone }: { adding: boolean; onDone: () => void }) {
  const m = useMonitorMode();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  if (!m || m.modes.length === 0) return null;

  const clean = draft.trim();
  const taken = clean !== '' && m.modes.includes(clean);
  const commit = () => {
    if (!clean || taken) return;
    m.addPreset(clean);
    setDraft('');
    onDone();
  };
  const cancel = () => {
    setDraft('');
    onDone();
  };

  const note = (text: string, extra?: string, tip?: string) => (
    <span className={'pb-note' + (extra ? ' ' + extra : '')} title={text}>
      {extra?.startsWith('pb-') && <Icon name={extra.startsWith('pb-ok') ? 'check' : 'alert'} size="sm" aria-hidden />}
      <span className="pb-note-text">{text}</span>
      {tip && (
        <Tooltip content={tip} placement="bottom">
          <button type="button" className="ds-tooltip-trigger" aria-label="More info">
            <Icon name="info" size="sm" />
          </button>
        </Tooltip>
      )}
    </span>
  );

  const notice = m.notice;
  const face = adding ? (
    <>
      {/* Short on purpose — the strip is one line. "Starts from your current
          settings" rides on the field's title; Save is disabled rather than
          hidden while the name is empty or taken, so the button itself is the
          explanation, and a taken name says so in words beside it. */}
      {taken && note('Name already in use', 'pb-warn')}
      <Input
        ref={inputRef}
        value={draft}
        placeholder="Preset name"
        aria-label="New preset name"
        aria-invalid={taken || undefined}
        title="New preset — starts from your current settings"
        wrapClassName="mb-name"
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            e.stopPropagation();
            cancel();
          }
        }}
      />
      <Button size="sm" onClick={cancel}>
        Cancel
      </Button>
      <Button size="sm" variant="accent" onClick={commit} disabled={!clean || taken}>
        Save preset
      </Button>
    </>
  ) : m.layoutAsk ? (
    // The confirmed-save class, and the only control in it. Picture, EQ and
    // under-glow save quietly; a split screen does not, because it is the one
    // setting that rearranges the windows the user is working in — so the mode
    // learns it only if asked. "Not now" rather than Cancel: nothing is undone,
    // the layout stays on screen either way.
    <>
      {note(
        `Remember this layout for ${m.layoutAsk.mode}?`,
        undefined,
        `It will apply whenever ${m.layoutAsk.mode} activates. The layout stays on screen either way.`,
      )}
      <Button size="sm" onClick={m.dismissLayout}>
        Not now
      </Button>
      <Button size="sm" variant="accent" onClick={m.saveLayout}>
        Save
      </Button>
    </>
  ) : notice?.kind === 'limit' ? (
    // Not an error — a ceiling, said once, with the door named.
    note('Three presets is the limit — manage them in Utilities', 'pb-warn')
  ) : notice ? (
    note(
      notice.kind === 'reset'
        ? `${notice.mode} reset to defaults`
        : // The mode is named because the save is per mode — a bare "Saved"
          // reads as global and that is the one thing this model is not.
          notice.mode
          ? `Saved to ${notice.mode}${notice.scope ? ` · ${notice.scope}` : ''}`
          : 'Saved',
      'pb-ok',
    )
  ) : null;

  if (!m.autoSwitch && !face) return null;
  return (
    <div className="pb-actions">
      {m.autoSwitch && (
        <span className="mc-label-tag">
          <Badge variant="status">Auto-switch</Badge>
        </span>
      )}
      {face}
    </div>
  );
}

import type React from 'react';
import { Icon } from '../components';
import { useSettings } from '../state/Settings';
import { useProfiles, type OverridableName } from '../state/Profiles';

/**
 * Says when the active profile has taken a setting over.
 *
 * Without it the Appearance rows are a trap: they edit the BASELINE, but an
 * override wins, so changing accent while a profile overrides it looks like a
 * broken control — the swatch moves and the app doesn't. The note names who is
 * winning and offers the one gesture that hands the key back.
 *
 * It lived in SettingsModal until Appearance moved into its own panel, and did
 * not make the move — `verify-profile-surfaces` caught the gap.
 */
export function OverrideNote({ name }: { name: OverridableName }) {
  const { isOverridden } = useSettings();
  const { activeProfile, setOverride } = useProfiles();
  if (!isOverridden(name)) return null;
  return (
    <span className="stx-override">
      <Icon name="info" size={13} aria-hidden />
      <span>
        Set by the <strong>{activeProfile.name}</strong> profile
      </span>
      <button type="button" className="stx-override-clear" onClick={() => setOverride(activeProfile.id, name, undefined)}>
        Clear
      </button>
    </span>
  );
}

/** One label/sublabel + control row inside a settings group. */
export function SettingsRow({
  label,
  sublabel,
  control,
}: {
  label: string;
  sublabel: React.ReactNode;
  control: React.ReactNode;
}) {
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

export function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-settings-group-header stx-static">
      <div className="ds-settings-group-titles">
        <div className="stx-group-title">{children}</div>
      </div>
    </div>
  );
}

import { WidgetShell, ToggleButtonGroup } from '../components';
import { useSettings } from '../state/Settings';
import { SOFTWARE_PROFILES } from '../state/profiles';

export function ActiveProfileWidget() {
  const { activeProfileId, setActiveProfileId } = useSettings();
  return (
    <WidgetShell title="Active Profile" action={{ label: 'Manage →' }}>
      <div style={{ marginTop: 'var(--gutter-sm)' }}>
        <ToggleButtonGroup
          aria-label="Profile"
          value={activeProfileId}
          onChange={setActiveProfileId}
          options={SOFTWARE_PROFILES.map((p) => ({ label: p.name, value: p.id }))}
        />
      </div>
    </WidgetShell>
  );
}

import { useSearchParams } from 'react-router-dom';
import { WidgetShell, ToggleButtonGroup } from '../components';
import { useProfiles } from '../state/Profiles';

export function ActiveProfileWidget() {
  const { profiles, activeId, selectProfile } = useProfiles();
  const [, setParams] = useSearchParams();
  const openManage = () =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'profiles');
      return p;
    });
  return (
    <WidgetShell title="Active Profile" action={{ label: 'Manage →', onClick: openManage }}>
      <div style={{ marginTop: 'var(--gutter-sm)' }}>
        <ToggleButtonGroup
          aria-label="Profile"
          value={activeId}
          onChange={selectProfile}
          options={profiles.map((p) => ({ label: p.name, value: p.id }))}
        />
      </div>
    </WidgetShell>
  );
}
